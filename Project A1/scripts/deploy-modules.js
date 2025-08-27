/**
 * @title Modular Deployment Script for Avax Forge Empire
 * @dev Deploys remaining contracts and integrates them with the existing system
 * @author Avax Forge Empire Team
 */

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Modular Deployment...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-deployment.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found for network: ${network.name}`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
  const deployedContracts = deploymentData.contracts;

  // Phase 1: Deploy Remaining Modules
  console.log("\n📋 Phase 1: Deploying Remaining Modules...");

  console.log("Deploying DynamicQuestEngine...");
  const DynamicQuestEngine = await ethers.getContractFactory("DynamicQuestEngine");
  const dynamicQuestEngine = await upgrades.deployProxy(DynamicQuestEngine, [deployedContracts.XPEngine], { initializer: 'initialize' });
  await dynamicQuestEngine.waitForDeployment();
  deployedContracts.DynamicQuestEngine = await dynamicQuestEngine.getAddress();
  console.log("✅ DynamicQuestEngine deployed at:", deployedContracts.DynamicQuestEngine);

  console.log("Deploying MarketplaceCore...");
  const MarketplaceCore = await ethers.getContractFactory("MarketplaceCore");
  const marketplaceCore = await upgrades.deployProxy(MarketplaceCore, [deployer.address], { initializer: 'initialize' });
  await marketplaceCore.waitForDeployment();
  deployedContracts.MarketplaceCore = await marketplaceCore.getAddress();
  console.log("✅ MarketplaceCore deployed at:", deployedContracts.MarketplaceCore);

  // Phase 2: Deploy Streak-Related Contracts
  console.log("\n📋 Phase 2: Deploying Streak-Related Contracts...");

  console.log("Deploying StreakMilestones...");
  const StreakMilestones = await ethers.getContractFactory("StreakMilestones");
  const streakMilestones = await upgrades.deployProxy(StreakMilestones, [deployedContracts.StreakCore, deployedContracts.BadgeMinter], { initializer: 'initialize' });
  await streakMilestones.waitForDeployment();
  deployedContracts.StreakMilestones = await streakMilestones.getAddress();
  console.log("✅ StreakMilestones deployed at:", deployedContracts.StreakMilestones);

  console.log("Deploying StreakRewards...");
  const StreakRewards = await ethers.getContractFactory("StreakRewards");
  const streakRewards = await upgrades.deployProxy(StreakRewards, [deployedContracts.StreakCore, deployedContracts.XPEngine], { initializer: 'initialize' });
  await streakRewards.waitForDeployment();
  deployedContracts.StreakRewards = await streakRewards.getAddress();
  console.log("✅ StreakRewards deployed at:", deployedContracts.StreakRewards);

  console.log("Deploying StreakSystemManager...");
  const StreakSystemManager = await ethers.getContractFactory("StreakSystemManager");
  const streakSystemManager = await upgrades.deployProxy(StreakSystemManager, [
    deployedContracts.StreakCore,
    deployedContracts.StreakRewards,
    deployedContracts.StreakMilestones
  ], { initializer: 'initialize' });
  await streakSystemManager.waitForDeployment();
  deployedContracts.StreakSystemManager = await streakSystemManager.getAddress();
  console.log("✅ StreakSystemManager deployed at:", deployedContracts.StreakSystemManager);

  // Update deployment file
  deploymentData.contracts = deployedContracts;
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

  console.log("\n🎉 Modular Deployment Complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
