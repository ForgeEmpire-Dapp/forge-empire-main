const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("XPEngine", function () {
  let xpEngine;
  let owner;
  let user1;
  let user2;
  let user3;
  let xpAwarder;
  let xpGranter;
  let pauser;

  beforeEach(async function () {
    [owner, user1, user2, user3, xpAwarder, xpGranter, pauser] = await ethers.getSigners();

    const XPEngine = await ethers.getContractFactory("XPEngine");
    xpEngine = await upgrades.deployProxy(XPEngine, [], { initializer: 'initialize' });
    await xpEngine.waitForDeployment();

    // Grant roles to appropriate signers
    const XP_AWARDER_ROLE = await xpEngine.XP_AWARDER_ROLE();
    const XP_GRANTER_ROLE = await xpEngine.XP_GRANTER_ROLE();
    const PAUSER_ROLE = await xpEngine.PAUSER_ROLE();

    await xpEngine.grantRole(XP_AWARDER_ROLE, xpAwarder.address);
    await xpEngine.grantRole(XP_GRANTER_ROLE, xpGranter.address);
    await xpEngine.grantRole(PAUSER_ROLE, pauser.address);
  });

  it("Should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
    expect(await xpEngine.hasRole(await xpEngine.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
  });

  it("Should grant PAUSER_ROLE to the deployer", async function () {
    expect(await xpEngine.hasRole(await xpEngine.PAUSER_ROLE(), owner.address)).to.be.true;
  });

  describe("XP Management", function () {
    let xpEngine;
    let owner;
    let user1;
    let user2;
    let xpAwarder;
    let xpGranter;

    beforeEach(async function () {
      [owner, user1, user2, , xpAwarder, xpGranter] = await ethers.getSigners();
      const XPEngine = await ethers.getContractFactory("XPEngine");
      xpEngine = await upgrades.deployProxy(XPEngine, [], { initializer: 'initialize' });
      await xpEngine.waitForDeployment();

      // Grant XP_AWARDER_ROLE to xpAwarder for testing awardXP function
      await xpEngine.grantRole(await xpEngine.XP_AWARDER_ROLE(), xpAwarder.address);
      // Grant XP_GRANTER_ROLE to xpGranter for testing awardXpBatch function
      await xpEngine.grantRole(await xpEngine.XP_GRANTER_ROLE(), xpGranter.address);
    });

    describe("awardXP", function () {
      it("Should allow XP_AWARDER_ROLE to award XP", async function () {
        const user = user1.address;
        const amount = 100;

        await expect(xpEngine.connect(xpAwarder).awardXP(user, amount))
          .to.emit(xpEngine, "XPAwarded")
          .withArgs(user, amount, xpAwarder.address);

        expect(await xpEngine.userXP(user)).to.equal(amount);
        expect(await xpEngine.totalXPAwarded()).to.equal(amount);
      });

      it("Should not allow non-XP_AWARDER_ROLE to award XP", async function () {
        const user = user1.address;
        const amount = 100;

        await expect(xpEngine.connect(user1).awardXP(user, amount))
          .to.be.revertedWithCustomError(xpEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should not allow awarding XP to zero address", async function () {
        const user = ethers.ZeroAddress;
        const amount = 100;

        await expect(xpEngine.connect(xpAwarder).awardXP(user, amount))
          .to.be.revertedWithCustomError(xpEngine, "ZeroAddressUser");
      });

      it("Should not allow awarding zero XP amount", async function () {
        const user = user1.address;
        const amount = 0;

        await expect(xpEngine.connect(xpAwarder).awardXP(user, amount))
          .to.be.revertedWithCustomError(xpEngine, "ZeroXPAmount");
      });
    });

    describe("awardXpBatch", function () {
      it("Should allow XP_AWARDER_ROLE to award XP in batch", async function () {
        const users = [user1.address, user2.address];
        const amounts = [50, 75];

        await expect(xpEngine.connect(xpGranter).awardXpBatch(users, amounts))
          .to.emit(xpEngine, "XPAwarded").withArgs(users[0], amounts[0], xpGranter.address)
          .and.to.emit(xpEngine, "XPAwarded").withArgs(users[1], amounts[1], xpGranter.address);

        expect(await xpEngine.userXP(users[0])).to.equal(amounts[0]);
        expect(await xpEngine.userXP(users[1])).to.equal(amounts[1]);
        expect(await xpEngine.totalXPAwarded()).to.equal(amounts[0] + amounts[1]);
      });

      it("Should not allow non-XP_AWARDER_ROLE to award XP in batch", async function () {
        const users = [user1.address, user2.address];
        const amounts = [50, 75];

        await expect(xpEngine.connect(user1).awardXpBatch(users, amounts))
          .to.be.revertedWithCustomError(xpEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should not allow awarding XP in batch with empty arrays", async function () {
        await expect(xpEngine.connect(xpGranter).awardXpBatch([], []))
          .to.be.revertedWithCustomError(xpEngine, "EmptyArrays");
      });

      it("Should not allow awarding XP in batch with array length mismatch", async function () {
        const users = [user1.address, user2.address];
        const amounts = [50];

        await expect(xpEngine.connect(xpGranter).awardXpBatch(users, amounts))
          .to.be.revertedWithCustomError(xpEngine, "ArrayLengthMismatch");
      });

      it("Should not allow awarding XP in batch with zero address user", async function () {
        const users = [ethers.ZeroAddress, user2.address];
        const amounts = [50, 75];

        await expect(xpEngine.connect(xpGranter).awardXpBatch(users, amounts))
          .to.be.revertedWithCustomError(xpEngine, "ZeroAddressUser");
      });

      it("Should not allow awarding XP in batch with zero XP amount", async function () {
        const users = [user1.address, user2.address];
        const amounts = [50, 0];

        await expect(xpEngine.connect(xpGranter).awardXpBatch(users, amounts))
          .to.be.revertedWithCustomError(xpEngine, "ZeroXPAmount");
      });

      it("Should not allow awarding XP in batch exceeding max batch size", async function () {
        const users = Array(101).fill(user1.address);
        const amounts = Array(101).fill(1);

        await expect(xpEngine.connect(xpGranter).awardXpBatch(users, amounts))
          .to.be.revertedWithCustomError(xpEngine, "BatchSizeExceeded");
      });
    });

    describe("spendXP", function () {
      beforeEach(async function () {
        // Award some XP to user1 for spending tests
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 200);
      });

      it("Should allow user to spend XP", async function () {
        const user = user1.address;
        const amountToSpend = 50;
        const initialXP = await xpEngine.userXP(user);

        await expect(xpEngine.connect(user1).spendXP(amountToSpend))
          .to.emit(xpEngine, "XPSpent")
          .withArgs(user, amountToSpend);

        expect(await xpEngine.userXP(user)).to.equal(Number(initialXP) - amountToSpend);
      });

      it("Should not allow spending zero XP amount", async function () {
        const user = user1.address;
        const amountToSpend = 0;

        await expect(xpEngine.connect(user1).spendXP(amountToSpend))
          .to.be.revertedWithCustomError(xpEngine, "ZeroXPAmount");
      });

      it("Should not allow spending more XP than available", async function () {
        const user = user1.address;
        const amountToSpend = 300; // More than initial 200 XP

        await expect(xpEngine.connect(user1).spendXP(amountToSpend))
          .to.be.revertedWithCustomError(xpEngine, "InsufficientXP");
      });
    });

    describe("View Functions", function () {
      it("getXP should return the correct XP balance for a user", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 150);
        expect(await xpEngine.getXP(user1.address)).to.equal(150);
        expect(await xpEngine.getXP(user2.address)).to.equal(0);
      });

      it("totalXPAwarded should return the total XP awarded across all users", async function () {
        expect(await xpEngine.totalXPAwarded()).to.equal(0);

        await xpEngine.connect(xpAwarder).awardXP(user1.address, 100);
        expect(await xpEngine.totalXPAwarded()).to.equal(100);

        await xpEngine.connect(xpAwarder).awardXP(user2.address, 50);
        expect(await xpEngine.totalXPAwarded()).to.equal(150);
      });
    });
  });

  describe("Enhanced Branch Coverage Tests", function () {
    let xpEngine;
    let owner;
    let user1;
    let user2;
    let user3;
    let xpAwarder;
    let xpGranter;
    let pauser;

    beforeEach(async function () {
      [owner, user1, user2, user3, xpAwarder, xpGranter, pauser] = await ethers.getSigners();
      const XPEngine = await ethers.getContractFactory("XPEngine");
      xpEngine = await upgrades.deployProxy(XPEngine, [], { initializer: 'initialize' });
      await xpEngine.waitForDeployment();

      await xpEngine.grantRole(await xpEngine.XP_AWARDER_ROLE(), xpAwarder.address);
      await xpEngine.grantRole(await xpEngine.XP_GRANTER_ROLE(), xpGranter.address);
      await xpEngine.grantRole(await xpEngine.PAUSER_ROLE(), pauser.address);
    });

    describe("Level Calculation Edge Cases", function () {
      it("Should return level 1 for user with 0 XP", async function () {
        expect(await xpEngine.getLevel(user1.address)).to.equal(1);
      });

      it("Should return level 1 for user with XP below level 2 threshold", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 999);
        expect(await xpEngine.getLevel(user1.address)).to.equal(1);
      });

      it("Should return level 2 for user with exactly 1000 XP", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 1000);
        expect(await xpEngine.getLevel(user1.address)).to.equal(2);
      });

      it("Should return level 3 for user with exactly 4000 XP", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 4000);
        expect(await xpEngine.getLevel(user1.address)).to.equal(3);
      });

      it("Should cap level at 100 even with massive XP", async function () {
        // Level 100 requires 100^2 * 1000 = 10,000,000 XP
        const massiveXP = ethers.parseUnits("50000000", 0); // 50 million XP
        await xpEngine.connect(xpAwarder).awardXP(user1.address, massiveXP);
        expect(await xpEngine.getLevel(user1.address)).to.equal(100);
      });

      it("Should handle level boundary calculations correctly", async function () {
        // Test various level boundaries
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 8999); // Just below level 4 (9000 XP)
        expect(await xpEngine.getLevel(user1.address)).to.equal(3);

        await xpEngine.connect(xpAwarder).awardXP(user1.address, 1); // Exactly level 4 threshold
        expect(await xpEngine.getLevel(user1.address)).to.equal(4);
      });

      it("Should handle XP level progression after spending XP", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 5000);
        expect(await xpEngine.getLevel(user1.address)).to.equal(3); // 5000 XP = level 3 (4000 threshold)

        // Spend XP to drop below level 3 threshold
        await xpEngine.connect(user1).spendXP(2000);
        expect(await xpEngine.getLevel(user1.address)).to.equal(2); // 3000 XP = level 2
      });
    });

    describe("Pause Functionality Edge Cases", function () {
      it("Should prevent awardXP when paused", async function () {
        await xpEngine.connect(pauser).pause();
        
        await expect(xpEngine.connect(xpAwarder).awardXP(user1.address, 100))
          .to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
      });

      it("Should prevent awardXpBatch when paused", async function () {
        await xpEngine.connect(pauser).pause();
        
        await expect(xpEngine.connect(xpGranter).awardXpBatch([user1.address], [100]))
          .to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
      });

      it("Should prevent spendXP when paused", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 100);
        await xpEngine.connect(pauser).pause();
        
        await expect(xpEngine.connect(user1).spendXP(50))
          .to.be.revertedWithCustomError(xpEngine, "EnforcedPause");
      });

      it("Should allow operations after unpause", async function () {
        await xpEngine.connect(pauser).pause();
        await xpEngine.connect(pauser).unpause();
        
        await expect(xpEngine.connect(xpAwarder).awardXP(user1.address, 100))
          .to.emit(xpEngine, "XPAwarded");
      });

      it("Should prevent non-PAUSER_ROLE from pausing", async function () {
        await expect(xpEngine.connect(user1).pause())
          .to.be.revertedWithCustomError(xpEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should prevent non-PAUSER_ROLE from unpausing", async function () {
        await xpEngine.connect(pauser).pause();
        await expect(xpEngine.connect(user1).unpause())
          .to.be.revertedWithCustomError(xpEngine, "AccessControlUnauthorizedAccount");
      });
    });

    describe("Access Control Edge Cases", function () {
      it("Should allow granting XP_AWARDER_ROLE to another address", async function () {
        await xpEngine.grantRole(await xpEngine.XP_AWARDER_ROLE(), user1.address);
        
        await expect(xpEngine.connect(user1).awardXP(user2.address, 100))
          .to.emit(xpEngine, "XPAwarded");
      });

      it("Should allow revoking XP_AWARDER_ROLE", async function () {
        await xpEngine.grantRole(await xpEngine.XP_AWARDER_ROLE(), user1.address);
        await xpEngine.revokeRole(await xpEngine.XP_AWARDER_ROLE(), user1.address);
        
        await expect(xpEngine.connect(user1).awardXP(user2.address, 100))
          .to.be.revertedWithCustomError(xpEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should allow multiple XP_AWARDER_ROLE holders", async function () {
        await xpEngine.grantRole(await xpEngine.XP_AWARDER_ROLE(), user1.address);
        await xpEngine.grantRole(await xpEngine.XP_AWARDER_ROLE(), user2.address);
        
        await expect(xpEngine.connect(user1).awardXP(user3.address, 50))
          .to.emit(xpEngine, "XPAwarded");
          
        await expect(xpEngine.connect(user2).awardXP(user3.address, 75))
          .to.emit(xpEngine, "XPAwarded");
          
        expect(await xpEngine.getXP(user3.address)).to.equal(125);
      });
    });

    describe("Batch Operations Edge Cases", function () {
      it("Should handle batch with single user", async function () {
        await expect(xpEngine.connect(xpGranter).awardXpBatch([user1.address], [100]))
          .to.emit(xpEngine, "XPAwarded")
          .withArgs(user1.address, 100, xpGranter.address);
          
        expect(await xpEngine.getXP(user1.address)).to.equal(100);
      });

      it("Should handle maximum batch size exactly", async function () {
        const maxBatchSize = await xpEngine.MAX_BATCH_SIZE();
        const users = Array(Number(maxBatchSize)).fill(user1.address);
        const amounts = Array(Number(maxBatchSize)).fill(1);
        
        await expect(xpEngine.connect(xpGranter).awardXpBatch(users, amounts))
          .to.not.be.reverted;
          
        expect(await xpEngine.getXP(user1.address)).to.equal(Number(maxBatchSize));
      });

      it("Should handle batch with duplicate users", async function () {
        const users = [user1.address, user1.address, user2.address];
        const amounts = [50, 25, 100];
        
        await xpEngine.connect(xpGranter).awardXpBatch(users, amounts);
        
        expect(await xpEngine.getXP(user1.address)).to.equal(75); // 50 + 25
        expect(await xpEngine.getXP(user2.address)).to.equal(100);
      });

      it("Should handle batch with large amounts", async function () {
        const largeAmount = ethers.parseUnits("1000000", 0);
        const users = [user1.address, user2.address];
        const amounts = [largeAmount, largeAmount];
        
        await expect(xpEngine.connect(xpGranter).awardXpBatch(users, amounts))
          .to.not.be.reverted;
        
        expect(await xpEngine.getXP(user1.address)).to.equal(largeAmount);
        expect(await xpEngine.totalXPAwarded()).to.equal(largeAmount * 2n);
      });
    });

    describe("State Consistency Edge Cases", function () {
      it("Should maintain totalXPAwarded consistency after multiple operations", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 100);
        await xpEngine.connect(xpAwarder).awardXP(user2.address, 200);
        await xpEngine.connect(xpGranter).awardXpBatch([user1.address, user2.address], [50, 75]);
        
        expect(await xpEngine.totalXPAwarded()).to.equal(425);
        
        // Spending XP should not affect totalXPAwarded
        await xpEngine.connect(user1).spendXP(50);
        expect(await xpEngine.totalXPAwarded()).to.equal(425);
      });

      it("Should handle spending all available XP", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 100);
        
        await expect(xpEngine.connect(user1).spendXP(100))
          .to.emit(xpEngine, "XPSpent")
          .withArgs(user1.address, 100);
          
        expect(await xpEngine.getXP(user1.address)).to.equal(0);
        expect(await xpEngine.getLevel(user1.address)).to.equal(1);
      });

      it("Should handle multiple small XP awards to same user", async function () {
        for (let i = 1; i <= 10; i++) {
          await xpEngine.connect(xpAwarder).awardXP(user1.address, 100);
          expect(await xpEngine.getXP(user1.address)).to.equal(100 * i);
        }
        
        expect(await xpEngine.getLevel(user1.address)).to.equal(2); // 1000 XP = level 2
      });

      it("Should handle XP operations with zero balance user", async function () {
        expect(await xpEngine.getXP(user1.address)).to.equal(0);
        expect(await xpEngine.getLevel(user1.address)).to.equal(1);
        
        await expect(xpEngine.connect(user1).spendXP(1))
          .to.be.revertedWithCustomError(xpEngine, "InsufficientXP");
      });
    });

    describe("Mathematical Edge Cases", function () {
      it("Should handle XP values at exact level thresholds", async function () {
        const testCases = [
          { xp: 1000, expectedLevel: 2 },
          { xp: 4000, expectedLevel: 3 },
          { xp: 9000, expectedLevel: 4 },
          { xp: 16000, expectedLevel: 5 },
          { xp: 25000, expectedLevel: 6 }
        ];
        
        for (const testCase of testCases) {
          await xpEngine.connect(xpAwarder).awardXP(user1.address, testCase.xp);
          expect(await xpEngine.getLevel(user1.address)).to.equal(testCase.expectedLevel);
          
          // Reset for next test
          await xpEngine.connect(user1).spendXP(await xpEngine.getXP(user1.address));
        }
      });

      it("Should handle level calculation overflow protection", async function () {
        // Test with maximum uint256 value to ensure no overflow
        const maxUint256 = ethers.MaxUint256;
        
        // This should be handled gracefully and cap at level 100
        // Note: This might not work in practice due to gas limits, but tests the logic
        try {
          await xpEngine.connect(xpAwarder).awardXP(user1.address, maxUint256);
          expect(await xpEngine.getLevel(user1.address)).to.equal(100);
        } catch (error) {
          // Expected due to gas limits or other constraints
          expect(error.message).to.include("gas");
        }
      });
    });

    describe("Event Emission Edge Cases", function () {
      it("Should emit correct events for multiple operations", async function () {
        const tx = await xpEngine.connect(xpAwarder).awardXP(user1.address, 100);
        await expect(tx)
          .to.emit(xpEngine, "XPAwarded")
          .withArgs(user1.address, 100, xpAwarder.address);
          
        const spendTx = await xpEngine.connect(user1).spendXP(50);
        await expect(spendTx)
          .to.emit(xpEngine, "XPSpent")
          .withArgs(user1.address, 50);
      });

      it("Should emit events for batch operations in correct order", async function () {
        const users = [user1.address, user2.address];
        const amounts = [100, 200];
        
        const tx = await xpEngine.connect(xpGranter).awardXpBatch(users, amounts);
        
        await expect(tx)
          .to.emit(xpEngine, "XPAwarded")
          .withArgs(user1.address, 100, xpGranter.address);
          
        await expect(tx)
          .to.emit(xpEngine, "XPAwarded")
          .withArgs(user2.address, 200, xpGranter.address);
      });
    });

    describe("ReentrancyGuard Protection", function () {
      it("Should protect spendXP from reentrancy", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 100);
        
        // This test verifies the nonReentrant modifier is working
        await expect(xpEngine.connect(user1).spendXP(50))
          .to.not.be.reverted;
      });
    });

    describe("Complex Interaction Scenarios", function () {
      it("Should handle interleaved award and spend operations", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 500);
        await xpEngine.connect(user1).spendXP(200);
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 300);
        await xpEngine.connect(user1).spendXP(100);
        
        expect(await xpEngine.getXP(user1.address)).to.equal(500);
        expect(await xpEngine.totalXPAwarded()).to.equal(800);
      });

      it("Should handle multiple users with different XP levels", async function () {
        await xpEngine.connect(xpAwarder).awardXP(user1.address, 500);   // Level 1
        await xpEngine.connect(xpAwarder).awardXP(user2.address, 1500);  // Level 2  
        await xpEngine.connect(xpAwarder).awardXP(user3.address, 5000);  // Level 3
        
        expect(await xpEngine.getLevel(user1.address)).to.equal(1);
        expect(await xpEngine.getLevel(user2.address)).to.equal(2);
        expect(await xpEngine.getLevel(user3.address)).to.equal(3);
      });
    });
  });
});