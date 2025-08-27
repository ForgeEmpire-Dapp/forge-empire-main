const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("StreakStatisticsManager", function () {
  let StreakStatisticsManager, statsManager;
  let owner, admin, streakManager, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, user11;

  // StreakType enum values
  const StreakType = {
    DAILY_LOGIN: 0,
    QUEST_COMPLETION: 1,
    TRADING: 2,
    GOVERNANCE: 3,
    SOCIAL_INTERACTION: 4
  };

  beforeEach(async () => {
    [owner, admin, streakManager, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, user11] = await ethers.getSigners();

    // Deploy StreakStatisticsManager as upgradeable proxy
    StreakStatisticsManager = await ethers.getContractFactory("StreakStatisticsManager");
    statsManager = await upgrades.deployProxy(StreakStatisticsManager, [], { initializer: 'initialize' });
    await statsManager.waitForDeployment();

    // Grant roles
    const ADMIN_ROLE = await statsManager.ADMIN_ROLE();
    const STREAK_MANAGER_ROLE = await statsManager.STREAK_MANAGER_ROLE();

    await statsManager.grantRole(ADMIN_ROLE, admin.address);
    await statsManager.grantRole(STREAK_MANAGER_ROLE, streakManager.address);
  });

  describe("Deployment and Initialization", function () {
    it("should grant correct roles to deployer", async () => {
      const DEFAULT_ADMIN_ROLE = await statsManager.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await statsManager.ADMIN_ROLE();
      const STREAK_MANAGER_ROLE = await statsManager.STREAK_MANAGER_ROLE();

      expect(await statsManager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await statsManager.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await statsManager.hasRole(STREAK_MANAGER_ROLE, owner.address)).to.be.true;
    });

    it("should start unpaused", async () => {
      expect(await statsManager.paused()).to.be.false;
    });

    it("should initialize with zero global statistics", async () => {
      const stats = await statsManager.getGlobalStats();
      expect(stats._totalActiveStreakers).to.equal(0);
      expect(stats._longestGlobalStreak).to.equal(0);
      expect(stats._streakLeader).to.equal(ethers.ZeroAddress);
      expect(stats._dailyLoginCount).to.equal(0);
      expect(stats._questCompletionCount).to.equal(0);
      expect(stats._tradingCount).to.equal(0);
      expect(stats._governanceCount).to.equal(0);
      expect(stats._socialCount).to.equal(0);
    });

    it("should initialize with empty leaderboard", async () => {
      const [streakers, streakValues] = await statsManager.getLeaderboard();
      
      for (let i = 0; i < 10; i++) {
        expect(streakers[i]).to.equal(ethers.ZeroAddress);
        expect(streakValues[i]).to.equal(0);
      }
    });

    it("should return max rank for users not in leaderboard", async () => {
      expect(await statsManager.getUserRank(user1.address)).to.equal(ethers.MaxUint256);
    });
  });

  describe("Global Statistics Updates", function () {
    it("should update streak type counts correctly", async () => {
      await statsManager.connect(streakManager).updateGlobalStats(
        user1.address, 
        StreakType.DAILY_LOGIN, 
        5, 
        10
      );

      expect(await statsManager.getStreakTypeCount(StreakType.DAILY_LOGIN)).to.equal(1);
      
      const stats = await statsManager.getGlobalStats();
      expect(stats._dailyLoginCount).to.equal(1);
    });

    it("should track active streakers correctly", async () => {
      // User becomes active (total streak days > 0)
      await expect(
        statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 5, 10)
      ).to.emit(statsManager, "ActiveStreakersUpdated")
       .withArgs(1);

      expect(await statsManager.totalActiveStreakers()).to.equal(1);
      expect(await statsManager.isActiveStreaker(user1.address)).to.be.true;

      // Another user becomes active
      await expect(
        statsManager.connect(streakManager).updateGlobalStats(user2.address, StreakType.QUEST_COMPLETION, 3, 8)
      ).to.emit(statsManager, "ActiveStreakersUpdated")
       .withArgs(2);

      expect(await statsManager.totalActiveStreakers()).to.equal(2);
    });

    it("should update global streak leader correctly", async () => {
      // User1 sets initial record
      await expect(
        statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 5, 20)
      ).to.emit(statsManager, "NewStreakLeader")
       .withArgs(user1.address, 20);

      expect(await statsManager.longestGlobalStreak()).to.equal(20);
      expect(await statsManager.streakLeader()).to.equal(user1.address);

      // User2 breaks the record
      await expect(
        statsManager.connect(streakManager).updateGlobalStats(user2.address, StreakType.TRADING, 10, 35)
      ).to.emit(statsManager, "NewStreakLeader")
       .withArgs(user2.address, 35);

      expect(await statsManager.longestGlobalStreak()).to.equal(35);
      expect(await statsManager.streakLeader()).to.equal(user2.address);
    });

    it("should not change leader if streak is not higher", async () => {
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 5, 20);
      
      // User2 has lower total streak days
      await statsManager.connect(streakManager).updateGlobalStats(user2.address, StreakType.TRADING, 10, 15);

      expect(await statsManager.longestGlobalStreak()).to.equal(20);
      expect(await statsManager.streakLeader()).to.equal(user1.address);
    });

    it("should update user's longest individual streak", async () => {
      // Initial streak
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 5, 10);
      expect(await statsManager.userLongestStreak(user1.address)).to.equal(5);

      // Longer individual streak
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.TRADING, 8, 15);
      expect(await statsManager.userLongestStreak(user1.address)).to.equal(8);

      // Shorter streak shouldn't change longest
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.GOVERNANCE, 3, 18);
      expect(await statsManager.userLongestStreak(user1.address)).to.equal(8);
    });

    it("should handle user becoming inactive", async () => {
      // User becomes active
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 5, 10);
      expect(await statsManager.totalActiveStreakers()).to.equal(1);
      expect(await statsManager.isActiveStreaker(user1.address)).to.be.true;

      // User becomes inactive (total streak days = 0)
      await expect(
        statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 0, 0)
      ).to.emit(statsManager, "ActiveStreakersUpdated")
       .withArgs(0);

      expect(await statsManager.totalActiveStreakers()).to.equal(0);
      expect(await statsManager.isActiveStreaker(user1.address)).to.be.false;
    });

    it("should handle zero streak length appropriately", async () => {
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 0, 5);

      // Streak type count should not increment for zero length
      expect(await statsManager.getStreakTypeCount(StreakType.DAILY_LOGIN)).to.equal(0);
      
      // But user should still be active if total > 0
      expect(await statsManager.isActiveStreaker(user1.address)).to.be.true;
    });

    it("should emit GlobalStatsUpdated event", async () => {
      await expect(
        statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.SOCIAL_INTERACTION, 3, 8)
      ).to.emit(statsManager, "GlobalStatsUpdated")
       .withArgs(StreakType.SOCIAL_INTERACTION, 1);
    });
  });

  describe("Leaderboard Management", function () {
    beforeEach(async () => {
      // Set up some initial leaderboard data
      const users = [user1, user2, user3, user4, user5];
      const streakDays = [100, 80, 60, 40, 20];

      for (let i = 0; i < 5; i++) {
        await statsManager.connect(streakManager).updateGlobalStats(
          users[i].address, 
          StreakType.DAILY_LOGIN, 
          streakDays[i] / 2, 
          streakDays[i]
        );
      }
    });

    it("should maintain leaderboard in descending order", async () => {
      const [streakers, streakValues] = await statsManager.getLeaderboard();
      
      expect(streakers[0]).to.equal(user1.address);
      expect(streakValues[0]).to.equal(100);
      
      expect(streakers[1]).to.equal(user2.address);
      expect(streakValues[1]).to.equal(80);
      
      expect(streakers[4]).to.equal(user5.address);
      expect(streakValues[4]).to.equal(20);

      // Empty positions should be zero
      for (let i = 5; i < 10; i++) {
        expect(streakers[i]).to.equal(ethers.ZeroAddress);
        expect(streakValues[i]).to.equal(0);
      }
    });

    it("should insert new user into correct leaderboard position", async () => {
      // User6 achieves 70 streak days (should be position 2)
      await expect(
        statsManager.connect(streakManager).updateGlobalStats(user6.address, StreakType.TRADING, 35, 70)
      ).to.emit(statsManager, "LeaderboardUpdated")
       .withArgs(user6.address, 2, 70);

      const [streakers, streakValues] = await statsManager.getLeaderboard();
      
      expect(streakers[0]).to.equal(user1.address);  // 100
      expect(streakers[1]).to.equal(user2.address);  // 80
      expect(streakers[2]).to.equal(user6.address);  // 70
      expect(streakers[3]).to.equal(user3.address);  // 60
      expect(streakers[4]).to.equal(user4.address);  // 40
      expect(streakers[5]).to.equal(user5.address);  // 20
    });

    it("should update existing user's position in leaderboard", async () => {
      // User5 (currently at position 4 with 20) increases to 150
      await statsManager.connect(streakManager).updateGlobalStats(user5.address, StreakType.GOVERNANCE, 75, 150);

      const [streakers, streakValues] = await statsManager.getLeaderboard();
      
      expect(streakers[0]).to.equal(user5.address);  // 150 (moved to first)
      expect(streakers[1]).to.equal(user1.address);  // 100
      expect(streakers[2]).to.equal(user2.address);  // 80
      expect(streakers[3]).to.equal(user3.address);  // 60
      expect(streakers[4]).to.equal(user4.address);  // 40
    });

    it("should remove user from leaderboard when streak drops", async () => {
      // User1 (currently #1 with 100) drops to 5
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 2, 5);

      const [streakers, streakValues] = await statsManager.getLeaderboard();
      
      expect(streakers[0]).to.equal(user2.address);  // 80
      expect(streakers[1]).to.equal(user3.address);  // 60
      expect(streakers[2]).to.equal(user4.address);  // 40
      expect(streakers[3]).to.equal(user5.address);  // 20
      expect(streakers[4]).to.equal(user1.address);  // 5
    });

    it("should handle full leaderboard (10 users)", async () => {
      // Add 5 more users to fill the leaderboard
      const additionalUsers = [user6, user7, user8, user9, user10];
      const additionalStreaks = [90, 70, 50, 30, 10];

      for (let i = 0; i < 5; i++) {
        await statsManager.connect(streakManager).updateGlobalStats(
          additionalUsers[i].address, 
          StreakType.QUEST_COMPLETION, 
          additionalStreaks[i] / 2, 
          additionalStreaks[i]
        );
      }

      const [streakers, streakValues] = await statsManager.getLeaderboard();
      
      // Should be sorted: 100, 90, 80, 70, 60, 50, 40, 30, 20, 10
      expect(streakers[0]).to.equal(user1.address);   // 100
      expect(streakers[1]).to.equal(user6.address);   // 90
      expect(streakers[2]).to.equal(user2.address);   // 80
      expect(streakers[9]).to.equal(user10.address);  // 10

      // All positions should be filled
      for (let i = 0; i < 10; i++) {
        expect(streakers[i]).to.not.equal(ethers.ZeroAddress);
        expect(streakValues[i]).to.be.above(0);
      }
    });

    it("should bump users out of full leaderboard", async () => {
      // Fill leaderboard first
      const additionalUsers = [user6, user7, user8, user9, user10];
      const additionalStreaks = [90, 70, 50, 30, 10];

      for (let i = 0; i < 5; i++) {
        await statsManager.connect(streakManager).updateGlobalStats(
          additionalUsers[i].address, 
          StreakType.QUEST_COMPLETION, 
          additionalStreaks[i] / 2, 
          additionalStreaks[i]
        );
      }

      // User11 comes with 15 streak days (should bump out user10 with 10)
      await statsManager.connect(streakManager).updateGlobalStats(user11.address, StreakType.TRADING, 7, 15);

      const [streakers, streakValues] = await statsManager.getLeaderboard();
      
      expect(streakers[9]).to.equal(user11.address);  // 15
      expect(streakValues[9]).to.equal(15);
      
      // user10 should not be in leaderboard anymore
      for (let i = 0; i < 10; i++) {
        expect(streakers[i]).to.not.equal(user10.address);
      }
    });

    it("should return correct user ranks", async () => {
      expect(await statsManager.getUserRank(user1.address)).to.equal(0);  // 1st place
      expect(await statsManager.getUserRank(user2.address)).to.equal(1);  // 2nd place
      expect(await statsManager.getUserRank(user5.address)).to.equal(4);  // 5th place
      expect(await statsManager.getUserRank(user6.address)).to.equal(ethers.MaxUint256);  // Not in leaderboard
    });
  });

  describe("View Functions", function () {
    beforeEach(async () => {
      // Set up test data
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 10, 25);
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.QUEST_COMPLETION, 8, 33);
      await statsManager.connect(streakManager).updateGlobalStats(user2.address, StreakType.TRADING, 15, 45);
    });

    it("should return comprehensive global statistics", async () => {
      const stats = await statsManager.getGlobalStats();
      
      expect(stats._totalActiveStreakers).to.equal(2);
      expect(stats._longestGlobalStreak).to.equal(45);
      expect(stats._streakLeader).to.equal(user2.address);
      expect(stats._dailyLoginCount).to.equal(1);
      expect(stats._questCompletionCount).to.equal(1);
      expect(stats._tradingCount).to.equal(1);
      expect(stats._governanceCount).to.equal(0);
      expect(stats._socialCount).to.equal(0);
    });

    it("should return correct user statistics", async () => {
      const [totalDays, longestStreak, isActive] = await statsManager.getUserStats(user1.address);
      
      expect(totalDays).to.equal(33);  // Latest total
      expect(longestStreak).to.equal(10);  // Longest individual streak
      expect(isActive).to.be.true;
    });

    it("should return correct streak type counts", async () => {
      expect(await statsManager.getStreakTypeCount(StreakType.DAILY_LOGIN)).to.equal(1);
      expect(await statsManager.getStreakTypeCount(StreakType.QUEST_COMPLETION)).to.equal(1);
      expect(await statsManager.getStreakTypeCount(StreakType.TRADING)).to.equal(1);
      expect(await statsManager.getStreakTypeCount(StreakType.GOVERNANCE)).to.equal(0);
      expect(await statsManager.getStreakTypeCount(StreakType.SOCIAL_INTERACTION)).to.equal(0);
    });

    it("should handle queries for non-existent users", async () => {
      const [totalDays, longestStreak, isActive] = await statsManager.getUserStats(user3.address);
      
      expect(totalDays).to.equal(0);
      expect(longestStreak).to.equal(0);
      expect(isActive).to.be.false;
    });
  });

  describe("Administrative Functions", function () {
    beforeEach(async () => {
      // Set up some data to reset
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 10, 25);
      await statsManager.connect(streakManager).updateGlobalStats(user2.address, StreakType.TRADING, 15, 45);
    });

    it("should allow admin to reset global statistics", async () => {
      await statsManager.connect(admin).resetGlobalStats();
      
      const stats = await statsManager.getGlobalStats();
      expect(stats._totalActiveStreakers).to.equal(0);
      expect(stats._longestGlobalStreak).to.equal(0);
      expect(stats._streakLeader).to.equal(ethers.ZeroAddress);
      
      // All streak type counts should be reset
      for (let i = 0; i < 5; i++) {
        expect(await statsManager.getStreakTypeCount(i)).to.equal(0);
      }
      
      // Leaderboard should be cleared
      const [streakers, streakValues] = await statsManager.getLeaderboard();
      for (let i = 0; i < 10; i++) {
        expect(streakers[i]).to.equal(ethers.ZeroAddress);
        expect(streakValues[i]).to.equal(0);
      }
    });

    it("should reject reset from non-admin", async () => {
      await expect(
        statsManager.connect(user1).resetGlobalStats()
      ).to.be.reverted;
    });

    it("should not affect individual user data during reset", async () => {
      await statsManager.connect(admin).resetGlobalStats();
      
      // Individual user data should still exist
      expect(await statsManager.userTotalStreakDays(user1.address)).to.equal(25);
      expect(await statsManager.userLongestStreak(user1.address)).to.equal(10);
      expect(await statsManager.isActiveStreaker(user1.address)).to.be.true;
    });
  });

  describe("Pause Functionality", function () {
    it("should allow admin to pause contract", async () => {
      await statsManager.connect(admin).pause();
      expect(await statsManager.paused()).to.be.true;
    });

    it("should allow admin to unpause contract", async () => {
      await statsManager.connect(admin).pause();
      await statsManager.connect(admin).unpause();
      expect(await statsManager.paused()).to.be.false;
    });

    it("should prevent stats updates when paused", async () => {
      await statsManager.connect(admin).pause();

      await expect(
        statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 5, 10)
      ).to.be.revertedWithCustomError(statsManager, "EnforcedPause");
    });

    it("should allow view functions when paused", async () => {
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 5, 10);
      await statsManager.connect(admin).pause();

      const stats = await statsManager.getGlobalStats();
      expect(stats._totalActiveStreakers).to.equal(1);
      
      const [totalDays] = await statsManager.getUserStats(user1.address);
      expect(totalDays).to.equal(10);
    });

    it("should reject pause/unpause from non-admin", async () => {
      await expect(statsManager.connect(user1).pause()).to.be.reverted;
      await expect(statsManager.connect(user1).unpause()).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("should enforce streak manager role for stats updates", async () => {
      await expect(
        statsManager.connect(user1).updateGlobalStats(user2.address, StreakType.DAILY_LOGIN, 5, 10)
      ).to.be.reverted;
    });

    it("should enforce admin role for administrative functions", async () => {
      await expect(statsManager.connect(user1).resetGlobalStats()).to.be.reverted;
      await expect(statsManager.connect(user1).pause()).to.be.reverted;
      await expect(statsManager.connect(user1).unpause()).to.be.reverted;
    });

    it("should support role granting and revoking", async () => {
      const STREAK_MANAGER_ROLE = await statsManager.STREAK_MANAGER_ROLE();
      
      // Grant role to user1
      await statsManager.connect(owner).grantRole(STREAK_MANAGER_ROLE, user1.address);
      expect(await statsManager.hasRole(STREAK_MANAGER_ROLE, user1.address)).to.be.true;

      // User1 should now be able to update stats
      await statsManager.connect(user1).updateGlobalStats(user2.address, StreakType.DAILY_LOGIN, 5, 10);
      expect(await statsManager.totalActiveStreakers()).to.equal(1);

      // Revoke role
      await statsManager.connect(owner).revokeRole(STREAK_MANAGER_ROLE, user1.address);
      expect(await statsManager.hasRole(STREAK_MANAGER_ROLE, user1.address)).to.be.false;

      // User1 should no longer be able to update stats
      await expect(
        statsManager.connect(user1).updateGlobalStats(user3.address, StreakType.TRADING, 3, 8)
      ).to.be.reverted;
    });
  });

  describe("Edge Cases and Integration", function () {
    it("should handle maximum leaderboard position updates", async () => {
      // Fill leaderboard with 10 users
      const users = [user1, user2, user3, user4, user5, user6, user7, user8, user9, user10];
      
      for (let i = 0; i < 10; i++) {
        await statsManager.connect(streakManager).updateGlobalStats(
          users[i].address, 
          StreakType.DAILY_LOGIN, 
          10 - i, 
          (10 - i) * 10
        );
      }

      // Update user at last position to first
      await statsManager.connect(streakManager).updateGlobalStats(user10.address, StreakType.TRADING, 50, 1000);

      const [streakers, streakValues] = await statsManager.getLeaderboard();
      expect(streakers[0]).to.equal(user10.address);
      expect(streakValues[0]).to.equal(1000);
    });

    it("should handle very large streak values", async () => {
      const largeStreak = ethers.parseEther("1000000"); // Very large number
      
      await statsManager.connect(streakManager).updateGlobalStats(
        user1.address, 
        StreakType.DAILY_LOGIN, 
        largeStreak, 
        largeStreak
      );

      expect(await statsManager.longestGlobalStreak()).to.equal(largeStreak);
      expect(await statsManager.userLongestStreak(user1.address)).to.equal(largeStreak);
    });

    it("should handle multiple simultaneous updates correctly", async () => {
      // Simulate multiple users getting updates in same block
      const users = [user1, user2, user3, user4, user5];
      const streakDays = [50, 40, 60, 30, 45];

      for (let i = 0; i < 5; i++) {
        await statsManager.connect(streakManager).updateGlobalStats(
          users[i].address, 
          StreakType[Object.keys(StreakType)[i % 5]], 
          Math.floor(streakDays[i] / 2), 
          streakDays[i]
        );
      }

      // Verify final state
      expect(await statsManager.totalActiveStreakers()).to.equal(5);
      expect(await statsManager.longestGlobalStreak()).to.equal(60);
      expect(await statsManager.streakLeader()).to.equal(user3.address);
      
      const [streakers, streakValues] = await statsManager.getLeaderboard();
      expect(streakers[0]).to.equal(user3.address);  // 60
      expect(streakers[1]).to.equal(user1.address);  // 50
      expect(streakers[2]).to.equal(user5.address);  // 45
    });

    it("should handle active streakers counter edge cases", async () => {
      // User becomes active
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 5, 10);
      expect(await statsManager.totalActiveStreakers()).to.equal(1);

      // Same user gets another update (shouldn't increase counter)
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.TRADING, 3, 13);
      expect(await statsManager.totalActiveStreakers()).to.equal(1);

      // User becomes inactive, then active again
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 0, 0);
      expect(await statsManager.totalActiveStreakers()).to.equal(0);

      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.QUEST_COMPLETION, 2, 5);
      expect(await statsManager.totalActiveStreakers()).to.equal(1);
    });

    it("should maintain consistency during complex leaderboard operations", async () => {
      // Create complex scenario: users moving up and down leaderboard
      const operations = [
        [user1.address, 100],
        [user2.address, 200],
        [user3.address, 150],
        [user1.address, 300], // user1 moves to top
        [user2.address, 50],  // user2 drops
        [user4.address, 250], // new user enters
        [user3.address, 400], // user3 takes lead
      ];

      for (const [user, streakDays] of operations) {
        await statsManager.connect(streakManager).updateGlobalStats(
          user, 
          StreakType.DAILY_LOGIN, 
          Math.floor(streakDays / 2), 
          streakDays
        );
      }

      // Verify final leaderboard state
      const [streakers, streakValues] = await statsManager.getLeaderboard();
      expect(streakers[0]).to.equal(user3.address);  // 400
      expect(streakers[1]).to.equal(user1.address);  // 300
      expect(streakers[2]).to.equal(user4.address);  // 250
      expect(streakers[3]).to.equal(user2.address);  // 50

      // Verify global leader
      expect(await statsManager.streakLeader()).to.equal(user3.address);
      expect(await statsManager.longestGlobalStreak()).to.equal(400);
    });

    it("should handle underflow protection for active streakers counter", async () => {
      // Try to make user inactive when counter is already 0
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 0, 0);
      expect(await statsManager.totalActiveStreakers()).to.equal(0);

      // Should not underflow
      await statsManager.connect(streakManager).updateGlobalStats(user1.address, StreakType.DAILY_LOGIN, 0, 0);
      expect(await statsManager.totalActiveStreakers()).to.equal(0);
    });
  });
});