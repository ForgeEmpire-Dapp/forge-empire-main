/**
 * @title Phase 2 Verification Script
 * @dev Verifies the contracts deployed in Phase 2.
 * @author Avax Forge Empire Team
 */

const { run, ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// List of new contracts deployed in this phase
const PHASE_2_CONTRACTS = [
  "SocialGraph",
  "QuestRegistry",
  "StreakCore",
  "StreakRewards",
  "StreakMilestones",
  "DynamicQuestEngine",
];

async function main() {
  console.log("🚀 Starting Phase 2 Contract Verification...\n");

  const network = await ethers.provider.getNetwork();
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-phase2-deployment.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Phase 2 deployment file not found for network: ${network.name}.`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
  const deployedContracts = deploymentData.contracts;

  for (const contractName of PHASE_2_CONTRACTS) {
    const address = deployedContracts[contractName];
    if (!address) {
      console.warn(`Address for ${contractName} not found in deployment file. Skipping.`);
      continue;
    }

    console.log(`Verifying ${contractName} at ${address}...`);
    try {
      // These are all proxies with no constructor args
      await run("verify:verify", {
        address: address,
        constructorArguments: [],
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

  console.log("\n🎉 Phase 2 Verification Complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
