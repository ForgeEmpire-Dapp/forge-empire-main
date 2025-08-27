const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BondingCurveLib", function () {
  let bondingCurveTest;

  // Constants from the library
  const INITIAL_PRICE = ethers.parseEther("0.001"); // 0.001 ETH
  const PRICE_INCREMENT = ethers.parseEther("0.000001"); // 0.000001 ETH per token
  const PRECISION = ethers.parseEther("1");

  beforeEach(async function () {
    // Deploy test contract that uses the library
    const BondingCurveTest = await ethers.getContractFactory("BondingCurveTest");
    bondingCurveTest = await BondingCurveTest.deploy();
    await bondingCurveTest.waitForDeployment();
  });

  describe("Price Calculations", function () {
    it("Should return initial price for zero supply", async function () {
      const price = await bondingCurveTest.getCurrentPrice(0);
      expect(price).to.equal(INITIAL_PRICE);
    });

    it("Should increase price with supply", async function () {
      const supply = ethers.parseEther("1000");
      const expectedPrice = INITIAL_PRICE + (supply * PRICE_INCREMENT) / PRECISION;
      
      const price = await bondingCurveTest.getCurrentPrice(supply);
      expect(price).to.equal(expectedPrice);
    });

    it("Should handle large supply values", async function () {
      const largeSupply = ethers.parseEther("1000000"); // 1M tokens
      const price = await bondingCurveTest.getCurrentPrice(largeSupply);
      
      expect(price).to.be.gt(INITIAL_PRICE);
      expect(price).to.equal(INITIAL_PRICE + (largeSupply * PRICE_INCREMENT) / PRECISION);
    });
  });

  describe("Buy Cost Calculations", function () {
    it("Should calculate correct cost for first token", async function () {
      const amount = ethers.parseEther("1");
      const cost = await bondingCurveTest.calculateBuyCost(0, amount);
      
      // For linear curve: cost = (startPrice + endPrice) * amount / 2
      const startPrice = INITIAL_PRICE;
      const endPrice = INITIAL_PRICE + (amount * PRICE_INCREMENT) / PRECISION;
      const expectedCost = ((startPrice + endPrice) * amount) / (2n * PRECISION);
      
      expect(cost).to.equal(expectedCost);
    });

    it("Should calculate increasing cost for subsequent tokens", async function () {
      const currentSupply = ethers.parseEther("1000");
      const amount = ethers.parseEther("100");
      
      const cost = await bondingCurveTest.calculateBuyCost(currentSupply, amount);
      
      const startPrice = INITIAL_PRICE + (currentSupply * PRICE_INCREMENT) / PRECISION;
      const endPrice = INITIAL_PRICE + ((currentSupply + amount) * PRICE_INCREMENT) / PRECISION;
      const expectedCost = ((startPrice + endPrice) * amount) / (2n * PRECISION);
      
      expect(cost).to.equal(expectedCost);
    });

    it("Should handle zero amount purchase", async function () {
      const cost = await bondingCurveTest.calculateBuyCost(ethers.parseEther("1000"), 0);
      expect(cost).to.equal(0);
    });

    it("Should handle large amount purchases", async function () {
      const currentSupply = ethers.parseEther("10000");
      const largeAmount = ethers.parseEther("50000");
      
      const cost = await bondingCurveTest.calculateBuyCost(currentSupply, largeAmount);
      expect(cost).to.be.gt(0);
      
      // Verify cost increases with amount
      const smallerCost = await bondingCurveTest.calculateBuyCost(currentSupply, largeAmount / 2n);
      expect(cost).to.be.gt(smallerCost);
    });
  });

  describe("Sell Proceeds Calculations", function () {
    it("Should calculate correct proceeds for selling tokens", async function () {
      const currentSupply = ethers.parseEther("2000");
      const sellAmount = ethers.parseEther("500");
      
      const proceeds = await bondingCurveTest.calculateSellProceeds(currentSupply, sellAmount);
      
      const newSupply = currentSupply - sellAmount;
      const startPrice = INITIAL_PRICE + (newSupply * PRICE_INCREMENT) / PRECISION;
      const endPrice = INITIAL_PRICE + (currentSupply * PRICE_INCREMENT) / PRECISION;
      const expectedProceeds = ((startPrice + endPrice) * sellAmount) / (2n * PRECISION);
      
      expect(proceeds).to.equal(expectedProceeds);
    });

    it("Should return zero for selling more than supply", async function () {
      const currentSupply = ethers.parseEther("1000");
      const excessAmount = ethers.parseEther("1500");
      
      const proceeds = await bondingCurveTest.calculateSellProceeds(currentSupply, excessAmount);
      expect(proceeds).to.equal(0);
    });

    it("Should handle selling entire supply", async function () {
      const currentSupply = ethers.parseEther("1000");
      const proceeds = await bondingCurveTest.calculateSellProceeds(currentSupply, currentSupply);
      
      expect(proceeds).to.be.gt(0);
      // Should be equivalent to the cost to buy from 0 to currentSupply
      const equivalentBuyCost = await bondingCurveTest.calculateBuyCost(0, currentSupply);
      expect(proceeds).to.equal(equivalentBuyCost);
    });

    it("Should handle zero sell amount", async function () {
      const proceeds = await bondingCurveTest.calculateSellProceeds(ethers.parseEther("1000"), 0);
      expect(proceeds).to.equal(0);
    });
  });

  describe("Token Amount for ETH Calculations", function () {
    it("Should calculate tokens for ETH at zero supply", async function () {
      const ethAmount = ethers.parseEther("1"); // 1 ETH
      const tokens = await bondingCurveTest.calculateTokensForEth(0, ethAmount);

      // The returned token amount should be positive
      expect(tokens).to.be.gt(0);

      // The cost to buy that many tokens should be close to the ETH input
      const cost = await bondingCurveTest.calculateBuyCost(0, tokens);
      expect(cost).to.be.closeTo(ethAmount, ethers.parseEther("0.001")); // Small tolerance for rounding
    });

    it("Should calculate tokens for ETH at existing supply", async function () {
      const currentSupply = ethers.parseEther("5000");
      const ethAmount = ethers.parseEther("0.5");

      const tokens = await bondingCurveTest.calculateTokensForEth(currentSupply, ethAmount);
      expect(tokens).to.be.gt(0);

      // Verify the calculation is approximately correct
      const cost = await bondingCurveTest.calculateBuyCost(currentSupply, tokens);
      expect(cost).to.be.closeTo(ethAmount, ethers.parseEther("0.001"));
    });

    it("Should handle zero ETH amount", async function () {
      const tokens = await bondingCurveTest.calculateTokensForEth(ethers.parseEther("1000"), 0);
      expect(tokens).to.equal(0);
    });

    it("Should return fewer tokens for same ETH at higher supply", async function () {
      const ethAmount = ethers.parseEther("1");

      const tokensAtZero = await bondingCurveTest.calculateTokensForEth(0, ethAmount);
      const tokensAtHighSupply = await bondingCurveTest.calculateTokensForEth(ethers.parseEther("10000"), ethAmount);

      expect(tokensAtZero).to.be.gt(tokensAtHighSupply);
    });
  });

  describe("Mathematical Properties", function () {
    it("Should maintain buy/sell symmetry", async function () {
      const initialSupply = ethers.parseEther("5000");
      const amount = ethers.parseEther("1000");
      
      // Calculate cost to buy
      const buyCost = await bondingCurveTest.calculateBuyCost(initialSupply, amount);
      
      // Calculate proceeds from selling the same amount at higher supply
      const sellProceeds = await bondingCurveTest.calculateSellProceeds(initialSupply + amount, amount);
      
      expect(buyCost).to.equal(sellProceeds);
    });

    it("Should have linear price progression", async function () {
      const supply1 = ethers.parseEther("1000");
      const supply2 = ethers.parseEther("2000");
      const supply3 = ethers.parseEther("3000");
      
      const price1 = await bondingCurveTest.getCurrentPrice(supply1);
      const price2 = await bondingCurveTest.getCurrentPrice(supply2);
      const price3 = await bondingCurveTest.getCurrentPrice(supply3);
      
      // Price differences should be equal for equal supply differences
      const diff1to2 = price2 - price1;
      const diff2to3 = price3 - price2;
      
      expect(diff1to2).to.equal(diff2to3);
    });

    it("Should have cost proportional to average price times amount", async function () {
      const currentSupply = ethers.parseEther("2000");
      const amount = ethers.parseEther("1000");
      
      const cost = await bondingCurveTest.calculateBuyCost(currentSupply, amount);
      
      const startPrice = await bondingCurveTest.getCurrentPrice(currentSupply);
      const endPrice = await bondingCurveTest.getCurrentPrice(currentSupply + amount);
      const averagePrice = (startPrice + endPrice) / 2n;
      const expectedCost = (averagePrice * amount) / PRECISION;
      
      expect(cost).to.equal(expectedCost);
    });
  });

  describe("Edge Cases and Limits", function () {
    it("Should handle maximum uint256 values gracefully", async function () {
      const maxSupply = ethers.MaxUint256;
      
      // Should not revert, though price will be astronomical
      await expect(bondingCurveTest.getCurrentPrice(maxSupply)).to.not.be.reverted;
    });

    it("Should handle very small amounts", async function () {
      const smallAmount = ethers.parseUnits("1", "wei"); // 1 wei
      const cost = await bondingCurveTest.calculateBuyCost(0, smallAmount);
      
      expect(cost).to.be.gte(0);
    });

    it("Should be monotonically increasing", async function () {
      const supplies = [
        0,
        ethers.parseEther("1000"),
        ethers.parseEther("5000"),
        ethers.parseEther("10000"),
        ethers.parseEther("50000")
      ];
      
      let previousPrice = 0n;
      for (const supply of supplies) {
        const price = await bondingCurveTest.getCurrentPrice(supply);
        expect(price).to.be.gte(previousPrice);
        previousPrice = price;
      }
    });
  });

  describe("Square Root Function", function () {
    it("Should calculate square root correctly", async function () {
      // Test specific values where we know the exact square root
      const testCases = [
        { input: 0, expected: 0 },
        { input: 1, expected: 1 },
        { input: 4, expected: 2 },
        { input: 9, expected: 3 },
        { input: 16, expected: 4 },
        { input: 25, expected: 5 },
        { input: 100, expected: 10 }
      ];
      
      for (const testCase of testCases) {
        const result = await bondingCurveTest.sqrt(testCase.input);
        expect(result).to.equal(testCase.expected);
      }
    });

    it("Should handle large numbers", async function () {
      const largeNumber = ethers.parseEther("1000000"); // 1M ETH in wei
      const sqrt = await bondingCurveTest.sqrt(largeNumber);
      
      expect(sqrt).to.be.gt(0);
      // Verify the result is approximately correct
      expect(sqrt * sqrt).to.be.closeTo(largeNumber, largeNumber / 1000n); // 0.1% tolerance
    });
  });

  describe("Gas Efficiency", function () {
    it("Should have reasonable gas costs for price calculations", async function () {
      const tx = await bondingCurveTest.getCurrentPrice.populateTransaction(ethers.parseEther("10000"));
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      // Should be well under 100k gas for a simple calculation
      expect(estimatedGas).to.be.lt(100000);
    });

    it("Should have reasonable gas costs for buy cost calculations", async function () {
      const tx = await bondingCurveTest.calculateBuyCost.populateTransaction(
        ethers.parseEther("10000"),
        ethers.parseEther("1000")
      );
      const estimatedGas = await ethers.provider.estimateGas(tx);
      
      // Should be reasonable for complex calculation
      expect(estimatedGas).to.be.lt(200000);
    });
  });
});