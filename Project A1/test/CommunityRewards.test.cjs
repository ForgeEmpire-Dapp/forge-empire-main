const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CommunityRewards", function () {
  let communityRewards;
  let mockRewardToken;
  let mockVestingWalletFactory;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy a mock Reward Token (MockERC20)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockRewardToken = await MockERC20.deploy("RewardToken", "RWT");
    await mockRewardToken.waitForDeployment();

    // Deploy a mock VestingWalletFactory
    const MockVestingWalletFactory = await ethers.getContractFactory("VestingWalletFactory"); // Using VestingWalletFactory itself as a mock
    mockVestingWalletFactory = await MockVestingWalletFactory.deploy();
    await mockVestingWalletFactory.waitForDeployment();

    const CommunityRewards = await ethers.getContractFactory("CommunityRewards");
    communityRewards = await CommunityRewards.deploy(mockRewardToken.target, mockVestingWalletFactory.target);
    await communityRewards.waitForDeployment();
  });

  it("Should deploy with the correct reward token address", async function () {
    expect(await communityRewards.rewardToken()).to.equal(mockRewardToken.target);
  });

  it("Should deploy with the correct vesting wallet factory address", async function () {
    expect(await communityRewards.vestingWalletFactory()).to.equal(mockVestingWalletFactory.target);
  });

  it("Should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
    expect(await communityRewards.hasRole(await communityRewards.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
  });

  it("Should grant REWARD_DISTRIBUTOR_ROLE to the deployer", async function () {
    expect(await communityRewards.hasRole(await communityRewards.REWARD_DISTRIBUTOR_ROLE(), owner.address)).to.be.true;
  });

  describe("depositRewards", function () {
    let communityRewards;
    let mockRewardToken;
    let mockVestingWalletFactory;
    let owner;
    let addr1;

    beforeEach(async function () {
      [owner, addr1] = await ethers.getSigners();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockRewardToken = await MockERC20.deploy("RewardToken", "RWT");
      await mockRewardToken.waitForDeployment();

      const MockVestingWalletFactory = await ethers.getContractFactory("VestingWalletFactory");
      mockVestingWalletFactory = await MockVestingWalletFactory.deploy();
      await mockVestingWalletFactory.waitForDeployment();

      const CommunityRewards = await ethers.getContractFactory("CommunityRewards");
      communityRewards = await CommunityRewards.deploy(mockRewardToken.target, mockVestingWalletFactory.target);
      await communityRewards.waitForDeployment();

      // Grant REWARD_DEPOSITOR_ROLE to owner
      await communityRewards.grantRole(await communityRewards.REWARD_DEPOSITOR_ROLE(), owner.address);

      // Mint and approve tokens for deposit
      await mockRewardToken.mint(owner.address, 1000);
      await mockRewardToken.approve(communityRewards.target, 1000);
    });

    it("Should allow REWARD_DEPOSITOR_ROLE to deposit rewards", async function () {
      const amount = 100;
      await expect(communityRewards.depositRewards(amount))
        .to.emit(communityRewards, "RewardsDeposited")
        .withArgs(owner.address, amount);
      expect(await mockRewardToken.balanceOf(communityRewards.target)).to.equal(amount);
    });

    it("Should not allow non-REWARD_DEPOSITOR_ROLE to deposit rewards", async function () {
      const amount = 100;
      await expect(communityRewards.connect(addr1).depositRewards(amount))
        .to.be.revertedWithCustomError(communityRewards, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow depositing zero amount", async function () {
      await expect(communityRewards.depositRewards(0))
        .to.be.revertedWithCustomError(communityRewards, "ZeroAmount");
    });
  });

  describe("distributeVestedRewards", function () {
    let communityRewards;
    let mockRewardToken;
    let mockVestingWalletFactory;
    let owner;
    let addr1;

    beforeEach(async function () {
      [owner, addr1] = await ethers.getSigners();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockRewardToken = await MockERC20.deploy("RewardToken", "RWT");
      await mockRewardToken.waitForDeployment();

      const MockVestingWalletFactory = await ethers.getContractFactory("VestingWalletFactory");
      mockVestingWalletFactory = await MockVestingWalletFactory.deploy();
      await mockVestingWalletFactory.waitForDeployment();

      const CommunityRewards = await ethers.getContractFactory("CommunityRewards");
      communityRewards = await CommunityRewards.deploy(mockRewardToken.target, mockVestingWalletFactory.target);
      await communityRewards.waitForDeployment();

      // Grant REWARD_DISTRIBUTOR_ROLE to owner
      await communityRewards.grantRole(await communityRewards.REWARD_DISTRIBUTOR_ROLE(), owner.address);
      // Grant WALLET_CREATOR_ROLE to CommunityRewards contract on VestingWalletFactory
      await mockVestingWalletFactory.grantRole(await mockVestingWalletFactory.WALLET_CREATOR_ROLE(), communityRewards.target);

      // Deposit some rewards into the contract
      await communityRewards.grantRole(await communityRewards.REWARD_DEPOSITOR_ROLE(), owner.address);
      await mockRewardToken.mint(owner.address, 1000);
      await mockRewardToken.approve(communityRewards.target, 1000);
      await communityRewards.depositRewards(500);
    });

    it("Should allow REWARD_DISTRIBUTOR_ROLE to distribute vested rewards", async function () {
      const beneficiary = addr1.address;
      const amount = 100;
      const duration = 3600;

      await expect(communityRewards.distributeVestedRewards(beneficiary, amount, duration))
        .to.emit(communityRewards, "VestedRewardsDistributed")
        .withArgs(beneficiary, amount, duration, (vestingWalletAddress) => vestingWalletAddress !== ethers.ZeroAddress);

      expect(await communityRewards.totalRewardsDistributed()).to.equal(amount);
    });

    it("Should not allow non-REWARD_DISTRIBUTOR_ROLE to distribute vested rewards", async function () {
      const beneficiary = addr1.address;
      const amount = 100;
      const duration = 3600;

      await expect(communityRewards.connect(addr1).distributeVestedRewards(beneficiary, amount, duration))
        .to.be.revertedWithCustomError(communityRewards, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow distributing to zero address beneficiary", async function () {
      const beneficiary = ethers.ZeroAddress;
      const amount = 100;
      const duration = 3600;

      await expect(communityRewards.distributeVestedRewards(beneficiary, amount, duration))
        .to.be.revertedWithCustomError(communityRewards, "ZeroAddressBeneficiary");
    });

    it("Should not allow distributing zero amount", async function () {
      const beneficiary = addr1.address;
      const amount = 0;
      const duration = 3600;

      await expect(communityRewards.distributeVestedRewards(beneficiary, amount, duration))
        .to.be.revertedWithCustomError(communityRewards, "ZeroAmount");
    });

    it("Should not allow distributing with zero duration", async function () {
      const beneficiary = addr1.address;
      const amount = 100;
      const duration = 0;

      await expect(communityRewards.distributeVestedRewards(beneficiary, amount, duration))
        .to.be.revertedWithCustomError(communityRewards, "ZeroDuration");
    });

    it("Should not allow distributing with insufficient funds", async function () {
      const beneficiary = addr1.address;
      const amount = 1000; // More than deposited 500
      const duration = 3600;

      await expect(communityRewards.distributeVestedRewards(beneficiary, amount, duration))
        .to.be.revertedWithCustomError(communityRewards, "InsufficientFunds");
    });
  });
});
