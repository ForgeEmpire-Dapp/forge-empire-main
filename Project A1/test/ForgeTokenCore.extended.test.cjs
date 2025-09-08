const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ForgeTokenCore Extended", function () {
  let forgeTokenCore;
  let owner, minter, burner, pauser, feeManager, utilityManager, user1, user2;

  beforeEach(async function () {
    [owner, minter, burner, pauser, feeManager, utilityManager, user1, user2] = await ethers.getSigners();

    const ForgeTokenCore = await ethers.getContractFactory("ForgeTokenCore");
    forgeTokenCore = await upgrades.deployProxy(ForgeTokenCore, [], { initializer: 'initialize' });
    await forgeTokenCore.waitForDeployment();
    
    // Grant additional roles
    const MINTER_ROLE = await forgeTokenCore.MINTER_ROLE();
    const BURNER_ROLE = await forgeTokenCore.BURNER_ROLE();
    const PAUSER_ROLE = await forgeTokenCore.PAUSER_ROLE();
    const FEE_MANAGER_ROLE = await forgeTokenCore.FEE_MANAGER_ROLE();
    
    await forgeTokenCore.grantRole(MINTER_ROLE, minter.address);
    await forgeTokenCore.grantRole(BURNER_ROLE, burner.address);
    await forgeTokenCore.grantRole(PAUSER_ROLE, pauser.address);
    await forgeTokenCore.grantRole(FEE_MANAGER_ROLE, feeManager.address);
  });

  describe("Fee Manager Failure", function () {
    it("Should complete transfer without fees if fee manager reverts", async function () {
      // First, enable trading
      await forgeTokenCore.setTradingEnabled(true);

      // Create a mock fee manager that reverts
      const MockFeeManager = await ethers.getContractFactory("RejectingWallet"); // Using RejectingWallet as a mock that reverts
      const mockFeeManager = await MockFeeManager.deploy();
      await mockFeeManager.waitForDeployment();

      // Set the mock fee manager
      await forgeTokenCore.setManager("fee", mockFeeManager.target);

      // Transfer some tokens to user1
      const transferAmount = ethers.parseEther("1000");
      await forgeTokenCore.transfer(user1.address, transferAmount);
      const initialUser1Balance = await forgeTokenCore.balanceOf(user1.address);
      const initialUser2Balance = await forgeTokenCore.balanceOf(user2.address);

      // Attempt to transfer from user1 to user2
      const transferToUser2Amount = ethers.parseEther("100");
      await expect(forgeTokenCore.connect(user1).transfer(user2.address, transferToUser2Amount)).to.not.be.reverted;

      // Check balances
      const finalUser1Balance = await forgeTokenCore.balanceOf(user1.address);
      const finalUser2Balance = await forgeTokenCore.balanceOf(user2.address);

      expect(finalUser1Balance).to.equal(initialUser1Balance - transferToUser2Amount);
      expect(finalUser2Balance).to.equal(initialUser2Balance + transferToUser2Amount);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Transfer some tokens to user1 for burning tests
      await forgeTokenCore.transfer(user1.address, ethers.parseEther("1000"));
    });

    it("Should not allow burner role to burn from any address without approval", async function () {
      const burnAmount = ethers.parseEther("100");
      
      await expect(forgeTokenCore.connect(user2).burnFrom(user1.address, burnAmount))
        .to.be.revertedWithCustomError(forgeTokenCore, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Manager System", function () {
    it("Should revoke fee manager role from old manager", async function () {
      const FEE_MANAGER_ROLE = await forgeTokenCore.FEE_MANAGER_ROLE();
      await forgeTokenCore.setManager("fee", feeManager.address);
      expect(await forgeTokenCore.hasRole(FEE_MANAGER_ROLE, feeManager.address)).to.be.true;

      const newFeeManager = user2;
      await forgeTokenCore.setManager("fee", newFeeManager.address);
      expect(await forgeTokenCore.hasRole(FEE_MANAGER_ROLE, newFeeManager.address)).to.be.true;
      expect(await forgeTokenCore.hasRole(FEE_MANAGER_ROLE, feeManager.address)).to.be.false;
    });
  });
});
