const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Kudos", function () {
  let kudos;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const Kudos = await ethers.getContractFactory("Kudos");
    kudos = await Kudos.deploy();
    await kudos.waitForDeployment();
  });

  it("Should allow a user to send kudos to another user", async function () {
    await expect(kudos.connect(owner).sendKudos(addr1.address))
      .to.emit(kudos, "KudosSent")
      .withArgs(owner.address, addr1.address);

    expect(await kudos.getKudos(addr1.address)).to.equal(1);
  });

  it("Should not allow a user to send kudos to themselves", async function () {
    await expect(kudos.connect(owner).sendKudos(owner.address))
      .to.be.revertedWithCustomError(kudos, "CannotSendKudosToSelf");
  });

  it("Should return the correct number of kudos for a user", async function () {
    await kudos.connect(owner).sendKudos(addr1.address);
    await kudos.connect(addr2).sendKudos(addr1.address);

    expect(await kudos.getKudos(addr1.address)).to.equal(2);
  });
});
