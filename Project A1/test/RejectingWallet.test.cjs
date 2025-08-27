
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RejectingWallet", function () {
  let rejectingWallet;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const RejectingWallet = await ethers.getContractFactory("RejectingWallet");
    rejectingWallet = await RejectingWallet.deploy();
    await rejectingWallet.waitForDeployment();
  });

  it("Should reject direct Ether transfers", async function () {
    await expect(owner.sendTransaction({
      to: rejectingWallet.target,
      value: ethers.parseEther("1.0"),
    })).to.be.revertedWithCustomError(rejectingWallet, "PaymentRejected");
  });

  it("Should reject Ether transfers via call", async function () {
    await expect(owner.call({
      to: rejectingWallet.target,
      value: ethers.parseEther("1.0"),
    })).to.be.revertedWithCustomError(rejectingWallet, "PaymentRejected");
  });

  it("Should reject calls to non-existent functions", async function () {
    await expect(owner.sendTransaction({
      to: rejectingWallet.target,
      data: "0x12345678", // A random function selector
    })).to.be.reverted;
  });
});
