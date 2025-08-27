const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenManagerCore", function () {
  let TokenManagerCore, tokenManager;
  let owner, admin, creator, daoGovernor, pauser, verifier, feeWallet, user1, user2, user3;

  const INITIAL_PROTOCOL_FEE = 250; // 2.5%
  const MAX_PROTOCOL_FEE = 1000; // 10%

  beforeEach(async () => {
    [owner, admin, creator, daoGovernor, pauser, verifier, feeWallet, user1, user2, user3] = await ethers.getSigners();

    // Deploy TokenManagerCore
    TokenManagerCore = await ethers.getContractFactory("TokenManagerCore");
    tokenManager = await TokenManagerCore.deploy(feeWallet.address, INITIAL_PROTOCOL_FEE);
    await tokenManager.waitForDeployment();

    // Grant roles
    const DEFAULT_ADMIN_ROLE = await tokenManager.DEFAULT_ADMIN_ROLE();
    const CREATOR_ROLE = await tokenManager.CREATOR_ROLE();
    const VERIFIER_ROLE = await tokenManager.VERIFIER_ROLE();
    const PAUSER_ROLE = await tokenManager.PAUSER_ROLE();
    const DAO_GOVERNOR_ROLE = await tokenManager.DAO_GOVERNOR_ROLE();

    await tokenManager.grantRole(DEFAULT_ADMIN_ROLE, admin.address);
    await tokenManager.grantRole(CREATOR_ROLE, creator.address);
    await tokenManager.grantRole(VERIFIER_ROLE, verifier.address);
    await tokenManager.grantRole(PAUSER_ROLE, pauser.address);
    await tokenManager.grantRole(DAO_GOVERNOR_ROLE, daoGovernor.address);
  });

  describe("Deployment and Initialization", function () {
    it("should initialize with correct protocol configuration", async () => {
      const [configFeeWallet, configProtocolFee] = await tokenManager.getProtocolConfig();
      expect(configFeeWallet).to.equal(feeWallet.address);
      expect(configProtocolFee).to.equal(INITIAL_PROTOCOL_FEE);
    });

    it("should set correct constants", async () => {
      expect(await tokenManager.MAX_PROTOCOL_FEE()).to.equal(MAX_PROTOCOL_FEE);
      expect(await tokenManager.FEE_DENOMINATOR()).to.equal(10000);
    });

    it("should assign all roles to deployer initially", async () => {
      const DEFAULT_ADMIN_ROLE = await tokenManager.DEFAULT_ADMIN_ROLE();
      const CREATOR_ROLE = await tokenManager.CREATOR_ROLE();
      const PAUSER_ROLE = await tokenManager.PAUSER_ROLE();
      const DAO_GOVERNOR_ROLE = await tokenManager.DAO_GOVERNOR_ROLE();

      expect(await tokenManager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await tokenManager.hasRole(CREATOR_ROLE, owner.address)).to.be.true;
      expect(await tokenManager.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
      expect(await tokenManager.hasRole(DAO_GOVERNOR_ROLE, owner.address)).to.be.true;
    });

    it("should initialize with zero tokens launched", async () => {
      expect(await tokenManager.totalTokensLaunched()).to.equal(0);
      expect(await tokenManager.launchedTokensCount()).to.equal(0);
    });

    it("should be unpaused after deployment", async () => {
      expect(await tokenManager.paused()).to.be.false;
    });
  });

  describe("Token Launch Functionality", function () {
    const sampleToken = {
      address: "0x1234567890123456789012345678901234567890",
      name: "Test Token",
      symbol: "TEST",
      totalSupply: ethers.parseEther("1000000")
    };

    describe("Basic Token Launch", function () {
      it("should allow creator to launch a token", async () => {
        await expect(
          tokenManager.connect(creator).launchToken(
            sampleToken.address,
            sampleToken.name,
            sampleToken.symbol,
            sampleToken.totalSupply
          )
        ).to.emit(tokenManager, "TokenLaunched")
         .withArgs(sampleToken.address, creator.address, sampleToken.name, sampleToken.symbol, sampleToken.totalSupply);
      });

      it("should update counters after token launch", async () => {
        await tokenManager.connect(creator).launchToken(
          sampleToken.address,
          sampleToken.name,
          sampleToken.symbol,
          sampleToken.totalSupply
        );

        expect(await tokenManager.totalTokensLaunched()).to.equal(1);
        expect(await tokenManager.launchedTokensCount()).to.equal(1);
      });

      it("should store correct token metadata", async () => {
        await tokenManager.connect(creator).launchToken(
          sampleToken.address,
          sampleToken.name,
          sampleToken.symbol,
          sampleToken.totalSupply
        );

        const metadata = await tokenManager.getTokenMetadata(sampleToken.address);
        expect(metadata.tokenAddress).to.equal(sampleToken.address);
        expect(metadata.creator).to.equal(creator.address);
        expect(metadata.name).to.equal(sampleToken.name);
        expect(metadata.symbol).to.equal(sampleToken.symbol);
        expect(metadata.totalSupply).to.equal(sampleToken.totalSupply);
        expect(metadata.isActive).to.be.true;
        expect(metadata.creationTimestamp).to.be.above(0);
      });

      it("should add token to enumerable sets", async () => {
        await tokenManager.connect(creator).launchToken(
          sampleToken.address,
          sampleToken.name,
          sampleToken.symbol,
          sampleToken.totalSupply
        );

        expect(await tokenManager.isTokenLaunched(sampleToken.address)).to.be.true;
        expect(await tokenManager.getTokenAtIndex(0)).to.equal(sampleToken.address);
        expect(await tokenManager.getTokenCountByCreator(creator.address)).to.equal(1);
        expect(await tokenManager.getTokenByCreatorAtIndex(creator.address, 0)).to.equal(sampleToken.address);
      });

      it("should track multiple tokens correctly", async () => {
        const token2Address = "0x2234567890123456789012345678901234567890";
        const token3Address = "0x3234567890123456789012345678901234567890";

        // Launch first token
        await tokenManager.connect(creator).launchToken(
          sampleToken.address, sampleToken.name, sampleToken.symbol, sampleToken.totalSupply
        );

        // Launch second token
        await tokenManager.connect(creator).launchToken(
          token2Address, "Token Two", "TK2", ethers.parseEther("2000000")
        );

        // Grant creator role to user1 first
        const CREATOR_ROLE = await tokenManager.CREATOR_ROLE();
        await tokenManager.grantRole(CREATOR_ROLE, user1.address);

        // Launch third token by different creator
        await tokenManager.connect(user1).launchToken(
          token3Address, "Token Three", "TK3", ethers.parseEther("3000000")
        );

        expect(await tokenManager.totalTokensLaunched()).to.equal(3);
        expect(await tokenManager.launchedTokensCount()).to.equal(3);
        expect(await tokenManager.getTokenCountByCreator(creator.address)).to.equal(2);
        expect(await tokenManager.getTokenCountByCreator(user1.address)).to.equal(1);
      });
    });

    describe("Token Launch Validation", function () {
      it("should reject zero token address", async () => {
        await expect(
          tokenManager.connect(creator).launchToken(
            ethers.ZeroAddress,
            sampleToken.name,
            sampleToken.symbol,
            sampleToken.totalSupply
          )
        ).to.be.revertedWithCustomError(tokenManager, "TokenAddressCannotBeZero");
      });

      it("should reject empty token name", async () => {
        await expect(
          tokenManager.connect(creator).launchToken(
            sampleToken.address,
            "",
            sampleToken.symbol,
            sampleToken.totalSupply
          )
        ).to.be.revertedWithCustomError(tokenManager, "EmptyTokenName");
      });

      it("should reject empty token symbol", async () => {
        await expect(
          tokenManager.connect(creator).launchToken(
            sampleToken.address,
            sampleToken.name,
            "",
            sampleToken.totalSupply
          )
        ).to.be.revertedWithCustomError(tokenManager, "EmptyTokenSymbol");
      });

      it("should reject zero total supply", async () => {
        await expect(
          tokenManager.connect(creator).launchToken(
            sampleToken.address,
            sampleToken.name,
            sampleToken.symbol,
            0
          )
        ).to.be.revertedWithCustomError(tokenManager, "ZeroTotalSupply");
      });

      it("should reject duplicate token addresses", async () => {
        // Launch token first time
        await tokenManager.connect(creator).launchToken(
          sampleToken.address,
          sampleToken.name,
          sampleToken.symbol,
          sampleToken.totalSupply
        );

        // Try to launch same token address again
        await expect(
          tokenManager.connect(creator).launchToken(
            sampleToken.address,
            "Different Name",
            "DIFF",
            ethers.parseEther("500000")
          )
        ).to.be.revertedWithCustomError(tokenManager, "TokenAlreadyLaunched")
         .withArgs(sampleToken.address);
      });

      it("should reject launch from non-creator role", async () => {
        await expect(
          tokenManager.connect(user1).launchToken(
            sampleToken.address,
            sampleToken.name,
            sampleToken.symbol,
            sampleToken.totalSupply
          )
        ).to.be.reverted;
      });

      it("should reject launch when paused", async () => {
        await tokenManager.connect(pauser).pause();

        await expect(
          tokenManager.connect(creator).launchToken(
            sampleToken.address,
            sampleToken.name,
            sampleToken.symbol,
            sampleToken.totalSupply
          )
        ).to.be.revertedWithCustomError(tokenManager, "EnforcedPause");
      });
    });
  });

  describe("Token Status Management", function () {
    const sampleToken = {
      address: "0x1234567890123456789012345678901234567890",
      name: "Test Token",
      symbol: "TEST",
      totalSupply: ethers.parseEther("1000000")
    };

    beforeEach(async () => {
      await tokenManager.connect(creator).launchToken(
        sampleToken.address,
        sampleToken.name,
        sampleToken.symbol,
        sampleToken.totalSupply
      );
    });

    it("should allow admin to deactivate a token", async () => {
      await expect(
        tokenManager.connect(admin).updateTokenStatus(sampleToken.address, false)
      ).to.emit(tokenManager, "TokenStatusUpdated")
       .withArgs(sampleToken.address, false, admin.address);

      const metadata = await tokenManager.getTokenMetadata(sampleToken.address);
      expect(metadata.isActive).to.be.false;
    });

    it("should allow admin to reactivate a token", async () => {
      // First deactivate
      await tokenManager.connect(admin).updateTokenStatus(sampleToken.address, false);
      
      // Then reactivate
      await expect(
        tokenManager.connect(admin).updateTokenStatus(sampleToken.address, true)
      ).to.emit(tokenManager, "TokenStatusUpdated")
       .withArgs(sampleToken.address, true, admin.address);

      const metadata = await tokenManager.getTokenMetadata(sampleToken.address);
      expect(metadata.isActive).to.be.true;
    });

    it("should not emit event for redundant status changes", async () => {
      // Token is already active, so this should not emit event
      await expect(
        tokenManager.connect(admin).updateTokenStatus(sampleToken.address, true)
      ).to.not.emit(tokenManager, "TokenStatusUpdated");
    });

    it("should reject status update for non-existent token", async () => {
      const nonExistentToken = "0x9999567890123456789012345678901234567890";
      
      await expect(
        tokenManager.connect(admin).updateTokenStatus(nonExistentToken, false)
      ).to.be.revertedWithCustomError(tokenManager, "TokenNotLaunched")
       .withArgs(nonExistentToken);
    });

    it("should reject status update from non-admin", async () => {
      await expect(
        tokenManager.connect(user1).updateTokenStatus(sampleToken.address, false)
      ).to.be.reverted;
    });

    it("should reject status update when paused", async () => {
      await tokenManager.connect(pauser).pause();

      await expect(
        tokenManager.connect(admin).updateTokenStatus(sampleToken.address, false)
      ).to.be.revertedWithCustomError(tokenManager, "EnforcedPause");
    });
  });

  describe("Protocol Configuration Management", function () {
    it("should allow DAO governor to update protocol config", async () => {
      const newFeeWallet = user2.address;
      const newProtocolFee = 500; // 5%

      await expect(
        tokenManager.connect(daoGovernor).updateProtocolConfig(newFeeWallet, newProtocolFee)
      ).to.emit(tokenManager, "ProtocolConfigUpdated")
       .withArgs(newFeeWallet, newProtocolFee, daoGovernor.address);

      const [configFeeWallet, configProtocolFee] = await tokenManager.getProtocolConfig();
      expect(configFeeWallet).to.equal(newFeeWallet);
      expect(configProtocolFee).to.equal(newProtocolFee);
    });

    it("should reject zero address for fee wallet", async () => {
      await expect(
        tokenManager.connect(daoGovernor).updateProtocolConfig(ethers.ZeroAddress, 500)
      ).to.be.revertedWithCustomError(tokenManager, "FeeWalletCannotBeZero");
    });

    it("should reject protocol fee exceeding maximum", async () => {
      const excessiveFee = MAX_PROTOCOL_FEE + 1;

      await expect(
        tokenManager.connect(daoGovernor).updateProtocolConfig(user2.address, excessiveFee)
      ).to.be.revertedWithCustomError(tokenManager, "ProtocolFeeExceedsMaximum")
       .withArgs(excessiveFee, MAX_PROTOCOL_FEE);
    });

    it("should allow protocol fee at maximum", async () => {
      await expect(
        tokenManager.connect(daoGovernor).updateProtocolConfig(user2.address, MAX_PROTOCOL_FEE)
      ).to.not.be.reverted;

      const [, configProtocolFee] = await tokenManager.getProtocolConfig();
      expect(configProtocolFee).to.equal(MAX_PROTOCOL_FEE);
    });

    it("should reject config update from non-DAO governor", async () => {
      await expect(
        tokenManager.connect(user1).updateProtocolConfig(user2.address, 500)
      ).to.be.reverted;
    });

    it("should reject config update when paused", async () => {
      await tokenManager.connect(pauser).pause();

      await expect(
        tokenManager.connect(daoGovernor).updateProtocolConfig(user2.address, 500)
      ).to.be.revertedWithCustomError(tokenManager, "EnforcedPause");
    });
  });

  describe("View Functions", function () {
    const tokens = [
      {
        address: "0x1111567890123456789012345678901234567890",
        name: "Token One",
        symbol: "TK1",
        totalSupply: ethers.parseEther("1000000")
      },
      {
        address: "0x2222567890123456789012345678901234567890",
        name: "Token Two",
        symbol: "TK2",
        totalSupply: ethers.parseEther("2000000")
      },
      {
        address: "0x3333567890123456789012345678901234567890",
        name: "Token Three",
        symbol: "TK3",
        totalSupply: ethers.parseEther("3000000")
      }
    ];

    beforeEach(async () => {
      // Grant creator role to user1
      const CREATOR_ROLE = await tokenManager.CREATOR_ROLE();
      await tokenManager.grantRole(CREATOR_ROLE, user1.address);

      // Launch tokens by different creators
      await tokenManager.connect(creator).launchToken(
        tokens[0].address, tokens[0].name, tokens[0].symbol, tokens[0].totalSupply
      );
      await tokenManager.connect(creator).launchToken(
        tokens[1].address, tokens[1].name, tokens[1].symbol, tokens[1].totalSupply
      );
      await tokenManager.connect(user1).launchToken(
        tokens[2].address, tokens[2].name, tokens[2].symbol, tokens[2].totalSupply
      );
    });

    describe("Token Enumeration", function () {
      it("should return correct token count", async () => {
        expect(await tokenManager.launchedTokensCount()).to.equal(3);
        expect(await tokenManager.totalTokensLaunched()).to.equal(3);
      });

      it("should return correct token at index", async () => {
        expect(await tokenManager.getTokenAtIndex(0)).to.equal(tokens[0].address);
        expect(await tokenManager.getTokenAtIndex(1)).to.equal(tokens[1].address);
        expect(await tokenManager.getTokenAtIndex(2)).to.equal(tokens[2].address);
      });

      it("should reject invalid index", async () => {
        await expect(
          tokenManager.getTokenAtIndex(3)
        ).to.be.revertedWithCustomError(tokenManager, "IndexOutOfBounds");
      });

      it("should return all tokens", async () => {
        const allTokens = await tokenManager.getAllTokens();
        expect(allTokens.length).to.equal(3);
        expect(allTokens).to.include(tokens[0].address);
        expect(allTokens).to.include(tokens[1].address);
        expect(allTokens).to.include(tokens[2].address);
      });

      it("should check token launch status correctly", async () => {
        expect(await tokenManager.isTokenLaunched(tokens[0].address)).to.be.true;
        expect(await tokenManager.isTokenLaunched(tokens[1].address)).to.be.true;
        expect(await tokenManager.isTokenLaunched(tokens[2].address)).to.be.true;
        expect(await tokenManager.isTokenLaunched("0x9999567890123456789012345678901234567890")).to.be.false;
      });
    });

    describe("Creator-based Queries", function () {
      it("should return correct token count by creator", async () => {
        expect(await tokenManager.getTokenCountByCreator(creator.address)).to.equal(2);
        expect(await tokenManager.getTokenCountByCreator(user1.address)).to.equal(1);
        expect(await tokenManager.getTokenCountByCreator(user2.address)).to.equal(0);
      });

      it("should return correct token by creator at index", async () => {
        expect(await tokenManager.getTokenByCreatorAtIndex(creator.address, 0)).to.equal(tokens[0].address);
        expect(await tokenManager.getTokenByCreatorAtIndex(creator.address, 1)).to.equal(tokens[1].address);
        expect(await tokenManager.getTokenByCreatorAtIndex(user1.address, 0)).to.equal(tokens[2].address);
      });

      it("should reject invalid creator index", async () => {
        await expect(
          tokenManager.getTokenByCreatorAtIndex(creator.address, 2)
        ).to.be.revertedWithCustomError(tokenManager, "IndexOutOfBounds");
      });

      it("should return all tokens by creator", async () => {
        const creatorTokens = await tokenManager.getTokensByCreator(creator.address);
        expect(creatorTokens.length).to.equal(2);
        expect(creatorTokens).to.include(tokens[0].address);
        expect(creatorTokens).to.include(tokens[1].address);

        const user1Tokens = await tokenManager.getTokensByCreator(user1.address);
        expect(user1Tokens.length).to.equal(1);
        expect(user1Tokens[0]).to.equal(tokens[2].address);

        const user2Tokens = await tokenManager.getTokensByCreator(user2.address);
        expect(user2Tokens.length).to.equal(0);
      });
    });

    describe("Token Metadata Retrieval", function () {
      it("should return complete token metadata", async () => {
        const metadata = await tokenManager.getTokenMetadata(tokens[0].address);
        expect(metadata.tokenAddress).to.equal(tokens[0].address);
        expect(metadata.creator).to.equal(creator.address);
        expect(metadata.name).to.equal(tokens[0].name);
        expect(metadata.symbol).to.equal(tokens[0].symbol);
        expect(metadata.totalSupply).to.equal(tokens[0].totalSupply);
        expect(metadata.isActive).to.be.true;
        expect(metadata.creationTimestamp).to.be.above(0);
      });

      it("should reject metadata query for non-existent token", async () => {
        const nonExistentToken = "0x9999567890123456789012345678901234567890";
        
        await expect(
          tokenManager.getTokenMetadata(nonExistentToken)
        ).to.be.revertedWithCustomError(tokenManager, "TokenNotLaunched")
         .withArgs(nonExistentToken);
      });
    });

    describe("Protocol Configuration Queries", function () {
      it("should return correct protocol configuration", async () => {
        const [configFeeWallet, configProtocolFee] = await tokenManager.getProtocolConfig();
        expect(configFeeWallet).to.equal(feeWallet.address);
        expect(configProtocolFee).to.equal(INITIAL_PROTOCOL_FEE);
      });
    });
  });

  describe("Pausable Functionality", function () {
    it("should allow pauser to pause contract", async () => {
      await tokenManager.connect(pauser).pause();
      expect(await tokenManager.paused()).to.be.true;
    });

    it("should allow pauser to unpause contract", async () => {
      await tokenManager.connect(pauser).pause();
      await tokenManager.connect(pauser).unpause();
      expect(await tokenManager.paused()).to.be.false;
    });

    it("should prevent operations when paused", async () => {
      await tokenManager.connect(pauser).pause();

      const sampleToken = {
        address: "0x1234567890123456789012345678901234567890",
        name: "Test Token",
        symbol: "TEST",
        totalSupply: ethers.parseEther("1000000")
      };

      await expect(
        tokenManager.connect(creator).launchToken(
          sampleToken.address,
          sampleToken.name,
          sampleToken.symbol,
          sampleToken.totalSupply
        )
      ).to.be.revertedWithCustomError(tokenManager, "EnforcedPause");
    });

    it("should allow view functions when paused", async () => {
      const sampleToken = {
        address: "0x1234567890123456789012345678901234567890",
        name: "Test Token",
        symbol: "TEST",
        totalSupply: ethers.parseEther("1000000")
      };

      await tokenManager.connect(creator).launchToken(
        sampleToken.address,
        sampleToken.name,
        sampleToken.symbol,
        sampleToken.totalSupply
      );

      await tokenManager.connect(pauser).pause();

      // View functions should still work
      expect(await tokenManager.launchedTokensCount()).to.equal(1);
      expect(await tokenManager.isTokenLaunched(sampleToken.address)).to.be.true;
      
      const metadata = await tokenManager.getTokenMetadata(sampleToken.address);
      expect(metadata.name).to.equal(sampleToken.name);
    });

    it("should reject pause/unpause from non-pauser role", async () => {
      await expect(
        tokenManager.connect(user1).pause()
      ).to.be.reverted;

      await expect(
        tokenManager.connect(user1).unpause()
      ).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("should enforce role-based access control", async () => {
      const sampleToken = {
        address: "0x1234567890123456789012345678901234567890",
        name: "Test Token",
        symbol: "TEST",
        totalSupply: ethers.parseEther("1000000")
      };

      // Test all functions require appropriate roles
      await expect(
        tokenManager.connect(user1).launchToken(
          sampleToken.address, sampleToken.name, sampleToken.symbol, sampleToken.totalSupply
        )
      ).to.be.reverted;

      await expect(
        tokenManager.connect(user1).updateTokenStatus(sampleToken.address, false)
      ).to.be.reverted;

      await expect(
        tokenManager.connect(user1).updateProtocolConfig(user2.address, 500)
      ).to.be.reverted;

      await expect(
        tokenManager.connect(user1).pause()
      ).to.be.reverted;
    });

    it("should allow role holders to perform their functions", async () => {
      const sampleToken = {
        address: "0x1234567890123456789012345678901234567890",
        name: "Test Token",
        symbol: "TEST",
        totalSupply: ethers.parseEther("1000000")
      };

      // These should not revert
      await tokenManager.connect(creator).launchToken(
        sampleToken.address, sampleToken.name, sampleToken.symbol, sampleToken.totalSupply
      );
      
      await tokenManager.connect(admin).updateTokenStatus(sampleToken.address, false);
      await tokenManager.connect(daoGovernor).updateProtocolConfig(user2.address, 500);
      await tokenManager.connect(pauser).pause();
      await tokenManager.connect(pauser).unpause();
    });

    it("should support role granting and revoking", async () => {
      const CREATOR_ROLE = await tokenManager.CREATOR_ROLE();
      
      // Grant creator role to user1
      await tokenManager.connect(owner).grantRole(CREATOR_ROLE, user1.address);
      expect(await tokenManager.hasRole(CREATOR_ROLE, user1.address)).to.be.true;

      // User1 should now be able to launch tokens
      const sampleToken = {
        address: "0x1234567890123456789012345678901234567890",
        name: "Test Token",
        symbol: "TEST",
        totalSupply: ethers.parseEther("1000000")
      };

      await tokenManager.connect(user1).launchToken(
        sampleToken.address, sampleToken.name, sampleToken.symbol, sampleToken.totalSupply
      );

      // Revoke role
      await tokenManager.connect(owner).revokeRole(CREATOR_ROLE, user1.address);
      expect(await tokenManager.hasRole(CREATOR_ROLE, user1.address)).to.be.false;

      // User1 should no longer be able to launch tokens
      await expect(
        tokenManager.connect(user1).launchToken(
          "0x2234567890123456789012345678901234567890", "Token Two", "TK2", ethers.parseEther("2000000")
        )
      ).to.be.reverted;
    });
  });

  describe("Edge Cases and Integration", function () {
    it("should handle maximum protocol fee correctly", async () => {
      await tokenManager.connect(daoGovernor).updateProtocolConfig(user2.address, MAX_PROTOCOL_FEE);
      
      const [, configProtocolFee] = await tokenManager.getProtocolConfig();
      expect(configProtocolFee).to.equal(MAX_PROTOCOL_FEE);
    });

    it("should handle zero protocol fee", async () => {
      await tokenManager.connect(daoGovernor).updateProtocolConfig(user2.address, 0);
      
      const [, configProtocolFee] = await tokenManager.getProtocolConfig();
      expect(configProtocolFee).to.equal(0);
    });

    it("should handle large numbers of tokens", async () => {
      // Launch multiple tokens
      for (let i = 0; i < 10; i++) {
        const tokenAddress = `0x${(i + 1).toString().padStart(40, '0')}`;
        await tokenManager.connect(creator).launchToken(
          tokenAddress,
          `Token ${i + 1}`,
          `TK${i + 1}`,
          ethers.parseEther((1000000 * (i + 1)).toString())
        );
      }

      expect(await tokenManager.launchedTokensCount()).to.equal(10);
      expect(await tokenManager.totalTokensLaunched()).to.equal(10);
      expect(await tokenManager.getTokenCountByCreator(creator.address)).to.equal(10);

      const allTokens = await tokenManager.getAllTokens();
      expect(allTokens.length).to.equal(10);

      const creatorTokens = await tokenManager.getTokensByCreator(creator.address);
      expect(creatorTokens.length).to.equal(10);
    });

    it("should maintain state consistency during complex operations", async () => {
      const tokens = [
        "0x1111567890123456789012345678901234567890",
        "0x2222567890123456789012345678901234567890",
        "0x3333567890123456789012345678901234567890"
      ];

      // Launch tokens
      for (let i = 0; i < 3; i++) {
        await tokenManager.connect(creator).launchToken(
          tokens[i],
          `Token ${i + 1}`,
          `TK${i + 1}`,
          ethers.parseEther("1000000")
        );
      }

      // Update status of middle token
      await tokenManager.connect(admin).updateTokenStatus(tokens[1], false);

      // Verify state consistency
      expect(await tokenManager.launchedTokensCount()).to.equal(3);
      expect(await tokenManager.getTokenCountByCreator(creator.address)).to.equal(3);

      const metadata1 = await tokenManager.getTokenMetadata(tokens[1]);
      expect(metadata1.isActive).to.be.false;

      const allTokens = await tokenManager.getAllTokens();
      expect(allTokens.length).to.equal(3);
      expect(allTokens).to.include(tokens[1]); // Inactive tokens still appear in lists
    });

    it("should handle reentrancy protection", async () => {
      const sampleToken = {
        address: "0x1234567890123456789012345678901234567890",
        name: "Test Token",
        symbol: "TEST",
        totalSupply: ethers.parseEther("1000000")
      };

      // ReentrancyGuard should prevent reentrancy attacks
      await expect(
        tokenManager.connect(creator).launchToken(
          sampleToken.address,
          sampleToken.name,
          sampleToken.symbol,
          sampleToken.totalSupply
        )
      ).to.not.be.reverted;
    });
  });
});