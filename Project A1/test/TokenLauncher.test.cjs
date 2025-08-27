const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenLauncher", function () {
  let tokenLauncher;
  let mockTokenManagerCore;
  let mockToken;
  let mockReferralEngine;
  let owner, admin, whitelistManager, privateSaleManager, user1, user2, feeWallet;

  const MAX_SUPPLY_PER_TOKEN = ethers.parseEther("1000000"); // 1M tokens
  const MAX_TRANSACTION_AMOUNT = ethers.parseEther("10000"); // 10K tokens

  beforeEach(async function () {
    [owner, admin, whitelistManager, privateSaleManager, user1, user2, feeWallet] = await ethers.getSigners();

    // Fund user1 with more ETH for large transactions
    await owner.sendTransaction({
      to: user1.address,
      value: ethers.parseEther("1000000") // 1,000,000 ETH
    });

    // Deploy mock contracts
    const MockTokenManagerCore = await ethers.getContractFactory("MockTokenManagerCore");
    mockTokenManagerCore = await MockTokenManagerCore.deploy();
    await mockTokenManagerCore.waitForDeployment();

    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy();
    await mockToken.waitForDeployment();

    const MockReferralEngine = await ethers.getContractFactory("MockReferralEngine");
    mockReferralEngine = await MockReferralEngine.deploy();
    await mockReferralEngine.waitForDeployment();

    // Deploy TokenLauncher
    const TokenLauncher = await ethers.getContractFactory("TokenLauncher");
    tokenLauncher = await TokenLauncher.deploy(mockTokenManagerCore.target);
    await tokenLauncher.waitForDeployment();

    // Setup mock responses
    await mockTokenManagerCore.setTokenLaunched(mockToken.target, true);
    await mockTokenManagerCore.setProtocolConfig(feeWallet.address, 250); // 2.5% fee

    // Grant roles
    const ADMIN_ROLE = await tokenLauncher.ADMIN_ROLE();
    const WHITELIST_MANAGER_ROLE = await tokenLauncher.WHITELIST_MANAGER_ROLE();
    const PRIVATE_SALE_MANAGER_ROLE = await tokenLauncher.PRIVATE_SALE_MANAGER_ROLE();

    await tokenLauncher.grantRole(ADMIN_ROLE, admin.address);
    await tokenLauncher.grantRole(WHITELIST_MANAGER_ROLE, whitelistManager.address);
    await tokenLauncher.grantRole(PRIVATE_SALE_MANAGER_ROLE, privateSaleManager.address);

    // Set referral engine
    await tokenLauncher.connect(admin).setReferralEngine(mockReferralEngine.target);
  });

  describe("Deployment", function () {
    it("Should set correct token manager core", async function () {
      expect(await tokenLauncher.tokenManagerCore()).to.equal(mockTokenManagerCore.target);
    });

    it("Should grant all roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await tokenLauncher.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await tokenLauncher.ADMIN_ROLE();
      const WHITELIST_MANAGER_ROLE = await tokenLauncher.WHITELIST_MANAGER_ROLE();
      const PRIVATE_SALE_MANAGER_ROLE = await tokenLauncher.PRIVATE_SALE_MANAGER_ROLE();

      expect(await tokenLauncher.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await tokenLauncher.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await tokenLauncher.hasRole(WHITELIST_MANAGER_ROLE, owner.address)).to.be.true;
      expect(await tokenLauncher.hasRole(PRIVATE_SALE_MANAGER_ROLE, owner.address)).to.be.true;
    });

    it("Should revert with zero address token manager", async function () {
      const TokenLauncher = await ethers.getContractFactory("TokenLauncher");
      await expect(TokenLauncher.deploy(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(tokenLauncher, "ZeroAddress");
    });
  });

  describe("Token Buying - Bonding Curve", function () {
    it("Should allow buying tokens with bonding curve pricing", async function () {
      const tokenAmount = ethers.parseEther("1000");
      const expectedCost = ethers.parseEther("1000"); // Simplified for test
      
      await expect(tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        tokenAmount,
        expectedCost * 2n, // maxCost with buffer
        ethers.ZeroAddress,
        { value: expectedCost }
      )).to.emit(tokenLauncher, "TokenPurchased");

      expect(await tokenLauncher.tokenSupplies(mockToken.target)).to.equal(tokenAmount);
    });

    it("Should revert for unlaunched token", async function () {
      await mockTokenManagerCore.setTokenLaunched(mockToken.target, false);

      await expect(tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        ethers.ZeroAddress,
        { value: ethers.parseEther("1000") }
      )).to.be.revertedWithCustomError(tokenLauncher, "TokenNotLaunched");
    });

    it("Should revert for zero token amount", async function () {
      await expect(tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        0,
        ethers.parseEther("1000"),
        ethers.ZeroAddress,
        { value: ethers.parseEther("1000") }
      )).to.be.revertedWithCustomError(tokenLauncher, "AmountMustBeGreaterThanZero");
    });

    it("Should revert for exceeding max transaction amount", async function () {
      const excessAmount = MAX_TRANSACTION_AMOUNT + 1n;

      await expect(tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        excessAmount,
        excessAmount, // maxCost
        ethers.ZeroAddress,
        { value: excessAmount } // value
      )).to.be.revertedWithCustomError(tokenLauncher, "MaxTransactionAmountExceeded");
    });

    it("Should revert for exceeding max supply", async function () {
      // Set current supply near max by making multiple smaller purchases
      const maxTx = MAX_TRANSACTION_AMOUNT;
      const numTxs = Math.floor(Number(MAX_SUPPLY_PER_TOKEN) / Number(maxTx));

      for (let i = 0; i < numTxs; i++) {
        await tokenLauncher.connect(user1).buyToken(
          mockToken.target,
          maxTx,
          ethers.parseEther("10000"), // Sufficient maxCost
          ethers.ZeroAddress,
          { value: ethers.parseEther("10000") } // Sufficient value
        );
      }

      const remainingSupply = MAX_SUPPLY_PER_TOKEN - (BigInt(numTxs) * maxTx);

      // Try to buy more than remaining supply
      await expect(tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        remainingSupply + 1n, // Exceed max supply
        ethers.parseEther("1"), // Sufficient maxCost
        ethers.ZeroAddress,
        { value: ethers.parseEther("1") } // Sufficient value
      )).to.be.revertedWithCustomError(tokenLauncher, "MaxSupplyExceeded");
    });

    it("Should handle slippage protection", async function () {
      const tokenAmount = ethers.parseEther("1000");
      const lowMaxCost = ethers.parseEther("1"); // Too low

      await expect(tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        tokenAmount,
        lowMaxCost,
        ethers.ZeroAddress,
        { value: ethers.parseEther("1000") }
      )).to.be.revertedWithCustomError(tokenLauncher, "SlippageExceeded");
    });

    it("Should refund excess payment", async function () {
      const tokenAmount = 1n;
      const cost = 1n;
      const excessPayment = cost * 2n;

      const initialBalance = await ethers.provider.getBalance(user1.address);

      const tx = await tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        tokenAmount,
        excessPayment,
        ethers.ZeroAddress,
        { value: excessPayment }
      );

      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * tx.gasPrice;
      const finalBalance = await ethers.provider.getBalance(user1.address);

      // Should refund excess (payment - cost - gas)
      expect(finalBalance).to.be.closeTo(initialBalance - cost - gasUsed, ethers.parseEther("0.01"));
    });

    it("Should process referrals when provided", async function () {
      const tokenAmount = ethers.parseEther("1000");
      const cost = ethers.parseEther("1000");

      await tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        tokenAmount,
        cost,
        user2.address, // referrer
        { value: cost }
      );

      // Check if referral was registered in mock contract
      expect(await mockReferralEngine.registeredReferrals(user1.address)).to.equal(user2.address);
    });
  });

  describe("Token Selling", function () {
    beforeEach(async function () {
      // Buy some tokens first
      const tokenAmount = ethers.parseEther("1000");
      const cost = ethers.parseEther("1000");

      await tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        tokenAmount,
        cost,
        ethers.ZeroAddress,
        { value: cost }
      );

      // Approve token transfer for selling
      await mockToken.connect(user1).approve(tokenLauncher.target, tokenAmount);
    });

    it("Should allow selling tokens", async function () {
      const sellAmount = ethers.parseEther("500");
      const initialSupply = await tokenLauncher.tokenSupplies(mockToken.target);

      await expect(tokenLauncher.connect(user1).sellToken(
        mockToken.target,
        sellAmount,
        0 // minProceeds
      )).to.emit(tokenLauncher, "TokenSold");

      expect(await tokenLauncher.tokenSupplies(mockToken.target)).to.equal(initialSupply - sellAmount);
    });

    it("Should revert for zero sell amount", async function () {
      await expect(tokenLauncher.connect(user1).sellToken(
        mockToken.target,
        0,
        0
      )).to.be.revertedWithCustomError(tokenLauncher, "AmountMustBeGreaterThanZero");
    });

    it("Should revert for insufficient supply", async function () {
      const excessAmount = ethers.parseEther("2000"); // More than bought

      await expect(tokenLauncher.connect(user1).sellToken(
        mockToken.target,
        excessAmount,
        0
      )).to.be.revertedWithCustomError(tokenLauncher, "InsufficientBalance");
    });

    it("Should handle slippage protection on selling", async function () {
      const sellAmount = ethers.parseEther("500");
      const highMinProceeds = ethers.parseEther("1000"); // Too high

      await expect(tokenLauncher.connect(user1).sellToken(
        mockToken.target,
        sellAmount,
        highMinProceeds
      )).to.be.revertedWithCustomError(tokenLauncher, "SlippageExceeded");
    });
  });

  describe("Private Sales", function () {
    const startTime = Math.floor(Date.now() / 1000) + 100; // 100 seconds from now
    const endTime = startTime + 86400; // 24 hours later
    const price = ethers.parseEther("0.5"); // 0.5 ETH per token

    it("Should allow creating private sale", async function () {
      await expect(tokenLauncher.connect(privateSaleManager).createPrivateSale(
        mockToken.target,
        startTime,
        endTime,
        price,
        [user1.address, user2.address]
      )).to.emit(tokenLauncher, "PrivateSaleCreated")
        .withArgs(mockToken.target, startTime, endTime, price);

      const sale = await tokenLauncher.privateSales(mockToken.target);
      expect(sale.isActive).to.be.true;
      expect(sale.price).to.equal(price);
    });

    it("Should revert private sale creation with invalid timeframe", async function () {
      await expect(tokenLauncher.connect(privateSaleManager).createPrivateSale(
        mockToken.target,
        endTime, // start after end
        startTime,
        price,
        [user1.address]
      )).to.be.revertedWithCustomError(tokenLauncher, "InvalidTimeframe");
    });

    it("Should revert private sale creation with zero price", async function () {
      await expect(tokenLauncher.connect(privateSaleManager).createPrivateSale(
        mockToken.target,
        startTime,
        endTime,
        0, // zero price
        [user1.address]
      )).to.be.revertedWithCustomError(tokenLauncher, "InvalidPrice");
    });

    it("Should allow ending private sale", async function () {
      await tokenLauncher.connect(privateSaleManager).createPrivateSale(
        mockToken.target,
        startTime,
        endTime,
        price,
        [user1.address]
      );

      await tokenLauncher.connect(privateSaleManager).endPrivateSale(mockToken.target);

      const sale = await tokenLauncher.privateSales(mockToken.target);
      expect(sale.isActive).to.be.false;
    });

    describe("Private Sale Buying", function () {
      beforeEach(async function () {
        const block = await ethers.provider.getBlock("latest");
        const now = block.timestamp;
        await tokenLauncher.connect(privateSaleManager).createPrivateSale(
          mockToken.target,
          now, // Already started
          now + 86400, // Ends in 24 hours
          price,
          [user1.address]
        );
      });

      it("Should allow participant to buy at private sale price", async function () {
        const tokenAmount = ethers.parseEther("1000");
        const cost = (tokenAmount * price) / ethers.parseEther("1"); // 500 ETH

        await expect(tokenLauncher.connect(user1).buyToken(
          mockToken.target,
          tokenAmount,
          cost,
          ethers.ZeroAddress,
          { value: cost }
        )).to.emit(tokenLauncher, "TokenPurchased");
      });

      it("Should revert for non-participant", async function () {
        const tokenAmount = ethers.parseEther("1000");
        const cost = (tokenAmount * price) / ethers.parseEther("1");

        await expect(tokenLauncher.connect(user2).buyToken(
          mockToken.target,
          tokenAmount,
          cost,
          ethers.ZeroAddress,
          { value: cost }
        )).to.be.revertedWithCustomError(tokenLauncher, "NotPrivateSaleParticipant");
      });
    });
  });

  describe("Whitelist Management", function () {
    it("Should allow whitelist manager to update whitelist", async function () {
      await expect(tokenLauncher.connect(whitelistManager).updateWhitelist(
        mockToken.target,
        [user1.address, user2.address],
        [true, false]
      )).to.emit(tokenLauncher, "WhitelistUpdated")
        .withArgs(mockToken.target, user1.address, true);

      expect(await tokenLauncher.whitelisted(mockToken.target, user1.address)).to.be.true;
      expect(await tokenLauncher.whitelisted(mockToken.target, user2.address)).to.be.false;
    });

    it("Should allow enabling/disabling whitelist", async function () {
      await tokenLauncher.connect(whitelistManager).setWhitelistEnabled(mockToken.target, true);
      expect(await tokenLauncher.whitelistEnabled(mockToken.target)).to.be.true;

      await tokenLauncher.connect(whitelistManager).setWhitelistEnabled(mockToken.target, false);
      expect(await tokenLauncher.whitelistEnabled(mockToken.target)).to.be.false;
    });

    it("Should enforce whitelist when enabled", async function () {
      // Enable whitelist but don't add user1
      await tokenLauncher.connect(whitelistManager).setWhitelistEnabled(mockToken.target, true);

      await expect(tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        ethers.ZeroAddress,
        { value: ethers.parseEther("1000") }
      )).to.be.revertedWithCustomError(tokenLauncher, "NotWhitelisted");
    });
  });

  describe("Price Preview Functions", function () {
    it("Should return current price", async function () {
      const price = await tokenLauncher.getCurrentPrice(mockToken.target);
      expect(price).to.be.gt(0);
    });

    it("Should preview buy cost", async function () {
      const tokenAmount = ethers.parseEther("1000");
      const cost = await tokenLauncher.previewBuyCost(mockToken.target, tokenAmount);
      expect(cost).to.be.gt(0);
    });

    it("Should preview sell proceeds", async function () {
      // First buy some tokens to have supply
      await tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        ethers.ZeroAddress,
        { value: ethers.parseEther("1000") }
      );

      const sellAmount = ethers.parseEther("500");
      const proceeds = await tokenLauncher.previewSellProceeds(mockToken.target, sellAmount);
      expect(proceeds).to.be.gt(0);
    });

    it("Should preview private sale cost when active", async function () {
      const price = ethers.parseEther("0.5");
      const block = await ethers.provider.getBlock("latest");
      const now = block.timestamp;
      await tokenLauncher.connect(privateSaleManager).createPrivateSale(
        mockToken.target,
        now,
        now + 86400,
        price,
        [user1.address]
      );

      const tokenAmount = ethers.parseEther("1000");
      const cost = await tokenLauncher.previewBuyCost(mockToken.target, tokenAmount);
      const expectedCost = (tokenAmount * price) / ethers.parseEther("1");
      
      expect(cost).to.equal(expectedCost);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow admin to emergency withdraw ETH", async function () {
      // Send some ETH to contract
      await user1.sendTransaction({
        to: tokenLauncher.target,
        value: ethers.parseEther("1")
      });

      const amount = ethers.parseEther("0.5");
      await expect(tokenLauncher.connect(admin).emergencyWithdraw(ethers.ZeroAddress, amount))
        .to.emit(tokenLauncher, "EmergencyWithdrawal")
        .withArgs(ethers.ZeroAddress, amount);
    });

    it("Should allow admin to emergency withdraw tokens", async function () {
      const amount = ethers.parseEther("100");
      await mockToken.mint(tokenLauncher.target, amount);
      
      await expect(tokenLauncher.connect(admin).emergencyWithdraw(mockToken.target, amount))
        .to.emit(tokenLauncher, "EmergencyWithdrawal")
        .withArgs(mockToken.target, amount);
    });

    it("Should not allow non-admin emergency withdrawal", async function () {
      await expect(tokenLauncher.connect(user1).emergencyWithdraw(ethers.ZeroAddress, ethers.parseEther("1")))
        .to.be.reverted;
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow admin to pause contract", async function () {
      await tokenLauncher.connect(admin).pause();
      expect(await tokenLauncher.paused()).to.be.true;
    });

    it("Should block token operations when paused", async function () {
      await tokenLauncher.connect(admin).pause();

      await expect(tokenLauncher.connect(user1).buyToken(
        mockToken.target,
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        ethers.ZeroAddress,
        { value: ethers.parseEther("1000") }
      )).to.be.revertedWithCustomError(tokenLauncher, "EnforcedPause");
    });

    it("Should allow admin to unpause contract", async function () {
      await tokenLauncher.connect(admin).pause();
      await tokenLauncher.connect(admin).unpause();
      expect(await tokenLauncher.paused()).to.be.false;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero address token correctly", async function () {
      await expect(tokenLauncher.connect(user1).buyToken(
        ethers.ZeroAddress,
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        ethers.ZeroAddress,
        { value: ethers.parseEther("1000") }
      )).to.be.revertedWithCustomError(tokenLauncher, "ZeroAddress");
    });

    it("Should handle contract receiving ETH", async function () {
      await expect(user1.sendTransaction({
        to: tokenLauncher.target,
        value: ethers.parseEther("1")
      })).to.not.be.reverted;

      expect(await ethers.provider.getBalance(tokenLauncher.target)).to.be.gte(ethers.parseEther("1"));
    });

    it("Should handle array length mismatch in whitelist update", async function () {
      await expect(tokenLauncher.connect(whitelistManager).updateWhitelist(
        mockToken.target,
        [user1.address, user2.address],
        [true] // Mismatched lengths
      )).to.be.revertedWithCustomError(tokenLauncher, "InvalidTimeframe");
    });
  });
});