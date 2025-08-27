const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StreakStats", function () {
  let StreakStats, streakStats;
  let mockStreakCore;
  let owner, admin, statsManager, user1, user2, user3, user4, user5;

  // StreakType enum values
  const StreakType = {
    DAILY_LOGIN: 0,
    QUEST_COMPLETION: 1,
    TRADING: 2,
    GOVERNANCE: 3,
    SOCIAL_INTERACTION: 4
  };

  beforeEach(async () => {
    [owner, admin, statsManager, user1, user2, user3, user4, user5] = await ethers.getSigners();

    // Deploy mock StreakCore
    const MockStreakCore = await ethers.getContractFactory("MockStreakCore");
    mockStreakCore = await MockStreakCore.deploy();
    await mockStreakCore.waitForDeployment();

    // Deploy StreakStats as upgradeable proxy
    StreakStats = await ethers.getContractFactory("StreakStats");
    streakStats = await upgrades.deployProxy(StreakStats, [mockStreakCore.target], { initializer: 'initialize' });
    await streakStats.waitForDeployment();

    // Grant roles
    const STATS_MANAGER_ROLE = await streakStats.STATS_MANAGER_ROLE();
    await streakStats.grantRole(STATS_MANAGER_ROLE, statsManager.address);
    await streakStats.grantRole(STATS_MANAGER_ROLE, admin.address);
  });

  

  describe("Deployment and Initialization", function () {
    it("should initialize with correct StreakCore address", async () => {
      expect(await streakStats.streakCore()).to.equal(mockStreakCore.target);
    });

    it("should grant correct roles to deployer", async () => {
      const DEFAULT_ADMIN_ROLE = await streakStats.DEFAULT_ADMIN_ROLE();
      const STATS_MANAGER_ROLE = await streakStats.STATS_MANAGER_ROLE();

      expect(await streakStats.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await streakStats.hasRole(STATS_MANAGER_ROLE, owner.address)).to.be.true;
    });

    it("should start unpaused", async () => {
      expect(await streakStats.paused()).to.be.false;
    });

    it("should initialize with zero global statistics", async () => {
      const [totalActiveStreakers, longestGlobalStreak, streakLeader, totalStreakDays] = 
        await streakStats.getGlobalStats();
      
      expect(totalActiveStreakers).to.equal(0);
      expect(longestGlobalStreak).to.equal(0);
      expect(streakLeader).to.equal(ethers.ZeroAddress);
      expect(totalStreakDays).to.equal(0);
    });

    it("should initialize with empty leaderboards", async () => {
      for (let i = 0; i < 5; i++) {
        const [users, streaks] = await streakStats.getLeaderboard(i, 10);
        expect(users).to.have.lengthOf(0);
        expect(streaks).to.have.lengthOf(0);
      }
    });

    it("should initialize with zero streak type leaders", async () => {
      const [leaders, streaks] = await streakStats.getStreakTypeLeaders();
      
      for (let i = 0; i < 5; i++) {
        expect(leaders[i]).to.equal(ethers.ZeroAddress);
        expect(streaks[i]).to.equal(0);
      }
    });
  });

  describe("User Activity Updates", function () {
    beforeEach(async () => {
      // Set up mock StreakCore to return specific streak values
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 5);
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.QUEST_COMPLETION, 3);
    });

    it("should update user activity correctly", async () => {
      await expect(
        streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5)
      ).to.emit(streakStats, "UserActivityUpdated")
       .withArgs(user1.address, 1, true); // Bitmask 1 = 2^0 for DAILY_LOGIN

      expect(await streakStats.isActiveStreaker(user1.address)).to.be.true;
      expect(await streakStats.activeStreakTypes(user1.address)).to.equal(1);
    });

    it("should update global active streaker count", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      
      const [totalActiveStreakers] = await streakStats.getGlobalStats();
      expect(totalActiveStreakers).to.equal(1);
    });

    it("should handle multiple streak types for same user", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.QUEST_COMPLETION, 3);
      
      // Bitmask should be 3 (1 + 2 = binary 11)
      expect(await streakStats.activeStreakTypes(user1.address)).to.equal(3);
      
      // Should still be only 1 active streaker
      const [totalActiveStreakers] = await streakStats.getGlobalStats();
      expect(totalActiveStreakers).to.equal(1);
    });

    it("should handle streak loss correctly", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.QUEST_COMPLETION, 3);
      
      // User loses DAILY_LOGIN streak
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 0);
      
      // Bitmask should be 2 (only QUEST_COMPLETION active)
      expect(await streakStats.activeStreakTypes(user1.address)).to.equal(2);
      expect(await streakStats.isActiveStreaker(user1.address)).to.be.true;
    });

    it("should handle complete streak loss", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      
      // User loses all streaks
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 0);
      
      expect(await streakStats.activeStreakTypes(user1.address)).to.equal(0);
      expect(await streakStats.isActiveStreaker(user1.address)).to.be.false;
      
      const [totalActiveStreakers] = await streakStats.getGlobalStats();
      expect(totalActiveStreakers).to.equal(0);
    });

    it("should track activity timestamp", async () => {
      const tx = await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      const block = await ethers.provider.getBlock(tx.blockNumber);
      
      expect(await streakStats.lastActivityTimestamp(user1.address)).to.equal(block.timestamp);
    });

    it("should emit ActiveStreakTypesChanged event", async () => {
      await expect(
        streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5)
      ).to.emit(streakStats, "ActiveStreakTypesChanged")
       .withArgs(user1.address, 0, 1);
    });

    it("should reject invalid streak types", async () => {
      // Should not revert but should not update anything
      await streakStats.connect(statsManager).updateUserActivity(user1.address, 5, 5);
      
      expect(await streakStats.isActiveStreaker(user1.address)).to.be.false;
      expect(await streakStats.activeStreakTypes(user1.address)).to.equal(0);
    });

    it("should enforce stats manager role", async () => {
      await expect(
        streakStats.connect(user1).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 5)
      ).to.be.reverted;
    });

    it("should handle multiple users independently", async () => {
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.TRADING, 10);
      
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.TRADING, 10);
      
      expect(await streakStats.activeStreakTypes(user1.address)).to.equal(1); // DAILY_LOGIN
      expect(await streakStats.activeStreakTypes(user2.address)).to.equal(4); // TRADING (2^2)
      
      const [totalActiveStreakers] = await streakStats.getGlobalStats();
      expect(totalActiveStreakers).to.equal(2);
    });
  });

  describe("Leaderboard Management", function () {
    beforeEach(async () => {
      // Set up mock streaks for testing
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 100);
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.DAILY_LOGIN, 80);
      await mockStreakCore.setCurrentStreak(user3.address, StreakType.DAILY_LOGIN, 60);
      await mockStreakCore.setCurrentStreak(user4.address, StreakType.DAILY_LOGIN, 40);
      await mockStreakCore.setCurrentStreak(user5.address, StreakType.DAILY_LOGIN, 20);
    });

    it("should build leaderboard correctly", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 100);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 80);
      await streakStats.connect(statsManager).updateUserActivity(user3.address, StreakType.DAILY_LOGIN, 60);
      
      const [users, streaks] = await streakStats.getLeaderboard(StreakType.DAILY_LOGIN, 10);
      
      expect(users).to.have.lengthOf(3);
      expect(users[0]).to.equal(user1.address);
      expect(streaks[0]).to.equal(100);
      expect(users[1]).to.equal(user2.address);
      expect(streaks[1]).to.equal(80);
    });

    it("should return correct leaderboard positions", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 100);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 80);
      await streakStats.connect(statsManager).updateUserActivity(user3.address, StreakType.DAILY_LOGIN, 60);
      
      expect(await streakStats.getUserLeaderboardPosition(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
      expect(await streakStats.getUserLeaderboardPosition(user2.address, StreakType.DAILY_LOGIN)).to.equal(2);
      expect(await streakStats.getUserLeaderboardPosition(user3.address, StreakType.DAILY_LOGIN)).to.equal(3);
      expect(await streakStats.getUserLeaderboardPosition(user4.address, StreakType.DAILY_LOGIN)).to.equal(0);
    });

    it("should emit NewStreakLeader event for first place", async () => {
      await expect(
        streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 100)
      ).to.emit(streakStats, "NewStreakLeader")
       .withArgs(user1.address, StreakType.DAILY_LOGIN, 100);
    });

    it("should emit LeaderboardUpdated event", async () => {
      await expect(
        streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 100)
      ).to.emit(streakStats, "LeaderboardUpdated")
       .withArgs(StreakType.DAILY_LOGIN, user1.address, 1);
    });

    it("should handle leaderboard reordering when user improves", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 100);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 80);
      await streakStats.connect(statsManager).updateUserActivity(user3.address, StreakType.DAILY_LOGIN, 60);
      
      // User3 improves to 120
      await mockStreakCore.setCurrentStreak(user3.address, StreakType.DAILY_LOGIN, 120);
      await streakStats.connect(statsManager).updateUserActivity(user3.address, StreakType.DAILY_LOGIN, 120);
      
      const [users, streaks] = await streakStats.getLeaderboard(StreakType.DAILY_LOGIN, 10);
      
      expect(users[0]).to.equal(user3.address);
      expect(streaks[0]).to.equal(120);
      expect(users[1]).to.equal(user1.address);
      expect(streaks[1]).to.equal(100);
    });

    it("should remove user from leaderboard when streak becomes 0", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 100);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 80);
      
      // User1 loses streak
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 0);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 0);
      
      const [users, streaks] = await streakStats.getLeaderboard(StreakType.DAILY_LOGIN, 10);
      
      expect(users).to.have.lengthOf(1);
      expect(users[0]).to.equal(user2.address);
      expect(streaks[0]).to.equal(80);
      
      expect(await streakStats.getUserLeaderboardPosition(user1.address, StreakType.DAILY_LOGIN)).to.equal(0);
    });

    it("should handle leaderboard size limits", async () => {
      // In a real scenario with 100+ users, this would test the LEADERBOARD_SIZE limit
      // For now, we test with our available users
      const allUsers = [user1, user2, user3, user4, user5];
      const streaks = [100, 80, 60, 40, 20];
      
      for (let i = 0; i < allUsers.length; i++) {
        await streakStats.connect(statsManager).updateUserActivity(allUsers[i].address, StreakType.DAILY_LOGIN, streaks[i]);
      }
      
      const [users, returnedStreaks] = await streakStats.getLeaderboard(StreakType.DAILY_LOGIN, 10);
      
      expect(users).to.have.lengthOf(5);
      expect(users[0]).to.equal(user1.address);
      expect(returnedStreaks[0]).to.equal(100);
    });

    it("should handle different streak types independently", async () => {
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.QUEST_COMPLETION, 50);
      
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 100);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.QUEST_COMPLETION, 50);
      
      const [dailyUsers] = await streakStats.getLeaderboard(StreakType.DAILY_LOGIN, 10);
      const [questUsers] = await streakStats.getLeaderboard(StreakType.QUEST_COMPLETION, 10);
      
      expect(dailyUsers[0]).to.equal(user1.address);
      expect(questUsers[0]).to.equal(user1.address);
      
      expect(await streakStats.getUserLeaderboardPosition(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
      expect(await streakStats.getUserLeaderboardPosition(user1.address, StreakType.QUEST_COMPLETION)).to.equal(1);
    });

    it("should reject invalid streak types in leaderboard queries", async () => {
      const [users, streaks] = await streakStats.getLeaderboard(10, 10);
      expect(users).to.have.lengthOf(0);
      expect(streaks).to.have.lengthOf(0);
      
      expect(await streakStats.getUserLeaderboardPosition(user1.address, 10)).to.equal(0);
    });
  });

  describe("Global Statistics and Records", function () {
    beforeEach(async () => {
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 50);
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.QUEST_COMPLETION, 30);
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.TRADING, 40);
    });

    it("should track global streak leaders by type", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 50);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.TRADING, 40);
      
      const [leaders, streaks] = await streakStats.getStreakTypeLeaders();
      
      expect(leaders[StreakType.DAILY_LOGIN]).to.equal(user1.address);
      expect(streaks[StreakType.DAILY_LOGIN]).to.equal(50);
      expect(leaders[StreakType.TRADING]).to.equal(user2.address);
      expect(streaks[StreakType.TRADING]).to.equal(40);
    });

    it("should update global streak leader based on total streaks", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 50);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.QUEST_COMPLETION, 30);
      
      // User1 total: 50 + 30 = 80
      const [, longestGlobalStreak, streakLeader] = await streakStats.getGlobalStats();
      
      expect(longestGlobalStreak).to.equal(80);
      expect(streakLeader).to.equal(user1.address);
    });

    it("should emit GlobalStatsUpdated when new global leader is found", async () => {
      // Reset streaks for user1 and user2 to ensure a clean state for this test
      await mockStreakCore.connect(statsManager).setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 0);
      await mockStreakCore.connect(statsManager).setCurrentStreak(user1.address, StreakType.QUEST_COMPLETION, 0);
      await mockStreakCore.connect(statsManager).setCurrentStreak(user2.address, StreakType.DAILY_LOGIN, 0);
      await mockStreakCore.connect(statsManager).setCurrentStreak(user2.address, StreakType.TRADING, 0);

      // User1 sets an initial streak
      await mockStreakCore.connect(statsManager).setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 50);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 50);

      // User2 surpasses user1, becoming the new global leader
      await mockStreakCore.connect(statsManager).setCurrentStreak(user2.address, StreakType.DAILY_LOGIN, 100);
      await expect(
        streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 100)
      ).to.emit(streakStats, "GlobalStatsUpdated")
       .withArgs(2, 100, user2.address); // Expecting 2 active streakers, 100 longest streak, user2 as leader
    });

    it("should update global streak leader when someone surpasses current leader", async () => {
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.TRADING, 0); // Reset from beforeEach
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.DAILY_LOGIN, 60);
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.QUEST_COMPLETION, 40);
      
      // User1 becomes leader with 80 total
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 50);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.QUEST_COMPLETION, 30);
      
      // User2 surpasses with 100 total
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 60);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.QUEST_COMPLETION, 40);
      
      const [, longestGlobalStreak, streakLeader] = await streakStats.getGlobalStats();
      
      expect(longestGlobalStreak).to.equal(100);
      expect(streakLeader).to.equal(user2.address);
    });

    it("should track global streak counts correctly", async () => {
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 50);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 30);
      
      // Both users have daily login streaks, so count should increment
      expect(await streakStats.globalStreakCounts(StreakType.DAILY_LOGIN)).to.be.above(0);
    });
  });

  describe("Daily Statistics Tracking", function () {
    it("should track daily statistics correctly", async () => {
      const currentTime = await time.latest();
      const currentDay = Math.floor(currentTime / (24 * 60 * 60));
      
      await expect(
        streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5)
      ).to.emit(streakStats, "DailyStatsRecorded");
      
      const [activeUsers, totalActivities, newStreakers] = await streakStats.getDailyStats(currentDay);
      
      expect(activeUsers).to.equal(1);
      expect(totalActivities).to.equal(1);
      expect(newStreakers).to.equal(1);
    });

    it("should not double-count active users on same day", async () => {
      const currentTime = await time.latest();
      const currentDay = Math.floor(currentTime / (24 * 60 * 60));
      
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.QUEST_COMPLETION, 3);
      
      const [activeUsers, totalActivities, newStreakers] = await streakStats.getDailyStats(currentDay);
      
      expect(activeUsers).to.equal(1); // Should still be 1
      expect(totalActivities).to.equal(2); // But activities should be 2
      expect(newStreakers).to.equal(1); // Still just 1 new streaker
    });

    it("should track multiple users on same day", async () => {
      const currentTime = await time.latest();
      const currentDay = Math.floor(currentTime / (24 * 60 * 60));
      
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.QUEST_COMPLETION, 3);
      
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.QUEST_COMPLETION, 3);
      
      const [activeUsers, totalActivities, newStreakers] = await streakStats.getDailyStats(currentDay);
      
      expect(activeUsers).to.equal(2);
      expect(totalActivities).to.equal(2);
      expect(newStreakers).to.equal(2);
    });

    it("should handle users across different days", async () => {
      const currentTime = await time.latest();
      const currentDay = Math.floor(currentTime / (24 * 60 * 60));
      
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      
      // Advance to next day
      await time.increase(24 * 60 * 60);
      
      const nextDay = currentDay + 1;
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 6);
      
      // Check both days
      const [activeUsers1] = await streakStats.getDailyStats(currentDay);
      const [activeUsers2] = await streakStats.getDailyStats(nextDay);
      
      expect(activeUsers1).to.equal(1);
      expect(activeUsers2).to.equal(1);
    });

    it("should return zero stats for unused days", async () => {
      const futureDay = Math.floor(await time.latest() / (24 * 60 * 60)) + 100;
      
      const [activeUsers, totalActivities, newStreakers] = await streakStats.getDailyStats(futureDay);
      
      expect(activeUsers).to.equal(0);
      expect(totalActivities).to.equal(0);
      expect(newStreakers).to.equal(0);
    });
  });

  describe("User Achievement Recording", function () {
    it("should record achievements correctly", async () => {
      await streakStats.connect(statsManager).recordAchievement(user1.address, 100, 2);
      
      const [totalAchievements, totalXPEarned, totalBadgesEarned, activeStreakTypes] = 
        await streakStats.getUserStats(user1.address);
      
      expect(totalAchievements).to.equal(1);
      expect(totalXPEarned).to.equal(100);
      expect(totalBadgesEarned).to.equal(2);
    });

    it("should accumulate achievements over time", async () => {
      await streakStats.connect(statsManager).recordAchievement(user1.address, 100, 2);
      await streakStats.connect(statsManager).recordAchievement(user1.address, 50, 1);
      
      const [totalAchievements, totalXPEarned, totalBadgesEarned] = 
        await streakStats.getUserStats(user1.address);
      
      expect(totalAchievements).to.equal(2);
      expect(totalXPEarned).to.equal(150);
      expect(totalBadgesEarned).to.equal(3);
    });

    it("should handle zero rewards", async () => {
      await streakStats.connect(statsManager).recordAchievement(user1.address, 0, 0);
      
      const [totalAchievements, totalXPEarned, totalBadgesEarned] = 
        await streakStats.getUserStats(user1.address);
      
      expect(totalAchievements).to.equal(1);
      expect(totalXPEarned).to.equal(0);
      expect(totalBadgesEarned).to.equal(0);
    });

    it("should track achievements independently for different users", async () => {
      await streakStats.connect(statsManager).recordAchievement(user1.address, 100, 2);
      await streakStats.connect(statsManager).recordAchievement(user2.address, 50, 1);
      
      const [u1Achievements, u1XP, u1Badges] = await streakStats.getUserStats(user1.address);
      const [u2Achievements, u2XP, u2Badges] = await streakStats.getUserStats(user2.address);
      
      expect(u1Achievements).to.equal(1);
      expect(u1XP).to.equal(100);
      expect(u1Badges).to.equal(2);
      
      expect(u2Achievements).to.equal(1);
      expect(u2XP).to.equal(50);
      expect(u2Badges).to.equal(1);
    });

    it("should enforce stats manager role for recording achievements", async () => {
      await expect(
        streakStats.connect(user1).recordAchievement(user2.address, 100, 2)
      ).to.be.reverted;
    });
  });

  describe("Inactive Streaker Cleanup", function () {
    it("should clean up inactive streakers", async () => {
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 5);
      
      // Make user active
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      
      expect(await streakStats.isActiveStreaker(user1.address)).to.be.true;
      
      // Advance time beyond inactive threshold (7 days)
      await time.increase(8 * 24 * 60 * 60);
      
      // Cleanup inactive streakers
      await streakStats.connect(owner).cleanupInactiveStreakers([user1.address]);
      
      expect(await streakStats.isActiveStreaker(user1.address)).to.be.false;
      expect(await streakStats.activeStreakTypes(user1.address)).to.equal(0);
    });

    it("should emit UserActivityUpdated event during cleanup", async () => {
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      
      await time.increase(8 * 24 * 60 * 60);
      
      await expect(
        streakStats.connect(owner).cleanupInactiveStreakers([user1.address])
      ).to.emit(streakStats, "UserActivityUpdated")
       .withArgs(user1.address, 0, false);
    });

    it("should not clean up recently active streakers", async () => {
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      
      // Advance time but not beyond threshold
      await time.increase(5 * 24 * 60 * 60);
      
      await streakStats.connect(owner).cleanupInactiveStreakers([user1.address]);
      
      expect(await streakStats.isActiveStreaker(user1.address)).to.be.true;
    });

    it("should handle cleanup of non-active users gracefully", async () => {
      // Try to cleanup user who was never active
      await streakStats.connect(owner).cleanupInactiveStreakers([user1.address]);
      
      expect(await streakStats.isActiveStreaker(user1.address)).to.be.false;
    });

    it("should clean up multiple users at once", async () => {
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 5);
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.QUEST_COMPLETION, 3);
      
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.QUEST_COMPLETION, 3);
      
      await time.increase(8 * 24 * 60 * 60);
      
      await streakStats.connect(owner).cleanupInactiveStreakers([user1.address, user2.address]);
      
      expect(await streakStats.isActiveStreaker(user1.address)).to.be.false;
      expect(await streakStats.isActiveStreaker(user2.address)).to.be.false;
    });

    it("should enforce admin role for cleanup", async () => {
      await expect(
        streakStats.connect(user1).cleanupInactiveStreakers([user2.address])
      ).to.be.reverted;
    });

    it("should update global active streaker count during cleanup", async () => {
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      
      let [totalActiveStreakers] = await streakStats.getGlobalStats();
      expect(totalActiveStreakers).to.equal(1);
      
      await time.increase(8 * 24 * 60 * 60);
      await streakStats.connect(owner).cleanupInactiveStreakers([user1.address]);
      
      [totalActiveStreakers] = await streakStats.getGlobalStats();
      expect(totalActiveStreakers).to.equal(0);
    });
  });

  describe("Pause Functionality", function () {
    it("should allow admin to pause contract", async () => {
      await streakStats.connect(owner).pause();
      expect(await streakStats.paused()).to.be.true;
    });

    it("should allow admin to unpause contract", async () => {
      await streakStats.connect(owner).pause();
      await streakStats.connect(owner).unpause();
      expect(await streakStats.paused()).to.be.false;
    });

    it("should prevent user activity updates when paused", async () => {
      await streakStats.connect(owner).pause();

      await expect(
        streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5)
      ).to.be.revertedWithCustomError(streakStats, "EnforcedPause");
    });

    it("should allow view functions when paused", async () => {
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      
      await streakStats.connect(owner).pause();

      const [totalActiveStreakers] = await streakStats.getGlobalStats();
      expect(totalActiveStreakers).to.equal(1);
      
      const [users] = await streakStats.getLeaderboard(StreakType.DAILY_LOGIN, 10);
      expect(users[0]).to.equal(user1.address);
    });

    it("should reject pause/unpause from non-admin", async () => {
      await expect(streakStats.connect(user1).pause()).to.be.reverted;
      await expect(streakStats.connect(user1).unpause()).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("should enforce stats manager role for protected functions", async () => {
      await expect(
        streakStats.connect(user1).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 5)
      ).to.be.reverted;

      await expect(
        streakStats.connect(user1).recordAchievement(user2.address, 100, 2)
      ).to.be.reverted;
    });

    it("should enforce admin role for administrative functions", async () => {
      await expect(
        streakStats.connect(user1).cleanupInactiveStreakers([user2.address])
      ).to.be.reverted;

      await expect(streakStats.connect(user1).pause()).to.be.reverted;
      await expect(streakStats.connect(user1).unpause()).to.be.reverted;
    });

    it("should support role granting and revoking", async () => {
      const STATS_MANAGER_ROLE = await streakStats.STATS_MANAGER_ROLE();
      
      // Grant role to user1
      await streakStats.connect(owner).grantRole(STATS_MANAGER_ROLE, user1.address);
      expect(await streakStats.hasRole(STATS_MANAGER_ROLE, user1.address)).to.be.true;

      // User1 should now be able to update stats
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.DAILY_LOGIN, 5);
      await streakStats.connect(user1).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 5);
      expect(await streakStats.isActiveStreaker(user2.address)).to.be.true;

      // Revoke role
      await streakStats.connect(owner).revokeRole(STATS_MANAGER_ROLE, user1.address);
      expect(await streakStats.hasRole(STATS_MANAGER_ROLE, user1.address)).to.be.false;

      // User1 should no longer be able to update stats
      await expect(
        streakStats.connect(user1).recordAchievement(user3.address, 100, 2)
      ).to.be.reverted;
    });
  });

  describe("Edge Cases and Integration", function () {
    it("should handle maximum bitmask values", async () => {
      // Activate all 5 streak types for a user
      for (let i = 0; i < 5; i++) {
        await mockStreakCore.setCurrentStreak(user1.address, i, 10 + i);
        await streakStats.connect(statsManager).updateUserActivity(user1.address, i, 10 + i);
      }
      
      // Bitmask should be 31 (11111 in binary)
      expect(await streakStats.activeStreakTypes(user1.address)).to.equal(31);
    });

    it("should handle large numbers of users efficiently", async () => {
      const users = [user1, user2, user3, user4, user5];
      
      for (let i = 0; i < users.length; i++) {
        await mockStreakCore.setCurrentStreak(users[i].address, StreakType.DAILY_LOGIN, (i + 1) * 10);
        await streakStats.connect(statsManager).updateUserActivity(users[i].address, StreakType.DAILY_LOGIN, (i + 1) * 10);
      }
      
      const [leaderboardUsers, streaks] = await streakStats.getLeaderboard(StreakType.DAILY_LOGIN, 10);
      
      expect(leaderboardUsers).to.have.lengthOf(5);
      expect(leaderboardUsers[0]).to.equal(user5.address); // Highest streak
      expect(streaks[0]).to.equal(50);
    });

    it("should maintain data consistency across multiple operations", async () => {
      // Complex scenario with multiple users and streak types
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 50);
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.QUEST_COMPLETION, 30);
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.TRADING, 40);
      
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 50);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.QUEST_COMPLETION, 30);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.TRADING, 40);
      
      // Record achievements
      await streakStats.connect(statsManager).recordAchievement(user1.address, 200, 3);
      await streakStats.connect(statsManager).recordAchievement(user2.address, 150, 2);
      
      // Verify global stats
      const [totalActiveStreakers, longestGlobalStreak, streakLeader] = await streakStats.getGlobalStats();
      expect(totalActiveStreakers).to.equal(2);
      expect(longestGlobalStreak).to.equal(80); // user1's total: 50 + 30
      expect(streakLeader).to.equal(user1.address);
      
      // Verify user stats
      const [u1Achievements, u1XP] = await streakStats.getUserStats(user1.address);
      expect(u1Achievements).to.equal(1);
      expect(u1XP).to.equal(200);
      
      // Verify leaderboards
      const [dailyUsers] = await streakStats.getLeaderboard(StreakType.DAILY_LOGIN, 10);
      const [tradingUsers] = await streakStats.getLeaderboard(StreakType.TRADING, 10);
      
      expect(dailyUsers[0]).to.equal(user1.address);
      expect(tradingUsers[0]).to.equal(user2.address);
    });

    it("should handle timestamp edge cases", async () => {
      // Test behavior around day boundaries
      const currentTime = await time.latest();
      const dayBoundary = Math.floor(currentTime / (24 * 60 * 60)) * (24 * 60 * 60) + (24 * 60 * 60);
      
      // Set time just before day boundary
      await time.setNextBlockTimestamp(dayBoundary - 1);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 5);
      
      const day1 = Math.floor((dayBoundary - 1) / (24 * 60 * 60));
      let [activeUsers1] = await streakStats.getDailyStats(day1);
      expect(activeUsers1).to.equal(1);
      
      // Set time just after day boundary
      await time.setNextBlockTimestamp(dayBoundary + 1);
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.QUEST_COMPLETION, 3);
      
      const day2 = Math.floor((dayBoundary + 1) / (24 * 60 * 60));
      let [activeUsers2] = await streakStats.getDailyStats(day2);
      expect(activeUsers2).to.equal(1);
    });

    it("should handle concurrent operations gracefully", async () => {
      // Simulate multiple operations in same block
      await mockStreakCore.setCurrentStreak(user1.address, StreakType.DAILY_LOGIN, 10);
      await mockStreakCore.setCurrentStreak(user2.address, StreakType.DAILY_LOGIN, 20);
      
      // Multiple updates in sequence
      await streakStats.connect(statsManager).updateUserActivity(user1.address, StreakType.DAILY_LOGIN, 10);
      await streakStats.connect(statsManager).updateUserActivity(user2.address, StreakType.DAILY_LOGIN, 20);
      await streakStats.connect(statsManager).recordAchievement(user1.address, 100, 1);
      await streakStats.connect(statsManager).recordAchievement(user2.address, 200, 2);
      
      // Verify final state is consistent
      const [totalActiveStreakers] = await streakStats.getGlobalStats();
      expect(totalActiveStreakers).to.equal(2);
      
      const [users] = await streakStats.getLeaderboard(StreakType.DAILY_LOGIN, 10);
      expect(users[0]).to.equal(user2.address); // Higher streak should be first
    });

    it("should recover gracefully from edge case inputs", async () => {
      // Test with maximum uint32 values
      const maxUint32 = 2**32 - 1;
      
      await expect(
        streakStats.connect(statsManager).recordAchievement(user1.address, maxUint32, maxUint32)
      ).to.not.be.reverted;
      
      const [achievements, xp, badges] = await streakStats.getUserStats(user1.address);
      expect(achievements).to.equal(1);
      expect(xp).to.equal(maxUint32);
      expect(badges).to.equal(maxUint32);
    });
  });
});