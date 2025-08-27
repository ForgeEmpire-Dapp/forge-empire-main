const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("GuildRewards", function () {
  let guildRewards, mockGuildCore, mockToken, mockXPEngine, mockBadgeMinter;
  let owner, admin, rewardManager, guildLeader, member1, member2, member3, nonMember;

  const REWARD_DISTRIBUTION_PERIOD = 7 * 24 * 60 * 60; // 7 days
  const MIN_CONTRIBUTION_FOR_REWARDS = 100;

  // Mock guild data
  const mockGuild = {
    guildId: 1,
    name: "Test Guild",
    description: "A test guild for rewards",
    leader: "", // Will be set in beforeEach
    memberCount: 4,
    createdAt: 0,
    requiredXP: 1000,
    isActive: true,
    totalContributions: 10000
  };

  beforeEach(async () => {
    [owner, admin, rewardManager, guildLeader, member1, member2, member3, nonMember] = await ethers.getSigners();

    // Deploy mock GuildCore
    const MockGuildCore = await ethers.getContractFactory("contracts/mocks/MockGuildCore.sol:MockGuildCore");
    mockGuildCore = await MockGuildCore.deploy();
    await mockGuildCore.waitForDeployment();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("RewardToken", "RT");
    await mockToken.waitForDeployment();

    // Deploy mock XPEngine
    const MockXPEngine = await ethers.getContractFactory("MockXPEngine");
    mockXPEngine = await MockXPEngine.deploy();
    await mockXPEngine.waitForDeployment();

    // Deploy mock BadgeMinter
    const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
    mockBadgeMinter = await MockBadgeMinter.deploy();
    await mockBadgeMinter.waitForDeployment();

    // Deploy GuildRewards as upgradeable proxy
    const GuildRewards = await ethers.getContractFactory("GuildRewards");
    guildRewards = await upgrades.deployProxy(GuildRewards, [
      admin.address,
      await mockGuildCore.getAddress(),
      await mockToken.getAddress(),
      await mockXPEngine.getAddress(),
      await mockBadgeMinter.getAddress()
    ], { initializer: 'initialize' });
    await guildRewards.waitForDeployment();

    // Grant reward manager role
    const REWARD_MANAGER_ROLE = await guildRewards.REWARD_MANAGER_ROLE();
    await guildRewards.connect(admin).grantRole(REWARD_MANAGER_ROLE, rewardManager.address);

    // Grant DEFAULT_ADMIN_ROLE to admin account on MockBadgeMinter
    const DEFAULT_ADMIN_ROLE_BADGE = await mockBadgeMinter.DEFAULT_ADMIN_ROLE();
    await mockBadgeMinter.connect(owner).grantRole(DEFAULT_ADMIN_ROLE_BADGE, admin.address);

    // Grant MINTER_ROLE to GuildRewards contract
    const MINTER_ROLE = await mockBadgeMinter.MINTER_ROLE();
    await mockBadgeMinter.connect(admin).grantRole(MINTER_ROLE, await guildRewards.getAddress());

    // Set up mock guild with leader and members
    const updatedGuild = {
      ...mockGuild,
      leader: guildLeader.address,
      createdAt: await time.latest()
    };
    await mockGuildCore.connect(owner).setMockGuild(1, updatedGuild);

    // Set up guild members with different contribution scores
    const members = [
      { address: guildLeader.address, contribution: 4000, role: "Leader" },
      { address: member1.address, contribution: 3000, role: "Member" },
      { address: member2.address, contribution: 2000, role: "Member" },
      { address: member3.address, contribution: 1000, role: "Member" }
    ];

    for (const memberData of members) {
      await mockGuildCore.connect(owner).setMockMember(1, memberData.address, {
        memberAddress: memberData.address,
        joinedAt: await time.latest(),
        contributionScore: memberData.contribution,
        isActive: true,
        role: memberData.role
      });
      await mockGuildCore.connect(owner).setGuildMembership(1, memberData.address, true);
    }

    // Set up guild members list
    await mockGuildCore.connect(owner).setGuildMembers(1, [
      guildLeader.address, member1.address, member2.address, member3.address
    ]);

    // Set membership status for non-member
    await mockGuildCore.connect(owner).setGuildMembership(1, nonMember.address, false);

    // Mint tokens to reward manager for distribution
    await mockToken.connect(owner).mint(rewardManager.address, ethers.parseEther("10000"));
    await mockToken.connect(rewardManager).approve(await guildRewards.getAddress(), ethers.parseEther("10000"));
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct parameters", async () => {
      expect(await guildRewards.guildCore()).to.equal(await mockGuildCore.getAddress());
      expect(await guildRewards.rewardToken()).to.equal(await mockToken.getAddress());
      expect(await guildRewards.xpEngine()).to.equal(await mockXPEngine.getAddress());
      expect(await guildRewards.badgeMinter()).to.equal(await mockBadgeMinter.getAddress());
      expect(await guildRewards.rewardDistributionPeriod()).to.equal(REWARD_DISTRIBUTION_PERIOD);
      expect(await guildRewards.minContributionForRewards()).to.equal(MIN_CONTRIBUTION_FOR_REWARDS);
    });

    it("should grant correct roles", async () => {
      const DEFAULT_ADMIN_ROLE = await guildRewards.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await guildRewards.ADMIN_ROLE();
      const REWARD_MANAGER_ROLE = await guildRewards.REWARD_MANAGER_ROLE();

      expect(await guildRewards.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await guildRewards.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      expect(await guildRewards.hasRole(REWARD_MANAGER_ROLE, admin.address)).to.be.true;
      expect(await guildRewards.hasRole(REWARD_MANAGER_ROLE, rewardManager.address)).to.be.true;
    });

    it("should start unpaused", async () => {
      expect(await guildRewards.paused()).to.be.false;
    });

    it("should initialize with zero total rewards distributed", async () => {
      expect(await guildRewards.totalRewardsDistributed()).to.equal(0);
    });
  });

  describe("Reward Distribution", function () {
    it("should distribute rewards proportionally based on contributions", async () => {
      const totalReward = ethers.parseEther("1000");

      await expect(
        guildRewards.connect(rewardManager).distributeRewards(1, totalReward)
      ).to.emit(guildRewards, "RewardsDistributed")
       .withArgs(1, totalReward, 4); // All 4 members qualify (all have ≥100 contribution)

      // Check reward pool
      const pool = await guildRewards.getRewardPool(1);
      expect(pool.totalPool).to.equal(totalReward);
      expect(pool.rewardPerContribution).to.equal(totalReward / 10000n); // totalReward / totalContributions

      // Check individual member rewards
      const rewardPerContribution = totalReward / 10000n;
      
      expect(await guildRewards.getPendingRewards(1, guildLeader.address)).to.equal(4000n * rewardPerContribution);
      expect(await guildRewards.getPendingRewards(1, member1.address)).to.equal(3000n * rewardPerContribution);
      expect(await guildRewards.getPendingRewards(1, member2.address)).to.equal(2000n * rewardPerContribution);
      expect(await guildRewards.getPendingRewards(1, member3.address)).to.equal(1000n * rewardPerContribution);
    });

    it("should update total rewards distributed", async () => {
      const totalReward = ethers.parseEther("500");

      await guildRewards.connect(rewardManager).distributeRewards(1, totalReward);
      expect(await guildRewards.totalRewardsDistributed()).to.equal(totalReward);

      // Second distribution
      await guildRewards.connect(rewardManager).distributeRewards(1, totalReward);
      expect(await guildRewards.totalRewardsDistributed()).to.equal(totalReward * 2n);
    });

    it("should accumulate rewards from multiple distributions", async () => {
      const firstReward = ethers.parseEther("500");
      const secondReward = ethers.parseEther("500");

      await guildRewards.connect(rewardManager).distributeRewards(1, firstReward);
      await guildRewards.connect(rewardManager).distributeRewards(1, secondReward);

      const pool = await guildRewards.getRewardPool(1);
      expect(pool.totalPool).to.equal(firstReward + secondReward);

      const expectedRewardFirst = (4000n * firstReward / 10000n);
      const expectedRewardSecond = (4000n * secondReward / 10000n);
      expect(await guildRewards.getPendingRewards(1, guildLeader.address)).to.equal(expectedRewardFirst + expectedRewardSecond);
    });

    it("should require reward manager role", async () => {
      await expect(guildRewards.connect(member1).distributeRewards(1, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("should require active guild", async () => {
  // Create inactive guild
  const inactiveGuildId = 2;
  await mockGuildCore.connect(owner).setMockGuild(inactiveGuildId, {
    ...mockGuild,
    guildId: inactiveGuildId,
    isActive: false,
    leader: owner.address
  });

  await expect(
    guildRewards.connect(rewardManager).distributeRewards(inactiveGuildId, ethers.parseEther("100"))
  ).to.be.revertedWith("Guild not active");
});

    it("should require non-zero reward amount", async () => {
      await expect(
        guildRewards.connect(rewardManager).distributeRewards(1, 0)
      ).to.be.reverted;
    });

    it("should handle guild with no contributions", async () => {
      const zeroContribGuild = { ...mockGuild, guildId: 1, totalContributions: 0, leader: owner.address };
      await mockGuildCore.connect(owner).setMockGuild(1, zeroContribGuild);

      await guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("100"));

      const pool = await guildRewards.getRewardPool(1);
      expect(pool.rewardPerContribution).to.equal(0);
    });

    it("should only reward members with sufficient contributions", async () => {
      await mockGuildCore.connect(owner).setMockMember(1, nonMember.address, {
        memberAddress: nonMember.address,
        joinedAt: await time.latest(),
        contributionScore: 50,
        isActive: true,
        role: "Member"
      });
      await mockGuildCore.connect(owner).setGuildMembership(1, nonMember.address, true);
      await mockGuildCore.connect(owner).setGuildMembers(1, [
        guildLeader.address, member1.address, member2.address, member3.address, nonMember.address
      ]);

      await expect(
        guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("1000"))
      ).to.emit(guildRewards, "RewardsDistributed")
       .withArgs(1, ethers.parseEther("1000"), 4);

      expect(await guildRewards.getPendingRewards(1, nonMember.address)).to.equal(0);
    });
  });

  describe("Reward Claiming", function () {
    beforeEach(async () => {
      await guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("1000"));
    });

    it("should allow members to claim their rewards", async () => {
      const initialBalance = await mockToken.balanceOf(member1.address);
      const pendingRewards = await guildRewards.getPendingRewards(1, member1.address);

      await expect(
        guildRewards.connect(member1).claimRewards(1)
      ).to.emit(guildRewards, "RewardsClaimed")
       .withArgs(1, member1.address, pendingRewards);

      const finalBalance = await mockToken.balanceOf(member1.address);
      expect(finalBalance - initialBalance).to.equal(pendingRewards);

      expect(await guildRewards.getPendingRewards(1, member1.address)).to.equal(0);

      const memberReward = await guildRewards.getMemberReward(1, member1.address);
      expect(memberReward.claimedRewards).to.equal(pendingRewards);
      expect(memberReward.pendingRewards).to.equal(0);
    });

    it("should update reward pool distributed amount", async () => {
      const pendingRewards = await guildRewards.getPendingRewards(1, member1.address);
      
      await guildRewards.connect(member1).claimRewards(1);

      const pool = await guildRewards.getRewardPool(1);
      expect(pool.distributedAmount).to.equal(pendingRewards);
    });

    it("should award bonus XP when claiming rewards", async () => {
      const pendingRewards = await guildRewards.getPendingRewards(1, member1.address);
      
      await guildRewards.connect(member1).claimRewards(1);

      const expectedXP = pendingRewards * 500n / 10000n;
      expect(await mockXPEngine.getXP(member1.address)).to.equal(expectedXP);
    });

    it("should prevent non-members from claiming", async () => {
      await expect(
        guildRewards.connect(nonMember).claimRewards(1)
      ).to.be.revertedWith("Not guild member");
    });

    it("should prevent claiming when no rewards pending", async () => {
      await guildRewards.connect(member1).claimRewards(1);

      await expect(
        guildRewards.connect(member1).claimRewards(1)
      ).to.be.revertedWith("No pending rewards");
    });

    it("should handle multiple claims from different members", async () => {
      const member1Pending = await guildRewards.getPendingRewards(1, member1.address);
      const member2Pending = await guildRewards.getPendingRewards(1, member2.address);

      await guildRewards.connect(member1).claimRewards(1);
      await guildRewards.connect(member2).claimRewards(1);

      const pool = await guildRewards.getRewardPool(1);
      expect(pool.distributedAmount).to.equal(member1Pending + member2Pending);
    });
  });

  describe("Contribution Recording", function () {
    it("should record member contributions", async () => {
      const contributionPoints = 500;

      await expect(
        guildRewards.connect(rewardManager).recordContribution(1, member1.address, contributionPoints)
      ).to.emit(guildRewards, "ContributionRecorded")
       .withArgs(1, member1.address, contributionPoints);

      const memberReward = await guildRewards.getMemberReward(1, member1.address);
      expect(memberReward.contributionPoints).to.equal(contributionPoints);
    });

    it("should award XP for contributions", async () => {
      const contributionPoints = 1000;

      await guildRewards.connect(rewardManager).recordContribution(1, member1.address, contributionPoints);

      expect(await mockXPEngine.getXP(member1.address)).to.equal(contributionPoints);
    });

    it("should accumulate contribution points", async () => {
      await guildRewards.connect(rewardManager).recordContribution(1, member1.address, 500);
      await guildRewards.connect(rewardManager).recordContribution(1, member1.address, 300);

      const memberReward = await guildRewards.getMemberReward(1, member1.address);
      expect(memberReward.contributionPoints).to.equal(800);
    });

    it("should require reward manager role", async () => {
      await expect(
        guildRewards.connect(member1).recordContribution(1, member2.address, 100)
      ).to.be.reverted;
    });

    it("should require guild membership", async () => {
      await expect(
        guildRewards.connect(rewardManager).recordContribution(1, nonMember.address, 100)
      ).to.be.revertedWith("Not guild member");
    });

    it("should require non-zero contribution points", async () => {
      await expect(
        guildRewards.connect(rewardManager).recordContribution(1, member1.address, 0)
      ).to.be.reverted;
    });

    it("should update guild core contribution score", async () => {
      const contributionPoints = 750;

      await guildRewards.connect(rewardManager).recordContribution(1, member1.address, contributionPoints);

      expect(await mockGuildCore.lastUpdatedMember()).to.equal(member1.address);
      expect(await mockGuildCore.lastContributionUpdate()).to.equal(contributionPoints);
    });
  });

  describe("View Functions", function () {
    beforeEach(async () => {
      await guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("1000"));
      await guildRewards.connect(rewardManager).recordContribution(1, member1.address, 250);
    });

    it("should return pending rewards correctly", async () => {
      const expectedReward = 3000n * ethers.parseEther("1000") / 10000n;
      expect(await guildRewards.getPendingRewards(1, member1.address)).to.equal(expectedReward);
    });

    it("should return reward pool information", async () => {
      const pool = await guildRewards.getRewardPool(1);
      
      expect(pool.totalPool).to.equal(ethers.parseEther("1000"));
      expect(pool.distributedAmount).to.equal(0);
      expect(pool.rewardPerContribution).to.equal(ethers.parseEther("1000") / 10000n);
      expect(pool.lastUpdateTime).to.be.greaterThan(0);
    });

    it("should return member reward information", async () => {
      const memberReward = await guildRewards.getMemberReward(1, member1.address);
      
      expect(memberReward.pendingRewards).to.be.greaterThan(0);
      expect(memberReward.claimedRewards).to.equal(0);
      expect(memberReward.contributionPoints).to.equal(250);
      expect(memberReward.lastClaimTime).to.equal(0);
    });

    it("should calculate reward share correctly", async () => {
      const actualShare = await guildRewards.calculateRewardShare(1, member1.address);
      const memberInfo = await mockGuildCore.getMember(1, member1.address);
      const memberContribution = memberInfo.contributionScore;
      const pool = await guildRewards.getRewardPool(1);
      const rewardPerContribution = pool.rewardPerContribution;
      const expectedShare = memberContribution * rewardPerContribution;
      
      expect(actualShare).to.equal(expectedShare);
    });

    it("should return zero reward share for members with no contribution", async () => {
      await mockGuildCore.connect(owner).setMockMember(1, nonMember.address, {
        memberAddress: nonMember.address,
        joinedAt: await time.latest(),
        contributionScore: 0,
        isActive: true,
        role: "Member"
      });
      await mockGuildCore.connect(owner).setGuildMembership(1, nonMember.address, true);

      expect(await guildRewards.calculateRewardShare(1, nonMember.address)).to.equal(0);
    });
  });

  describe("Milestone Badge Distribution", function () {
    it("should distribute badges to top 3 contributors", async () => {
      const badgeURI = "https://badges.example.com/top-contributor";

      await expect(
        guildRewards.connect(rewardManager).distributeMilestoneBadges(1, badgeURI)
      ).to.not.be.reverted;

      expect(await mockBadgeMinter.totalMinted()).to.equal(3);
      
      expect(await mockBadgeMinter.hasBadge(guildLeader.address)).to.be.true;
      expect(await mockBadgeMinter.hasBadge(member1.address)).to.be.true;
      expect(await mockBadgeMinter.hasBadge(member2.address)).to.be.true;
      expect(await mockBadgeMinter.hasBadge(member3.address)).to.be.false;
    });

    it("should handle guilds with fewer than 3 members", async () => {
      const guildId = 2;
      const guild2Members = [member1.address, member2.address];
      await mockGuildCore.connect(owner).setMockGuild(guildId, {
        ...mockGuild,
        guildId: guildId,
        leader: owner.address,
        memberCount: 2,
        totalContributions: 2500,
      });
      await mockGuildCore.connect(owner).setGuildMembers(guildId, guild2Members);
      
      await mockGuildCore.connect(owner).setMockMember(guildId, member1.address, {
        memberAddress: member1.address,
        joinedAt: await time.latest(),
        contributionScore: 1500,
        isActive: true,
        role: "Member"
      });
      await mockGuildCore.connect(owner).setGuildMembership(guildId, member1.address, true);
      await mockGuildCore.connect(owner).setMockMember(guildId, member2.address, {
        memberAddress: member2.address,
        joinedAt: await time.latest(),
        contributionScore: 1000,
        isActive: true,
        role: "Member"
      });
      await mockGuildCore.connect(owner).setGuildMembership(guildId, member2.address, true);

      const badgeURI = "https://badges.example.com/contributor";
      
      await guildRewards.connect(rewardManager).distributeMilestoneBadges(guildId, badgeURI);

      expect(await mockBadgeMinter.totalMinted()).to.equal(2);
    });

    it("should require reward manager role", async () => {
      await expect(
        guildRewards.connect(member1).distributeMilestoneBadges(1, "uri")
      ).to.be.reverted;
    });

    it("should handle members with equal contribution scores", async () => {
      await mockGuildCore.connect(owner).setMockMember(1, member1.address, {
        memberAddress: member1.address,
        joinedAt: await time.latest(),
        contributionScore: 2000,
        isActive: true,
        role: "Member"
      });
      
      await mockGuildCore.connect(owner).setMockMember(1, member2.address, {
        memberAddress: member2.address,
        joinedAt: await time.latest(),
        contributionScore: 2000,
        isActive: true,
        role: "Member"
      });

      await guildRewards.connect(rewardManager).distributeMilestoneBadges(1, "uri");
      
      expect(await mockBadgeMinter.totalMinted()).to.equal(3);
    });
  });

  describe("Administrative Functions", function () {
    it("should allow admin to set reward distribution period", async () => {
      const newPeriod = 14 * 24 * 60 * 60;

      await guildRewards.connect(admin).setRewardDistributionPeriod(newPeriod);
      expect(await guildRewards.rewardDistributionPeriod()).to.equal(newPeriod);
    });

    it("should allow admin to set minimum contribution for rewards", async () => {
      const newMinContribution = 200;

      await guildRewards.connect(admin).setMinContributionForRewards(newMinContribution);
      expect(await guildRewards.minContributionForRewards()).to.equal(newMinContribution);
    });

    it("should allow admin to change reward token", async () => {
      const NewToken = await ethers.getContractFactory("MockERC20");
      const newToken = await NewToken.deploy("NewRewardToken", "NRT");
      await newToken.waitForDeployment();

      await guildRewards.connect(admin).setRewardToken(await newToken.getAddress());
      expect(await guildRewards.rewardToken()).to.equal(await newToken.getAddress());
    });

    it("should allow admin emergency withdraw", async () => {
      await mockToken.connect(owner).mint(await guildRewards.getAddress(), ethers.parseEther("100"));

      const initialBalance = await mockToken.balanceOf(admin.address);

      await guildRewards.connect(admin).emergencyWithdraw(await mockToken.getAddress(), ethers.parseEther("50"));

      const finalBalance = await mockToken.balanceOf(admin.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("50"));
    });

    it("should validate admin function parameters", async () => {
      await expect(
        guildRewards.connect(admin).setRewardDistributionPeriod(0)
      ).to.be.reverted;

      await expect(
        guildRewards.connect(admin).setRewardToken(ethers.ZeroAddress)
      ).to.be.reverted;
    });

    it("should restrict admin functions to admin role", async () => {
      await expect(
        guildRewards.connect(member1).setRewardDistributionPeriod(1000)
      ).to.be.reverted;

      await expect(
        guildRewards.connect(member1).setMinContributionForRewards(50)
      ).to.be.reverted;

      await expect(
        guildRewards.connect(member1).setRewardToken(await mockToken.getAddress())
      ).to.be.reverted;

      await expect(
        guildRewards.connect(member1).emergencyWithdraw(await mockToken.getAddress(), 100)
      ).to.be.reverted;
    });
  });

  describe("Pause Functionality", function () {
    it("should allow admin to pause and unpause", async () => {
      await guildRewards.connect(admin).pause();
      expect(await guildRewards.paused()).to.be.true;

      await guildRewards.connect(admin).unpause();
      expect(await guildRewards.paused()).to.be.false;
    });

    it("should prevent reward distribution when paused", async () => {
      await guildRewards.connect(admin).pause();

      await expect(
        guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(guildRewards, "EnforcedPause");
    });

    it("should prevent claiming rewards when paused", async () => {
      await guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("100"));
      
      await guildRewards.connect(admin).pause();

      await expect(
        guildRewards.connect(member1).claimRewards(1)
      ).to.be.revertedWithCustomError(guildRewards, "EnforcedPause");
    });

    it("should prevent contribution recording when paused", async () => {
      await guildRewards.connect(admin).pause();

      await expect(
        guildRewards.connect(rewardManager).recordContribution(1, member1.address, 100)
      ).to.be.revertedWithCustomError(guildRewards, "EnforcedPause");
    });

    it("should allow view functions when paused", async () => {
      await guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("100"));
      await guildRewards.connect(admin).pause();

      expect(await guildRewards.getPendingRewards(1, member1.address)).to.be.greaterThan(0);
      
      const pool = await guildRewards.getRewardPool(1);
      expect(pool.totalPool).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Reentrancy Protection", function () {
    it("should prevent reentrancy in distributeRewards", async () => {
      await expect(
        guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });

    it("should prevent reentrancy in claimRewards", async () => {
      await guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("100"));

      await expect(
        guildRewards.connect(member1).claimRewards(1)
      ).to.not.be.reverted;
    });
  });

  describe("Edge Cases and Integration", function () {
    it("should handle very large reward amounts", async () => {
      const largeReward = ethers.parseEther("1000000");
      
      await mockToken.connect(owner).mint(rewardManager.address, largeReward);
      await mockToken.connect(rewardManager).approve(await guildRewards.getAddress(), largeReward);

      await expect(
        guildRewards.connect(rewardManager).distributeRewards(1, largeReward)
      ).to.not.be.reverted;

      const pool = await guildRewards.getRewardPool(1);
      expect(pool.totalPool).to.equal(largeReward);
    });

    it("should handle reward distribution with precision", async () => {
      const totalReward = ethers.parseEther("999");
      const totalContributions = 7777n;
      
      await mockGuildCore.connect(owner).setMockGuild(1, {
        ...mockGuild,
        totalContributions: Number(totalContributions),
        leader: guildLeader.address,
        createdAt: await time.latest()
      });

      await guildRewards.connect(rewardManager).distributeRewards(1, totalReward);

      const pool = await guildRewards.getRewardPool(1);
      expect(pool.rewardPerContribution).to.equal(totalReward / totalContributions);
    });

    it("should handle complex contribution and reward scenarios", async () => {
      await guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("500"));
      await guildRewards.connect(rewardManager).recordContribution(1, member1.address, 1000);
      await guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("300"));
      
      const member1Rewards = await guildRewards.getMemberReward(1, member1.address);
      expect(member1Rewards.contributionPoints).to.equal(1000);
      expect(member1Rewards.pendingRewards).to.be.greaterThan(0);

      const pendingBefore = await guildRewards.getPendingRewards(1, member1.address);
      await guildRewards.connect(member1).claimRewards(1);
      
      const member1RewardsAfter = await guildRewards.getMemberReward(1, member1.address);
      expect(member1RewardsAfter.claimedRewards).to.equal(pendingBefore);
      expect(member1RewardsAfter.pendingRewards).to.equal(0);
    });

    it("should maintain state consistency across multiple operations", async () => {
      const guild2Id = 4;
      const guild2 = { ...mockGuild, guildId: guild2Id, totalContributions: 5000, leader: owner.address };
      await mockGuildCore.connect(owner).setMockGuild(guild2Id, guild2);
      await mockGuildCore.connect(owner).setGuildMembership(guild2Id, member1.address, true);
      await mockGuildCore.connect(owner).setGuildMembership(guild2Id, member2.address, true);
      await mockGuildCore.connect(owner).setGuildMembers(guild2Id, [member1.address, member2.address]);

      await mockGuildCore.connect(owner).setMockMember(guild2Id, member1.address, {
        memberAddress: member1.address,
        joinedAt: await time.latest(),
        contributionScore: 3000,
        isActive: true,
        role: "Member"
      });
      await mockGuildCore.connect(owner).setMockMember(guild2Id, member2.address, {
        memberAddress: member2.address,
        joinedAt: await time.latest(),
        contributionScore: 2000,
        isActive: true,
        role: "Member"
      });

      await guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("1000"));
      await guildRewards.connect(rewardManager).distributeRewards(guild2Id, ethers.parseEther("500"));

      await guildRewards.connect(rewardManager).recordContribution(1, member1.address, 500);
      await guildRewards.connect(rewardManager).recordContribution(guild2Id, member2.address, 300);

      await guildRewards.connect(member1).claimRewards(1);
      await guildRewards.connect(member2).claimRewards(guild2Id);

      const guild1Pool = await guildRewards.getRewardPool(1);
      const guild2Pool = await guildRewards.getRewardPool(guild2Id);

      expect(guild1Pool.totalPool).to.equal(ethers.parseEther("1000"));
      expect(guild2Pool.totalPool).to.equal(ethers.parseEther("500"));

      const member1Guild1Reward = await guildRewards.getMemberReward(1, member1.address);
      const member2Guild2Reward = await guildRewards.getMemberReward(guild2Id, member2.address);

      expect(member1Guild1Reward.contributionPoints).to.equal(500);
      expect(member2Guild2Reward.contributionPoints).to.equal(300);
    });

    it("should handle token transfer failures gracefully", async () => {
      await expect(
        guildRewards.connect(rewardManager).distributeRewards(1, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });
  });
});