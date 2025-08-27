/**
 * @title Contract Verification Script
 * @dev Verifies deployed contracts on block explorers
 * @author Avax Forge Empire Team
 */

const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Starting contract verification...\n");
  
  // Read deployment file
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-deployment.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Deployment file not found:", deploymentPath);
    console.log("Please run deployment script first or specify correct network");
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deploymentData.contracts;
  
  console.log("📄 Found deployment data for network:", deploymentData.network);
  console.log("🔗 Chain ID:", deploymentData.chainId);
  console.log("📝 Contracts to verify:", Object.keys(contracts).length);
  
  const verificationResults = {};
  
  // Verification delay between contracts to avoid rate limiting
  const VERIFICATION_DELAY = 10000; // 10 seconds
  
  const contractsToVerify = [
    {
      name: "XPEngine",
      address: contracts.XPEngine,
      constructorArguments: [] // Upgradeable proxy
    },
    {
      name: "BadgeMinter", 
      address: contracts.BadgeMinter,
      constructorArguments: [] // Upgradeable proxy
    },
    {
      name: "ForgePass",
      address: contracts.ForgePass,
      constructorArguments: [] // Upgradeable proxy
    },
    {
      name: "ProfileRegistry",
      address: contracts.ProfileRegistry,
      constructorArguments: [] // Upgradeable proxy
    },
    {
      name: "QuestRegistry",
      address: contracts.QuestRegistry,
      constructorArguments: [] // Upgradeable proxy
    },
    {
      name: "TokenManagerCore",
      address: contracts.TokenManagerCore,
      constructorArguments: [
        deploymentData.deployer, // feeWallet
        100 // protocolFee (in basis points)
      ]
    },
    {
      name: "TokenLauncher",
      address: contracts.TokenLauncher,
      constructorArguments: [
        contracts.TokenManagerCore // _tokenManagerCore
      ]
    },
    {
      name: "CommunityDAO",
      address: contracts.CommunityDAO,
      constructorArguments: [
        deploymentData.config.VOTING_PERIOD_DURATION, // _votingPeriodDuration
        deploymentData.config.QUORUM_PERCENTAGE, // _quorumPercentage
        deploymentData.config.INITIAL_TOTAL_VOTERS // _totalVoters
      ]
    },
    {
      name: "CommunityRewards",
      address: contracts.CommunityRewards,
      constructorArguments: [
        contracts.MockERC20, // _forgeToken
        contracts.VestingWalletFactory // _vestingWalletFactory
      ]
    },
    {
      name: "StakingRewards",
      address: contracts.StakingRewards,
      constructorArguments: [
        contracts.MockERC20, // _stakingTokenAddress
        contracts.MockERC20 // _rewardsTokenAddress (same for simplicity)
      ]
    },
    {
      name: "ReferralEngine",
      address: contracts.ReferralEngine,
      constructorArguments: [] // No constructor args
    },
    {
      name: "TipJar",
      address: contracts.TipJar,
      constructorArguments: [] // Upgradeable proxy
    },
    {
      name: "VestingWalletFactory",
      address: contracts.VestingWalletFactory,
      constructorArguments: [] // No constructor args
    },
    {
      name: "Kudos",
      address: contracts.Kudos,
      constructorArguments: [] // No constructor args
    }
  ];
  
  for (let i = 0; i < contractsToVerify.length; i++) {
    const contract = contractsToVerify[i];
    
    if (!contract.address) {
      console.log(`⏭️  Skipping ${contract.name} - not deployed`);
      continue;
    }
    
    console.log(`\n🔍 Verifying ${contract.name} at ${contract.address}...`);
    
    try {
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.constructorArguments,
      });
      
      verificationResults[contract.name] = {
        status: "success",
        address: contract.address,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ ${contract.name} verification successful`);
      
    } catch (error) {
      console.log(`❌ ${contract.name} verification failed:`, error.message);
      
      verificationResults[contract.name] = {
        status: "failed",
        address: contract.address,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      // Continue with other contracts even if one fails
    }
    
    // Add delay between verifications to avoid rate limiting
    if (i < contractsToVerify.length - 1) {
      console.log(`⏳ Waiting ${VERIFICATION_DELAY/1000}s before next verification...`);
      await new Promise(resolve => setTimeout(resolve, VERIFICATION_DELAY));
    }
  }
  
  // Save verification results
  const verificationPath = path.join(__dirname, `../deployments/${network.name}-verification.json`);
  const verificationData = {
    network: network.name,
    chainId: deploymentData.chainId,
    timestamp: new Date().toISOString(),
    results: verificationResults
  };
  
  fs.writeFileSync(verificationPath, JSON.stringify(verificationData, null, 2));
  
  // Summary
  const successful = Object.values(verificationResults).filter(r => r.status === "success").length;
  const failed = Object.values(verificationResults).filter(r => r.status === "failed").length;
  
  console.log("\n📊 Verification Summary:");
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📄 Results saved to: ${verificationPath}`);
  
  if (failed > 0) {
    console.log("\n⚠️  Some verifications failed. Check the results file for details.");
    console.log("You can re-run verification for failed contracts individually.");
  } else {
    console.log("\n🎉 All contracts verified successfully!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});