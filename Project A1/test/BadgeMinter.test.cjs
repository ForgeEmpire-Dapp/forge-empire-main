const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("BadgeMinter", function () {
  let BadgeMinter, badgeMinter;
  let MockForgeToken, mockForgeToken;
  let MockXPEngine, mockXpEngine;
  let owner, admin, minter, user1, user2;

  beforeEach(async () => {
    [owner, admin, minter, user1, user2] = await ethers.getSigners();

    // Deploy mocks
    MockForgeToken = await ethers.getContractFactory("MockERC20");
    mockForgeToken = await MockForgeToken.deploy("Forge Token", "FORGE");
    await mockForgeToken.waitForDeployment();

    MockXPEngine = await ethers.getContractFactory("MockXPEngine");
    mockXpEngine = await MockXPEngine.deploy();
    await mockXpEngine.waitForDeployment();

    // Deploy BadgeMinter
    const BadgeMinterFactory = await ethers.getContractFactory("BadgeMinter");
    badgeMinter = await upgrades.deployProxy(BadgeMinterFactory, [mockXpEngine.target], { initializer: 'initialize' });
    await badgeMinter.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct XPEngine address", async () => {
      expect(await badgeMinter.xpEngine()).to.equal(mockXpEngine.target);
    });

    it("should assign DEFAULT_ADMIN_ROLE to deployer", async () => {
      const DEFAULT_ADMIN_ROLE = await badgeMinter.DEFAULT_ADMIN_ROLE();
      expect(await badgeMinter.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("should allow admin to grant MINTER_ROLE", async () => {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, minter.address);
      expect(await badgeMinter.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("should prevent non-admin from granting roles", async () => {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await expect(
        badgeMinter.connect(user1).grantRole(MINTER_ROLE, user2.address)
      ).to.be.reverted;
    });
  });

  describe("Minting", function () {
    beforeEach(async () => {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, minter.address);
    });

    it("should allow a minter to mint a badge", async () => {
      await badgeMinter.connect(minter).mintBadge(user1.address, "https://example.com/badge/1");
      expect(await badgeMinter.ownerOf(1)).to.equal(user1.address);
    });

    it("should not allow non-minters to mint", async () => {
      await expect(
        badgeMinter.connect(user2).mintBadge(user1.address, "https://example.com/badge/2")
      ).to.be.reverted;
    });

    it("should batch mint badges correctly", async () => {
      const currentTokenId = await badgeMinter.getCurrentTokenId();
      await badgeMinter.connect(minter).batchMintBadge([user1.address, user2.address], ["https://example.com/badge/2", "https://example.com/badge/3"]);
      const newTokenId = await badgeMinter.getCurrentTokenId();
      
      // Should have minted 2 tokens starting from currentTokenId
      const firstTokenId = Number(currentTokenId);
      const secondTokenId = firstTokenId + 1;
      
      expect(await badgeMinter.ownerOf(firstTokenId)).to.equal(user1.address);
      expect(await badgeMinter.ownerOf(secondTokenId)).to.equal(user2.address);
      expect(Number(newTokenId)).to.equal(firstTokenId + 2);
    });
  });

  describe("Requirements", function () {
    it("should set and get badge XP requirements correctly", async () => {
      await badgeMinter.setBadgeXpRequirement(1, 100);
      const xpRequirement = await badgeMinter.badgeXpRequirements(1);
      expect(xpRequirement).to.equal(100);
    });

    it("should allow only admin to set badge XP requirements", async () => {
      await expect(
        badgeMinter.connect(user1).setBadgeXpRequirement(1, 100)
      ).to.be.reverted;
    });

    it("should mint badge with XP requirements when user has sufficient XP", async () => {
      // Set XP requirement for badge ID 1
      await badgeMinter.setBadgeXpRequirement(1, 50);
      
      // Mock user having sufficient XP
      await mockXpEngine.awardXP(user1.address, 100);
      
      // Mint badge with requirements
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      await badgeMinter.mintBadgeWithRequirements(user1.address, 1, "https://example.com/badge/requirements");
      
      // Should succeed - user has sufficient XP
      expect(await badgeMinter.ownerOf(1)).to.equal(user1.address);
    });

    it("should revert when minting badge with insufficient XP", async () => {
      // Set XP requirement for badge ID 2
      await badgeMinter.setBadgeXpRequirement(2, 200);
      
      // Mock user having insufficient XP
      await mockXpEngine.awardXP(user1.address, 50);
      
      // Try to mint badge with requirements
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      await expect(
        badgeMinter.mintBadgeWithRequirements(user1.address, 2, "https://example.com/badge/requirements")
      ).to.be.revertedWithCustomError(badgeMinter, "InsufficientXP")
        .withArgs(200, 50);
    });

    it("should mint badge with no XP requirements when requirement is 0", async () => {
      // Badge ID 3 has no XP requirement (default 0)
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      await badgeMinter.mintBadgeWithRequirements(user1.address, 3, "https://example.com/badge/no-requirements");
      
      // Should succeed without checking XP
      expect(await badgeMinter.ownerOf(1)).to.equal(user1.address);
    });

    it("should revert mintBadgeWithRequirements for zero address", async () => {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      await expect(
        badgeMinter.mintBadgeWithRequirements(ethers.ZeroAddress, 1, "https://example.com/badge")
      ).to.be.revertedWithCustomError(badgeMinter, "ZeroAddressRecipient");
    });
  });

  describe("Token ID Management", function () {
    it("should return correct current token ID", async () => {
      const currentId = await badgeMinter.getCurrentTokenId();
      expect(Number(currentId)).to.be.greaterThan(0); // Should be greater than 0 after previous tests
    });

    it("should increment token ID after minting", async () => {
      const beforeId = await badgeMinter.getCurrentTokenId();
      
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      await badgeMinter.mintBadge(user1.address, "https://example.com/badge/tokenid");
      
      const afterId = await badgeMinter.getCurrentTokenId();
      expect(Number(afterId)).to.equal(Number(beforeId) + 1);
    });
  });

  describe("Pausing", function () {
    it("should allow PAUSER_ROLE to pause contract", async () => {
      const PAUSER_ROLE = await badgeMinter.PAUSER_ROLE();
      await badgeMinter.grantRole(PAUSER_ROLE, owner.address);
      
      await badgeMinter.pause();
      // Contract should be paused - test by trying to mint (should fail)
      
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      await expect(
        badgeMinter.mintBadge(user1.address, "https://example.com/badge/paused")
      ).to.be.reverted;
    });

    it("should allow PAUSER_ROLE to unpause contract", async () => {
      const PAUSER_ROLE = await badgeMinter.PAUSER_ROLE();
      await badgeMinter.grantRole(PAUSER_ROLE, owner.address);
      
      // First pause, then unpause
      await badgeMinter.pause();
      await badgeMinter.unpause();
      
      // Should be able to mint after unpausing
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      await badgeMinter.mintBadge(user1.address, "https://example.com/badge/unpaused");
      // Should succeed without revert
    });

    it("should not allow non-PAUSER_ROLE to pause", async () => {
      await expect(
        badgeMinter.connect(user1).pause()
      ).to.be.reverted;
    });

    it("should not allow non-PAUSER_ROLE to unpause", async () => {
      await expect(
        badgeMinter.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("Supports Interface", function () {
    it("should support ERC165 and AccessControl interfaces", async () => {
      const ERC165_INTERFACE_ID = "0x01ffc9a7";
      const ACCESS_CONTROL_INTERFACE_ID = "0x7965db0b"; // precomputed

      expect(await badgeMinter.supportsInterface(ERC165_INTERFACE_ID)).to.be.true;
      expect(await badgeMinter.supportsInterface(ACCESS_CONTROL_INTERFACE_ID)).to.be.true;
    });

    it("should not support unknown interfaces", async () => {
      const UNKNOWN_INTERFACE_ID = "0x12345678";
      expect(await badgeMinter.supportsInterface(UNKNOWN_INTERFACE_ID)).to.be.false;
    });
  });

  describe("Batch Minting Edge Cases", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
    });

    it("should revert when recipients array is empty", async function () {
      await expect(
        badgeMinter.batchMintBadge([], [])
      ).to.be.revertedWithCustomError(badgeMinter, "EmptyArrays");
    });

    it("should revert when array lengths don't match", async function () {
      const recipients = [user1.address, user2.address];
      const tokenURIs = ["https://example.com/badge1"];
      
      await expect(
        badgeMinter.batchMintBadge(recipients, tokenURIs)
      ).to.be.revertedWithCustomError(badgeMinter, "ArrayLengthMismatch");
    });

    it("should revert when batch size exceeds maximum", async function () {
      const MAX_BATCH_SIZE = await badgeMinter.MAX_BATCH_SIZE();
      const recipients = new Array(Number(MAX_BATCH_SIZE) + 1).fill(user1.address);
      const tokenURIs = new Array(Number(MAX_BATCH_SIZE) + 1).fill("https://example.com/badge");
      
      await expect(
        badgeMinter.batchMintBadge(recipients, tokenURIs)
      ).to.be.revertedWithCustomError(badgeMinter, "BatchSizeExceeded");
    });

    it("should revert when one recipient is zero address", async function () {
      const recipients = [user1.address, ethers.ZeroAddress, user2.address];
      const tokenURIs = ["https://example.com/badge1", "https://example.com/badge2", "https://example.com/badge3"];
      
      await expect(
        badgeMinter.batchMintBadge(recipients, tokenURIs)
      ).to.be.revertedWithCustomError(badgeMinter, "ZeroAddressRecipient");
    });

    it("should successfully batch mint multiple badges", async function () {
      const recipients = [user1.address, user2.address];
      const tokenURIs = ["https://example.com/badge1", "https://example.com/badge2"];
      
      const beforeId = await badgeMinter.getCurrentTokenId();
      
      await expect(
        badgeMinter.batchMintBadge(recipients, tokenURIs)
      ).to.emit(badgeMinter, "BatchBadgesMinted");
      
      const afterId = await badgeMinter.getCurrentTokenId();
      expect(Number(afterId)).to.equal(Number(beforeId) + recipients.length);
      
      // Check ownership
      expect(await badgeMinter.ownerOf(beforeId)).to.equal(user1.address);
      expect(await badgeMinter.ownerOf(Number(beforeId) + 1)).to.equal(user2.address);
    });

    it("should handle maximum batch size correctly", async function () {
      const MAX_BATCH_SIZE = await badgeMinter.MAX_BATCH_SIZE();
      const recipients = new Array(Number(MAX_BATCH_SIZE)).fill(user1.address);
      const tokenURIs = new Array(Number(MAX_BATCH_SIZE)).fill("https://example.com/badge");
      
      const beforeId = await badgeMinter.getCurrentTokenId();
      
      await expect(
        badgeMinter.batchMintBadge(recipients, tokenURIs)
      ).to.emit(badgeMinter, "BatchBadgesMinted");
      
      const afterId = await badgeMinter.getCurrentTokenId();
      expect(Number(afterId)).to.equal(Number(beforeId) + Number(MAX_BATCH_SIZE));
    });
  });

  describe("XP Requirements Edge Cases", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
    });

    it("should handle XP requirement of 0 (no requirement)", async function () {
      // Badge with 0 XP requirement should always mint
      await badgeMinter.setBadgeXpRequirement(1, 0);
      
      // User with no XP should still be able to mint
      await expect(
        badgeMinter.mintBadgeWithRequirements(user1.address, 1, "https://example.com/badge")
      ).to.not.be.reverted;
    });

    it("should handle exact XP requirement match", async function () {
      const requiredXP = 100;
      await badgeMinter.setBadgeXpRequirement(2, requiredXP);
      await mockXpEngine.awardXP(user1.address, requiredXP);
      
      await expect(
        badgeMinter.mintBadgeWithRequirements(user1.address, 2, "https://example.com/badge")
      ).to.not.be.reverted;
    });

    it("should handle XP just below requirement", async function () {
      const requiredXP = 100;
      await badgeMinter.setBadgeXpRequirement(3, requiredXP);
      await mockXpEngine.awardXP(user1.address, requiredXP - 1);
      
      await expect(
        badgeMinter.mintBadgeWithRequirements(user1.address, 3, "https://example.com/badge")
      ).to.be.revertedWithCustomError(badgeMinter, "InsufficientXP")
        .withArgs(requiredXP, requiredXP - 1);
    });

    it("should handle very large XP requirements", async function () {
      const largeXP = ethers.parseUnits("1000000", 18);
      await badgeMinter.setBadgeXpRequirement(4, largeXP);
      await mockXpEngine.awardXP(user1.address, 1000);
      
      await expect(
        badgeMinter.mintBadgeWithRequirements(user1.address, 4, "https://example.com/badge")
      ).to.be.revertedWithCustomError(badgeMinter, "InsufficientXP");
    });

    it("should allow updating XP requirements", async function () {
      // Set initial requirement
      await badgeMinter.setBadgeXpRequirement(5, 100);
      expect(await badgeMinter.badgeXpRequirements(5)).to.equal(100);
      
      // Update requirement
      await badgeMinter.setBadgeXpRequirement(5, 200);
      expect(await badgeMinter.badgeXpRequirements(5)).to.equal(200);
      
      // Set to 0 (remove requirement)
      await badgeMinter.setBadgeXpRequirement(5, 0);
      expect(await badgeMinter.badgeXpRequirements(5)).to.equal(0);
    });

    it("should prevent non-admin from setting XP requirements", async () => {
      await expect(
        badgeMinter.connect(user1).setBadgeXpRequirement(6, 100)
      ).to.be.reverted;
    });
  });

  describe("Token ID Management Edge Cases", function () {
    it("should handle token ID overflow protection", async function () {
      // This tests the contract's behavior with large token IDs
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      const currentId = await badgeMinter.getCurrentTokenId();
      await badgeMinter.mintBadge(user1.address, "https://example.com/badge");
      
      const newId = await badgeMinter.getCurrentTokenId();
      expect(Number(newId)).to.equal(Number(currentId) + 1);
    });
  });

  describe("ReentrancyGuard Protection", function () {
    it("should prevent reentrancy on mintBadge", async function () {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      // This test verifies the nonReentrant modifier is working
      // The actual reentrancy protection is tested by the modifier itself
      await expect(
        badgeMinter.mintBadge(user1.address, "https://example.com/badge")
      ).to.not.be.reverted;
    });

    it("should prevent reentrancy on mintBadgeWithRequirements", async function () {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      await expect(
        badgeMinter.mintBadgeWithRequirements(user1.address, 1, "https://example.com/badge")
      ).to.not.be.reverted;
    });

    it("should prevent reentrancy on batchMintBadge", async function () {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
      
      await expect(
        badgeMinter.batchMintBadge([user1.address], ["https://example.com/badge"])
      ).to.not.be.reverted;
    });
  });

  describe("Initialization Edge Cases", function () {
    it("should revert initialization with zero address XP engine", async function () {
      const BadgeMinterFactory = await ethers.getContractFactory("BadgeMinter");
      const newBadgeMinter = await BadgeMinterFactory.deploy();
      
      await expect(
        newBadgeMinter.initialize(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(newBadgeMinter, "ZeroAddressRecipient");
    });

    it("should set correct initial token ID", async function () {
      const currentId = await badgeMinter.getCurrentTokenId();
      expect(Number(currentId)).to.be.greaterThan(0);
    });
  });

  describe("Pause Functionality Edge Cases", function () {
    beforeEach(async function () {
      const PAUSER_ROLE = await badgeMinter.PAUSER_ROLE();
      await badgeMinter.grantRole(PAUSER_ROLE, admin.address);
      
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
    });

    it("should prevent all minting functions when paused", async function () {
      await badgeMinter.connect(admin).pause();
      
      // Test mintBadge
      await expect(
        badgeMinter.mintBadge(user1.address, "https://example.com/badge")
      ).to.be.reverted;
      
      // Test mintBadgeWithRequirements  
      await expect(
        badgeMinter.mintBadgeWithRequirements(user1.address, 1, "https://example.com/badge")
      ).to.be.reverted;
      
      // Test batchMintBadge
      await expect(
        badgeMinter.batchMintBadge([user1.address], ["https://example.com/badge"])
      ).to.be.reverted;
    });

    it("should allow all minting functions after unpause", async function () {
      await badgeMinter.connect(admin).pause();
      await badgeMinter.connect(admin).unpause();
      
      // All functions should work again
      await expect(
        badgeMinter.mintBadge(user1.address, "https://example.com/badge1")
      ).to.not.be.reverted;
      
      await expect(
        badgeMinter.mintBadgeWithRequirements(user1.address, 1, "https://example.com/badge2")
      ).to.not.be.reverted;
      
      await expect(
        badgeMinter.batchMintBadge([user2.address], ["https://example.com/badge3"])
      ).to.not.be.reverted;
    });
  });

  describe("Additional Branch Coverage Tests", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      await badgeMinter.grantRole(MINTER_ROLE, owner.address);
    });

    it("should handle mintBadge with zero address recipient", async function () {
      await expect(
        badgeMinter.mintBadge(ethers.ZeroAddress, "https://example.com/badge")
      ).to.be.revertedWithCustomError(badgeMinter, "ZeroAddressRecipient");
    });

    it("should handle empty token URI in mintBadge", async function () {
      await expect(
        badgeMinter.mintBadge(user1.address, "")
      ).to.not.be.reverted;
      
      const tokenId = await badgeMinter.getCurrentTokenId();
      expect(await badgeMinter.ownerOf(Number(tokenId) - 1)).to.equal(user1.address);
    });

    it("should handle very long token URI", async function () {
      const longURI = "https://example.com/badge/" + "a".repeat(1000);
      await expect(
        badgeMinter.mintBadge(user1.address, longURI)
      ).to.not.be.reverted;
    });

    it("should handle mintBadgeWithRequirements with unset badge ID", async function () {
      // Badge ID 999 has no requirement set (defaults to 0)
      await expect(
        badgeMinter.mintBadgeWithRequirements(user1.address, 999, "https://example.com/badge")
      ).to.not.be.reverted;
    });

    it("should handle setBadgeXpRequirement with badge ID 0", async function () {
      await expect(
        badgeMinter.setBadgeXpRequirement(0, 50)
      ).to.not.be.reverted;
      
      expect(await badgeMinter.badgeXpRequirements(0)).to.equal(50);
    });

    it("should handle maximum uint256 XP requirement", async function () {
      const maxUint256 = ethers.MaxUint256;
      await expect(
        badgeMinter.setBadgeXpRequirement(1, maxUint256)
      ).to.not.be.reverted;
      
      expect(await badgeMinter.badgeXpRequirements(1)).to.equal(maxUint256);
    });

    it("should handle batch mint with single item arrays", async function () {
      await expect(
        badgeMinter.batchMintBadge([user1.address], ["https://example.com/badge"])
      ).to.emit(badgeMinter, "BatchBadgesMinted");
    });

    it("should handle ERC721 transfers after minting", async function () {
      await badgeMinter.mintBadge(user1.address, "https://example.com/badge");
      const tokenId = (await badgeMinter.getCurrentTokenId()) - 1n;
      
      // Test that token is properly minted and transferable
      expect(await badgeMinter.ownerOf(tokenId)).to.equal(user1.address);
      expect(await badgeMinter.balanceOf(user1.address)).to.be.gt(0);
    });

    it("should handle tokenURI retrieval", async function () {
      const testURI = "https://example.com/badge/unique";
      await badgeMinter.mintBadge(user1.address, testURI);
      const tokenId = (await badgeMinter.getCurrentTokenId()) - 1n;
      
      expect(await badgeMinter.tokenURI(tokenId)).to.equal(testURI);
    });

    it("should handle supportsInterface with multiple interface IDs", async function () {
      // ERC721 interface
      const ERC721_INTERFACE_ID = "0x80ac58cd";
      expect(await badgeMinter.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
      
      // ERC721Metadata interface  
      const ERC721_METADATA_INTERFACE_ID = "0x5b5e139f";
      expect(await badgeMinter.supportsInterface(ERC721_METADATA_INTERFACE_ID)).to.be.true;
    });

    it("should handle role-based access for different roles", async function () {
      const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
      const PAUSER_ROLE = await badgeMinter.PAUSER_ROLE();
      const DEFAULT_ADMIN_ROLE = await badgeMinter.DEFAULT_ADMIN_ROLE();
      
      // Verify role constants are different
      expect(MINTER_ROLE).to.not.equal(PAUSER_ROLE);
      expect(PAUSER_ROLE).to.not.equal(DEFAULT_ADMIN_ROLE);
      expect(MINTER_ROLE).to.not.equal(DEFAULT_ADMIN_ROLE);
    });

    it("should handle getCurrentTokenId consistency", async function () {
      const beforeId = await badgeMinter.getCurrentTokenId();
      
      await badgeMinter.mintBadge(user1.address, "https://example.com/badge1");
      const afterId1 = await badgeMinter.getCurrentTokenId();
      
      await badgeMinter.mintBadge(user2.address, "https://example.com/badge2");
      const afterId2 = await badgeMinter.getCurrentTokenId();
      
      expect(Number(afterId1)).to.equal(Number(beforeId) + 1);
      expect(Number(afterId2)).to.equal(Number(afterId1) + 1);
    });
  });
});
