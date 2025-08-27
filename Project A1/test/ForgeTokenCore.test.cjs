const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ForgeTokenCore", function () {
  let forgeTokenCore;
  let owner, minter, burner, pauser, feeManager, utilityManager, user1, user2;

  beforeEach(async function () {
    [owner, minter, burner, pauser, feeManager, utilityManager, user1, user2] = await ethers.getSigners();

    const ForgeTokenCore = await ethers.getContractFactory("ForgeTokenCore");
    forgeTokenCore = await upgrades.deployProxy(ForgeTokenCore, [], { initializer: 'initialize' });
    await forgeTokenCore.waitForDeployment();
    
    // Grant additional roles
    const MINTER_ROLE = await forgeTokenCore.MINTER_ROLE();
    const BURNER_ROLE = await forgeTokenCore.BURNER_ROLE();
    const PAUSER_ROLE = await forgeTokenCore.PAUSER_ROLE();
    const FEE_MANAGER_ROLE = await forgeTokenCore.FEE_MANAGER_ROLE();
    
    await forgeTokenCore.grantRole(MINTER_ROLE, minter.address);
    await forgeTokenCore.grantRole(BURNER_ROLE, burner.address);
    await forgeTokenCore.grantRole(PAUSER_ROLE, pauser.address);
    await forgeTokenCore.grantRole(FEE_MANAGER_ROLE, feeManager.address);
  });

  describe("Deployment and Initialization", function () {
    it("Should have correct token details", async function () {
      expect(await forgeTokenCore.name()).to.equal("Forge Token");
      expect(await forgeTokenCore.symbol()).to.equal("FORGE");
      expect(await forgeTokenCore.decimals()).to.equal(18);
    });

    it("Should mint initial supply to deployer", async function () {
      const initialSupply = ethers.parseEther("100000000"); // 100M tokens
      expect(await forgeTokenCore.balanceOf(owner.address)).to.equal(initialSupply);
      expect(await forgeTokenCore.totalSupply()).to.equal(initialSupply);
    });

    it("Should grant all roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await forgeTokenCore.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await forgeTokenCore.MINTER_ROLE();
      const BURNER_ROLE = await forgeTokenCore.BURNER_ROLE();
      const PAUSER_ROLE = await forgeTokenCore.PAUSER_ROLE();
      const FEE_MANAGER_ROLE = await forgeTokenCore.FEE_MANAGER_ROLE();
      
      expect(await forgeTokenCore.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await forgeTokenCore.hasRole(MINTER_ROLE, owner.address)).to.be.true;
      expect(await forgeTokenCore.hasRole(BURNER_ROLE, owner.address)).to.be.true;
      expect(await forgeTokenCore.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
      expect(await forgeTokenCore.hasRole(FEE_MANAGER_ROLE, owner.address)).to.be.true;
    });

    it("Should exclude deployer and contract from fees and limits", async function () {
      expect(await forgeTokenCore.isExcludedFromFees(owner.address)).to.be.true;
      expect(await forgeTokenCore.isExcludedFromLimits(owner.address)).to.be.true;
      expect(await forgeTokenCore.isExcludedFromFees(forgeTokenCore.target)).to.be.true;
      expect(await forgeTokenCore.isExcludedFromLimits(forgeTokenCore.target)).to.be.true;
    });

    it("Should set correct constants", async function () {
      expect(await forgeTokenCore.MAX_SUPPLY()).to.equal(ethers.parseEther("1000000000")); // 1B
      expect(await forgeTokenCore.INITIAL_SUPPLY()).to.equal(ethers.parseEther("100000000")); // 100M
      expect(await forgeTokenCore.MAX_DAILY_MINT()).to.equal(ethers.parseEther("10000000")); // 10M
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(forgeTokenCore.connect(minter).mint(user1.address, mintAmount))
        .to.emit(forgeTokenCore, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, mintAmount);
      
      expect(await forgeTokenCore.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should not allow non-minter to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(forgeTokenCore.connect(user1).mint(user2.address, mintAmount))
        .to.be.reverted;
    });

    it("Should enforce max supply limit", async function () {
      const maxSupply = await forgeTokenCore.MAX_SUPPLY();
      const initialSupply = await forgeTokenCore.INITIAL_SUPPLY();
      const excessAmount = maxSupply - initialSupply + ethers.parseEther("1");
      
      await expect(forgeTokenCore.connect(minter).mint(user1.address, excessAmount))
        .to.be.revertedWithCustomError(forgeTokenCore, "ExceedsMaxSupply");
    });

    it("Should enforce daily mint limit", async function () {
      const maxDailyMint = await forgeTokenCore.MAX_DAILY_MINT();
      const excessAmount = maxDailyMint + ethers.parseEther("1");
      
      await expect(forgeTokenCore.connect(minter).mint(user1.address, excessAmount))
        .to.be.revertedWithCustomError(forgeTokenCore, "DailyMintLimitExceeded");
    });

    it("Should track daily mint amounts", async function () {
      const mintAmount = ethers.parseEther("1000");
      const today = await forgeTokenCore.getCurrentDay();
      
      await forgeTokenCore.connect(minter).mint(user1.address, mintAmount);
      
      expect(await forgeTokenCore.getDailyMintAmount(today)).to.equal(mintAmount);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Transfer some tokens to user1 for burning tests
      await forgeTokenCore.transfer(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow token holder to burn own tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialBalance = await forgeTokenCore.balanceOf(user1.address);
      
      await expect(forgeTokenCore.connect(user1).burn(burnAmount))
        .to.emit(forgeTokenCore, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);
      
      expect(await forgeTokenCore.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should allow burner role to burn from any address", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialBalance = await forgeTokenCore.balanceOf(user1.address);
      
      // First approve burner to spend tokens
      await forgeTokenCore.connect(user1).approve(burner.address, burnAmount);
      
      await expect(forgeTokenCore.connect(burner).burnFrom(user1.address, burnAmount))
        .to.emit(forgeTokenCore, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);
      
      expect(await forgeTokenCore.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should not allow non-burner to burn from other addresses", async function () {
      const burnAmount = ethers.parseEther("100");
      
      await forgeTokenCore.connect(user1).approve(user2.address, burnAmount);
      
      await expect(forgeTokenCore.connect(user2).burnFrom(user1.address, burnAmount))
        .to.be.reverted;
    });
  });

  describe("Trading Control", function () {
    it("Should start with trading disabled", async function () {
      expect(await forgeTokenCore.tradingEnabled()).to.be.false;
    });

    it("Should allow admin to enable trading", async function () {
      await expect(forgeTokenCore.setTradingEnabled(true))
        .to.emit(forgeTokenCore, "TradingEnabled");
      
      expect(await forgeTokenCore.tradingEnabled()).to.be.true;
    });

    it("Should not allow non-admin to enable trading", async function () {
      await expect(forgeTokenCore.connect(user1).setTradingEnabled(true))
        .to.be.reverted;
    });

    it("Should block transfers when trading disabled for non-excluded users", async function () {
      await forgeTokenCore.transfer(user1.address, ethers.parseEther("1000"));
      
      await expect(forgeTokenCore.connect(user1).transfer(user2.address, ethers.parseEther("100")))
        .to.be.revertedWithCustomError(forgeTokenCore, "TradingNotEnabled");
    });

    it("Should allow transfers for excluded addresses even when trading disabled", async function () {
      const transferAmount = ethers.parseEther("100");
      
      await expect(forgeTokenCore.transfer(user1.address, transferAmount))
        .to.not.be.reverted;
    });
  });

  describe("Manager System", function () {
    it("Should allow admin to set fee manager", async function () {
      await expect(forgeTokenCore.setManager("fee", feeManager.address))
        .to.emit(forgeTokenCore, "ManagerUpdated")
        .withArgs("fee", ethers.ZeroAddress, feeManager.address);
      
      expect(await forgeTokenCore.feeManager()).to.equal(feeManager.address);
    });

    it("Should allow admin to set utility manager", async function () {
      await expect(forgeTokenCore.setManager("utility", utilityManager.address))
        .to.emit(forgeTokenCore, "ManagerUpdated")
        .withArgs("utility", ethers.ZeroAddress, utilityManager.address);
      
      expect(await forgeTokenCore.utilityManager()).to.equal(utilityManager.address);
    });

    it("Should revert for invalid manager type", async function () {
      await expect(forgeTokenCore.setManager("invalid", user1.address))
        .to.be.revertedWithCustomError(forgeTokenCore, "InvalidManager");
    });

    it("Should return manager addresses", async function () {
      await forgeTokenCore.setManager("fee", feeManager.address);
      await forgeTokenCore.setManager("utility", utilityManager.address);
      
      const [feeManagerAddr, utilityManagerAddr] = await forgeTokenCore.getManagers();
      expect(feeManagerAddr).to.equal(feeManager.address);
      expect(utilityManagerAddr).to.equal(utilityManager.address);
    });
  });

  describe("Address Flags", function () {
    it("Should allow admin to set address flags", async function () {
      await expect(forgeTokenCore.setAddressFlags(user1.address, 7)) // All flags
        .to.emit(forgeTokenCore, "FlagsUpdated")
        .withArgs(user1.address, 7);
      
      expect(await forgeTokenCore.addressFlags(user1.address)).to.equal(7);
    });

    it("Should allow managers to set address flags", async function () {
      await forgeTokenCore.setManager("fee", feeManager.address);
      
      await expect(forgeTokenCore.connect(feeManager).setAddressFlags(user1.address, 1))
        .to.emit(forgeTokenCore, "FlagsUpdated")
        .withArgs(user1.address, 1);
    });

    it("Should not allow unauthorized addresses to set flags", async function () {
      await expect(forgeTokenCore.connect(user1).setAddressFlags(user2.address, 1))
        .to.be.revertedWithCustomError(forgeTokenCore, "UnauthorizedManager");
    });

    it("Should correctly identify excluded from fees", async function () {
      await forgeTokenCore.setAddressFlags(user1.address, 1); // Bit 0 set
      expect(await forgeTokenCore.isExcludedFromFees(user1.address)).to.be.true;
      
      await forgeTokenCore.setAddressFlags(user2.address, 0); // No flags
      expect(await forgeTokenCore.isExcludedFromFees(user2.address)).to.be.false;
    });

    it("Should correctly identify excluded from limits", async function () {
      await forgeTokenCore.setAddressFlags(user1.address, 2); // Bit 1 set
      expect(await forgeTokenCore.isExcludedFromLimits(user1.address)).to.be.true;
      
      await forgeTokenCore.setAddressFlags(user2.address, 0); // No flags
      expect(await forgeTokenCore.isExcludedFromLimits(user2.address)).to.be.false;
    });

    it("Should correctly identify blacklisted addresses", async function () {
      await forgeTokenCore.setAddressFlags(user1.address, 4); // Bit 2 set
      expect(await forgeTokenCore.isBlacklisted(user1.address)).to.be.true;
      
      await forgeTokenCore.setAddressFlags(user2.address, 0); // No flags
      expect(await forgeTokenCore.isBlacklisted(user2.address)).to.be.false;
    });
  });

  describe("Blacklist Functionality", function () {
    beforeEach(async function () {
      await forgeTokenCore.setTradingEnabled(true);
      await forgeTokenCore.transfer(user1.address, ethers.parseEther("1000"));
    });

    it("Should block transfers from blacklisted addresses", async function () {
      await forgeTokenCore.setAddressFlags(user1.address, 4); // Blacklist user1
      
      await expect(forgeTokenCore.connect(user1).transfer(user2.address, ethers.parseEther("100")))
        .to.be.revertedWithCustomError(forgeTokenCore, "AccountBlacklisted");
    });

    it("Should block transfers to blacklisted addresses", async function () {
      await forgeTokenCore.setAddressFlags(user2.address, 4); // Blacklist user2
      
      await expect(forgeTokenCore.connect(user1).transfer(user2.address, ethers.parseEther("100")))
        .to.be.revertedWithCustomError(forgeTokenCore, "AccountBlacklisted");
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow pauser to pause transfers", async function () {
      await forgeTokenCore.connect(pauser).pause();
      expect(await forgeTokenCore.paused()).to.be.true;
    });

    it("Should allow pauser to unpause transfers", async function () {
      await forgeTokenCore.connect(pauser).pause();
      await forgeTokenCore.connect(pauser).unpause();
      expect(await forgeTokenCore.paused()).to.be.false;
    });

    it("Should block transfers when paused", async function () {
      await forgeTokenCore.connect(pauser).pause();
      
      await expect(forgeTokenCore.transfer(user1.address, ethers.parseEther("100")))
        .to.be.revertedWithCustomError(forgeTokenCore, "EnforcedPause");
    });

    it("Should not allow non-pauser to pause", async function () {
      await expect(forgeTokenCore.connect(user1).pause())
        .to.be.reverted;
    });
  });

  describe("ERC20 Permit", function () {
    it("Should support ERC20 permit functionality", async function () {
      const nonce = await forgeTokenCore.nonces(owner.address);
      expect(nonce).to.equal(0);
      
      // Test that permit domain is set up correctly
      expect(await forgeTokenCore.DOMAIN_SEPARATOR()).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("ERC20 Votes", function () {
    it("Should support voting functionality", async function () {
      // Delegate voting power to self
      await forgeTokenCore.delegate(owner.address);
      
      const votes = await forgeTokenCore.getVotes(owner.address);
      const balance = await forgeTokenCore.balanceOf(owner.address);
      expect(votes).to.equal(balance);
    });
  });

  describe("Utility Functions", function () {
    it("Should return correct current day", async function () {
      const currentDay = await forgeTokenCore.getCurrentDay();
      const latestBlock = await ethers.provider.getBlock('latest');
      const expectedDay = Math.floor(latestBlock.timestamp / 86400);
      
      // Allow for small time differences
      expect(currentDay).to.be.closeTo(expectedDay, 1);
    });

    it("Should return daily mint amount for specific day", async function () {
      const mintAmount = ethers.parseEther("1000");
      const today = await forgeTokenCore.getCurrentDay();
      
      await forgeTokenCore.connect(minter).mint(user1.address, mintAmount);
      
      expect(await forgeTokenCore.getDailyMintAmount(today)).to.equal(mintAmount);
      expect(await forgeTokenCore.getDailyMintAmount(today + 1n)).to.equal(0);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple mints in same day correctly", async function () {
      const mintAmount1 = ethers.parseEther("1000");
      const mintAmount2 = ethers.parseEther("500");
      const today = await forgeTokenCore.getCurrentDay();
      
      await forgeTokenCore.connect(minter).mint(user1.address, mintAmount1);
      await forgeTokenCore.connect(minter).mint(user2.address, mintAmount2);
      
      expect(await forgeTokenCore.getDailyMintAmount(today)).to.equal(mintAmount1 + mintAmount2);
    });

    it("Should handle flag combinations correctly", async function () {
      // Set multiple flags (excluded from fees + excluded from limits + blacklisted)
      await forgeTokenCore.setAddressFlags(user1.address, 7);
      
      expect(await forgeTokenCore.isExcludedFromFees(user1.address)).to.be.true;
      expect(await forgeTokenCore.isExcludedFromLimits(user1.address)).to.be.true;
      expect(await forgeTokenCore.isBlacklisted(user1.address)).to.be.true;
    });

    it("Should handle zero address in manager updates", async function () {
      await forgeTokenCore.setManager("fee", feeManager.address);
      
      // Should allow setting manager to zero address (removing manager)
      await expect(forgeTokenCore.setManager("fee", ethers.ZeroAddress))
        .to.emit(forgeTokenCore, "ManagerUpdated")
        .withArgs("fee", feeManager.address, ethers.ZeroAddress);
    });
  });
});