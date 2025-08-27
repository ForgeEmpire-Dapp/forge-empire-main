
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ForgeFeeManager", function () {
    let ForgeFeeManager, feeManager, owner, user1, user2, treasury, liquidity;
    let forgeToken;

    beforeEach(async function () {
        [owner, user1, user2, treasury, liquidity] = await ethers.getSigners();

        // Deploy MockForgeTokenCore
        const MockForgeTokenCore = await ethers.getContractFactory("MockForgeTokenCore");
        forgeToken = await MockForgeTokenCore.deploy();
        await forgeToken.waitForDeployment();

        // Deploy ForgeFeeManager
        ForgeFeeManager = await ethers.getContractFactory("ForgeFeeManager");
        feeManager = await upgrades.deployProxy(ForgeFeeManager, [
            forgeToken.target,
            treasury.address,
            liquidity.address
        ]);
        await feeManager.waitForDeployment();

        // Grant roles
        await feeManager.grantRole(await feeManager.FEE_ADMIN_ROLE(), owner.address);
        await feeManager.grantRole(await feeManager.TREASURY_ROLE(), owner.address);

        // Mint some tokens to user1 for testing
        await forgeToken.mint(user1.address, ethers.parseEther("10000"));
    });

    describe("Deployment", function () {
        it("Should set the correct initial values", async function () {
            expect(await feeManager.forgeToken()).to.equal(forgeToken.target);
            expect(await feeManager.treasuryWallet()).to.equal(treasury.address);
            expect(await feeManager.liquidityWallet()).to.equal(liquidity.address);

            const feeConfig = await feeManager.feeConfig();
            expect(feeConfig.transferFeeRate).to.equal(100); // 1%
            expect(feeConfig.burnRate).to.equal(4000); // 40%
            expect(feeConfig.treasuryRate).to.equal(4000); // 40%
            expect(feeConfig.liquidityRate).to.equal(2000); // 20%
            expect(feeConfig.feesEnabled).to.be.true;
        });
    });

    describe("Fee Processing", function () {
        it("Should reject processFees calls from unauthorized addresses", async function () {
            const amount = ethers.parseEther("1000");
            
            // Should revert when called by non-token address
            await expect(
                feeManager.connect(owner).processFees(user1.address, user2.address, amount)
            ).to.be.revertedWithCustomError(feeManager, "UnauthorizedToken");
        });

        it("Should handle fee configuration correctly", async function () {
            // Test that fee configuration can be read
            const feeConfig = await feeManager.feeConfig();
            expect(feeConfig.transferFeeRate).to.equal(100); // 1%
            expect(feeConfig.burnRate).to.equal(4000); // 40%
            expect(feeConfig.treasuryRate).to.equal(4000); // 40%
            expect(feeConfig.liquidityRate).to.equal(2000); // 20%
            expect(feeConfig.feesEnabled).to.be.true;
        });
    });

    describe("Admin Functions", function () {
        it("Should allow FEE_ADMIN_ROLE to update fee config", async function () {
            await feeManager.connect(owner).updateFeeConfig(200, 5000, 3000, 2000);
            const feeConfig = await feeManager.feeConfig();
            expect(feeConfig.transferFeeRate).to.equal(200);
            expect(feeConfig.burnRate).to.equal(5000);
        });

        it("Should not allow non-admin to update fee config", async function () {
            await expect(
                feeManager.connect(user1).updateFeeConfig(200, 5000, 3000, 2000)
            ).to.be.reverted;
        });

        it("Should allow FEE_ADMIN_ROLE to update limit config", async function () {
            const newMaxTx = ethers.parseEther("1000");
            await feeManager.connect(owner).updateLimitConfig(newMaxTx, ethers.parseEther("2000"), 60);
            const limitConfig = await feeManager.limitConfig();
            expect(limitConfig.maxTransactionAmount).to.equal(newMaxTx);
        });
    });

    describe("Pausable", function () {
        it("Should allow admin to pause and unpause", async function () {
            await feeManager.connect(owner).pause();
            expect(await feeManager.paused()).to.be.true;

            await feeManager.connect(owner).unpause();
            expect(await feeManager.paused()).to.be.false;
        });

        it("Should prevent fee processing when paused", async function () {
            await feeManager.connect(owner).pause();
            const amount = ethers.parseEther("100");
            await expect(
                feeManager.connect(owner).processFees(user1.address, user2.address, amount)
            ).to.be.revertedWithCustomError(feeManager, "EnforcedPause");
        });
    });
});
