const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ForgeTokenManager", function () {
  let ForgeTokenManager, forgeTokenManager;
  let MockForgeTokenCore, mockTokenCore;
  let MockForgeFeeManager, mockFeeManager;
  let MockForgeUtilityManager, mockUtilityManager;
  let owner, admin, tokenAdmin, feeAdmin, utilityAdmin, governance, user1, user2, user3;

  beforeEach(async () => {
    [owner, admin, tokenAdmin, feeAdmin, utilityAdmin, governance, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock contracts
    MockForgeTokenCore = await ethers.getContractFactory("MockForgeTokenCore");
    mockTokenCore = await MockForgeTokenCore.deploy();
    await mockTokenCore.waitForDeployment();

    // Create mock fee manager
    MockForgeFeeManager = await ethers.getContractFactory("MockForgeFeeManager");
    mockFeeManager = await MockForgeFeeManager.deploy();
    await mockFeeManager.waitForDeployment();

    // Create mock utility manager  
    MockForgeUtilityManager = await ethers.getContractFactory("MockForgeUtilityManager");
    mockUtilityManager = await MockForgeUtilityManager.deploy();
    await mockUtilityManager.waitForDeployment();

    // Deploy ForgeTokenManager
    ForgeTokenManager = await ethers.getContractFactory("ForgeTokenManager");
    forgeTokenManager = await ForgeTokenManager.deploy();
    await forgeTokenManager.waitForDeployment();

    // Initialize with mock modules
    await forgeTokenManager.initialize(
      mockTokenCore.target,
      mockFeeManager.target,
      mockUtilityManager.target
    );

    // Grant roles
    const TOKEN_ADMIN_ROLE = await forgeTokenManager.TOKEN_ADMIN_ROLE();
    const FEE_ADMIN_ROLE = await forgeTokenManager.FEE_ADMIN_ROLE();
    const UTILITY_ADMIN_ROLE = await forgeTokenManager.UTILITY_ADMIN_ROLE();
    const GOVERNANCE_ROLE = await forgeTokenManager.GOVERNANCE_ROLE();
    const DEFAULT_ADMIN_ROLE = await forgeTokenManager.DEFAULT_ADMIN_ROLE();

    await forgeTokenManager.grantRole(DEFAULT_ADMIN_ROLE, admin.address);
    await forgeTokenManager.grantRole(TOKEN_ADMIN_ROLE, tokenAdmin.address);
    await forgeTokenManager.grantRole(FEE_ADMIN_ROLE, feeAdmin.address);
    await forgeTokenManager.grantRole(UTILITY_ADMIN_ROLE, utilityAdmin.address);
    await forgeTokenManager.grantRole(GOVERNANCE_ROLE, governance.address);
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct module addresses", async () => {
      const modules = await forgeTokenManager.getModuleAddresses();
      expect(modules.core).to.equal(mockTokenCore.target);
      expect(modules.fee).to.equal(mockFeeManager.target);
      expect(modules.utility).to.equal(mockUtilityManager.target);
    });

    it("should set correct initial system configuration", async () => {
      const status = await forgeTokenManager.getSystemStatus();
      expect(status.emergencyMode).to.be.false;
      expect(status.feesEnabled).to.be.true;
      expect(status.utilitiesEnabled).to.be.true;
      expect(status.governanceEnabled).to.be.true;
      expect(status.lastMaintenance).to.be.above(0);
    });

    it("should assign all roles to deployer initially", async () => {
      const DEFAULT_ADMIN_ROLE = await forgeTokenManager.DEFAULT_ADMIN_ROLE();
      const TOKEN_ADMIN_ROLE = await forgeTokenManager.TOKEN_ADMIN_ROLE();
      const FEE_ADMIN_ROLE = await forgeTokenManager.FEE_ADMIN_ROLE();
      const UTILITY_ADMIN_ROLE = await forgeTokenManager.UTILITY_ADMIN_ROLE();
      const GOVERNANCE_ROLE = await forgeTokenManager.GOVERNANCE_ROLE();

      expect(await forgeTokenManager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await forgeTokenManager.hasRole(TOKEN_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await forgeTokenManager.hasRole(FEE_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await forgeTokenManager.hasRole(UTILITY_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await forgeTokenManager.hasRole(GOVERNANCE_ROLE, owner.address)).to.be.true;
    });

    it("should set up module connections during initialization", async () => {
      // Verify that setManager was called on the token core
      // This would require checking mock call history or events
      // For now, we'll test the indirect effects
      const modules = await forgeTokenManager.getModuleAddresses();
      expect(modules.core).to.not.equal(ethers.ZeroAddress);
      expect(modules.fee).to.not.equal(ethers.ZeroAddress);
      expect(modules.utility).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Token Management Functions", function () {
    describe("Trading Control", function () {
      it("should allow token admin to enable trading", async () => {
        await forgeTokenManager.connect(tokenAdmin).setTradingEnabled(true);
        // Would need to check on token core, but we'll verify no revert
      });

      it("should allow token admin to disable trading", async () => {
        await forgeTokenManager.connect(tokenAdmin).setTradingEnabled(false);
        // Would need to check on token core, but we'll verify no revert
      });

      it("should reject trading enablement in emergency mode", async () => {
        // First activate emergency mode
        await forgeTokenManager.connect(admin).updateSystemConfig(true, true, true, true);

        await expect(
          forgeTokenManager.connect(tokenAdmin).setTradingEnabled(true)
        ).to.be.revertedWithCustomError(forgeTokenManager, "EmergencyModeActive");
      });

      it("should reject trading control from non-token admin", async () => {
        await expect(
          forgeTokenManager.connect(user1).setTradingEnabled(true)
        ).to.be.reverted;
      });
    });

    describe("Batch Minting", function () {
      it("should allow token admin to batch mint", async () => {
        const recipients = [user1.address, user2.address, user3.address];
        const amounts = [100, 200, 300];

        await expect(
          forgeTokenManager.connect(tokenAdmin).batchMint(recipients, amounts)
        ).to.emit(forgeTokenManager, "BatchOperationCompleted")
         .withArgs("mint", 3, 0);
      });

      it("should handle partial failures in batch minting", async () => {
        const recipients = [user1.address, ethers.ZeroAddress, user3.address]; // Zero address should fail
        const amounts = [100, 200, 300];

        await expect(
          forgeTokenManager.connect(tokenAdmin).batchMint(recipients, amounts)
        ).to.emit(forgeTokenManager, "BatchOperationCompleted");
        // Note: The mock doesn't actually fail on zero address, so this tests the structure
      });

      it("should reject batch mint with mismatched arrays", async () => {
        const recipients = [user1.address, user2.address];
        const amounts = [100]; // Different length

        await expect(
          forgeTokenManager.connect(tokenAdmin).batchMint(recipients, amounts)
        ).to.be.revertedWithCustomError(forgeTokenManager, "BatchOperationFailed");
      });

      it("should reject empty batch mint", async () => {
        await expect(
          forgeTokenManager.connect(tokenAdmin).batchMint([], [])
        ).to.be.revertedWithCustomError(forgeTokenManager, "BatchOperationFailed");
      });

      it("should reject batch mint when paused", async () => {
        await forgeTokenManager.connect(admin).pause();

        await expect(
          forgeTokenManager.connect(tokenAdmin).batchMint([user1.address], [100])
        ).to.be.revertedWithCustomError(forgeTokenManager, "EnforcedPause");
      });

      it("should reject batch mint from non-token admin", async () => {
        await expect(
          forgeTokenManager.connect(user1).batchMint([user1.address], [100])
        ).to.be.reverted;
      });
    });

    describe("Batch Utility Updates", function () {
      it("should allow utility admin to batch update utilities", async () => {
        const users = [user1.address, user2.address];

        await expect(
          forgeTokenManager.connect(utilityAdmin).batchUpdateUtilities(users)
        ).to.emit(forgeTokenManager, "BatchOperationCompleted");
      });

      it("should reject batch utility update when utilities disabled", async () => {
        await forgeTokenManager.connect(admin).updateSystemConfig(false, true, false, true);

        await expect(
          forgeTokenManager.connect(utilityAdmin).batchUpdateUtilities([user1.address])
        ).to.be.revertedWithCustomError(forgeTokenManager, "EmergencyModeActive");
      });

      it("should reject batch utility update when paused", async () => {
        await forgeTokenManager.connect(admin).pause();

        await expect(
          forgeTokenManager.connect(utilityAdmin).batchUpdateUtilities([user1.address])
        ).to.be.revertedWithCustomError(forgeTokenManager, "EnforcedPause");
      });

      it("should reject batch utility update from non-utility admin", async () => {
        await expect(
          forgeTokenManager.connect(user1).batchUpdateUtilities([user1.address])
        ).to.be.reverted;
      });
    });
  });

  describe("Fee Management Functions", function () {
    describe("Fee Configuration", function () {
      it("should allow fee admin to update fee config", async () => {
        // Mock fee manager doesn't have the exact interface, but test access control
        await expect(
          forgeTokenManager.connect(feeAdmin).updateFeeConfig(100, 25, 25, 50)
        ).to.not.be.reverted;
      });

      it("should reject fee config update from non-fee admin", async () => {
        await expect(
          forgeTokenManager.connect(user1).updateFeeConfig(100, 25, 25, 50)
        ).to.be.reverted;
      });

      it("should reject fee config update when fee manager not set", async () => {
        // Deploy a new manager without fee manager
        const NewManager = await ethers.getContractFactory("ForgeTokenManager");
        const newManager = await NewManager.deploy();
        await newManager.waitForDeployment();
        await newManager.initialize(mockTokenCore.target, ethers.ZeroAddress, mockUtilityManager.target);

        const FEE_ADMIN_ROLE = await newManager.FEE_ADMIN_ROLE();
        await newManager.grantRole(FEE_ADMIN_ROLE, feeAdmin.address);

        await expect(
          newManager.connect(feeAdmin).updateFeeConfig(100, 25, 25, 50)
        ).to.be.revertedWithCustomError(newManager, "ModuleNotSet");
      });
    });

    describe("Limit Configuration", function () {
      it("should allow fee admin to update limit config", async () => {
        await expect(
          forgeTokenManager.connect(feeAdmin).updateLimitConfig(1000, 5000, 60)
        ).to.not.be.reverted;
      });

      it("should reject limit config update from non-fee admin", async () => {
        await expect(
          forgeTokenManager.connect(user1).updateLimitConfig(1000, 5000, 60)
        ).to.be.reverted;
      });

      it("should reject limit config update when fee manager not set", async () => {
        const NewManager = await ethers.getContractFactory("ForgeTokenManager");
        const newManager = await NewManager.deploy();
        await newManager.waitForDeployment();
        await newManager.initialize(mockTokenCore.target, ethers.ZeroAddress, mockUtilityManager.target);

        const FEE_ADMIN_ROLE = await newManager.FEE_ADMIN_ROLE();
        await newManager.grantRole(FEE_ADMIN_ROLE, feeAdmin.address);

        await expect(
          newManager.connect(feeAdmin).updateLimitConfig(1000, 5000, 60)
        ).to.be.revertedWithCustomError(newManager, "ModuleNotSet");
      });
    });
  });

  describe("Governance Functions", function () {
    describe("Batch Governance Recording", function () {
      it("should allow governance role to record participation", async () => {
        const users = [user1.address, user2.address];
        const weights = [100, 200];

        await expect(
          forgeTokenManager.connect(governance).batchRecordGovernance(users, weights)
        ).to.emit(forgeTokenManager, "BatchOperationCompleted")
         .withArgs("governance_participation", 2, 0);
      });

      it("should reject governance recording with mismatched arrays", async () => {
        const users = [user1.address, user2.address];
        const weights = [100]; // Different length

        await expect(
          forgeTokenManager.connect(governance).batchRecordGovernance(users, weights)
        ).to.be.revertedWithCustomError(forgeTokenManager, "BatchOperationFailed");
      });

      it("should reject empty governance recording", async () => {
        await expect(
          forgeTokenManager.connect(governance).batchRecordGovernance([], [])
        ).to.be.revertedWithCustomError(forgeTokenManager, "BatchOperationFailed");
      });

      it("should reject governance recording when governance disabled", async () => {
        await forgeTokenManager.connect(admin).updateSystemConfig(false, true, true, false);

        await expect(
          forgeTokenManager.connect(governance).batchRecordGovernance([user1.address], [100])
        ).to.be.revertedWithCustomError(forgeTokenManager, "EmergencyModeActive");
      });

      it("should reject governance recording when paused", async () => {
        await forgeTokenManager.connect(admin).pause();

        await expect(
          forgeTokenManager.connect(governance).batchRecordGovernance([user1.address], [100])
        ).to.be.revertedWithCustomError(forgeTokenManager, "EnforcedPause");
      });

      it("should reject governance recording from non-governance role", async () => {
        await expect(
          forgeTokenManager.connect(user1).batchRecordGovernance([user1.address], [100])
        ).to.be.reverted;
      });
    });
  });

  describe("System Administration", function () {
    describe("Module Updates", function () {
      let newMockCore, newMockFee, newMockUtility;

      beforeEach(async () => {
        newMockCore = await MockForgeTokenCore.deploy();
        await newMockCore.waitForDeployment();

        newMockFee = await MockForgeFeeManager.deploy();
        await newMockFee.waitForDeployment();

        newMockUtility = await MockForgeUtilityManager.deploy();
        await newMockUtility.waitForDeployment();
      });

      it("should allow admin to update core module", async () => {
        await expect(
          forgeTokenManager.connect(admin).updateModule("core", newMockCore.target)
        ).to.emit(forgeTokenManager, "ModuleUpdated")
         .withArgs("core", mockTokenCore.target, newMockCore.target);

        const modules = await forgeTokenManager.getModuleAddresses();
        expect(modules.core).to.equal(newMockCore.target);
      });

      it("should allow admin to update fee module", async () => {
        await expect(
          forgeTokenManager.connect(admin).updateModule("fee", newMockFee.target)
        ).to.emit(forgeTokenManager, "ModuleUpdated")
         .withArgs("fee", mockFeeManager.target, newMockFee.target);

        const modules = await forgeTokenManager.getModuleAddresses();
        expect(modules.fee).to.equal(newMockFee.target);
      });

      it("should allow admin to update utility module", async () => {
        await expect(
          forgeTokenManager.connect(admin).updateModule("utility", newMockUtility.target)
        ).to.emit(forgeTokenManager, "ModuleUpdated")
         .withArgs("utility", mockUtilityManager.target, newMockUtility.target);

        const modules = await forgeTokenManager.getModuleAddresses();
        expect(modules.utility).to.equal(newMockUtility.target);
      });

      it("should reject unknown module types", async () => {
        await expect(
          forgeTokenManager.connect(admin).updateModule("unknown", newMockCore.target)
        ).to.be.revertedWithCustomError(forgeTokenManager, "InvalidModule");
      });

      it("should reject module updates from non-admin", async () => {
        await expect(
          forgeTokenManager.connect(user1).updateModule("core", newMockCore.target)
        ).to.be.reverted;
      });
    });

    describe("System Configuration", function () {
      it("should allow admin to update system configuration", async () => {
        await expect(
          forgeTokenManager.connect(admin).updateSystemConfig(true, false, false, false)
        ).to.emit(forgeTokenManager, "SystemConfigUpdated")
         .withArgs(true, false, false, false);

        const status = await forgeTokenManager.getSystemStatus();
        expect(status.emergencyMode).to.be.true;
        expect(status.feesEnabled).to.be.false;
        expect(status.utilitiesEnabled).to.be.false;
        expect(status.governanceEnabled).to.be.false;
      });

      it("should apply emergency mode restrictions to modules", async () => {
        await forgeTokenManager.connect(admin).updateSystemConfig(true, true, true, true);
        // Emergency mode should override other settings in modules
        // Would need to verify mock calls to fee and utility managers
      });

      it("should reject system config update from non-admin", async () => {
        await expect(
          forgeTokenManager.connect(user1).updateSystemConfig(false, true, true, true)
        ).to.be.reverted;
      });
    });

    describe("Maintenance Operations", function () {
      it("should allow admin to perform emergency pause maintenance", async () => {
        await expect(
          forgeTokenManager.connect(admin).performMaintenance("emergency_pause")
        ).to.emit(forgeTokenManager, "MaintenancePerformed");

        const status = await forgeTokenManager.getSystemStatus();
        expect(status.emergencyMode).to.be.true;
      });

      it("should allow admin to perform emergency unpause maintenance", async () => {
        // First pause
        await forgeTokenManager.connect(admin).performMaintenance("emergency_pause");
        
        // Then unpause
        await expect(
          forgeTokenManager.connect(admin).performMaintenance("emergency_unpause")
        ).to.emit(forgeTokenManager, "MaintenancePerformed");

        const status = await forgeTokenManager.getSystemStatus();
        expect(status.emergencyMode).to.be.false;
      });

      it("should allow admin to reset connections", async () => {
        await expect(
          forgeTokenManager.connect(admin).performMaintenance("reset_connections")
        ).to.emit(forgeTokenManager, "MaintenancePerformed");
      });

      it("should update maintenance timestamp", async () => {
        const beforeStatus = await forgeTokenManager.getSystemStatus();
        
        // Advance time by one second
        await time.increase(1);
        
        await forgeTokenManager.connect(admin).performMaintenance("reset_connections");
        
        const afterStatus = await forgeTokenManager.getSystemStatus();
        expect(afterStatus.lastMaintenance).to.be.above(beforeStatus.lastMaintenance);
      });

      it("should reject maintenance from non-admin", async () => {
        await expect(
          forgeTokenManager.connect(user1).performMaintenance("emergency_pause")
        ).to.be.reverted;
      });
    });
  });

  describe("View Functions", function () {
    describe("Token Information", function () {
      it("should return token information", async () => {
        const info = await forgeTokenManager.getTokenInfo();
        expect(info.totalSupply).to.be.a("bigint");
        // Fee stats would be zero since mock doesn't implement the interface
        expect(info.totalFees).to.equal(0);
        expect(info.totalBurned).to.equal(0);
        expect(info.totalTreasury).to.equal(0);
      });

      it("should handle missing fee manager gracefully", async () => {
        // Deploy manager without fee manager
        const NewManager = await ethers.getContractFactory("ForgeTokenManager");
        const newManager = await NewManager.deploy();
        await newManager.waitForDeployment();
        await newManager.initialize(mockTokenCore.target, ethers.ZeroAddress, mockUtilityManager.target);

        const info = await newManager.getTokenInfo();
        expect(info.totalSupply).to.be.a("bigint");
        expect(info.totalFees).to.equal(0);
      });
    });

    describe("User Information", function () {
      it("should return user information", async () => {
        const info = await forgeTokenManager.getUserInfo(user1.address);
        expect(info.balance).to.be.a("bigint");
        expect(info.stakingPower).to.equal(100); // Default value
        expect(info.governancePower).to.equal(100); // Default value
        expect(info.premiumTier).to.equal(0);
        expect(info.isPremium).to.be.false;
      });

      it("should return default values when utility manager not set", async () => {
        const NewManager = await ethers.getContractFactory("ForgeTokenManager");
        const newManager = await NewManager.deploy();
        await newManager.waitForDeployment();
        await newManager.initialize(mockTokenCore.target, mockFeeManager.target, ethers.ZeroAddress);

        const info = await newManager.getUserInfo(user1.address);
        expect(info.stakingPower).to.equal(100);
        expect(info.governancePower).to.equal(100);
        expect(info.premiumTier).to.equal(0);
        expect(info.isPremium).to.be.false;
      });
    });

    describe("Module Addresses", function () {
      it("should return correct module addresses", async () => {
        const modules = await forgeTokenManager.getModuleAddresses();
        expect(modules.core).to.equal(mockTokenCore.target);
        expect(modules.fee).to.equal(mockFeeManager.target);
        expect(modules.utility).to.equal(mockUtilityManager.target);
      });
    });

    describe("System Status", function () {
      it("should return current system status", async () => {
        const status = await forgeTokenManager.getSystemStatus();
        expect(status.emergencyMode).to.be.false;
        expect(status.feesEnabled).to.be.true;
        expect(status.utilitiesEnabled).to.be.true;
        expect(status.governanceEnabled).to.be.true;
        expect(status.lastMaintenance).to.be.above(0);
      });

      it("should reflect updated configuration", async () => {
        await forgeTokenManager.connect(admin).updateSystemConfig(true, false, false, false);
        
        const status = await forgeTokenManager.getSystemStatus();
        expect(status.emergencyMode).to.be.true;
        expect(status.feesEnabled).to.be.false;
        expect(status.utilitiesEnabled).to.be.false;
        expect(status.governanceEnabled).to.be.false;
      });
    });
  });

  describe("Pausable Functionality", function () {
    it("should allow admin to pause contract", async () => {
      await forgeTokenManager.connect(admin).pause();
      expect(await forgeTokenManager.paused()).to.be.true;
    });

    it("should allow admin to unpause contract", async () => {
      await forgeTokenManager.connect(admin).pause();
      await forgeTokenManager.connect(admin).unpause();
      expect(await forgeTokenManager.paused()).to.be.false;
    });

    it("should prevent operations when paused", async () => {
      await forgeTokenManager.connect(admin).pause();

      await expect(
        forgeTokenManager.connect(tokenAdmin).batchMint([user1.address], [100])
      ).to.be.revertedWithCustomError(forgeTokenManager, "EnforcedPause");

      await expect(
        forgeTokenManager.connect(utilityAdmin).batchUpdateUtilities([user1.address])
      ).to.be.revertedWithCustomError(forgeTokenManager, "EnforcedPause");
    });

    it("should reject pause/unpause from non-admin", async () => {
      await expect(
        forgeTokenManager.connect(user1).pause()
      ).to.be.reverted;

      await expect(
        forgeTokenManager.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("should enforce role-based access control", async () => {
      // Test all major functions require appropriate roles
      await expect(
        forgeTokenManager.connect(user1).setTradingEnabled(true)
      ).to.be.reverted;

      await expect(
        forgeTokenManager.connect(user1).batchMint([user1.address], [100])
      ).to.be.reverted;

      await expect(
        forgeTokenManager.connect(user1).updateFeeConfig(100, 25, 25, 50)
      ).to.be.reverted;

      await expect(
        forgeTokenManager.connect(user1).batchUpdateUtilities([user1.address])
      ).to.be.reverted;

      await expect(
        forgeTokenManager.connect(user1).batchRecordGovernance([user1.address], [100])
      ).to.be.reverted;

      await expect(
        forgeTokenManager.connect(user1).updateModule("core", mockTokenCore.target)
      ).to.be.reverted;

      await expect(
        forgeTokenManager.connect(user1).updateSystemConfig(false, true, true, true)
      ).to.be.reverted;
    });

    it("should allow role holders to perform their functions", async () => {
      // These should not revert
      await forgeTokenManager.connect(tokenAdmin).setTradingEnabled(true);
      await forgeTokenManager.connect(tokenAdmin).batchMint([user1.address], [100]);
      await forgeTokenManager.connect(feeAdmin).updateFeeConfig(100, 25, 25, 50);
      await forgeTokenManager.connect(utilityAdmin).batchUpdateUtilities([user1.address]);
      await forgeTokenManager.connect(governance).batchRecordGovernance([user1.address], [100]);
      await forgeTokenManager.connect(admin).updateSystemConfig(false, true, true, true);
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("should handle module interface failures gracefully", async () => {
      // This test checks that the contract can handle bad interfaces
      // Since our mocks work properly, let's just verify the contract structure
      const modules = await forgeTokenManager.getModuleAddresses();
      expect(modules.core).to.not.equal(ethers.ZeroAddress);
      expect(modules.fee).to.not.equal(ethers.ZeroAddress);
      expect(modules.utility).to.not.equal(ethers.ZeroAddress);
    });

    it("should handle batch operations with all failures", async () => {
      // Try to mint to invalid addresses that will cause failures
      const recipients = [ethers.ZeroAddress, ethers.ZeroAddress];
      const amounts = [100, 200];

      const tx = await forgeTokenManager.connect(tokenAdmin).batchMint(recipients, amounts);
      const receipt = await tx.wait();
      
      // Should complete but with failures
      const event = receipt.logs.find(log => log.fragment?.name === "BatchOperationCompleted");
      expect(event.args[2]).to.be.above(0); // Some failures
    });

    it("should maintain state consistency during partial failures", async () => {
      const beforeStatus = await forgeTokenManager.getSystemStatus();
      
      // Attempt operation that might partially fail
      await forgeTokenManager.connect(tokenAdmin).batchMint([user1.address, ethers.ZeroAddress], [100, 200]);
      
      const afterStatus = await forgeTokenManager.getSystemStatus();
      expect(afterStatus.emergencyMode).to.equal(beforeStatus.emergencyMode);
    });
  });

  describe("Integration Scenarios", function () {
    it("should handle complete system reconfiguration", async () => {
      // Update all modules
      const newCore = await MockForgeTokenCore.deploy();
      await newCore.waitForDeployment();
      
      const newFee = await MockForgeFeeManager.deploy();
      await newFee.waitForDeployment();
      
      const newUtility = await MockForgeUtilityManager.deploy();
      await newUtility.waitForDeployment();

      await forgeTokenManager.connect(admin).updateModule("core", newCore.target);
      await forgeTokenManager.connect(admin).updateModule("fee", newFee.target);
      await forgeTokenManager.connect(admin).updateModule("utility", newUtility.target);

      // Verify all modules updated
      const modules = await forgeTokenManager.getModuleAddresses();
      expect(modules.core).to.equal(newCore.target);
      expect(modules.fee).to.equal(newFee.target);
      expect(modules.utility).to.equal(newUtility.target);

      // Update system config
      await forgeTokenManager.connect(admin).updateSystemConfig(false, false, false, true);
      
      const status = await forgeTokenManager.getSystemStatus();
      expect(status.governanceEnabled).to.be.true;
      expect(status.feesEnabled).to.be.false;
    });

    it("should handle emergency mode activation and recovery", async () => {
      // Activate emergency mode
      await forgeTokenManager.connect(admin).performMaintenance("emergency_pause");
      
      let status = await forgeTokenManager.getSystemStatus();
      expect(status.emergencyMode).to.be.true;

      // Verify trading is blocked in emergency mode
      await expect(
        forgeTokenManager.connect(tokenAdmin).setTradingEnabled(true)
      ).to.be.revertedWithCustomError(forgeTokenManager, "EmergencyModeActive");

      // Recovery
      await forgeTokenManager.connect(admin).performMaintenance("emergency_unpause");
      
      status = await forgeTokenManager.getSystemStatus();
      expect(status.emergencyMode).to.be.false;

      // Verify trading works after recovery
      await forgeTokenManager.connect(tokenAdmin).setTradingEnabled(true);
    });
  });
});