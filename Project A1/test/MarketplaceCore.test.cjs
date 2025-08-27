const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("MarketplaceCore", function () {
  let marketplace;
  let mockNFT;
  let mockERC20;
  let owner, feeRecipient, seller, buyer, bidder1, bidder2, curator;

  const MARKETPLACE_FEE = 250; // 2.5%
  const MAX_ROYALTY = 1000; // 10%
  const MIN_BID_INCREMENT = 500; // 5%

  const ListingType = {
    FIXED_PRICE: 0,
    AUCTION: 1,
    BUNDLE: 2
  };

  const ListingStatus = {
    ACTIVE: 0,
    SOLD: 1,
    CANCELLED: 2,
    EXPIRED: 3
  };

  beforeEach(async function () {
    [owner, feeRecipient, seller, buyer, bidder1, bidder2, curator] = await ethers.getSigners();

    // Deploy Mock NFT
    const MockNFT = await ethers.getContractFactory("MockBadgeMinter");
    mockNFT = await MockNFT.deploy();
    await mockNFT.waitForDeployment();

    // Deploy Mock ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("Test Token", "TEST");
        await mockERC20.waitForDeployment();

    // Mint some tokens to owner for testing transfers
    await mockERC20.mint(owner.address, ethers.parseEther("100000"));

    // Deploy MarketplaceCore
    const MarketplaceCore = await ethers.getContractFactory("MarketplaceCore");
    marketplace = await upgrades.deployProxy(
      MarketplaceCore,
      [owner.address, feeRecipient.address, MARKETPLACE_FEE],
      { initializer: "initialize" }
    );
    await marketplace.waitForDeployment();

    // Setup test NFTs
    const MINTER_ROLE = await mockNFT.MINTER_ROLE();
    await mockNFT.grantRole(MINTER_ROLE, seller.address);

    await mockNFT.connect(seller).mintBadge(seller.address, "ipfs://test1");
    await mockNFT.connect(seller).mintBadge(seller.address, "ipfs://test2");
    await mockNFT.connect(seller).mintBadge(seller.address, "ipfs://test3");

    // Approve marketplace for NFT transfers
    await mockNFT.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

    // Setup ERC20 tokens for buyers
    await mockERC20.transfer(buyer.address, ethers.parseEther("10000"));
    await mockERC20.transfer(bidder1.address, ethers.parseEther("10000"));
    await mockERC20.transfer(bidder2.address, ethers.parseEther("10000"));

    // Approve marketplace for ERC20 transfers
    await mockERC20.connect(buyer).approve(await marketplace.getAddress(), ethers.parseEther("10000"));
    await mockERC20.connect(bidder1).approve(await marketplace.getAddress(), ethers.parseEther("10000"));
    await mockERC20.connect(bidder2).approve(await marketplace.getAddress(), ethers.parseEther("10000"));

    // Approve payment tokens
    await marketplace.approvePaymentToken(await mockERC20.getAddress(), true);
  });

  describe("Marketplace Initialization", function () {
    it("Should initialize with correct parameters", async function () {
      expect(await marketplace.marketplaceFee()).to.equal(MARKETPLACE_FEE);
      expect(await marketplace.feeRecipient()).to.equal(feeRecipient.address);
      expect(await marketplace.nextListingId()).to.equal(1);
    });

    it("Should approve ETH as default payment token", async function () {
      expect(await marketplace.approvedPaymentTokens(ethers.ZeroAddress)).to.be.true;
    });
  });

  describe("Fixed Price Listings", function () {
    const tokenId = 1;
    const price = ethers.parseEther("1");

    beforeEach(async function () {
      await marketplace.connect(seller).listItem(
        await mockNFT.getAddress(),
        tokenId,
        price,
        ethers.ZeroAddress,
        ListingType.FIXED_PRICE,
        0,
        0,
        0
      );
    });

    it("Should create fixed price listing", async function () {
      const listing = await marketplace.listings(1);
      
      expect(listing.seller).to.equal(seller.address);
      expect(listing.nftContract).to.equal(await mockNFT.getAddress());
      expect(listing.tokenId).to.equal(tokenId);
      expect(listing.listingType).to.equal(ListingType.FIXED_PRICE);
      expect(listing.status).to.equal(ListingStatus.ACTIVE);
      expect(listing.price).to.equal(price);
      expect(listing.paymentToken).to.equal(ethers.ZeroAddress);
    });

    it("Should allow buying at fixed price with ETH", async function () {
      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

      const tx = await marketplace.connect(buyer).buyNow(1, { value: price });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);

      expect(buyerBalanceAfter).to.be.closeTo(
        buyerBalanceBefore - price - gasUsed,
        ethers.parseEther("0.01")
      );

      const expectedSellerAmount = price * (10000n - BigInt(MARKETPLACE_FEE)) / 10000n;
      expect(sellerBalanceAfter).to.be.closeTo(
        sellerBalanceBefore + expectedSellerAmount,
        ethers.parseEther("0.01")
      );
    });

    it("Should allow buying with ERC20 tokens", async function () {
      // Create new listing with ERC20 payment
      await marketplace.connect(seller).listItem(
        await mockNFT.getAddress(),
        2,
        price,
        await mockERC20.getAddress(),
        ListingType.FIXED_PRICE,
        0,
        0,
        0
      );

      const buyerBalanceBefore = await mockERC20.balanceOf(buyer.address);
      const sellerBalanceBefore = await mockERC20.balanceOf(seller.address);

      await marketplace.connect(buyer).buyNow(2);

      const expectedFee = (price * BigInt(MARKETPLACE_FEE)) / 10000n;
      const expectedSellerAmount = price - expectedFee;

      expect(await mockERC20.balanceOf(buyer.address)).to.equal(buyerBalanceBefore - price);
      expect(await mockERC20.balanceOf(seller.address)).to.equal(sellerBalanceBefore + expectedSellerAmount);
      expect(await mockERC20.balanceOf(feeRecipient.address)).to.equal(expectedFee);
    });

    it("Should reject insufficient payment", async function () {
      await expect(
        marketplace.connect(buyer).buyNow(1, { value: price / 2n })
      ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
    });

    it("Should reject buying own item", async function () {
      await expect(
        marketplace.connect(seller).buyNow(1, { value: price })
      ).to.be.revertedWithCustomError(marketplace, "CannotBuyOwnItem");
    });
  });

  describe("Auction Listings", function () {
    const tokenId = 1;
    const startingPrice = ethers.parseEther("0.5");
    const reservePrice = ethers.parseEther("1");
    const buyNowPrice = ethers.parseEther("2");
    const duration = 86400; // 24 hours

    beforeEach(async function () {
      await marketplace.connect(seller).listItem(
        await mockNFT.getAddress(),
        tokenId,
        startingPrice,
        ethers.ZeroAddress,
        ListingType.AUCTION,
        duration,
        reservePrice,
        buyNowPrice
      );
    });

    it("Should create auction listing", async function () {
      const listing = await marketplace.listings(1);
      
      expect(listing.listingType).to.equal(ListingType.AUCTION);
      expect(listing.price).to.equal(startingPrice);
      expect(listing.reservePrice).to.equal(reservePrice);
      expect(listing.buyNowPrice).to.equal(buyNowPrice);
      expect(listing.endTime).to.be.greaterThan(0);
    });

    it("Should accept valid bids", async function () {
      const bidAmount = ethers.parseEther("0.6");

      await expect(
        marketplace.connect(bidder1).placeBid(1, { value: bidAmount })
      ).to.emit(marketplace, "BidPlaced")
        .withArgs(1, bidder1.address, bidAmount);
    });

    it("Should handle bid increments correctly", async function () {
      const firstBid = ethers.parseEther("0.6");
      const secondBid = ethers.parseEther("0.7");

      await marketplace.connect(bidder1).placeBid(1, { value: firstBid });

      await expect(
        marketplace.connect(bidder2).placeBid(1, { value: secondBid })
      ).to.emit(marketplace, "BidPlaced");
    });

    it("Should refund previous bidder", async function () {
      const firstBid = ethers.parseEther("0.6");
      const secondBid = ethers.parseEther("0.7");

      const bidder1BalanceBefore = await ethers.provider.getBalance(bidder1.address);

      await marketplace.connect(bidder1).placeBid(1, { value: firstBid });
      await marketplace.connect(bidder2).placeBid(1, { value: secondBid });

      const bidder1BalanceAfter = await ethers.provider.getBalance(bidder1.address);
      expect(bidder1BalanceAfter).to.be.closeTo(
        bidder1BalanceBefore,
        ethers.parseEther("0.01")
      );
    });

    it("Should finalize successful auction", async function () {
      const bidAmount = ethers.parseEther("1.2");

      await marketplace.connect(bidder1).placeBid(1, { value: bidAmount });

      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine");

      await expect(
        marketplace.finalizeAuction(1)
      ).to.emit(marketplace, "ItemSold");
    });
  });

  describe("Listing Management", function () {
    const tokenId = 1;
    const price = ethers.parseEther("1");

    beforeEach(async function () {
      await marketplace.connect(seller).listItem(
        await mockNFT.getAddress(),
        tokenId,
        price,
        ethers.ZeroAddress,
        ListingType.FIXED_PRICE,
        0,
        0,
        0
      );
    });

    it("Should cancel listing", async function () {
      await expect(
        marketplace.connect(seller).cancelListing(1)
      ).to.emit(marketplace, "ListingCancelled");
    });
  });

  describe("Admin Functions", function () {
    it("Should update marketplace fee", async function () {
      const newFee = 300;
      await marketplace.connect(owner).setMarketplaceFee(newFee);
      expect(await marketplace.marketplaceFee()).to.equal(newFee);
    });

    it("Should pause and unpause marketplace", async function () {
      await marketplace.connect(owner).pause();
      expect(await marketplace.paused()).to.be.true;

      await marketplace.connect(owner).unpause();
      expect(await marketplace.paused()).to.be.false;
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency withdrawal", async function () {
      await owner.sendTransaction({
        to: await marketplace.getAddress(),
        value: ethers.parseEther("1")
      });

      const feeRecipientBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);
      await marketplace.connect(owner).emergencyWithdraw();
      const feeRecipientBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);

      expect(feeRecipientBalanceAfter).to.be.gt(feeRecipientBalanceBefore);
    });
  });
});