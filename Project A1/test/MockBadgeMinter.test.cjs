const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockBadgeMinter", function () {
  let mockBadgeMinter;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const MockBadgeMinterFactory = await ethers.getContractFactory("MockBadgeMinter");
    mockBadgeMinter = await MockBadgeMinterFactory.deploy();
    await mockBadgeMinter.waitForDeployment();
  });

  it("Should allow minting a badge", async function () {
    await mockBadgeMinter.mint(addr1.address, 1, "ipfs://testuri/1");
    expect(await mockBadgeMinter.ownerOf(1)).to.equal(addr1.address);
  });

  it("Should revert ownerOf if setRevertOwnerOf is true", async function () {
    await mockBadgeMinter.setRevertOwnerOf(true);
    await expect(mockBadgeMinter.ownerOf(1)).to.be.revertedWith("MockBadgeMinter: ownerOf reverted");
  });

  it("Should not revert ownerOf if setRevertOwnerOf is false", async function () {
    await mockBadgeMinter.setRevertOwnerOf(true);
    await mockBadgeMinter.setRevertOwnerOf(false);
    await mockBadgeMinter.mint(addr1.address, 1, "ipfs://testuri/1");
    expect(await mockBadgeMinter.ownerOf(1)).to.equal(addr1.address);
  });

  it("Should set _revertOwnerOf to true", async function () {
    await mockBadgeMinter.setRevertOwnerOf(true);
    // There's no direct way to read private state variables in tests.
    // We rely on the behavior of ownerOf to confirm the state change.
    await expect(mockBadgeMinter.ownerOf(1)).to.be.revertedWith("MockBadgeMinter: ownerOf reverted");
  });

  it("Should set _revertOwnerOf to false", async function () {
    await mockBadgeMinter.setRevertOwnerOf(true);
    await mockBadgeMinter.setRevertOwnerOf(false);
    // We rely on the behavior of ownerOf to confirm the state change.
    await mockBadgeMinter.mint(addr1.address, 1, "ipfs://testuri/1");
    expect(await mockBadgeMinter.ownerOf(1)).to.equal(addr1.address);
  });
});
