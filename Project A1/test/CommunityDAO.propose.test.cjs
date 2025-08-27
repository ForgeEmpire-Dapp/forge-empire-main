const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CommunityDAO Propose", function () {
  let CommunityDAO;
  let communityDAO;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    CommunityDAO = await ethers.getContractFactory("CommunityDAO");
    communityDAO = await CommunityDAO.deploy(86400, 51, 100);
    await communityDAO.waitForDeployment();
    await communityDAO.grantRole(await communityDAO.PROPOSER_ROLE(), owner.address);
  });

  it("Should allow a user with PROPOSER_ROLE to create a proposal", async function () {
    const target = addr1.address;
    const callData = "0x12345678";
    const description = "Test Proposal";

    await expect(communityDAO.propose(description, target, callData))
      .to.emit(communityDAO, "ProposalCreated");
  });

  it("Should not allow a user without PROPOSER_ROLE to create a proposal", async function () {
    const target = communityDAO.target;
    const callData = "0x12345678";
    const description = "Test Proposal";

    await expect(communityDAO.connect(addr1).propose(description, target, callData))
      .to.be.revertedWithCustomError(communityDAO, "AccessControlUnauthorizedAccount");
  });

  it("Should not allow creating a proposal with an empty description", async function () {
    const target = addr1.address;
    const callData = "0x12345678";
    const description = "";

    await expect(communityDAO.propose(description, target, callData))
      .to.be.revertedWithCustomError(communityDAO, "EmptyDescription");
  });

  it("Should not allow creating a proposal with a zero address target", async function () {
    const target = ethers.ZeroAddress;
    const callData = "0x12345678";
    const description = "Test Proposal";

    await expect(communityDAO.propose(description, target, callData))
      .to.be.revertedWithCustomError(communityDAO, "ZeroAddressTarget");
  });

  it("Should not allow creating a proposal with empty call data", async function () {
    const target = communityDAO.target;
    const callData = "0x";
    const description = "Test Proposal";

    await expect(communityDAO.propose(description, target, callData))
      .to.be.revertedWithCustomError(communityDAO, "EmptyCallData");
  });

  it("Should correctly set voteStartTime, voteEndTime, and snapshotBlock", async function () {
    const target = addr1.address;
    const callData = "0x12345678";
    const description = "Test Proposal";

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const timestampBefore = (await ethers.provider.getBlock(blockNumBefore)).timestamp;

    const tx = await communityDAO.propose(description, target, callData);
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args.proposalId;

    const proposal = await communityDAO.proposals(proposalId);

    expect(Number(proposal.voteStartTime)).to.be.closeTo(timestampBefore + 1, 5);
    expect(Number(proposal.voteEndTime)).to.equal(Number(proposal.voteStartTime) + 86400);
    expect(Number(proposal.snapshotBlock)).to.equal(blockNumBefore + 1);
  });

  it("Should increment proposal ID correctly", async function () {
    const target = addr1.address;
    const callData = "0x12345678";
    const description1 = "Test Proposal 1";
    const description2 = "Test Proposal 2";

    const tx1 = await communityDAO.propose(description1, target, callData);
    const receipt1 = await tx1.wait();
    const proposalId1 = receipt1.logs[0].args.proposalId;

    const tx2 = await communityDAO.propose(description2, target, callData);
    const receipt2 = await tx2.wait();
    const proposalId2 = receipt2.logs[0].args.proposalId;

    expect(Number(proposalId2)).to.equal(Number(proposalId1) + 1);
  });
});
