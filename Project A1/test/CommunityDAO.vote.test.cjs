const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CommunityDAO Vote and Execute", function () {
  let CommunityDAO;
  let communityDAO;
  let owner;
  let addr1;
  let addr2;
  let proposalId;
  const VOTING_PERIOD_DURATION = 86400; // 1 day

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    CommunityDAO = await ethers.getContractFactory("CommunityDAO");
    communityDAO = await CommunityDAO.deploy(VOTING_PERIOD_DURATION, 1, 100);
    await communityDAO.waitForDeployment();

    await communityDAO.grantRole(await communityDAO.PROPOSER_ROLE(), owner.address);
    await communityDAO.grantRole(await communityDAO.EXECUTOR_ROLE(), owner.address);
    await communityDAO.grantRole(await communityDAO.DEFAULT_ADMIN_ROLE(), communityDAO.target);

    const target = addr2.address;
    const callData = "0x12345678";
    const description = "Test Proposal for Voting";

    const tx = await communityDAO.propose(description, target, callData);
    const receipt = await tx.wait();
    proposalId = receipt.logs[0].args.proposalId;
  });

  it("Should allow users to vote on a proposal", async function () {
    await expect(communityDAO.vote(proposalId, true))
      .to.emit(communityDAO, "VoteCast")
      .withArgs(proposalId, owner.address, true, 1);

    const proposal = await communityDAO.proposals(proposalId);
    expect(proposal.votesFor).to.equal(1);
    expect(proposal.votesAgainst).to.equal(0);
  });

  it("Should not allow voting on a non-existent proposal", async function () {
    await expect(communityDAO.vote(999, true))
      .to.be.revertedWithCustomError(communityDAO, "ProposalNotFound");
  });

  it("Should not allow voting after the voting period has ended", async function () {
    await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD_DURATION + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(communityDAO.vote(proposalId, true))
      .to.be.revertedWithCustomError(communityDAO, "VotingNotActive");
  });

  it("Should not allow a user to vote more than once", async function () {
    await communityDAO.vote(proposalId, true);
    await expect(communityDAO.vote(proposalId, true))
      .to.be.revertedWithCustomError(communityDAO, "AlreadyVoted");
  });

  it("Should execute a successful proposal", async function () {
    await communityDAO.vote(proposalId, true);

    await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD_DURATION + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(communityDAO.executeProposal(proposalId))
      .to.emit(communityDAO, "ProposalQueued");

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 3600 + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(communityDAO.executeProposal(proposalId))
      .to.emit(communityDAO, "ProposalExecuted");
  });

  it("Should not execute a proposal if quorum is not reached", async function () {
    await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD_DURATION + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(communityDAO.executeProposal(proposalId))
      .to.be.revertedWithCustomError(communityDAO, "QuorumNotReached");
  });
});
