/**
 * @title Comprehensive Verification Script for Avax Forge Empire
 * @dev Verifies all deployed contracts on the block explorer
 * @author Avax Forge Empire Team
 */

const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Contract Verification...");

  const network = await ethers.provider.getNetwork();
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-deployment.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found for network: ${network.name}`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
  const deployedContracts = deploymentData.contracts;

  for (const [name, address] of Object.entries(deployedContracts)) {
    console.log(`
Verifying ${name} at ${address}...`);
    try {
      await run("verify:verify", {
        address: address,
        constructorArguments: [], // Add constructor arguments if any
      });
      console.log(`✅ ${name} verified successfully!`);
    } catch (error) {
      if (error.message.toLowerCase().includes("already verified")) {
        console.log(`✅ ${name} is already verified.`);
      } else {
        console.error(`❌ Verification failed for ${name}:`, error);
      }
    }
  }

  console.log("\n🎉 Verification Complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
