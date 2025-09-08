const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CommunityDAO Admin", function () {
  let CommunityDAO;
  let communityDAO;
  let owner;
  let addr1;
  const QUORUM_PERCENTAGE = 51;
  const TOTAL_VOTERS = 100;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    CommunityDAO = await ethers.getContractFactory("CommunityDAO");
    communityDAO = await CommunityDAO.deploy(86400, QUORUM_PERCENTAGE, TOTAL_VOTERS);
    await communityDAO.waitForDeployment();
  });

  it("Should allow admin to set voting period duration", async function () {
    const newDuration = 86401;
    await expect(communityDAO.setVotingPeriodDuration(newDuration))
      .to.emit(communityDAO, "VotingPeriodUpdated");
    expect(await communityDAO.votingPeriodDuration()).to.equal(newDuration);
  });

  it("Should not allow non-admin to set voting period duration", async function () {
    await expect(communityDAO.connect(addr1).setVotingPeriodDuration(7200))
      .to.be.revertedWithCustomError(communityDAO, "AccessControlUnauthorizedAccount");
  });

  it("Should allow admin to set quorum percentage", async function () {
    const newPercentage = 60;
    await expect(communityDAO.setQuorumPercentage(newPercentage))
      .to.emit(communityDAO, "QuorumPercentageUpdated");
    expect(await communityDAO.quorumPercentage()).to.equal(newPercentage);
  });

  it("Should not allow non-admin to set quorum percentage", async function () {
    await expect(communityDAO.connect(addr1).setQuorumPercentage(60))
      .to.be.revertedWithCustomError(communityDAO, "AccessControlUnauthorizedAccount");
  });

  it("Should allow admin to set total voters", async function () {
    const newTotal = 200;
    await expect(communityDAO.setTotalVoters(newTotal))
      .to.emit(communityDAO, "TotalVotersUpdated");
    expect(await communityDAO.totalVoters()).to.equal(newTotal);
  });

  it("Should not allow non-admin to set total voters", async function () {
    await expect(communityDAO.connect(addr1).setTotalVoters(200))
      .to.be.revertedWithCustomError(communityDAO, "AccessControlUnauthorizedAccount");
  });

  it("Should allow admin to blacklist a target", async function () {
    await communityDAO.setBlacklistedTarget(addr1.address, true);
    expect(await communityDAO.blacklistedTargets(addr1.address)).to.be.true;
  });

  it("Should allow admin to whitelist a target", async function () {
    await communityDAO.setBlacklistedTarget(addr1.address, true);
    await communityDAO.setBlacklistedTarget(addr1.address, false);
    expect(await communityDAO.blacklistedTargets(addr1.address)).to.be.false;
  });

  it("Should not allow non-admin to blacklist a target", async function () {
    await expect(communityDAO.connect(addr1).setBlacklistedTarget(addr1.address, true))
      .to.be.revertedWithCustomError(communityDAO, "AccessControlUnauthorizedAccount");
  });

  it("Should allow admin to set max proposal value", async function () {
    const newMaxValue = ethers.parseEther("5000");
    await communityDAO.setMaxProposalValue(newMaxValue);
    expect(await communityDAO.maxProposalValue()).to.equal(newMaxValue);
  });

  it("Should not allow non-admin to set max proposal value", async function () {
    const newMaxValue = ethers.parseEther("5000");
    await expect(communityDAO.connect(addr1).setMaxProposalValue(newMaxValue))
      .to.be.revertedWithCustomError(communityDAO, "AccessControlUnauthorizedAccount");
  });
});
