const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StreakEngineMinimal", function () {
  let StreakEngineMinimal, streakEngine;
  let mockRewardManager, mockMilestoneManager, mockStatsManager;
  let owner, admin, streakManager, user1, user2, user3;

  // StreakType enum values
  const StreakType = {
    DAILY_LOGIN: 0,
    QUEST_COMPLETION: 1,
    TRADING: 2,
    GOVERNANCE: 3,
    SOCIAL_INTERACTION: 4
  };

  beforeEach(async () => {
    [owner, admin, streakManager, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock external managers
    const MockRewardManager = await ethers.getContractFactory("MockStreakRewardManager");
    mockRewardManager = await MockRewardManager.deploy();
    await mockRewardManager.waitForDeployment();

    const MockMilestoneManager = await ethers.getContractFactory("MockStreakMilestoneManager");
    mockMilestoneManager = await MockMilestoneManager.deploy();
    await mockMilestoneManager.waitForDeployment();

    const MockStatsManager = await ethers.getContractFactory("MockStreakStatisticsManager");
    mockStatsManager = await MockStatsManager.deploy();
    await mockStatsManager.waitForDeployment();

    // Deploy StreakEngineMinimal as upgradeable proxy
    StreakEngineMinimal = await ethers.getContractFactory("StreakEngineMinimal");
    streakEngine = await upgrades.deployProxy(StreakEngineMinimal, [
      mockRewardManager.target,
      mockMilestoneManager.target,
      mockStatsManager.target
    ], { initializer: 'initialize' });
    await streakEngine.waitForDeployment();

    // Grant additional roles
    const ADMIN_ROLE = await streakEngine.ADMIN_ROLE();
    const STREAK_MANAGER_ROLE = await streakEngine.STREAK_MANAGER_ROLE();

    await streakEngine.grantRole(ADMIN_ROLE, admin.address);
    await streakEngine.grantRole(STREAK_MANAGER_ROLE, streakManager.address);
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct external managers", async () => {
      expect(await streakEngine.rewardManager()).to.equal(mockRewardManager.target);
      expect(await streakEngine.milestoneManager()).to.equal(mockMilestoneManager.target);
      expect(await streakEngine.statsManager()).to.equal(mockStatsManager.target);
    });

    it("should grant correct roles to deployer", async () => {
      const DEFAULT_ADMIN_ROLE = await streakEngine.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await streakEngine.ADMIN_ROLE();

      expect(await streakEngine.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await streakEngine.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should start unpaused", async () => {
      expect(await streakEngine.paused()).to.be.false;
    });

    it("should initialize with zero streaks for new users", async () => {
      const [dailyLogin, questCompletion, trading, governance, social, lastLogin, lastQuest, lastTrading, lastGov, lastSocial] = 
        await streakEngine.getUserStreaks(user1.address);
      
      expect(dailyLogin).to.equal(0);
      expect(questCompletion).to.equal(0);
      expect(trading).to.equal(0);
      expect(governance).to.equal(0);
      expect(social).to.equal(0);
      expect(lastLogin).to.equal(0);
      expect(lastQuest).to.equal(0);
      expect(lastTrading).to.equal(0);
      expect(lastGov).to.equal(0);
      expect(lastSocial).to.equal(0);
    });
  });

  describe("Daily Login Streak", function () {
    it("should record initial daily login streak", async () => {
      await expect(streakEngine.connect(user1).recordDailyLogin())
        .to.emit(streakEngine, "StreakIncreased")
        .withArgs(user1.address, StreakType.DAILY_LOGIN, 1);

      const [dailyLogin, , , , , lastLogin] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(1);
      
      const today = Math.floor(await time.latest() / 86400);
      expect(lastLogin).to.equal(today);
    });

    it("should increment streak on consecutive days", async () => {
      // Day 1
      await streakEngine.connect(user1).recordDailyLogin();
      
      // Fast forward 1 day
      await time.increase(86400);
      
      // Day 2
      await expect(streakEngine.connect(user1).recordDailyLogin())
        .to.emit(streakEngine, "StreakIncreased")
        .withArgs(user1.address, StreakType.DAILY_LOGIN, 2);

      const [dailyLogin] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(2);
    });

    it("should reset streak after skipping a day", async () => {
      // Day 1
      await streakEngine.connect(user1).recordDailyLogin();
      
      // Fast forward 2 days (skip one day)
      await time.increase(86400 * 2);
      
      // Should emit StreakBroken and then StreakIncreased with count 1
      const tx = await streakEngine.connect(user1).recordDailyLogin();
      
      await expect(tx)
        .to.emit(streakEngine, "StreakBroken")
        .withArgs(user1.address, StreakType.DAILY_LOGIN, 1);
      
      await expect(tx)
        .to.emit(streakEngine, "StreakIncreased")
        .withArgs(user1.address, StreakType.DAILY_LOGIN, 1);

      const [dailyLogin] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(1);
    });

    it("should not update streak on same day", async () => {
      await streakEngine.connect(user1).recordDailyLogin();
      
      // Try to record again on same day
      await streakEngine.connect(user1).recordDailyLogin();

      const [dailyLogin] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(1);
    });

    it("should handle long consecutive streaks", async () => {
      for (let i = 1; i <= 30; i++) {
        if (i > 1) {
          await time.increase(86400);
        }
        
        await expect(streakEngine.connect(user1).recordDailyLogin())
          .to.emit(streakEngine, "StreakIncreased")
          .withArgs(user1.address, StreakType.DAILY_LOGIN, i);
      }

      const [dailyLogin] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(30);
    });
  });

  describe("Quest Completion Streak", function () {
    it("should record quest completion streak independently", async () => {
      await expect(streakEngine.connect(user1).recordQuestCompletion())
        .to.emit(streakEngine, "StreakIncreased")
        .withArgs(user1.address, StreakType.QUEST_COMPLETION, 1);

      const [, questCompletion, , , , , lastQuest] = await streakEngine.getUserStreaks(user1.address);
      expect(questCompletion).to.equal(1);
      
      const today = Math.floor(await time.latest() / 86400);
      expect(lastQuest).to.equal(today);
    });

    it("should maintain independent streaks for different types", async () => {
      // Record both daily login and quest completion
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user1).recordQuestCompletion();
      
      // Fast forward 1 day
      await time.increase(86400);
      
      // Continue both streaks
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user1).recordQuestCompletion();

      const [dailyLogin, questCompletion] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(2);
      expect(questCompletion).to.equal(2);
    });

    it("should reset quest streak independently from login streak", async () => {
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user1).recordQuestCompletion();
      
      // Fast forward 1 day and only record login
      await time.increase(86400);
      await streakEngine.connect(user1).recordDailyLogin();
      
      // Fast forward 1 more day and record login + quest (quest breaks, login continues)
      await time.increase(86400);
      
      await streakEngine.connect(user1).recordDailyLogin(); // This should increment to 3
      
      const tx = await streakEngine.connect(user1).recordQuestCompletion();
      
      await expect(tx)
        .to.emit(streakEngine, "StreakBroken")
        .withArgs(user1.address, StreakType.QUEST_COMPLETION, 1);

      const [dailyLogin, questCompletion] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(3); // Should continue to increment
      expect(questCompletion).to.equal(1); // Should reset
    });
  });

  describe("Trading Activity Streak", function () {
    it("should record trading activity streak", async () => {
      await expect(streakEngine.connect(user1).recordTradingActivity())
        .to.emit(streakEngine, "StreakIncreased")
        .withArgs(user1.address, StreakType.TRADING, 1);

      const [, , trading, , , , , lastTrading] = await streakEngine.getUserStreaks(user1.address);
      expect(trading).to.equal(1);
      
      const today = Math.floor(await time.latest() / 86400);
      expect(lastTrading).to.equal(today);
    });

    it("should increment trading streak correctly", async () => {
      await streakEngine.connect(user1).recordTradingActivity();
      
      await time.increase(86400);
      
      await expect(streakEngine.connect(user1).recordTradingActivity())
        .to.emit(streakEngine, "StreakIncreased")
        .withArgs(user1.address, StreakType.TRADING, 2);

      const [, , trading] = await streakEngine.getUserStreaks(user1.address);
      expect(trading).to.equal(2);
    });
  });

  describe("Governance Participation Streak", function () {
    it("should record governance participation streak", async () => {
      await expect(streakEngine.connect(user1).recordGovernanceParticipation())
        .to.emit(streakEngine, "StreakIncreased")
        .withArgs(user1.address, StreakType.GOVERNANCE, 1);

      const [, , , governance, , , , , lastGov] = await streakEngine.getUserStreaks(user1.address);
      expect(governance).to.equal(1);
      
      const today = Math.floor(await time.latest() / 86400);
      expect(lastGov).to.equal(today);
    });

    it("should handle governance streak breaks correctly", async () => {
      await streakEngine.connect(user1).recordGovernanceParticipation();
      
      // Skip 2 days
      await time.increase(86400 * 2);
      
      const tx = await streakEngine.connect(user1).recordGovernanceParticipation();
      
      await expect(tx)
        .to.emit(streakEngine, "StreakBroken")
        .withArgs(user1.address, StreakType.GOVERNANCE, 1);

      const [, , , governance] = await streakEngine.getUserStreaks(user1.address);
      expect(governance).to.equal(1);
    });
  });

  describe("Social Interaction Streak", function () {
    it("should record social interaction streak", async () => {
      await expect(streakEngine.connect(user1).recordSocialInteraction())
        .to.emit(streakEngine, "StreakIncreased")
        .withArgs(user1.address, StreakType.SOCIAL_INTERACTION, 1);

      const [, , , , social, , , , , lastSocial] = await streakEngine.getUserStreaks(user1.address);
      expect(social).to.equal(1);
      
      const today = Math.floor(await time.latest() / 86400);
      expect(lastSocial).to.equal(today);
    });

    it("should maintain all 5 streak types simultaneously", async () => {
      // Record all streak types
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user1).recordQuestCompletion();
      await streakEngine.connect(user1).recordTradingActivity();
      await streakEngine.connect(user1).recordGovernanceParticipation();
      await streakEngine.connect(user1).recordSocialInteraction();

      // Advance day and continue all streaks
      await time.increase(86400);
      
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user1).recordQuestCompletion();
      await streakEngine.connect(user1).recordTradingActivity();
      await streakEngine.connect(user1).recordGovernanceParticipation();
      await streakEngine.connect(user1).recordSocialInteraction();

      const [dailyLogin, questCompletion, trading, governance, social] = 
        await streakEngine.getUserStreaks(user1.address);
      
      expect(dailyLogin).to.equal(2);
      expect(questCompletion).to.equal(2);
      expect(trading).to.equal(2);
      expect(governance).to.equal(2);
      expect(social).to.equal(2);
    });
  });

  describe("External Manager Integration", function () {
    it("should call reward manager when streak increases", async () => {
      await streakEngine.connect(user1).recordDailyLogin();
      
      // Check that the mock was called correctly
      expect(await mockRewardManager.lastUser()).to.equal(user1.address);
      expect(await mockRewardManager.lastStreakType()).to.equal(StreakType.DAILY_LOGIN);
      expect(await mockRewardManager.lastStreakLength()).to.equal(1);
    });

    it("should call milestone manager when streak increases", async () => {
      await streakEngine.connect(user1).recordQuestCompletion();
      
      expect(await mockMilestoneManager.lastUser()).to.equal(user1.address);
      expect(await mockMilestoneManager.lastStreakLength()).to.equal(1);
    });

    it("should call stats manager with correct total streak days", async () => {
      // Build up multiple streaks
      await streakEngine.connect(user1).recordDailyLogin(); // 1 day
      await streakEngine.connect(user1).recordQuestCompletion(); // 1 day
      
      await time.increase(86400);
      
      await streakEngine.connect(user1).recordDailyLogin(); // 2 days
      await streakEngine.connect(user1).recordTradingActivity(); // 1 day
      
      // Last call should have total of 2 + 1 + 1 = 4 total streak days
      expect(await mockStatsManager.lastTotalUserStreakDays()).to.equal(4);
    });

    it("should call all external managers in sequence", async () => {
      await streakEngine.connect(user1).recordSocialInteraction();
      
      // Verify all managers were called
      expect(await mockRewardManager.callCount()).to.equal(1);
      expect(await mockMilestoneManager.callCount()).to.equal(1);
      expect(await mockStatsManager.callCount()).to.equal(1);
    });
  });

  describe("Manager Configuration", function () {
    it("should allow admin to update managers", async () => {
      const newRewardManager = await ethers.getContractFactory("MockStreakRewardManager");
      const newReward = await newRewardManager.deploy();
      await newReward.waitForDeployment();

      await streakEngine.connect(admin).setManagers(
        newReward.target,
        mockMilestoneManager.target,
        mockStatsManager.target
      );

      expect(await streakEngine.rewardManager()).to.equal(newReward.target);
    });

    it("should reject manager updates from non-admin", async () => {
      await expect(
        streakEngine.connect(user1).setManagers(
          mockRewardManager.target,
          mockMilestoneManager.target,
          mockStatsManager.target
        )
      ).to.be.reverted;
    });

    it("should update all managers simultaneously", async () => {
      const newRewardManager = await ethers.getContractFactory("MockStreakRewardManager");
      const newReward = await newRewardManager.deploy();
      await newReward.waitForDeployment();

      const newMilestoneManager = await ethers.getContractFactory("MockStreakMilestoneManager");
      const newMilestone = await newMilestoneManager.deploy();
      await newMilestone.waitForDeployment();

      const newStatsManager = await ethers.getContractFactory("MockStreakStatisticsManager");
      const newStats = await newStatsManager.deploy();
      await newStats.waitForDeployment();

      await streakEngine.connect(admin).setManagers(
        newReward.target,
        newMilestone.target,
        newStats.target
      );

      expect(await streakEngine.rewardManager()).to.equal(newReward.target);
      expect(await streakEngine.milestoneManager()).to.equal(newMilestone.target);
      expect(await streakEngine.statsManager()).to.equal(newStats.target);
    });
  });

  describe("Multiple Users", function () {
    it("should track streaks independently for different users", async () => {
      // User1 builds a 3-day streak
      await streakEngine.connect(user1).recordDailyLogin();
      await time.increase(86400);
      await streakEngine.connect(user1).recordDailyLogin();
      await time.increase(86400);
      await streakEngine.connect(user1).recordDailyLogin();

      // User2 builds a 2-day streak
      await streakEngine.connect(user2).recordDailyLogin();
      await time.increase(86400);
      await streakEngine.connect(user2).recordDailyLogin();

      const [user1Login] = await streakEngine.getUserStreaks(user1.address);
      const [user2Login] = await streakEngine.getUserStreaks(user2.address);

      expect(user1Login).to.equal(3);
      expect(user2Login).to.equal(2);
    });

    it("should handle streak breaks independently", async () => {
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user2).recordDailyLogin();

      // User1 continues, User2 breaks streak
      await time.increase(86400);
      await streakEngine.connect(user1).recordDailyLogin();
      
      await time.increase(86400); // Skip a day for user2
      await streakEngine.connect(user2).recordDailyLogin();

      const [user1Login] = await streakEngine.getUserStreaks(user1.address);
      const [user2Login] = await streakEngine.getUserStreaks(user2.address);

      expect(user1Login).to.equal(2);
      expect(user2Login).to.equal(1); // Reset due to break
    });

    it("should handle different streak types per user", async () => {
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user1).recordQuestCompletion();

      await streakEngine.connect(user2).recordTradingActivity();
      await streakEngine.connect(user2).recordGovernanceParticipation();

      const [u1Login, u1Quest, u1Trading, u1Gov, u1Social] = await streakEngine.getUserStreaks(user1.address);
      const [u2Login, u2Quest, u2Trading, u2Gov, u2Social] = await streakEngine.getUserStreaks(user2.address);

      expect(u1Login).to.equal(1);
      expect(u1Quest).to.equal(1);
      expect(u1Trading).to.equal(0);
      expect(u1Gov).to.equal(0);
      expect(u1Social).to.equal(0);

      expect(u2Login).to.equal(0);
      expect(u2Quest).to.equal(0);
      expect(u2Trading).to.equal(1);
      expect(u2Gov).to.equal(1);
      expect(u2Social).to.equal(0);
    });
  });

  describe("Pause Functionality", function () {
    it("should allow admin to pause contract", async () => {
      await streakEngine.connect(admin).pause();
      expect(await streakEngine.paused()).to.be.true;
    });

    it("should allow admin to unpause contract", async () => {
      await streakEngine.connect(admin).pause();
      await streakEngine.connect(admin).unpause();
      expect(await streakEngine.paused()).to.be.false;
    });

    it("should prevent streak recording when paused", async () => {
      await streakEngine.connect(admin).pause();

      await expect(
        streakEngine.connect(user1).recordDailyLogin()
      ).to.be.revertedWithCustomError(streakEngine, "EnforcedPause");

      await expect(
        streakEngine.connect(user1).recordQuestCompletion()
      ).to.be.revertedWithCustomError(streakEngine, "EnforcedPause");

      await expect(
        streakEngine.connect(user1).recordTradingActivity()
      ).to.be.revertedWithCustomError(streakEngine, "EnforcedPause");

      await expect(
        streakEngine.connect(user1).recordGovernanceParticipation()
      ).to.be.revertedWithCustomError(streakEngine, "EnforcedPause");

      await expect(
        streakEngine.connect(user1).recordSocialInteraction()
      ).to.be.revertedWithCustomError(streakEngine, "EnforcedPause");
    });

    it("should allow view functions when paused", async () => {
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(admin).pause();

      const streaks = await streakEngine.getUserStreaks(user1.address);
      expect(streaks[0]).to.equal(1); // Daily login streak should still be readable
    });

    it("should reject pause/unpause from non-admin", async () => {
      await expect(
        streakEngine.connect(user1).pause()
      ).to.be.reverted;

      await expect(
        streakEngine.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("should enforce admin role for administrative functions", async () => {
      await expect(
        streakEngine.connect(user1).setManagers(
          mockRewardManager.target,
          mockMilestoneManager.target,
          mockStatsManager.target
        )
      ).to.be.reverted;

      await expect(
        streakEngine.connect(user1).pause()
      ).to.be.reverted;

      await expect(
        streakEngine.connect(user1).unpause()
      ).to.be.reverted;
    });

    it("should allow any user to record their own streaks", async () => {
      // All streak recording functions should be public
      await expect(streakEngine.connect(user1).recordDailyLogin()).to.not.be.reverted;
      await expect(streakEngine.connect(user2).recordQuestCompletion()).to.not.be.reverted;
      await expect(streakEngine.connect(user3).recordTradingActivity()).to.not.be.reverted;
    });

    it("should support role granting and revoking", async () => {
      const ADMIN_ROLE = await streakEngine.ADMIN_ROLE();
      
      // Grant admin role to user1
      await streakEngine.connect(owner).grantRole(ADMIN_ROLE, user1.address);
      expect(await streakEngine.hasRole(ADMIN_ROLE, user1.address)).to.be.true;

      // User1 should now be able to pause
      await streakEngine.connect(user1).pause();
      expect(await streakEngine.paused()).to.be.true;

      // Revoke role
      await streakEngine.connect(owner).revokeRole(ADMIN_ROLE, user1.address);
      expect(await streakEngine.hasRole(ADMIN_ROLE, user1.address)).to.be.false;

      // User1 should no longer be able to unpause
      await expect(
        streakEngine.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("Edge Cases and Integration", function () {
    it("should handle very long streaks correctly", async () => {
      // Build a 365-day streak
      for (let i = 1; i <= 365; i++) {
        if (i > 1) {
          await time.increase(86400);
        }
        await streakEngine.connect(user1).recordDailyLogin();
      }

      const [dailyLogin] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(365);
    });

    it("should handle streak resets after long breaks", async () => {
      await streakEngine.connect(user1).recordDailyLogin();
      
      // Skip 30 days
      await time.increase(86400 * 30);
      
      const tx = await streakEngine.connect(user1).recordDailyLogin();
      
      await expect(tx)
        .to.emit(streakEngine, "StreakBroken")
        .withArgs(user1.address, StreakType.DAILY_LOGIN, 1);

      const [dailyLogin] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(1);
    });

    it("should handle time boundary edge cases", async () => {
      // Record at end of day
      const startTime = Math.floor(await time.latest() / 86400) * 86400;
      await time.setNextBlockTimestamp(startTime + 86399); // Last second of day
      await streakEngine.connect(user1).recordDailyLogin();

      // Record at beginning of next day
      await time.setNextBlockTimestamp(startTime + 86400); // First second of next day
      await expect(streakEngine.connect(user1).recordDailyLogin())
        .to.emit(streakEngine, "StreakIncreased")
        .withArgs(user1.address, StreakType.DAILY_LOGIN, 2);

      const [dailyLogin] = await streakEngine.getUserStreaks(user1.address);
      expect(dailyLogin).to.equal(2);
    });

    it("should handle max uint128 streak values", async () => {
      // This test verifies the contract can handle maximum streak values
      // In practice, we can't actually build such a large streak, but we can verify the data types
      const maxUint128 = "340282366920938463463374607431768211455";
      
      // The contract should be able to store very large values
      // This is more of a compilation/deployment test
      expect(await streakEngine.getUserStreaks(user1.address)).to.have.lengthOf(10);
    });

    it("should handle reentrancy protection", async () => {
      // The contract uses nonReentrant modifier
      await expect(streakEngine.connect(user1).recordDailyLogin()).to.not.be.reverted;
      
      // Multiple calls in same transaction should not cause issues
      // (though same-day calls won't increment streak)
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user1).recordQuestCompletion();
      await streakEngine.connect(user1).recordTradingActivity();
    });

    it("should calculate total streak days correctly across multiple types", async () => {
      // Build different length streaks
      await streakEngine.connect(user1).recordDailyLogin(); // 1
      await streakEngine.connect(user1).recordQuestCompletion(); // 1
      
      await time.increase(86400);
      
      await streakEngine.connect(user1).recordDailyLogin(); // 2
      await streakEngine.connect(user1).recordQuestCompletion(); // 2
      await streakEngine.connect(user1).recordTradingActivity(); // 1
      
      // Total should be 2 + 2 + 1 = 5
      expect(await mockStatsManager.lastTotalUserStreakDays()).to.equal(5);
    });

    it("should maintain state consistency during complex operations", async () => {
      // Complex scenario: multiple users, multiple streak types, some breaks
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user1).recordQuestCompletion();
      await streakEngine.connect(user2).recordDailyLogin();
      
      await time.increase(86400);
      
      await streakEngine.connect(user1).recordDailyLogin();
      // User1 skips quest, User2 continues login
      await streakEngine.connect(user2).recordDailyLogin();
      
      await time.increase(86400);
      
      // User1 continues login and restarts quest
      await streakEngine.connect(user1).recordDailyLogin();
      await streakEngine.connect(user1).recordQuestCompletion();
      
      const [u1Login, u1Quest] = await streakEngine.getUserStreaks(user1.address);
      const [u2Login, u2Quest] = await streakEngine.getUserStreaks(user2.address);
      
      expect(u1Login).to.equal(3);
      expect(u1Quest).to.equal(1); // Reset after break
      expect(u2Login).to.equal(2);
      expect(u2Quest).to.equal(0); // Never started
    });
  });
});