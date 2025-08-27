const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ForgeVestingWallet", function () {
  let ForgeVestingWallet, vestingWallet;
  let MockERC20, mockToken;
  let owner, beneficiary, nonBeneficiary;
  let startTime, duration;

  beforeEach(async () => {
    [owner, beneficiary, nonBeneficiary] = await ethers.getSigners();

    // Get current block timestamp and set vesting parameters
    const currentTime = await time.latest();
    startTime = currentTime + 100; // Start in 100 seconds
    duration = 365 * 24 * 60 * 60; // 1 year in seconds

    // Deploy ForgeVestingWallet
    ForgeVestingWallet = await ethers.getContractFactory("ForgeVestingWallet");
    vestingWallet = await ForgeVestingWallet.deploy(
      beneficiary.address,
      startTime,
      duration
    );
    await vestingWallet.waitForDeployment();

    // Deploy mock ERC20 token for testing
    MockERC20 = await ethers.getContractFactory("ForgeTokenCore");
    mockToken = await MockERC20.deploy();
    await mockToken.waitForDeployment();

    // Initialize the mock token
    await mockToken.initialize();
    
    // Enable trading to allow transfers
    await mockToken.setTradingEnabled(true);
    
    // Transfer some tokens to the vesting wallet
    const tokenAmount = ethers.parseEther("1000");
    await mockToken.transfer(vestingWallet.target, tokenAmount);
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct beneficiary", async () => {
      expect(await vestingWallet.owner()).to.equal(beneficiary.address);
    });

    it("should initialize with correct start time", async () => {
      expect(await vestingWallet.start()).to.equal(startTime);
    });

    it("should initialize with correct duration", async () => {
      expect(await vestingWallet.duration()).to.equal(duration);
    });

    it("should calculate correct end time", async () => {
      const expectedEnd = startTime + duration;
      expect(await vestingWallet.end()).to.equal(expectedEnd);
    });

    it("should have zero released amount initially", async () => {
      expect(await vestingWallet["released(address)"](mockToken.target)).to.equal(0);
    });
  });

  describe("Token Vesting", function () {
    it("should not release tokens before start time", async () => {
      const releasable = await vestingWallet["releasable(address)"](mockToken.target);
      expect(releasable).to.equal(0);
    });

    it("should release tokens proportionally after start time", async () => {
      // Fast forward to 25% through vesting period
      const quarterDuration = duration / 4;
      await time.increaseTo(startTime + quarterDuration);

      const totalTokens = await mockToken.balanceOf(vestingWallet.target);
      const releasable = await vestingWallet["releasable(address)"](mockToken.target);
      
      // Should be approximately 25% of total tokens (allowing for some precision loss)
      const expectedReleasable = totalTokens / 4n;
      expect(releasable).to.be.closeTo(expectedReleasable, ethers.parseEther("1"));
    });

    it("should release all tokens after vesting period ends", async () => {
      // Fast forward past the end of vesting period
      await time.increaseTo(startTime + duration + 1);

      const totalTokens = await mockToken.balanceOf(vestingWallet.target);
      const releasable = await vestingWallet["releasable(address)"](mockToken.target);
      
      expect(releasable).to.equal(totalTokens);
    });

    it("should allow beneficiary to release vested tokens", async () => {
      // Fast forward to 50% through vesting period
      const halfDuration = duration / 2;
      await time.increaseTo(startTime + halfDuration);

      const initialBeneficiaryBalance = await mockToken.balanceOf(beneficiary.address);
      const releasable = await vestingWallet["releasable(address)"](mockToken.target);

      // Release tokens
      await expect(vestingWallet.connect(beneficiary)["release(address)"](mockToken.target))
        .to.emit(vestingWallet, "ERC20Released")
        .withArgs(mockToken.target, releasable);

      const finalBeneficiaryBalance = await mockToken.balanceOf(beneficiary.address);
      expect(finalBeneficiaryBalance - initialBeneficiaryBalance).to.equal(releasable);
    });

    it("should track released amount correctly", async () => {
      // Fast forward to 50% through vesting period
      const halfDuration = duration / 2;
      await time.increaseTo(startTime + halfDuration);

      const releasableBefore = await vestingWallet["releasable(address)"](mockToken.target);
      
      // Release tokens
      await vestingWallet.connect(beneficiary)["release(address)"](mockToken.target);

      const releasedAmount = await vestingWallet["released(address)"](mockToken.target);
      expect(releasedAmount).to.equal(releasableBefore);

      // Fast forward to 75% through vesting period
      const threeFourthDuration = Math.floor((duration * 3) / 4);
      await time.increaseTo(startTime + threeFourthDuration);

      const totalTokens = await mockToken.balanceOf(vestingWallet.target) + releasedAmount;
      const expectedVested = (totalTokens * 3n) / 4n;
      const releasableAfter = await vestingWallet["releasable(address)"](mockToken.target);
      
      // Should be approximately 25% more (75% - 50% = 25%)
      const expectedAdditional = expectedVested - releasedAmount;
      expect(releasableAfter).to.be.closeTo(expectedAdditional, ethers.parseEther("1"));
    });

    it("should allow anyone to trigger release for beneficiary", async () => {
      // Fast forward to 50% through vesting period
      const halfDuration = duration / 2;
      await time.increaseTo(startTime + halfDuration);

      const initialBeneficiaryBalance = await mockToken.balanceOf(beneficiary.address);
      const releasable = await vestingWallet["releasable(address)"](mockToken.target);

      // Non-beneficiary triggers release
      await vestingWallet.connect(nonBeneficiary)["release(address)"](mockToken.target);

      const finalBeneficiaryBalance = await mockToken.balanceOf(beneficiary.address);
      expect(finalBeneficiaryBalance - initialBeneficiaryBalance).to.equal(releasable);
    });
  });

  describe("Ether Vesting", function () {
    beforeEach(async () => {
      // Send some ether to the vesting wallet
      await owner.sendTransaction({
        to: vestingWallet.target,
        value: ethers.parseEther("10")
      });
    });

    it("should handle ether vesting correctly", async () => {
      // Fast forward to 50% through vesting period
      const halfDuration = duration / 2;
      await time.increaseTo(startTime + halfDuration);

      const initialBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);
      const releasable = await vestingWallet.releasable();

      // Release ether
      const tx = await vestingWallet.connect(beneficiary).release();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalBeneficiaryBalance = await ethers.provider.getBalance(beneficiary.address);
      const expectedBalance = initialBeneficiaryBalance + releasable - gasUsed;
      
      expect(finalBeneficiaryBalance).to.equal(expectedBalance);
    });

    it("should track released ether amount correctly", async () => {
      // Fast forward to 25% through vesting period
      const quarterDuration = duration / 4;
      await time.increaseTo(startTime + quarterDuration);

      const releasableBefore = await vestingWallet.releasable();
      
      // Release ether
      await vestingWallet.connect(beneficiary).release();

      const releasedAmount = await vestingWallet["released()"]();
      expect(releasedAmount).to.equal(releasableBefore);
    });
  });

  describe("View Functions", function () {
    it("should return correct vested amount over time", async () => {
      const totalTokens = await mockToken.balanceOf(vestingWallet.target);

      // Before start time
      const vestedBefore = await vestingWallet["vestedAmount(address,uint64)"](
        mockToken.target, 
        startTime - 1
      );
      expect(vestedBefore).to.equal(0);

      // At 50% completion
      const halfwayTime = startTime + (duration / 2);
      const vestedHalfway = await vestingWallet["vestedAmount(address,uint64)"](
        mockToken.target, 
        halfwayTime
      );
      expect(vestedHalfway).to.be.closeTo(totalTokens / 2n, ethers.parseEther("1"));

      // After completion
      const vestedAfter = await vestingWallet["vestedAmount(address,uint64)"](
        mockToken.target, 
        startTime + duration + 1
      );
      expect(vestedAfter).to.equal(totalTokens);
    });

    it("should return correct releasable amount", async () => {
      // Fast forward to 25% through vesting period
      const quarterDuration = duration / 4;
      await time.increaseTo(startTime + quarterDuration);

      const totalTokens = await mockToken.balanceOf(vestingWallet.target);
      const releasable = await vestingWallet["releasable(address)"](mockToken.target);
      
      const expectedReleasable = totalTokens / 4n;
      expect(releasable).to.be.closeTo(expectedReleasable, ethers.parseEther("1"));
    });
  });

  describe("Edge Cases", function () {
    it("should handle multiple releases correctly", async () => {
      // Fast forward to 30% through vesting period
      const thirtyPercentDuration = Math.floor((duration * 30) / 100);
      await time.increaseTo(startTime + thirtyPercentDuration);

      // First release
      await vestingWallet.connect(beneficiary)["release(address)"](mockToken.target);
      const firstRelease = await vestingWallet["released(address)"](mockToken.target);

      // Fast forward to 70% through vesting period
      const seventyPercentDuration = Math.floor((duration * 70) / 100);
      await time.increaseTo(startTime + seventyPercentDuration);

      // Second release
      const releasableSecond = await vestingWallet["releasable(address)"](mockToken.target);
      await vestingWallet.connect(beneficiary)["release(address)"](mockToken.target);
      const totalReleased = await vestingWallet["released(address)"](mockToken.target);

      expect(totalReleased).to.equal(firstRelease + releasableSecond);
    });

    it("should handle zero duration correctly", async () => {
      // Deploy vesting wallet with zero duration
      const zeroVesting = await ForgeVestingWallet.deploy(
        beneficiary.address,
        startTime,
        0
      );
      await zeroVesting.waitForDeployment();

      // Send tokens to zero duration vesting wallet
      const tokenAmount = ethers.parseEther("100");
      await mockToken.transfer(zeroVesting.target, tokenAmount);

      // Fast forward past start time
      await time.increaseTo(startTime + 1);

      // All tokens should be immediately releasable
      const releasable = await zeroVesting["releasable(address)"](mockToken.target);
      expect(releasable).to.equal(tokenAmount);
    });

    it("should handle no tokens correctly", async () => {
      // Deploy new vesting wallet with no tokens
      const emptyVesting = await ForgeVestingWallet.deploy(
        beneficiary.address,
        startTime,
        duration
      );
      await emptyVesting.waitForDeployment();

      // Fast forward to middle of vesting period
      await time.increaseTo(startTime + (duration / 2));

      const releasable = await emptyVesting["releasable(address)"](mockToken.target);
      expect(releasable).to.equal(0);
    });

    it("should handle very long duration correctly", async () => {
      // Deploy vesting wallet with very long duration (100 years)
      const longDuration = 100 * 365 * 24 * 60 * 60;
      const longVesting = await ForgeVestingWallet.deploy(
        beneficiary.address,
        startTime,
        longDuration
      );
      await longVesting.waitForDeployment();

      // Send tokens
      const tokenAmount = ethers.parseEther("100");
      await mockToken.transfer(longVesting.target, tokenAmount);

      // Fast forward 1 year (should be 1% vested)
      const oneYear = 365 * 24 * 60 * 60;
      await time.increaseTo(startTime + oneYear);

      const releasable = await longVesting["releasable(address)"](mockToken.target);
      const expectedReleasable = tokenAmount / 100n; // 1% of tokens
      
      expect(releasable).to.be.closeTo(expectedReleasable, ethers.parseEther("0.1"));
    });
  });

  describe("Integration Tests", function () {
    it("should work correctly with multiple token types", async () => {
      // Deploy another token
      const secondToken = await MockERC20.deploy();
      await secondToken.waitForDeployment();
      await secondToken.initialize();
      await secondToken.setTradingEnabled(true);

      // Send different amounts to vesting wallet
      const firstTokenAmount = ethers.parseEther("1000");
      const secondTokenAmount = ethers.parseEther("500");
      
      await secondToken.transfer(vestingWallet.target, secondTokenAmount);

      // Fast forward to 50% through vesting period
      await time.increaseTo(startTime + (duration / 2));

      // Check releasable amounts for both tokens
      const releasableFirst = await vestingWallet["releasable(address)"](mockToken.target);
      const releasableSecond = await vestingWallet["releasable(address)"](secondToken.target);

      expect(releasableFirst).to.be.closeTo(firstTokenAmount / 2n, ethers.parseEther("1"));
      expect(releasableSecond).to.be.closeTo(secondTokenAmount / 2n, ethers.parseEther("0.5"));

      // Release both tokens
      await vestingWallet.connect(beneficiary)["release(address)"](mockToken.target);
      await vestingWallet.connect(beneficiary)["release(address)"](secondToken.target);

      // Check beneficiary received correct amounts
      expect(await mockToken.balanceOf(beneficiary.address)).to.be.closeTo(
        firstTokenAmount / 2n, 
        ethers.parseEther("1")
      );
      expect(await secondToken.balanceOf(beneficiary.address)).to.be.closeTo(
        secondTokenAmount / 2n, 
        ethers.parseEther("0.5")
      );
    });

    it("should handle simultaneous ether and token vesting", async () => {
      // Send both ether and tokens to vesting wallet
      await owner.sendTransaction({
        to: vestingWallet.target,
        value: ethers.parseEther("5")
      });

      // Note: vesting wallet already has 1000 ether worth of tokens from beforeEach
      const existingTokens = await mockToken.balanceOf(vestingWallet.target);
      const totalTokens = existingTokens;

      // Fast forward to 50% through vesting period
      await time.increaseTo(startTime + (duration / 2));

      const initialEtherBalance = await ethers.provider.getBalance(beneficiary.address);
      const initialTokenBalance = await mockToken.balanceOf(beneficiary.address);

      // Release both ether and tokens
      const etherTx = await vestingWallet.connect(beneficiary).release();
      const etherReceipt = await etherTx.wait();
      const etherGasUsed = etherReceipt.gasUsed * etherReceipt.gasPrice;

      await vestingWallet.connect(beneficiary)["release(address)"](mockToken.target);

      // Check final balances
      const finalEtherBalance = await ethers.provider.getBalance(beneficiary.address);
      const finalTokenBalance = await mockToken.balanceOf(beneficiary.address);

      // Ether should be approximately 50% minus gas costs
      const etherIncrease = finalEtherBalance - initialEtherBalance + etherGasUsed;
      expect(etherIncrease).to.be.closeTo(ethers.parseEther("2.5"), ethers.parseEther("0.1"));

      // Tokens should be approximately 50%
      const tokenIncrease = finalTokenBalance - initialTokenBalance;
      expect(tokenIncrease).to.be.closeTo(totalTokens / 2n, ethers.parseEther("1"));
    });
  });
});