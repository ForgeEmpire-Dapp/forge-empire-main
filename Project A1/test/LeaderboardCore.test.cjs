const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("LeaderboardCore", function () {
  let leaderboards;
  let owner, admin, scoreManager, user1, user2, user3;

  // Enums from the contract
  const LeaderboardType = {
    XP_TOTAL: 0,
    TRADING_VOLUME: 1,
    QUEST_COMPLETION: 2,
    GOVERNANCE_PARTICIPATION: 3,
    REFERRAL_COUNT: 4,
    STREAK_LENGTH: 5,
    GUILD_CONTRIBUTION: 6,
    SOCIAL_ENGAGEMENT: 7
  };

  const TimeFrame = {
    DAILY: 0,
    WEEKLY: 1,
    MONTHLY: 2,
    ALL_TIME: 3
  };

  beforeEach(async function () {
    [owner, admin, scoreManager, user1, user2, user3] = await ethers.getSigners();

    const LeaderboardCore = await ethers.getContractFactory("LeaderboardCore");
    leaderboards = await upgrades.deployProxy(LeaderboardCore, [owner.address], { initializer: 'initialize' });
    await leaderboards.waitForDeployment();

    // Grant roles for testing
    const ADMIN_ROLE = await leaderboards.ADMIN_ROLE();
    const SCORE_MANAGER_ROLE = await leaderboards.SCORE_MANAGER_ROLE();
    await leaderboards.grantRole(ADMIN_ROLE, admin.address);
    await leaderboards.grantRole(SCORE_MANAGER_ROLE, scoreManager.address);
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct roles", async function () {
      const DEFAULT_ADMIN_ROLE = await leaderboards.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await leaderboards.ADMIN_ROLE();
      const SCORE_MANAGER_ROLE = await leaderboards.SCORE_MANAGER_ROLE();

      expect(await leaderboards.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await leaderboards.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await leaderboards.hasRole(SCORE_MANAGER_ROLE, owner.address)).to.be.true;
    });

    it("should start unpaused", async function () {
      expect(await leaderboards.paused()).to.be.false;
    });

    it("should initialize default leaderboard configs", async function () {
      const config = await leaderboards.leaderboardConfigs(LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME);
      expect(config.isActive).to.be.true;
      expect(config.maxEntries).to.equal(1000);
    });
  });

  describe("Score Updates", function () {
    it("should allow score manager to update score", async function () {
      await expect(leaderboards.connect(scoreManager).updateScore(
        user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100
      )).to.emit(leaderboards, "ScoreUpdated")
        .withArgs(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100, 1);

      const [score, rank] = await leaderboards.getUserScore(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME);
      expect(score).to.equal(100);
      expect(rank).to.equal(1);
    });

    it("should allow score manager to increment score", async function () {
      // Grant role explicitly within the test to isolate the issue
      const SCORE_MANAGER_ROLE = await leaderboards.SCORE_MANAGER_ROLE();
      await leaderboards.grantRole(SCORE_MANAGER_ROLE, scoreManager.address);

      await leaderboards.connect(scoreManager).updateScore(
        user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 50
      );

      await expect(leaderboards.connect(scoreManager).incrementScore(
        user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 25
      )).to.emit(leaderboards, "ScoreUpdated")
        .withArgs(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 75, 1);

      const [score, rank] = await leaderboards.getUserScore(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME);
      expect(score).to.equal(75);
      expect(rank).to.equal(1);
    });

    it("should update leaderboard position correctly", async function () {
      await leaderboards.connect(scoreManager).updateScore(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100);
      await leaderboards.connect(scoreManager).updateScore(user2.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 150);
      await leaderboards.connect(scoreManager).updateScore(user3.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 50);

      let leaderboard = await leaderboards.getLeaderboard(LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 10);
      expect(leaderboard[0].user).to.equal(user2.address);
      expect(leaderboard[0].score).to.equal(150);
      expect(leaderboard[0].rank).to.equal(1);
      expect(leaderboard[1].user).to.equal(user1.address);
      expect(leaderboard[1].score).to.equal(100);
      expect(leaderboard[1].rank).to.equal(2);
      expect(leaderboard[2].user).to.equal(user3.address);
      expect(leaderboard[2].score).to.equal(50);
      expect(leaderboard[2].rank).to.equal(3);

      // User3 surpasses user1
      await leaderboards.connect(scoreManager).updateScore(user3.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 120);

      leaderboard = await leaderboards.getLeaderboard(LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 10);
      expect(leaderboard[0].user).to.equal(user2.address);
      expect(leaderboard[0].score).to.equal(150);
      expect(leaderboard[0].rank).to.equal(1);
      expect(leaderboard[1].user).to.equal(user3.address);
      expect(leaderboard[1].score).to.equal(120);
      expect(leaderboard[1].rank).to.equal(2);
      expect(leaderboard[2].user).to.equal(user1.address);
      expect(leaderboard[2].score).to.equal(100);
      expect(leaderboard[2].rank).to.equal(3);
    });

    it("should emit NewLeader event when a new leader emerges", async function () {
      await expect(leaderboards.connect(scoreManager).updateScore(
        user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100
      )).to.emit(leaderboards, "NewLeader")
        .withArgs(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100);

      await expect(leaderboards.connect(scoreManager).updateScore(
        user2.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 150
      )).to.emit(leaderboards, "NewLeader")
        .withArgs(user2.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 150);
    });
  });

  describe("Leaderboard Retrieval", function () {
    beforeEach(async function () {
      await leaderboards.connect(scoreManager).updateScore(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100);
      await leaderboards.connect(scoreManager).updateScore(user2.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 150);
      await leaderboards.connect(scoreManager).updateScore(user3.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 50);
    });

    it("should return correct leaderboard entries", async function () {
      const leaderboard = await leaderboards.getLeaderboard(LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 2);
      expect(leaderboard).to.have.lengthOf(2);
      expect(leaderboard[0].user).to.equal(user2.address);
      expect(leaderboard[0].score).to.equal(150);
      expect(leaderboard[1].user).to.equal(user1.address);
      expect(leaderboard[1].score).to.equal(100);
    });

    it("should return correct user score and rank", async function () {
      const [score, rank] = await leaderboards.getUserScore(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME);
      expect(score).to.equal(100);
      expect(rank).to.equal(2);
    });

    it("should return correct user rank", async function () {
      expect(await leaderboards.getUserRank(user3.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME)).to.equal(3);
    });

    it("should return correct top users", async function () {
      const [users, scores] = await leaderboards.getTopUsers(LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 2);
      expect(users).to.have.lengthOf(2);
      expect(users[0]).to.equal(user2.address);
      expect(scores[0]).to.equal(150);
      expect(users[1]).to.equal(user1.address);
      expect(scores[1]).to.equal(100);
    });
  });

  describe("Leaderboard Reset", function () {
    beforeEach(async function () {
      await leaderboards.connect(scoreManager).updateScore(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100);
      await leaderboards.connect(scoreManager).updateScore(user2.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 150);
    });

    it("should allow admin to reset leaderboard", async function () {
      await expect(leaderboards.connect(admin).resetLeaderboard(
        LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME
      )).to.emit(leaderboards, "LeaderboardReset")
        .withArgs(LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME);

      const leaderboard = await leaderboards.getLeaderboard(LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 10);
      expect(leaderboard).to.have.lengthOf(0);

      const [score, rank] = await leaderboards.getUserScore(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME);
      expect(score).to.equal(0);
      expect(rank).to.equal(0);
    });

    it("should not allow non-admin to reset leaderboard", async function () {
      await expect(leaderboards.connect(user1).resetLeaderboard(
        LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME
      )).to.be.reverted;
    });
  });

  describe("Configuration", function () {
    it("should allow admin to set leaderboard config", async function () {
      const newConfig = {
        isActive: false,
        maxEntries: 500,
        updateCooldown: 60,
        seasonStartTime: 0,
        seasonDuration: 0
      };

      await leaderboards.connect(admin).setLeaderboardConfig(
        LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, newConfig
      );

      const config = await leaderboards.leaderboardConfigs(LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME);
      expect(config.isActive).to.be.false;
      expect(config.maxEntries).to.equal(500);
      expect(config.updateCooldown).to.equal(60);
    });

    it("should allow admin to start new season", async function () {
      const duration = 7 * 24 * 60 * 60; // 7 days
      await expect(leaderboards.connect(admin).startNewSeason(
        LeaderboardType.XP_TOTAL, duration
      )).to.not.be.reverted;

      const config = await leaderboards.leaderboardConfigs(LeaderboardType.XP_TOTAL, TimeFrame.DAILY);
      expect(config.isActive).to.be.true;
      expect(config.seasonDuration).to.equal(duration);
    });

    it("should not allow non-admin to set config or start new season", async function () {
      const newConfig = {
        isActive: false,
        maxEntries: 500,
        updateCooldown: 60,
        seasonStartTime: 0,
        seasonDuration: 0
      };
      const duration = 7 * 24 * 60 * 60;

      await expect(leaderboards.connect(user1).setLeaderboardConfig(
        LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, newConfig
      )).to.be.reverted;

      await expect(leaderboards.connect(user1).startNewSeason(
        LeaderboardType.XP_TOTAL, duration
      )).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("should prevent non-score manager from updating score", async function () {
      await expect(leaderboards.connect(user1).updateScore(
        user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100
      )).to.be.reverted;
    });

    it("should prevent non-admin from pausing/unpausing", async function () {
      await expect(leaderboards.connect(user1).pause()).to.be.reverted;
      await expect(leaderboards.connect(user1).unpause()).to.be.reverted;
    });
  });

  describe("Pause Functionality", function () {
    it("should prevent score updates when paused", async function () {
      await leaderboards.connect(owner).pause();
      await expect(leaderboards.connect(scoreManager).updateScore(
        user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100
      )).to.be.revertedWithCustomError(leaderboards, "EnforcedPause");
    });

    it("should allow view functions when paused", async function () {
      await leaderboards.connect(scoreManager).updateScore(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME, 100);
      await leaderboards.connect(owner).pause();
      const [score, rank] = await leaderboards.getUserScore(user1.address, LeaderboardType.XP_TOTAL, TimeFrame.ALL_TIME);
      expect(score).to.equal(100);
      expect(rank).to.equal(1);
    });
  });
});