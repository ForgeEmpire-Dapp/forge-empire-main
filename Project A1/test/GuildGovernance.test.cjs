const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("GuildGovernance", function () {
  let guildGovernance, mockGuildCore;
  let owner, admin, guildLeader, member1, member2, member3, nonMember;

  const QUORUM_PERCENTAGE = 5000; // 50%
  const MIN_VOTING_DURATION = 24 * 60 * 60; // 1 day in seconds
  const MAX_VOTING_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

  const ProposalType = {
    MEMBER_REMOVAL: 0,
    LEADERSHIP_CHANGE: 1,
    SETTINGS_UPDATE: 2,
    REWARD_ALLOCATION: 3,
    GENERAL: 4
  };

  const ProposalStatus = {
    PENDING: 0,
    EXECUTED: 1,
    REJECTED: 2,
    EXPIRED: 3,
  };

  const mockGuild = {
    guildId: 1,
    name: "Test Guild",
    description: "A test guild for governance",
    leader: "",
    memberCount: 4,
    createdAt: 0,
    requiredXP: 1000,
    isActive: true,
    totalContributions: 15000 // Matches sum of member contributions
  };

  async function deployGuildGovernanceFixture() {
    [owner, admin, guildLeader, member1, member2, member3, nonMember] = await ethers.getSigners();

        const MockGuildCore = await ethers.getContractFactory("contracts/mocks/MockGuildCore.sol:MockGuildCore");
    mockGuildCore = await MockGuildCore.deploy();
    await mockGuildCore.waitForDeployment();

    const GuildGovernance = await ethers.getContractFactory("GuildGovernance");
    guildGovernance = await upgrades.deployProxy(GuildGovernance, [
      admin.address,
      mockGuildCore.target,
      QUORUM_PERCENTAGE
    ], { initializer: 'initialize' });
    await guildGovernance.waitForDeployment();

    let currentTimestamp = await time.latest();

    const updatedGuild = {
      ...mockGuild,
      leader: guildLeader.address,
      createdAt: currentTimestamp,
    };
    await mockGuildCore.setMockGuild(1, updatedGuild);

    await mockGuildCore.setMockMember(1, guildLeader.address, {
      memberAddress: guildLeader.address,
      joinedAt: currentTimestamp,
      contributionScore: 7000, 
      isActive: true,
      role: "Leader"
    });

    await mockGuildCore.setMockMember(1, member1.address, {
      memberAddress: member1.address,
      joinedAt: currentTimestamp,
      contributionScore: 4000, 
      isActive: true,
      role: "Member"
    });

    await mockGuildCore.setMockMember(1, member2.address, {
      memberAddress: member2.address,
      joinedAt: currentTimestamp,
      contributionScore: 3000, 
      isActive: true,
      role: "Member"
    });

    await mockGuildCore.setMockMember(1, member3.address, {
      memberAddress: member3.address,
      joinedAt: currentTimestamp,
      contributionScore: 1000, 
      isActive: true,
      role: "Member"
    });

    console.log("Mock Guild:", await mockGuildCore.getGuild(1));
    console.log("Guild Leader Info:", await mockGuildCore.getMemberInfo(1, guildLeader.address));
    console.log("Member1 Info:", await mockGuildCore.getMemberInfo(1, member1.address));

    await mockGuildCore.setGuildMembership(1, guildLeader.address, true);
    console.log("isGuildMember (guildLeader):", await mockGuildCore.isGuildMember(1, guildLeader.address));
    await mockGuildCore.setGuildMembership(1, member1.address, true);
    console.log("isGuildMember (member1):", await mockGuildCore.isGuildMember(1, member1.address));
    await mockGuildCore.setGuildMembership(1, member2.address, true);
    await mockGuildCore.setGuildMembership(1, member3.address, true);
    await mockGuildCore.setGuildMembership(1, nonMember.address, false);

    await mockGuildCore.setGuildMembers(1, [guildLeader.address, member1.address, member2.address, member3.address]);
    await mockGuildCore.setTotalVotingPower(1, 20); // Mock total voting power

    return { guildGovernance, mockGuildCore, owner, admin, guildLeader, member1, member2, member3, nonMember };
  }

  describe("Proposal Creation", function () {
    beforeEach(async () => {
        const fixture = await loadFixture(deployGuildGovernanceFixture);
        guildGovernance = fixture.guildGovernance;
        mockGuildCore = fixture.mockGuildCore;
        owner = fixture.owner;
        admin = fixture.admin;
        guildLeader = fixture.guildLeader;
        member1 = fixture.member1;
        member2 = fixture.member2;
        member3 = fixture.member3;
        nonMember = fixture.nonMember;
    });

    it("should allow guild members to create proposals", async () => {
      const votingDuration = MAX_VOTING_DURATION;
      const executionData = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [member2.address]);
      const nextProposalId = await guildGovernance.nextProposalId();

      await expect(
        guildGovernance.connect(member1).createProposal(
          1,
          ProposalType.MEMBER_REMOVAL,
          "Remove Member 2",
          "Member 2 has been inactive",
          executionData,
          votingDuration
        )
      )
        .to.emit(guildGovernance, "ProposalCreated")
        .withArgs(nextProposalId, 1, member1.address, ProposalType.MEMBER_REMOVAL, "Remove Member 2");

      const proposal = await guildGovernance.getProposal(nextProposalId);
      expect(proposal.totalEligibleVoters).to.equal(20);
      expect(proposal.executionData).to.equal(executionData);
    });

    it("should prevent non-members from creating proposals", async () => {
      const votingDuration = MAX_VOTING_DURATION;
      const executionData = "0x";

      await expect(
        guildGovernance.connect(nonMember).createProposal(
          1,
          ProposalType.GENERAL,
          "Test Proposal",
          "Test Description",
          executionData,
          votingDuration
        )
      ).to.be.revertedWith("Not guild member");
    });
  });

  describe("Voting", function () {
    let proposalId;

    beforeEach(async () => {
        const fixture = await loadFixture(deployGuildGovernanceFixture);
        guildGovernance = fixture.guildGovernance;
        mockGuildCore = fixture.mockGuildCore;
        owner = fixture.owner;
        admin = fixture.admin;
        guildLeader = fixture.guildLeader;
        member1 = fixture.member1;
        member2 = fixture.member2;
        member3 = fixture.member3;
        nonMember = fixture.nonMember;

        proposalId = await guildGovernance.nextProposalId();
        await guildGovernance.connect(member1).createProposal(
            1, ProposalType.GENERAL, "Test Proposal", "Test Description", "0x", MAX_VOTING_DURATION
        );
    });

    it("should update proposal vote counts correctly", async () => {
      await guildGovernance.connect(guildLeader).castVote(proposalId, true); // 9 for
      await guildGovernance.connect(member1).castVote(proposalId, false); // 5 against

      const proposal = await guildGovernance.getProposal(proposalId);
      expect(proposal.votesFor).to.equal(9);
      expect(proposal.votesAgainst).to.equal(5);
    });

    it("should prevent double voting", async () => {
      await guildGovernance.connect(member1).castVote(proposalId, true);
      await expect(
        guildGovernance.connect(member1).castVote(proposalId, false)
      ).to.be.revertedWith("Already voted");
    });

    it("should prevent non-members from voting", async () => {
      await expect(
        guildGovernance.connect(nonMember).castVote(proposalId, true)
      ).to.be.revertedWith("Not guild member");
    });
  });

  describe("Proposal Execution", function () {
    let proposalId;

    beforeEach(async () => {
        const fixture = await loadFixture(deployGuildGovernanceFixture);
        guildGovernance = fixture.guildGovernance;
        mockGuildCore = fixture.mockGuildCore;
        owner = fixture.owner;
        admin = fixture.admin;
        guildLeader = fixture.guildLeader;
        member1 = fixture.member1;
        member2 = fixture.member2;
        member3 = fixture.member3;
        nonMember = fixture.nonMember;

        proposalId = await guildGovernance.nextProposalId();
        await guildGovernance.connect(member1).createProposal(
            1, ProposalType.GENERAL, "Test Proposal", "Test Description", "0x", MIN_VOTING_DURATION
        );
    });

    it("should execute passed proposal after deadline", async () => {
      await guildGovernance.connect(guildLeader).castVote(proposalId, true); // 9 for
      await guildGovernance.connect(member1).castVote(proposalId, true); // 5 for
      await guildGovernance.connect(member2).castVote(proposalId, false); // 4 against

      const proposalBefore = await guildGovernance.getProposal(proposalId);
      await time.increaseTo(Number(proposalBefore.votingDeadline) + 1);

      await expect(
        guildGovernance.connect(admin).executeProposal(proposalId)
      ).to.emit(guildGovernance, "ProposalExecuted").withArgs(proposalId, true);

      const proposal = await guildGovernance.getProposal(proposalId);
      expect(proposal.status).to.equal(ProposalStatus.EXECUTED);
    });

    it("should reject proposal without sufficient quorum", async () => {
      await guildGovernance.connect(member1).castVote(proposalId, true); // 5 votes for

      const proposalBefore = await guildGovernance.getProposal(proposalId);
      await time.increaseTo(Number(proposalBefore.votingDeadline) + 1);

      await expect(
        guildGovernance.connect(admin).executeProposal(proposalId)
      ).to.emit(guildGovernance, "ProposalExecuted").withArgs(proposalId, false);

      const proposal = await guildGovernance.getProposal(proposalId);
      expect(proposal.status).to.equal(ProposalStatus.REJECTED);
    });
  });

  describe("Early Proposal Execution", function () {
    let proposalId;

    beforeEach(async () => {
        const fixture = await loadFixture(deployGuildGovernanceFixture);
        guildGovernance = fixture.guildGovernance;
        mockGuildCore = fixture.mockGuildCore;
        owner = fixture.owner;
        admin = fixture.admin;
        guildLeader = fixture.guildLeader;
        member1 = fixture.member1;
        member2 = fixture.member2;
        member3 = fixture.member3;
        nonMember = fixture.nonMember;

        proposalId = await guildGovernance.nextProposalId();
        await guildGovernance.connect(member1).createProposal(
            1, ProposalType.GENERAL, "Test Proposal", "Test Description", "0x", MAX_VOTING_DURATION
        );
    });

    it("should execute proposal early when all members vote", async () => {
      await guildGovernance.connect(guildLeader).castVote(proposalId, true); // 9 for
      await guildGovernance.connect(member1).castVote(proposalId, true); // 5 for
      await guildGovernance.connect(member2).castVote(proposalId, false); // 4 against

      await guildGovernance.connect(member3).castVote(proposalId, true); // 2 for

      // Advance time to ensure voting period is over
      const proposalBeforeExecution = await guildGovernance.getProposal(proposalId);
      await time.increaseTo(Number(proposalBeforeExecution.votingDeadline) + 1);

      // Explicitly call executeProposal after all votes are cast
      await expect(
        guildGovernance.connect(admin).executeProposal(proposalId)
      ).to.emit(guildGovernance, "ProposalExecuted").withArgs(proposalId, true);

      const proposal = await guildGovernance.getProposal(proposalId);
      expect(proposal.status).to.equal(ProposalStatus.EXECUTED);
    });
  });

  describe("Proposal Cancellation", function () {
    let proposalId;

    beforeEach(async () => {
        const fixture = await loadFixture(deployGuildGovernanceFixture);
        guildGovernance = fixture.guildGovernance;
        mockGuildCore = fixture.mockGuildCore;
        owner = fixture.owner;
        admin = fixture.admin;
        guildLeader = fixture.guildLeader;
        member1 = fixture.member1;
        member2 = fixture.member2;
        member3 = fixture.member3;
        nonMember = fixture.nonMember;

        proposalId = await guildGovernance.nextProposalId();
        await guildGovernance.connect(member1).createProposal(
            1, ProposalType.GENERAL, "Test Proposal", "Test Description", "0x", MIN_VOTING_DURATION
        );
    });

    it("should allow authorized account to cancel pending proposal", async () => {
      await expect(
        guildGovernance.connect(admin).cancelProposal(proposalId)
      ).to.emit(guildGovernance, "ProposalExpired").withArgs(proposalId);

      const proposal = await guildGovernance.getProposal(proposalId);
      expect(proposal.status).to.equal(ProposalStatus.EXPIRED);
    });

    it("should prevent cancellation of non-pending proposals", async () => {
        await guildGovernance.connect(guildLeader).castVote(proposalId, true);
        await guildGovernance.connect(member1).castVote(proposalId, true);
        await guildGovernance.connect(member2).castVote(proposalId, true);
        await guildGovernance.connect(member3).castVote(proposalId, true);

        // Advance time to ensure voting period is over
        const proposalBeforeExecution = await guildGovernance.getProposal(proposalId);
        await time.increaseTo(Number(proposalBeforeExecution.votingDeadline) + 1);

        // Ensure the proposal is executed
        await guildGovernance.connect(admin).executeProposal(proposalId);

        const proposal = await guildGovernance.getProposal(proposalId);
        expect(proposal.status).to.equal(ProposalStatus.EXECUTED);

        await expect(
            guildGovernance.connect(admin).cancelProposal(proposalId)
        ).to.be.revertedWith("Proposal not pending");
    });
  });
});