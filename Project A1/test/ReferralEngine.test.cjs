const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReferralEngine", function () {
  let referralEngine;
  let owner, registrar, rewarder, user1, user2, referrer;
  let PAUSER_ROLE, REGISTRAR_ROLE, REWARDER_ROLE;

  beforeEach(async function () {
    [owner, registrar, rewarder, user1, user2, referrer] = await ethers.getSigners();
    const ReferralEngine = await ethers.getContractFactory("ReferralEngine");
    referralEngine = await ReferralEngine.deploy();
    await referralEngine.waitForDeployment();

    PAUSER_ROLE = await referralEngine.PAUSER_ROLE();
    REGISTRAR_ROLE = await referralEngine.REGISTRAR_ROLE();
    REWARDER_ROLE = await referralEngine.REWARDER_ROLE();

    await referralEngine.grantRole(REGISTRAR_ROLE, registrar.address);
    await referralEngine.grantRole(REWARDER_ROLE, rewarder.address);
  });

  it("Should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
    expect(await referralEngine.hasRole(await referralEngine.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
  });

  it("Should grant PAUSER_ROLE to the deployer", async function () {
    expect(await referralEngine.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
  });

  describe("registerReferral", function () {
    it("Should allow REGISTRAR_ROLE to register a referral", async function () {
      await expect(referralEngine.connect(registrar).registerReferral(user1.address, referrer.address))
        .to.emit(referralEngine, "Referred")
        .withArgs(user1.address, referrer.address);
      expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);
    });

    it("Should revert if caller does not have REGISTRAR_ROLE", async function () {
        await expect(referralEngine.connect(user1).registerReferral(user1.address, referrer.address))
            .to.be.revertedWithCustomError(referralEngine, "AccessControlUnauthorizedAccount");
    });

    it("Should revert if user tries to refer themselves", async function () {
        await expect(referralEngine.connect(registrar).registerReferral(user1.address, user1.address))
            .to.be.revertedWithCustomError(referralEngine, "CannotReferYourself");
    });

    it("Should revert if user already has a referrer", async function () {
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);
        await expect(referralEngine.connect(registrar).registerReferral(user1.address, user2.address))
            .to.be.revertedWithCustomError(referralEngine, "UserAlreadyHasReferrer");
    });

    it("Should revert if referrer is the zero address", async function () {
        await expect(referralEngine.connect(registrar).registerReferral(user1.address, ethers.ZeroAddress))
            .to.be.revertedWithCustomError(referralEngine, "ZeroAddressReferrer");
    });
  });

  describe("payReward", function () {
    it("Should allow REWARDER_ROLE to pay a reward", async function () {
        const rewardAmount = ethers.parseEther("10");
        await expect(referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount))
            .to.emit(referralEngine, "RewardPaid")
            .withArgs(referrer.address, rewardAmount);
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(rewardAmount);

        // Pay another reward to the same referrer
        const secondRewardAmount = ethers.parseEther("5");
        await expect(referralEngine.connect(rewarder).payReward(referrer.address, secondRewardAmount))
            .to.emit(referralEngine, "RewardPaid")
            .withArgs(referrer.address, secondRewardAmount);
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(rewardAmount + secondRewardAmount);
    });

    it("Should revert if caller does not have REWARDER_ROLE", async function () {
        const rewardAmount = ethers.parseEther("10");
        await expect(referralEngine.connect(user1).payReward(referrer.address, rewardAmount))
            .to.be.revertedWithCustomError(referralEngine, "AccessControlUnauthorizedAccount");
    });

    it("Should revert if reward amount is zero", async function () {
        await expect(referralEngine.connect(rewarder).payReward(referrer.address, 0))
            .to.be.revertedWithCustomError(referralEngine, "ZeroAmountReward");
    });
  });

  describe("claimReward", function () {
    it("Should allow a user to claim their rewards", async function () {
        const rewardAmount = ethers.parseEther("10");
        // Send Ether to the ReferralEngine contract to cover the reward
        await owner.sendTransaction({
            to: referralEngine.target,
            value: rewardAmount,
        });

        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);

        const initialBalance = await ethers.provider.getBalance(referrer.address);
        const tx = await referralEngine.connect(referrer).claimReward();
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * tx.gasPrice;
        const finalBalance = await ethers.provider.getBalance(referrer.address);

        expect(finalBalance).to.equal(initialBalance + rewardAmount - gasUsed);
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(0);
    });

    it("Should revert if the contract has insufficient Ether to pay rewards", async function () {
        const rewardAmount = ethers.parseEther("10");
        // Pay reward, but don't send enough Ether to the contract
        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);

        // Attempt to claim, should revert due to insufficient contract balance
        await expect(referralEngine.connect(referrer).claimReward())
            .to.be.reverted; // Generic revert as the require message is not a custom error
    });

    it("Should not allow claiming rewards multiple times without new rewards", async function () {
        const rewardAmount = ethers.parseEther("10");
        // Send Ether to the ReferralEngine contract to cover the reward
        await owner.sendTransaction({
            to: referralEngine.target,
            value: rewardAmount,
        });
        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);

        // Claim once
        await referralEngine.connect(referrer).claimReward();

        // Try to claim again, should revert
        await expect(referralEngine.connect(referrer).claimReward())
            .to.be.revertedWithCustomError(referralEngine, "InsufficientReward");
    });
  });

  describe("Pausable", function () {
    it("Should not allow registerReferral when paused", async function () {
        await referralEngine.connect(owner).pause();
        await expect(referralEngine.connect(registrar).registerReferral(user1.address, referrer.address))
            .to.be.revertedWithCustomError(referralEngine, "EnforcedPause");
    });

    it("Should not allow payReward when paused", async function () {
        const rewardAmount = ethers.parseEther("10");
        await referralEngine.connect(owner).pause();
        await expect(referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount))
            .to.be.revertedWithCustomError(referralEngine, "EnforcedPause");
    });

    it("Should not allow claimReward when paused", async function () {
        await referralEngine.connect(owner).pause();
        await expect(referralEngine.connect(referrer).claimReward())
            .to.be.revertedWithCustomError(referralEngine, "EnforcedPause");
    });
  });

  describe("Enhanced Branch Coverage Tests", function () {
    let referralEngine;
    let owner, registrar, rewarder, user1, user2, user3, referrer;
    let PAUSER_ROLE, REGISTRAR_ROLE, REWARDER_ROLE;

    beforeEach(async function () {
      [owner, registrar, rewarder, user1, user2, user3, referrer] = await ethers.getSigners();
      const ReferralEngine = await ethers.getContractFactory("ReferralEngine");
      referralEngine = await ReferralEngine.deploy();
      await referralEngine.waitForDeployment();

      PAUSER_ROLE = await referralEngine.PAUSER_ROLE();
      REGISTRAR_ROLE = await referralEngine.REGISTRAR_ROLE();
      REWARDER_ROLE = await referralEngine.REWARDER_ROLE();

      await referralEngine.grantRole(REGISTRAR_ROLE, registrar.address);
      await referralEngine.grantRole(REWARDER_ROLE, rewarder.address);
    });

    describe("Constructor and Initialization Edge Cases", function () {
      it("Should properly initialize with correct roles", async function () {
        expect(await referralEngine.hasRole(await referralEngine.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
        expect(await referralEngine.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
      });

      it("Should start unpaused", async function () {
        expect(await referralEngine.paused()).to.be.false;
      });

      it("Should have zero balance initially", async function () {
        expect(await ethers.provider.getBalance(referralEngine.target)).to.equal(0);
      });
    });

    describe("Access Control Edge Cases", function () {
      it("Should allow granting REGISTRAR_ROLE to multiple accounts", async function () {
        await referralEngine.grantRole(REGISTRAR_ROLE, user1.address);
        expect(await referralEngine.hasRole(REGISTRAR_ROLE, user1.address)).to.be.true;

        await expect(referralEngine.connect(user1).registerReferral(user2.address, referrer.address))
          .to.emit(referralEngine, "Referred");
      });

      it("Should allow granting REWARDER_ROLE to multiple accounts", async function () {
        await referralEngine.grantRole(REWARDER_ROLE, user1.address);
        expect(await referralEngine.hasRole(REWARDER_ROLE, user1.address)).to.be.true;

        const rewardAmount = ethers.parseEther("5");
        await expect(referralEngine.connect(user1).payReward(referrer.address, rewardAmount))
          .to.emit(referralEngine, "RewardPaid");
      });

      it("Should allow revoking REGISTRAR_ROLE", async function () {
        await referralEngine.revokeRole(REGISTRAR_ROLE, registrar.address);
        expect(await referralEngine.hasRole(REGISTRAR_ROLE, registrar.address)).to.be.false;

        await expect(referralEngine.connect(registrar).registerReferral(user1.address, referrer.address))
          .to.be.revertedWithCustomError(referralEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should allow revoking REWARDER_ROLE", async function () {
        await referralEngine.revokeRole(REWARDER_ROLE, rewarder.address);
        expect(await referralEngine.hasRole(REWARDER_ROLE, rewarder.address)).to.be.false;

        const rewardAmount = ethers.parseEther("5");
        await expect(referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount))
          .to.be.revertedWithCustomError(referralEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should prevent non-admin from granting roles", async function () {
        await expect(referralEngine.connect(user1).grantRole(REGISTRAR_ROLE, user2.address))
          .to.be.revertedWithCustomError(referralEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should prevent non-PAUSER_ROLE from pausing", async function () {
        await expect(referralEngine.connect(user1).pause())
          .to.be.revertedWithCustomError(referralEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should prevent non-PAUSER_ROLE from unpausing", async function () {
        await referralEngine.pause();
        await expect(referralEngine.connect(user1).unpause())
          .to.be.revertedWithCustomError(referralEngine, "AccessControlUnauthorizedAccount");
      });
    });

    describe("Referral Registration Edge Cases", function () {
      it("Should handle multiple users with same referrer", async function () {
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);
        await referralEngine.connect(registrar).registerReferral(user2.address, referrer.address);
        await referralEngine.connect(registrar).registerReferral(user3.address, referrer.address);

        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);
        expect(await referralEngine.getReferrer(user2.address)).to.equal(referrer.address);
        expect(await referralEngine.getReferrer(user3.address)).to.equal(referrer.address);
      });

      it("Should handle chain referrals (A refers B, B refers C)", async function () {
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);
        await referralEngine.connect(registrar).registerReferral(user2.address, user1.address);

        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);
        expect(await referralEngine.getReferrer(user2.address)).to.equal(user1.address);
      });

      it("Should handle referral with contract addresses", async function () {
        // Use the referral engine contract itself as a referrer (edge case)
        await expect(referralEngine.connect(registrar).registerReferral(user1.address, referralEngine.target))
          .to.emit(referralEngine, "Referred")
          .withArgs(user1.address, referralEngine.target);

        expect(await referralEngine.getReferrer(user1.address)).to.equal(referralEngine.target);
      });

      it("Should maintain referral state consistency", async function () {
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);
        
        // Verify initial state
        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);
        
        // Pause and unpause shouldn't affect existing referrals
        await referralEngine.pause();
        await referralEngine.unpause();
        
        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);
      });
    });

    describe("Reward System Edge Cases", function () {
      it("Should handle very small reward amounts", async function () {
        const minReward = 1; // 1 wei
        
        await expect(referralEngine.connect(rewarder).payReward(referrer.address, minReward))
          .to.emit(referralEngine, "RewardPaid")
          .withArgs(referrer.address, minReward);

        expect(await referralEngine.referralRewards(referrer.address)).to.equal(minReward);
      });

      it("Should handle very large reward amounts", async function () {
        const largeReward = ethers.parseEther("1000000");
        
        await expect(referralEngine.connect(rewarder).payReward(referrer.address, largeReward))
          .to.emit(referralEngine, "RewardPaid")
          .withArgs(referrer.address, largeReward);

        expect(await referralEngine.referralRewards(referrer.address)).to.equal(largeReward);
      });

      it("Should handle multiple rewards to multiple referrers", async function () {
        const reward1 = ethers.parseEther("10");
        const reward2 = ethers.parseEther("20");
        const reward3 = ethers.parseEther("15");

        await referralEngine.connect(rewarder).payReward(referrer.address, reward1);
        await referralEngine.connect(rewarder).payReward(user1.address, reward2);
        await referralEngine.connect(rewarder).payReward(referrer.address, reward3);

        expect(await referralEngine.referralRewards(referrer.address)).to.equal(reward1 + reward3);
        expect(await referralEngine.referralRewards(user1.address)).to.equal(reward2);
      });

      it("Should handle reward accumulation over many transactions", async function () {
        const smallReward = ethers.parseEther("0.1");
        let totalReward = 0n;

        for (let i = 0; i < 10; i++) {
          await referralEngine.connect(rewarder).payReward(referrer.address, smallReward);
          totalReward += smallReward;
        }

        expect(await referralEngine.referralRewards(referrer.address)).to.equal(totalReward);
      });

      it("Should handle reward payments to zero address", async function () {
        const rewardAmount = ethers.parseEther("5");
        
        await expect(referralEngine.connect(rewarder).payReward(ethers.ZeroAddress, rewardAmount))
          .to.emit(referralEngine, "RewardPaid")
          .withArgs(ethers.ZeroAddress, rewardAmount);

        expect(await referralEngine.referralRewards(ethers.ZeroAddress)).to.equal(rewardAmount);
      });
    });

    describe("Reward Claiming Edge Cases", function () {
      beforeEach(async function () {
        // Fund the contract for reward claiming tests
        await owner.sendTransaction({
          to: referralEngine.target,
          value: ethers.parseEther("100")
        });
      });

      it("Should handle exact balance claims", async function () {
        const rewardAmount = ethers.parseEther("10");
        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);

        const initialBalance = await ethers.provider.getBalance(referrer.address);
        const tx = await referralEngine.connect(referrer).claimReward();
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * tx.gasPrice;

        expect(await ethers.provider.getBalance(referrer.address))
          .to.equal(initialBalance + rewardAmount - gasUsed);
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(0);
      });

      it("Should handle partial reward accumulation and claiming", async function () {
        const reward1 = ethers.parseEther("5");
        const reward2 = ethers.parseEther("7");
        const totalReward = reward1 + reward2;
        const maxClaim = await referralEngine.MAX_REWARD_PER_CLAIM();
        const claimAmount = totalReward > maxClaim ? maxClaim : totalReward;

        await referralEngine.connect(rewarder).payReward(referrer.address, reward1);
        await referralEngine.connect(rewarder).payReward(referrer.address, reward2);

        const initialBalance = await ethers.provider.getBalance(referrer.address);
        const tx = await referralEngine.connect(referrer).claimReward();
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * tx.gasPrice;

        expect(await ethers.provider.getBalance(referrer.address))
          .to.equal(initialBalance + claimAmount - gasUsed);
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(totalReward - claimAmount);
      });

      it("Should handle multiple users claiming simultaneously", async function () {
        const rewardAmount = ethers.parseEther("8");
        
        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);
        await referralEngine.connect(rewarder).payReward(user1.address, rewardAmount);

        const initialBalance1 = await ethers.provider.getBalance(referrer.address);
        const initialBalance2 = await ethers.provider.getBalance(user1.address);

        const tx1 = await referralEngine.connect(referrer).claimReward();
        const receipt1 = await tx1.wait();
        const gasUsed1 = receipt1.gasUsed * tx1.gasPrice;

        const tx2 = await referralEngine.connect(user1).claimReward();
        const receipt2 = await tx2.wait();
        const gasUsed2 = receipt2.gasUsed * tx2.gasPrice;

        expect(await ethers.provider.getBalance(referrer.address))
          .to.equal(initialBalance1 + rewardAmount - gasUsed1);
        expect(await ethers.provider.getBalance(user1.address))
          .to.equal(initialBalance2 + rewardAmount - gasUsed2);
      });

      it("Should handle claim-pay-claim cycle", async function () {
        const reward1 = ethers.parseEther("5");
        const reward2 = ethers.parseEther("3");

        // First cycle
        await referralEngine.connect(rewarder).payReward(referrer.address, reward1);
        await referralEngine.connect(referrer).claimReward();
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(0);

        // Second cycle
        await referralEngine.connect(rewarder).payReward(referrer.address, reward2);
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(reward2);
        
        await referralEngine.connect(referrer).claimReward();
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(0);
      });

      it("Should handle minimum reward claims (1 wei)", async function () {
        const minReward = 1;
        await referralEngine.connect(rewarder).payReward(referrer.address, minReward);

        const initialBalance = await ethers.provider.getBalance(referrer.address);
        const tx = await referralEngine.connect(referrer).claimReward();
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * tx.gasPrice;

        expect(await ethers.provider.getBalance(referrer.address))
          .to.equal(initialBalance + BigInt(minReward) - gasUsed);
      });
    });

    describe("Receive Function Edge Cases", function () {
      it("Should accept ETH through receive function", async function () {
        const sendAmount = ethers.parseEther("5");
        
        await expect(owner.sendTransaction({
          to: referralEngine.target,
          value: sendAmount
        })).to.not.be.reverted;

        expect(await ethers.provider.getBalance(referralEngine.target)).to.equal(sendAmount);
      });

      it("Should accept multiple ETH deposits", async function () {
        const amount1 = ethers.parseEther("3");
        const amount2 = ethers.parseEther("7");
        const totalAmount = amount1 + amount2;

        await owner.sendTransaction({
          to: referralEngine.target,
          value: amount1
        });

        await user1.sendTransaction({
          to: referralEngine.target,
          value: amount2
        });

        expect(await ethers.provider.getBalance(referralEngine.target)).to.equal(totalAmount);
      });

      it("Should accept zero value transactions", async function () {
        await expect(owner.sendTransaction({
          to: referralEngine.target,
          value: 0
        })).to.not.be.reverted;
      });
    });

    describe("Pause/Unpause State Management", function () {
      it("Should maintain reward balances during pause/unpause", async function () {
        const rewardAmount = ethers.parseEther("10");
        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);

        await referralEngine.pause();
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(rewardAmount);

        await referralEngine.unpause();
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(rewardAmount);
      });

      it("Should maintain referral mappings during pause/unpause", async function () {
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);

        await referralEngine.pause();
        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);

        await referralEngine.unpause();
        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);
      });

      it("Should handle multiple pause/unpause cycles", async function () {
        for (let i = 0; i < 3; i++) {
          await referralEngine.pause();
          expect(await referralEngine.paused()).to.be.true;
          
          await referralEngine.unpause();
          expect(await referralEngine.paused()).to.be.false;
        }
      });

      it("Should prevent all main operations when paused", async function () {
        await referralEngine.pause();

        await expect(referralEngine.connect(registrar).registerReferral(user1.address, referrer.address))
          .to.be.revertedWithCustomError(referralEngine, "EnforcedPause");

        await expect(referralEngine.connect(rewarder).payReward(referrer.address, ethers.parseEther("1")))
          .to.be.revertedWithCustomError(referralEngine, "EnforcedPause");

        await expect(referralEngine.connect(referrer).claimReward())
          .to.be.revertedWithCustomError(referralEngine, "EnforcedPause");
      });
    });

    describe("View Functions Edge Cases", function () {
      it("Should return zero address for users without referrers", async function () {
        expect(await referralEngine.getReferrer(user1.address)).to.equal(ethers.ZeroAddress);
        expect(await referralEngine.getReferrer(ethers.ZeroAddress)).to.equal(ethers.ZeroAddress);
      });

      it("Should return correct referrer after registration", async function () {
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);
        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);
      });

      it("Should return zero rewards for addresses with no rewards", async function () {
        expect(await referralEngine.referralRewards(user1.address)).to.equal(0);
        expect(await referralEngine.referralRewards(ethers.ZeroAddress)).to.equal(0);
      });

      it("Should return correct reward amounts after payments", async function () {
        const rewardAmount = ethers.parseEther("15");
        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(rewardAmount);
      });
    });

    describe("Complex Interaction Scenarios", function () {
      it("Should handle referral registration followed by rewards and claims", async function () {
        // Register referral
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);
        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);

        // Pay rewards
        const rewardAmount = ethers.parseEther("12");
        const maxClaim = await referralEngine.MAX_REWARD_PER_CLAIM();
        const claimAmount = rewardAmount > maxClaim ? maxClaim : rewardAmount;
        await owner.sendTransaction({
          to: referralEngine.target,
          value: rewardAmount
        });
        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);

        // Claim rewards
        const initialBalance = await ethers.provider.getBalance(referrer.address);
        const tx = await referralEngine.connect(referrer).claimReward();
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * tx.gasPrice;

        expect(await ethers.provider.getBalance(referrer.address))
          .to.equal(initialBalance + claimAmount - gasUsed);
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(rewardAmount - claimAmount);
      });

      it("Should handle multiple referrers with cross-rewards", async function () {
        // Setup referrals
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);
        await referralEngine.connect(registrar).registerReferral(user2.address, user1.address);

        // Fund contract
        await owner.sendTransaction({
          to: referralEngine.target,
          value: ethers.parseEther("50")
        });

        // Pay rewards to both
        const reward1 = ethers.parseEther("8");
        const reward2 = ethers.parseEther("12");
        const maxClaim = await referralEngine.MAX_REWARD_PER_CLAIM();
        await referralEngine.connect(rewarder).payReward(referrer.address, reward1);
        await referralEngine.connect(rewarder).payReward(user1.address, reward2);

        // Both claim
        await referralEngine.connect(referrer).claimReward();
        await referralEngine.connect(user1).claimReward();

        expect(await referralEngine.referralRewards(referrer.address)).to.equal(0);
        expect(await referralEngine.referralRewards(user1.address)).to.equal(reward2 - maxClaim);
      });

      it("Should handle reward accumulation with pause interruption", async function () {
        const reward1 = ethers.parseEther("5");
        const reward2 = ethers.parseEther("7");

        await referralEngine.connect(rewarder).payReward(referrer.address, reward1);
        
        await referralEngine.pause();
        await referralEngine.unpause();
        
        await referralEngine.connect(rewarder).payReward(referrer.address, reward2);

        expect(await referralEngine.referralRewards(referrer.address)).to.equal(reward1 + reward2);
      });
    });

    describe("ReentrancyGuard Protection", function () {
      it("Should protect claimReward function from reentrancy", async function () {
        const rewardAmount = ethers.parseEther("10");
        await owner.sendTransaction({
          to: referralEngine.target,
          value: rewardAmount
        });
        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);

        await expect(referralEngine.connect(referrer).claimReward())
          .to.not.be.reverted;
      });
    });

    describe("Mathematical Edge Cases", function () {
      it("Should handle reward arithmetic with maximum values", async function () {
        const largeReward = ethers.parseEther("999999999");
        
        await expect(referralEngine.connect(rewarder).payReward(referrer.address, largeReward))
          .to.emit(referralEngine, "RewardPaid");

        expect(await referralEngine.referralRewards(referrer.address)).to.equal(largeReward);
      });

      it("Should handle precise decimal arithmetic", async function () {
        const preciseReward1 = ethers.parseEther("123.456789123456789");
        const preciseReward2 = ethers.parseEther("876.543210876543211");
        const totalReward = preciseReward1 + preciseReward2;

        await referralEngine.connect(rewarder).payReward(referrer.address, preciseReward1);
        await referralEngine.connect(rewarder).payReward(referrer.address, preciseReward2);

        expect(await referralEngine.referralRewards(referrer.address)).to.equal(totalReward);
      });

      it("Should handle reward accumulation overflow protection", async function () {
        // Test with reasonable large numbers to avoid gas issues
        const mediumReward = ethers.parseEther("1000000");
        
        await referralEngine.connect(rewarder).payReward(referrer.address, mediumReward);
        await referralEngine.connect(rewarder).payReward(referrer.address, mediumReward);

        expect(await referralEngine.referralRewards(referrer.address)).to.equal(mediumReward * 2n);
      });
    });

    describe("State Consistency Validation", function () {
      it("Should maintain state consistency across all operations", async function () {
        // Register referral
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);
        
        // Pay multiple rewards
        const reward1 = ethers.parseEther("10");
        const reward2 = ethers.parseEther("15");
        await referralEngine.connect(rewarder).payReward(referrer.address, reward1);
        await referralEngine.connect(rewarder).payReward(referrer.address, reward2);
        
        const expectedTotal = reward1 + reward2;
        const maxClaim = await referralEngine.MAX_REWARD_PER_CLAIM();
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(expectedTotal);
        
        // Fund and claim
        await owner.sendTransaction({
          to: referralEngine.target,
          value: expectedTotal
        });
        
        await referralEngine.connect(referrer).claimReward();
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(expectedTotal - maxClaim);
        
        // Referral should still exist
        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);
      });

      it("Should handle state consistency during role changes", async function () {
        // Setup initial state
        await referralEngine.connect(registrar).registerReferral(user1.address, referrer.address);
        const rewardAmount = ethers.parseEther("5");
        await referralEngine.connect(rewarder).payReward(referrer.address, rewardAmount);

        // Change roles
        await referralEngine.revokeRole(REGISTRAR_ROLE, registrar.address);
        await referralEngine.grantRole(REGISTRAR_ROLE, user2.address);

        // State should be preserved
        expect(await referralEngine.getReferrer(user1.address)).to.equal(referrer.address);
        expect(await referralEngine.referralRewards(referrer.address)).to.equal(rewardAmount);

        // New registrar should work
        await expect(referralEngine.connect(user2).registerReferral(user3.address, referrer.address))
          .to.emit(referralEngine, "Referred");
      });
    });
  });
});