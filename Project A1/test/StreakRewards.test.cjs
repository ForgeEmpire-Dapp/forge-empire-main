const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StreakRewards", function () {
  let streakRewards;
  let mockXPEngine, mockForgeToken;
  let owner, rewardManager, user1, user2;

  const StreakType = {
    DAILY_LOGIN: 0,
    QUEST_COMPLETION: 1,
    TRADING: 2,
    GOVERNANCE: 3,
    SOCIAL_INTERACTION: 4
  };

  beforeEach(async function () {
    [owner, rewardManager, user1, user2] = await ethers.getSigners();

    // Deploy mocks
    const MockXPEngine = await ethers.getContractFactory("MockXPEngine");
    mockXPEngine = await MockXPEngine.deploy();
    await mockXPEngine.waitForDeployment();

    const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
    mockBadgeMinter = await MockBadgeMinter.deploy();
    await mockBadgeMinter.waitForDeployment();

    const MockStreakCore = await ethers.getContractFactory("contracts/mocks/MockStreakCore.sol:MockStreakCore");
    mockStreakCore = await MockStreakCore.deploy();
    await mockStreakCore.waitForDeployment();

    // Deploy StreakRewards
    const StreakRewards = await ethers.getContractFactory("StreakRewards");
    streakRewards = await StreakRewards.deploy();
    await streakRewards.waitForDeployment();

    // Initialize
    await streakRewards.initialize(mockXPEngine.target, mockBadgeMinter.target, mockStreakCore.target);

    // Grant reward manager role
    const REWARD_MANAGER_ROLE = await streakRewards.REWARD_MANAGER_ROLE();
    await streakRewards.grantRole(REWARD_MANAGER_ROLE, rewardManager.address);

    // Grant minter role to StreakRewards contract
    const MINTER_ROLE = await mockBadgeMinter.MINTER_ROLE();
    await mockBadgeMinter.grantRole(MINTER_ROLE, streakRewards.target);

    // Setup some initial rewards
    await streakRewards.connect(owner).configureReward(
      StreakType.DAILY_LOGIN,
      5, // threshold
      100, // xpReward
      110, // multiplier
      "Test Badge URI" // badgeURI
    );
  });

  describe("Deployment and Initialization", function () {
    it("Should initialize with correct addresses", async function () {
      expect(await streakRewards.xpEngine()).to.equal(mockXPEngine.target);
      expect(await streakRewards.badgeMinter()).to.equal(mockBadgeMinter.target);
      expect(await streakRewards.streakCore()).to.equal(mockStreakCore.target);
    });

    it("Should grant roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await streakRewards.DEFAULT_ADMIN_ROLE();
      const REWARD_MANAGER_ROLE = await streakRewards.REWARD_MANAGER_ROLE();
      
      expect(await streakRewards.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await streakRewards.hasRole(REWARD_MANAGER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Reward Threshold Management", function () {
    it("Should allow reward manager to set reward thresholds", async function () {
      await expect(streakRewards.connect(owner).configureReward(
        StreakType.QUEST_COMPLETION,
        10, // threshold  
        200, // xpReward
        125, // multiplier
        "Test Badge URI" // badgeURI
      )).to.emit(streakRewards, "RewardConfigured")
        .withArgs(StreakType.QUEST_COMPLETION, 10, 200, 125);

      const threshold = await streakRewards.streakRewards(StreakType.QUEST_COMPLETION, 10);
      expect(threshold.xpReward).to.equal(200);
      expect(threshold.multiplier).to.equal(125);
    });

    it("Should not allow non-reward manager to set thresholds", async function () {
      await expect(streakRewards.connect(user1).configureReward(
        StreakType.TRADING,
        5,
        100,
        110,
        "Test Badge URI"
      )).to.be.reverted;
    });

    it("Should handle multiple thresholds for same streak type", async function () {
      await streakRewards.connect(owner).configureReward(
        StreakType.DAILY_LOGIN, 10, 200, 120, "Test Badge URI"
      );
      await streakRewards.connect(owner).configureReward(
        StreakType.DAILY_LOGIN, 15, 300, 130, "Test Badge URI"
      );

      const threshold10 = await streakRewards.streakRewards(StreakType.DAILY_LOGIN, 10);
      const threshold15 = await streakRewards.streakRewards(StreakType.DAILY_LOGIN, 15);

      expect(threshold10.xpReward).to.equal(200);
      expect(threshold15.xpReward).to.equal(300);
    });
  });

  describe("Reward Claiming", function () {
    beforeEach(async function () {
      // Setup user with sufficient streak and mark rewards as available
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 10);
    });

    it("Should allow users to claim single reward", async function () {
      await expect(streakRewards.connect(user1).claimReward(StreakType.DAILY_LOGIN, 3))
        .to.emit(streakRewards, "RewardClaimed");
    });

    it("Should not allow claiming same reward twice", async function () {
      await streakRewards.connect(user1).claimReward(StreakType.DAILY_LOGIN, 3);
      
      await expect(streakRewards.connect(user1).claimReward(StreakType.DAILY_LOGIN, 3))
        .to.be.revertedWithCustomError(streakRewards, "AlreadyClaimed");
    });

    it("Should allow claiming all available rewards", async function () {
      await expect(streakRewards.connect(user1).claimAllRewards(StreakType.DAILY_LOGIN))
        .to.emit(streakRewards, "BatchRewardsClaimed");
    });
  });

  describe("Bonus XP System", function () {
    it("Should apply correct bonus multiplier", async function () {
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 10);
      await streakRewards.connect(user1).claimReward(StreakType.DAILY_LOGIN, 3);
      
      const baseXP = 100;
      await expect(streakRewards.connect(rewardManager).applyBonusXP(user1.address, StreakType.DAILY_LOGIN, baseXP))
        .to.emit(streakRewards, "MultiplierApplied");
    });
  });

  

  describe("View Functions", function () {
    beforeEach(async function () {
      // Setup multiple thresholds
      await streakRewards.connect(owner).configureReward(
        StreakType.DAILY_LOGIN, 7, 150, 120, "Test Badge URI"
      );
      await streakRewards.connect(owner).configureReward(
        StreakType.DAILY_LOGIN, 10, 200, 130, "Test Badge URI"
      );
      
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 8);
    });

    it("Should return available rewards for user", async function () {
      const availableRewards = await streakRewards.getAvailableRewards(user1.address, StreakType.DAILY_LOGIN);
      
      expect(availableRewards).to.deep.equal([3n, 5n, 7n]);
    });

    it("Should check if reward is claimed", async function () {
      expect(await streakRewards.claimedRewards(user1.address, StreakType.DAILY_LOGIN, 3)).to.be.false;
      
      await streakRewards.connect(user1).claimReward(StreakType.DAILY_LOGIN, 3);
      
      expect(await streakRewards.claimedRewards(user1.address, StreakType.DAILY_LOGIN, 3)).to.be.true;
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow admin to pause rewards", async function () {
      await streakRewards.pause();
      
      await expect(streakRewards.connect(user1).claimReward(StreakType.DAILY_LOGIN, 3))
        .to.be.revertedWithCustomError(streakRewards, "EnforcedPause");
    });
  });

  describe("Integration Tests", function () {
    it("Should handle full reward cycle", async function () {
      // Setup user with streak
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 10);
      
      // Check available rewards
      const available = await streakRewards.getAvailableRewards(user1.address, StreakType.DAILY_LOGIN);
      expect(available.length).to.be.gt(0);
      
      // Claim reward
      await streakRewards.connect(user1).claimReward(StreakType.DAILY_LOGIN, 3);
      
      // Verify reward was claimed
      expect(await streakRewards.claimedRewards(user1.address, StreakType.DAILY_LOGIN, 3)).to.be.true;
    });
  });
});