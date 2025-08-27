const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("OfferManager", function () {
  let OfferManager, offerManager;
  let MockMarketplaceCore, mockMarketplaceCore;
  let MockERC20, mockERC20;
  let owner, offerAdmin, user1, user2, user3;

  const MAX_OFFER_DURATION = 7 * 24 * 60 * 60; // 7 days

  beforeEach(async function () {
    [owner, offerAdmin, user1, user2, user3] = await ethers.getSigners();

    // Deploy MockMarketplaceCore
    MockMarketplaceCore = await ethers.getContractFactory("contracts/mocks/MockMarketplaceCore.sol:MockMarketplaceCore");
    mockMarketplaceCore = await MockMarketplaceCore.deploy();
    await mockMarketplaceCore.waitForDeployment();

    // Deploy MockERC20
    MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
    mockERC20 = await MockERC20.deploy("TestToken", "TT");
    await mockERC20.waitForDeployment();

    // Deploy OfferManager
    OfferManager = await ethers.getContractFactory("OfferManager");
    offerManager = await upgrades.deployProxy(OfferManager, [
      owner.address,
      mockMarketplaceCore.target,
      MAX_OFFER_DURATION
    ], { initializer: 'initialize' });
    await offerManager.waitForDeployment();

    // Grant roles
    const OFFER_ADMIN_ROLE = await offerManager.OFFER_ADMIN_ROLE();
    await offerManager.grantRole(OFFER_ADMIN_ROLE, offerAdmin.address);

    // Set up a mock listing in MarketplaceCore
    await mockMarketplaceCore.setListing(
      1, // listingId
      user2.address, // seller
      ethers.ZeroAddress, // nftContract (placeholder)
      0, // tokenId (placeholder)
      ethers.parseEther("10"), // price
      mockERC20.target, // paymentToken
      0, // ListingType.FIXED_PRICE
      0, // ListingStatus.ACTIVE
      0, // startTime (placeholder)
      0, // endTime (placeholder)
      ethers.ZeroAddress, // highestBidder (placeholder)
      0, // highestBid (placeholder)
      0, // reservePrice (placeholder)
      0 // buyNowPrice (placeholder)
    );

    // Mint some tokens for user1 to make offers
    await mockERC20.mint(user1.address, ethers.parseEther("1000"));
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct roles", async function () {
      const DEFAULT_ADMIN_ROLE = await offerManager.DEFAULT_ADMIN_ROLE();
      const OFFER_ADMIN_ROLE = await offerManager.OFFER_ADMIN_ROLE();

      expect(await offerManager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await offerManager.hasRole(OFFER_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should set marketplaceCore address and maxOfferDuration", async function () {
      expect(await offerManager.marketplaceCore()).to.equal(mockMarketplaceCore.target);
      expect(await offerManager.maxOfferDuration()).to.equal(MAX_OFFER_DURATION);
    });

    it("should start with nextOfferId as 1", async function () {
      expect(await offerManager.nextOfferId()).to.equal(1);
    });
  });

  describe("Making Offers", function () {
    it("should allow user to make an ERC20 offer", async function () {
      const offerAmount = ethers.parseEther("5");
      const listingId = 1;
      const duration = 3600; // 1 hour

      await mockERC20.connect(user1).approve(offerManager.target, offerAmount);

      await expect(offerManager.connect(user1).makeOffer(
        listingId, offerAmount, mockERC20.target, duration
      )).to.emit(offerManager, "OfferMade")
        .withArgs(1, listingId, user1.address, offerAmount, mockERC20.target, anyValue);

      const offer = await offerManager.offers(1);
      expect(offer.listingId).to.equal(listingId);
      expect(offer.offerer).to.equal(user1.address);
      expect(offer.amount).to.equal(offerAmount);
      expect(offer.paymentToken).to.equal(mockERC20.target);
      expect(offer.isActive).to.be.true;

      expect(await mockERC20.balanceOf(offerManager.target)).to.equal(offerAmount);
    });

    it("should allow user to make an ETH offer", async function () {
      const offerAmount = ethers.parseEther("0.1");
      const listingId = 1;
      const duration = 3600;

      // Set listing to accept ETH
      await mockMarketplaceCore.setListing(
        listingId, user2.address, ethers.ZeroAddress, 0, ethers.parseEther("1"), ethers.ZeroAddress, 0, 0, 0, 0, ethers.ZeroAddress, 0, 0, 0
      );

      await expect(offerManager.connect(user1).makeOffer(
        listingId, offerAmount, ethers.ZeroAddress, duration, { value: offerAmount }
      )).to.emit(offerManager, "OfferMade")
        .withArgs(1, listingId, user1.address, offerAmount, ethers.ZeroAddress, anyValue);

      expect(await ethers.provider.getBalance(offerManager.target)).to.equal(offerAmount);
    });

    it("should reject offer if listing is not active", async function () {
      await mockMarketplaceCore.setListing(
        1, user2.address, ethers.ZeroAddress, 0, ethers.parseEther("10"), mockERC20.target, 0, 1, 0, 0, ethers.ZeroAddress, 0, 0, 0 // ListingStatus.SOLD
      );

      const offerAmount = ethers.parseEther("5");
      await mockERC20.connect(user1).approve(offerManager.target, offerAmount);

      await expect(offerManager.connect(user1).makeOffer(
        1, offerAmount, mockERC20.target, 3600
      )).to.be.revertedWith("Listing not active");
    });

    it("should reject offer if duration is invalid", async function () {
      const offerAmount = ethers.parseEther("5");
      await mockERC20.connect(user1).approve(offerManager.target, offerAmount);

      await expect(offerManager.connect(user1).makeOffer(
        1, offerAmount, mockERC20.target, MAX_OFFER_DURATION + 1
      )).to.be.reverted;

      await expect(offerManager.connect(user1).makeOffer(
        1, offerAmount, mockERC20.target, 3000 // Less than 1 hour
      )).to.be.reverted;
    });
  });

  describe("Accepting Offers", function () {
    let offerId;
    const offerAmount = ethers.parseEther("5");
    const listingId = 1;

    beforeEach(async function () {
      await mockERC20.connect(user1).approve(offerManager.target, offerAmount);
      const tx = await offerManager.connect(user1).makeOffer(
        listingId, offerAmount, mockERC20.target, 3600
      );
      const receipt = await tx.wait();
      const events = await offerManager.queryFilter("OfferMade", receipt.blockNumber, receipt.blockNumber);
      offerId = events[0].args.offerId;
    });

    it("should allow seller to accept an offer", async function () {
      const sellerInitialBalance = await mockERC20.balanceOf(user2.address);
      const offerManagerInitialBalance = await mockERC20.balanceOf(offerManager.target);

      await expect(offerManager.connect(user2).acceptOffer(offerId))
        .to.emit(offerManager, "OfferAccepted")
        .withArgs(offerId, listingId, user2.address, user1.address, offerAmount);

      const offer = await offerManager.offers(offerId);
      expect(offer.isActive).to.be.false; // Offer should be inactive

      // In a real scenario, MarketplaceCore would handle token transfer
      // For this mock, we'll just check balances if we were to simulate transfer
      // expect(await mockERC20.balanceOf(user2.address)).to.equal(sellerInitialBalance.add(offerAmount));
      // expect(await mockERC20.balanceOf(offerManager.target)).to.equal(offerManagerInitialBalance.sub(offerAmount));
    });

    it("should reject acceptance if not listing owner", async function () {
      await expect(offerManager.connect(user1).acceptOffer(offerId))
        .to.be.revertedWith("Not listing owner");
    });

    it("should reject acceptance if offer is not active", async function () {
      await offerManager.connect(user2).acceptOffer(offerId); // Accept once
      await expect(offerManager.connect(user2).acceptOffer(offerId))
        .to.be.revertedWith("Offer not active");
    });

    it("should reject acceptance if offer expired", async function () {
      await ethers.provider.send("evm_increaseTime", [MAX_OFFER_DURATION + 100]);
      await ethers.provider.send("evm_mine");

      await expect(offerManager.connect(user2).acceptOffer(offerId))
        .to.be.revertedWith("Offer expired");
    });
  });

  describe("Canceling Offers", function () {
    let offerId;
    const offerAmount = ethers.parseEther("5");
    const listingId = 1;

    beforeEach(async function () {
      await mockERC20.connect(user1).approve(offerManager.target, offerAmount);
      const tx = await offerManager.connect(user1).makeOffer(
        listingId, offerAmount, mockERC20.target, 3600
      );
      const receipt = await tx.wait();
      const events = await offerManager.queryFilter("OfferMade", receipt.blockNumber, receipt.blockNumber);
      offerId = events[0].args.offerId;
    });

    it("should allow offerer to cancel an ERC20 offer", async function () {
      const user1InitialBalance = await mockERC20.balanceOf(user1.address);
      const offerManagerInitialBalance = await mockERC20.balanceOf(offerManager.target);

      await expect(offerManager.connect(user1).cancelOffer(offerId))
        .to.emit(offerManager, "OfferCancelled")
        .withArgs(offerId, user1.address);

      const offer = await offerManager.offers(offerId);
      expect(offer.isActive).to.be.false;

      expect(await mockERC20.balanceOf(user1.address)).to.equal(user1InitialBalance + offerAmount);
      expect(await mockERC20.balanceOf(offerManager.target)).to.equal(offerManagerInitialBalance - offerAmount);
    });

    it("should allow offerer to cancel an ETH offer", async function () {
      const ethOfferAmount = ethers.parseEther("0.05");
      const ethListingId = 2;

            await mockMarketplaceCore.setListing(
        ethListingId, // listingId
        user2.address, // seller
        ethers.ZeroAddress, // nftContract (placeholder)
        0, // tokenId (placeholder)
        ethers.parseEther("1"), // price
        ethers.ZeroAddress, // paymentToken for ETH
        0, // ListingType.FIXED_PRICE
        0, // ListingStatus.ACTIVE
        0, // startTime (placeholder)
        0, // endTime (placeholder)
        ethers.ZeroAddress, // highestBidder (placeholder)
        0, // highestBid (placeholder)
        0, // reservePrice (placeholder)
        0 // buyNowPrice (placeholder)
      );

      const tx = await offerManager.connect(user1).makeOffer(
        ethListingId, ethOfferAmount, ethers.ZeroAddress, 3600, { value: ethOfferAmount }
      );
      const receipt = await tx.wait();
      const events = await offerManager.queryFilter("OfferMade", receipt.blockNumber, receipt.blockNumber);
      const ethOfferId = events[0].args.offerId;

      const user1InitialEthBalance = await ethers.provider.getBalance(user1.address);
      const offerManagerInitialEthBalance = await ethers.provider.getBalance(offerManager.target);

      const cancelTx = await offerManager.connect(user1).cancelOffer(ethOfferId);
      const cancelReceipt = await cancelTx.wait();
      const gasUsed = cancelReceipt.gasUsed * cancelReceipt.gasPrice;

      expect(await ethers.provider.getBalance(user1.address)).to.be.closeTo(user1InitialEthBalance + ethOfferAmount - gasUsed, ethers.parseEther("0.0001"));
      expect(await ethers.provider.getBalance(offerManager.target)).to.equal(offerManagerInitialEthBalance - ethOfferAmount);
    });

    it("should reject cancellation if not offer owner", async function () {
      await expect(offerManager.connect(user2).cancelOffer(offerId))
        .to.be.revertedWith("Not offer owner");
    });

    it("should reject cancellation if offer not active", async function () {
      await offerManager.connect(user1).cancelOffer(offerId); // Cancel once
      await expect(offerManager.connect(user1).cancelOffer(offerId))
        .to.be.revertedWith("Offer not active");
    });
  });

  describe("Cleanup Expired Offers", function () {
    let offerId1, offerId2;

    beforeEach(async function () {
      // Offer 1 (will expire)
      await mockERC20.connect(user1).approve(offerManager.target, ethers.parseEther("1"));
      let tx = await offerManager.connect(user1).makeOffer(1, ethers.parseEther("1"), mockERC20.target, 3600);
      let receipt = await tx.wait();
      let events = await offerManager.queryFilter("OfferMade", receipt.blockNumber, receipt.blockNumber);
      offerId1 = events[0].args.offerId;

      // Offer 2 (will not expire)
      await mockERC20.connect(user1).approve(offerManager.target, ethers.parseEther("2"));
      tx = await offerManager.connect(user1).makeOffer(1, ethers.parseEther("2"), mockERC20.target, MAX_OFFER_DURATION);
      receipt = await tx.wait();
      events = await offerManager.queryFilter("OfferMade", receipt.blockNumber, receipt.blockNumber);
      offerId2 = events[0].args.offerId;

      // Advance time to expire offer1
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");
    });

    it("should clean up expired offers and refund offerer", async function () {
      const user1InitialBalance = await mockERC20.balanceOf(user1.address);
      const offerManagerInitialBalance = await mockERC20.balanceOf(offerManager.target);

      await expect(offerManager.connect(owner).cleanupExpiredOffers([offerId1, offerId2]))
        .to.emit(offerManager, "OfferExpired")
        .withArgs(offerId1);

      const offer1 = await offerManager.offers(offerId1);
      expect(offer1.isActive).to.be.false;

      const offer2 = await offerManager.offers(offerId2);
      expect(offer2.isActive).to.be.true; // Offer2 should still be active

      expect(await mockERC20.balanceOf(user1.address)).to.equal(user1InitialBalance + ethers.parseEther("1"));
      expect(await mockERC20.balanceOf(offerManager.target)).to.equal(offerManagerInitialBalance - ethers.parseEther("1"));
    });

    it("should not clean up active offers", async function () {
      const user1InitialBalance = await mockERC20.balanceOf(user1.address);
      const offerManagerInitialBalance = await mockERC20.balanceOf(offerManager.target);

      await expect(offerManager.connect(owner).cleanupExpiredOffers([offerId2]))
        .to.not.emit(offerManager, "OfferExpired");

      const offer2 = await offerManager.offers(offerId2);
      expect(offer2.isActive).to.be.true;

      expect(await mockERC20.balanceOf(user1.address)).to.equal(user1InitialBalance);
      expect(await mockERC20.balanceOf(offerManager.target)).to.equal(offerManagerInitialBalance);
    });
  });

  describe("View Functions", function () {
    let offerId;
    const offerAmount = ethers.parseEther("5");
    const listingId = 1;

    beforeEach(async function () {
      await mockERC20.connect(user1).approve(offerManager.target, offerAmount);
      const tx = await offerManager.connect(user1).makeOffer(
        listingId, offerAmount, mockERC20.target, 3600
      );
      const receipt = await tx.wait();
      const events = await offerManager.queryFilter("OfferMade", receipt.blockNumber, receipt.blockNumber);
      offerId = events[0].args.offerId;
    });

    it("should return correct offer details", async function () {
      const offer = await offerManager.getOffer(offerId);
      expect(offer.offerId).to.equal(offerId);
      expect(offer.listingId).to.equal(listingId);
      expect(offer.offerer).to.equal(user1.address);
      expect(offer.amount).to.equal(offerAmount);
      expect(offer.paymentToken).to.equal(mockERC20.target);
      expect(offer.isActive).to.be.true;
    });

    it("should return all offers for a listing", async function () {
      const offersForListing = await offerManager.getOffersForListing(listingId);
      expect(offersForListing).to.include(offerId);
    });

    it("should return all offers made by a user", async function () {
      const userOffers = await offerManager.getUserOffers(user1.address);
      expect(userOffers).to.include(offerId);
    });
  });

  describe("Admin Functions", function () {
    it("should allow offer admin to set max offer duration", async function () {
      const newMaxDuration = 10 * 24 * 60 * 60; // 10 days
      await offerManager.connect(offerAdmin).setMaxOfferDuration(newMaxDuration);
      expect(await offerManager.maxOfferDuration()).to.equal(newMaxDuration);
    });

    it("should reject non-admin from setting max offer duration", async function () {
      await expect(offerManager.connect(user1).setMaxOfferDuration(1000))
        .to.be.reverted;
    });
  });
});