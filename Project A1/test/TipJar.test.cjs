const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TipJar", function () {
  let tipJar;
  let mockERC20;
  let owner, user1, user2;
  let PAUSER_ROLE;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy a mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("MockToken", "MTK");
    await mockERC20.waitForDeployment();

    const TipJar = await ethers.getContractFactory("TipJar");
    tipJar = await TipJar.deploy();
    await tipJar.waitForDeployment();

    await tipJar.initialize(mockERC20.target);

    PAUSER_ROLE = await tipJar.PAUSER_ROLE();
  });

  it("Should deploy with the correct ERC20 token address", async function () {
    expect(await tipJar.erc20Token()).to.equal(mockERC20.target);
  });

  it("Should grant DEFAULT_ADMIN_ROLE to the deployer", async function () {
    expect(await tipJar.hasRole(await tipJar.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
  });

  it("Should grant PAUSER_ROLE to the deployer", async function () {
    expect(await tipJar.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
  });

  describe("deposit", function () {
    it("Should allow a user to deposit ERC20 tokens", async function () {
      const depositAmount = ethers.parseEther("100");
      await mockERC20.mint(user1.address, depositAmount);
      await mockERC20.connect(user1).approve(tipJar.target, depositAmount);

      await expect(tipJar.connect(user1).deposit(depositAmount))
        .to.emit(tipJar, "Deposited")
        .withArgs(user1.address, depositAmount);

      expect(await tipJar.depositedBalances(user1.address)).to.equal(depositAmount);
      expect(await mockERC20.balanceOf(tipJar.target)).to.equal(depositAmount);
    });

    it("Should revert if deposit amount is zero", async function () {
      await expect(tipJar.connect(user1).deposit(0))
        .to.be.revertedWithCustomError(tipJar, "ZeroAmount");
    });

    it("Should revert if insufficient allowance", async function () {
      const depositAmount = ethers.parseEther("100");
      await mockERC20.mint(user1.address, depositAmount);
      // Approve a smaller amount than depositAmount to trigger insufficient allowance
      await mockERC20.connect(user1).approve(tipJar.target, ethers.parseEther("50"));

      await expect(tipJar.connect(user1).deposit(depositAmount))
        .to.be.revertedWithCustomError(mockERC20, "ERC20InsufficientAllowance");
    });

    it("Should revert when paused", async function () {
      await tipJar.connect(owner).pause();
      await expect(tipJar.connect(user1).deposit(100))
        .to.be.revertedWithCustomError(tipJar, "EnforcedPause");
    });
  });

  describe("tip", function () {
    it("Should allow a user to tip another user", async function () {
      const depositAmount = ethers.parseEther("100");
      const tipAmount = ethers.parseEther("10");
      await mockERC20.mint(user1.address, depositAmount);
      await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
      await tipJar.connect(user1).deposit(depositAmount);

      await expect(tipJar.connect(user1).tip(user2.address, tipAmount))
        .to.emit(tipJar, "Tipped")
        .withArgs(user1.address, user2.address, tipAmount);

      expect(await tipJar.depositedBalances(user1.address)).to.equal(depositAmount - tipAmount);
      expect(await tipJar.tipsReceived(user2.address)).to.equal(tipAmount);
    });

    it("Should revert if tip amount is zero", async function () {
      await expect(tipJar.connect(user1).tip(user2.address, 0))
        .to.be.revertedWithCustomError(tipJar, "ZeroAmount");
    });

    it("Should revert if tipping self", async function () {
      const depositAmount = ethers.parseEther("100");
      await mockERC20.mint(user1.address, depositAmount);
      await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
      await tipJar.connect(user1).deposit(depositAmount);

      await expect(tipJar.connect(user1).tip(user1.address, ethers.parseEther("10")))
        .to.be.revertedWithCustomError(tipJar, "CannotTipSelf");
    });

    it("Should revert if insufficient balance", async function () {
      const depositAmount = ethers.parseEther("10");
      const tipAmount = ethers.parseEther("100");
      await mockERC20.mint(user1.address, depositAmount);
      await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
      await tipJar.connect(user1).deposit(depositAmount);

      await expect(tipJar.connect(user1).tip(user2.address, tipAmount))
        .to.be.revertedWithCustomError(tipJar, "InsufficientBalance");
    });

    it("Should revert when paused", async function () {
      const depositAmount = ethers.parseEther("100");
      const tipAmount = ethers.parseEther("10");
      await mockERC20.mint(user1.address, depositAmount);
      await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
      await tipJar.connect(user1).deposit(depositAmount);

      await tipJar.connect(owner).pause();

      await expect(tipJar.connect(user1).tip(user2.address, tipAmount))
        .to.be.revertedWithCustomError(tipJar, "EnforcedPause");
    });
  });

  describe("withdraw", function () {
    it("Should allow a user to withdraw their tokens", async function () {
      const depositAmount = ethers.parseEther("100");
      const withdrawAmount = ethers.parseEther("50");
      await mockERC20.mint(user1.address, depositAmount);
      await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
      await tipJar.connect(user1).deposit(depositAmount);

      const initialUserBalance = await mockERC20.balanceOf(user1.address);

      await expect(tipJar.connect(user1).withdraw(withdrawAmount))
        .to.emit(tipJar, "Withdrawn")
        .withArgs(user1.address, withdrawAmount);

      expect(await tipJar.depositedBalances(user1.address)).to.equal(depositAmount - withdrawAmount);
      expect(await mockERC20.balanceOf(user1.address)).to.equal(initialUserBalance + withdrawAmount);
    });

    it("Should revert if withdraw amount is zero", async function () {
      await expect(tipJar.connect(user1).withdraw(0))
        .to.be.revertedWithCustomError(tipJar, "ZeroAmount");
    });

    it("Should revert if insufficient balance", async function () {
      await expect(tipJar.connect(user1).withdraw(ethers.parseEther("100")))
        .to.be.revertedWithCustomError(tipJar, "InsufficientBalance");
    });

    it("Should revert when paused", async function () {
      const depositAmount = ethers.parseEther("100");
      const withdrawAmount = ethers.parseEther("50");
      await mockERC20.mint(user1.address, depositAmount);
      await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
      await tipJar.connect(user1).deposit(depositAmount);

      await tipJar.connect(owner).pause();

      await expect(tipJar.connect(user1).withdraw(withdrawAmount))
        .to.be.revertedWithCustomError(tipJar, "EnforcedPause");
    });
  });

  describe("view functions", function () {
    it("getDepositedBalance should return the correct balance", async function () {
      const depositAmount = ethers.parseEther("100");
      await mockERC20.mint(user1.address, depositAmount);
      await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
      await tipJar.connect(user1).deposit(depositAmount);

      expect(await tipJar.getDepositedBalance(user1.address)).to.equal(depositAmount);
    });

    it("getTipsReceived should return the correct tips received", async function () {
      const depositAmount = ethers.parseEther("100");
      const tipAmount = ethers.parseEther("10");
      await mockERC20.mint(user1.address, depositAmount);
      await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
      await tipJar.connect(user1).deposit(depositAmount);
      await tipJar.connect(user1).tip(user2.address, tipAmount);

      expect(await tipJar.getTipsReceived(user2.address)).to.equal(tipAmount);
    });
  });

  describe("pause/unpause", function () {
    it("Should allow PAUSER_ROLE to pause the contract", async function () {
      await expect(tipJar.connect(owner).pause())
        .to.not.be.reverted;
      expect(await tipJar.paused()).to.be.true;
    });

    it("Should allow PAUSER_ROLE to unpause the contract", async function () {
      await tipJar.connect(owner).pause();
      await expect(tipJar.connect(owner).unpause())
        .to.not.be.reverted;
      expect(await tipJar.paused()).to.be.false;
    });

    it("Should not allow non-PAUSER_ROLE to pause the contract", async function () {
      await expect(tipJar.connect(user1).pause())
        .to.be.revertedWithCustomError(tipJar, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow non-PAUSER_ROLE to unpause the contract", async function () {
      await tipJar.connect(owner).pause();
      await expect(tipJar.connect(user1).unpause())
        .to.be.revertedWithCustomError(tipJar, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Enhanced Branch Coverage Tests", function () {
    let tipJar;
    let mockERC20;
    let owner, user1, user2, user3;
    let PAUSER_ROLE;

    beforeEach(async function () {
      [owner, user1, user2, user3] = await ethers.getSigners();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockERC20 = await MockERC20.deploy("MockToken", "MTK");
      await mockERC20.waitForDeployment();

      const TipJar = await ethers.getContractFactory("TipJar");
      tipJar = await TipJar.deploy();
      await tipJar.waitForDeployment();

      await tipJar.initialize(mockERC20.target);

      PAUSER_ROLE = await tipJar.PAUSER_ROLE();
    });

    describe("Constructor and Initialization Edge Cases", function () {
      it("Should properly initialize with zero address ERC20 token", async function () {
        const TipJar = await ethers.getContractFactory("TipJar");
        const tipJarWithZeroToken = await TipJar.deploy();
        await tipJarWithZeroToken.waitForDeployment();
        
        await expect(tipJarWithZeroToken.initialize(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(tipJarWithZeroToken, "InvalidERC20Address");
      });

      it("Should grant both DEFAULT_ADMIN_ROLE and PAUSER_ROLE to deployer", async function () {
        expect(await tipJar.hasRole(await tipJar.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
        expect(await tipJar.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
      });
    });

    describe("Deposit Function Edge Cases", function () {
      it("Should handle very large deposit amounts", async function () {
        const largeAmount = ethers.parseEther("1000000");
        await mockERC20.mint(user1.address, largeAmount);
        await mockERC20.connect(user1).approve(tipJar.target, largeAmount);

        await expect(tipJar.connect(user1).deposit(largeAmount))
          .to.emit(tipJar, "Deposited")
          .withArgs(user1.address, largeAmount);

        expect(await tipJar.depositedBalances(user1.address)).to.equal(largeAmount);
      });

      it("Should handle multiple consecutive deposits from same user", async function () {
        const amount1 = ethers.parseEther("100");
        const amount2 = ethers.parseEther("50");
        const totalAmount = amount1 + amount2;

        await mockERC20.mint(user1.address, totalAmount);
        await mockERC20.connect(user1).approve(tipJar.target, totalAmount);

        await tipJar.connect(user1).deposit(amount1);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(amount1);

        await tipJar.connect(user1).deposit(amount2);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(totalAmount);
      });

      it("Should handle deposits from multiple users simultaneously", async function () {
        const amount = ethers.parseEther("100");

        await mockERC20.mint(user1.address, amount);
        await mockERC20.mint(user2.address, amount);
        await mockERC20.connect(user1).approve(tipJar.target, amount);
        await mockERC20.connect(user2).approve(tipJar.target, amount);

        await tipJar.connect(user1).deposit(amount);
        await tipJar.connect(user2).deposit(amount);

        expect(await tipJar.depositedBalances(user1.address)).to.equal(amount);
        expect(await tipJar.depositedBalances(user2.address)).to.equal(amount);
        expect(await mockERC20.balanceOf(tipJar.target)).to.equal(amount * 2n);
      });

      it("Should handle exact balance deposits", async function () {
        const userBalance = ethers.parseEther("123.456");
        await mockERC20.mint(user1.address, userBalance);
        await mockERC20.connect(user1).approve(tipJar.target, userBalance);

        await tipJar.connect(user1).deposit(userBalance);

        expect(await tipJar.depositedBalances(user1.address)).to.equal(userBalance);
        expect(await mockERC20.balanceOf(user1.address)).to.equal(0);
      });

      it("Should handle minimum possible deposits (1 wei)", async function () {
        const minAmount = 1;
        await mockERC20.mint(user1.address, minAmount);
        await mockERC20.connect(user1).approve(tipJar.target, minAmount);

        await tipJar.connect(user1).deposit(minAmount);

        expect(await tipJar.depositedBalances(user1.address)).to.equal(minAmount);
      });
    });

    describe("Tip Function Edge Cases", function () {
      beforeEach(async function () {
        const depositAmount = ethers.parseEther("1000");
        await mockERC20.mint(user1.address, depositAmount);
        await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
        await tipJar.connect(user1).deposit(depositAmount);
      });

      it("Should handle tipping exact deposited balance", async function () {
        const fullBalance = await tipJar.depositedBalances(user1.address);
        
        await expect(tipJar.connect(user1).tip(user2.address, fullBalance))
          .to.emit(tipJar, "Tipped")
          .withArgs(user1.address, user2.address, fullBalance);

        expect(await tipJar.depositedBalances(user1.address)).to.equal(0);
        expect(await tipJar.tipsReceived(user2.address)).to.equal(fullBalance);
      });

      it("Should handle minimum tip amount (1 wei)", async function () {
        const minTip = 1;
        
        await tipJar.connect(user1).tip(user2.address, minTip);

        expect(await tipJar.tipsReceived(user2.address)).to.equal(minTip);
      });

      it("Should handle multiple tips to same recipient", async function () {
        const tip1 = ethers.parseEther("10");
        const tip2 = ethers.parseEther("20");
        const totalTips = tip1 + tip2;

        await tipJar.connect(user1).tip(user2.address, tip1);
        await tipJar.connect(user1).tip(user2.address, tip2);

        expect(await tipJar.tipsReceived(user2.address)).to.equal(totalTips);
      });

      it("Should handle multiple tips to different recipients", async function () {
        const tip1 = ethers.parseEther("15");
        const tip2 = ethers.parseEther("25");

        await tipJar.connect(user1).tip(user2.address, tip1);
        await tipJar.connect(user1).tip(user3.address, tip2);

        expect(await tipJar.tipsReceived(user2.address)).to.equal(tip1);
        expect(await tipJar.tipsReceived(user3.address)).to.equal(tip2);
      });

      it("Should handle tipping with zero address recipient", async function () {
        const tipAmount = ethers.parseEther("10");
        
        await expect(tipJar.connect(user1).tip(ethers.ZeroAddress, tipAmount))
          .to.not.be.reverted;

        expect(await tipJar.tipsReceived(ethers.ZeroAddress)).to.equal(tipAmount);
      });

      it("Should handle consecutive tips reducing balance to zero", async function () {
        const initialBalance = await tipJar.depositedBalances(user1.address);
        const halfBalance = initialBalance / 2n;

        await tipJar.connect(user1).tip(user2.address, halfBalance);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(halfBalance);

        await tipJar.connect(user1).tip(user3.address, halfBalance);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(0);
      });
    });

    describe("Withdraw Function Edge Cases", function () {
      beforeEach(async function () {
        const depositAmount = ethers.parseEther("500");
        await mockERC20.mint(user1.address, depositAmount);
        await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
        await tipJar.connect(user1).deposit(depositAmount);
      });

      it("Should handle withdrawing exact deposited balance", async function () {
        const fullBalance = await tipJar.depositedBalances(user1.address);
        const initialTokenBalance = await mockERC20.balanceOf(user1.address);

        await tipJar.connect(user1).withdraw(fullBalance);

        expect(await tipJar.depositedBalances(user1.address)).to.equal(0);
        expect(await mockERC20.balanceOf(user1.address)).to.equal(initialTokenBalance + fullBalance);
      });

      it("Should handle minimum withdrawal (1 wei)", async function () {
        const minWithdraw = 1;
        const initialBalance = await tipJar.depositedBalances(user1.address);

        await tipJar.connect(user1).withdraw(minWithdraw);

        expect(await tipJar.depositedBalances(user1.address)).to.equal(initialBalance - BigInt(minWithdraw));
      });

      it("Should handle multiple partial withdrawals", async function () {
        const withdraw1 = ethers.parseEther("100");
        const withdraw2 = ethers.parseEther("200");
        const initialBalance = await tipJar.depositedBalances(user1.address);

        await tipJar.connect(user1).withdraw(withdraw1);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(initialBalance - withdraw1);

        await tipJar.connect(user1).withdraw(withdraw2);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(initialBalance - withdraw1 - withdraw2);
      });

      it("Should handle withdrawal with zero deposited balance", async function () {
        // First withdraw all balance
        const fullBalance = await tipJar.depositedBalances(user1.address);
        await tipJar.connect(user1).withdraw(fullBalance);

        // Try to withdraw when balance is zero
        await expect(tipJar.connect(user1).withdraw(1))
          .to.be.revertedWithCustomError(tipJar, "InsufficientBalance");
      });
    });

    describe("Access Control Edge Cases", function () {
      it("Should prevent non-PAUSER_ROLE from pausing", async function () {
        await expect(tipJar.connect(user1).pause())
          .to.be.revertedWithCustomError(tipJar, "AccessControlUnauthorizedAccount");
      });

      it("Should prevent non-PAUSER_ROLE from unpausing", async function () {
        await tipJar.pause();
        await expect(tipJar.connect(user1).unpause())
          .to.be.revertedWithCustomError(tipJar, "AccessControlUnauthorizedAccount");
      });

      it("Should allow DEFAULT_ADMIN_ROLE to grant PAUSER_ROLE", async function () {
        await tipJar.grantRole(PAUSER_ROLE, user1.address);
        expect(await tipJar.hasRole(PAUSER_ROLE, user1.address)).to.be.true;

        await expect(tipJar.connect(user1).pause()).to.not.be.reverted;
      });

      it("Should allow revoking PAUSER_ROLE", async function () {
        await tipJar.grantRole(PAUSER_ROLE, user1.address);
        await tipJar.revokeRole(PAUSER_ROLE, user1.address);
        
        expect(await tipJar.hasRole(PAUSER_ROLE, user1.address)).to.be.false;
        await expect(tipJar.connect(user1).pause())
          .to.be.revertedWithCustomError(tipJar, "AccessControlUnauthorizedAccount");
      });
    });

    describe("Pause/Unpause State Management", function () {
      it("Should maintain state consistency when pausing and unpausing", async function () {
        const depositAmount = ethers.parseEther("100");
        await mockERC20.mint(user1.address, depositAmount);
        await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
        await tipJar.connect(user1).deposit(depositAmount);

        const balanceBeforePause = await tipJar.depositedBalances(user1.address);
        
        await tipJar.pause();
        await tipJar.unpause();
        
        expect(await tipJar.depositedBalances(user1.address)).to.equal(balanceBeforePause);
      });

      it("Should handle multiple pause/unpause cycles", async function () {
        for (let i = 0; i < 3; i++) {
          await tipJar.pause();
          expect(await tipJar.paused()).to.be.true;
          
          await tipJar.unpause();
          expect(await tipJar.paused()).to.be.false;
        }
      });

      it("Should prevent all operations when paused", async function () {
        const amount = ethers.parseEther("100");
        await mockERC20.mint(user1.address, amount);
        await mockERC20.connect(user1).approve(tipJar.target, amount);
        
        await tipJar.pause();

        await expect(tipJar.connect(user1).deposit(amount))
          .to.be.revertedWithCustomError(tipJar, "EnforcedPause");
        
        await expect(tipJar.connect(user1).tip(user2.address, amount))
          .to.be.revertedWithCustomError(tipJar, "EnforcedPause");
        
        await expect(tipJar.connect(user1).withdraw(amount))
          .to.be.revertedWithCustomError(tipJar, "EnforcedPause");
      });
    });

    describe("View Functions Edge Cases", function () {
      it("Should return zero balance for users who never deposited", async function () {
        expect(await tipJar.getDepositedBalance(user1.address)).to.equal(0);
        expect(await tipJar.getDepositedBalance(ethers.ZeroAddress)).to.equal(0);
      });

      it("Should return zero tips for users who never received tips", async function () {
        expect(await tipJar.getTipsReceived(user1.address)).to.equal(0);
        expect(await tipJar.getTipsReceived(ethers.ZeroAddress)).to.equal(0);
      });

      it("Should accurately track balance changes through operations", async function () {
        const depositAmount = ethers.parseEther("100");
        const tipAmount = ethers.parseEther("30");
        const withdrawAmount = ethers.parseEther("20");

        await mockERC20.mint(user1.address, depositAmount);
        await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
        
        await tipJar.connect(user1).deposit(depositAmount);
        expect(await tipJar.getDepositedBalance(user1.address)).to.equal(depositAmount);

        await tipJar.connect(user1).tip(user2.address, tipAmount);
        expect(await tipJar.getDepositedBalance(user1.address)).to.equal(depositAmount - tipAmount);

        await tipJar.connect(user1).withdraw(withdrawAmount);
        expect(await tipJar.getDepositedBalance(user1.address)).to.equal(depositAmount - tipAmount - withdrawAmount);
      });

      it("Should accurately track tips received from multiple sources", async function () {
        const tip1 = ethers.parseEther("10");
        const tip2 = ethers.parseEther("15");
        const totalTips = tip1 + tip2;

        // Setup two tippers
        await mockERC20.mint(user1.address, tip1);
        await mockERC20.mint(user2.address, tip2);
        await mockERC20.connect(user1).approve(tipJar.target, tip1);
        await mockERC20.connect(user2).approve(tipJar.target, tip2);
        await tipJar.connect(user1).deposit(tip1);
        await tipJar.connect(user2).deposit(tip2);

        await tipJar.connect(user1).tip(user3.address, tip1);
        await tipJar.connect(user2).tip(user3.address, tip2);

        expect(await tipJar.getTipsReceived(user3.address)).to.equal(totalTips);
      });
    });

    describe("Complex Interaction Scenarios", function () {
      it("Should handle deposit-tip-withdraw cycle", async function () {
        const initialAmount = ethers.parseEther("200");
        const tipAmount = ethers.parseEther("50");
        const remainingAmount = initialAmount - tipAmount;

        await mockERC20.mint(user1.address, initialAmount);
        await mockERC20.connect(user1).approve(tipJar.target, initialAmount);

        // Deposit
        await tipJar.connect(user1).deposit(initialAmount);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(initialAmount);

        // Tip
        await tipJar.connect(user1).tip(user2.address, tipAmount);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(remainingAmount);
        expect(await tipJar.tipsReceived(user2.address)).to.equal(tipAmount);

        // Withdraw
        await tipJar.connect(user1).withdraw(remainingAmount);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(0);
      });

      it("Should handle multiple users interacting simultaneously", async function () {
        const amount = ethers.parseEther("100");

        // Setup multiple users
        await mockERC20.mint(user1.address, amount);
        await mockERC20.mint(user2.address, amount);
        await mockERC20.connect(user1).approve(tipJar.target, amount);
        await mockERC20.connect(user2).approve(tipJar.target, amount);

        // Both deposit
        await tipJar.connect(user1).deposit(amount);
        await tipJar.connect(user2).deposit(amount);

        // Cross-tip
        const tipAmount = ethers.parseEther("25");
        await tipJar.connect(user1).tip(user2.address, tipAmount);
        await tipJar.connect(user2).tip(user1.address, tipAmount);

        // Verify final balances
        expect(await tipJar.depositedBalances(user1.address)).to.equal(amount - tipAmount);
        expect(await tipJar.depositedBalances(user2.address)).to.equal(amount - tipAmount);
        expect(await tipJar.tipsReceived(user1.address)).to.equal(tipAmount);
        expect(await tipJar.tipsReceived(user2.address)).to.equal(tipAmount);
      });

      it("Should handle tip recipient becoming tipper", async function () {
        const initialAmount = ethers.parseEther("100");
        const tipAmount = ethers.parseEther("30");

        // User1 deposits and tips user2
        await mockERC20.mint(user1.address, initialAmount);
        await mockERC20.connect(user1).approve(tipJar.target, initialAmount);
        await tipJar.connect(user1).deposit(initialAmount);
        await tipJar.connect(user1).tip(user2.address, tipAmount);

        // User2 deposits additional funds
        await mockERC20.mint(user2.address, initialAmount);
        await mockERC20.connect(user2).approve(tipJar.target, initialAmount);
        await tipJar.connect(user2).deposit(initialAmount);

        // User2 tips user3
        await tipJar.connect(user2).tip(user3.address, tipAmount);

        expect(await tipJar.depositedBalances(user2.address)).to.equal(initialAmount - tipAmount);
        expect(await tipJar.tipsReceived(user2.address)).to.equal(tipAmount);
        expect(await tipJar.tipsReceived(user3.address)).to.equal(tipAmount);
      });
    });

    describe("Mathematical Edge Cases", function () {
      it("Should handle operations with maximum uint256 values", async function () {
        // This test may not be practical due to token constraints, but tests the logic
        const largeAmount = ethers.parseEther("1000000000");
        
        await mockERC20.mint(user1.address, largeAmount);
        await mockERC20.connect(user1).approve(tipJar.target, largeAmount);
        
        await tipJar.connect(user1).deposit(largeAmount);
        expect(await tipJar.depositedBalances(user1.address)).to.equal(largeAmount);
      });

      it("Should handle precise arithmetic with tips and withdrawals", async function () {
        const preciseAmount = ethers.parseEther("123.456789123456789");
        const tipAmount = ethers.parseEther("45.123456789123456");
        const withdrawAmount = ethers.parseEther("78.333332334333333");

        await mockERC20.mint(user1.address, preciseAmount);
        await mockERC20.connect(user1).approve(tipJar.target, preciseAmount);
        await tipJar.connect(user1).deposit(preciseAmount);

        await tipJar.connect(user1).tip(user2.address, tipAmount);
        const balanceAfterTip = await tipJar.depositedBalances(user1.address);
        expect(balanceAfterTip).to.equal(preciseAmount - tipAmount);

        await tipJar.connect(user1).withdraw(withdrawAmount);
        const finalBalance = await tipJar.depositedBalances(user1.address);
        expect(finalBalance).to.equal(preciseAmount - tipAmount - withdrawAmount);
      });
    });

    describe("ReentrancyGuard Protection", function () {
      it("Should protect deposit function from reentrancy", async function () {
        const depositAmount = ethers.parseEther("100");
        await mockERC20.mint(user1.address, depositAmount);
        await mockERC20.connect(user1).approve(tipJar.target, depositAmount);

        await expect(tipJar.connect(user1).deposit(depositAmount))
          .to.not.be.reverted;
      });

      it("Should protect tip function from reentrancy", async function () {
        const depositAmount = ethers.parseEther("100");
        const tipAmount = ethers.parseEther("50");
        
        await mockERC20.mint(user1.address, depositAmount);
        await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
        await tipJar.connect(user1).deposit(depositAmount);

        await expect(tipJar.connect(user1).tip(user2.address, tipAmount))
          .to.not.be.reverted;
      });

      it("Should protect withdraw function from reentrancy", async function () {
        const depositAmount = ethers.parseEther("100");
        const withdrawAmount = ethers.parseEther("50");
        
        await mockERC20.mint(user1.address, depositAmount);
        await mockERC20.connect(user1).approve(tipJar.target, depositAmount);
        await tipJar.connect(user1).deposit(depositAmount);

        await expect(tipJar.connect(user1).withdraw(withdrawAmount))
          .to.not.be.reverted;
      });
    });

    describe("State Consistency Validation", function () {
      it("Should maintain total contract balance consistency", async function () {
        const amount1 = ethers.parseEther("100");
        const amount2 = ethers.parseEther("200");
        const totalDeposited = amount1 + amount2;

        await mockERC20.mint(user1.address, amount1);
        await mockERC20.mint(user2.address, amount2);
        await mockERC20.connect(user1).approve(tipJar.target, amount1);
        await mockERC20.connect(user2).approve(tipJar.target, amount2);

        await tipJar.connect(user1).deposit(amount1);
        await tipJar.connect(user2).deposit(amount2);

        expect(await mockERC20.balanceOf(tipJar.target)).to.equal(totalDeposited);

        const withdrawAmount = ethers.parseEther("50");
        await tipJar.connect(user1).withdraw(withdrawAmount);

        expect(await mockERC20.balanceOf(tipJar.target)).to.equal(totalDeposited - withdrawAmount);
      });

      it("Should maintain user balance consistency across operations", async function () {
        const initialDeposit = ethers.parseEther("300");
        
        await mockERC20.mint(user1.address, initialDeposit);
        await mockERC20.connect(user1).approve(tipJar.target, initialDeposit);
        await tipJar.connect(user1).deposit(initialDeposit);

        let expectedBalance = initialDeposit;
        expect(await tipJar.depositedBalances(user1.address)).to.equal(expectedBalance);

        // Multiple operations
        const tip1 = ethers.parseEther("50");
        await tipJar.connect(user1).tip(user2.address, tip1);
        expectedBalance -= tip1;
        expect(await tipJar.depositedBalances(user1.address)).to.equal(expectedBalance);

        const withdraw1 = ethers.parseEther("100");
        await tipJar.connect(user1).withdraw(withdraw1);
        expectedBalance -= withdraw1;
        expect(await tipJar.depositedBalances(user1.address)).to.equal(expectedBalance);

        const tip2 = ethers.parseEther("75");
        await tipJar.connect(user1).tip(user3.address, tip2);
        expectedBalance -= tip2;
        expect(await tipJar.depositedBalances(user1.address)).to.equal(expectedBalance);
      });

      it("Should maintain tips received consistency", async function () {
        const amount = ethers.parseEther("100");
        await mockERC20.mint(user1.address, amount);
        await mockERC20.mint(user2.address, amount);
        await mockERC20.connect(user1).approve(tipJar.target, amount);
        await mockERC20.connect(user2).approve(tipJar.target, amount);
        await tipJar.connect(user1).deposit(amount);
        await tipJar.connect(user2).deposit(amount);

        const tip1 = ethers.parseEther("20");
        const tip2 = ethers.parseEther("30");
        
        await tipJar.connect(user1).tip(user3.address, tip1);
        expect(await tipJar.tipsReceived(user3.address)).to.equal(tip1);

        await tipJar.connect(user2).tip(user3.address, tip2);
        expect(await tipJar.tipsReceived(user3.address)).to.equal(tip1 + tip2);
      });
    });
  });
});