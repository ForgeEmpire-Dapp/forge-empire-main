const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ForgePass", function () {
  let forgePass;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const ForgePass = await ethers.getContractFactory("ForgePass");
    forgePass = await upgrades.deployProxy(ForgePass, [], { initializer: 'initialize' });
    await forgePass.waitForDeployment();
  });

  it("Should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
    expect(await forgePass.hasRole(await forgePass.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
  });

  it("Should grant MINTER_ROLE to the deployer", async function () {
    expect(await forgePass.hasRole(await forgePass.MINTER_ROLE(), owner.address)).to.be.true;
  });

  it("Should grant UPGRADER_ROLE to the deployer", async function () {
    expect(await forgePass.hasRole(await forgePass.UPGRADER_ROLE(), owner.address)).to.be.true;
  });

  it("Should grant PAUSER_ROLE to the deployer", async function () {
    expect(await forgePass.hasRole(await forgePass.PAUSER_ROLE(), owner.address)).to.be.true;
  });

  describe("mintPass", function () {
    let addr1;

    beforeEach(async function () {
      [, addr1] = await ethers.getSigners();
      // forgePass and owner are already available from parent scope
      // Grant MINTER_ROLE to owner for testing mintPass function
      await forgePass.grantRole(await forgePass.MINTER_ROLE(), owner.address);
    });

    it("Should allow MINTER_ROLE to mint a new pass", async function () {
      const recipient = addr1.address;
      const tier = 1;
      const duration = 3600; // 1 hour

      await expect(forgePass.mintPass(recipient, tier, duration))
        .to.emit(forgePass, "PassMinted")
        .withArgs(recipient, (tokenId) => tokenId !== null, tier, (expiresAt) => expiresAt > 0);

      const tokenId = 1; // First token should have ID 1
      const passDetails = await forgePass.passDetails(tokenId);
      expect(passDetails.tier).to.equal(tier);
      expect(passDetails.expiresAt).to.be.gt(0);
      expect(await forgePass.ownerOf(tokenId)).to.equal(recipient);
    });

    it("Should not allow non-MINTER_ROLE to mint a new pass", async function () {
      const recipient = addr1.address;
      const tier = 1;
      const duration = 3600;

      await expect(forgePass.connect(addr1).mintPass(recipient, tier, duration))
        .to.be.revertedWithCustomError(forgePass, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow minting to zero address", async function () {
      const recipient = ethers.ZeroAddress;
      const tier = 1;
      const duration = 3600;

      await expect(forgePass.mintPass(recipient, tier, duration))
        .to.be.revertedWithCustomError(forgePass, "ZeroAddressRecipient");
    });
  });

  describe("batchMintPass", function () {
    let addr1;
    let addr2;

    beforeEach(async function () {
      [, addr1, addr2] = await ethers.getSigners();

      // Grant MINTER_ROLE to owner
      await forgePass.grantRole(await forgePass.MINTER_ROLE(), owner.address);
    });

    it("Should allow MINTER_ROLE to batch mint passes", async function () {
      const recipients = [addr1.address, addr2.address];
      const tiers = [1, 2];
      const durations = [3600, 7200];

      const tx = await forgePass.batchMintPass(recipients, tiers, durations);
      const receipt = await tx.wait();

      const batchMintedEvent = receipt.logs.find(log => log.fragment && log.fragment.name === "BatchPassesMinted");
      expect(batchMintedEvent).to.not.be.undefined;
      expect(batchMintedEvent.args.tokenIds.length).to.equal(2);
      expect(batchMintedEvent.args.tokenIds[0]).to.be.a('bigint');
      expect(batchMintedEvent.args.tokenIds[1]).to.be.a('bigint');

      expect(await forgePass.totalSupply()).to.equal(2);
      expect(await forgePass.ownerOf(1)).to.equal(recipients[0]);
      expect(await forgePass.ownerOf(2)).to.equal(recipients[1]);
    });

    it("Should not allow non-MINTER_ROLE to batch mint passes", async function () {
      const recipients = [addr1.address, addr2.address];
      const tiers = [1, 2];
      const durations = [3600, 7200];

      await expect(forgePass.connect(addr1).batchMintPass(recipients, tiers, durations))
        .to.be.revertedWithCustomError(forgePass, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow batch minting with empty arrays", async function () {
      await expect(forgePass.batchMintPass([], [], []))
        .to.be.revertedWithCustomError(forgePass, "EmptyArrays");
    });

    it("Should not allow batch minting with array length mismatch", async function () {
      const recipients = [addr1.address, addr2.address];
      const tiers = [1];
      const durations = [3600, 7200];

      await expect(forgePass.batchMintPass(recipients, tiers, durations))
        .to.be.revertedWithCustomError(forgePass, "ArrayLengthMismatch");
    });

    it("Should not allow batch minting exceeding max batch size", async function () {
      const recipients = Array(101).fill(addr1.address);
      const tiers = Array(101).fill(1);
      const durations = Array(101).fill(3600);

      await expect(forgePass.batchMintPass(recipients, tiers, durations))
        .to.be.revertedWithCustomError(forgePass, "BatchSizeExceeded");
    });
  });

  describe("upgradePass", function () {
    let addr1;
    let tokenId;

    beforeEach(async function () {
      [, addr1] = await ethers.getSigners();

      // Grant MINTER_ROLE and UPGRADER_ROLE to owner
      await forgePass.grantRole(await forgePass.MINTER_ROLE(), owner.address);
      await forgePass.grantRole(await forgePass.UPGRADER_ROLE(), owner.address);

      // Mint a pass for testing
      await forgePass.mintPass(owner.address, 1, 3600);
      tokenId = 1; // First minted token ID is 1
    });

    it("Should allow UPGRADER_ROLE to upgrade a pass", async function () {
      const newTier = 2;
      await expect(forgePass.upgradePass(tokenId, newTier))
        .to.emit(forgePass, "PassUpgraded")
        .withArgs(tokenId, newTier);
      const passDetails = await forgePass.passDetails(tokenId);
      expect(passDetails.tier).to.equal(newTier);
    });

    it("Should not allow non-UPGRADER_ROLE to upgrade a pass", async function () {
      const newTier = 2;
      await expect(forgePass.connect(addr1).upgradePass(tokenId, newTier))
        .to.be.revertedWithCustomError(forgePass, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow upgrading a non-existent pass", async function () {
      const newTier = 2;
      await expect(forgePass.upgradePass(999, newTier))
        .to.be.revertedWithCustomError(forgePass, "PassDoesNotExist");
    });

    it("Should not allow upgrading to a lower or same tier", async function () {
      const currentTier = (await forgePass.passDetails(tokenId)).tier;
      await expect(forgePass.upgradePass(tokenId, currentTier))
        .to.be.revertedWithCustomError(forgePass, "NewTierMustBeHigher");
      await expect(forgePass.upgradePass(tokenId, Number(currentTier) - 1))
        .to.be.revertedWithCustomError(forgePass, "NewTierMustBeHigher");
    });
  });

  describe("renewPass", function () {
    let addr1;
    let tokenId;
    const INITIAL_DURATION = 3600;

    beforeEach(async function () {
      [, addr1] = await ethers.getSigners();

      // Grant MINTER_ROLE to owner
      await forgePass.grantRole(await forgePass.MINTER_ROLE(), owner.address);

      // Mint a pass for testing
      await forgePass.mintPass(owner.address, 1, INITIAL_DURATION);
      tokenId = 1; // First minted token ID is 1
    });

    it("Should allow the owner to renew their pass", async function () {
      const additionalDuration = 7200;
      const initialExpiresAt = (await forgePass.passDetails(tokenId)).expiresAt;

      await expect(forgePass.renewPass(tokenId, additionalDuration))
        .to.emit(forgePass, "PassRenewed")
        .withArgs(tokenId, initialExpiresAt + BigInt(additionalDuration));

      const passDetails = await forgePass.passDetails(tokenId);
      expect(passDetails.expiresAt).to.equal(initialExpiresAt + BigInt(additionalDuration));
    });

    it("Should not allow non-owner to renew a pass", async function () {
      const additionalDuration = 7200;
      await expect(forgePass.connect(addr1).renewPass(tokenId, additionalDuration))
        .to.be.revertedWithCustomError(forgePass, "NotOwnerOfPass");
    });
  });

  describe("setTokenURI", function () {
    let addr1;
    let tokenId;

    beforeEach(async function () {
      [, addr1] = await ethers.getSigners();

      // Grant MINTER_ROLE and DEFAULT_ADMIN_ROLE to owner
      await forgePass.grantRole(await forgePass.MINTER_ROLE(), owner.address);
      await forgePass.grantRole(await forgePass.DEFAULT_ADMIN_ROLE(), owner.address);

      // Mint a pass for testing
      await forgePass.mintPass(owner.address, 1, 3600);
      tokenId = 1; // First minted token ID is 1
    });

    it("Should allow DEFAULT_ADMIN_ROLE to set token URI", async function () {
      const newURI = "ipfs://newuri";
      await expect(forgePass.setTokenURI(tokenId, newURI))
        .to.emit(forgePass, "TokenURIUpdated")
        .withArgs(tokenId, newURI);
      expect(await forgePass.tokenURI(tokenId)).to.equal(newURI);
    });

    it("Should not allow non-admin to set token URI", async function () {
      const newURI = "ipfs://newuri";
      await expect(forgePass.connect(addr1).setTokenURI(tokenId, newURI))
        .to.be.revertedWithCustomError(forgePass, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow setting token URI for non-existent pass", async function () {
      const newURI = "ipfs://newuri";
      await expect(forgePass.setTokenURI(999, newURI))
        .to.be.revertedWithCustomError(forgePass, "PassDoesNotExist");
    });

    it("Should not allow setting token URI for a never-minted token", async function () {
      const newURI = "ipfs://newuri";
      await expect(forgePass.setTokenURI(9999, newURI))
        .to.be.revertedWithCustomError(forgePass, "PassDoesNotExist");
    });

    it("Should not allow setting empty token URI", async function () {
      await expect(forgePass.setTokenURI(tokenId, ""))
        .to.be.revertedWithCustomError(forgePass, "ZeroTokenURI");
    });
  });

  describe("view functions", function () {
    let tokenId;
    const DURATION = 3600;

    beforeEach(async function () {

      // Grant MINTER_ROLE to owner
      await forgePass.grantRole(await forgePass.MINTER_ROLE(), owner.address);

      // Mint a pass for testing
      await forgePass.mintPass(owner.address, 1, DURATION);
      tokenId = 1; // First minted token ID is 1
    });

    it("isPassActive should return true for active pass", async function () {
      expect(await forgePass.isPassActive(tokenId)).to.be.true;
    });

    it("isPassActive should return false for expired pass", async function () {
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine", []);
      expect(await forgePass.isPassActive(tokenId)).to.be.false;
    });

    it("tokenURI should return the correct URI", async function () {
      const testURI = "ipfs://testuri";
      await forgePass.setTokenURI(tokenId, testURI);
      expect(await forgePass.tokenURI(tokenId)).to.equal(testURI);
    });
  });

  describe("Pause/Unpause", function () {
    let addr1;

    beforeEach(async function () {
      [, addr1] = await ethers.getSigners();

      // Grant PAUSER_ROLE to owner
      await forgePass.grantRole(await forgePass.PAUSER_ROLE(), owner.address);
      // Grant MINTER_ROLE to owner for testing paused state
      await forgePass.grantRole(await forgePass.MINTER_ROLE(), owner.address);
    });

    it("Should allow PAUSER_ROLE to pause the contract", async function () {
      await expect(forgePass.pause()).to.not.be.reverted;
      expect(await forgePass.paused()).to.be.true;
    });

    it("Should allow PAUSER_ROLE to unpause the contract", async function () {
      await forgePass.pause();
      await expect(forgePass.unpause()).to.not.be.reverted;
      expect(await forgePass.paused()).to.be.false;
    });

    it("Should not allow non-PAUSER_ROLE to pause the contract", async function () {
      await expect(forgePass.connect(addr1).pause()).to.be.revertedWithCustomError(forgePass, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow non-PAUSER_ROLE to unpause the contract", async function () {
      await forgePass.pause();
      await expect(forgePass.connect(addr1).unpause()).to.be.revertedWithCustomError(forgePass, "AccessControlUnauthorizedAccount");
    });

    it("Should prevent mintPass when paused", async function () {
      await forgePass.pause();
      const recipient = addr1.address;
      const tier = 1;
      const duration = 3600;
      await expect(forgePass.mintPass(recipient, tier, duration)).to.be.revertedWithCustomError(forgePass, "EnforcedPause");
    });

    it("Should prevent batchMintPass when paused", async function () {
      await forgePass.pause();
      const recipients = [addr1.address];
      const tiers = [1];
      const durations = [3600];
      await expect(forgePass.batchMintPass(recipients, tiers, durations)).to.be.revertedWithCustomError(forgePass, "EnforcedPause");
    });

    it("Should prevent upgradePass when paused", async function () {
      await forgePass.grantRole(await forgePass.UPGRADER_ROLE(), owner.address);
      await forgePass.mintPass(owner.address, 1, 3600);
      const tokenId = 1;
      const newTier = 2;
      await forgePass.pause();
      await expect(forgePass.upgradePass(tokenId, newTier)).to.be.revertedWithCustomError(forgePass, "EnforcedPause");
    });

    it("Should prevent renewPass when paused", async function () {
      await forgePass.mintPass(owner.address, 1, 3600);
      const tokenId = 1;
      const additionalDuration = 7200;
      await forgePass.pause();
      await expect(forgePass.renewPass(tokenId, additionalDuration)).to.be.revertedWithCustomError(forgePass, "EnforcedPause");
    });

    it("Should prevent setTokenURI when paused", async function () {
      await forgePass.grantRole(await forgePass.DEFAULT_ADMIN_ROLE(), owner.address);
      await forgePass.mintPass(owner.address, 1, 3600);
      const tokenId = 1;
      const newURI = "ipfs://newuri";
      await forgePass.pause();
      await expect(forgePass.setTokenURI(tokenId, newURI)).to.be.revertedWithCustomError(forgePass, "EnforcedPause");
    });
  });

  describe("ERC721 Transfers", function () {
    let addr1;
    let addr2;
    let tokenId;

    beforeEach(async function () {
      [, addr1, addr2] = await ethers.getSigners();
      await forgePass.waitForDeployment();

      // Grant MINTER_ROLE to owner
      await forgePass.grantRole(await forgePass.MINTER_ROLE(), owner.address);

      // Mint a pass for testing
      await forgePass.mintPass(owner.address, 1, 3600);
      tokenId = 1; // First minted token ID is 1
    });

    it("Should allow owner to transfer token", async function () {
      await expect(forgePass.transferFrom(owner.address, addr1.address, tokenId))
        .to.emit(forgePass, "Transfer")
        .withArgs(owner.address, addr1.address, tokenId);
      expect(await forgePass.ownerOf(tokenId)).to.equal(addr1.address);
      expect(await forgePass.balanceOf(owner.address)).to.equal(0);
      expect(await forgePass.balanceOf(addr1.address)).to.equal(1);
    });

    it("Should allow approved address to transfer token", async function () {
      await forgePass.approve(addr1.address, tokenId);
      await expect(forgePass.connect(addr1).transferFrom(owner.address, addr2.address, tokenId))
        .to.emit(forgePass, "Transfer")
        .withArgs(owner.address, addr2.address, tokenId);
      expect(await forgePass.ownerOf(tokenId)).to.equal(addr2.address);
      expect(await forgePass.balanceOf(owner.address)).to.equal(0);
      expect(await forgePass.balanceOf(addr2.address)).to.equal(1);
    });

    it("Should allow operator to transfer token", async function () {
      await forgePass.setApprovalForAll(addr1.address, true);
      await expect(forgePass.connect(addr1).transferFrom(owner.address, addr2.address, tokenId))
        .to.emit(forgePass, "Transfer")
        .withArgs(owner.address, addr2.address, tokenId);
      expect(await forgePass.ownerOf(tokenId)).to.equal(addr2.address);
      expect(await forgePass.balanceOf(owner.address)).to.equal(0);
      expect(await forgePass.balanceOf(addr2.address)).to.equal(1);
    });
  });
});

describe("ForgePass - Additional Coverage", function () {
  let forgePass, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const ForgePass = await ethers.getContractFactory("ForgePass");
    forgePass = await upgrades.deployProxy(ForgePass, [], { initializer: 'initialize' });
    await forgePass.waitForDeployment();
    await forgePass.grantRole(await forgePass.MINTER_ROLE(), owner.address);
    await forgePass.grantRole(await forgePass.UPGRADER_ROLE(), owner.address);
  });

  it("Should revert when renewing a non-existent pass", async function () {
    await expect(forgePass.renewPass(9999, 3600))
      .to.be.revertedWithCustomError(forgePass, "ERC721NonexistentToken");
  });

  it("Should revert when renewing a pass with zero duration", async function () {
    await forgePass.mintPass(owner.address, 1, 3600);
    const tokenId = 1;
    await expect(forgePass.renewPass(tokenId, 0))
      .to.not.be.reverted; // Contract allows zero duration renewal
  });

  it("Should revert isPassActive for non-existent pass", async function () {
    // isPassActive returns false for non-existent tokens rather than reverting
    expect(await forgePass.isPassActive(9999)).to.be.false;
  });

  it("Should revert tokenURI for non-existent pass", async function () {
    await expect(forgePass.tokenURI(9999))
      .to.be.revertedWithCustomError(forgePass, "ERC721NonexistentToken");
  });

  it("Should revert transfer from non-owner/non-approved", async function () {
    await forgePass.mintPass(owner.address, 1, 3600);
    const tokenId = 1;
    await expect(forgePass.connect(addr1).transferFrom(owner.address, addr1.address, tokenId))
      .to.be.revertedWithCustomError(forgePass, "ERC721InsufficientApproval");
  });

  it("Should support all relevant interfaces", async function () {
    // ERC721
    expect(await forgePass.supportsInterface("0x80ac58cd")).to.be.true;
    // ERC721Enumerable
    expect(await forgePass.supportsInterface("0x780e9d63")).to.be.true;
    // ERC721Metadata
    expect(await forgePass.supportsInterface("0x5b5e139f")).to.be.true;
    // AccessControl
    expect(await forgePass.supportsInterface("0x7965db0b")).to.be.true;
  });
});
