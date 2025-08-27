const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StreakSystemManager", function () {
  let streakSystemManager;
  let mockStreakCore, mockStreakRewards, mockStreakMilestones, mockStreakStats;
  let owner, admin, user1, user2;

  const StreakType = {
    DAILY_LOGIN: 0,
    QUEST_COMPLETION: 1,
    TRADING: 2,
    GOVERNANCE: 3,
    SOCIAL_INTERACTION: 4
  };

  beforeEach(async function () {
    [owner, admin, user1, user2] = await ethers.getSigners();

    // Deploy mock contracts
    const MockStreakCore = await ethers.getContractFactory("contracts/mocks/MockStreakCore.sol:MockStreakCore");
    mockStreakCore = await MockStreakCore.deploy();
    await mockStreakCore.waitForDeployment();

    const MockStreakRewards = await ethers.getContractFactory("contracts/mocks/MockStreakRewards.sol:MockStreakRewards");
    mockStreakRewards = await MockStreakRewards.deploy();
    await mockStreakRewards.waitForDeployment();

    const MockStreakMilestones = await ethers.getContractFactory("contracts/mocks/MockStreakMilestones.sol:MockStreakMilestones");
    mockStreakMilestones = await MockStreakMilestones.deploy();
    await mockStreakMilestones.waitForDeployment();

    const MockStreakStats = await ethers.getContractFactory("contracts/mocks/MockStreakStats.sol:MockStreakStats");
    mockStreakStats = await MockStreakStats.deploy();
    await mockStreakStats.waitForDeployment();

    // Deploy StreakSystemManager
    const StreakSystemManager = await ethers.getContractFactory("StreakSystemManager");
    streakSystemManager = await StreakSystemManager.deploy();
    await streakSystemManager.waitForDeployment();

    // Initialize with component addresses
    await streakSystemManager.initialize(
      mockStreakCore.target,
      mockStreakRewards.target,
      mockStreakMilestones.target,
      mockStreakStats.target
    );

    // Grant admin role
    const SYSTEM_MANAGER_ROLE = await streakSystemManager.SYSTEM_MANAGER_ROLE();
    await streakSystemManager.grantRole(SYSTEM_MANAGER_ROLE, admin.address);

    // Set initial streak for user1 in mockStreakCore
    await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 0);
    await mockStreakCore.setCurrentStreak(user1.address, StreakType.QUEST_COMPLETION, 0);
    await mockStreakCore.setCurrentStreak(user1.address, StreakType.TRADING, 0);
    await mockStreakCore.setCurrentStreak(user1.address, StreakType.GOVERNANCE, 0);
    await mockStreakCore.setCurrentStreak(user1.address, StreakType.SOCIAL_INTERACTION, 0);
  });

  describe("Deployment and Initialization", function () {
    it("Should initialize with correct component addresses", async function () {
      expect(await streakSystemManager.streakCore()).to.equal(mockStreakCore.target);
      expect(await streakSystemManager.streakRewards()).to.equal(mockStreakRewards.target);
      expect(await streakSystemManager.streakMilestones()).to.equal(mockStreakMilestones.target);
      expect(await streakSystemManager.streakStats()).to.equal(mockStreakStats.target);
    });

    it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await streakSystemManager.DEFAULT_ADMIN_ROLE();
      expect(await streakSystemManager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Streak Recording", function () {
    it("Should allow users to record daily login", async function () {
      await expect(streakSystemManager.connect(user1).recordDailyLogin())
        .to.emit(streakSystemManager, "StreakIncreased");
    });

    it("Should allow users to record quest completion", async function () {
      await expect(streakSystemManager.connect(user1).recordQuestCompletion())
        .to.emit(streakSystemManager, "StreakIncreased");
    });

    it("Should allow users to record trading activity", async function () {
      await expect(streakSystemManager.connect(user1).recordTradingActivity())
        .to.emit(streakSystemManager, "StreakIncreased");
    });

    it("Should allow users to record governance participation", async function () {
      await expect(streakSystemManager.connect(user1).recordGovernanceParticipation())
        .to.emit(streakSystemManager, "StreakIncreased");
    });

    it("Should allow users to record social interaction", async function () {
      await expect(streakSystemManager.connect(user1).recordSocialInteraction())
        .to.emit(streakSystemManager, "StreakIncreased");
    });

    it("Should not allow recording when paused", async function () {
      await streakSystemManager.pause();
      
      await expect(streakSystemManager.connect(user1).recordDailyLogin())
        .to.be.revertedWithCustomError(streakSystemManager, "EnforcedPause");
    });
  });

  describe("Component Management", function () {
    it("Should allow admin to update streak core", async function () {
      const NewMockCore = await ethers.getContractFactory("contracts/mocks/MockStreakCore.sol:MockStreakCore");
      const newMockCore = await NewMockCore.deploy();
      await newMockCore.waitForDeployment();
      
      await expect(streakSystemManager.connect(owner).updateModule("StreakCore", newMockCore.target))
        .to.emit(streakSystemManager, "ModuleUpdated")
        .withArgs("StreakCore", mockStreakCore.target, newMockCore.target);
      
      expect(await streakSystemManager.streakCore()).to.equal(newMockCore.target);
    });

    it("Should allow admin to update streak rewards", async function () {
      const newMockRewards = await ethers.getContractFactory("contracts/mocks/MockStreakRewards.sol:MockStreakRewards");
      const newMockRewardsInstance = await newMockRewards.deploy();
      await newMockRewardsInstance.waitForDeployment();
      
      await expect(streakSystemManager.connect(owner).updateModule("StreakRewards", newMockRewardsInstance.target))
        .to.emit(streakSystemManager, "ModuleUpdated")
        .withArgs("StreakRewards", mockStreakRewards.target, newMockRewardsInstance.target);
      
      expect(await streakSystemManager.streakRewards()).to.equal(newMockRewardsInstance.target);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Set up mock return values
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 5);
    });

    it("Should get current streak from core", async function () {
      expect(await streakSystemManager.getCurrentStreak(user1.address, StreakType.DAILY_LOGIN))
        .to.equal(5);
    });

    it("Should get longest streak from core", async function () {
      expect(await streakSystemManager.getLongestStreak(user1.address, StreakType.DAILY_LOGIN))
        .to.equal(0);
    });

    it("Should check if recorded today from core", async function () {
      expect(await streakSystemManager.hasRecordedToday(user1.address, StreakType.DAILY_LOGIN))
        .to.be.false;
    });

    it("Should get available rewards from rewards component", async function () {
      const rewards = await streakSystemManager.getAvailableRewards(user1.address, StreakType.DAILY_LOGIN);
      expect(rewards).to.deep.equal([5n]);
    });
  });

  describe("Reward Management", function () {
    it("Should allow users to claim rewards", async function () {
      await expect(streakSystemManager.connect(user1).claimReward(StreakType.DAILY_LOGIN, 5))
        .to.emit(mockStreakRewards, "RewardClaimed");
    });

    it("Should allow users to claim all rewards", async function () {
      await expect(streakSystemManager.connect(user1).claimAllRewards(StreakType.DAILY_LOGIN))
        .to.emit(mockStreakRewards, "BatchRewardsClaimed");
    });

    it("Should allow users to claim milestones", async function () {
      await expect(streakSystemManager.connect(user1).claimMilestone(100))
        .to.emit(mockStreakMilestones, "MilestoneAchieved");
    });
  });

  

  describe("Statistics Integration", function () {
    it("Should update statistics when recording streaks", async function () {
      await expect(streakSystemManager.connect(user1).recordDailyLogin())
        .to.emit(mockStreakStats, "UserActivity");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow admin to pause system", async function () {
      await streakSystemManager.connect(owner).pause();
      expect(await streakSystemManager.paused()).to.be.true;
    });

    it("Should allow admin to unpause system", async function () {
      await streakSystemManager.connect(owner).pause();
      await streakSystemManager.connect(owner).unpause();
      expect(await streakSystemManager.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(streakSystemManager.connect(user1).pause())
        .to.be.reverted;
    });
  });

  describe("Integration Tests", function () {
    it("Should handle full user journey", async function () {
      // Record multiple streak types
      await streakSystemManager.connect(user1).recordDailyLogin();
      await streakSystemManager.connect(user1).recordQuestCompletion();
      
      // Check streaks were recorded
      expect(await streakSystemManager.getCurrentStreak(user1.address, StreakType.DAILY_LOGIN))
        .to.be.gt(0);
      
      // Claim rewards
      await streakSystemManager.connect(user1).claimReward(StreakType.DAILY_LOGIN, 1);
    });
  });
});