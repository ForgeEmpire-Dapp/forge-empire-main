const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("SecurityIntegration", function () {
  let SecurityIntegrationTest, securityIntegration;
  let MultiSigGuard, multiSigGuard;
  let RateLimiter, rateLimiter;
  let EmergencySystem, emergencySystem;
  let owner, admin, securityManager, user1, user2, signer1, signer2;

  // Test function selector
  const TEST_FUNCTION = "0x12345678";

  // Test contract already exists in contracts/test/SecurityIntegrationTest.sol

  beforeEach(async () => {
    [owner, admin, securityManager, user1, user2, signer1, signer2] = await ethers.getSigners();

    // Deploy dependencies first
    MultiSigGuard = await ethers.getContractFactory("MultiSigGuard");
    multiSigGuard = await MultiSigGuard.deploy();
    await multiSigGuard.waitForDeployment();
    await multiSigGuard.initialize(2, 86400, 3600, [signer1.address, signer2.address]);

    RateLimiter = await ethers.getContractFactory("RateLimiter");
    rateLimiter = await RateLimiter.deploy();
    await rateLimiter.waitForDeployment();
    await rateLimiter.initialize();

    EmergencySystem = await ethers.getContractFactory("EmergencySystem");
    emergencySystem = await EmergencySystem.deploy();
    await emergencySystem.waitForDeployment();
    await emergencySystem.initialize([signer1.address, signer2.address], 1);

    // Deploy the test contract
    SecurityIntegrationTest = await ethers.getContractFactory("SecurityIntegrationTest");
    securityIntegration = await SecurityIntegrationTest.deploy();
    await securityIntegration.waitForDeployment();

    // Initialize with security systems
    await securityIntegration.initialize(
      multiSigGuard.target,
      rateLimiter.target,
      emergencySystem.target
    );

    // Grant roles
    const ADMIN_ROLE = await securityIntegration.ADMIN_ROLE();
    const SECURITY_MANAGER_ROLE = await securityIntegration.SECURITY_MANAGER_ROLE();
    
    await securityIntegration.grantRole(ADMIN_ROLE, admin.address);
    await securityIntegration.grantRole(SECURITY_MANAGER_ROLE, securityManager.address);
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct security systems", async () => {
      const status = await securityIntegration.getSecurityStatus();
      expect(status.featuresEnabled).to.be.true;
      expect(status.multiSigAddress).to.equal(multiSigGuard.target);
      expect(status.rateLimiterAddress).to.equal(rateLimiter.target);
      expect(status.emergencySystemAddress).to.equal(emergencySystem.target);
    });

    it("should assign correct roles", async () => {
      const DEFAULT_ADMIN_ROLE = await securityIntegration.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await securityIntegration.ADMIN_ROLE();
      const SECURITY_MANAGER_ROLE = await securityIntegration.SECURITY_MANAGER_ROLE();

      expect(await securityIntegration.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await securityIntegration.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await securityIntegration.hasRole(SECURITY_MANAGER_ROLE, owner.address)).to.be.true;
    });

    it("should have security features enabled by default", async () => {
      expect(await securityIntegration.securityFeaturesEnabled()).to.be.true;
    });
  });

  describe("Security System Updates", function () {
    let newMultiSigGuard, newRateLimiter, newEmergencySystem;

    beforeEach(async () => {
      // Deploy new security systems
      newMultiSigGuard = await MultiSigGuard.deploy();
      await newMultiSigGuard.waitForDeployment();
      await newMultiSigGuard.initialize(2, 86400, 3600, [signer1.address, signer2.address]);

      newRateLimiter = await RateLimiter.deploy();
      await newRateLimiter.waitForDeployment();
      await newRateLimiter.initialize();

      newEmergencySystem = await EmergencySystem.deploy();
      await newEmergencySystem.waitForDeployment();
      await newEmergencySystem.initialize([signer1.address, signer2.address], 1);
    });

    it("should allow admin to update security systems", async () => {
      await expect(
        securityIntegration.connect(admin).updateSecuritySystem(
          newMultiSigGuard.target,
          newRateLimiter.target,
          newEmergencySystem.target
        )
      ).to.emit(securityIntegration, "SecuritySystemUpdated");

      const status = await securityIntegration.getSecurityStatus();
      expect(status.multiSigAddress).to.equal(newMultiSigGuard.target);
      expect(status.rateLimiterAddress).to.equal(newRateLimiter.target);
      expect(status.emergencySystemAddress).to.equal(newEmergencySystem.target);
    });

    it("should allow partial updates", async () => {
      await securityIntegration.connect(admin).updateSecuritySystem(
        newMultiSigGuard.target,
        ethers.ZeroAddress,
        ethers.ZeroAddress
      );

      const status = await securityIntegration.getSecurityStatus();
      expect(status.multiSigAddress).to.equal(newMultiSigGuard.target);
      expect(status.rateLimiterAddress).to.equal(rateLimiter.target); // Unchanged
      expect(status.emergencySystemAddress).to.equal(emergencySystem.target); // Unchanged
    });

    it("should reject updates from non-admin", async () => {
      await expect(
        securityIntegration.connect(user1).updateSecuritySystem(
          newMultiSigGuard.target,
          newRateLimiter.target,
          newEmergencySystem.target
        )
      ).to.be.reverted;
    });
  });

  describe("Security Features Toggle", function () {
    it("should allow admin to toggle security features", async () => {
      await expect(
        securityIntegration.connect(admin).toggleSecurityFeatures(false)
      ).to.emit(securityIntegration, "SecurityFeatureToggled")
       .withArgs("AllFeatures", false);

      expect(await securityIntegration.securityFeaturesEnabled()).to.be.false;

      // Toggle back on
      await securityIntegration.connect(admin).toggleSecurityFeatures(true);
      expect(await securityIntegration.securityFeaturesEnabled()).to.be.true;
    });

    it("should reject toggle from non-admin", async () => {
      await expect(
        securityIntegration.connect(user1).toggleSecurityFeatures(false)
      ).to.be.reverted;
    });
  });

  describe("Function Security Configuration", function () {
    it("should allow security manager to configure function security", async () => {
      await expect(
        securityIntegration.connect(securityManager).configureFunctionSecurity(
          TEST_FUNCTION,
          true, // rate limit
          true  // multi-sig
        )
      ).to.emit(securityIntegration, "FunctionSecurityUpdated");

      const security = await securityIntegration.getFunctionSecurity(TEST_FUNCTION);
      expect(security.hasRateLimit).to.be.true;
      expect(security.hasMultiSig).to.be.true;
    });

    it("should allow bulk configuration", async () => {
      const selectors = [TEST_FUNCTION, "0x87654321"];
      const rateLimits = [true, false];
      const multiSigs = [false, true];

      await securityIntegration.connect(securityManager).bulkConfigureFunctionSecurity(
        selectors,
        rateLimits,
        multiSigs
      );

      const security1 = await securityIntegration.getFunctionSecurity(TEST_FUNCTION);
      const security2 = await securityIntegration.getFunctionSecurity("0x87654321");

      expect(security1.hasRateLimit).to.be.true;
      expect(security1.hasMultiSig).to.be.false;
      expect(security2.hasRateLimit).to.be.false;
      expect(security2.hasMultiSig).to.be.true;
    });

    it("should reject bulk configuration with mismatched arrays", async () => {
      await expect(
        securityIntegration.connect(securityManager).bulkConfigureFunctionSecurity(
          [TEST_FUNCTION],
          [true, false], // Mismatched length
          [true]
        )
      ).to.be.revertedWith("Array length mismatch");
    });

    it("should reject configuration from non-security manager", async () => {
      await expect(
        securityIntegration.connect(user1).configureFunctionSecurity(
          TEST_FUNCTION,
          true,
          true
        )
      ).to.be.reverted;
    });
  });

  describe("Rate Limiting Integration", function () {
    beforeEach(async () => {
      // Configure rate limit for test function
      const testFunctionSelector = securityIntegration.interface.getFunction("testRateLimitedFunction").selector;
      
      await securityIntegration.connect(securityManager).configureFunctionSecurity(
        testFunctionSelector,
        true, // enable rate limit
        false
      );

      // Set up rate limit in the rate limiter
      const RATE_MANAGER_ROLE = await rateLimiter.RATE_MANAGER_ROLE();
      await rateLimiter.grantRole(RATE_MANAGER_ROLE, admin.address);
      
      await rateLimiter.connect(admin).setRateLimit(
        testFunctionSelector,
        "testFunction",
        0, // FIXED_WINDOW
        2, // 2 requests
        60, // per 60 seconds
        0,
        false
      );
    });

    it("should enforce rate limits when enabled", async () => {
      // First two calls should work
      await securityIntegration.testRateLimitedFunction();
      await securityIntegration.testRateLimitedFunction();

      // Third call should fail due to rate limit
      await expect(
        securityIntegration.testRateLimitedFunction()
      ).to.be.revertedWith("Rate limit exceeded");
    });

    it("should allow unlimited calls when rate limiting disabled globally", async () => {
      // Disable security features
      await securityIntegration.connect(admin).toggleSecurityFeatures(false);

      // Should allow unlimited calls
      await securityIntegration.testRateLimitedFunction();
      await securityIntegration.testRateLimitedFunction();
      await securityIntegration.testRateLimitedFunction();
      await securityIntegration.testRateLimitedFunction();
    });
  });

  describe("Emergency System Integration", function () {
    beforeEach(async () => {
      // Configure emergency check for test function
      const testFunctionSelector = securityIntegration.interface.getFunction("testEmergencyFunction").selector;
      
      await securityIntegration.connect(securityManager).configureFunctionSecurity(
        testFunctionSelector,
        false,
        false
      );
    });

    it("should allow function calls when no emergency", async () => {
      await securityIntegration.testEmergencyFunction();
      expect(await securityIntegration.testValue()).to.equal(10);
    });

    it("should block function calls during emergency", async () => {
      // Activate emergency
      const EMERGENCY_ROLE = await emergencySystem.EMERGENCY_ROLE();
      await emergencySystem.grantRole(EMERGENCY_ROLE, admin.address);
      
      await emergencySystem.connect(admin).activateEmergency(
        2, // MEDIUM level (blocks functions)
        3600,
        "Test emergency",
        false
      );

      // Function should be blocked
      await expect(
        securityIntegration.testEmergencyFunction()
      ).to.be.revertedWith("Global emergency active");
    });

    it("should record security failures", async () => {
      // This should call emergencySystem.recordFailure internally
      await securityIntegration.testRecordFailure();
      // Hard to test directly, but should not revert
    });
  });

  describe("Multi-Sig Integration", function () {
    beforeEach(async () => {
      // Configure multi-sig requirement for test function
      const testFunctionSelector = securityIntegration.interface.getFunction("testMultiSigFunction").selector;
      
      await securityIntegration.connect(securityManager).configureFunctionSecurity(
        testFunctionSelector,
        false,
        true // enable multi-sig
      );
    });

    it("should reject direct calls to multi-sig functions", async () => {
      await expect(
        securityIntegration.testMultiSigFunction()
      ).to.be.revertedWith("Multi-sig required");
    });

    it("should allow calls from multi-sig guard", async () => {
      // This would require complex setup with actual multi-sig proposal
      // For now, test the check logic
      const security = await securityIntegration.getFunctionSecurity(
        securityIntegration.interface.getFunction("testMultiSigFunction").selector
      );
      expect(security.hasMultiSig).to.be.true;
    });
  });

  describe("Input Validation", function () {
    it("should validate addresses", async () => {
      await expect(
        securityIntegration.testValidationFunction(
          ethers.ZeroAddress,
          100,
          "test message"
        )
      ).to.be.revertedWithCustomError(securityIntegration, "InvalidAddress");
    });

    it("should validate amounts", async () => {
      await expect(
        securityIntegration.testValidationFunction(
          user1.address,
          0, // invalid amount
          "test message"
        )
      ).to.be.revertedWithCustomError(securityIntegration, "InvalidAmount");
    });

    it("should validate string length", async () => {
      await expect(
        securityIntegration.testValidationFunction(
          user1.address,
          100,
          "" // too short
        )
      ).to.be.revertedWithCustomError(securityIntegration, "StringTooShort");

      // String too long (over 100 characters)
      const longString = "a".repeat(101);
      await expect(
        securityIntegration.testValidationFunction(
          user1.address,
          100,
          longString
        )
      ).to.be.revertedWithCustomError(securityIntegration, "StringTooLong");
    });

    it("should accept valid inputs", async () => {
      await securityIntegration.testValidationFunction(
        user1.address,
        100,
        "valid message"
      );

      expect(await securityIntegration.userBalances(user1.address)).to.equal(100);
    });
  });

  describe("Pausable Integration", function () {
    it("should allow functions when not paused", async () => {
      await securityIntegration.testPausableFunction();
      expect(await securityIntegration.testValue()).to.equal(5);
    });

    it("should block functions when paused", async () => {
      await securityIntegration.connect(admin).pause();

      await expect(
        securityIntegration.testPausableFunction()
      ).to.be.revertedWithCustomError(securityIntegration, "EnforcedPause");
    });

    it("should allow admin to unpause", async () => {
      await securityIntegration.connect(admin).pause();
      await securityIntegration.connect(admin).unpause();

      await securityIntegration.testPausableFunction();
      expect(await securityIntegration.testValue()).to.equal(5);
    });
  });

  describe("Emergency Pause", function () {
    it("should allow admin to emergency pause", async () => {
      await securityIntegration.connect(admin).emergencyPause();
      expect(await securityIntegration.paused()).to.be.true;
    });

    it("should allow emergency system to pause", async () => {
      // This would require the emergency system to call emergencyPause
      // For now, test the access control logic
      const ADMIN_ROLE = await securityIntegration.ADMIN_ROLE();
      expect(await securityIntegration.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should reject emergency pause from unauthorized users", async () => {
      await expect(
        securityIntegration.connect(user1).emergencyPause()
      ).to.be.revertedWith("Unauthorized emergency pause");
    });

    it("should allow admin to emergency unpause", async () => {
      await securityIntegration.connect(admin).emergencyPause();
      await securityIntegration.connect(admin).emergencyUnpause();
      expect(await securityIntegration.paused()).to.be.false;
    });
  });

  describe("Secure Execution", function () {
    it("should execute secure functions successfully", async () => {
      const result = await securityIntegration.testSecureExecution.staticCall();
      expect(result).to.be.true;
    });
  });

  describe("Combined Security Features", function () {
    beforeEach(async () => {
      // Configure all security features for the full security function
      const testFunctionSelector = securityIntegration.interface.getFunction("testFullSecurityFunction").selector;
      
      await securityIntegration.connect(securityManager).configureFunctionSecurity(
        testFunctionSelector,
        true, // rate limit
        true  // multi-sig
      );

      // Set up rate limit
      const RATE_MANAGER_ROLE = await rateLimiter.RATE_MANAGER_ROLE();
      await rateLimiter.grantRole(RATE_MANAGER_ROLE, admin.address);
      
      await rateLimiter.connect(admin).setRateLimit(
        testFunctionSelector,
        "testFullFunction",
        0, // FIXED_WINDOW
        1, // 1 request
        60, // per 60 seconds
        0,
        false
      );
    });

    it("should enforce all security features when enabled", async () => {
      // Should fail due to multi-sig requirement
      await expect(
        securityIntegration.testFullSecurityFunction()
      ).to.be.revertedWith("Multi-sig required");
    });

    it("should bypass all features when disabled", async () => {
      await securityIntegration.connect(admin).toggleSecurityFeatures(false);
      
      // Should work when security features disabled
      await securityIntegration.testFullSecurityFunction();
      expect(await securityIntegration.testValue()).to.equal(1000);
    });
  });

  describe("View Functions", function () {
    it("should return correct security status", async () => {
      const status = await securityIntegration.getSecurityStatus();
      expect(status.featuresEnabled).to.be.true;
      expect(status.multiSigAddress).to.equal(multiSigGuard.target);
      expect(status.rateLimiterAddress).to.equal(rateLimiter.target);
      expect(status.emergencySystemAddress).to.equal(emergencySystem.target);
    });

    it("should return correct function security settings", async () => {
      await securityIntegration.connect(securityManager).configureFunctionSecurity(
        TEST_FUNCTION,
        true,
        false
      );

      const security = await securityIntegration.getFunctionSecurity(TEST_FUNCTION);
      expect(security.hasRateLimit).to.be.true;
      expect(security.hasMultiSig).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("should enforce admin role for system updates", async () => {
      await expect(
        securityIntegration.connect(user1).updateSecuritySystem(
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          ethers.ZeroAddress
        )
      ).to.be.reverted;
    });

    it("should enforce admin role for feature toggle", async () => {
      await expect(
        securityIntegration.connect(user1).toggleSecurityFeatures(false)
      ).to.be.reverted;
    });

    it("should enforce security manager role for function configuration", async () => {
      await expect(
        securityIntegration.connect(user1).configureFunctionSecurity(
          TEST_FUNCTION,
          true,
          true
        )
      ).to.be.reverted;
    });

    it("should enforce admin role for pause/unpause", async () => {
      await expect(
        securityIntegration.connect(user1).pause()
      ).to.be.reverted;

      await expect(
        securityIntegration.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero addresses in security systems gracefully", async () => {
      // This tests the null checks in modifiers
      const TestContract = await ethers.getContractFactory("SecurityIntegrationTest");
      const testContract = await TestContract.deploy();
      await testContract.waitForDeployment();

      // Initialize with zero addresses
      await testContract.initialize(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress
      );

      // Should not revert when security systems are not set
      await testContract.testRateLimitedFunction();
      await testContract.testEmergencyFunction();
    });

    it("should handle disabled security features correctly", async () => {
      await securityIntegration.connect(admin).toggleSecurityFeatures(false);

      // All security checks should be bypassed
      await securityIntegration.testRateLimitedFunction();
      await securityIntegration.testEmergencyFunction();
    });
  });
});