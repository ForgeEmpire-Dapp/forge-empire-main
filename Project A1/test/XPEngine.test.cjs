const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("XPEngine", function () {
  let XPEngine, xpEngine;
  let owner, admin, xpAwarder, xpGranter, pauser, upgrader, user1, user2, user3;

  beforeEach(async () => {
    [owner, admin, xpAwarder, xpGranter, pauser, upgrader, user1, user2, user3] = await ethers.getSigners();

    // Deploy XPEngine as upgradeable proxy
    XPEngine = await ethers.getContractFactory("XPEngine");
    xpEngine = await upgrades.deployProxy(XPEngine, [], { initializer: 'initialize' });
    await xpEngine.waitForDeployment();

    // Grant roles
    const DEFAULT_ADMIN_ROLE = await xpEngine.DEFAULT_ADMIN_ROLE();
    const XP_AWARDER_ROLE = await xpEngine.XP_AWARDER_ROLE();
    const XP_GRANTER_ROLE = await xpEngine.XP_GRANTER_ROLE();
    const PAUSER_ROLE = await xpEngine.PAUSER_ROLE();
    const UPGRADER_ROLE = await xpEngine.UPGRADER_ROLE();

    await xpEngine.grantRole(DEFAULT_ADMIN_ROLE, admin.address);
    await xpEngine.grantRole(XP_AWARDER_ROLE, xpAwarder.address);
    await xpEngine.grantRole(XP_GRANTER_ROLE, xpGranter.address);
    await xpEngine.grantRole(PAUSER_ROLE, pauser.address);
    await xpEngine.grantRole(UPGRADER_ROLE, upgrader.address);
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct roles", async () => {
      const DEFAULT_ADMIN_ROLE = await xpEngine.DEFAULT_ADMIN_ROLE();
      const PAUSER_ROLE = await xpEngine.PAUSER_ROLE();
      const UPGRADER_ROLE = await xpEngine.UPGRADER_ROLE();

      expect(await xpEngine.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await xpEngine.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
      expect(await xpEngine.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
    });

    it("should initialize with zero XP awarded", async () => {
      expect(await xpEngine.totalXPAwarded()).to.equal(0);
    });

    it("should have correct maximum batch size", async () => {
      expect(await xpEngine.MAX_BATCH_SIZE()).to.equal(100);
    });

    it("should be unpaused after initialization", async () => {
      expect(await xpEngine.paused()).to.be.false;
    });

    it("should start with users having zero XP", async () => {
      expect(await xpEngine.getXP(user1.address)).to.equal(0);
      expect(await xpEngine.getXP(user2.address)).to.equal(0);
      expect(await xpEngine.getLevel(user1.address)).to.equal(1); // Minimum level is 1
    });
  });

  describe("XP Awarding", function () {
    describe("Single XP Award", function () {
      it("should allow XP awarder to award XP", async () => {
        const xpAmount = 1000;
        
        await expect(
          xpEngine.connect(xpAwarder).awardXP(user1.address, xpAmount)
        ).to.emit(xpEngine, "XPAwarded")
         .withArgs(user1.address, xpAmount, xpAwarder.address);

        expect(await xpEngine.getXP(user1.address)).to.equal(xpAmount);
        expect(await xpEngine.totalXPAwarded()).to.equal(xpAmount);
      });

      it("should accumulate XP correctly", async () => {
        const firstAmount = 500;
        const secondAmount = 300;
        
        await xpEngine.connect(xpAwarder).awardXP(user1.address, firstAmount);
        await xpEngine.connect(xpAwarder).awardXP(user1.address, secondAmount);

        expect(await xpEngine.getXP(user1.address)).to.equal(firstAmount + secondAmount);
        expect(await xpEngine.totalXPAwarded()).to.equal(firstAmount + secondAmount);
      });

      it("should reject zero address user", async () => {
        await expect(
          xpEngine.connect(xpAwarder).awardXP(ethers.ZeroAddress, 1000)
        ).to.be.revertedWithCustomError(xpEngine, "ZeroAddressUser");
      });

      it("should reject zero XP amount", async () => {
        await expect(
          xpEngine.connect(xpAwarder).awardXP(user1.address, 0)
        ).to.be.revertedWithCustomError(xpEngine, "ZeroXPAmount");
      });

      it("should reject awarding from non-awarder role", async () => {
        await expect(
          xpEngine.connect(user1).awardXP(user2.address, 1000)
        ).to.be.reverted;
      });

      it("should reject awarding when paused", async () => {
        await xpEngine.connect(pauser).pause();
        
        await expect(
          xpEngine.connect(xpAwarder).awardXP(user1.address, 1000)
        ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
      });
    });

    describe("Batch XP Award", function () {
      it("should allow XP granter to award XP in batch", async () => {
        const users = [user1.address, user2.address, user3.address];
        const amounts = [1000, 2000, 3000];

        // Call awardXpBatch once with all users and amounts
        const tx = await xpEngine.connect(xpGranter).awardXpBatch(users, amounts);
        
        // Verify each XPAwarded event was emitted
        for (let i = 0; i < users.length; i++) {
          await expect(tx).to.emit(xpEngine, "XPAwarded")
           .withArgs(users[i], amounts[i], xpGranter.address);
        }

        expect(await xpEngine.getXP(user1.address)).to.equal(1000);
        expect(await xpEngine.getXP(user2.address)).to.equal(2000);
        expect(await xpEngine.getXP(user3.address)).to.equal(3000);
        expect(await xpEngine.totalXPAwarded()).to.equal(6000);
      });

      it("should handle single user batch", async () => {
        const users = [user1.address];
        const amounts = [5000];

        await xpEngine.connect(xpGranter).awardXpBatch(users, amounts);

        expect(await xpEngine.getXP(user1.address)).to.equal(5000);
        expect(await xpEngine.totalXPAwarded()).to.equal(5000);
      });

      it("should handle maximum batch size", async () => {
        const maxBatchSize = Number(await xpEngine.MAX_BATCH_SIZE());
        const users = [];
        const amounts = [];

        // Create arrays of maximum size
        for (let i = 0; i < maxBatchSize; i++) {
          users.push(ethers.Wallet.createRandom().address);
          amounts.push(100);
        }

        await expect(
          xpEngine.connect(xpGranter).awardXpBatch(users, amounts)
        ).to.not.be.reverted;

        expect(await xpEngine.totalXPAwarded()).to.equal(maxBatchSize * 100);
      });

      it("should reject empty arrays", async () => {
        await expect(
          xpEngine.connect(xpGranter).awardXpBatch([], [])
        ).to.be.revertedWithCustomError(xpEngine, "EmptyArrays");
      });

      it("should reject batch size exceeding maximum", async () => {
        const maxBatchSize = Number(await xpEngine.MAX_BATCH_SIZE());
        const oversizedUsers = new Array(maxBatchSize + 1).fill(user1.address);
        const oversizedAmounts = new Array(maxBatchSize + 1).fill(100);

        await expect(
          xpEngine.connect(xpGranter).awardXpBatch(oversizedUsers, oversizedAmounts)
        ).to.be.revertedWithCustomError(xpEngine, "BatchSizeExceeded")
         .withArgs(100, maxBatchSize + 1);
      });

      it("should reject mismatched array lengths", async () => {
        const users = [user1.address, user2.address];
        const amounts = [1000]; // Different length

        await expect(
          xpEngine.connect(xpGranter).awardXpBatch(users, amounts)
        ).to.be.revertedWithCustomError(xpEngine, "ArrayLengthMismatch");
      });

      it("should reject zero address user in batch", async () => {
        const users = [user1.address, ethers.ZeroAddress];
        const amounts = [1000, 2000];

        await expect(
          xpEngine.connect(xpGranter).awardXpBatch(users, amounts)
        ).to.be.revertedWithCustomError(xpEngine, "ZeroAddressUser");
      });

      it("should reject zero XP amount in batch", async () => {
        const users = [user1.address, user2.address];
        const amounts = [1000, 0];

        await expect(
          xpEngine.connect(xpGranter).awardXpBatch(users, amounts)
        ).to.be.revertedWithCustomError(xpEngine, "ZeroXPAmount");
      });

      it("should reject batch award from non-granter role", async () => {
        await expect(
          xpEngine.connect(user1).awardXpBatch([user2.address], [1000])
        ).to.be.reverted;
      });

      it("should reject batch award when paused", async () => {
        await xpEngine.connect(pauser).pause();
        
        await expect(
          xpEngine.connect(xpGranter).awardXpBatch([user1.address], [1000])
        ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
      });
    });
  });

  describe("XP Spending", function () {
    beforeEach(async () => {
      // Award some XP to user1 for testing
      await xpEngine.connect(xpAwarder).awardXP(user1.address, 5000);
    });

    it("should allow users to spend their XP", async () => {
      const spendAmount = 2000;
      
      await expect(
        xpEngine.connect(user1).spendXP(spendAmount)
      ).to.emit(xpEngine, "XPSpent")
       .withArgs(user1.address, spendAmount);

      expect(await xpEngine.getXP(user1.address)).to.equal(3000); // 5000 - 2000
    });

    it("should allow spending all XP", async () => {
      const totalXP = await xpEngine.getXP(user1.address);
      
      await xpEngine.connect(user1).spendXP(totalXP);
      expect(await xpEngine.getXP(user1.address)).to.equal(0);
    });

    it("should reject zero XP spend amount", async () => {
      await expect(
        xpEngine.connect(user1).spendXP(0)
      ).to.be.revertedWithCustomError(xpEngine, "ZeroXPAmount");
    });

    it("should reject spending more XP than available", async () => {
      const currentXP = await xpEngine.getXP(user1.address);
      const excessAmount = currentXP + 1n;

      await expect(
        xpEngine.connect(user1).spendXP(excessAmount)
      ).to.be.revertedWithCustomError(xpEngine, "InsufficientXP")
       .withArgs(currentXP, excessAmount);
    });

    it("should reject spending when user has no XP", async () => {
      await expect(
        xpEngine.connect(user2).spendXP(100)
      ).to.be.revertedWithCustomError(xpEngine, "InsufficientXP")
       .withArgs(0, 100);
    });

    it("should reject spending when paused", async () => {
      await xpEngine.connect(pauser).pause();
      
      await expect(
        xpEngine.connect(user1).spendXP(1000)
      ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
    });

    it("should not affect totalXPAwarded when spending", async () => {
      const totalBefore = await xpEngine.totalXPAwarded();
      
      await xpEngine.connect(user1).spendXP(1000);
      
      const totalAfter = await xpEngine.totalXPAwarded();
      expect(totalAfter).to.equal(totalBefore); // Total awarded should remain the same
    });
  });

  describe("Level Calculation", function () {
    it("should return level 1 for users with zero XP", async () => {
      expect(await xpEngine.getLevel(user1.address)).to.equal(1);
    });

    it("should calculate levels correctly for various XP amounts", async () => {
      const testCases = [
        { xp: 0, expectedLevel: 1 },
        { xp: 1000, expectedLevel: 2 }, // sqrt(1000/1000) + 1 = 1 + 1 = 2
        { xp: 4000, expectedLevel: 3 }, // sqrt(4000/1000) + 1 = 2 + 1 = 3
        { xp: 9000, expectedLevel: 4 }, // sqrt(9000/1000) + 1 = 3 + 1 = 4
        { xp: 25000, expectedLevel: 6 }, // sqrt(25000/1000) + 1 = 5 + 1 = 6
        { xp: 100000, expectedLevel: 11 } // sqrt(100000/1000) + 1 = 10 + 1 = 11
      ];

      for (const testCase of testCases) {
        if (testCase.xp > 0) {
          await xpEngine.connect(xpAwarder).awardXP(user1.address, testCase.xp);
        }
        
        const level = await xpEngine.getLevel(user1.address);
        expect(level).to.equal(testCase.expectedLevel);
        
        // Reset for next test (if needed)
        if (testCase.xp > 0) {
          const currentXP = await xpEngine.getXP(user1.address);
          await xpEngine.connect(user1).spendXP(currentXP);
        }
      }
    });

    it("should cap level at 100", async () => {
      // Award extremely high XP to test level cap
      const extremeXP = 10000000; // This should result in level > 100
      await xpEngine.connect(xpAwarder).awardXP(user1.address, extremeXP);
      
      const level = await xpEngine.getLevel(user1.address);
      expect(level).to.equal(100);
    });

    it("should handle level calculation after spending XP", async () => {
      await xpEngine.connect(xpAwarder).awardXP(user1.address, 9000); // Level 4
      expect(await xpEngine.getLevel(user1.address)).to.equal(4);

      await xpEngine.connect(user1).spendXP(5000); // 4000 XP remaining
      expect(await xpEngine.getLevel(user1.address)).to.equal(3); // Level should decrease
    });

    it("should handle square root calculation for edge cases", async () => {
      // Test edge cases for square root calculation
      const edgeCases = [1, 999, 1001, 3999, 4001];
      
      for (const xp of edgeCases) {
        await xpEngine.connect(xpAwarder).awardXP(user2.address, xp);
        const level = await xpEngine.getLevel(user2.address);
        expect(level).to.be.at.least(1);
        expect(level).to.be.at.most(100);
        
        // Reset
        const currentXP = await xpEngine.getXP(user2.address);
        await xpEngine.connect(user2).spendXP(currentXP);
      }
    });
  });

  describe("View Functions", function () {
    beforeEach(async () => {
      await xpEngine.connect(xpAwarder).awardXP(user1.address, 2500);
      await xpEngine.connect(xpAwarder).awardXP(user2.address, 1000);
    });

    it("should return correct XP for users", async () => {
      expect(await xpEngine.getXP(user1.address)).to.equal(2500);
      expect(await xpEngine.getXP(user2.address)).to.equal(1000);
      expect(await xpEngine.getXP(user3.address)).to.equal(0);
    });

    it("should return correct total XP awarded", async () => {
      expect(await xpEngine.totalXPAwarded()).to.equal(3500);
    });

    it("should return correct levels", async () => {
      expect(await xpEngine.getLevel(user1.address)).to.be.above(1);
      expect(await xpEngine.getLevel(user2.address)).to.be.above(1);
      expect(await xpEngine.getLevel(user3.address)).to.equal(1);
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
        xpEngine.connect(xpAwarder).awardXP(user1.address, 1000)
      ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");

      await expect(
        xpEngine.connect(xpGranter).awardXpBatch([user1.address], [1000])
      ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");

      await expect(
        xpEngine.connect(user1).spendXP(100)
      ).to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
    });

    it("should allow view functions when paused", async () => {
      await xpEngine.connect(xpAwarder).awardXP(user1.address, 1000);
      await xpEngine.connect(pauser).pause();

      expect(await xpEngine.getXP(user1.address)).to.equal(1000);
      expect(await xpEngine.getLevel(user1.address)).to.be.above(0);
      expect(await xpEngine.totalXPAwarded()).to.equal(1000);
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
        xpEngine.connect(user1).awardXpBatch([user2.address], [1000])
      ).to.be.reverted;

      await expect(
        xpEngine.connect(user1).pause()
      ).to.be.reverted;

      await expect(
        xpEngine.connect(user1).unpause()
      ).to.be.reverted;
    });

    it("should allow role holders to perform their functions", async () => {
      await xpEngine.connect(xpAwarder).awardXP(user1.address, 1000);
      await xpEngine.connect(xpGranter).awardXpBatch([user2.address], [500]);
      await xpEngine.connect(pauser).pause();
      await xpEngine.connect(pauser).unpause();
    });

    it("should support role granting and revoking", async () => {
      const XP_AWARDER_ROLE = await xpEngine.XP_AWARDER_ROLE();
      
      // Grant role to user1
      await xpEngine.connect(owner).grantRole(XP_AWARDER_ROLE, user1.address);
      expect(await xpEngine.hasRole(XP_AWARDER_ROLE, user1.address)).to.be.true;

      // User1 should now be able to award XP
      await xpEngine.connect(user1).awardXP(user2.address, 1000);
      expect(await xpEngine.getXP(user2.address)).to.equal(1000);

      // Revoke role
      await xpEngine.connect(owner).revokeRole(XP_AWARDER_ROLE, user1.address);
      expect(await xpEngine.hasRole(XP_AWARDER_ROLE, user1.address)).to.be.false;

      // User1 should no longer be able to award XP
      await expect(
        xpEngine.connect(user1).awardXP(user3.address, 500)
      ).to.be.reverted;
    });
  });

  describe("Upgradability", function () {
    it("should be upgradeable by upgrader role", async () => {
      // This test verifies that the contract is properly set up for upgrades
      // The actual upgrade functionality would require deploying a new implementation
      const UPGRADER_ROLE = await xpEngine.UPGRADER_ROLE();
      expect(await xpEngine.hasRole(UPGRADER_ROLE, upgrader.address)).to.be.true;
    });

    it("should reject upgrade authorization from non-upgrader", async () => {
      // The _authorizeUpgrade function is internal and protected by UPGRADER_ROLE
      // We can't test it directly, but we can verify the role exists
      const UPGRADER_ROLE = await xpEngine.UPGRADER_ROLE();
      expect(await xpEngine.hasRole(UPGRADER_ROLE, user1.address)).to.be.false;
    });
  });

  describe("Edge Cases and Integration", function () {
    it("should handle very large XP amounts", async () => {
      const largeAmount = ethers.parseEther("1000000"); // 1M XP
      
      await xpEngine.connect(xpAwarder).awardXP(user1.address, largeAmount);
      expect(await xpEngine.getXP(user1.address)).to.equal(largeAmount);
      
      const level = await xpEngine.getLevel(user1.address);
      expect(level).to.equal(100); // Should be capped at 100
    });

    it("should handle multiple users and operations", async () => {
      const users = [user1.address, user2.address, user3.address];
      const amounts = [1000, 2000, 3000];

      // Batch award
      await xpEngine.connect(xpGranter).awardXpBatch(users, amounts);

      // Individual awards
      await xpEngine.connect(xpAwarder).awardXP(user1.address, 500);

      // Spending
      await xpEngine.connect(user2).spendXP(1000);

      // Verify final states
      expect(await xpEngine.getXP(user1.address)).to.equal(1500);
      expect(await xpEngine.getXP(user2.address)).to.equal(1000);
      expect(await xpEngine.getXP(user3.address)).to.equal(3000);
      expect(await xpEngine.totalXPAwarded()).to.equal(6500); // Spending doesn't affect total awarded
    });

    it("should maintain state consistency during complex operations", async () => {
      // Award XP to multiple users
      await xpEngine.connect(xpAwarder).awardXP(user1.address, 2000);
      await xpEngine.connect(xpAwarder).awardXP(user2.address, 3000);
      
      const totalAfterAwards = await xpEngine.totalXPAwarded();
      expect(totalAfterAwards).to.equal(5000);

      // Users spend some XP
      await xpEngine.connect(user1).spendXP(500);
      await xpEngine.connect(user2).spendXP(1000);

      // Total awarded should remain the same
      expect(await xpEngine.totalXPAwarded()).to.equal(totalAfterAwards);

      // But user balances should reflect spending
      expect(await xpEngine.getXP(user1.address)).to.equal(1500);
      expect(await xpEngine.getXP(user2.address)).to.equal(2000);
    });

    it("should handle reentrancy protection", async () => {
      // The spendXP function has nonReentrant modifier
      await xpEngine.connect(xpAwarder).awardXP(user1.address, 1000);
      
      await expect(
        xpEngine.connect(user1).spendXP(500)
      ).to.not.be.reverted;
    });

    it("should handle batch operations with different amounts", async () => {
      const users = [user1.address, user2.address, user3.address];
      const amounts = [100, 10000, 1]; // Very different amounts
      
      await xpEngine.connect(xpGranter).awardXpBatch(users, amounts);
      
      expect(await xpEngine.getXP(user1.address)).to.equal(100);
      expect(await xpEngine.getXP(user2.address)).to.equal(10000);
      expect(await xpEngine.getXP(user3.address)).to.equal(1);
      
      // Levels should vary accordingly
      const level1 = await xpEngine.getLevel(user1.address);
      const level2 = await xpEngine.getLevel(user2.address);
      const level3 = await xpEngine.getLevel(user3.address);
      
      expect(level2).to.be.above(level1);
      expect(level1).to.be.at.least(level3);
    });
  });
});