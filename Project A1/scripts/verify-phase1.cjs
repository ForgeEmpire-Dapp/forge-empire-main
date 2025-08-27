/**
 * @title Phase 1 Verification Script
 * @dev Verifies the contracts deployed in Phase 1.
 * @author Avax Forge Empire Team
 */

const { run, ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// List of contracts deployed in this phase
const PHASE_1_CONTRACTS = [
  "MockERC20",
  "XPEngine",
  "BadgeMinter",
  "ProfileRegistry",
  "OnboardingQuests",
  "Kudos",
  "TipJar",
];

async function getConstructorArguments(contractName, deploymentData) {
  switch (contractName) {
    case "MockERC20":
      return ["Mock Token", "MOCK"];
    // Proxies and other simple contracts have no constructor args
    default:
      return [];
  }
}

async function main() {
  console.log("🚀 Starting Phase 1 Contract Verification...\n");

  const network = await ethers.provider.getNetwork();
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-phase1-deployment.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Phase 1 deployment file not found for network: ${network.name}.`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
  const deployedContracts = deploymentData.contracts;

  for (const contractName of PHASE_1_CONTRACTS) {
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

  console.log("\n🎉 Phase 1 Verification Complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
