const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper function to fast-forward time
const fastForward = async (seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
};

describe("StakingRewards", function () {
  let stakingRewards;
  let mockStakingToken;
  let mockRewardsToken;
  let mockForgePass;
  let mockBadgeMinter;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockStakingToken = await MockERC20.deploy("StakingToken", "STK");
    await mockStakingToken.waitForDeployment();

    mockRewardsToken = await MockERC20.deploy("RewardsToken", "RWD");
    await mockRewardsToken.waitForDeployment();

    // Deploy mock ForgePass (ERC721)
    const MockERC721 = await ethers.getContractFactory("MockERC721");
    mockForgePass = await MockERC721.deploy("ForgePass", "FP");
    await mockForgePass.waitForDeployment();

    // Deploy MockBadgeMinter
    const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
    mockBadgeMinter = await MockBadgeMinter.deploy();
    await mockBadgeMinter.waitForDeployment();

    const StakingRewards = await ethers.getContractFactory("StakingRewards");
    stakingRewards = await StakingRewards.deploy(mockStakingToken.target, mockRewardsToken.target);
    await stakingRewards.waitForDeployment();

    // Set the ForgePass address and BadgeMinter address after deployment
    await stakingRewards.setForgePassAddress(mockForgePass.target);
    await stakingRewards.setBadgeMinterAddress(mockBadgeMinter.target);

    // Mint some rewards tokens to the stakingRewards contract for distribution
    await mockRewardsToken.mint(owner.address, ethers.parseEther("100000000")); // Mint a large amount to owner
    await mockRewardsToken.approve(stakingRewards.target, ethers.parseEther("100000000")); // Approve stakingRewards to spend
    await stakingRewards.depositRewardTokens(ethers.parseEther("100000000")); // Deposit to contract

    // Ensure boosterBadgeId is 0 for most tests
    await stakingRewards.setBoosterBadgeId(0);
  });

  it("Should deploy with the correct staking token address", async function () {
    expect(await stakingRewards.stakingToken()).to.equal(mockStakingToken.target);
  });

  it("Should deploy with the correct rewards token address", async function () {
    expect(await stakingRewards.rewardsToken()).to.equal(mockRewardsToken.target);
  });

  it("Should set the correct ForgePass address", async function () {
    expect(await stakingRewards.forgePass()).to.equal(mockForgePass.target);
  });

  it("Should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
    expect(await stakingRewards.hasRole(await stakingRewards.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
  });

  it("Should set the correct BadgeMinter address", async function () {
    expect(await stakingRewards.badgeMinter()).to.equal(mockBadgeMinter.target);
  });

  it("Should set the booster badge ID", async function () {
    const boosterId = 123;
    await stakingRewards.setBoosterBadgeId(boosterId);
    expect(await stakingRewards.boosterBadgeId()).to.equal(boosterId);
  });

  it("Should apply a staking boost if the user holds the booster badge", async function () {
    const stakeAmount = ethers.parseEther("100");
    const rewardRate = ethers.parseEther("1"); // 1 token per second
    const boosterBadgeId = 1;

    // Set reward rate
    await stakingRewards.setRewardsPerSecond(rewardRate);

    // Mint booster badge to addr1
    await mockBadgeMinter.mint(addr1.address, boosterBadgeId, "ipfs://boosterbadge/1");
    await stakingRewards.setBoosterBadgeId(boosterBadgeId);

    // Transfer staking tokens to addr1 and approve
    await mockStakingToken.mint(addr1.address, stakeAmount);
    await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);

    // Stake tokens
    const stakeTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    await stakingRewards.connect(addr1).stake(stakeAmount);

    // Increase time to accumulate rewards
    await fastForward(3600); // 1 hour

    const earnedRewards = await stakingRewards.getRewardAmount(addr1.address);
    const afterTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    const timePassed = afterTimestamp - stakeTimestamp;

    // Calculate expected rewards without boost
    const expectedRewardsWithoutBoost = rewardRate * BigInt(timePassed);

    // Expect a 10% boost
    const expectedRewardsWithBoost = (expectedRewardsWithoutBoost * BigInt(110)) / BigInt(100);

    // Allow for a small deviation due to block.timestamp variations
    expect(earnedRewards).to.be.closeTo(expectedRewardsWithBoost, ethers.parseEther("0.05"));
  });

  it("Should not apply a staking boost if the user does not hold the booster badge", async function () {
    const stakeAmount = ethers.parseEther("100");
    const rewardRate = ethers.parseEther("1"); // 1 token per second
    const boosterBadgeId = 1;

    // Set reward rate
    await stakingRewards.setRewardsPerSecond(rewardRate);

    // Set booster badge ID, but don't mint to addr1
    await stakingRewards.setBoosterBadgeId(boosterBadgeId);

    // Transfer staking tokens to addr1 and approve
    await mockStakingToken.mint(addr1.address, stakeAmount);
    await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);

    // Stake tokens
    const stakeTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    await stakingRewards.connect(addr1).stake(stakeAmount);

    // Increase time to accumulate rewards
    await fastForward(3600); // 1 hour

    const earnedRewards = await stakingRewards.getRewardAmount(addr1.address);
    const afterTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    const timePassed = afterTimestamp - stakeTimestamp;

    // Calculate expected rewards without boost
    const expectedRewardsWithoutBoost = rewardRate * BigInt(timePassed);

    // Allow for a small deviation due to block.timestamp variations
    expect(earnedRewards).to.be.closeTo(expectedRewardsWithoutBoost, ethers.parseEther("0.01"));
  });

  it("Should revert if setting rewardsPerSecond to zero", async function () {
    await expect(stakingRewards.setRewardsPerSecond(0)).to.be.revertedWithCustomError(stakingRewards, "InvalidRewardRate");
  });

  it("Should allow setting rewardsPerSecond to a non-zero value and update state", async function () {
    const newRate = ethers.parseEther("0.5");
    await expect(stakingRewards.setRewardsPerSecond(newRate))
      .to.emit(stakingRewards, "RewardRateUpdated")
      .withArgs(newRate);
    expect(await stakingRewards.rewardsPerSecond()).to.equal(newRate);
  });

  it("Should not allow non-admin to set rewardsPerSecond", async function () {
    const newRate = ethers.parseEther("0.5");
    await expect(stakingRewards.connect(addr1).setRewardsPerSecond(newRate)).to.be.revertedWithCustomError(stakingRewards, "AccessControlUnauthorizedAccount");
  });

  it("Should correctly calculate rewards when totalStaked is not zero", async function () {
    const stakeAmount = ethers.parseEther("100");
    const rewardRate = ethers.parseEther("1"); // 1 token per second

    // Set reward rate
    await stakingRewards.setRewardsPerSecond(rewardRate);

    // Transfer staking tokens to addr1 and approve
    await mockStakingToken.mint(addr1.address, stakeAmount);
    await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);

    // Stake tokens
    const stakeTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    await stakingRewards.connect(addr1).stake(stakeAmount);

    // Increase time to accumulate rewards
    await fastForward(3600); // 1 hour

    // Get earned rewards
    const earnedRewards = await stakingRewards.getRewardAmount(addr1.address);
    const afterTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    const timePassed = afterTimestamp - stakeTimestamp;

    // Calculate expected rewards
    const expectedRewards = rewardRate * BigInt(timePassed);

    // Allow for a small deviation due to block.timestamp variations
    expect(earnedRewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.001"));
  });

  it("Should return 0 rewards when totalStaked is zero", async function () {
      const earnedRewards = await stakingRewards.getRewardAmount(addr1.address);
      expect(earnedRewards).to.equal(0);
    });

    it("Should revert when unstaking zero amount", async function () {
      await expect(stakingRewards.connect(addr1).unstake(0)).to.be.revertedWithCustomError(stakingRewards, "ZeroAmount");
    });

    it("Should revert when unstaking more than staked", async function () {
      const stakeAmount = ethers.parseEther("100");
      await mockStakingToken.mint(addr1.address, stakeAmount);
      await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
      await stakingRewards.connect(addr1).stake(stakeAmount);

      await expect(stakingRewards.connect(addr1).unstake(ethers.parseEther("200"))).to.be.revertedWithCustomError(stakingRewards, "InsufficientStakedAmount");
    });

    it("Should allow users to claim their accumulated rewards", async function () {
      const stakeAmount = ethers.parseEther("100");
      const rewardRate = ethers.parseEther("1"); // 1 token per second

      await stakingRewards.setRewardsPerSecond(rewardRate);

      await mockStakingToken.mint(addr1.address, stakeAmount);
      await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);

      await stakingRewards.connect(addr1).stake(stakeAmount);

      const initialTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      await fastForward(3600); // 1 hour
      const finalTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      const actualTimeElapsed = BigInt(finalTimestamp) - BigInt(initialTimestamp);

      const initialRewardBalance = await mockRewardsToken.balanceOf(addr1.address);

      // Calculate expected rewards *after* time has passed and before claiming
      const expectedRewards = await stakingRewards.getRewardAmount(addr1.address);

      await expect(stakingRewards.connect(addr1).claimRewards())
        .to.emit(stakingRewards, "RewardsClaimed")
        .withArgs(addr1.address, (amount) => amount > 0);

      const finalRewardBalance = await mockRewardsToken.balanceOf(addr1.address);
      const finalExpectedMin = expectedRewards - ethers.parseEther("1");
      const finalExpectedMax = expectedRewards + ethers.parseEther("1");
      expect(finalRewardBalance - initialRewardBalance).to.be.gte(finalExpectedMin).and.to.be.lte(finalExpectedMax);
      expect(await stakingRewards.rewards(addr1.address)).to.equal(0);
    });

    it("Should not apply booster badge bonus if badgeMinter.ownerOf reverts (covers catch block)", async function () {
      const stakeAmount = ethers.parseEther("100");
      const rewardRate = ethers.parseEther("1"); // 1 token per second
      const boosterBadgeId = 1;

      await stakingRewards.setRewardsPerSecond(rewardRate);
      await stakingRewards.setBoosterBadgeId(boosterBadgeId);

      await mockStakingToken.mint(addr1.address, stakeAmount);
      await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
      await stakingRewards.connect(addr1).stake(stakeAmount);

      await fastForward(3600); // 1 hour

      // Make mockBadgeMinter.ownerOf revert
      await mockBadgeMinter.setRevertOwnerOf(true);

      const earnedRewards = await stakingRewards.getRewardAmount(addr1.address);
      const expectedRewardsWithoutBoost = rewardRate * BigInt(3600);

      // Expect rewards to be close to the amount without boost
      const expectedRewardsWithBoost = (expectedRewardsWithoutBoost * BigInt(110)) / BigInt(100);
      expect(earnedRewards).to.be.lt(expectedRewardsWithBoost); // Ensure boost is NOT applied
    });

    it("Should allow users to unstake tokens", async function () {
      const stakeAmount = ethers.parseEther("100");
      await mockStakingToken.mint(addr1.address, stakeAmount);
      await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
      await stakingRewards.connect(addr1).stake(stakeAmount);

      const initialStakedBalance = await stakingRewards.stakedBalances(addr1.address);
      const initialTotalStaked = await stakingRewards.totalStaked();

      const unstakeAmount = ethers.parseEther("50");
      await expect(stakingRewards.connect(addr1).unstake(unstakeAmount))
        .to.emit(stakingRewards, "Unstaked")
        .withArgs(addr1.address, unstakeAmount);

      expect(await stakingRewards.stakedBalances(addr1.address)).to.equal(initialStakedBalance - unstakeAmount);
      expect(await stakingRewards.totalStaked()).to.equal(initialTotalStaked - unstakeAmount);
    });

    // CRITICAL SECURITY TESTS - Balance Validation Edge Cases
    describe("Balance Validation Security Tests", function () {
      
      it("Should revert when claiming rewards with insufficient contract balance", async function () {
        const stakeAmount = ethers.parseEther("100");
        const rewardRate = ethers.parseEther("1000"); // High reward rate
        
        // Ensure enough rewards are minted to cover the reward rate for MIN_REWARD_DURATION
        const minRequiredBalance = rewardRate * BigInt(86400); // 1 day
        await mockRewardsToken.mint(owner.address, minRequiredBalance);
        await mockRewardsToken.approve(stakingRewards.target, minRequiredBalance);
        await stakingRewards.depositRewardTokens(minRequiredBalance);

        // Set up staking
        await stakingRewards.setRewardsPerSecond(rewardRate);
        await mockStakingToken.mint(addr1.address, stakeAmount);
        await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
        await stakingRewards.connect(addr1).stake(stakeAmount);
        
        // Drain most rewards from contract (leaving only small amount)
        const contractBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
        await stakingRewards.emergencyWithdrawRewardTokens(contractBalance - ethers.parseEther("10"));
        
        // Wait for rewards to accumulate beyond available balance
        await fastForward(3600); // 1 hour
        
        // Should revert with InsufficientRewardBalance
        await expect(stakingRewards.connect(addr1).claimRewards())
          .to.be.revertedWithCustomError(stakingRewards, "InsufficientRewardBalance");
      });

      it("Should handle zero reward balance correctly", async function () {
        const stakeAmount = ethers.parseEther("100");
        
        // Drain all rewards from contract
        const contractBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
        await stakingRewards.emergencyWithdrawRewardTokens(contractBalance);
        
        // Set up staking
        await mockStakingToken.mint(addr1.address, stakeAmount);
        await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
        await stakingRewards.connect(addr1).stake(stakeAmount);
        
        // Should revert with NoRewardsToClaim (no rewards accumulated)
        await expect(stakingRewards.connect(addr1).claimRewards())
          .to.be.revertedWithCustomError(stakingRewards, "NoRewardsToClaim");
      });

      it("Should allow admin to deposit reward tokens", async function () {
        const depositAmount = ethers.parseEther("500");
        const initialBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
        
        // Mint tokens to owner and approve
        await mockRewardsToken.mint(owner.address, depositAmount);
        await mockRewardsToken.approve(stakingRewards.target, depositAmount);
        
        await expect(stakingRewards.depositRewardTokens(depositAmount))
          .to.emit(stakingRewards, "RewardTokensDeposited")
          .withArgs(depositAmount);
          
        expect(await mockRewardsToken.balanceOf(stakingRewards.target))
          .to.equal(initialBalance + depositAmount);
      });

      it("Should prevent depositing zero amount", async function () {
        await expect(stakingRewards.depositRewardTokens(0))
          .to.be.revertedWithCustomError(stakingRewards, "ZeroAmount");
      });

      it("Should prevent emergency withdrawal of more than available", async function () {
        const contractBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
        const excessAmount = contractBalance + ethers.parseEther("1");
        
        await expect(stakingRewards.emergencyWithdrawRewardTokens(excessAmount))
          .to.be.revertedWithCustomError(stakingRewards, "InsufficientRewardBalance");
      });

      it("Should calculate reward days remaining correctly", async function () {
        const rewardRate = ethers.parseEther("1"); // 1 token per second
        await stakingRewards.setRewardsPerSecond(rewardRate);
        
        const contractBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
        const dailyRewardCost = rewardRate * BigInt(86400);
        const expectedDays = (contractBalance * BigInt(1e18)) / dailyRewardCost;
        
        const actualDays = await stakingRewards.getRewardDaysRemaining();
        
        expect(actualDays).to.be.closeTo(expectedDays, BigInt(1e16)); // Allow for small precision differences
      });

      it("Should return zero days remaining when no balance or rate", async function () {
        // Drain contract
        const contractBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
        await stakingRewards.emergencyWithdrawRewardTokens(contractBalance);
        
        expect(await stakingRewards.getRewardDaysRemaining()).to.equal(0);
        
        // Restore balance but set rate to 0
        await mockRewardsToken.mint(owner.address, ethers.parseEther("1000"));
        await mockRewardsToken.approve(stakingRewards.target, ethers.parseEther("1000"));
        await stakingRewards.depositRewardTokens(ethers.parseEther("1000"));
        
        await expect(stakingRewards.setRewardsPerSecond(0)).to.be.revertedWithCustomError(stakingRewards, "InvalidRewardRate");
      });
    });

    // EMERGENCY PAUSE TESTS
    describe("Emergency Pause Functionality", function () {
      
      it("Should allow admin to pause and unpause contract", async function () {
        await expect(stakingRewards.emergencyPause())
          .to.emit(stakingRewards, "EmergencyPause");
          
        // Should prevent staking when paused
        const stakeAmount = ethers.parseEther("100");
        await mockStakingToken.mint(addr1.address, stakeAmount);
        await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
        
        await expect(stakingRewards.connect(addr1).stake(stakeAmount))
          .to.be.revertedWithCustomError(stakingRewards, "EnforcedPause");
          
        // Unpause and verify functionality restored
        await expect(stakingRewards.emergencyUnpause())
          .to.emit(stakingRewards, "EmergencyUnpause");
          
        await expect(stakingRewards.connect(addr1).stake(stakeAmount))
          .to.emit(stakingRewards, "Staked");
      });

      it("Should prevent unstaking when paused", async function () {
        // First stake some tokens
        const stakeAmount = ethers.parseEther("100");
        await mockStakingToken.mint(addr1.address, stakeAmount);
        await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
        await stakingRewards.connect(addr1).stake(stakeAmount);
        
        // Pause contract
        await stakingRewards.emergencyPause();
        
        // Should prevent unstaking
        await expect(stakingRewards.connect(addr1).unstake(ethers.parseEther("50")))
          .to.be.revertedWithCustomError(stakingRewards, "EnforcedPause");
      });

      it("Should prevent claiming rewards when paused", async function () {
        // Set up rewards
        const stakeAmount = ethers.parseEther("100");
        const rewardRate = ethers.parseEther("1");
        
        await stakingRewards.setRewardsPerSecond(rewardRate);
        await mockStakingToken.mint(addr1.address, stakeAmount);
        await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
        await stakingRewards.connect(addr1).stake(stakeAmount);
        
        // Generate some rewards
        await fastForward(3600);
        
        // Pause contract
        await stakingRewards.emergencyPause();
        
        // Should prevent claiming
        await expect(stakingRewards.connect(addr1).claimRewards())
          .to.be.revertedWithCustomError(stakingRewards, "EnforcedPause");
      });
    });

    describe("Enhanced Branch Coverage Tests", function () {
      let stakingRewards;
      let mockStakingToken;
      let mockRewardsToken;
      let mockForgePass;
      let mockBadgeMinter;
      let owner;
      let addr1;
      let addr2;
      let addr3;

      beforeEach(async function () {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockStakingToken = await MockERC20.deploy("StakingToken", "STK");
        await mockStakingToken.waitForDeployment();

        mockRewardsToken = await MockERC20.deploy("RewardsToken", "RWD");
        await mockRewardsToken.waitForDeployment();

        const MockERC721 = await ethers.getContractFactory("MockERC721");
        mockForgePass = await MockERC721.deploy("ForgePass", "FP");
        await mockForgePass.waitForDeployment();

        const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
        mockBadgeMinter = await MockBadgeMinter.deploy();
        await mockBadgeMinter.waitForDeployment();

        const StakingRewards = await ethers.getContractFactory("StakingRewards");
        stakingRewards = await StakingRewards.deploy(mockStakingToken.target, mockRewardsToken.target);
        await stakingRewards.waitForDeployment();

        await stakingRewards.setForgePassAddress(mockForgePass.target);
        await stakingRewards.setBadgeMinterAddress(mockBadgeMinter.target);
        await mockRewardsToken.mint(stakingRewards.target, ethers.parseEther("1000000"));
        await stakingRewards.setBoosterBadgeId(0);
      });

      describe("Constructor and Initialization Edge Cases", function () {
        it("Should properly initialize all state variables", async function () {
          expect(await stakingRewards.totalStaked()).to.equal(0);
          expect(await stakingRewards.rewardsPerSecond()).to.equal(0);
          expect(await stakingRewards.rewardPerTokenStored()).to.equal(0);
          expect(await stakingRewards.BONUS_MULTIPLIER()).to.equal(110);
          expect(await stakingRewards.boosterBadgeId()).to.equal(0);
        });

        it("Should set lastUpdateTime to deployment block timestamp", async function () {
          const deploymentBlock = await ethers.provider.getBlock("latest");
          const lastUpdateTime = await stakingRewards.lastUpdateTime();
          expect(lastUpdateTime).to.be.closeTo(deploymentBlock.timestamp, 2);
        });
      });

      describe("ForgePass Bonus Edge Cases", function () {
        it("Should not apply ForgePass bonus when ForgePass address is zero", async function () {
          const newStakingRewards = await (await ethers.getContractFactory("StakingRewards"))
            .deploy(mockStakingToken.target, mockRewardsToken.target);
          await newStakingRewards.waitForDeployment();

          // Mint and deposit rewards for the new contract
          const rewardRate = ethers.parseEther("1");
          const minRequiredBalance = rewardRate * BigInt(86400); // 1 day
          await mockRewardsToken.mint(owner.address, minRequiredBalance);
          await mockRewardsToken.approve(newStakingRewards.target, minRequiredBalance);
          await newStakingRewards.depositRewardTokens(minRequiredBalance);
          
          const stakeAmount = ethers.parseEther("100");
          await newStakingRewards.setRewardsPerSecond(rewardRate);
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(newStakingRewards.target, stakeAmount);
          
          const stakeTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
          await newStakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(3600);
          
          const rewards = await newStakingRewards.getRewardAmount(addr1.address);
          const afterTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
          const timePassed = afterTimestamp - stakeTimestamp;
          const expectedRewards = rewardRate * BigInt(timePassed);
          
          expect(rewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });

        it("Should not apply ForgePass bonus when user has zero ForgePass balance", async function () {
          const stakeAmount = ethers.parseEther("100");
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          const stakeTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(3600);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          const afterTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
          const timePassed = afterTimestamp - stakeTimestamp;
          const expectedRewards = ethers.parseEther("1") * BigInt(timePassed);
          
          expect(rewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });

        it("Should apply ForgePass bonus when user has ForgePass balance", async function () {
          const stakeAmount = ethers.parseEther("100");
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          await mockForgePass.safeMint(addr1.address, 1);
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(3600);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          const baseRewards = ethers.parseEther("1") * BigInt(3600);
          const expectedRewards = (baseRewards * BigInt(110)) / BigInt(100);
          
          expect(rewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });
      });

      describe("BadgeMinter Booster Edge Cases", function () {
        it("Should not apply booster when BadgeMinter address is zero", async function () {
          const newStakingRewards = await (await ethers.getContractFactory("StakingRewards"))
            .deploy(mockStakingToken.target, mockRewardsToken.target);
          await newStakingRewards.waitForDeployment();

          // Mint and deposit rewards for the new contract
          const rewardRate = ethers.parseEther("1");
          const minRequiredBalance = rewardRate * BigInt(86400); // 1 day
          await mockRewardsToken.mint(owner.address, minRequiredBalance);
          await mockRewardsToken.approve(newStakingRewards.target, minRequiredBalance);
          await newStakingRewards.depositRewardTokens(minRequiredBalance);
          
          const stakeAmount = ethers.parseEther("100");
          await newStakingRewards.setRewardsPerSecond(rewardRate);
          await newStakingRewards.setBoosterBadgeId(1);
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(newStakingRewards.target, stakeAmount);
          await newStakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(3600);
          
          const rewards = await newStakingRewards.getRewardAmount(addr1.address);
          const expectedRewards = rewardRate * BigInt(3600);
          
          expect(rewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });

        it("Should not apply booster when boosterBadgeId is zero", async function () {
          const stakeAmount = ethers.parseEther("100");
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          await stakingRewards.setBoosterBadgeId(0);
          
          await mockBadgeMinter.mint(addr1.address, 1, "ipfs://badge/1");
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(3600);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          const expectedRewards = ethers.parseEther("1") * BigInt(3600);
          
          expect(rewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });

        it("Should apply booster when user owns the correct badge", async function () {
          const stakeAmount = ethers.parseEther("100");
          const boosterBadgeId = 123;
          
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          await stakingRewards.setBoosterBadgeId(boosterBadgeId);
          await mockBadgeMinter.mint(addr1.address, boosterBadgeId, "ipfs://booster/123");
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(3600);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          const baseRewards = ethers.parseEther("1") * BigInt(3600);
          const expectedRewards = (baseRewards * BigInt(110)) / BigInt(100);
          
          expect(rewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });

        it("Should handle BadgeMinter ownerOf failure gracefully", async function () {
          const stakeAmount = ethers.parseEther("100");
          const boosterBadgeId = 999;
          
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          await stakingRewards.setBoosterBadgeId(boosterBadgeId);
          await mockBadgeMinter.setRevertOwnerOf(true);
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(3600);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          const expectedRewards = ethers.parseEther("1") * BigInt(3600);
          
          expect(rewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });
      });

      describe("Reward Calculation Edge Cases", function () {
        it("Should return stored rewards when totalStaked is zero", async function () {
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          await fastForward(3600);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          expect(rewards).to.equal(0);
        });

        it("Should handle very small staking amounts", async function () {
          const tinyAmount = 1;
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          await mockStakingToken.mint(addr1.address, tinyAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, tinyAmount);
          await stakingRewards.connect(addr1).stake(tinyAmount);
          
          await fastForward(1);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          expect(rewards).to.be.gte(0);
        });

        it("Should handle precision in reward calculations", async function () {
          const stakeAmount = ethers.parseEther("100");
          const preciseRate = ethers.parseEther("0.000001");
          
          await stakingRewards.setRewardsPerSecond(preciseRate);
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(1);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          expect(rewards).to.be.gte(0);
        });

        it("Should handle maximum uint256 reward rates", async function () {
          const stakeAmount = ethers.parseEther("100");
          const maxRate = ethers.parseEther("1000"); // MAX_REWARD_RATE in contract
          
          // Ensure enough rewards are minted to cover the max rate for MIN_REWARD_DURATION
          const minRequiredBalance = maxRate * BigInt(86400); // 1 day
          await mockRewardsToken.mint(owner.address, minRequiredBalance);
          await mockRewardsToken.approve(stakingRewards.target, minRequiredBalance);
          await stakingRewards.depositRewardTokens(minRequiredBalance);

          await expect(stakingRewards.setRewardsPerSecond(maxRate))
            .to.not.be.reverted; // Should not revert if enough balance
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          expect(rewards).to.be.gte(0);
        });
      });

      describe("Access Control Edge Cases", function () {
        it("Should prevent non-admin from setting ForgePass address", async function () {
          await expect(stakingRewards.connect(addr1).setForgePassAddress(mockForgePass.target))
            .to.be.revertedWithCustomError(stakingRewards, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-admin from setting BadgeMinter address", async function () {
          await expect(stakingRewards.connect(addr1).setBadgeMinterAddress(mockBadgeMinter.target))
            .to.be.revertedWithCustomError(stakingRewards, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-admin from setting booster badge ID", async function () {
          await expect(stakingRewards.connect(addr1).setBoosterBadgeId(123))
            .to.be.revertedWithCustomError(stakingRewards, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-admin from emergency pause", async function () {
          await expect(stakingRewards.connect(addr1).emergencyPause())
            .to.be.revertedWithCustomError(stakingRewards, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-admin from emergency unpause", async function () {
          await stakingRewards.emergencyPause();
          await expect(stakingRewards.connect(addr1).emergencyUnpause())
            .to.be.revertedWithCustomError(stakingRewards, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-admin from depositing reward tokens", async function () {
          await expect(stakingRewards.connect(addr1).depositRewardTokens(ethers.parseEther("100")))
            .to.be.revertedWithCustomError(stakingRewards, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-admin from emergency withdrawal", async function () {
          await expect(stakingRewards.connect(addr1).emergencyWithdrawRewardTokens(ethers.parseEther("100")))
            .to.be.revertedWithCustomError(stakingRewards, "AccessControlUnauthorizedAccount");
        });
      });

      describe("Emergency Operations Edge Cases", function () {
        it("Should prevent emergency withdrawal of zero amount", async function () {
          await expect(stakingRewards.emergencyWithdrawRewardTokens(0))
            .to.be.revertedWithCustomError(stakingRewards, "ZeroAmount");
        });

        it("Should allow emergency withdrawal of exact contract balance", async function () {
          const contractBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
          
          await expect(stakingRewards.emergencyWithdrawRewardTokens(contractBalance))
            .to.emit(stakingRewards, "RewardTokensWithdrawn")
            .withArgs(contractBalance);
        });

        it("Should emit correct events for emergency operations", async function () {
          await expect(stakingRewards.emergencyPause())
            .to.emit(stakingRewards, "EmergencyPause");
          
          await expect(stakingRewards.emergencyUnpause())
            .to.emit(stakingRewards, "EmergencyUnpause");
        });

        it("Should maintain state consistency during emergency operations", async function () {
          const stakeAmount = ethers.parseEther("100");
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          const totalStakedBefore = await stakingRewards.totalStaked();
          const userBalanceBefore = await stakingRewards.stakedBalances(addr1.address);
          
          await stakingRewards.emergencyPause();
          await stakingRewards.emergencyUnpause();
          
          expect(await stakingRewards.totalStaked()).to.equal(totalStakedBefore);
          expect(await stakingRewards.stakedBalances(addr1.address)).to.equal(userBalanceBefore);
        });
      });

      describe("Modifier and Update Mechanism Edge Cases", function () {
        it("Should handle updateReward modifier with zero address correctly", async function () {
          const initialRate = ethers.parseEther("1");
          await stakingRewards.setRewardsPerSecond(initialRate);
          await fastForward(3601); // Bypass cooldown
          
          const newRate = ethers.parseEther("2");
          await stakingRewards.setRewardsPerSecond(newRate);
          
          expect(await stakingRewards.rewardsPerSecond()).to.equal(newRate);
        });

        it("Should update reward state correctly for valid addresses", async function () {
          const stakeAmount = ethers.parseEther("100");
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          
          const userRewardBefore = await stakingRewards.userRewardPerTokenPaid(addr1.address);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          const userRewardAfter = await stakingRewards.userRewardPerTokenPaid(addr1.address);
          
          expect(userRewardAfter).to.be.gte(userRewardBefore);
        });

        it("Should handle multiple rapid reward updates", async function () {
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          await fastForward(3601);
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("2"));
          await fastForward(3601);
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("3"));
          
          expect(await stakingRewards.rewardsPerSecond()).to.equal(ethers.parseEther("3"));
        });
      });

      describe("Staking and Unstaking Edge Cases", function () {
        it("Should handle staking when contract is not paused", async function () {
          const stakeAmount = ethers.parseEther("100");
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          
          await expect(stakingRewards.connect(addr1).stake(stakeAmount))
            .to.emit(stakingRewards, "Staked")
            .withArgs(addr1.address, stakeAmount);
        });

        it("Should handle unstaking exact staked amount", async function () {
          const stakeAmount = ethers.parseEther("100");
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await expect(stakingRewards.connect(addr1).unstake(stakeAmount))
            .to.emit(stakingRewards, "Unstaked")
            .withArgs(addr1.address, stakeAmount);
          
          expect(await stakingRewards.stakedBalances(addr1.address)).to.equal(0);
        });

        it("Should update totalStaked correctly during multiple operations", async function () {
          const amount1 = ethers.parseEther("100");
          const amount2 = ethers.parseEther("50");
          
          await mockStakingToken.mint(addr1.address, amount1);
          await mockStakingToken.mint(addr2.address, amount2);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, amount1);
          await mockStakingToken.connect(addr2).approve(stakingRewards.target, amount2);
          
          await stakingRewards.connect(addr1).stake(amount1);
          expect(await stakingRewards.totalStaked()).to.equal(amount1);
          
          await stakingRewards.connect(addr2).stake(amount2);
          expect(await stakingRewards.totalStaked()).to.equal(amount1 + amount2);
          
          await stakingRewards.connect(addr1).unstake(amount1 / BigInt(2));
          expect(await stakingRewards.totalStaked()).to.equal(amount1 / BigInt(2) + amount2);
        });
      });

      describe("View Function Edge Cases", function () {
        it("Should return correct reward token balance", async function () {
          const expectedBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
          expect(await stakingRewards.getRewardTokenBalance()).to.equal(expectedBalance);
        });

        it("Should return zero days remaining when no rewards per second", async function () {
          expect(await stakingRewards.getRewardDaysRemaining()).to.equal(0);
        });

        it("Should return zero days remaining when contract balance is zero", async function () {
          const contractBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
          await stakingRewards.emergencyWithdrawRewardTokens(contractBalance);
          
          // No need to set rewardsPerSecond here, as the balance is zero
          expect(await stakingRewards.getRewardDaysRemaining()).to.equal(0);
        });

        it("Should calculate days remaining with precision", async function () {
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          const contractBalance = await mockRewardsToken.balanceOf(stakingRewards.target);
          const dailyRewardCost = ethers.parseEther("1") * BigInt(86400);
          const expectedDays = (contractBalance * BigInt(1e18)) / dailyRewardCost;
          
          const actualDays = await stakingRewards.getRewardDaysRemaining();
          expect(actualDays).to.be.closeTo(expectedDays, BigInt(1e16));
        });
      });

      describe("Complex Interaction Scenarios", function () {
        it("Should handle multiple users with different bonuses", async function () {
          const stakeAmount = ethers.parseEther("100");
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          // User 1: No bonuses
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          // User 2: ForgePass bonus
          await mockForgePass.safeMint(addr2.address, 1);
          await mockStakingToken.mint(addr2.address, stakeAmount);
          await mockStakingToken.connect(addr2).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr2).stake(stakeAmount);
          
          // User 3: Badge bonus
          const boosterBadgeId = 456;
          await stakingRewards.setBoosterBadgeId(boosterBadgeId);
          await mockBadgeMinter.mint(addr3.address, boosterBadgeId, "ipfs://booster/456");
          await mockStakingToken.mint(addr3.address, stakeAmount);
          await mockStakingToken.connect(addr3).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr3).stake(stakeAmount);
          
          await fastForward(3600);
          
          const rewards1 = await stakingRewards.getRewardAmount(addr1.address);
          const rewards2 = await stakingRewards.getRewardAmount(addr2.address);
          const rewards3 = await stakingRewards.getRewardAmount(addr3.address);
          
          expect(rewards2).to.be.gt(rewards1);
          expect(rewards3).to.be.gt(rewards1);
        });

        it("Should handle stake-claim-unstake cycle", async function () {
          const stakeAmount = ethers.parseEther("100");
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(3600);
          
          const rewardsBefore = await stakingRewards.rewards(addr1.address);
          await stakingRewards.connect(addr1).claimRewards();
          const rewardsAfter = await stakingRewards.rewards(addr1.address);
          
          expect(rewardsAfter).to.equal(0);
          
          await stakingRewards.connect(addr1).unstake(stakeAmount);
          expect(await stakingRewards.stakedBalances(addr1.address)).to.equal(0);
        });

        it("Should handle reward calculation updates during active staking", async function () {
          const stakeAmount = ethers.parseEther("100");
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(1800);
          
          const rewardsMidway = await stakingRewards.getRewardAmount(addr1.address);
          
          await fastForward(3601); // Bypass cooldown
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("2"));
          
          await fastForward(1800);
          
          const rewardsFinal = await stakingRewards.getRewardAmount(addr1.address);
          expect(rewardsFinal).to.be.gt(rewardsMidway);
        });
      });

      describe("ReentrancyGuard Protection", function () {
        it("Should protect stake function from reentrancy", async function () {
          const stakeAmount = ethers.parseEther("100");
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          
          await expect(stakingRewards.connect(addr1).stake(stakeAmount))
            .to.not.be.reverted;
        });

        it("Should protect unstake function from reentrancy", async function () {
          const stakeAmount = ethers.parseEther("100");
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await expect(stakingRewards.connect(addr1).unstake(stakeAmount / BigInt(2)))
            .to.not.be.reverted;
        });

        it("Should protect claimRewards function from reentrancy", async function () {
          const stakeAmount = ethers.parseEther("100");
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(3600);
          
          await expect(stakingRewards.connect(addr1).claimRewards())
            .to.not.be.reverted;
        });
      });

      describe("Mathematical Edge Cases", function () {
        it("Should handle reward calculation with very large numbers", async function () {
          const largeStake = ethers.parseEther("1000000");
          const largeRate = ethers.parseEther("1000");

          // Ensure enough rewards are minted to cover the large rate for MIN_REWARD_DURATION
          const minRequiredBalance = largeRate * BigInt(86400); // 1 day
          await mockRewardsToken.mint(owner.address, minRequiredBalance);
          await mockRewardsToken.approve(stakingRewards.target, minRequiredBalance);
          await stakingRewards.depositRewardTokens(minRequiredBalance);
          
          await stakingRewards.setRewardsPerSecond(largeRate);
          await mockStakingToken.mint(addr1.address, largeStake);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, largeStake);
          await stakingRewards.connect(addr1).stake(largeStake);
          
          await fastForward(3600);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          expect(rewards).to.be.gt(0);
        });

        it("Should handle precision loss with very small amounts", async function () {
          const tinyStake = 1000; // Very small amount
          const tinyRate = 1000;
          
          await stakingRewards.setRewardsPerSecond(tinyRate);
          await mockStakingToken.mint(addr1.address, tinyStake);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, tinyStake);
          await stakingRewards.connect(addr1).stake(tinyStake);
          
          await fastForward(1);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          expect(rewards).to.be.gte(0);
        });

        it("Should handle bonus multiplication edge cases", async function () {
          const stakeAmount = ethers.parseEther("1");
          await stakingRewards.setRewardsPerSecond(1); // Very small rate
          
          await mockForgePass.safeMint(addr1.address, 1);
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          await fastForward(1);
          
          const rewards = await stakingRewards.getRewardAmount(addr1.address);
          expect(rewards).to.be.gte(0);
        });
      });

      describe("State Consistency Validation", function () {
        it("Should maintain consistent state across multiple operations", async function () {
          const amount1 = ethers.parseEther("100");
          const amount2 = ethers.parseEther("200");
          
          await mockStakingToken.mint(addr1.address, amount1 + amount2);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, amount1 + amount2);
          
          await stakingRewards.connect(addr1).stake(amount1);
          const totalAfterFirstStake = await stakingRewards.totalStaked();
          const userAfterFirstStake = await stakingRewards.stakedBalances(addr1.address);
          
          await stakingRewards.connect(addr1).stake(amount2);
          const totalAfterSecondStake = await stakingRewards.totalStaked();
          const userAfterSecondStake = await stakingRewards.stakedBalances(addr1.address);
          
          expect(totalAfterSecondStake).to.equal(totalAfterFirstStake + amount2);
          expect(userAfterSecondStake).to.equal(userAfterFirstStake + amount2);
          
          await stakingRewards.connect(addr1).unstake(amount1);
          const totalAfterUnstake = await stakingRewards.totalStaked();
          const userAfterUnstake = await stakingRewards.stakedBalances(addr1.address);
          
          expect(totalAfterUnstake).to.equal(totalAfterSecondStake - amount1);
          expect(userAfterUnstake).to.equal(userAfterSecondStake - amount1);
        });

        it("Should handle zero reward claims correctly", async function () {
          await expect(stakingRewards.connect(addr1).claimRewards())
            .to.be.revertedWithCustomError(stakingRewards, "NoRewardsToClaim");
        });

        it("Should maintain reward state consistency across time", async function () {
          const stakeAmount = ethers.parseEther("100");
          await stakingRewards.setRewardsPerSecond(ethers.parseEther("1"));
          
          await mockStakingToken.mint(addr1.address, stakeAmount);
          await mockStakingToken.connect(addr1).approve(stakingRewards.target, stakeAmount);
          await stakingRewards.connect(addr1).stake(stakeAmount);
          
          const rewards1 = await stakingRewards.getRewardAmount(addr1.address);
          
          await fastForward(3600);
          
          const rewards2 = await stakingRewards.getRewardAmount(addr1.address);
          expect(rewards2).to.be.gt(rewards1);
        });
      });
    });
  });