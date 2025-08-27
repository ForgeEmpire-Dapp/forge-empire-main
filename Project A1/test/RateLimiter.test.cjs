const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("RateLimiter", function () {
  let RateLimiter, rateLimiter;
  let owner, admin, rateManager, user1, user2, user3;

  // Test function selectors
  const TEST_FUNCTION_1 = "0x12345678";
  const TEST_FUNCTION_2 = "0x87654321";
  const TEST_FUNCTION_3 = "0xabcdefab";

  // Rate limit types
  const LimitType = {
    FIXED_WINDOW: 0,
    SLIDING_WINDOW: 1,
    TOKEN_BUCKET: 2
  };

  // Helper function to check and execute rate limit
  async function checkAndExecuteRate(user, selector, expectResult = null) {
    const staticResult = await rateLimiter.checkRateLimit.staticCall(user, selector);
    const tx = await rateLimiter.checkRateLimit(user, selector);
    
    if (expectResult !== null) {
      expect(staticResult).to.equal(expectResult);
    }
    
    return { allowed: staticResult, tx };
  }

  beforeEach(async () => {
    [owner, admin, rateManager, user1, user2, user3] = await ethers.getSigners();

    // Deploy RateLimiter
    RateLimiter = await ethers.getContractFactory("RateLimiter");
    rateLimiter = await RateLimiter.deploy();
    await rateLimiter.waitForDeployment();

    // Initialize
    await rateLimiter.initialize();

    // Grant roles
    const ADMIN_ROLE = await rateLimiter.ADMIN_ROLE();
    const RATE_MANAGER_ROLE = await rateLimiter.RATE_MANAGER_ROLE();
    
    await rateLimiter.grantRole(ADMIN_ROLE, admin.address);
    await rateLimiter.grantRole(RATE_MANAGER_ROLE, rateManager.address);
  });

  describe("Deployment", function () {
    it("should initialize with correct roles", async () => {
      const DEFAULT_ADMIN_ROLE = await rateLimiter.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await rateLimiter.ADMIN_ROLE();
      const RATE_MANAGER_ROLE = await rateLimiter.RATE_MANAGER_ROLE();

      expect(await rateLimiter.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await rateLimiter.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await rateLimiter.hasRole(RATE_MANAGER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Rate Limit Configuration", function () {
    it("should allow rate manager to set fixed window rate limit", async () => {
      await expect(
        rateLimiter.connect(rateManager).setRateLimit(
          TEST_FUNCTION_1,
          "testFunction1",
          LimitType.FIXED_WINDOW,
          5,
          60,
          0,
          false
        )
      ).to.emit(rateLimiter, "RateLimitSet")
       .withArgs(TEST_FUNCTION_1, "testFunction1", LimitType.FIXED_WINDOW, 5, 60);

      const limit = await rateLimiter.getRateLimit(TEST_FUNCTION_1);
      expect(limit.limitType).to.equal(LimitType.FIXED_WINDOW);
      expect(limit.maxRequests).to.equal(5);
      expect(limit.active).to.be.true;
    });

    it("should reject invalid parameters", async () => {
      await expect(
        rateLimiter.connect(rateManager).setRateLimit(
          TEST_FUNCTION_1,
          "test",
          LimitType.FIXED_WINDOW,
          0, // invalid
          60,
          0,
          false
        )
      ).to.be.revertedWith("Max requests must be > 0");
    });

    it("should allow toggling active status", async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_1,
        "test",
        LimitType.FIXED_WINDOW,
        5,
        60,
        0,
        false
      );

      await rateLimiter.connect(rateManager).setRateLimitActive(TEST_FUNCTION_1, false);
      const limit = await rateLimiter.getRateLimit(TEST_FUNCTION_1);
      expect(limit.active).to.be.false;
    });
  });

  describe("Fixed Window Rate Limiting", function () {
    beforeEach(async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_1,
        "testFunction1",
        LimitType.FIXED_WINDOW,
        3,
        60,
        0,
        false
      );
    });

    it("should allow requests within limit", async () => {
      const result1 = await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      const result2 = await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      const result3 = await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
    });

    it("should reject requests exceeding limit", async () => {
      // Use up the limit
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);

      // Should fail on next request
      const result = await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, false);
      expect(result.tx).to.emit(rateLimiter, "RateLimitExceededEvent");
    });

    it("should reset limit in new window", async () => {
      // Use up the limit
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      
      // Should be blocked
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, false);

      // Advance time to new window
      await time.increase(61);

      // Should work again
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
    });

    it("should track limits per user independently", async () => {
      // Use up user1's limit
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      
      // User1 should be blocked
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, false);

      // User2 should still work
      await checkAndExecuteRate(user2.address, TEST_FUNCTION_1, true);
    });
  });

  describe("Token Bucket Rate Limiting", function () {
    beforeEach(async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_3,
        "testFunction3",
        LimitType.TOKEN_BUCKET,
        5, // bucket capacity
        60,
        1, // 1 token per second refill
        false
      );
    });

    it("should allow requests when tokens available", async () => {
      // Should have full bucket initially
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_3, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_3, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_3, true);
    });

    it("should reject requests when bucket empty", async () => {
      await ethers.provider.send("evm_setAutomine", [false]);
      // Use all tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkRateLimit(user1.address, TEST_FUNCTION_3);
        await ethers.provider.send("evm_mine", []);
      }

      // Should be out of tokens
      const result = await rateLimiter.checkRateLimit.staticCall(user1.address, TEST_FUNCTION_3);
      expect(result).to.be.false;
      await ethers.provider.send("evm_setAutomine", [true]);
    });

    it("should refill tokens over time", async () => {
        await ethers.provider.send("evm_setAutomine", [false]);
        // Use all tokens
        for (let i = 0; i < 5; i++) {
            await rateLimiter.checkRateLimit(user1.address, TEST_FUNCTION_3);
            await ethers.provider.send("evm_mine", []);
        }
        let result = await rateLimiter.checkRateLimit.staticCall(user1.address, TEST_FUNCTION_3);
        expect(result).to.be.false;

        // Wait for refill (3 seconds = 3 tokens at 1 token/second)
        await time.increase(3);
        await ethers.provider.send("evm_mine", []);

        // Should have refilled exactly 3 tokens
        await rateLimiter.checkRateLimit(user1.address, TEST_FUNCTION_3);
        await ethers.provider.send("evm_mine", []);
        await rateLimiter.checkRateLimit(user1.address, TEST_FUNCTION_3);
        await ethers.provider.send("evm_mine", []);
        await rateLimiter.checkRateLimit(user1.address, TEST_FUNCTION_3);
        await ethers.provider.send("evm_mine", []);

        // 4th should fail
        result = await rateLimiter.checkRateLimit.staticCall(user1.address, TEST_FUNCTION_3);
        expect(result).to.be.false;

        await ethers.provider.send("evm_setAutomine", [true]);
    });
  });

  describe("Global Rate Limits", function () {
    beforeEach(async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_1,
        "globalFunction",
        LimitType.FIXED_WINDOW,
        3,
        60,
        0,
        true // global limit
      );
    });

    it("should enforce global limits across all users", async () => {
      // Use up global limit across users
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user2.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user3.address, TEST_FUNCTION_1, true);

      // All users should be blocked now
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, false);
      await checkAndExecuteRate(user2.address, TEST_FUNCTION_1, false);
    });
  });

  describe("Whitelist Management", function () {
    beforeEach(async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_1,
        "test",
        LimitType.FIXED_WINDOW,
        1, // Very restrictive
        60,
        0,
        false
      );
    });

    it("should allow admin to whitelist users", async () => {
      await expect(
        rateLimiter.connect(admin).setWhitelisted(user1.address, true)
      ).to.emit(rateLimiter, "UserWhitelisted")
       .withArgs(user1.address, true);

      expect(await rateLimiter.isWhitelisted(user1.address)).to.be.true;
    });

    it("should bypass rate limits for whitelisted users", async () => {
      await rateLimiter.connect(admin).setWhitelisted(user1.address, true);

      // Should be able to make unlimited requests
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);

      // Non-whitelisted user should still be limited
      await checkAndExecuteRate(user2.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user2.address, TEST_FUNCTION_1, false);
    });

    it("should allow bulk whitelisting", async () => {
      const users = [user1.address, user2.address];
      await rateLimiter.connect(admin).bulkSetWhitelisted(users, true);

      expect(await rateLimiter.isWhitelisted(user1.address)).to.be.true;
      expect(await rateLimiter.isWhitelisted(user2.address)).to.be.true;
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_1,
        "test",
        LimitType.FIXED_WINDOW,
        1,
        60,
        0,
        false
      );
    });

    it("should allow admin to clear user rate limit", async () => {
      // Hit rate limit
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, false);

      // Clear rate limit
      await expect(
        rateLimiter.connect(admin).clearUserRateLimit(user1.address, TEST_FUNCTION_1)
      ).to.emit(rateLimiter, "RateLimitCleared");

      // Should work again
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
    });

    it("should allow admin to clear global rate limit", async () => {
      // Set global limit and hit it
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_2,
        "global",
        LimitType.FIXED_WINDOW,
        1,
        60,
        0,
        true
      );

      await checkAndExecuteRate(user1.address, TEST_FUNCTION_2, true);
      await checkAndExecuteRate(user2.address, TEST_FUNCTION_2, false);

      // Clear global limit
      await expect(
        rateLimiter.connect(admin).clearGlobalRateLimit(TEST_FUNCTION_2)
      ).to.emit(rateLimiter, "RateLimitCleared");

      // Should work again
      await checkAndExecuteRate(user2.address, TEST_FUNCTION_2, true);
    });
  });

  describe("Inactive and Unconfigured Limits", function () {
    it("should allow unlimited access when rate limit is inactive", async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_1,
        "test",
        LimitType.FIXED_WINDOW,
        1,
        60,
        0,
        false
      );
      await rateLimiter.connect(rateManager).setRateLimitActive(TEST_FUNCTION_1, false);

      // Should allow unlimited access
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1, true);
    });

    it("should allow unlimited access when no rate limit configured", async () => {
      // No rate limit set
      await checkAndExecuteRate(user1.address, "0x99999999", true);
      await checkAndExecuteRate(user1.address, "0x99999999", true);
    });
  });

  describe("View Functions", function () {
    beforeEach(async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_1,
        "test",
        LimitType.FIXED_WINDOW,
        5,
        60,
        0,
        false
      );
    });

    it("should return correct rate limit configuration", async () => {
      const config = await rateLimiter.getRateLimit(TEST_FUNCTION_1);
      expect(config.limitType).to.equal(LimitType.FIXED_WINDOW);
      expect(config.maxRequests).to.equal(5);
      expect(config.active).to.be.true;
    });

    it("should return correct user rate limit status", async () => {
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_1);

      const status = await rateLimiter.getUserRateLimit(user1.address, TEST_FUNCTION_1);
      expect(status.requestCount).to.equal(2);
      expect(status.lastRequest).to.be.above(0);
    });
  });

  describe("Access Control", function () {
    it("should enforce rate manager role for configuration", async () => {
      await expect(
        rateLimiter.connect(user1).setRateLimit(
          TEST_FUNCTION_1,
          "test",
          LimitType.FIXED_WINDOW,
          5,
          60,
          0,
          false
        )
      ).to.be.reverted;
    });

    it("should enforce admin role for whitelist functions", async () => {
      await expect(
        rateLimiter.connect(user1).setWhitelisted(user2.address, true)
      ).to.be.reverted;
    });

    it("should allow public access to checkRateLimit", async () => {
      // Anyone can call this function
      const result = await rateLimiter.checkRateLimit.staticCall(user1.address, TEST_FUNCTION_1);
      expect(result).to.be.true;
    });
  });

  describe("Edge Cases", function () {
    it("should handle sliding window rate limiting", async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_2,
        "sliding",
        LimitType.SLIDING_WINDOW,
        2,
        10, // 10 second window
        0,
        false
      );

      // Use up limit
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_2, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_2, true);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_2, false);

      // Wait and try again
      await time.increase(6);
      await checkAndExecuteRate(user1.address, TEST_FUNCTION_2, true);
    });

    it("should handle token bucket edge cases", async () => {
      await rateLimiter.connect(rateManager).setRateLimit(
        TEST_FUNCTION_3,
        "bucket",
        LimitType.TOKEN_BUCKET,
        3, // 3 tokens max
        60,
        2, // 2 tokens per second
        false
      );

      // Test initialization and refill capping
      await time.increase(100); // Long time to ensure bucket would be full if it was leaky

      // Turn off automine to control calls precisely
      await ethers.provider.send("evm_setAutomine", [false]);

      // Should only have max tokens (3), not unlimited
      await rateLimiter.checkRateLimit(user1.address, TEST_FUNCTION_3);
      await ethers.provider.send("evm_mine", []); // Allowed

      await rateLimiter.checkRateLimit(user1.address, TEST_FUNCTION_3);
      await ethers.provider.send("evm_mine", []); // Allowed

      await rateLimiter.checkRateLimit(user1.address, TEST_FUNCTION_3);
      await ethers.provider.send("evm_mine", []); // Allowed

      // Fourth call should fail as bucket is empty and no time has passed to refill
      let result = await rateLimiter.checkRateLimit.staticCall(user1.address, TEST_FUNCTION_3);
      expect(result).to.be.false;

      // Turn automine back on
      await ethers.provider.send("evm_setAutomine", [true]);
    });
  });
});