const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VestingWalletFactory", function () {
  let VestingWalletFactory;
  let vestingWalletFactory;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    VestingWalletFactory = await ethers.getContractFactory("VestingWalletFactory");
    vestingWalletFactory = await VestingWalletFactory.deploy();
    await vestingWalletFactory.waitForDeployment();
  });

  describe("Deployment and Roles", function () {
    it("Should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
      expect(await vestingWalletFactory.hasRole(await vestingWalletFactory.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    });

    it("Should grant PAUSER_ROLE to the deployer", async function () {
      expect(await vestingWalletFactory.hasRole(await vestingWalletFactory.PAUSER_ROLE(), owner.address)).to.be.true;
    });

    it("Should grant WALLET_CREATOR_ROLE to the deployer", async function () {
      expect(await vestingWalletFactory.hasRole(await vestingWalletFactory.WALLET_CREATOR_ROLE(), owner.address)).to.be.true;
    });
  });

  describe("createVestingWallet", function () {
    it("Should create a new VestingWallet and emit an event", async function () {
      const beneficiary = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
      const start = Math.floor(Date.now() / 1000) + 60;
      const duration = 3600;

      const tx = await vestingWalletFactory.createVestingWallet(beneficiary, start, duration);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === "VestingWalletCreated");
      expect(event).to.not.be.undefined;
      expect(event.args.beneficiary).to.equal(ethers.getAddress(beneficiary));
      expect(event.args.start).to.equal(start);
      expect(event.args.duration).to.equal(duration);
      expect(ethers.isAddress(event.args.vestingWallet)).to.be.true;
    });

    it("Should not allow non-WALLET_CREATOR_ROLE to create a vesting wallet", async function () {
      const beneficiary = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
      const start = Math.floor(Date.now() / 1000) + 60;
      const duration = 3600;

      await expect(vestingWalletFactory.connect(addr1).createVestingWallet(beneficiary, start, duration))
        .to.be.revertedWithCustomError(vestingWalletFactory, "AccessControlUnauthorizedAccount");
    });

    it("Should revert if contract is paused", async function () {
      const beneficiary = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
      const start = Math.floor(Date.now() / 1000) + 60;
      const duration = 3600;

      await vestingWalletFactory.pause();
      await expect(vestingWalletFactory.createVestingWallet(beneficiary, start, duration))
        .to.be.revertedWithCustomError(vestingWalletFactory, "EnforcedPause");
    });

    it("Should revert if beneficiary is zero address", async function () {
      const start = Math.floor(Date.now() / 1000) + 60;
      const duration = 3600;
      const VestingWallet = await ethers.getContractFactory("VestingWallet");
      await expect(vestingWalletFactory.createVestingWallet(ethers.ZeroAddress, start, duration))
        .to.be.revertedWithCustomError(VestingWallet, "OwnableInvalidOwner").withArgs(ethers.ZeroAddress);
    });
  });

  describe("Pause/Unpause", function () {
    it("Should allow PAUSER_ROLE to pause the contract", async function () {
      await vestingWalletFactory.pause();
      expect(await vestingWalletFactory.paused()).to.be.true;
    });

    it("Should allow PAUSER_ROLE to unpause the contract", async function () {
      await vestingWalletFactory.pause();
      await vestingWalletFactory.unpause();
      expect(await vestingWalletFactory.paused()).to.be.false;
    });

    it("Should not allow non-PAUSER_ROLE to pause the contract", async function () {
      await expect(vestingWalletFactory.connect(addr1).pause())
        .to.be.revertedWithCustomError(vestingWalletFactory, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow non-PAUSER_ROLE to unpause the contract", async function () {
      await vestingWalletFactory.pause();
      await expect(vestingWalletFactory.connect(addr1).unpause())
        .to.be.revertedWithCustomError(vestingWalletFactory, "AccessControlUnauthorizedAccount");
    });
  });
});