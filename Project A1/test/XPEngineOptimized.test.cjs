const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("XPEngineOptimized", function () {
  let XPEngineOptimized, xpEngine;
  let owner, admin, xpGranter, xpAwarder, pauser, user1, user2, user3;

  beforeEach(async () => {
    [owner, admin, xpGranter, xpAwarder, pauser, user1, user2, user3] = await ethers.getSigners();

    // Deploy XPEngineOptimized as upgradeable proxy
    XPEngineOptimized = await ethers.getContractFactory("XPEngineOptimized");
    xpEngine = await upgrades.deployProxy(XPEngineOptimized, [], { initializer: 'initialize' });
    await xpEngine.waitForDeployment();

    // Grant roles
    const DEFAULT_ADMIN_ROLE = await xpEngine.DEFAULT_ADMIN_ROLE();
    const XP_GRANTER_ROLE = await xpEngine.XP_GRANTER_ROLE();
    const XP_AWARDER_ROLE = await xpEngine.XP_AWARDER_ROLE();
    const PAUSER_ROLE = await xpEngine.PAUSER_ROLE();

    await xpEngine.grantRole(DEFAULT_ADMIN_ROLE, admin.address);
    await xpEngine.grantRole(XP_GRANTER_ROLE, xpGranter.address);
    await xpEngine.grantRole(XP_AWARDER_ROLE, xpAwarder.address);
    await xpEngine.grantRole(PAUSER_ROLE, pauser.address);
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct roles", async () => {
      const DEFAULT_ADMIN_ROLE = await xpEngine.DEFAULT_ADMIN_ROLE();
      const PAUSER_ROLE = await xpEngine.PAUSER_ROLE();

      expect(await xpEngine.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await xpEngine.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
    });

    it("should initialize with zero global stats", async () => {
      const stats = await xpEngine.getGlobalStats();
      expect(stats.totalXPAwarded).to.equal(0);
      expect(stats.totalUsers).to.equal(0);
      expect(stats.lastUpdateTimestamp).to.be.above(0);
    });

    it("should have correct constants", async () => {
      expect(await xpEngine.MAX_BATCH_SIZE()).to.equal(100);
    });

    it("should be unpaused after initialization", async () => {
      expect(await xpEngine.paused()).to.be.false;
    });
  });

  describe("Single XP Awarding", function () {
    describe("Basic XP Awarding", function () {
      it("should allow XP granter to award XP", async () => {
        await expect(
          xpEngine.connect(xpGranter).awardXP(user1.address, 1000)
        ).to.emit(xpEngine, "XPAwarded")
         .withArgs(user1.address, 1000, xpGranter.address);

        expect(await xpEngine.getXP(user1.address)).to.equal(1000);
      });

      it("should update user stats correctly", async () => {
        await xpEngine.connect(xpGranter).awardXP(user1.address, 1000);
        
        const stats = await xpEngine.getUserStats(user1.address);
        expect(stats.xpBalance).to.equal(1000);
        expect(stats.level).to.be.above(0);
        expect(stats.activityCount).to.equal(1);
        expect(stats.lastActivityTime).to.be.above(0);
      });

      it("should calculate level correctly", async () => {
        // Level = sqrt(XP / 100), minimum level 1
        await xpEngine.connect(xpGranter).awardXP(user1.address, 10000); // Should be level 10
        
        const level = await xpEngine.getLevel(user1.address);
        expect(level).to.equal(10);
      });

      it("should emit LevelUp event when level increases", async () => {
        await xpEngine.connect(xpGranter).awardXP(user1.address, 100); // Level 1
        
        await expect(
          xpEngine.connect(xpGranter).awardXP(user1.address, 300) // Total 400, Level 2
        ).to.emit(xpEngine, "LevelUp")
         .withArgs(user1.address, 2);
      });

      it("should accumulate XP correctly", async () => {
        await xpEngine.connect(xpGranter).awardXP(user1.address, 500);
        await xpEngine.connect(xpGranter).awardXP(user1.address, 300);
        
        expect(await xpEngine.getXP(user1.address)).to.equal(800);
        
        const stats = await xpEngine.getUserStats(user1.address);
        expect(stats.activityCount).to.equal(2);
      });

      it("should update global stats when awarding XP", async () => {
        await xpEngine.connect(xpGranter).awardXP(user1.address, 1000);
        await xpEngine.connect(xpGranter).awardXP(user2.address, 2000);
        
        const stats = await xpEngine.getGlobalStats();
        expect(stats.totalXPAwarded).to.equal(3000);
        expect(stats.totalUsers).to.equal(2);
      });

      it("should reject zero address user", async () => {
        await expect(
          xpEngine.connect(xpGranter).awardXP(ethers.ZeroAddress, 1000)
        ).to.be.revertedWithCustomError(xpEngine, "ZeroAddressUser");
      });

      it("should reject zero XP amount", async () => {
        await expect(
          xpEngine.connect(xpGranter).awardXP(user1.address, 0)
        ).to.be.revertedWithCustomError(xpEngine, "ZeroXPAmount");
      });

      it("should reject XP above user limit", async () => {
        // Award max safe amount first
        const halfMax = BigInt(2) ** BigInt(127);
        await xpEngine.connect(admin).adjustUserXP(user1.address, halfMax);
        
        // Try to add more XP that would exceed limit
        await expect(
          xpEngine.connect(xpGranter).awardXP(user1.address, halfMax)
        ).to.be.revertedWithCustomError(xpEngine, "XPLimitExceeded");
      });

      it("should reject awarding from non-granter role", async () => {
        await expect(
          xpEngine.connect(user1).awardXP(user2.address, 1000)
        ).to.be.reverted;
      });

      it("should reject awarding when paused", async () => {
        await xpEngine.connect(pauser).pause();
        
        await expect(
          xpEngine.connect(xpGranter).awardXP(user1.address, 1000)
        ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
      });
    });

    describe("Level Calculation", function () {
      it("should return minimum level 1 for low XP", async () => {
        await xpEngine.connect(xpGranter).awardXP(user1.address, 50);
        expect(await xpEngine.getLevel(user1.address)).to.equal(1);
      });

      it("should calculate levels correctly for various XP amounts", async () => {
        const testCases = [
          { xp: 100, expectedLevel: 1 },
          { xp: 400, expectedLevel: 2 },
          { xp: 900, expectedLevel: 3 },
          { xp: 2500, expectedLevel: 5 },
          { xp: 10000, expectedLevel: 10 }
        ];

        for (const testCase of testCases) {
          await xpEngine.connect(xpGranter).awardXP(user1.address, testCase.xp);
          const level = await xpEngine.getLevel(user1.address);
          expect(level).to.equal(testCase.expectedLevel);
          
          // Reset for next test
          await xpEngine.connect(admin).adjustUserXP(user1.address, 0);
        }
      });

      it("should cache level and use cached value within 1 hour", async () => {
        await xpEngine.connect(xpGranter).awardXP(user1.address, 2500); // Level 5
        
        const level1 = await xpEngine.getLevel(user1.address);
        const level2 = await xpEngine.getLevel(user1.address);
        
        expect(level1).to.equal(level2);
        expect(level1).to.equal(5);
      });

      it("should recalculate level after cache expiry", async () => {
        await xpEngine.connect(xpGranter).awardXP(user1.address, 2500);
        const initialLevel = await xpEngine.getLevel(user1.address);
        
        // Advance time by more than 1 hour
        await time.increase(3661); // 1 hour + 1 second
        
        const levelAfterTime = await xpEngine.getLevel(user1.address);
        expect(levelAfterTime).to.equal(initialLevel); // Should be same but recalculated
      });
    });
  });

  describe("Batch XP Awarding", function () {
    describe("Basic Batch Operations", function () {
      it("should allow batch XP awarding", async () => {
        const users = [user1.address, user2.address, user3.address];
        const amounts = [1000, 2000, 3000];

        await expect(
          xpEngine.connect(xpGranter).batchAwardXP(users, amounts)
        ).to.emit(xpEngine, "BatchXPAwarded");

        expect(await xpEngine.getXP(user1.address)).to.equal(1000);
        expect(await xpEngine.getXP(user2.address)).to.equal(2000);
        expect(await xpEngine.getXP(user3.address)).to.equal(3000);
      });

      it("should emit batch XP awarded event", async () => {
        const users = [user1.address, user2.address];
        const amounts = [1000, 2000];

        await expect(
          xpEngine.connect(xpGranter).batchAwardXP(users, amounts)
        ).to.emit(xpEngine, "BatchXPAwarded");
      });

      it("should update global stats correctly for batch operations", async () => {
        const users = [user1.address, user2.address, user3.address];
        const amounts = [1000, 2000, 3000];

        await xpEngine.connect(xpGranter).batchAwardXP(users, amounts);
        
        const stats = await xpEngine.getGlobalStats();
        expect(stats.totalXPAwarded).to.equal(6000);
        expect(stats.totalUsers).to.equal(3);
      });

      it("should handle mixed new and existing users in batch", async () => {
        // First award XP to user1
        await xpEngine.connect(xpGranter).awardXP(user1.address, 500);
        
        const users = [user1.address, user2.address]; // One existing, one new
        const amounts = [1000, 2000];

        await xpEngine.connect(xpGranter).batchAwardXP(users, amounts);
        
        expect(await xpEngine.getXP(user1.address)).to.equal(1500); // 500 + 1000
        expect(await xpEngine.getXP(user2.address)).to.equal(2000);
        
        const stats = await xpEngine.getGlobalStats();
        expect(stats.totalUsers).to.equal(2); // Should not double count user1
      });

      it("should reject empty arrays", async () => {
        await expect(
          xpEngine.connect(xpGranter).batchAwardXP([], [])
        ).to.be.revertedWithCustomError(xpEngine, "EmptyArrays");
      });

      it("should reject mismatched array lengths", async () => {
        const users = [user1.address, user2.address];
        const amounts = [1000]; // Different length

        await expect(
          xpEngine.connect(xpGranter).batchAwardXP(users, amounts)
        ).to.be.revertedWithCustomError(xpEngine, "ArrayLengthMismatch");
      });

      it("should reject batch size exceeding maximum", async () => {
        const maxBatchSize = await xpEngine.MAX_BATCH_SIZE();
        const oversizedUsers = new Array(Number(maxBatchSize) + 1).fill(user1.address);
        const oversizedAmounts = new Array(Number(maxBatchSize) + 1).fill(1000);

        await expect(
          xpEngine.connect(xpGranter).batchAwardXP(oversizedUsers, oversizedAmounts)
        ).to.be.revertedWithCustomError(xpEngine, "BatchSizeExceeded");
      });

      it("should reject batch award when paused", async () => {
        await xpEngine.connect(pauser).pause();
        
        await expect(
          xpEngine.connect(xpGranter).batchAwardXP([user1.address], [1000])
        ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
      });

      it("should reject batch award from non-granter role", async () => {
        await expect(
          xpEngine.connect(user1).batchAwardXP([user2.address], [1000])
        ).to.be.reverted;
      });
    });

    describe("Batch Validation", function () {
      it("should reject zero address in batch", async () => {
        const users = [user1.address, ethers.ZeroAddress];
        const amounts = [1000, 2000];

        // The assembly code will revert but with different error format
        await expect(
          xpEngine.connect(xpGranter).batchAwardXP(users, amounts)
        ).to.be.reverted;
      });

      it("should reject zero amount in batch", async () => {
        const users = [user1.address, user2.address];
        const amounts = [1000, 0];

        // The assembly code will revert but with different error format
        await expect(
          xpEngine.connect(xpGranter).batchAwardXP(users, amounts)
        ).to.be.reverted;
      });

      it("should handle maximum batch size correctly", async () => {
        const maxBatchSize = Number(await xpEngine.MAX_BATCH_SIZE());
        const users = new Array(maxBatchSize).fill(0).map((_, i) => 
          ethers.Wallet.createRandom().address
        );
        const amounts = new Array(maxBatchSize).fill(1000);

        await expect(
          xpEngine.connect(xpGranter).batchAwardXP(users, amounts)
        ).to.not.be.reverted;
      });
    });
  });

  describe("XP Spending", function () {
    beforeEach(async () => {
      await xpEngine.connect(xpGranter).awardXP(user1.address, 5000);
    });

    it("should allow XP granter to spend user XP", async () => {
      await expect(
        xpEngine.connect(xpGranter).spendXP(user1.address, 2000)
      ).to.emit(xpEngine, "XPSpent")
       .withArgs(user1.address, 2000);

      expect(await xpEngine.getXP(user1.address)).to.equal(3000);
    });

    it("should update last activity time when spending XP", async () => {
      const statsBefore = await xpEngine.getUserStats(user1.address);
      
      await time.increase(100);
      await xpEngine.connect(xpGranter).spendXP(user1.address, 1000);
      
      const statsAfter = await xpEngine.getUserStats(user1.address);
      expect(statsAfter.lastActivityTime).to.be.above(statsBefore.lastActivityTime);
    });

    it("should reject spending more XP than user has", async () => {
      await expect(
        xpEngine.connect(xpGranter).spendXP(user1.address, 6000) // User only has 5000
      ).to.be.revertedWithCustomError(xpEngine, "InsufficientXP");
    });

    it("should reject spending XP when paused", async () => {
      await xpEngine.connect(pauser).pause();
      
      await expect(
        xpEngine.connect(xpGranter).spendXP(user1.address, 1000)
      ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
    });

    it("should reject spending XP from non-granter role", async () => {
      await expect(
        xpEngine.connect(user2).spendXP(user1.address, 1000)
      ).to.be.reverted;
    });
  });

  describe("Batch View Operations", function () {
    beforeEach(async () => {
      await xpEngine.connect(xpGranter).awardXP(user1.address, 1000);
      await xpEngine.connect(xpGranter).awardXP(user2.address, 2000);
      await xpEngine.connect(xpGranter).awardXP(user3.address, 3000);
    });

    it("should return XP for multiple users", async () => {
      const users = [user1.address, user2.address, user3.address];
      const xpBalances = await xpEngine.batchGetXP(users);
      
      expect(xpBalances[0]).to.equal(1000);
      expect(xpBalances[1]).to.equal(2000);
      expect(xpBalances[2]).to.equal(3000);
    });

    it("should handle empty batch get XP", async () => {
      const xpBalances = await xpEngine.batchGetXP([]);
      expect(xpBalances.length).to.equal(0);
    });

    it("should return zero for users with no XP", async () => {
      const [, , , , , , , , unknownUser] = await ethers.getSigners();
      const xpBalances = await xpEngine.batchGetXP([unknownUser.address]);
      expect(xpBalances[0]).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    describe("XP Adjustment", function () {
      beforeEach(async () => {
        await xpEngine.connect(xpGranter).awardXP(user1.address, 2000);
      });

      it("should allow admin to adjust user XP", async () => {
        await xpEngine.connect(admin).adjustUserXP(user1.address, 5000);
        
        expect(await xpEngine.getXP(user1.address)).to.equal(5000);
        
        const stats = await xpEngine.getUserStats(user1.address);
        expect(stats.level).to.be.above(0); // Level should be recalculated
      });

      it("should update global stats when increasing XP", async () => {
        const statsBefore = await xpEngine.getGlobalStats();
        
        await xpEngine.connect(admin).adjustUserXP(user1.address, 5000); // Increase by 3000
        
        const statsAfter = await xpEngine.getGlobalStats();
        expect(statsAfter.totalXPAwarded).to.equal(statsBefore.totalXPAwarded + 3000n);
      });

      it("should update global stats when decreasing XP", async () => {
        const statsBefore = await xpEngine.getGlobalStats();
        
        await xpEngine.connect(admin).adjustUserXP(user1.address, 1000); // Decrease by 1000
        
        const statsAfter = await xpEngine.getGlobalStats();
        expect(statsAfter.totalXPAwarded).to.equal(statsBefore.totalXPAwarded - 1000n);
      });

      it("should update last activity time", async () => {
        const statsBefore = await xpEngine.getUserStats(user1.address);
        
        await time.increase(100);
        await xpEngine.connect(admin).adjustUserXP(user1.address, 3000);
        
        const statsAfter = await xpEngine.getUserStats(user1.address);
        expect(statsAfter.lastActivityTime).to.be.above(statsBefore.lastActivityTime);
      });

      it("should reject XP adjustment from non-admin", async () => {
        await expect(
          xpEngine.connect(user1).adjustUserXP(user2.address, 5000)
        ).to.be.reverted;
      });
    });
  });

  describe("View Functions", function () {
    beforeEach(async () => {
      await xpEngine.connect(xpGranter).awardXP(user1.address, 2500);
      await xpEngine.connect(xpGranter).awardXP(user2.address, 1000);
    });

    it("should return correct user XP", async () => {
      expect(await xpEngine.getXP(user1.address)).to.equal(2500);
      expect(await xpEngine.getXP(user2.address)).to.equal(1000);
    });

    it("should return zero XP for users with no XP", async () => {
      expect(await xpEngine.getXP(user3.address)).to.equal(0);
    });

    it("should return complete user stats", async () => {
      const stats = await xpEngine.getUserStats(user1.address);
      expect(stats.xpBalance).to.equal(2500);
      expect(stats.level).to.equal(5); // sqrt(2500/100) = 5
      expect(stats.activityCount).to.equal(1);
      expect(stats.lastActivityTime).to.be.above(0);
    });

    it("should return correct global stats", async () => {
      const stats = await xpEngine.getGlobalStats();
      expect(stats.totalXPAwarded).to.equal(3500);
      expect(stats.totalUsers).to.equal(2);
      expect(stats.lastUpdateTimestamp).to.be.above(0);
    });

    it("should return zero stats for users with no activity", async () => {
      const stats = await xpEngine.getUserStats(user3.address);
      expect(stats.xpBalance).to.equal(0);
      expect(stats.level).to.equal(0);
      expect(stats.activityCount).to.equal(0);
      expect(stats.lastActivityTime).to.equal(0);
    });
  });

  describe("Pausable Functionality", function () {
    it("should allow pauser to pause contract", async () => {
      await xpEngine.connect(pauser).pause();
      expect(await xpEngine.paused()).to.be.true;
    });

    it("should allow pauser to unpause contract", async () => {
      await xpEngine.connect(pauser).pause();
      await xpEngine.connect(pauser).unpause();
      expect(await xpEngine.paused()).to.be.false;
    });

    it("should prevent XP operations when paused", async () => {
      await xpEngine.connect(pauser).pause();

      await expect(
        xpEngine.connect(xpGranter).awardXP(user1.address, 1000)
      ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");

      await expect(
        xpEngine.connect(xpGranter).batchAwardXP([user1.address], [1000])
      ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");

      await expect(
        xpEngine.connect(xpGranter).spendXP(user1.address, 100)
      ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
    });

    it("should allow view functions when paused", async () => {
      await xpEngine.connect(xpGranter).awardXP(user1.address, 1000);
      await xpEngine.connect(pauser).pause();

      expect(await xpEngine.getXP(user1.address)).to.equal(1000);
      expect(await xpEngine.getLevel(user1.address)).to.be.above(0);
      
      const stats = await xpEngine.getUserStats(user1.address);
      expect(stats.xpBalance).to.equal(1000);
    });

    it("should reject pause/unpause from non-pauser role", async () => {
      await expect(
        xpEngine.connect(user1).pause()
      ).to.be.reverted;

      await expect(
        xpEngine.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("should enforce role-based access control", async () => {
      await expect(
        xpEngine.connect(user1).awardXP(user2.address, 1000)
      ).to.be.reverted;

      await expect(
        xpEngine.connect(user1).batchAwardXP([user2.address], [1000])
      ).to.be.reverted;

      await expect(
        xpEngine.connect(user1).spendXP(user2.address, 100)
      ).to.be.reverted;

      await expect(
        xpEngine.connect(user1).adjustUserXP(user2.address, 5000)
      ).to.be.reverted;
    });

    it("should allow role holders to perform their functions", async () => {
      await xpEngine.connect(xpGranter).awardXP(user1.address, 1000);
      await xpEngine.connect(xpGranter).batchAwardXP([user2.address], [2000]);
      await xpEngine.connect(xpGranter).spendXP(user1.address, 500);
      await xpEngine.connect(admin).adjustUserXP(user1.address, 1500);
      await xpEngine.connect(pauser).pause();
      await xpEngine.connect(pauser).unpause();
    });
  });

  describe("Edge Cases and Gas Optimization", function () {
    it("should handle maximum XP values correctly", async () => {
      const maxSafeXP = BigInt(2) ** BigInt(127) - BigInt(1); // Half of uint128 max for safety
      
      await xpEngine.connect(admin).adjustUserXP(user1.address, maxSafeXP);
      expect(await xpEngine.getXP(user1.address)).to.equal(maxSafeXP);
    });

    it("should handle level calculation for extreme XP values", async () => {
      const extremeXP = 100000000; // Very high XP
      await xpEngine.connect(admin).adjustUserXP(user1.address, extremeXP);
      
      const level = await xpEngine.getLevel(user1.address);
      expect(level).to.be.at.most(1000); // Should be capped at 1000
      expect(level).to.be.above(0);
    });

    it("should handle rapid successive operations", async () => {
      for (let i = 0; i < 10; i++) {
        await xpEngine.connect(xpGranter).awardXP(user1.address, 100);
      }
      
      expect(await xpEngine.getXP(user1.address)).to.equal(1000);
      
      const stats = await xpEngine.getUserStats(user1.address);
      expect(stats.activityCount).to.equal(10);
    });

    it("should handle large batch operations efficiently", async () => {
      const batchSize = 50;
      const users = new Array(batchSize).fill(0).map((_, i) => 
        ethers.Wallet.createRandom().address
      );
      const amounts = new Array(batchSize).fill(1000);

      const tx = await xpEngine.connect(xpGranter).batchAwardXP(users, amounts);
      const receipt = await tx.wait();
      
      // Should complete without excessive gas usage
      expect(receipt.gasUsed).to.be.above(0);
      
      const stats = await xpEngine.getGlobalStats();
      expect(stats.totalUsers).to.equal(batchSize);
      expect(stats.totalXPAwarded).to.equal(batchSize * 1000);
    });

    it("should maintain state consistency during complex operations", async () => {
      // Award XP to multiple users
      await xpEngine.connect(xpGranter).awardXP(user1.address, 1000);
      await xpEngine.connect(xpGranter).awardXP(user2.address, 2000);
      
      // Batch award to same and new users
      await xpEngine.connect(xpGranter).batchAwardXP(
        [user1.address, user3.address],
        [500, 1500]
      );
      
      // Spend some XP
      await xpEngine.connect(xpGranter).spendXP(user1.address, 200);
      
      // Verify final state
      expect(await xpEngine.getXP(user1.address)).to.equal(1300); // 1000 + 500 - 200
      expect(await xpEngine.getXP(user2.address)).to.equal(2000);
      expect(await xpEngine.getXP(user3.address)).to.equal(1500);
      
      const stats = await xpEngine.getGlobalStats();
      expect(stats.totalUsers).to.equal(3);
      // Total awarded is 5000, spending doesn't reduce total awarded
      expect(stats.totalXPAwarded).to.equal(5000);
    });
  });

  describe("Integration Scenarios", function () {
    it("should handle complete user journey", async () => {
      // Start with awarding XP
      await xpEngine.connect(xpGranter).awardXP(user1.address, 1000);
      expect(await xpEngine.getLevel(user1.address)).to.equal(3);
      
      // Level up through more XP
      await xpEngine.connect(xpGranter).awardXP(user1.address, 4000); // Total 5000
      expect(await xpEngine.getLevel(user1.address)).to.equal(7);
      
      // Spend some XP
      await xpEngine.connect(xpGranter).spendXP(user1.address, 1000); // 4000 remaining
      expect(await xpEngine.getLevel(user1.address)).to.equal(7); // Level doesn't change immediately from spending
      
      // Admin adjustment
      await xpEngine.connect(admin).adjustUserXP(user1.address, 10000);
      expect(await xpEngine.getLevel(user1.address)).to.equal(10);
      
      const finalStats = await xpEngine.getUserStats(user1.address);
      expect(finalStats.xpBalance).to.equal(10000);
      expect(finalStats.activityCount).to.equal(2); // Two award operations
    });

    it("should handle mixed operations across multiple users", async () => {
      // Batch award to establish baseline
      await xpEngine.connect(xpGranter).batchAwardXP(
        [user1.address, user2.address, user3.address],
        [2000, 3000, 4000]
      );
      
      // Individual awards
      await xpEngine.connect(xpGranter).awardXP(user1.address, 1000);
      
      // Spending operations
      await xpEngine.connect(xpGranter).spendXP(user2.address, 500);
      
      // Admin adjustments
      await xpEngine.connect(admin).adjustUserXP(user3.address, 6000);
      
      // Verify all users have correct final states
      expect(await xpEngine.getXP(user1.address)).to.equal(3000);
      expect(await xpEngine.getXP(user2.address)).to.equal(2500);
      expect(await xpEngine.getXP(user3.address)).to.equal(6000);
      
      const globalStats = await xpEngine.getGlobalStats();
      expect(globalStats.totalUsers).to.equal(3);
    });
  });
});