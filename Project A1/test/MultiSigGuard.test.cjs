const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MultiSigGuard", function () {
  let MultiSigGuard, multiSigGuard;
  let MockTarget, mockTarget;
  let owner, admin, signer1, signer2, signer3, emergencyAdmin, user1;

  const REQUIRED_APPROVALS = 2;
  const PROPOSAL_LIFETIME = 86400; // 24 hours
  const MIN_DELAY = 3600; // 1 hour

  beforeEach(async () => {
    [owner, admin, signer1, signer2, signer3, emergencyAdmin, user1] = await ethers.getSigners();

    // Deploy mock target contract for testing proposals
    MockTarget = await ethers.getContractFactory("MockERC20");
    mockTarget = await MockTarget.deploy("Test Token", "TEST");
    await mockTarget.waitForDeployment();

    // Deploy MultiSigGuard
    MultiSigGuard = await ethers.getContractFactory("MultiSigGuard");
    multiSigGuard = await MultiSigGuard.deploy();
    await multiSigGuard.waitForDeployment();

    // Initialize with signers
    await multiSigGuard.initialize(
      REQUIRED_APPROVALS,
      PROPOSAL_LIFETIME,
      MIN_DELAY,
      [signer1.address, signer2.address, signer3.address]
    );

    // Grant admin role
    const ADMIN_ROLE = await multiSigGuard.ADMIN_ROLE();
    await multiSigGuard.grantRole(ADMIN_ROLE, admin.address);

    // Set emergency admin
    await multiSigGuard.connect(admin).updateRequiredApprovals(REQUIRED_APPROVALS);
  });

  describe("Deployment", function () {
    it("should initialize with correct parameters", async () => {
      expect(await multiSigGuard.requiredApprovals()).to.equal(REQUIRED_APPROVALS);
      expect(await multiSigGuard.proposalLifetime()).to.equal(PROPOSAL_LIFETIME);
      expect(await multiSigGuard.minDelay()).to.equal(MIN_DELAY);
    });

    it("should assign signer roles correctly", async () => {
      const SIGNER_ROLE = await multiSigGuard.SIGNER_ROLE();
      expect(await multiSigGuard.hasRole(SIGNER_ROLE, signer1.address)).to.be.true;
      expect(await multiSigGuard.hasRole(SIGNER_ROLE, signer2.address)).to.be.true;
      expect(await multiSigGuard.hasRole(SIGNER_ROLE, signer3.address)).to.be.true;
    });

    it("should set emergency admin correctly", async () => {
      expect(await multiSigGuard.emergencyAdmin()).to.equal(owner.address);
      expect(await multiSigGuard.emergencyMode()).to.be.false;
    });

    it("should reject invalid initialization parameters", async () => {
      const InvalidMultiSigGuard = await ethers.getContractFactory("MultiSigGuard");
      const invalidGuard = await InvalidMultiSigGuard.deploy();
      await invalidGuard.waitForDeployment();

      // Invalid required approvals (0)
      await expect(
        invalidGuard.initialize(
          0,
          PROPOSAL_LIFETIME,
          MIN_DELAY,
          [signer1.address]
        )
      ).to.be.revertedWith("Invalid required approvals");

      // Invalid required approvals (more than signers)
      await expect(
        invalidGuard.initialize(
          3,
          PROPOSAL_LIFETIME,
          MIN_DELAY,
          [signer1.address, signer2.address]
        )
      ).to.be.revertedWith("Invalid required approvals");

      // Invalid proposal lifetime
      await expect(
        invalidGuard.initialize(
          2,
          0,
          MIN_DELAY,
          [signer1.address, signer2.address]
        )
      ).to.be.revertedWith("Invalid proposal lifetime");
    });
  });

  describe("Proposal Creation", function () {
    it("should allow signer to create proposal", async () => {
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      
      await expect(
        multiSigGuard.connect(signer1).createProposal(
          mockTarget.target,
          calldata,
          0
        )
      ).to.emit(multiSigGuard, "ProposalCreated");

      const proposalCount = await multiSigGuard.getProposalCount();
      expect(proposalCount).to.equal(1);
    });

    it("should reject proposal creation from non-signer", async () => {
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      
      await expect(
        multiSigGuard.connect(user1).createProposal(
          mockTarget.target,
          calldata,
          0
        )
      ).to.be.reverted;
    });

    it("should reject proposal with invalid target", async () => {
      await expect(
        multiSigGuard.connect(signer1).createProposal(
          ethers.ZeroAddress,
          "0x",
          0
        )
      ).to.be.revertedWithCustomError(multiSigGuard, "InvalidTarget");
    });

    it("should reject proposal creation when paused", async () => {
      await multiSigGuard.connect(admin).pause();
      
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      
      await expect(
        multiSigGuard.connect(signer1).createProposal(
          mockTarget.target,
          calldata,
          0
        )
      ).to.be.reverted;
    });

    it("should reject proposal creation in emergency mode", async () => {
      await multiSigGuard.connect(owner).toggleEmergencyMode();
      
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      
      await expect(
        multiSigGuard.connect(signer1).createProposal(
          mockTarget.target,
          calldata,
          0
        )
      ).to.be.revertedWithCustomError(multiSigGuard, "EmergencyModeActive");
    });

    it("should generate unique proposal IDs", async () => {
      const calldata1 = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      const calldata2 = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 2000]);

      const tx1 = await multiSigGuard.connect(signer1).createProposal(mockTarget.target, calldata1, 0);
      const tx2 = await multiSigGuard.connect(signer1).createProposal(mockTarget.target, calldata2, 0);

      const receipt1 = await tx1.wait();
      const receipt2 = await tx2.wait();

      const event1 = receipt1.logs.find(log => log.fragment?.name === "ProposalCreated");
      const event2 = receipt2.logs.find(log => log.fragment?.name === "ProposalCreated");

      expect(event1.args[0]).to.not.equal(event2.args[0]); // Different proposal IDs
    });
  });

  describe("Proposal Approval", function () {
    let proposalId;

    beforeEach(async () => {
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      const tx = await multiSigGuard.connect(signer1).createProposal(mockTarget.target, calldata, 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ProposalCreated");
      proposalId = event.args[0];
    });

    it("should allow signer to approve proposal", async () => {
      await expect(
        multiSigGuard.connect(signer2).approveProposal(proposalId)
      ).to.emit(multiSigGuard, "ProposalApproved")
       .withArgs(proposalId, signer2.address, 1);

      const proposal = await multiSigGuard.getProposal(proposalId);
      expect(proposal.approvals).to.equal(1);
    });

    it("should prevent double approval from same signer", async () => {
      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      
      await expect(
        multiSigGuard.connect(signer2).approveProposal(proposalId)
      ).to.be.revertedWithCustomError(multiSigGuard, "AlreadyApproved");
    });

    it("should reject approval from non-signer", async () => {
      await expect(
        multiSigGuard.connect(user1).approveProposal(proposalId)
      ).to.be.reverted;
    });

    it("should reject approval of non-existent proposal", async () => {
      const fakeId = ethers.id("fake");
      
      await expect(
        multiSigGuard.connect(signer2).approveProposal(fakeId)
      ).to.be.revertedWithCustomError(multiSigGuard, "ProposalNotFound");
    });

    it("should reject approval of expired proposal", async () => {
      // Advance time past proposal lifetime
      await time.increase(PROPOSAL_LIFETIME + 1);
      
      await expect(
        multiSigGuard.connect(signer2).approveProposal(proposalId)
      ).to.be.revertedWithCustomError(multiSigGuard, "ProposalExpired");
    });

    it("should track multiple approvals correctly", async () => {
      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      await multiSigGuard.connect(signer3).approveProposal(proposalId);

      const proposal = await multiSigGuard.getProposal(proposalId);
      expect(proposal.approvals).to.equal(2);

      expect(await multiSigGuard.hasApprovedProposal(proposalId, signer2.address)).to.be.true;
      expect(await multiSigGuard.hasApprovedProposal(proposalId, signer3.address)).to.be.true;
      expect(await multiSigGuard.hasApprovedProposal(proposalId, signer1.address)).to.be.false;
    });
  });

  describe("Proposal Execution", function () {
    let proposalId;

    beforeEach(async () => {
      // Create a proposal to mint tokens to the multisig guard
      await mockTarget.mint(multiSigGuard.target, 10000);
      
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      const tx = await multiSigGuard.connect(signer1).createProposal(mockTarget.target, calldata, 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ProposalCreated");
      proposalId = event.args[0];
    });

    it("should execute proposal with sufficient approvals after delay", async () => {
      // Get required approvals
      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      await multiSigGuard.connect(signer3).approveProposal(proposalId);

      // Wait for minimum delay
      await time.increase(MIN_DELAY + 1);

      const initialBalance = await mockTarget.balanceOf(user1.address);

      await expect(
        multiSigGuard.connect(signer1).executeProposal(proposalId)
      ).to.emit(multiSigGuard, "ProposalExecuted")
       .withArgs(proposalId, signer1.address);

      const finalBalance = await mockTarget.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance + 1000n);

      const proposal = await multiSigGuard.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
      expect(proposal.executedAt).to.be.above(0);
    });

    it("should reject execution with insufficient approvals", async () => {
      // Only one approval (need 2)
      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      
      await time.increase(MIN_DELAY + 1);

      await expect(
        multiSigGuard.connect(signer1).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(multiSigGuard, "InsufficientApprovals");
    });

    it("should reject execution before minimum delay", async () => {
      // Get required approvals
      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      await multiSigGuard.connect(signer3).approveProposal(proposalId);

      await expect(
        multiSigGuard.connect(signer1).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(multiSigGuard, "DelayNotMet");
    });

    it("should reject execution of expired proposal", async () => {
      // Get required approvals
      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      await multiSigGuard.connect(signer3).approveProposal(proposalId);

      // Advance time past proposal lifetime
      await time.increase(PROPOSAL_LIFETIME + 1);

      await expect(
        multiSigGuard.connect(signer1).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(multiSigGuard, "ProposalExpired");
    });

    it("should reject execution of non-existent proposal", async () => {
      const fakeId = ethers.id("fake");

      await expect(
        multiSigGuard.connect(signer1).executeProposal(fakeId)
      ).to.be.revertedWithCustomError(multiSigGuard, "ProposalNotFound");
    });

    it("should reject execution of already executed proposal", async () => {
      // Execute the proposal first
      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      await multiSigGuard.connect(signer3).approveProposal(proposalId);
      await time.increase(MIN_DELAY + 1);
      await multiSigGuard.connect(signer1).executeProposal(proposalId);

      // Try to execute again
      await expect(
        multiSigGuard.connect(signer1).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(multiSigGuard, "ProposalAlreadyExecuted");
    });

    it("should handle failed execution gracefully", async () => {
      // Create a proposal that will fail (trying to transfer more than balance)
      const failCalldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 20000]);
      const tx = await multiSigGuard.connect(signer1).createProposal(mockTarget.target, failCalldata, 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ProposalCreated");
      const failProposalId = event.args[0];

      // Approve and try to execute
      await multiSigGuard.connect(signer2).approveProposal(failProposalId);
      await multiSigGuard.connect(signer3).approveProposal(failProposalId);
      await time.increase(MIN_DELAY + 1);

      await expect(
        multiSigGuard.connect(signer1).executeProposal(failProposalId)
      ).to.be.reverted; // Should revert with the underlying error
    });

    it("should execute proposal with ETH value", async () => {
      // Send ETH to multisig guard
      await owner.sendTransaction({
        to: multiSigGuard.target,
        value: ethers.parseEther("1.0")
      });

      // Create proposal to send ETH
      const tx = await multiSigGuard.connect(signer1).createProposal(
        user1.address,
        "0x",
        ethers.parseEther("0.5")
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ProposalCreated");
      const ethProposalId = event.args[0];

      // Approve and execute
      await multiSigGuard.connect(signer2).approveProposal(ethProposalId);
      await multiSigGuard.connect(signer3).approveProposal(ethProposalId);
      await time.increase(MIN_DELAY + 1);

      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      await multiSigGuard.connect(signer1).executeProposal(ethProposalId);

      const finalBalance = await ethers.provider.getBalance(user1.address);
      expect(finalBalance).to.equal(initialBalance + ethers.parseEther("0.5"));
    });
  });

  describe("Proposal Cancellation", function () {
    let proposalId;

    beforeEach(async () => {
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      const tx = await multiSigGuard.connect(signer1).createProposal(mockTarget.target, calldata, 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ProposalCreated");
      proposalId = event.args[0];
    });

    it("should allow proposer to cancel proposal", async () => {
      await expect(
        multiSigGuard.connect(signer1).cancelProposal(proposalId)
      ).to.emit(multiSigGuard, "ProposalCancelled")
       .withArgs(proposalId, signer1.address);

      const proposal = await multiSigGuard.getProposal(proposalId);
      expect(proposal.cancelled).to.be.true;
    });

    it("should allow admin to cancel proposal", async () => {
      await expect(
        multiSigGuard.connect(admin).cancelProposal(proposalId)
      ).to.emit(multiSigGuard, "ProposalCancelled")
       .withArgs(proposalId, admin.address);

      const proposal = await multiSigGuard.getProposal(proposalId);
      expect(proposal.cancelled).to.be.true;
    });

    it("should reject cancellation from unauthorized user", async () => {
      await expect(
        multiSigGuard.connect(signer2).cancelProposal(proposalId)
      ).to.be.revertedWithCustomError(multiSigGuard, "NotProposer");
    });

    it("should reject cancellation of executed proposal", async () => {
      // Execute proposal first
      await mockTarget.mint(multiSigGuard.target, 10000);
      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      await multiSigGuard.connect(signer3).approveProposal(proposalId);
      await time.increase(MIN_DELAY + 1);
      await multiSigGuard.connect(signer1).executeProposal(proposalId);

      await expect(
        multiSigGuard.connect(signer1).cancelProposal(proposalId)
      ).to.be.revertedWithCustomError(multiSigGuard, "ProposalAlreadyExecuted");
    });

    it("should reject execution of cancelled proposal", async () => {
      await multiSigGuard.connect(signer1).cancelProposal(proposalId);
      
      // Try to approve and execute cancelled proposal
      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      await multiSigGuard.connect(signer3).approveProposal(proposalId);
      await time.increase(MIN_DELAY + 1);

      await expect(
        multiSigGuard.connect(signer1).executeProposal(proposalId)
      ).to.be.revertedWith("Proposal cancelled");
    });
  });

  describe("Emergency Mode", function () {
    it("should allow emergency admin to toggle emergency mode", async () => {
      await expect(
        multiSigGuard.connect(owner).toggleEmergencyMode()
      ).to.emit(multiSigGuard, "EmergencyModeToggled")
       .withArgs(true, owner.address);

      expect(await multiSigGuard.emergencyMode()).to.be.true;

      // Toggle back off
      await expect(
        multiSigGuard.connect(owner).toggleEmergencyMode()
      ).to.emit(multiSigGuard, "EmergencyModeToggled")
       .withArgs(false, owner.address);

      expect(await multiSigGuard.emergencyMode()).to.be.false;
    });

    it("should reject emergency mode toggle from non-admin", async () => {
      await expect(
        multiSigGuard.connect(user1).toggleEmergencyMode()
      ).to.be.revertedWith("Not emergency admin");
    });

    it("should allow emergency execution in emergency mode", async () => {
      await mockTarget.mint(multiSigGuard.target, 10000);
      await multiSigGuard.connect(owner).toggleEmergencyMode();

      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      const initialBalance = await mockTarget.balanceOf(user1.address);

      await multiSigGuard.connect(owner).emergencyExecute(
        mockTarget.target,
        calldata,
        0
      );

      const finalBalance = await mockTarget.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance + 1000n);
    });

    it("should reject emergency execution when not in emergency mode", async () => {
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);

      await expect(
        multiSigGuard.connect(owner).emergencyExecute(
          mockTarget.target,
          calldata,
          0
        )
      ).to.be.revertedWith("Not in emergency mode");
    });

    it("should reject emergency execution from non-admin", async () => {
      await multiSigGuard.connect(owner).toggleEmergencyMode();
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);

      await expect(
        multiSigGuard.connect(user1).emergencyExecute(
          mockTarget.target,
          calldata,
          0
        )
      ).to.be.revertedWith("Not emergency admin");
    });

    it("should handle failed emergency execution", async () => {
      await multiSigGuard.connect(owner).toggleEmergencyMode();
      const failCalldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 20000]);

      await expect(
        multiSigGuard.connect(owner).emergencyExecute(
          mockTarget.target,
          failCalldata,
          0
        )
      ).to.be.reverted;
    });
  });

  describe("Admin Functions", function () {
    it("should allow admin to update required approvals", async () => {
      const newRequired = 3;

      await expect(
        multiSigGuard.connect(admin).updateRequiredApprovals(newRequired)
      ).to.emit(multiSigGuard, "RequiredApprovalsUpdated")
       .withArgs(REQUIRED_APPROVALS, newRequired);

      expect(await multiSigGuard.requiredApprovals()).to.equal(newRequired);
    });

    it("should reject invalid required approvals", async () => {
      await expect(
        multiSigGuard.connect(admin).updateRequiredApprovals(0)
      ).to.be.revertedWith("Required approvals must be > 0");
    });

    it("should allow admin to pause/unpause contract", async () => {
      await multiSigGuard.connect(admin).pause();
      expect(await multiSigGuard.paused()).to.be.true;

      await multiSigGuard.connect(admin).unpause();
      expect(await multiSigGuard.paused()).to.be.false;
    });

    it("should reject pause/unpause from non-admin", async () => {
      await expect(
        multiSigGuard.connect(user1).pause()
      ).to.be.reverted;

      await expect(
        multiSigGuard.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    let proposalId;

    beforeEach(async () => {
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      const tx = await multiSigGuard.connect(signer1).createProposal(mockTarget.target, calldata, 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ProposalCreated");
      proposalId = event.args[0];
    });

    it("should return correct proposal details", async () => {
      const proposal = await multiSigGuard.getProposal(proposalId);
      
      expect(proposal.target).to.equal(mockTarget.target);
      expect(proposal.proposer).to.equal(signer1.address);
      expect(proposal.approvals).to.equal(0);
      expect(proposal.executed).to.be.false;
      expect(proposal.cancelled).to.be.false;
      expect(proposal.createdAt).to.be.above(0);
      expect(proposal.executedAt).to.equal(0);
    });

    it("should return correct approval status", async () => {
      expect(await multiSigGuard.hasApprovedProposal(proposalId, signer1.address)).to.be.false;
      expect(await multiSigGuard.hasApprovedProposal(proposalId, signer2.address)).to.be.false;

      await multiSigGuard.connect(signer2).approveProposal(proposalId);

      expect(await multiSigGuard.hasApprovedProposal(proposalId, signer2.address)).to.be.true;
      expect(await multiSigGuard.hasApprovedProposal(proposalId, signer1.address)).to.be.false;
    });

    it("should return correct proposal count", async () => {
      expect(await multiSigGuard.getProposalCount()).to.equal(1);

      // Create another proposal
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 2000]);
      await multiSigGuard.connect(signer2).createProposal(mockTarget.target, calldata, 0);

      expect(await multiSigGuard.getProposalCount()).to.equal(2);
    });
  });

  describe("ETH Handling", function () {
    it("should receive ETH transfers", async () => {
      const initialBalance = await ethers.provider.getBalance(multiSigGuard.target);
      
      await owner.sendTransaction({
        to: multiSigGuard.target,
        value: ethers.parseEther("1.0")
      });

      const finalBalance = await ethers.provider.getBalance(multiSigGuard.target);
      expect(finalBalance).to.equal(initialBalance + ethers.parseEther("1.0"));
    });
  });

  describe("Access Control", function () {
    it("should enforce signer role for proposal creation", async () => {
      await expect(
        multiSigGuard.connect(user1).createProposal(mockTarget.target, "0x", 0)
      ).to.be.reverted;
    });

    it("should enforce signer role for proposal approval", async () => {
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      const tx = await multiSigGuard.connect(signer1).createProposal(mockTarget.target, calldata, 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ProposalCreated");
      const proposalId = event.args[0];

      await expect(
        multiSigGuard.connect(user1).approveProposal(proposalId)
      ).to.be.reverted;
    });

    it("should enforce signer role for proposal execution", async () => {
      const calldata = mockTarget.interface.encodeFunctionData("transfer", [user1.address, 1000]);
      const tx = await multiSigGuard.connect(signer1).createProposal(mockTarget.target, calldata, 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === "ProposalCreated");
      const proposalId = event.args[0];

      await multiSigGuard.connect(signer2).approveProposal(proposalId);
      await multiSigGuard.connect(signer3).approveProposal(proposalId);
      await time.increase(MIN_DELAY + 1);

      await expect(
        multiSigGuard.connect(user1).executeProposal(proposalId)
      ).to.be.reverted;
    });

    it("should enforce admin role for configuration changes", async () => {
      await expect(
        multiSigGuard.connect(user1).updateRequiredApprovals(3)
      ).to.be.reverted;

      await expect(
        multiSigGuard.connect(user1).pause()
      ).to.be.reverted;
    });
  });
});