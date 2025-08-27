const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("OnboardingQuests", function () {
  let onboardingQuests;
  let xpEngine;
  let badgeMinter;
  let mockBadgeMinter;
  let owner;
  let user1;
  let user2;
  let questManager;

  // Constants matching the contract
  const OnboardingStep = {
    PROFILE_CREATION: 0,
    QUEST_EXPLORATION: 1,
    COMMUNITY_INTERACTION: 2,
    TOKEN_ACTIVITY: 3,
    DAO_PARTICIPATION: 4
  };

  beforeEach(async function () {
    [owner, user1, user2, questManager] = await ethers.getSigners();

    // Deploy XPEngine mock
    const XPEngine = await ethers.getContractFactory("MockXPEngine");
    xpEngine = await XPEngine.deploy();
    await xpEngine.waitForDeployment();

    // Deploy BadgeMinter mock
    const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
    mockBadgeMinter = await MockBadgeMinter.deploy();
    await mockBadgeMinter.waitForDeployment();

    // Deploy OnboardingQuests
    const OnboardingQuests = await ethers.getContractFactory("OnboardingQuests");
    onboardingQuests = await upgrades.deployProxy(OnboardingQuests, [
      await xpEngine.getAddress(),
      await mockBadgeMinter.getAddress()
    ], { initializer: 'initialize' });
    await onboardingQuests.waitForDeployment();

    // Grant necessary roles
    const MINTER_ROLE = await mockBadgeMinter.MINTER_ROLE();
    await mockBadgeMinter.grantRole(MINTER_ROLE, await onboardingQuests.getAddress());

    const QUEST_MANAGER_ROLE = await onboardingQuests.QUEST_MANAGER_ROLE();
    await onboardingQuests.grantRole(QUEST_MANAGER_ROLE, questManager.address);
  });

  describe("Deployment", function () {
    it("Should set the correct XP engine and badge minter addresses", async function () {
      expect(await onboardingQuests.xpEngine()).to.equal(await xpEngine.getAddress());
      expect(await onboardingQuests.badgeMinter()).to.equal(await mockBadgeMinter.getAddress());
    });

    it("Should initialize default step configurations", async function () {
      const step0 = await onboardingQuests.stepConfigs(OnboardingStep.PROFILE_CREATION);
      expect(step0.title).to.equal("Create Your Profile");
      expect(step0.xpReward).to.equal(50);
      expect(step0.isActive).to.be.true;

      const step4 = await onboardingQuests.stepConfigs(OnboardingStep.DAO_PARTICIPATION);
      expect(step4.title).to.equal("Become a Citizen");
      expect(step4.xpReward).to.equal(200);
      expect(step4.isActive).to.be.true;
    });

    it("Should grant proper roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await onboardingQuests.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await onboardingQuests.ADMIN_ROLE();
      const QUEST_MANAGER_ROLE = await onboardingQuests.QUEST_MANAGER_ROLE();

      expect(await onboardingQuests.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await onboardingQuests.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await onboardingQuests.hasRole(QUEST_MANAGER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Starting Onboarding", function () {
    it("Should allow a user to start onboarding", async function () {
      await expect(onboardingQuests.connect(user1).startOnboarding())
        .to.emit(onboardingQuests, "OnboardingStarted")
        .withArgs(user1.address, anyValue);

      const progress = await onboardingQuests.getUserProgress(user1.address);
      expect(progress.currentStep).to.equal(0);
      expect(progress.completedSteps).to.equal(0);
      expect(progress.totalXPEarned).to.equal(0);
      expect(progress.isCompleted).to.be.false;
      expect(progress.startedAt).to.be.gt(0);

      expect(await onboardingQuests.totalUsersStarted()).to.equal(1);
    });

    it("Should prevent starting onboarding twice", async function () {
      await onboardingQuests.connect(user1).startOnboarding();
      
      await expect(onboardingQuests.connect(user1).startOnboarding())
        .to.be.revertedWithCustomError(onboardingQuests, "OnboardingAlreadyStarted");
    });

    it("Should update statistics correctly", async function () {
      await onboardingQuests.connect(user1).startOnboarding();
      await onboardingQuests.connect(user2).startOnboarding();

      expect(await onboardingQuests.totalUsersStarted()).to.equal(2);
      expect(await onboardingQuests.totalUsersCompleted()).to.equal(0);
    });
  });

  describe("Completing Steps", function () {
    beforeEach(async function () {
      await onboardingQuests.connect(user1).startOnboarding();
    });

    it("Should allow completing the first step", async function () {
      await expect(onboardingQuests.connect(user1).completeStep(OnboardingStep.PROFILE_CREATION))
        .to.emit(onboardingQuests, "StepCompleted")
        .withArgs(user1.address, OnboardingStep.PROFILE_CREATION, 50, 1); // Badge ID 1

      const progress = await onboardingQuests.getUserProgress(user1.address);
      expect(progress.currentStep).to.equal(1);
      expect(progress.totalXPEarned).to.equal(50);
      expect(progress.completedSteps).to.equal(1); // 2^0 = 1

      expect(await onboardingQuests.stepCompletionCounts(OnboardingStep.PROFILE_CREATION)).to.equal(1);
    });

    it("Should prevent completing steps out of order", async function () {
      await expect(onboardingQuests.connect(user1).completeStep(OnboardingStep.QUEST_EXPLORATION))
        .to.be.revertedWithCustomError(onboardingQuests, "MustCompleteInOrder");
    });

    it("Should prevent completing the same step twice", async function () {
      await onboardingQuests.connect(user1).completeStep(OnboardingStep.PROFILE_CREATION);
      
      await expect(onboardingQuests.connect(user1).completeStep(OnboardingStep.PROFILE_CREATION))
        .to.be.revertedWithCustomError(onboardingQuests, "StepAlreadyCompleted");
    });

    it("Should require onboarding to be started", async function () {
      await expect(onboardingQuests.connect(user2).completeStep(OnboardingStep.PROFILE_CREATION))
        .to.be.revertedWithCustomError(onboardingQuests, "OnboardingNotStarted");
    });

    it("Should complete all steps in sequence", async function () {
      // Complete all 5 steps
      for (let i = 0; i < 5; i++) {
        await onboardingQuests.connect(user1).completeStep(i);
        
        const progress = await onboardingQuests.getUserProgress(user1.address);
        expect(progress.currentStep).to.equal(i + 1);
        expect(progress.completedSteps).to.equal((1 << (i + 1)) - 1); // Bitmask with i+1 bits set
      }

      // Check final completion
      const finalProgress = await onboardingQuests.getUserProgress(user1.address);
      expect(finalProgress.isCompleted).to.be.true;
      expect(finalProgress.totalXPEarned).to.equal(575); // 50+100+75+150+200 base + 500 bonus = 1075 total, but user progress shows 575 (base only)
      
      expect(await onboardingQuests.totalUsersCompleted()).to.equal(1);
    });

    it("Should emit completion event when all steps finished", async function () {
      // Complete first 4 steps
      for (let i = 0; i < 4; i++) {
        await onboardingQuests.connect(user1).completeStep(i);
      }

      // Complete final step and check for completion event
      await expect(onboardingQuests.connect(user1).completeStep(OnboardingStep.DAO_PARTICIPATION))
        .to.emit(onboardingQuests, "OnboardingCompleted")
        .withArgs(user1.address, 575, anyValue); // Total XP: 50+100+75+150+200 = 575
    });

    it("Should award completion bonus", async function () {
      // Complete all steps
      for (let i = 0; i < 5; i++) {
        await onboardingQuests.connect(user1).completeStep(i);
      }

      // Check that bonus XP and badge were awarded (via mock contract calls)
      expect(await xpEngine.getXP(user1.address)).to.be.gt(575); // Should include 500 bonus
      expect(await mockBadgeMinter.balanceOf(user1.address)).to.equal(6); // 5 step badges + 1 completion badge
    });
  });

  describe("Step Management", function () {
    it("Should allow admin to update step configuration", async function () {
      await expect(onboardingQuests.updateStepConfig(
        OnboardingStep.PROFILE_CREATION,
        "Updated Title",
        "Updated Description",
        "Updated Instructions",
        75, // Updated XP reward
        "ipfs://updated-badge",
        true,
        3600 // 1 hour time limit
      )).to.emit(onboardingQuests, "StepConfigUpdated")
        .withArgs(OnboardingStep.PROFILE_CREATION, "Updated Title", 75);

      const updatedStep = await onboardingQuests.stepConfigs(OnboardingStep.PROFILE_CREATION);
      expect(updatedStep.title).to.equal("Updated Title");
      expect(updatedStep.xpReward).to.equal(75);
      expect(updatedStep.timeLimit).to.equal(3600);
    });

    it("Should prevent non-admin from updating step configuration", async function () {
      await expect(onboardingQuests.connect(user1).updateStepConfig(
        OnboardingStep.PROFILE_CREATION,
        "Unauthorized Update",
        "Description",
        "Instructions",
        100,
        "ipfs://badge",
        true,
        0
      )).to.be.reverted;
    });

    it("Should prevent completing inactive steps", async function () {
      // Deactivate the first step
      await onboardingQuests.updateStepConfig(
        OnboardingStep.PROFILE_CREATION,
        "Create Your Profile",
        "Set up your unique identity in the Forge Empire",
        "Go to Profile settings and choose a username",
        50,
        "ipfs://badges/welcome-badge",
        false, // Inactive
        0
      );

      await onboardingQuests.connect(user1).startOnboarding();
      
      await expect(onboardingQuests.connect(user1).completeStep(OnboardingStep.PROFILE_CREATION))
        .to.be.revertedWithCustomError(onboardingQuests, "StepNotActive");
    });
  });

  describe("Time Limits", function () {
    beforeEach(async function () {
      // Set a short time limit for testing
      await onboardingQuests.updateStepConfig(
        OnboardingStep.PROFILE_CREATION,
        "Create Your Profile",
        "Set up your unique identity in the Forge Empire",
        "Go to Profile settings and choose a username",
        50,
        "ipfs://badges/welcome-badge",
        true,
        1 // 1 second time limit
      );
    });

    it("Should enforce time limits when set", async function () {
      await onboardingQuests.connect(user1).startOnboarding();
      
      // Wait for time limit to pass
      await ethers.provider.send("evm_increaseTime", [2]); // 2 seconds
      await ethers.provider.send("evm_mine");

      await expect(onboardingQuests.connect(user1).completeStep(OnboardingStep.PROFILE_CREATION))
        .to.be.revertedWithCustomError(onboardingQuests, "StepTimeLimitExceeded");
    });

    it("Should allow completion within time limit", async function () {
      await onboardingQuests.connect(user1).startOnboarding();
      
      // Complete immediately (within 1 second)
      await expect(onboardingQuests.connect(user1).completeStep(OnboardingStep.PROFILE_CREATION))
        .to.emit(onboardingQuests, "StepCompleted");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await onboardingQuests.connect(user1).startOnboarding();
      await onboardingQuests.connect(user1).completeStep(OnboardingStep.PROFILE_CREATION);
    });

    it("Should return correct user progress", async function () {
      const progress = await onboardingQuests.getUserProgress(user1.address);
      
      expect(progress.currentStep).to.equal(1);
      expect(progress.completedSteps).to.equal(1);
      expect(progress.totalXPEarned).to.equal(50);
      expect(progress.isCompleted).to.be.false;
      expect(progress.startedAt).to.be.gt(0);
    });

    it("Should return next step information", async function () {
      const [step, config] = await onboardingQuests.getNextStep(user1.address);
      
      expect(step).to.equal(OnboardingStep.QUEST_EXPLORATION);
      expect(config.title).to.equal("Discover Quests");
      expect(config.xpReward).to.equal(100);
    });

    it("Should revert when getting next step for completed onboarding", async function () {
      // Complete all steps
      for (let i = 1; i < 5; i++) {
        await onboardingQuests.connect(user1).completeStep(i);
      }

      await expect(onboardingQuests.getNextStep(user1.address))
        .to.be.revertedWithCustomError(onboardingQuests, "InvalidStep");
    });

    it("Should return correct onboarding statistics", async function () {
      await onboardingQuests.connect(user2).startOnboarding();
      
      // Complete onboarding for user1
      for (let i = 1; i < 5; i++) {
        await onboardingQuests.connect(user1).completeStep(i);
      }

      const [totalStarted, totalCompleted, completionRate] = await onboardingQuests.getOnboardingStats();
      
      expect(totalStarted).to.equal(2);
      expect(totalCompleted).to.equal(1);
      expect(completionRate).to.equal(5000); // 50% in basis points
    });

    it("Should handle zero completion rate correctly", async function () {
      // Reset by deploying new contract with no users
      const OnboardingQuests = await ethers.getContractFactory("OnboardingQuests");
      const newOnboarding = await upgrades.deployProxy(OnboardingQuests, [
        await xpEngine.getAddress(),
        await mockBadgeMinter.getAddress()
      ], { initializer: 'initialize' });

      const [totalStarted, totalCompleted, completionRate] = await newOnboarding.getOnboardingStats();
      
      expect(totalStarted).to.equal(0);
      expect(totalCompleted).to.equal(0);
      expect(completionRate).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to pause and unpause", async function () {
      await onboardingQuests.pause();
      expect(await onboardingQuests.paused()).to.be.true;

      await expect(onboardingQuests.connect(user1).startOnboarding())
        .to.be.revertedWithCustomError(onboardingQuests, "EnforcedPause");

      await onboardingQuests.unpause();
      expect(await onboardingQuests.paused()).to.be.false;

      await expect(onboardingQuests.connect(user1).startOnboarding())
        .to.emit(onboardingQuests, "OnboardingStarted");
    });

    it("Should prevent non-admin from pausing", async function () {
      await expect(onboardingQuests.connect(user1).pause())
        .to.be.reverted;
    });
  });

  describe("Integration", function () {
    it("Should correctly award XP through XPEngine", async function () {
      await onboardingQuests.connect(user1).startOnboarding();
      await onboardingQuests.connect(user1).completeStep(OnboardingStep.PROFILE_CREATION);

      expect(await xpEngine.getXP(user1.address)).to.equal(50);
    });

    it("Should correctly mint badges through BadgeMinter", async function () {
      await onboardingQuests.connect(user1).startOnboarding();
      await onboardingQuests.connect(user1).completeStep(OnboardingStep.PROFILE_CREATION);

      expect(await mockBadgeMinter.balanceOf(user1.address)).to.equal(1);
      expect(await mockBadgeMinter.ownerOf(1)).to.equal(user1.address);
    });
  });
});

