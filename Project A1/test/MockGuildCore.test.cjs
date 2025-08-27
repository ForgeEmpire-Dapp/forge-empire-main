const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockGuildCore", function () {
  let mockGuildCore, owner, member1, member2;

  beforeEach(async () => {
    [owner, member1, member2] = await ethers.getSigners();
    const MockGuildCore = await ethers.getContractFactory("contracts/mocks/MockGuildCore.sol:MockGuildCore");
    mockGuildCore = await MockGuildCore.deploy();
    await mockGuildCore.waitForDeployment();
  });

  it("should allow setting and getting mock guild data", async () => {
    const guildData = {
      guildId: 1,
      name: "Test Guild",
      description: "A test guild",
      leader: owner.address,
      memberCount: 1,
      createdAt: Math.floor(Date.now() / 1000),
      requiredXP: 100,
      isActive: true,
      totalContributions: 1000
    };

    await mockGuildCore.setMockGuild(1, guildData);
    const retrievedGuild = await mockGuildCore.getGuild(1);

    expect(retrievedGuild.name).to.equal(guildData.name);
    expect(retrievedGuild.leader).to.equal(guildData.leader);
  });

  it("should allow setting and checking guild membership", async () => {
    await mockGuildCore.setGuildMembership(1, member1.address, true);
    const isMember = await mockGuildCore.isGuildMember(1, member1.address);
    expect(isMember).to.be.true;
  });

  it("should return false for non-members", async () => {
    await mockGuildCore.setGuildMembership(1, member1.address, true);
    const isMember = await mockGuildCore.isGuildMember(1, member2.address);
    expect(isMember).to.be.false;
  });
});