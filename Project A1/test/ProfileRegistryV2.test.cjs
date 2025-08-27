const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ProfileRegistryV2", function () {
  let profileRegistry;
  let badgeMinter;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy MockBadgeMinter
    const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
    badgeMinter = await MockBadgeMinter.deploy();
    await badgeMinter.waitForDeployment();

    // Deploy ProfileRegistryV2 using upgradeable pattern
    const ProfileRegistryV2 = await ethers.getContractFactory("ProfileRegistryV2");
    profileRegistry = await upgrades.deployProxy(
      ProfileRegistryV2,
      [badgeMinter.target],
      { initializer: "initialize" }
    );
    await profileRegistry.waitForDeployment();
  });

  it("Should deploy with the correct BadgeMinter address", async function () {
    expect(await profileRegistry.badgeMinter()).to.equal(badgeMinter.target);
  });

  it("Should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
    const DEFAULT_ADMIN_ROLE = await profileRegistry.DEFAULT_ADMIN_ROLE();
    expect(await profileRegistry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
  });

  it("Should prevent re-initialization", async function () {
    await expect(
      profileRegistry.initialize(badgeMinter.target)
    ).to.be.revertedWithCustomError(profileRegistry, "InvalidInitialization");
  });

  describe("setUsername", function () {
    it("Should allow a user to set their username", async function () {
      const username = "testuser";
      await expect(profileRegistry.connect(addr1).setUsername(username))
        .to.emit(profileRegistry, "UsernameUpdated")
        .withArgs(addr1.address, username);
      expect(await profileRegistry.usernames(addr1.address)).to.equal(username);
    });

    it("Should allow a user to update their username", async function () {
      await profileRegistry.connect(addr1).setUsername("olduser");
      await expect(profileRegistry.connect(addr1).setUsername("newuser"))
        .to.emit(profileRegistry, "UsernameUpdated")
        .withArgs(addr1.address, "newuser");
      expect(await profileRegistry.usernames(addr1.address)).to.equal("newuser");
    });

    it("Should not allow an empty username", async function () {
      await expect(profileRegistry.connect(addr1).setUsername(""))
        .to.be.revertedWithCustomError(profileRegistry, "UsernameCannotBeEmpty");
    });

    it("Should not allow a username that is already taken", async function () {
      await profileRegistry.connect(addr1).setUsername("takenuser");
      await expect(profileRegistry.connect(addr2).setUsername("takenuser"))
        .to.be.revertedWithCustomError(profileRegistry, "UsernameAlreadyTaken");
    });

    it("Should clear previous username when updating", async function () {
      // Set initial username
      await profileRegistry.connect(addr1).setUsername("firstuser");
      
      // Check previous username mapping
      expect(await profileRegistry.addressForUsername("firstuser")).to.equal(addr1.address);
      
      // Update username
      await profileRegistry.connect(addr1).setUsername("seconduser");
      
      // Verify previous username is cleared
      expect(await profileRegistry.addressForUsername("firstuser")).to.equal(ethers.ZeroAddress);
      expect(await profileRegistry.addressForUsername("seconduser")).to.equal(addr1.address);
    });
  });

  describe("addBadgeToProfile", function () {
    const BADGE_ID = 1;

    beforeEach(async function () {
      // Mint a badge to addr1
      await badgeMinter.mint(addr1.address, BADGE_ID, "ipfs://testuri/1");
    });

    it("Should allow a user to add a badge they own to their profile", async function () {
      await expect(profileRegistry.connect(addr1).addBadgeToProfile(BADGE_ID))
        .to.emit(profileRegistry, "BadgeAddedToProfile")
        .withArgs(addr1.address, BADGE_ID);
      
      const [, badges] = await profileRegistry.getProfile(addr1.address);
      expect(badges).to.deep.equal([BigInt(BADGE_ID)]);
    });

    it("Should not allow adding a badge not owned by the user", async function () {
      // Mint badge to addr2 instead of addr1
      await badgeMinter.mint(addr2.address, 2, "ipfs://testuri/2");
      await expect(profileRegistry.connect(addr1).addBadgeToProfile(2))
        .to.be.revertedWithCustomError(profileRegistry, "BadgeNotOwned");
    });

    it("Should not allow adding a badge already on the profile", async function () {
      await profileRegistry.connect(addr1).addBadgeToProfile(BADGE_ID);
      await expect(profileRegistry.connect(addr1).addBadgeToProfile(BADGE_ID))
        .to.be.revertedWithCustomError(profileRegistry, "BadgeAlreadyOnProfile");
    });

    it("Should maintain badge order when adding multiple", async function () {
      // Mint additional badges
      await badgeMinter.mint(addr1.address, 2, "ipfs://testuri/2");
      await badgeMinter.mint(addr1.address, 3, "ipfs://testuri/3");
      
      // Add in reverse order
      await profileRegistry.connect(addr1).addBadgeToProfile(3);
      await profileRegistry.connect(addr1).addBadgeToProfile(2);
      await profileRegistry.connect(addr1).addBadgeToProfile(1);
      
      const [, badges] = await profileRegistry.getProfile(addr1.address);
      expect(badges).to.deep.equal([3n, 2n, 1n]);
    });

    it("Should handle ownerOf reverts gracefully", async function () {
      // Configure mock to revert on ownerOf calls
      await badgeMinter.setRevertOwnerOf(true);
      
      await expect(profileRegistry.connect(addr1).addBadgeToProfile(BADGE_ID))
        .to.be.revertedWith("MockBadgeMinter: ownerOf reverted");
    });
  });

  describe("removeBadgeFromProfile", function () {
    const BADGE_ID_1 = 1;
    const BADGE_ID_2 = 2;
    const BADGE_ID_3 = 3;

    beforeEach(async function () {
      // Mint and add three badges
      await badgeMinter.mint(addr1.address, BADGE_ID_1, "ipfs://testuri/1");
      await badgeMinter.mint(addr1.address, BADGE_ID_2, "ipfs://testuri/2");
      await badgeMinter.mint(addr1.address, BADGE_ID_3, "ipfs://testuri/3");
      
      await profileRegistry.connect(addr1).addBadgeToProfile(BADGE_ID_1);
      await profileRegistry.connect(addr1).addBadgeToProfile(BADGE_ID_2);
      await profileRegistry.connect(addr1).addBadgeToProfile(BADGE_ID_3);
    });

    it("Should allow removing a badge from the profile", async function () {
      await expect(profileRegistry.connect(addr1).removeBadgeFromProfile(BADGE_ID_2))
        .to.emit(profileRegistry, "BadgeRemovedFromProfile")
        .withArgs(addr1.address, BADGE_ID_2);
      
      const [, badges] = await profileRegistry.getProfile(addr1.address);
      expect(badges).to.deep.equal([1n, 3n]); // Should maintain order
    });

    it("Should maintain order when removing first badge", async function () {
      await profileRegistry.connect(addr1).removeBadgeFromProfile(BADGE_ID_1);
      const [, badges] = await profileRegistry.getProfile(addr1.address);
      expect(badges).to.deep.equal([3n, 2n]);
    });

    it("Should maintain order when removing last badge", async function () {
      await profileRegistry.connect(addr1).removeBadgeFromProfile(BADGE_ID_3);
      const [, badges] = await profileRegistry.getProfile(addr1.address);
      expect(badges).to.deep.equal([1n, 2n]);
    });

    it("Should not allow removing a badge not on the profile", async function () {
      await expect(profileRegistry.connect(addr1).removeBadgeFromProfile(999))
        .to.be.revertedWithCustomError(profileRegistry, "BadgeNotOnProfile");
    });
  });

  describe("setTwitterHandle", function () {
    it("Should allow a user to set their Twitter handle", async function () {
      const twitterHandle = "@testuser";
      await expect(profileRegistry.connect(addr1).setTwitterHandle(twitterHandle))
        .to.emit(profileRegistry, "TwitterHandleUpdated")
        .withArgs(addr1.address, twitterHandle);
      expect(await profileRegistry.twitterHandles(addr1.address)).to.equal(twitterHandle);
    });

    it("Should allow a user to update their Twitter handle", async function () {
      await profileRegistry.connect(addr1).setTwitterHandle("@oldhandle");
      await expect(profileRegistry.connect(addr1).setTwitterHandle("@newhandle"))
        .to.emit(profileRegistry, "TwitterHandleUpdated")
        .withArgs(addr1.address, "@newhandle");
      expect(await profileRegistry.twitterHandles(addr1.address)).to.equal("@newhandle");
    });
  });

  describe("getProfile", function () {
    it("Should return complete profile information", async function () {
      // Set username, add badges, and set Twitter handle
      await profileRegistry.connect(addr1).setUsername("user1");
      await badgeMinter.mint(addr1.address, 1, "ipfs://1");
      await badgeMinter.mint(addr1.address, 2, "ipfs://2");
      await profileRegistry.connect(addr1).addBadgeToProfile(1);
      await profileRegistry.connect(addr1).addBadgeToProfile(2);
      await profileRegistry.connect(addr1).setTwitterHandle("@user1");
      
      const [username, badges, twitterHandle] = await profileRegistry.getProfile(addr1.address);
      expect(username).to.equal("user1");
      expect(badges).to.deep.equal([1n, 2n]);
      expect(twitterHandle).to.equal("@user1");
    });

    it("Should return empty profile for new address", async function () {
      const [username, badges, twitterHandle] = await profileRegistry.getProfile(addr2.address);
      expect(username).to.equal("");
      expect(badges).to.deep.equal([]);
      expect(twitterHandle).to.equal("");
    });
  });

  describe("addressForUsername", function () {
    it("Should return correct address for registered username", async function () {
      await profileRegistry.connect(addr1).setUsername("alice");
      expect(await profileRegistry.addressForUsername("alice")).to.equal(addr1.address);
    });

    it("Should return zero address for unregistered username", async function () {
      expect(await profileRegistry.addressForUsername("bob")).to.equal(ethers.ZeroAddress);
    });
  });

  describe("mintBadge integration", function () {
    it("Should work with mintBadge function", async function () {
      // Use the mintBadge function instead of mint
      const tokenURI = "ipfs://new-badge";
      const tx = await badgeMinter.mintBadge(addr1.address, tokenURI);
      const receipt = await tx.wait();
      
      // Extract token ID from event
      const event = receipt.logs.find(log => {
        try {
          return log.fragment.name === "Transfer";
        } catch (e) {
          return false;
        }
      });
      
      const tokenId = event.args[2];
      
      // Add the badge to profile
      await profileRegistry.connect(addr1).addBadgeToProfile(tokenId);
      
      const [, badges] = await profileRegistry.getProfile(addr1.address);
      expect(badges).to.deep.equal([BigInt(tokenId)]);
    });
  });
});
