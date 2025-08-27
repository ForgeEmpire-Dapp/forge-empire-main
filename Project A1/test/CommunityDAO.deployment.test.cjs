const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CommunityDAO Deployment", function () {
  let CommunityDAO;
  let owner;
  const VOTING_PERIOD_DURATION = 86400; // 1 day
  const QUORUM_PERCENTAGE = 51;
  const TOTAL_VOTERS = 100;

  before(async function () {
    CommunityDAO = await ethers.getContractFactory("CommunityDAO");
    [owner] = await ethers.getSigners();
  });

  it("Should deploy with the correct owner and initial parameters", async function () {
    const communityDAO = await CommunityDAO.deploy(VOTING_PERIOD_DURATION, QUORUM_PERCENTAGE, TOTAL_VOTERS);
    await communityDAO.waitForDeployment();

    expect(await communityDAO.hasRole(await communityDAO.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    expect(await communityDAO.hasRole(await communityDAO.PROPOSER_ROLE(), owner.address)).to.be.true;
    expect(await communityDAO.hasRole(await communityDAO.EXECUTOR_ROLE(), owner.address)).to.be.true;
    expect(await communityDAO.votingPeriodDuration()).to.equal(VOTING_PERIOD_DURATION);
    expect(await communityDAO.quorumPercentage()).to.equal(QUORUM_PERCENTAGE);
    expect(await communityDAO.totalVoters()).to.equal(TOTAL_VOTERS);
  });

  it("Should revert if voting period duration is zero", async function () {
    await expect(CommunityDAO.deploy(0, QUORUM_PERCENTAGE, TOTAL_VOTERS))
      .to.be.revertedWithCustomError(CommunityDAO, "InvalidVotingPeriodBounds");
  });

  it("Should revert if quorum percentage is zero", async function () {
    await expect(CommunityDAO.deploy(VOTING_PERIOD_DURATION, 0, TOTAL_VOTERS))
      .to.be.revertedWithCustomError(CommunityDAO, "InvalidQuorumPercentage");
  });

  it("Should revert if quorum percentage is greater than 100", async function () {
    await expect(CommunityDAO.deploy(VOTING_PERIOD_DURATION, 101, TOTAL_VOTERS))
      .to.be.revertedWithCustomError(CommunityDAO, "InvalidQuorumPercentage");
  });
});
