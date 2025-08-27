
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenManagerCore", function () {
  let tokenManagerCore;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const TokenManagerCore = await ethers.getContractFactory("TokenManagerCore");
    tokenManagerCore = await TokenManagerCore.deploy(owner.address, 100); // Example fee wallet and protocol fee
    await tokenManagerCore.waitForDeployment();
  });

  it("Should deploy with the correct fee wallet and protocol fee", async function () {
    const config = await tokenManagerCore.protocolConfig();
    expect(config.feeWallet).to.equal(owner.address);
    expect(config.protocolFee).to.equal(100);
  });

  it("Should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
    expect(await tokenManagerCore.hasRole(await tokenManagerCore.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
  });

  it("Should grant PAUSER_ROLE to the deployer", async function () {
    expect(await tokenManagerCore.hasRole(await tokenManagerCore.PAUSER_ROLE(), owner.address)).to.be.true;
  });

  it("Should revert if fee wallet is zero address during deployment", async function () {
    const TokenManagerCore = await ethers.getContractFactory("TokenManagerCore");
    await expect(TokenManagerCore.deploy(ethers.ZeroAddress, 100))
      .to.be.revertedWithCustomError(TokenManagerCore, "FeeWalletCannotBeZero");
  });

  describe("launchToken", function () {
    let tokenManagerCore;
    let owner;
    let addr1;
    let mockToken;

    beforeEach(async function () {
      [owner, addr1] = await ethers.getSigners();
      const TokenManagerCore = await ethers.getContractFactory("TokenManagerCore");
      tokenManagerCore = await TokenManagerCore.deploy(owner.address, 100);
      await tokenManagerCore.waitForDeployment();

      // Grant CREATOR_ROLE to owner for testing launchToken function
      await tokenManagerCore.grantRole(await tokenManagerCore.CREATOR_ROLE(), owner.address);

      // Deploy a mock token
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockToken = await MockERC20.deploy("MockToken", "MTK");
      await mockToken.waitForDeployment();
    });

    it("Should allow a user with CREATOR_ROLE to launch a token", async function () {
      const tokenAddress = mockToken.target;
      const name = "MockToken";
      const symbol = "MTK";
      const totalSupply = 1000;

      await expect(tokenManagerCore.launchToken(tokenAddress, name, symbol, totalSupply))
        .to.emit(tokenManagerCore, "TokenLaunched")
        .withArgs(tokenAddress, owner.address, name, symbol, totalSupply);

      expect(await tokenManagerCore.launchedTokensCount()).to.equal(1);
      expect(await tokenManagerCore.getTokenAtIndex(0)).to.equal(tokenAddress);
      expect(await tokenManagerCore.isTokenLaunched(tokenAddress)).to.be.true;

      const metadata = await tokenManagerCore.tokenMetadata(tokenAddress);
      expect(metadata.tokenAddress).to.equal(tokenAddress);
      expect(metadata.creator).to.equal(owner.address);
      expect(metadata.name).to.equal(name);
      expect(metadata.symbol).to.equal(symbol);
      expect(metadata.totalSupply).to.equal(totalSupply);
    });

    it("Should not allow a user without CREATOR_ROLE to launch a token", async function () {
      const tokenAddress = mockToken.target;
      const name = "MockToken";
      const symbol = "MTK";
      const totalSupply = 1000;

      await expect(tokenManagerCore.connect(addr1).launchToken(tokenAddress, name, symbol, totalSupply))
        .to.be.revertedWithCustomError(tokenManagerCore, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow launching a token with zero address", async function () {
      const tokenAddress = ethers.ZeroAddress;
      const name = "MockToken";
      const symbol = "MTK";
      const totalSupply = 1000;

      await expect(tokenManagerCore.launchToken(tokenAddress, name, symbol, totalSupply))
        .to.be.revertedWithCustomError(tokenManagerCore, "TokenAddressCannotBeZero");
    });

    it("Should not allow launching an already launched token", async function () {
      const tokenAddress = mockToken.target;
      const name = "MockToken";
      const symbol = "MTK";
      const totalSupply = 1000;

      await tokenManagerCore.launchToken(tokenAddress, name, symbol, totalSupply);

      await expect(tokenManagerCore.launchToken(tokenAddress, name, symbol, totalSupply))
        .to.be.revertedWithCustomError(tokenManagerCore, "TokenAlreadyLaunched");
    });
  });

  describe("updateProtocolConfig", function () {
    let tokenManagerCore;
    let owner;
    let addr1;

    beforeEach(async function () {
      [owner, addr1] = await ethers.getSigners();
      const TokenManagerCore = await ethers.getContractFactory("TokenManagerCore");
      tokenManagerCore = await TokenManagerCore.deploy(owner.address, 100);
      await tokenManagerCore.waitForDeployment();
      // Grant DAO_GOVERNOR_ROLE to owner for testing updateProtocolConfig function
      await tokenManagerCore.grantRole(await tokenManagerCore.DAO_GOVERNOR_ROLE(), owner.address);
    });

    it("Should allow DAO_GOVERNOR_ROLE to update protocol config and emit event", async function () {
      const newFeeWallet = addr1.address;
      const newProtocolFee = 200; // 2%

      await expect(tokenManagerCore.updateProtocolConfig(newFeeWallet, newProtocolFee))
        .to.emit(tokenManagerCore, "ProtocolConfigUpdated")
        .withArgs(newFeeWallet, newProtocolFee, owner.address);

      const config = await tokenManagerCore.protocolConfig();
      expect(config.feeWallet).to.equal(newFeeWallet);
      expect(config.protocolFee).to.equal(newProtocolFee);
    });

    it("Should not allow non-admin to update protocol config", async function () {
      const newFeeWallet = addr1.address;
      const newProtocolFee = 200;

      await expect(tokenManagerCore.connect(addr1).updateProtocolConfig(newFeeWallet, newProtocolFee))
        .to.be.revertedWithCustomError(tokenManagerCore, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow zero address as fee wallet", async function () {
      const newFeeWallet = ethers.ZeroAddress;
      const newProtocolFee = 200;

      await expect(tokenManagerCore.updateProtocolConfig(newFeeWallet, newProtocolFee))
        .to.be.revertedWithCustomError(tokenManagerCore, "FeeWalletCannotBeZero");
    });

    it("Should emit ProtocolConfigUpdated event on successful update", async function () {
      const newFeeWallet = addr1.address;
      const newProtocolFee = 300;
      await expect(tokenManagerCore.updateProtocolConfig(newFeeWallet, newProtocolFee))
        .to.emit(tokenManagerCore, "ProtocolConfigUpdated")
        .withArgs(newFeeWallet, newProtocolFee, owner.address);
    });

    it("Should not allow protocol fee exceeding maximum", async function () {
      const newFeeWallet = addr1.address;
      const newProtocolFee = (await tokenManagerCore.MAX_PROTOCOL_FEE()) + 1n; // Exceeds MAX_PROTOCOL_FEE

      await expect(tokenManagerCore.updateProtocolConfig(newFeeWallet, newProtocolFee))
        .to.be.revertedWithCustomError(tokenManagerCore, "ProtocolFeeExceedsMaximum");
    });
  });

  describe("pause/unpause", function () {
    let tokenManagerCore;
    let owner;
    let addr1;

    beforeEach(async function () {
      [owner, addr1] = await ethers.getSigners();
      const TokenManagerCore = await ethers.getContractFactory("TokenManagerCore");
      tokenManagerCore = await TokenManagerCore.deploy(owner.address, 100);
      await tokenManagerCore.waitForDeployment();
    });

    it("Should allow PAUSER_ROLE to pause the contract", async function () {
      await tokenManagerCore.grantRole(await tokenManagerCore.PAUSER_ROLE(), owner.address);
      await expect(tokenManagerCore.pause())
        .to.emit(tokenManagerCore, "Paused")
        .withArgs(owner.address);
      expect(await tokenManagerCore.paused()).to.be.true;
    });

    it("Should allow PAUSER_ROLE to unpause the contract", async function () {
      await tokenManagerCore.grantRole(await tokenManagerCore.PAUSER_ROLE(), owner.address);
      await tokenManagerCore.pause();
      await expect(tokenManagerCore.unpause())
        .to.emit(tokenManagerCore, "Unpaused")
        .withArgs(owner.address);
      expect(await tokenManagerCore.paused()).to.be.false;
    });

    it("Should not allow non-PAUSER_ROLE to pause the contract", async function () {
      await expect(tokenManagerCore.connect(addr1).pause())
        .to.be.revertedWithCustomError(tokenManagerCore, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow non-PAUSER_ROLE to unpause the contract", async function () {
      await tokenManagerCore.grantRole(await tokenManagerCore.PAUSER_ROLE(), owner.address);
      await tokenManagerCore.pause();
      await expect(tokenManagerCore.connect(addr1).unpause())
        .to.be.revertedWithCustomError(tokenManagerCore, "AccessControlUnauthorizedAccount");
    });
  });

  describe("view functions", function () {
    let tokenManagerCore;
    let owner;
    let mockToken1;
    let mockToken2;

    beforeEach(async function () {
      [owner] = await ethers.getSigners();
      const TokenManagerCore = await ethers.getContractFactory("TokenManagerCore");
      tokenManagerCore = await TokenManagerCore.deploy(owner.address, 100);
      await tokenManagerCore.waitForDeployment();

      // Grant CREATOR_ROLE to owner
      await tokenManagerCore.grantRole(await tokenManagerCore.CREATOR_ROLE(), owner.address);

      // Deploy mock tokens
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockToken1 = await MockERC20.deploy("MockToken1", "MTK1");
      await mockToken1.waitForDeployment();
      mockToken2 = await MockERC20.deploy("MockToken2", "MTK2");
      await mockToken2.waitForDeployment();
    });

    it("launchedTokensCount should return the correct count", async function () {
      expect(await tokenManagerCore.launchedTokensCount()).to.equal(0);

      await tokenManagerCore.launchToken(mockToken1.target, "MockToken1", "MTK1", 1000);
      expect(await tokenManagerCore.launchedTokensCount()).to.equal(1);

      await tokenManagerCore.launchToken(mockToken2.target, "MockToken2", "MTK2", 1000);
      expect(await tokenManagerCore.launchedTokensCount()).to.equal(2);
    });

    it("getTokenAtIndex should return the correct token address", async function () {
      await tokenManagerCore.launchToken(mockToken1.target, "MockToken1", "MTK1", 1000);
      await tokenManagerCore.launchToken(mockToken2.target, "MockToken2", "MTK2", 1000);

      expect(await tokenManagerCore.getTokenAtIndex(0)).to.equal(mockToken1.target);
      expect(await tokenManagerCore.getTokenAtIndex(1)).to.equal(mockToken2.target);

      await expect(tokenManagerCore.getTokenAtIndex(2)).to.be.revertedWithCustomError(tokenManagerCore, "IndexOutOfBounds"); // Index out of bounds
    });

    it("isTokenLaunched should return true for launched tokens and false otherwise", async function () {
      expect(await tokenManagerCore.isTokenLaunched(mockToken1.target)).to.be.false;

      await tokenManagerCore.launchToken(mockToken1.target, "MockToken1", "MTK1", 1000);
      expect(await tokenManagerCore.isTokenLaunched(mockToken1.target)).to.be.true;
      expect(await tokenManagerCore.isTokenLaunched(mockToken2.target)).to.be.false;
    });

    it("Should not emit event when updating token status with the same value", async function () {
      await tokenManagerCore.launchToken(mockToken1.target, "MockToken1", "MTK1", 1000);
      await tokenManagerCore.updateTokenStatus(mockToken1.target, false);

      await expect(tokenManagerCore.updateTokenStatus(mockToken1.target, false))
        .to.not.emit(tokenManagerCore, "TokenStatusUpdated");
    });

    it("Should revert when getTokenByCreatorAtIndex is called with an out-of-bounds index", async function () {
      await tokenManagerCore.launchToken(mockToken1.target, "MockToken1", "MTK1", 1000);
      await expect(tokenManagerCore.getTokenByCreatorAtIndex(owner.address, 1))
        .to.be.revertedWithCustomError(tokenManagerCore, "IndexOutOfBounds");
    });

    it("Should return tokens by creator", async function () {
      await tokenManagerCore.launchToken(mockToken1.target, "MockToken1", "MTK1", 1000);
      const tokens = await tokenManagerCore.getTokensByCreator(owner.address);
      expect(tokens).to.deep.equal([mockToken1.target]);
    });

    it("Should return all launched tokens", async function () {
      await tokenManagerCore.launchToken(mockToken1.target, "MockToken1", "MTK1", 1000);
      await tokenManagerCore.launchToken(mockToken2.target, "MockToken2", "MTK2", 1000);
      const allTokens = await tokenManagerCore.getAllTokens();
      expect(allTokens).to.deep.equal([mockToken1.target, mockToken2.target]);
    });
  });

  describe("updateTokenStatus", function () {
    let tokenManagerCore;
    let owner;
    let mockToken;

    beforeEach(async function () {
      [owner] = await ethers.getSigners();
      const TokenManagerCore = await ethers.getContractFactory("TokenManagerCore");
      tokenManagerCore = await TokenManagerCore.deploy(owner.address, 100);
      await tokenManagerCore.waitForDeployment();

      // Grant DEFAULT_ADMIN_ROLE to owner
      await tokenManagerCore.grantRole(await tokenManagerCore.DEFAULT_ADMIN_ROLE(), owner.address);
      // Grant CREATOR_ROLE to owner
      await tokenManagerCore.grantRole(await tokenManagerCore.CREATOR_ROLE(), owner.address);

      // Deploy a mock token
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockToken = await MockERC20.deploy("MockToken", "MTK");
      await mockToken.waitForDeployment();

      // Launch the token first
      await tokenManagerCore.launchToken(mockToken.target, "MockToken", "MTK", 1000);
    });

    it("Should not emit event when updating token status with the same value", async function () {
      // Token is active by default, so setting it to true again should not emit an event
      await expect(tokenManagerCore.updateTokenStatus(mockToken.target, true))
        .to.not.emit(tokenManagerCore, "TokenStatusUpdated");

      // Set to false, then try to set to false again
      await tokenManagerCore.updateTokenStatus(mockToken.target, false);
      await expect(tokenManagerCore.updateTokenStatus(mockToken.target, false))
        .to.not.emit(tokenManagerCore, "TokenStatusUpdated");
    });

    it("Should revert if token is not launched", async function () {
      const unlaunchedTokenAddress = ethers.Wallet.createRandom().address;
      await expect(tokenManagerCore.updateTokenStatus(unlaunchedTokenAddress, true))
        .to.be.revertedWithCustomError(tokenManagerCore, "TokenNotLaunched");
    });

    it("Should allow DEFAULT_ADMIN_ROLE to update token status", async function () {
      await expect(tokenManagerCore.updateTokenStatus(mockToken.target, false))
        .to.emit(tokenManagerCore, "TokenStatusUpdated")
        .withArgs(mockToken.target, false, owner.address);
      expect((await tokenManagerCore.tokenMetadata(mockToken.target)).isActive).to.be.false;

      await expect(tokenManagerCore.updateTokenStatus(mockToken.target, true))
        .to.emit(tokenManagerCore, "TokenStatusUpdated")
        .withArgs(mockToken.target, true, owner.address);
      expect((await tokenManagerCore.tokenMetadata(mockToken.target)).isActive).to.be.true;
    });

    it("Should not allow non-admin to update token status", async function () {
      await expect(tokenManagerCore.connect(addr1).updateTokenStatus(mockToken.target, false))
        .to.be.revertedWithCustomError(tokenManagerCore, "AccessControlUnauthorizedAccount");
    });

    it("Should revert when paused", async function () {
      await tokenManagerCore.pause();
      await expect(tokenManagerCore.updateTokenStatus(mockToken.target, false))
        .to.be.revertedWithCustomError(tokenManagerCore, "EnforcedPause");
    });
  });
});
