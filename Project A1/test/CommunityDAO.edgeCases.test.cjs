const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CommunityDAO Edge Cases", function () {
  let CommunityDAO;
  let communityDAO;
  let owner, addr1, addr2, addr3, proposer, executor, voter1, voter2, voter3;
  let signers;

  beforeEach(async function () {
    signers = await ethers.getSigners();

    // Use only the first 20 signers to avoid "undefined" issues
    [owner, addr1, addr2, addr3, proposer, executor, voter1, voter2, voter3] = signers;

    CommunityDAO = await ethers.getContractFactory("CommunityDAO");
    communityDAO = await CommunityDAO.deploy(86400, 11, 20); // 11% quorum of 20 voters = 2.2 -> 3 votes needed
    await communityDAO.waitForDeployment();

    await communityDAO.grantRole(await communityDAO.PROPOSER_ROLE(), proposer.address);
    await communityDAO.grantRole(await communityDAO.EXECUTOR_ROLE(), executor.address);
  });

  it("Should handle execution with one more vote for than against", async function () {
    const callData = "0x12345678";

    const tx = await communityDAO.connect(proposer).propose("Close vote", addr1.address, callData);
    const receipt = await tx.wait();
    const closeProposalId = receipt.logs[0].args.proposalId;

    const voteFor = 10;
    const voteAgainst = 9;

    // Ensure we don't exceed available signers
    if (signers.length < voteFor + voteAgainst) {
      throw new Error(`Not enough signers to run test. Required: ${voteFor + voteAgainst}, Available: ${signers.length}`);
    }

    // Vote for
    for (let i = 0; i < voteFor; i++) {
      await communityDAO.connect(signers[i]).vote(closeProposalId, true);
    }

    // Vote against
    for (let i = voteFor; i < voteFor + voteAgainst; i++) {
      await communityDAO.connect(signers[i]).vote(closeProposalId, false);
    }

    // Simulate time passing
    await ethers.provider.send("evm_increaseTime", [86401]);
    await ethers.provider.send("evm_mine", []);

    // First execution to queue proposal
    await expect(communityDAO.connect(executor).executeProposal(closeProposalId))
      .to.emit(communityDAO, "ProposalQueued");

    // Simulate more time passing (2 days + 1s)
    await ethers.provider.send("evm_increaseTime", [2 * 24 * 3600 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Final execution
    await expect(communityDAO.connect(executor).executeProposal(closeProposalId))
      .to.emit(communityDAO, "ProposalExecuted");
  });

  it("Should handle proposal execution with revert data extraction", async function () {
    const MockReverter = await ethers.getContractFactory("MockReverter");
    const mockReverter = await MockReverter.deploy();
    await mockReverter.waitForDeployment();

    const callData = mockReverter.interface.encodeFunctionData("revertTest", []);
    const tx = await communityDAO.connect(proposer).propose("Revert test", mockReverter.target, callData);
    const receipt = await tx.wait();
    const revertProposalId = receipt.logs[0].args.proposalId;

    const voteFor = 10;

    for (let i = 0; i < voteFor; i++) {
      await communityDAO.connect(signers[i]).vote(revertProposalId, true);
    }

    await ethers.provider.send("evm_increaseTime", [86401]);
    await ethers.provider.send("evm_mine", []);

    // Queue proposal
    await communityDAO.connect(executor).executeProposal(revertProposalId);

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 3600 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Expect revert
    await expect(communityDAO.connect(executor).executeProposal(revertProposalId))
      .to.be.revertedWithCustomError(communityDAO, "ExecutionFailed");
  });

  it("Should not allow executing a proposal before the timelock has expired", async function () {
    const callData = "0x12345678";
    const tx = await communityDAO.connect(proposer).propose("Timelock test", addr1.address, callData);
    const receipt = await tx.wait();
    const proposalId = receipt.logs[0].args.proposalId;

    await communityDAO.connect(voter1).vote(proposalId, true);
    await communityDAO.connect(voter2).vote(proposalId, true);
    await communityDAO.connect(voter3).vote(proposalId, true);

    await ethers.provider.send("evm_increaseTime", [86401]);
    await ethers.provider.send("evm_mine", []);

    await expect(communityDAO.connect(executor).executeProposal(proposalId))
      .to.emit(communityDAO, "ProposalQueued");

    await expect(communityDAO.connect(executor).executeProposal(proposalId))
      .to.be.revertedWithCustomError(communityDAO, "TimelockNotExpired");
  });
});
