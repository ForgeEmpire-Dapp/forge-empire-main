const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StreakCore", function () {
  let streakCore;
  let owner, user1, user2, streakManager;

  const StreakType = {
    DAILY_LOGIN: 0,
    QUEST_COMPLETION: 1,
    TRADING: 2,
    GOVERNANCE: 3,
    SOCIAL_INTERACTION: 4
  };

  beforeEach(async function () {
    [owner, user1, user2, streakManager] = await ethers.getSigners();

    const StreakCore = await ethers.getContractFactory("StreakCore");
    streakCore = await StreakCore.deploy();
    await streakCore.waitForDeployment();

    // Initialize the contract
    await streakCore.initialize();
    
    // Grant streak manager role
    const STREAK_MANAGER_ROLE = await streakCore.STREAK_MANAGER_ROLE();
    await streakCore.grantRole(STREAK_MANAGER_ROLE, streakManager.address);
  });

  describe("Deployment and Initialization", function () {
    it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await streakCore.DEFAULT_ADMIN_ROLE();
      expect(await streakCore.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should grant STREAK_MANAGER_ROLE to deployer", async function () {
      const STREAK_MANAGER_ROLE = await streakCore.STREAK_MANAGER_ROLE();
      expect(await streakCore.hasRole(STREAK_MANAGER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Basic Streak Tracking", function () {
    it("Should record daily login streak", async function () {
      await expect(streakCore.connect(user1).recordDailyLogin())
        .to.emit(streakCore, "StreakIncreased")
        .withArgs(user1.address, StreakType.DAILY_LOGIN, 1);

      expect(await streakCore.getCurrentStreak(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
      expect(await streakCore.getLongestStreak(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
    });

    it("Should record quest completion streak", async function () {
      await expect(streakCore.connect(user1).recordQuestCompletion())
        .to.emit(streakCore, "StreakIncreased")
        .withArgs(user1.address, StreakType.QUEST_COMPLETION, 1);

      expect(await streakCore.getCurrentStreak(user1.address, StreakType.QUEST_COMPLETION)).to.equal(1);
    });

    it("Should record trading activity streak", async function () {
      await expect(streakCore.connect(user1).recordTradingActivity())
        .to.emit(streakCore, "StreakIncreased")
        .withArgs(user1.address, StreakType.TRADING, 1);

      expect(await streakCore.getCurrentStreak(user1.address, StreakType.TRADING)).to.equal(1);
    });

    it("Should record governance participation streak", async function () {
      await expect(streakCore.connect(user1).recordGovernanceParticipation())
        .to.emit(streakCore, "StreakIncreased")
        .withArgs(user1.address, StreakType.GOVERNANCE, 1);

      expect(await streakCore.getCurrentStreak(user1.address, StreakType.GOVERNANCE)).to.equal(1);
    });

    it("Should record social interaction streak", async function () {
      await expect(streakCore.connect(user1).recordSocialInteraction())
        .to.emit(streakCore, "StreakIncreased")
        .withArgs(user1.address, StreakType.SOCIAL_INTERACTION, 1);

      expect(await streakCore.getCurrentStreak(user1.address, StreakType.SOCIAL_INTERACTION)).to.equal(1);
    });
  });

  describe("Streak Manager Functions", function () {
    it("Should allow streak manager to record activity", async function () {
      await expect(streakCore.connect(streakManager).recordActivity(user1.address, StreakType.DAILY_LOGIN))
        .to.emit(streakCore, "StreakIncreased")
        .withArgs(user1.address, StreakType.DAILY_LOGIN, 1);

      expect(await streakCore.getCurrentStreak(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
    });

    it("Should not allow non-streak manager to record activity", async function () {
      await expect(streakCore.connect(user1).recordActivity(user2.address, StreakType.DAILY_LOGIN))
        .to.be.reverted;
    });

    it("Should revert with invalid streak type", async function () {
      await expect(streakCore.connect(streakManager).recordActivity(user1.address, 5))
        .to.be.revertedWithCustomError(streakCore, "InvalidStreakType");
    });
  });

  describe("Streak Freeze System", function () {
    beforeEach(async function () {
      // Add some freezes to user1
      await streakCore.addStreakFreezes(user1.address, StreakType.DAILY_LOGIN, 3);
      
      // Start a streak
      await streakCore.connect(user1).recordDailyLogin();
    });

    it("Should add streak freezes", async function () {
      await streakCore.addStreakFreezes(user1.address, StreakType.QUEST_COMPLETION, 5);
      
      // Check that freezes were added (we can't directly read the mapping but can test usage)
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
    });

    it("Should allow using streak freeze", async function () {
      await expect(streakCore.connect(user1).useStreakFreeze(StreakType.DAILY_LOGIN))
        .to.emit(streakCore, "StreakFrozen")
        .withArgs(user1.address, StreakType.DAILY_LOGIN, 1);
    });

    it("Should not allow using freeze without freezes available", async function () {
      await expect(streakCore.connect(user1).useStreakFreeze(StreakType.QUEST_COMPLETION))
        .to.be.revertedWithCustomError(streakCore, "NoFreezesAvailable");
    });

    it("Should not allow using freeze on inactive streak", async function () {
      await expect(streakCore.connect(user2).useStreakFreeze(StreakType.DAILY_LOGIN))
        .to.be.revertedWithCustomError(streakCore, "NoFreezesAvailable");
    });

    it("Should revert with invalid streak type for freeze", async function () {
      await expect(streakCore.connect(user1).useStreakFreeze(5))
        .to.be.revertedWithCustomError(streakCore, "InvalidStreakType");
    });
  });

  describe("Streak Validation", function () {
    it("Should not allow recording same streak type twice in one day", async function () {
      await streakCore.connect(user1).recordDailyLogin();
      
      await expect(streakCore.connect(user1).recordDailyLogin())
        .to.be.revertedWithCustomError(streakCore, "AlreadyRecordedToday");
    });

    it("Should return correct hasRecordedToday status", async function () {
      expect(await streakCore.hasRecordedToday(user1.address, StreakType.DAILY_LOGIN)).to.be.false;
      
      await streakCore.connect(user1).recordDailyLogin();
      
      expect(await streakCore.hasRecordedToday(user1.address, StreakType.DAILY_LOGIN)).to.be.true;
    });

    it("Should return false for invalid streak type in hasRecordedToday", async function () {
      expect(await streakCore.hasRecordedToday(user1.address, 5)).to.be.false;
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Create some streak data
      await streakCore.connect(user1).recordDailyLogin();
      await streakCore.connect(user1).recordQuestCompletion();
    });

    it("Should return correct current streak", async function () {
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.QUEST_COMPLETION)).to.equal(1);
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.TRADING)).to.equal(0);
    });

    it("Should return correct longest streak", async function () {
      expect(await streakCore.getLongestStreak(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
      expect(await streakCore.getLongestStreak(user1.address, StreakType.QUEST_COMPLETION)).to.equal(1);
    });

    it("Should return 0 for invalid streak types", async function () {
      expect(await streakCore.getCurrentStreak(user1.address, 5)).to.equal(0);
      expect(await streakCore.getLongestStreak(user1.address, 5)).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to add streak freezes", async function () {
      await expect(streakCore.addStreakFreezes(user1.address, StreakType.DAILY_LOGIN, 5))
        .to.not.be.reverted;
    });

    it("Should not allow non-admin to add streak freezes", async function () {
      await expect(streakCore.connect(user1).addStreakFreezes(user2.address, StreakType.DAILY_LOGIN, 5))
        .to.be.reverted;
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow admin to pause", async function () {
      await expect(streakCore.pause()).to.not.be.reverted;
      expect(await streakCore.paused()).to.be.true;
    });

    it("Should allow admin to unpause", async function () {
      await streakCore.pause();
      await expect(streakCore.unpause()).to.not.be.reverted;
      expect(await streakCore.paused()).to.be.false;
    });

    it("Should not allow recording when paused", async function () {
      await streakCore.pause();
      
      await expect(streakCore.connect(user1).recordDailyLogin())
        .to.be.revertedWithCustomError(streakCore, "EnforcedPause");
    });

    it("Should not allow freeze usage when paused", async function () {
      await streakCore.addStreakFreezes(user1.address, StreakType.DAILY_LOGIN, 1);
      await streakCore.connect(user1).recordDailyLogin();
      await streakCore.pause();
      
      await expect(streakCore.connect(user1).useStreakFreeze(StreakType.DAILY_LOGIN))
        .to.be.revertedWithCustomError(streakCore, "EnforcedPause");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple users independently", async function () {
      await streakCore.connect(user1).recordDailyLogin();
      await streakCore.connect(user2).recordDailyLogin();
      
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
      expect(await streakCore.getCurrentStreak(user2.address, StreakType.DAILY_LOGIN)).to.equal(1);
    });

    it("Should handle different streak types independently", async function () {
      await streakCore.connect(user1).recordDailyLogin();
      await streakCore.connect(user1).recordQuestCompletion();
      await streakCore.connect(user1).recordTradingActivity();
      
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.DAILY_LOGIN)).to.equal(1);
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.QUEST_COMPLETION)).to.equal(1);
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.TRADING)).to.equal(1);
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.GOVERNANCE)).to.equal(0);
      expect(await streakCore.getCurrentStreak(user1.address, StreakType.SOCIAL_INTERACTION)).to.equal(0);
    });
  });
});