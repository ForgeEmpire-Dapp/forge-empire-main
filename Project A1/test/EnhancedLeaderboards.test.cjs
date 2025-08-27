const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("LeaderboardCore", function () {
  let leaderboards;
  let xpEngine;
  let mockBadgeMinter;
  let owner;
  let user1;
  let user2;
  let user3;
  let user4;
  let admin;
  let scoreUpdater;

  // Constants matching the contract
  const LeaderboardType = {
    XP_TOTAL: 0,
    TRADING_VOLUME: 1,
    QUEST_COMPLETION: 2,
    GOVERNANCE_PARTICIPATION: 3,
    REFERRAL_COUNT: 4,
    STREAK_LENGTH: 5,
    GUILD_CONTRIBUTION: 6,
    SOCIAL_ENGAGEMENT: 7
  };

  const TimeFrame = {
    DAILY: 0,
    WEEKLY: 1,
    MONTHLY: 2,
    ALL_TIME: 3
  };

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, admin, scoreUpdater] = await ethers.getSigners();

    // Deploy XPEngine mock
    const XPEngine = await ethers.getContractFactory("MockXPEngine");
    xpEngine = await XPEngine.deploy();
    await xpEngine.waitForDeployment();

    // Deploy BadgeMinter mock
    const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
    mockBadgeMinter = await MockBadgeMinter.deploy();
    await mockBadgeMinter.waitForDeployment();

    // Deploy LeaderboardCore
    const LeaderboardCore = await ethers.getContractFactory("LeaderboardCore");
    leaderboards = await upgrades.deployProxy(LeaderboardCore, [owner.address], { initializer: 'initialize' });
    await leaderboards.waitForDeployment();

    // Grant necessary roles
    const SCORE_UPDATER_ROLE = await leaderboards.SCORE_MANAGER_ROLE();
    
    await leaderboards.connect(owner).grantRole(SCORE_UPDATER_ROLE, owner.address);

  });

  describe("Deployment", function () {
    it("Should set the correct admin address", async function () {
      const ADMIN_ROLE = await leaderboards.ADMIN_ROLE();
      expect(await leaderboards.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should grant proper roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await leaderboards.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await leaderboards.ADMIN_ROLE();
      const SCORE_UPDATER_ROLE = await leaderboards.SCORE_MANAGER_ROLE();

      expect(await leaderboards.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await leaderboards.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await leaderboards.hasRole(SCORE_UPDATER_ROLE, owner.address)).to.be.true;
    });
  });
});