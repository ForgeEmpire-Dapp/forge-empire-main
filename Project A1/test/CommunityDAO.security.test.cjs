const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CommunityDAO Security", function () {
  let CommunityDAO;
  let communityDAO;
  let owner, addr1, proposer;
  let mockTransfer;

  beforeEach(async function () {
    [owner, addr1, proposer] = await ethers.getSigners();
    CommunityDAO = await ethers.getContractFactory("CommunityDAO");
    communityDAO = await CommunityDAO.deploy(86400, 51, 100);
    await communityDAO.waitForDeployment();

    const MockTransfer = await ethers.getContractFactory("MockTransfer");
    mockTransfer = await MockTransfer.deploy();
    await mockTransfer.waitForDeployment();

    await communityDAO.grantRole(await communityDAO.PROPOSER_ROLE(), proposer.address);
  });

  it("Should not allow creating a proposal with a blacklisted target", async function () {
    const target = addr1.address;
    const callData = "0x12345678";
    const description = "Test Proposal";

    await communityDAO.setBlacklistedTarget(target, true);

    await expect(communityDAO.connect(proposer).propose(description, target, callData))
      .to.be.revertedWithCustomError(communityDAO, "BlacklistedTarget");
  });

  it("Should not allow creating a proposal that calls a critical function", async function () {
    const target = communityDAO.target;
    const callData = communityDAO.interface.encodeFunctionData("setVotingPeriodDuration", [7200]);
    const description = "Test Proposal";

    await expect(communityDAO.connect(proposer).propose(description, target, callData))
      .to.be.revertedWithCustomError(communityDAO, "CriticalFunctionCall");
  });

  it("Should not allow creating a proposal with a value greater than maxProposalValue", async function () {
    const target = mockTransfer.target;
    const value = ethers.parseEther("1001");
    const callData = mockTransfer.interface.encodeFunctionData("transfer", [addr1.address, value]);
    const description = "Test Proposal";

    await expect(communityDAO.connect(proposer).propose(description, target, callData))
      .to.be.revertedWithCustomError(communityDAO, "ProposalValueExceedsMaximum");
  });
});
