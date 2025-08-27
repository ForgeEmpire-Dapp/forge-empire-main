const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StreakMilestones", function () {
  let streakMilestones;
  let mockXPEngine, mockBadgeMinter, mockStreakCore;
  let owner, milestoneManager, user1, user2;

  beforeEach(async function () {
    [owner, milestoneManager, user1, user2] = await ethers.getSigners();

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

    // Deploy StreakMilestones
    const StreakMilestones = await ethers.getContractFactory("StreakMilestones");
    streakMilestones = await StreakMilestones.deploy();
    await streakMilestones.waitForDeployment();

    // Initialize
    await streakMilestones.initialize(
      mockXPEngine.target,
      mockBadgeMinter.target,
      mockStreakCore.target
    );

    // Grant milestone manager role
    const MILESTONE_MANAGER_ROLE = await streakMilestones.MILESTONE_MANAGER_ROLE();
    await streakMilestones.grantRole(MILESTONE_MANAGER_ROLE, milestoneManager.address);

    // Grant minter role to StreakMilestones contract
    const MINTER_ROLE = await mockBadgeMinter.MINTER_ROLE();
    await mockBadgeMinter.grantRole(MINTER_ROLE, streakMilestones.target);
  });

  describe("Deployment and Initialization", function () {
    it("Should initialize with correct addresses", async function () {
      expect(await streakMilestones.xpEngine()).to.equal(mockXPEngine.target);
      expect(await streakMilestones.badgeMinter()).to.equal(mockBadgeMinter.target);
      expect(await streakMilestones.streakCore()).to.equal(mockStreakCore.target);
    });

    it("Should grant roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await streakMilestones.DEFAULT_ADMIN_ROLE();
      const MILESTONE_MANAGER_ROLE = await streakMilestones.MILESTONE_MANAGER_ROLE();
      
      expect(await streakMilestones.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await streakMilestones.hasRole(MILESTONE_MANAGER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Milestone Management", function () {
    it("Should allow milestone manager to configure milestones", async function () {
      await expect(streakMilestones.connect(owner).configureMilestone(
        2, // milestoneId
        200, // day
        "Test Milestone 200", // title
        "Description for Test Milestone 200", // description
        1000, // specialReward (XP)
        "https://example.com/badge2.json", // badgeURI
        true // isGlobal
      )).to.emit(streakMilestones, "MilestoneConfigured")
        .withArgs(2, "Test Milestone 200", 200, 1000);

      const milestoneDetails = await streakMilestones.getMilestoneDetails(2);
      expect(milestoneDetails.day).to.equal(200);
      expect(milestoneDetails.specialReward).to.equal(1000);
      expect(milestoneDetails.isActive).to.be.true;
    });
  });

  describe("User Streak Tracking", function () {
    it("Should update total streak days", async function () {
      await mockStreakCore.setCurrentStreak(user1.address, 0, 10);
      await expect(streakMilestones.connect(milestoneManager).updateTotalStreakDays(user1.address))
        .to.emit(streakMilestones, "TotalStreakUpdated")
        .withArgs(user1.address, 10);
    });
  });

  describe("Milestone Claiming", function () {
    beforeEach(async function () {
      // Give user sufficient streak days
      await mockStreakCore.setCurrentStreak(user1.address, 0, 150);
      await streakMilestones.connect(milestoneManager).updateTotalStreakDays(user1.address);
    });

    it("Should allow users to claim milestone", async function () {
      await expect(streakMilestones.connect(user1).claimMilestone(4))
        .to.emit(streakMilestones, "MilestoneAchieved");
    });

    it("Should not allow claiming same milestone twice", async function () {
      await streakMilestones.connect(user1).claimMilestone(4);
      
      await expect(streakMilestones.connect(user1).claimMilestone(4))
        .to.be.revertedWithCustomError(streakMilestones, "MilestoneAlreadyAchieved");
    });
  });

  

  describe("View Functions", function () {
    beforeEach(async function () {
      // Setup user with 150 streak days
      await mockStreakCore.setCurrentStreak(user1.address, 0, 150);
      await streakMilestones.connect(milestoneManager).updateTotalStreakDays(user1.address);
    });

    it("Should return available milestones for user", async function () {
      const availableMilestones = await streakMilestones.getAvailableMilestones(user1.address);
      expect(availableMilestones).to.deep.equal([1, 2, 3, 4]);
    });

    it("Should return all milestones", async function () {
      const allMilestones = await streakMilestones.getActiveMilestones();
      expect(allMilestones.length).to.equal(8);
    });

    it("Should check if milestone is claimed", async function () {
      expect(await streakMilestones.achievedMilestones(user1.address, 4)).to.be.false;
      
      await streakMilestones.connect(user1).claimMilestone(4);
      
      expect(await streakMilestones.achievedMilestones(user1.address, 4)).to.be.true;
    });

    it("Should return milestone details", async function () {
      const details = await streakMilestones.getMilestoneDetails(4);
      
      expect(details.specialReward).to.equal(5000);
      expect(details.title).to.equal("Epic Achiever");
    });
  });

  describe("Batch Operations", function () {
    beforeEach(async function () {
      // Setup user with sufficient streak days
      await mockStreakCore.setCurrentStreak(user1.address, 0, 150);
      await streakMilestones.connect(milestoneManager).updateTotalStreakDays(user1.address);
    });

    it("Should allow batch milestone claiming", async function () {
      await expect(streakMilestones.connect(user1).claimAllMilestones())
        .to.emit(streakMilestones, "BatchMilestonesAchieved");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow admin to pause milestones", async function () {
      await streakMilestones.pause();
      
      await expect(streakMilestones.connect(user1).claimMilestone(4))
        .to.be.revertedWithCustomError(streakMilestones, "EnforcedPause");
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete milestone journey", async function () {
      // User accumulates streak days
      await mockStreakCore.setCurrentStreak(user1.address, 0, 100);
      await streakMilestones.connect(milestoneManager).updateTotalStreakDays(user1.address);
      
      // Check available milestones
      const available = await streakMilestones.getAvailableMilestones(user1.address);
      expect(available).to.deep.equal([1, 2, 3, 4]);
      
      // Claim milestone
      await streakMilestones.connect(user1).claimMilestone(4);
      
      // Verify claimed
      expect(await streakMilestones.achievedMilestones(user1.address, 4)).to.be.true;
    });
  });
});