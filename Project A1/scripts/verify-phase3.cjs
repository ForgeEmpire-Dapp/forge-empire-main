/**
 * @title Phase 3 Verification Script
 * @dev Verifies the contracts deployed in Phase 3.
 * @author Avax Forge Empire Team
 */

const { run, ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// List of new contracts deployed in this phase
const PHASE_3_CONTRACTS = [
  "TokenLauncher",
  "StakingRewards",
  "ForgePass",
  "VestingWalletFactory",
  "CommunityRewards",
];

async function getConstructorArguments(contractName, deploymentData) {
  const { contracts, deployer } = deploymentData;
  switch (contractName) {
    case "TokenLauncher":
      return [deployer]; // Assuming deployer is the initial manager
    case "StakingRewards":
      return [contracts.ForgeTokenCore, contracts.ForgeTokenCore];
    case "CommunityRewards":
      return [contracts.ForgeTokenCore, contracts.VestingWalletFactory];
    default:
      return [];
  }
}

async function main() {
  console.log("🚀 Starting Phase 3 Contract Verification...\n");

  const network = await ethers.provider.getNetwork();
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-phase3-deployment.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Phase 3 deployment file not found for network: ${network.name}.`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
  const deployedContracts = deploymentData.contracts;

  for (const contractName of PHASE_3_CONTRACTS) {
    const address = deployedContracts[contractName];
    if (!address) {
      console.warn(`Address for ${contractName} not found in deployment file. Skipping.`);
      continue;
    }

    console.log(`Verifying ${contractName} at ${address}...`);
    try {
      const constructorArguments = await getConstructorArguments(contractName, deploymentData);
      await run("verify:verify", {
        address: address,
        constructorArguments: constructorArguments,
      });
      console.log(`✅ ${contractName} verified successfully!`);
    } catch (error) {
      if (error.message.toLowerCase().includes("already verified")) {
        console.log(`✅ ${contractName} is already verified.`);
      } else {
        console.error(`❌ Verification failed for ${contractName}:`, error.message);
      }
    }
    console.log("----------------------------------");
  }

  console.log("\n🎉 Phase 3 Verification Complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
