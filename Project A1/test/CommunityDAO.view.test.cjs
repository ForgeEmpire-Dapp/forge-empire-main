const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CommunityDAO View Functions", function () {
  let CommunityDAO;
  let communityDAO;
  let owner, addr1, proposer, voter1, voter2;
  let proposalId;

  beforeEach(async function () {
    [owner, addr1, proposer, voter1, voter2] = await ethers.getSigners();
    CommunityDAO = await ethers.getContractFactory("CommunityDAO");
    communityDAO = await CommunityDAO.deploy(86400, 1, 100); // Changed quorumPercentage to 1
    await communityDAO.waitForDeployment();

    await communityDAO.grantRole(await communityDAO.PROPOSER_ROLE(), proposer.address);
    await communityDAO.grantRole(await communityDAO.EXECUTOR_ROLE(), owner.address);

    const target = addr1.address;
    const callData = "0x12345678";
    const description = "Test Proposal";

    const tx = await communityDAO.connect(proposer).propose(description, target, callData);
    const receipt = await tx.wait();
    proposalId = receipt.logs[0].args.proposalId;
  });

  it("Should return the correct proposal state when active", async function () {
    const [isActive, hasEnded, isExecutable, totalVotesFor, totalVotesAgainst, executed] = await communityDAO.getProposalState(proposalId);
    expect(isActive).to.be.true;
    expect(hasEnded).to.be.false;
    expect(isExecutable).to.be.false;
    expect(totalVotesFor).to.equal(0);
    expect(totalVotesAgainst).to.equal(0);
    expect(executed).to.be.false;
  });

  it("Should return the correct proposal state when ended and not executable", async function () {
    await ethers.provider.send("evm_increaseTime", [86401]);
    await ethers.provider.send("evm_mine", []);

    const [isActive, hasEnded, isExecutable, totalVotesFor, totalVotesAgainst, executed] = await communityDAO.getProposalState(proposalId);
    expect(isActive).to.be.false;
    expect(hasEnded).to.be.true;
    expect(isExecutable).to.be.false;
    expect(totalVotesFor).to.equal(0);
    expect(totalVotesAgainst).to.equal(0);
    expect(executed).to.be.false;
  });

  it("Should return the correct proposal state when executable", async function () {
    await communityDAO.connect(voter1).vote(proposalId, true);
    await communityDAO.connect(voter2).vote(proposalId, true);

    await ethers.provider.send("evm_increaseTime", [86401]);
    await ethers.provider.send("evm_mine", []);

    const [isActive, hasEnded, isExecutable, totalVotesFor, totalVotesAgainst, executed] = await communityDAO.getProposalState(proposalId);
    expect(isActive).to.be.false;
    expect(hasEnded).to.be.true;
    expect(isExecutable).to.be.true;
    expect(totalVotesFor).to.equal(2);
    expect(totalVotesAgainst).to.equal(0);
    expect(executed).to.be.false;
  });

  it("Should return the correct proposal state when executed", async function () {
    await communityDAO.connect(voter1).vote(proposalId, true);
    await communityDAO.connect(voter2).vote(proposalId, true);

    await ethers.provider.send("evm_increaseTime", [86401]);
    await ethers.provider.send("evm_mine", []);

    await communityDAO.executeProposal(proposalId);

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 3600 + 1]);
    await ethers.provider.send("evm_mine", []);

    await communityDAO.executeProposal(proposalId);

    const [isActive, hasEnded, isExecutable, totalVotesFor, totalVotesAgainst, executed] = await communityDAO.getProposalState(proposalId);
    expect(isActive).to.be.false;
    expect(hasEnded).to.be.true;
    expect(isExecutable).to.be.false;
    expect(totalVotesFor).to.equal(2);
    expect(totalVotesAgainst).to.equal(0);
    expect(executed).to.be.true;
  });

  it("Should return the correct proposal data", async function () {
    const [id, proposerAddress, description, target, callData, voteStartTime, voteEndTime, snapshotBlock, votesFor, votesAgainst, executed] = await communityDAO.getProposal(proposalId);
    expect(id).to.equal(proposalId);
    expect(proposerAddress).to.equal(proposer.address);
    expect(description).to.equal("Test Proposal");
    expect(target).to.equal(addr1.address);
    expect(callData).to.equal("0x12345678");
    expect(voteStartTime).to.be.gt(0);
    expect(voteEndTime).to.be.gt(voteStartTime);
    expect(snapshotBlock).to.be.gt(0);
    expect(votesFor).to.equal(0);
    expect(votesAgainst).to.equal(0);
    expect(executed).to.be.false;
  });

  it("Should return true if a user has voted", async function () {
    await communityDAO.connect(voter1).vote(proposalId, true);
    expect(await communityDAO.hasVoted(proposalId, voter1.address)).to.be.true;
  });

  it("Should return false if a user has not voted", async function () {
    expect(await communityDAO.hasVoted(proposalId, voter1.address)).to.be.false;
  });
});
