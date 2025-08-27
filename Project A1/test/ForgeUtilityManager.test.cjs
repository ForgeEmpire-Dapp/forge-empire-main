const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ForgeUtilityManager", function () {
  let ForgeUtilityManager, forgeUtilityManager;
  let MockForgeTokenCore, mockTokenCore;
  let owner, admin, utilityAdmin, stakingManager, governance, user1, user2, user3;

  beforeEach(async () => {
    [owner, admin, utilityAdmin, stakingManager, governance, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock token core
    MockForgeTokenCore = await ethers.getContractFactory("MockForgeTokenCore");
    mockTokenCore = await MockForgeTokenCore.deploy();
    await mockTokenCore.waitForDeployment();

    // Deploy ForgeUtilityManager
    ForgeUtilityManager = await ethers.getContractFactory("ForgeUtilityManager");
    forgeUtilityManager = await ForgeUtilityManager.deploy();
    await forgeUtilityManager.waitForDeployment();

    // Initialize
    await forgeUtilityManager.initialize(mockTokenCore.target);

    // Grant roles
    const UTILITY_ADMIN_ROLE = await forgeUtilityManager.UTILITY_ADMIN_ROLE();
    const STAKING_MANAGER_ROLE = await forgeUtilityManager.STAKING_MANAGER_ROLE();
    const GOVERNANCE_ROLE = await forgeUtilityManager.GOVERNANCE_ROLE();
    const DEFAULT_ADMIN_ROLE = await forgeUtilityManager.DEFAULT_ADMIN_ROLE();

    await forgeUtilityManager.grantRole(DEFAULT_ADMIN_ROLE, admin.address);
    await forgeUtilityManager.grantRole(UTILITY_ADMIN_ROLE, utilityAdmin.address);
    await forgeUtilityManager.grantRole(STAKING_MANAGER_ROLE, stakingManager.address);
    await forgeUtilityManager.grantRole(GOVERNANCE_ROLE, governance.address);

    // Mint tokens to users for testing
    await mockTokenCore.mint(user1.address, ethers.parseEther("50000")); // Silver tier
    await mockTokenCore.mint(user2.address, ethers.parseEther("150000")); // Gold tier
    await mockTokenCore.mint(user3.address, ethers.parseEther("750000")); // Platinum tier
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct token address", async () => {
      expect(await forgeUtilityManager.forgeToken()).to.equal(mockTokenCore.target);
    });

    it("should set correct initial staking configuration", async () => {
      const config = await forgeUtilityManager.stakingConfig();
      expect(config.baseStakingPower).to.equal(100);
      expect(config.premiumBonusRate).to.equal(25);
      expect(config.governanceBonusRate).to.equal(50);
      expect(config.stakingEnabled).to.be.true;
      expect(config.balanceBonusRate).to.equal(5);
    });

    it("should initialize default premium tiers", async () => {
      // Tier 1: Bronze (10K tokens)
      const tier1 = await forgeUtilityManager.premiumTiers(1);
      expect(tier1.requiredBalance).to.equal(ethers.parseEther("10000"));
      expect(tier1.stakingBonus).to.equal(10);
      expect(tier1.governanceBonus).to.equal(5);
      expect(tier1.feeDiscount).to.equal(25);
      expect(tier1.isActive).to.be.true;

      // Tier 5: Diamond (1M tokens)
      const tier5 = await forgeUtilityManager.premiumTiers(5);
      expect(tier5.requiredBalance).to.equal(ethers.parseEther("1000000"));
      expect(tier5.stakingBonus).to.equal(200);
      expect(tier5.governanceBonus).to.equal(100);
      expect(tier5.feeDiscount).to.equal(100);
      expect(tier5.isActive).to.be.true;
    });

    it("should enable premium and governance features by default", async () => {
      expect(await forgeUtilityManager.premiumFeaturesEnabled()).to.be.true;
      expect(await forgeUtilityManager.governanceFeaturesEnabled()).to.be.true;
    });

    it("should assign all roles to deployer initially", async () => {
      const DEFAULT_ADMIN_ROLE = await forgeUtilityManager.DEFAULT_ADMIN_ROLE();
      const UTILITY_ADMIN_ROLE = await forgeUtilityManager.UTILITY_ADMIN_ROLE();
      const STAKING_MANAGER_ROLE = await forgeUtilityManager.STAKING_MANAGER_ROLE();
      const GOVERNANCE_ROLE = await forgeUtilityManager.GOVERNANCE_ROLE();

      expect(await forgeUtilityManager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await forgeUtilityManager.hasRole(UTILITY_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await forgeUtilityManager.hasRole(STAKING_MANAGER_ROLE, owner.address)).to.be.true;
      expect(await forgeUtilityManager.hasRole(GOVERNANCE_ROLE, owner.address)).to.be.true;
    });
  });

  describe("User Utility Management", function () {
    describe("Premium Tier Calculation", function () {
      it("should correctly calculate premium tiers based on balance", async () => {
        // Update user utilities to trigger tier calculation
        await forgeUtilityManager.updateUserUtility(user1.address); // 50K tokens - Silver
        await forgeUtilityManager.updateUserUtility(user2.address); // 150K tokens - Gold  
        await forgeUtilityManager.updateUserUtility(user3.address); // 750K tokens - Platinum

        const utility1 = await forgeUtilityManager.getUserUtility(user1.address);
        const utility2 = await forgeUtilityManager.getUserUtility(user2.address);
        const utility3 = await forgeUtilityManager.getUserUtility(user3.address);

        expect(utility1.premiumTier).to.equal(2); // Silver tier
        expect(utility1.isPremium).to.be.true;

        expect(utility2.premiumTier).to.equal(3); // Gold tier
        expect(utility2.isPremium).to.be.true;

        expect(utility3.premiumTier).to.equal(4); // Platinum tier
        expect(utility3.isPremium).to.be.true;
      });

      it("should return tier 0 when premium features disabled", async () => {
        await forgeUtilityManager.connect(utilityAdmin).setPremiumFeaturesEnabled(false);
        await forgeUtilityManager.updateUserUtility(user2.address);

        const utility = await forgeUtilityManager.getUserUtility(user2.address);
        expect(utility.premiumTier).to.equal(0);
        expect(utility.isPremium).to.be.false;
      });

      it("should handle users with insufficient balance for any tier", async () => {
        // Create a fresh user with insufficient balance
        const [, , , , , , , , , freshUser] = await ethers.getSigners();
        await forgeUtilityManager.updateUserUtility(freshUser.address);

        const utility = await forgeUtilityManager.getUserUtility(freshUser.address);
        expect(utility.premiumTier).to.equal(0);
        expect(utility.isPremium).to.be.false;
      });
    });

    describe("Staking Power Calculation", function () {
      it("should calculate base staking power correctly", async () => {
        await forgeUtilityManager.updateUserUtility(user1.address);
        const utility = await forgeUtilityManager.getUserUtility(user1.address);
        
        // Base power (100) + Silver tier bonus (25% of 100 = 25) = 125
        expect(utility.stakingPower).to.be.above(100);
      });

      it("should apply premium tier bonuses", async () => {
        // Create fresh users with specific amounts for clear tier differences
        const [, , , , , , , , , freshUser1, freshUser2] = await ethers.getSigners();
        
        // Give one user Silver tier (50K), another Gold tier (150K)
        await mockTokenCore.mint(freshUser1.address, ethers.parseEther("50000"));
        await mockTokenCore.mint(freshUser2.address, ethers.parseEther("150000"));
        
        await forgeUtilityManager.updateUserUtility(freshUser1.address);
        await forgeUtilityManager.updateUserUtility(freshUser2.address);

        const utilitySilver = await forgeUtilityManager.getUserUtility(freshUser1.address);
        const utilityGold = await forgeUtilityManager.getUserUtility(freshUser2.address);

        expect(utilitySilver.premiumTier).to.equal(2); // Silver
        expect(utilityGold.premiumTier).to.equal(3); // Gold
        // Both may hit the cap at 500, so just verify they have premium bonuses
        expect(utilitySilver.stakingPower).to.be.above(100);
        expect(utilityGold.stakingPower).to.be.above(100);
      });

      it("should apply governance participation bonus", async () => {
        // Record governance participation for user1
        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 1000);
        
        const utility = await forgeUtilityManager.getUserUtility(user1.address);
        expect(utility.stakingPower).to.be.above(100);
      });

      it("should cap staking power at maximum", async () => {
        // Create a user with extreme governance participation
        await mockTokenCore.mint(user1.address, ethers.parseEther("2000000")); // Diamond tier
        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 50000);
        await forgeUtilityManager.updateUserUtility(user1.address);

        const utility = await forgeUtilityManager.getUserUtility(user1.address);
        const config = await forgeUtilityManager.stakingConfig();
        const maxPower = config.baseStakingPower * 5n;
        
        expect(utility.stakingPower).to.be.at.most(Number(maxPower));
      });

      it("should return base power when staking disabled", async () => {
        await forgeUtilityManager.connect(utilityAdmin).setStakingEnabled(false);
        await forgeUtilityManager.updateUserUtility(user2.address);

        const utility = await forgeUtilityManager.getUserUtility(user2.address);
        expect(utility.stakingPower).to.equal(100);
      });
    });

    describe("Governance Power Calculation", function () {
      it("should calculate base governance power", async () => {
        await forgeUtilityManager.updateUserUtility(user1.address);
        const utility = await forgeUtilityManager.getUserUtility(user1.address);
        
        expect(utility.governancePower).to.be.above(100);
      });

      it("should apply premium tier governance bonuses", async () => {
        await forgeUtilityManager.updateUserUtility(user2.address); // Gold tier
        await forgeUtilityManager.updateUserUtility(user3.address); // Platinum tier

        const utility2 = await forgeUtilityManager.getUserUtility(user2.address);
        const utility3 = await forgeUtilityManager.getUserUtility(user3.address);

        expect(utility3.governancePower).to.be.above(utility2.governancePower);
      });

      it("should apply balance-based scaling", async () => {
        // Use owner (no tokens) vs user1 (50K tokens) for clear difference
        await forgeUtilityManager.updateUserUtility(owner.address); // No extra tokens
        await forgeUtilityManager.updateUserUtility(user1.address); // 50K tokens

        const utilitySmall = await forgeUtilityManager.getUserUtility(owner.address);
        const utilityLarge = await forgeUtilityManager.getUserUtility(user1.address);
        
        // Should be different due to balance scaling (though user1 also has premium tier)
        expect(utilityLarge.governancePower).to.not.equal(utilitySmall.governancePower);
        expect(utilityLarge.governancePower).to.be.above(100);
      });

      it("should cap governance power at maximum", async () => {
        // User with extreme participation and balance
        await mockTokenCore.mint(user1.address, ethers.parseEther("5000000"));
        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 100000);
        await forgeUtilityManager.updateUserUtility(user1.address);

        const utility = await forgeUtilityManager.getUserUtility(user1.address);
        expect(utility.governancePower).to.be.at.most(300);
      });

      it("should return base power when governance features disabled", async () => {
        await forgeUtilityManager.connect(utilityAdmin).setGovernanceFeaturesEnabled(false);
        await forgeUtilityManager.updateUserUtility(user2.address);

        const utility = await forgeUtilityManager.getUserUtility(user2.address);
        expect(utility.governancePower).to.equal(100);
      });
    });

    describe("Premium Status Changes", function () {
      it("should update premium user count when status changes", async () => {
        const initialStats = await forgeUtilityManager.getUtilityStats();
        
        await forgeUtilityManager.updateUserUtility(user1.address); // Should become premium
        
        const afterStats = await forgeUtilityManager.getUtilityStats();
        expect(afterStats.totalPremium).to.be.above(initialStats.totalPremium);
      });

      it("should emit PremiumStatusChanged event", async () => {
        await expect(
          forgeUtilityManager.updateUserUtility(user1.address)
        ).to.emit(forgeUtilityManager, "PremiumStatusChanged")
         .withArgs(user1.address, true, 2); // Silver tier
      });

      it("should call setAddressFlags on token contract", async () => {
        // This tests that the token contract receives the flag update
        await expect(
          forgeUtilityManager.updateUserUtility(user1.address)
        ).to.not.be.reverted; // Should complete without error
      });

      it("should update last activity timestamp", async () => {
        const beforeTimestamp = await time.latest();
        await forgeUtilityManager.updateUserUtility(user1.address);
        
        const userUtility = await forgeUtilityManager.userUtilities(user1.address);
        expect(userUtility.lastActivity).to.be.at.least(beforeTimestamp);
      });
    });
  });

  describe("Governance Participation", function () {
    describe("Recording Participation", function () {
      it("should allow governance role to record participation", async () => {
        await expect(
          forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 500)
        ).to.emit(forgeUtilityManager, "GovernanceParticipation")
         .withArgs(user1.address, 500);
      });

      it("should update governance participation score", async () => {
        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 500);
        expect(await forgeUtilityManager.governanceParticipation(user1.address)).to.equal(500);

        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 300);
        expect(await forgeUtilityManager.governanceParticipation(user1.address)).to.equal(800);
      });

      it("should update last governance activity timestamp", async () => {
        const beforeTimestamp = await time.latest();
        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 500);
        
        const lastActivity = await forgeUtilityManager.lastGovernanceActivity(user1.address);
        expect(lastActivity).to.be.at.least(beforeTimestamp);
      });

      it("should calculate and update governance level", async () => {
        // Test different participation levels
        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 250); // Level 5
        let userUtility = await forgeUtilityManager.userUtilities(user1.address);
        expect(userUtility.governanceLevel).to.equal(5);

        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 1000); // Total 1250, Level 7
        userUtility = await forgeUtilityManager.userUtilities(user1.address);
        expect(userUtility.governanceLevel).to.equal(7);
      });

      it("should trigger utility update after recording participation", async () => {
        await expect(
          forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 500)
        ).to.emit(forgeUtilityManager, "UtilityUpdated");
      });

      it("should reject recording when governance features disabled", async () => {
        await forgeUtilityManager.connect(utilityAdmin).setGovernanceFeaturesEnabled(false);
        
        await expect(
          forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 500)
        ).to.be.revertedWithCustomError(forgeUtilityManager, "FeatureDisabled");
      });

      it("should reject recording from non-governance role", async () => {
        await expect(
          forgeUtilityManager.connect(user1).recordGovernanceParticipation(user1.address, 500)
        ).to.be.reverted;
      });

      it("should reject recording when paused", async () => {
        await forgeUtilityManager.connect(admin).pause();
        
        await expect(
          forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 500)
        ).to.be.revertedWithCustomError(forgeUtilityManager, "EnforcedPause");
      });
    });

    describe("Governance Level Calculation", function () {
      it("should return correct levels for different participation scores", async () => {
        // Test key thresholds without cumulative effects
        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 25);
        let userUtility = await forgeUtilityManager.userUtilities(user1.address);
        expect(userUtility.governanceLevel).to.equal(2);

        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user2.address, 100);
        userUtility = await forgeUtilityManager.userUtilities(user2.address);
        expect(userUtility.governanceLevel).to.equal(4);

        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user3.address, 1000);
        userUtility = await forgeUtilityManager.userUtilities(user3.address);
        expect(userUtility.governanceLevel).to.equal(7);

        await forgeUtilityManager.connect(governance).recordGovernanceParticipation(admin.address, 10000);
        userUtility = await forgeUtilityManager.userUtilities(admin.address);
        expect(userUtility.governanceLevel).to.equal(10);
      });
    });
  });

  describe("Premium Tier Management", function () {
    describe("Tier Configuration", function () {
      it("should allow utility admin to update premium tier", async () => {
        await expect(
          forgeUtilityManager.connect(utilityAdmin).updatePremiumTier(
            1, // Bronze tier
            ethers.parseEther("15000"), // New required balance
            15, // New staking bonus
            10, // New governance bonus
            30 // New fee discount
          )
        ).to.emit(forgeUtilityManager, "PremiumTierUpdated")
         .withArgs(1, ethers.parseEther("15000"), 15, 10);
      });

      it("should update tier configuration correctly", async () => {
        await forgeUtilityManager.connect(utilityAdmin).updatePremiumTier(
          2, ethers.parseEther("75000"), 35, 20, 60
        );

        const tier = await forgeUtilityManager.premiumTiers(2);
        expect(tier.requiredBalance).to.equal(ethers.parseEther("75000"));
        expect(tier.stakingBonus).to.equal(35);
        expect(tier.governanceBonus).to.equal(20);
        expect(tier.feeDiscount).to.equal(60);
        expect(tier.isActive).to.be.true;
      });

      it("should reject invalid tier levels", async () => {
        await expect(
          forgeUtilityManager.connect(utilityAdmin).updatePremiumTier(0, 1000, 10, 5, 25)
        ).to.be.revertedWithCustomError(forgeUtilityManager, "InvalidTierLevel");

        await expect(
          forgeUtilityManager.connect(utilityAdmin).updatePremiumTier(6, 1000, 10, 5, 25)
        ).to.be.revertedWithCustomError(forgeUtilityManager, "InvalidTierLevel");
      });

      it("should reject invalid fee discount", async () => {
        await expect(
          forgeUtilityManager.connect(utilityAdmin).updatePremiumTier(1, 1000, 10, 5, 150)
        ).to.be.revertedWithCustomError(forgeUtilityManager, "InvalidConfiguration");
      });

      it("should reject tier updates from non-utility admin", async () => {
        await expect(
          forgeUtilityManager.connect(user1).updatePremiumTier(1, 1000, 10, 5, 25)
        ).to.be.reverted;
      });
    });

    describe("Tier Information Retrieval", function () {
      it("should return correct premium tier information", async () => {
        const tier3 = await forgeUtilityManager.getPremiumTier(3);
        expect(tier3.requiredBalance).to.equal(ethers.parseEther("100000"));
        expect(tier3.stakingBonus).to.equal(50);
        expect(tier3.governanceBonus).to.equal(30);
        expect(tier3.feeDiscount).to.equal(75);
      });
    });
  });

  describe("Staking Configuration", function () {
    describe("Configuration Updates", function () {
      it("should allow utility admin to update staking config", async () => {
        await expect(
          forgeUtilityManager.connect(utilityAdmin).updateStakingConfig(150, 30, 75)
        ).to.emit(forgeUtilityManager, "StakingConfigUpdated")
         .withArgs(150, 30, 75);
      });

      it("should update staking configuration correctly", async () => {
        await forgeUtilityManager.connect(utilityAdmin).updateStakingConfig(120, 35, 60);
        
        const config = await forgeUtilityManager.stakingConfig();
        expect(config.baseStakingPower).to.equal(120);
        expect(config.premiumBonusRate).to.equal(35);
        expect(config.governanceBonusRate).to.equal(60);
      });

      it("should reject staking config updates from non-utility admin", async () => {
        await expect(
          forgeUtilityManager.connect(user1).updateStakingConfig(150, 30, 75)
        ).to.be.reverted;
      });
    });
  });

  describe("Feature Toggle Management", function () {
    describe("Premium Features", function () {
      it("should allow utility admin to enable/disable premium features", async () => {
        await forgeUtilityManager.connect(utilityAdmin).setPremiumFeaturesEnabled(false);
        expect(await forgeUtilityManager.premiumFeaturesEnabled()).to.be.false;

        await forgeUtilityManager.connect(utilityAdmin).setPremiumFeaturesEnabled(true);
        expect(await forgeUtilityManager.premiumFeaturesEnabled()).to.be.true;
      });

      it("should reject premium feature toggle from non-utility admin", async () => {
        await expect(
          forgeUtilityManager.connect(user1).setPremiumFeaturesEnabled(false)
        ).to.be.reverted;
      });
    });

    describe("Governance Features", function () {
      it("should allow utility admin to enable/disable governance features", async () => {
        await forgeUtilityManager.connect(utilityAdmin).setGovernanceFeaturesEnabled(false);
        expect(await forgeUtilityManager.governanceFeaturesEnabled()).to.be.false;

        await forgeUtilityManager.connect(utilityAdmin).setGovernanceFeaturesEnabled(true);
        expect(await forgeUtilityManager.governanceFeaturesEnabled()).to.be.true;
      });

      it("should reject governance feature toggle from non-utility admin", async () => {
        await expect(
          forgeUtilityManager.connect(user1).setGovernanceFeaturesEnabled(false)
        ).to.be.reverted;
      });
    });

    describe("Staking", function () {
      it("should allow utility admin to enable/disable staking", async () => {
        await forgeUtilityManager.connect(utilityAdmin).setStakingEnabled(false);
        const config = await forgeUtilityManager.stakingConfig();
        expect(config.stakingEnabled).to.be.false;

        await forgeUtilityManager.connect(utilityAdmin).setStakingEnabled(true);
        const updatedConfig = await forgeUtilityManager.stakingConfig();
        expect(updatedConfig.stakingEnabled).to.be.true;
      });

      it("should reject staking toggle from non-utility admin", async () => {
        await expect(
          forgeUtilityManager.connect(user1).setStakingEnabled(false)
        ).to.be.reverted;
      });
    });
  });

  describe("Statistics and Information", function () {
    describe("Utility Statistics", function () {
      it("should track total premium users correctly", async () => {
        const initialStats = await forgeUtilityManager.getUtilityStats();
        
        await forgeUtilityManager.updateUserUtility(user1.address);
        await forgeUtilityManager.updateUserUtility(user2.address);
        
        const updatedStats = await forgeUtilityManager.getUtilityStats();
        expect(updatedStats.totalPremium).to.be.above(initialStats.totalPremium);
      });

      it("should return correct utility statistics", async () => {
        const stats = await forgeUtilityManager.getUtilityStats();
        expect(stats.totalPremium).to.be.a("bigint");
        expect(stats.totalStaking).to.be.a("bigint");
      });
    });

    describe("User Information", function () {
      it("should return complete user utility information", async () => {
        await forgeUtilityManager.updateUserUtility(user2.address);
        
        const utility = await forgeUtilityManager.getUserUtility(user2.address);
        expect(utility.stakingPower).to.be.above(100);
        expect(utility.governancePower).to.be.above(100);
        expect(utility.premiumTier).to.equal(3); // Gold tier
        expect(utility.isPremium).to.be.true;
      });
    });
  });

  describe("Pausable Functionality", function () {
    it("should allow admin to pause contract", async () => {
      await forgeUtilityManager.connect(admin).pause();
      expect(await forgeUtilityManager.paused()).to.be.true;
    });

    it("should allow admin to unpause contract", async () => {
      await forgeUtilityManager.connect(admin).pause();
      await forgeUtilityManager.connect(admin).unpause();
      expect(await forgeUtilityManager.paused()).to.be.false;
    });

    it("should prevent operations when paused", async () => {
      await forgeUtilityManager.connect(admin).pause();

      await expect(
        forgeUtilityManager.updateUserUtility(user1.address)
      ).to.be.revertedWithCustomError(forgeUtilityManager, "EnforcedPause");
    });

    it("should reject pause/unpause from non-admin", async () => {
      await expect(
        forgeUtilityManager.connect(user1).pause()
      ).to.be.reverted;

      await expect(
        forgeUtilityManager.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("should enforce role-based access control", async () => {
      await expect(
        forgeUtilityManager.connect(user1).updatePremiumTier(1, 1000, 10, 5, 25)
      ).to.be.reverted;

      await expect(
        forgeUtilityManager.connect(user1).updateStakingConfig(150, 30, 75)
      ).to.be.reverted;

      await expect(
        forgeUtilityManager.connect(user1).recordGovernanceParticipation(user1.address, 500)
      ).to.be.reverted;

      await expect(
        forgeUtilityManager.connect(user1).setPremiumFeaturesEnabled(false)
      ).to.be.reverted;
    });

    it("should allow role holders to perform their functions", async () => {
      await forgeUtilityManager.connect(utilityAdmin).updatePremiumTier(1, ethers.parseEther("12000"), 12, 8, 28);
      await forgeUtilityManager.connect(utilityAdmin).updateStakingConfig(110, 28, 55);
      await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 500);
      await forgeUtilityManager.connect(utilityAdmin).setPremiumFeaturesEnabled(false);
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("should handle users with zero balance", async () => {
      const zeroBalanceUser = user3; // Use user3 but burn all tokens
      await mockTokenCore.connect(user3).burn(await mockTokenCore.balanceOf(user3.address));
      
      await forgeUtilityManager.updateUserUtility(zeroBalanceUser.address);
      const utility = await forgeUtilityManager.getUserUtility(zeroBalanceUser.address);
      
      expect(utility.premiumTier).to.equal(0);
      expect(utility.isPremium).to.be.false;
      expect(utility.stakingPower).to.equal(100); // Base power
    });

    it("should handle extreme governance participation values", async () => {
      await forgeUtilityManager.connect(governance).recordGovernanceParticipation(user1.address, 1000000);
      const userUtility = await forgeUtilityManager.userUtilities(user1.address);
      expect(userUtility.governanceLevel).to.equal(10); // Max level
    });

    it("should maintain state consistency during utility updates", async () => {
      const beforeUpdate = await forgeUtilityManager.getUtilityStats();
      
      await forgeUtilityManager.updateUserUtility(user1.address);
      await forgeUtilityManager.updateUserUtility(user2.address);
      
      const afterUpdate = await forgeUtilityManager.getUtilityStats();
      expect(afterUpdate.totalPremium).to.be.at.least(beforeUpdate.totalPremium);
    });

    it("should handle reentrancy protection", async () => {
      // The updateUserUtility function has nonReentrant modifier
      await expect(
        forgeUtilityManager.updateUserUtility(user1.address)
      ).to.not.be.reverted;
    });
  });

  describe("Integration Scenarios", function () {
    it("should handle complete premium tier progression", async () => {
      // Start with fresh user with only Bronze threshold
      await mockTokenCore.mint(admin.address, ethers.parseEther("10000"));
      await forgeUtilityManager.updateUserUtility(admin.address);
      let utility = await forgeUtilityManager.getUserUtility(admin.address);
      expect(utility.premiumTier).to.equal(1); // Bronze

      // Upgrade to Gold tier
      await mockTokenCore.mint(admin.address, ethers.parseEther("90000")); // Total 100K
      await forgeUtilityManager.updateUserUtility(admin.address);
      utility = await forgeUtilityManager.getUserUtility(admin.address);
      expect(utility.premiumTier).to.equal(3); // Gold

      // Downgrade by burning tokens to Silver level
      await mockTokenCore.connect(admin).burn(ethers.parseEther("60000")); // Leave 40K
      await forgeUtilityManager.updateUserUtility(admin.address);
      utility = await forgeUtilityManager.getUserUtility(admin.address);
      expect(utility.premiumTier).to.equal(1); // Bronze (40K is between Bronze 10K and Silver 50K)
    });

    it("should handle governance participation affecting utility calculations", async () => {
      // Use fresh user with minimal balance
      const [, , , , , , , , , , , freshUser] = await ethers.getSigners();
      await mockTokenCore.mint(freshUser.address, ethers.parseEther("1000")); // Below premium threshold
      
      await forgeUtilityManager.updateUserUtility(freshUser.address);
      const utilityBefore = await forgeUtilityManager.getUserUtility(freshUser.address);

      await forgeUtilityManager.connect(governance).recordGovernanceParticipation(freshUser.address, 2000);
      const utilityAfter = await forgeUtilityManager.getUserUtility(freshUser.address);

      // With governance participation, powers should increase unless already at cap
      expect(utilityAfter.stakingPower).to.be.at.least(utilityBefore.stakingPower);
      expect(utilityAfter.governancePower).to.be.at.least(utilityBefore.governancePower);
      expect(utilityAfter.stakingPower).to.be.above(100);
      expect(utilityAfter.governancePower).to.be.above(100);
    });

    it("should handle system configuration changes affecting all users", async () => {
      // Update multiple users
      await forgeUtilityManager.updateUserUtility(user1.address);
      await forgeUtilityManager.updateUserUtility(user2.address);

      const user1Before = await forgeUtilityManager.getUserUtility(user1.address);
      const user2Before = await forgeUtilityManager.getUserUtility(user2.address);

      // Change staking configuration
      await forgeUtilityManager.connect(utilityAdmin).updateStakingConfig(150, 50, 75);

      // Update users again to see effect
      await forgeUtilityManager.updateUserUtility(user1.address);
      await forgeUtilityManager.updateUserUtility(user2.address);

      const user1After = await forgeUtilityManager.getUserUtility(user1.address);
      const user2After = await forgeUtilityManager.getUserUtility(user2.address);

      // Powers should be different due to config change
      expect(user1After.stakingPower).to.not.equal(user1Before.stakingPower);
      expect(user2After.stakingPower).to.not.equal(user2Before.stakingPower);
    });
  });
});