const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("StreakMilestoneManager", function () {
  let StreakMilestoneManager, milestoneManager;
  let mockXPEngine, mockBadgeMinter;
  let owner, admin, streakManager, user1, user2, user3;

  // Default milestone days
  const DEFAULT_MILESTONES = [7, 30, 90, 365, 1000];

  beforeEach(async () => {
    [owner, admin, streakManager, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock XP Engine
    const MockXPEngine = await ethers.getContractFactory("XPEngine");
    mockXPEngine = await upgrades.deployProxy(MockXPEngine, [], { initializer: 'initialize' });
    await mockXPEngine.waitForDeployment();

    // Deploy mock Badge Minter
    const MockBadgeMinter = await ethers.getContractFactory("BadgeMinter");
    mockBadgeMinter = await upgrades.deployProxy(MockBadgeMinter, [mockXPEngine.target], { initializer: 'initialize' });
    await mockBadgeMinter.waitForDeployment();

    // Deploy StreakMilestoneManager as upgradeable proxy
    StreakMilestoneManager = await ethers.getContractFactory("StreakMilestoneManager");
    milestoneManager = await upgrades.deployProxy(StreakMilestoneManager, [
      mockXPEngine.target,
      mockBadgeMinter.target
    ], { initializer: 'initialize' });
    await milestoneManager.waitForDeployment();

    // Grant roles
    const ADMIN_ROLE = await milestoneManager.ADMIN_ROLE();
    const STREAK_MANAGER_ROLE = await milestoneManager.STREAK_MANAGER_ROLE();

    await milestoneManager.grantRole(ADMIN_ROLE, admin.address);
    await milestoneManager.grantRole(STREAK_MANAGER_ROLE, streakManager.address);

    // Grant necessary roles for XP awarding and badge minting
    const XP_AWARDER_ROLE = await mockXPEngine.XP_AWARDER_ROLE();
    const MINTER_ROLE = await mockBadgeMinter.MINTER_ROLE();
    
    await mockXPEngine.grantRole(XP_AWARDER_ROLE, milestoneManager.target);
    await mockBadgeMinter.grantRole(MINTER_ROLE, milestoneManager.target);
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct external contracts", async () => {
      expect(await milestoneManager.xpEngine()).to.equal(mockXPEngine.target);
      expect(await milestoneManager.badgeMinter()).to.equal(mockBadgeMinter.target);
    });

    it("should grant correct roles to deployer", async () => {
      const DEFAULT_ADMIN_ROLE = await milestoneManager.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await milestoneManager.ADMIN_ROLE();
      const STREAK_MANAGER_ROLE = await milestoneManager.STREAK_MANAGER_ROLE();

      expect(await milestoneManager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await milestoneManager.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await milestoneManager.hasRole(STREAK_MANAGER_ROLE, owner.address)).to.be.true;
    });

    it("should initialize with default milestones", async () => {
      const milestoneDays = await milestoneManager.getMilestoneDays();
      expect(milestoneDays).to.have.lengthOf(5);
      expect(milestoneDays.map(day => Number(day))).to.deep.equal(DEFAULT_MILESTONES);
    });

    it("should start unpaused", async () => {
      expect(await milestoneManager.paused()).to.be.false;
    });

    it("should initialize default milestone details correctly", async () => {
      // Check Week Warrior (7 days)
      const weekMilestone = await milestoneManager.getMilestoneInfo(7);
      expect(weekMilestone.day).to.equal(7);
      expect(weekMilestone.title).to.equal("Week Warrior");
      expect(weekMilestone.description).to.equal("Maintained a streak for 7 consecutive days");
      expect(weekMilestone.specialReward).to.equal(100);
      expect(weekMilestone.specialBadgeURI).to.equal("https://badges.avaxforge.com/milestone-week");
      expect(weekMilestone.isActive).to.be.true;

      // Check Year Champion (365 days)
      const yearMilestone = await milestoneManager.getMilestoneInfo(365);
      expect(yearMilestone.day).to.equal(365);
      expect(yearMilestone.title).to.equal("Year Champion");
      expect(yearMilestone.specialReward).to.equal(5000);
      expect(yearMilestone.isActive).to.be.true;
    });
  });

  describe("Milestone Achievement", function () {
    it("should award milestone when user reaches required streak", async () => {
      // User achieves 7-day streak
      const tx = await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      
      await expect(tx)
        .to.emit(milestoneManager, "MilestoneAchieved")
        .withArgs(user1.address, 7, "Week Warrior", 100, 1); // Badge ID should be 1

      // Check that milestone is marked as achieved
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.true;
      
      // Check XP was awarded
      expect(await mockXPEngine.getXP(user1.address)).to.equal(100);
    });

    it("should award multiple milestones when user reaches higher streak", async () => {
      // User achieves 30-day streak (should get both 7 and 30 day milestones)
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 30);
      
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 30)).to.be.true;
      
      // Should receive XP from both milestones (100 + 500 = 600)
      expect(await mockXPEngine.getXP(user1.address)).to.equal(600);
    });

    it("should not award same milestone twice", async () => {
      // First achievement
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      const firstXP = await mockXPEngine.getXP(user1.address);
      
      // Second attempt should not award again
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      const secondXP = await mockXPEngine.getXP(user1.address);
      
      expect(secondXP).to.equal(firstXP);
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.true;
    });

    it("should award progressive milestones correctly", async () => {
      // Start with 10-day streak (gets 7-day milestone)
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 10);
      expect(await mockXPEngine.getXP(user1.address)).to.equal(100);
      
      // Progress to 50-day streak (gets 30-day milestone)
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 50);
      expect(await mockXPEngine.getXP(user1.address)).to.equal(600); // 100 + 500
      
      // Progress to 100-day streak (gets 90-day milestone)
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 100);
      expect(await mockXPEngine.getXP(user1.address)).to.equal(2100); // 100 + 500 + 1500
    });

    it("should award all milestones when user jumps to very high streak", async () => {
      // User jumps directly to 1000-day streak
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 1000);
      
      // Should achieve all 5 milestones
      for (const day of DEFAULT_MILESTONES) {
        expect(await milestoneManager.hasAchievedMilestone(user1.address, day)).to.be.true;
      }
      
      // Should receive all XP rewards: 100 + 500 + 1500 + 5000 + 10000 = 17100
      expect(await mockXPEngine.getXP(user1.address)).to.equal(17100);
    });

    it("should handle milestones independently for different users", async () => {
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      await milestoneManager.connect(streakManager).checkMilestones(user2.address, 30);
      
      // User1 should only have 7-day milestone
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 30)).to.be.false;
      
      // User2 should have both 7 and 30-day milestones
      expect(await milestoneManager.hasAchievedMilestone(user2.address, 7)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user2.address, 30)).to.be.true;
      
      expect(await mockXPEngine.getXP(user1.address)).to.equal(100);
      expect(await mockXPEngine.getXP(user2.address)).to.equal(600);
    });
  });

  describe("Custom Milestone Configuration", function () {
    it("should allow admin to add new milestone", async () => {
      await expect(
        milestoneManager.connect(admin).setMilestone(
          14,
          "Two Week Champion",
          "Maintained streak for 14 days",
          200,
          "https://badges.avaxforge.com/milestone-twoweek",
          true
        )
      ).to.emit(milestoneManager, "MilestoneConfigured")
       .withArgs(14, "Two Week Champion", "Maintained streak for 14 days", 200, "https://badges.avaxforge.com/milestone-twoweek");

      const milestone = await milestoneManager.getMilestoneInfo(14);
      expect(milestone.day).to.equal(14);
      expect(milestone.title).to.equal("Two Week Champion");
      expect(milestone.specialReward).to.equal(200);
      expect(milestone.isActive).to.be.true;
    });

    it("should maintain sorted order when adding milestone", async () => {
      await milestoneManager.connect(admin).setMilestone(14, "Two Week", "14 days", 200, "", true);
      await milestoneManager.connect(admin).setMilestone(3, "Three Day", "3 days", 50, "", true);
      
      const milestoneDays = await milestoneManager.getMilestoneDays();
      const sortedDays = milestoneDays.map(day => Number(day));
      
      // Should be sorted: 3, 7, 14, 30, 90, 365, 1000
      expect(sortedDays).to.deep.equal([3, 7, 14, 30, 90, 365, 1000]);
    });

    it("should allow admin to update existing milestone", async () => {
      await milestoneManager.connect(admin).setMilestone(
        7,
        "Updated Week Warrior",
        "Updated description",
        150,
        "https://updated-badge.com",
        false
      );

      const milestone = await milestoneManager.getMilestoneInfo(7);
      expect(milestone.title).to.equal("Updated Week Warrior");
      expect(milestone.specialReward).to.equal(150);
      expect(milestone.isActive).to.be.false;
    });

    it("should not award inactive milestones", async () => {
      // Deactivate 7-day milestone
      await milestoneManager.connect(admin).setMilestone(7, "Week Warrior", "Description", 100, "", false);
      
      // Try to achieve deactivated milestone
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.false;
      expect(await mockXPEngine.getXP(user1.address)).to.equal(0);
    });

    it("should reject milestone with day 0", async () => {
      await expect(
        milestoneManager.connect(admin).setMilestone(0, "Invalid", "Description", 100, "", true)
      ).to.be.revertedWithCustomError(milestoneManager, "InvalidMilestoneDay");
    });

    it("should reject milestone creation from non-admin", async () => {
      await expect(
        milestoneManager.connect(user1).setMilestone(14, "Test", "Test", 100, "", true)
      ).to.be.reverted;
    });

    it("should handle milestones with no XP reward", async () => {
      await milestoneManager.connect(admin).setMilestone(5, "Badge Only", "Only badge reward", 0, "https://badge.com", true);
      
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 5);
      
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 5)).to.be.true;
      expect(await mockXPEngine.getXP(user1.address)).to.equal(0); // No XP reward
    });

    it("should handle milestones with no badge reward", async () => {
      await milestoneManager.connect(admin).setMilestone(5, "XP Only", "Only XP reward", 100, "", true);
      
      const tx = await milestoneManager.connect(streakManager).checkMilestones(user1.address, 5);
      
      await expect(tx)
        .to.emit(milestoneManager, "MilestoneAchieved")
        .withArgs(user1.address, 5, "XP Only", 100, 0); // Badge ID should be 0
      
      expect(await mockXPEngine.getXP(user1.address)).to.equal(100);
    });
  });

  describe("View Functions", function () {
    beforeEach(async () => {
      // Set up some achieved milestones
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 30);
      await milestoneManager.connect(streakManager).checkMilestones(user2.address, 7);
    });

    it("should return correct milestone information", async () => {
      const milestone = await milestoneManager.getMilestoneInfo(30);
      expect(milestone.day).to.equal(30);
      expect(milestone.title).to.equal("Month Master");
      expect(milestone.specialReward).to.equal(500);
    });

    it("should return all milestone days", async () => {
      const days = await milestoneManager.getMilestoneDays();
      expect(days.map(d => Number(d))).to.deep.equal(DEFAULT_MILESTONES);
    });

    it("should check milestone achievement status correctly", async () => {
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 30)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 90)).to.be.false;
      
      expect(await milestoneManager.hasAchievedMilestone(user2.address, 7)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user2.address, 30)).to.be.false;
    });

    it("should return correct eligible milestones count", async () => {
      // User1 already achieved 7 and 30, so for streak of 90 they're eligible for just the 90-day milestone
      expect(await milestoneManager.getEligibleMilestonesCount(user1.address, 90)).to.equal(1);
      
      // User2 achieved 7, so for streak of 30 they're eligible for just the 30-day milestone
      expect(await milestoneManager.getEligibleMilestonesCount(user2.address, 30)).to.equal(1);
      
      // New user with 365 streak should be eligible for all 5 milestones
      expect(await milestoneManager.getEligibleMilestonesCount(user3.address, 365)).to.equal(4); // Only 4 because we don't count 1000-day
      expect(await milestoneManager.getEligibleMilestonesCount(user3.address, 1000)).to.equal(5);
    });

    it("should handle non-existent milestone queries", async () => {
      const milestone = await milestoneManager.getMilestoneInfo(999);
      expect(milestone.day).to.equal(0);
      expect(milestone.title).to.equal("");
      expect(milestone.isActive).to.be.false;
    });
  });

  describe("Contract Management", function () {
    it("should allow admin to update XP Engine address", async () => {
      const NewXPEngine = await ethers.getContractFactory("XPEngine");
      const newXPEngine = await upgrades.deployProxy(NewXPEngine, [], { initializer: 'initialize' });
      await newXPEngine.waitForDeployment();

      await milestoneManager.connect(admin).updateXPEngine(newXPEngine.target);
      expect(await milestoneManager.xpEngine()).to.equal(newXPEngine.target);
    });

    it("should allow admin to update Badge Minter address", async () => {
      const NewBadgeMinter = await ethers.getContractFactory("BadgeMinter");
      const newBadgeMinter = await upgrades.deployProxy(NewBadgeMinter, [mockXPEngine.target], { initializer: 'initialize' });
      await newBadgeMinter.waitForDeployment();

      await milestoneManager.connect(admin).updateBadgeMinter(newBadgeMinter.target);
      expect(await milestoneManager.badgeMinter()).to.equal(newBadgeMinter.target);
    });

    it("should reject zero address for XP Engine update", async () => {
      await expect(
        milestoneManager.connect(admin).updateXPEngine(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("should reject zero address for Badge Minter update", async () => {
      await expect(
        milestoneManager.connect(admin).updateBadgeMinter(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("should reject contract updates from non-admin", async () => {
      await expect(
        milestoneManager.connect(user1).updateXPEngine(mockXPEngine.target)
      ).to.be.reverted;

      await expect(
        milestoneManager.connect(user1).updateBadgeMinter(mockBadgeMinter.target)
      ).to.be.reverted;
    });
  });

  describe("Pause Functionality", function () {
    it("should allow admin to pause contract", async () => {
      await milestoneManager.connect(admin).pause();
      expect(await milestoneManager.paused()).to.be.true;
    });

    it("should allow admin to unpause contract", async () => {
      await milestoneManager.connect(admin).pause();
      await milestoneManager.connect(admin).unpause();
      expect(await milestoneManager.paused()).to.be.false;
    });

    it("should prevent milestone checking when paused", async () => {
      await milestoneManager.connect(admin).pause();

      await expect(
        milestoneManager.connect(streakManager).checkMilestones(user1.address, 7)
      ).to.be.revertedWithCustomError(milestoneManager, "EnforcedPause");
    });

    it("should allow view functions when paused", async () => {
      await milestoneManager.connect(admin).pause();

      expect(await milestoneManager.getMilestoneDays()).to.have.lengthOf(5);
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.false;
    });

    it("should reject pause/unpause from non-admin", async () => {
      await expect(milestoneManager.connect(user1).pause()).to.be.reverted;
      await expect(milestoneManager.connect(user1).unpause()).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("should enforce streak manager role for milestone checking", async () => {
      await expect(
        milestoneManager.connect(user1).checkMilestones(user2.address, 7)
      ).to.be.reverted;
    });

    it("should enforce admin role for milestone configuration", async () => {
      await expect(
        milestoneManager.connect(user1).setMilestone(14, "Test", "Test", 100, "", true)
      ).to.be.reverted;
    });

    it("should support role granting and revoking", async () => {
      const STREAK_MANAGER_ROLE = await milestoneManager.STREAK_MANAGER_ROLE();
      
      // Grant role to user1
      await milestoneManager.connect(owner).grantRole(STREAK_MANAGER_ROLE, user1.address);
      expect(await milestoneManager.hasRole(STREAK_MANAGER_ROLE, user1.address)).to.be.true;

      // User1 should now be able to check milestones
      await milestoneManager.connect(user1).checkMilestones(user2.address, 7);
      expect(await milestoneManager.hasAchievedMilestone(user2.address, 7)).to.be.true;

      // Revoke role
      await milestoneManager.connect(owner).revokeRole(STREAK_MANAGER_ROLE, user1.address);
      expect(await milestoneManager.hasRole(STREAK_MANAGER_ROLE, user1.address)).to.be.false;

      // User1 should no longer be able to check milestones
      await expect(
        milestoneManager.connect(user1).checkMilestones(user3.address, 7)
      ).to.be.reverted;
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("should handle XP engine failure gracefully", async () => {
      // Remove XP awarder role to simulate failure
      const XP_AWARDER_ROLE = await mockXPEngine.XP_AWARDER_ROLE();
      await mockXPEngine.revokeRole(XP_AWARDER_ROLE, milestoneManager.target);

      // Should still award milestone but without XP
      const tx = await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      
      await expect(tx)
        .to.emit(milestoneManager, "MilestoneAchieved")
        .withArgs(user1.address, 7, "Week Warrior", 100, 1); // Badge should still mint

      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.true;
      expect(await mockXPEngine.getXP(user1.address)).to.equal(0); // XP not awarded due to failure
    });

    it("should handle badge minting failure gracefully", async () => {
      // Remove minter role to simulate failure
      const MINTER_ROLE = await mockBadgeMinter.MINTER_ROLE();
      await mockBadgeMinter.revokeRole(MINTER_ROLE, milestoneManager.target);

      // Should still award milestone but without badge
      const tx = await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      
      await expect(tx)
        .to.emit(milestoneManager, "MilestoneAchieved")
        .withArgs(user1.address, 7, "Week Warrior", 100, 0); // Badge ID should be 0 due to failure

      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.true;
      expect(await mockXPEngine.getXP(user1.address)).to.equal(100); // XP should still be awarded
    });

    it("should handle zero streak length", async () => {
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 0);
      
      // No milestones should be achieved
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.false;
      expect(await mockXPEngine.getXP(user1.address)).to.equal(0);
    });

    it("should handle very large streak length", async () => {
      const largeStreak = 10000;
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, largeStreak);
      
      // Should achieve all milestones
      for (const day of DEFAULT_MILESTONES) {
        expect(await milestoneManager.hasAchievedMilestone(user1.address, day)).to.be.true;
      }
    });

    it("should handle reentrancy protection", async () => {
      // The checkMilestones function has nonReentrant modifier
      await expect(
        milestoneManager.connect(streakManager).checkMilestones(user1.address, 7)
      ).to.not.be.reverted;
    });

    it("should maintain state consistency during complex milestone operations", async () => {
      // Multiple users achieving different milestones simultaneously
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      await milestoneManager.connect(streakManager).checkMilestones(user2.address, 90);
      await milestoneManager.connect(streakManager).checkMilestones(user3.address, 365);

      // Verify state consistency
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 7)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user1.address, 30)).to.be.false;

      expect(await milestoneManager.hasAchievedMilestone(user2.address, 7)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user2.address, 30)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user2.address, 90)).to.be.true;

      expect(await milestoneManager.hasAchievedMilestone(user3.address, 365)).to.be.true;
      expect(await milestoneManager.hasAchievedMilestone(user3.address, 1000)).to.be.false;

      // Check XP totals
      expect(await mockXPEngine.getXP(user1.address)).to.equal(100);
      expect(await mockXPEngine.getXP(user2.address)).to.equal(2100); // 100 + 500 + 1500
      expect(await mockXPEngine.getXP(user3.address)).to.equal(7100); // 100 + 500 + 1500 + 5000
    });

    it("should handle milestone updates after achievements", async () => {
      // User achieves milestone
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      expect(await mockXPEngine.getXP(user1.address)).to.equal(100);

      // Admin updates the milestone reward
      await milestoneManager.connect(admin).setMilestone(7, "Week Warrior", "Updated description", 200, "", true);

      // User shouldn't get additional reward since already achieved
      await milestoneManager.connect(streakManager).checkMilestones(user1.address, 7);
      expect(await mockXPEngine.getXP(user1.address)).to.equal(100); // Still original amount

      // New user should get updated reward
      await milestoneManager.connect(streakManager).checkMilestones(user2.address, 7);
      expect(await mockXPEngine.getXP(user2.address)).to.equal(200); // New reward amount
    });
  });
});