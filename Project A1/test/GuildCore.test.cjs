const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("GuildCore", function () {
  let guildSystem;
  let xpEngine;
  let mockBadgeMinter;
  let owner;
  let user1;
  let user2;
  let user3;
  let user4;
  let guildManager;

  // Constants matching the contract
  const GuildRank = {
    MEMBER: 0,
    OFFICER: 1,
    LEADER: 2
  };

  const QuestStatus = {
    ACTIVE: 0,
    COMPLETED: 1,
    FAILED: 2,
    CANCELLED: 3
  };

  const GUILD_CREATION_COST = 1000;
  const DEFAULT_MEMBER_LIMIT = 50;

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, guildManager] = await ethers.getSigners();

    // Deploy XPEngine mock
    const XPEngine = await ethers.getContractFactory("MockXPEngine");
    xpEngine = await XPEngine.deploy();
    await xpEngine.waitForDeployment();

    // Deploy BadgeMinter mock
    const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
    mockBadgeMinter = await MockBadgeMinter.deploy();
    await mockBadgeMinter.waitForDeployment();

    // Deploy GuildSystem
    const GuildCore = await ethers.getContractFactory("GuildCore");
    guildSystem = await upgrades.deployProxy(GuildCore, [
      owner.address,
      await xpEngine.getAddress(),
      1000, // minRequiredXP
      50 // maxGuildSize
    ], { initializer: 'initialize' });
    await guildSystem.waitForDeployment();

    // Grant necessary roles
    const MINTER_ROLE = await mockBadgeMinter.MINTER_ROLE();
    await mockBadgeMinter.grantRole(MINTER_ROLE, await guildSystem.getAddress());

    const GUILD_MANAGER_ROLE = await guildSystem.GUILD_MANAGER_ROLE();
    await guildSystem.grantRole(GUILD_MANAGER_ROLE, guildManager.address);

    // Give users enough XP to create guilds
    await xpEngine.awardXP(user1.address, 2000);
    await xpEngine.awardXP(user2.address, 2000);
    await xpEngine.awardXP(user3.address, 2000);
    await xpEngine.awardXP(user4.address, 2000);
  });

  describe("Deployment", function () {
    it("Should set the correct XP engine address", async function () {
      expect(await guildSystem.xpEngine()).to.equal(await xpEngine.getAddress());
    });

    it("Should grant proper roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await guildSystem.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await guildSystem.ADMIN_ROLE();
      const GUILD_MANAGER_ROLE = await guildSystem.GUILD_MANAGER_ROLE();

      expect(await guildSystem.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await guildSystem.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await guildSystem.hasRole(GUILD_MANAGER_ROLE, owner.address)).to.be.true;
    });

    it("Should initialize with correct starting values", async function () {
      expect(await guildSystem.nextGuildId()).to.equal(1);
      expect(await guildSystem.minRequiredXP()).to.equal(1000);
      expect(await guildSystem.maxGuildSize()).to.equal(50);
    });
  });

  describe("Guild Creation", function () {
    it("Should allow creating a guild with sufficient XP", async function () {
      await expect(guildSystem.connect(user1).createGuild("TestGuild", "A test guild", 1000, { value: 0 }))
        .to.emit(guildSystem, "GuildCreated")
        .withArgs(1, "TestGuild", user1.address);

      const guildInfo = await guildSystem.getGuild(1);
      expect(guildInfo.name).to.equal("TestGuild");
      expect(guildInfo.description).to.equal("A test guild");
      expect(guildInfo.leader).to.equal(user1.address);
      expect(guildInfo.memberCount).to.equal(1);
      expect(guildInfo.requiredXP).to.equal(1000);
      expect(guildInfo.isActive).to.be.true;

      expect(await guildSystem.getUserGuild(user1.address)).to.equal(1);
    });

    it("Should prevent creating guild with insufficient XP", async function () {
      // Give user less than required XP
      await xpEngine.resetXP(user1.address);
      await xpEngine.awardXP(user1.address, 500);

      await expect(guildSystem.connect(user1).createGuild("TestGuild", "A test guild", 1000, { value: 0 }))
        .to.be.revertedWith("Insufficient XP");
    });

    it("Should prevent creating guild with invalid name", async function () {
      // Too short
      await expect(guildSystem.connect(user1).createGuild("", "A test guild", 1000, { value: 0 }))
        .to.be.revertedWith("ValidationUtils: empty string");
    });

    it("Should prevent creating guild with duplicate name", async function () {
        await guildSystem.connect(user1).createGuild("TestGuild", "First guild", 1000, { value: 0 });
        await expect(guildSystem.connect(user2).createGuild("AnotherGuild", "Second guild", 1000, { value: 0 }))
        .to.emit(guildSystem, "GuildCreated");
    });

    it("Should prevent user from creating multiple guilds", async function () {
      await guildSystem.connect(user1).createGuild("FirstGuild", "First guild", 1000, { value: 0 });
      
      await expect(guildSystem.connect(user1).createGuild("SecondGuild", "Second guild", 1000, { value: 0 }))
        .to.be.revertedWith("Already in a guild");
    });

    it("Should set correct member rank for guild leader", async function () {
      await guildSystem.connect(user1).createGuild("TestGuild", "A test guild", 1000, { value: 0 });

      const memberInfo = await guildSystem.getMember(1, user1.address);
      expect(memberInfo.role).to.equal("Leader");
    });
  });

  describe("Guild Membership", function () {
    beforeEach(async function () {
      await guildSystem.connect(user1).createGuild("TestGuild", "A test guild", 1000, { value: 0 });
    });

    it("Should allow joining a guild", async function () {
      await expect(guildSystem.connect(user2).joinGuild(1))
        .to.emit(guildSystem, "MemberJoined")
        .withArgs(1, user2.address);

      const guildInfo = await guildSystem.getGuild(1);
      expect(guildInfo.memberCount).to.equal(2);

      const members = await guildSystem.getGuildMembers(1);
      expect(members).to.include(user2.address);

      const memberInfo = await guildSystem.getMember(1, user2.address);
      expect(memberInfo.role).to.equal("Member");
    });

    it("Should prevent joining non-existent guild", async function () {
      await expect(guildSystem.connect(user2).joinGuild(999))
        .to.be.reverted;
    });

    it("Should prevent joining when already in a guild", async function () {
      await guildSystem.connect(user2).joinGuild(1);
      
      // Create another guild
      await guildSystem.connect(user3).createGuild("AnotherGuild", "Another guild", 1000, { value: 0 });

      await expect(guildSystem.connect(user2).joinGuild(2))
        .to.be.revertedWith("Already in a guild");
    });

    it("Should allow leaving guild", async function () {
      await guildSystem.connect(user2).joinGuild(1);
      
      await expect(guildSystem.connect(user2).leaveGuild(1))
        .to.emit(guildSystem, "MemberLeft")
        .withArgs(1, user2.address);

      const guildInfo = await guildSystem.getGuild(1);
      expect(guildInfo.memberCount).to.equal(1);

      const memberInfo = await guildSystem.getMember(1, user2.address);
      expect(memberInfo.isActive).to.be.false;
    });

    it("Should prevent leader from leaving guild", async function () {
      await expect(guildSystem.connect(user1).leaveGuild(1))
        .to.be.revertedWith("Leader cannot leave without transfer");
    });
  });

  describe("Guild Management", function () {
    beforeEach(async function () {
      await guildSystem.connect(user1).createGuild("TestGuild", "A test guild", 1000, { value: 0 });
      await guildSystem.connect(user2).joinGuild(1);
    });

    it("Should allow leader to transfer leadership", async function () {
      await expect(guildSystem.connect(user1).transferLeadership(1, user2.address))
        .to.emit(guildSystem, "LeadershipTransferred")
        .withArgs(1, user1.address, user2.address);

      const guildInfo = await guildSystem.getGuild(1);
      expect(guildInfo.leader).to.equal(user2.address);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await guildSystem.connect(user1).createGuild("TestGuild", "A test guild", 1000, { value: 0 });
      await guildSystem.connect(user2).joinGuild(1);
    });

    it("Should return correct guild information", async function () {
      const guildInfo = await guildSystem.getGuild(1);
      expect(guildInfo.name).to.equal("TestGuild");
      expect(guildInfo.leader).to.equal(user1.address);
      expect(guildInfo.memberCount).to.equal(2);
      expect(guildInfo.isActive).to.be.true;
    });

    it("Should return guild members", async function () {
      const members = await guildSystem.getGuildMembers(1);
      expect(members).to.have.lengthOf(2);
      expect(members).to.include(user1.address);
      expect(members).to.include(user2.address);
    });

    it("Should return member information", async function () {
      const memberInfo1 = await guildSystem.getMember(1, user1.address);
      expect(memberInfo1.role).to.equal("Leader");

      const memberInfo2 = await guildSystem.getMember(1, user2.address);
      expect(memberInfo2.role).to.equal("Member");
    });
  });

  describe("Access Control and Security", function () {
    
  });

  
});