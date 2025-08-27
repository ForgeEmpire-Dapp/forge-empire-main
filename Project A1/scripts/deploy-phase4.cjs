/**
 * @title Phase 4 Deployment: Full Decentralization & Governance
 * @dev Deploys contracts for the full public launch.
 * @author Avax Forge Empire Team
 */

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Phase 4 Deployment: Full Decentralization & Governance...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Deploying contracts with account:", deployer.address);

  // Load Phase 3 deployment data
  const phase3DeploymentPath = path.join(__dirname, `../deployments/${network.name}-phase3-deployment.json`);
  if (!fs.existsSync(phase3DeploymentPath)) {
    throw new Error(`Phase 3 deployment file not found for network: ${network.name}. Please run the Phase 3 deployment first.`);
  }
  const phase3Data = JSON.parse(fs.readFileSync(phase3DeploymentPath));
  const deployedContracts = phase3Data.contracts;

  // 1. Deploy CommunityDAO
  console.log("\nDeploying CommunityDAO...");
  const CommunityDAO = await ethers.getContractFactory("CommunityDAO");
  const communityDAO = await CommunityDAO.deploy(3600 * 24 * 7, 10, 100); // 7-day voting, 10% quorum, 100 initial voters
  await communityDAO.waitForDeployment();
  deployedContracts.CommunityDAO = await communityDAO.getAddress();
  console.log("✅ CommunityDAO deployed at:", deployedContracts.CommunityDAO);

  // 2. Deploy MarketplaceCore
  console.log("\nDeploying MarketplaceCore...");
  const MarketplaceCore = await ethers.getContractFactory("MarketplaceCore");
  const marketplaceCore = await upgrades.deployProxy(MarketplaceCore, [deployer.address, deployer.address, 250], { initializer: 'initialize', kind: 'uups' });
  await marketplaceCore.waitForDeployment();
  deployedContracts.MarketplaceCore = await marketplaceCore.getAddress();
  console.log("✅ MarketplaceCore deployed at:", deployedContracts.MarketplaceCore);

  // 3. Deploy GuildCore
  console.log("\nDeploying GuildCore...");
  const GuildCore = await ethers.getContractFactory("GuildCore");
  const guildCore = await upgrades.deployProxy(GuildCore, [deployer.address, deployedContracts.XPEngine, 100, 50], { initializer: 'initialize', kind: 'uups' });
  await guildCore.waitForDeployment();
  deployedContracts.GuildCore = await guildCore.getAddress();
  console.log("✅ GuildCore deployed at:", deployedContracts.GuildCore);

  // 4. Deploy LeaderboardCore
  console.log("\nDeploying LeaderboardCore...");
  const LeaderboardCore = await ethers.getContractFactory("LeaderboardCore");
  const leaderboardCore = await upgrades.deployProxy(LeaderboardCore, [deployer.address], { initializer: 'initialize', kind: 'uups' });
  await leaderboardCore.waitForDeployment();
  deployedContracts.LeaderboardCore = await leaderboardCore.getAddress();
  console.log("✅ LeaderboardCore deployed at:", deployedContracts.LeaderboardCore);

  // 5. Deploy SeasonalEvents
  console.log("\nDeploying SeasonalEvents...");
  const SeasonalEvents = await ethers.getContractFactory("SeasonalEvents");
  const seasonalEvents = await upgrades.deployProxy(SeasonalEvents, [deployedContracts.XPEngine, deployedContracts.BadgeMinter, deployedContracts.LeaderboardCore], { initializer: 'initialize', kind: 'uups' });
  await seasonalEvents.waitForDeployment();
  deployedContracts.SeasonalEvents = await seasonalEvents.getAddress();
  console.log("✅ SeasonalEvents deployed at:", deployedContracts.SeasonalEvents);

  // --- Transfer Ownership to DAO ---
  console.log("\n--- Transferring Ownership to CommunityDAO ---");

  const transferOwnership = async (contractName, contractAddress) => {
    try {
      const contract = await ethers.getContractAt(contractName, contractAddress);
      const adminRole = await contract.DEFAULT_ADMIN_ROLE();
      await contract.grantRole(adminRole, deployedContracts.CommunityDAO);
      console.log(`Transferred ownership of ${contractName} to CommunityDAO.`);
    } catch (error) {
      console.error(`Failed to transfer ownership of ${contractName}:`, error.message);
    }
  };

  await transferOwnership("XPEngine", deployedContracts.XPEngine);
  await transferOwnership("BadgeMinter", deployedContracts.BadgeMinter);
  await transferOwnership("ProfileRegistryV2", deployedContracts.ProfileRegistryV2);
  await transferOwnership("OnboardingQuests", deployedContracts.OnboardingQuests);
  await transferOwnership("TipJar", deployedContracts.TipJar);
  await transferOwnership("SocialGraph", deployedContracts.SocialGraph);
  await transferOwnership("QuestRegistry", deployedContracts.QuestRegistry);
  await transferOwnership("StreakCore", deployedContracts.StreakCore);
  await transferOwnership("DynamicQuestEngine", deployedContracts.DynamicQuestEngine);
  await transferOwnership("ForgeTokenCore", deployedContracts.ForgeTokenCore);
  await transferOwnership("TokenLauncher", deployedContracts.TokenLauncher);
  await transferOwnership("StakingRewards", deployedContracts.StakingRewards);
  await transferOwnership("ForgePass", deployedContracts.ForgePass);
  await transferOwnership("VestingWalletFactory", deployedContracts.VestingWalletFactory);
  await transferOwnership("CommunityRewards", deployedContracts.CommunityRewards);
  await transferOwnership("MarketplaceCore", deployedContracts.MarketplaceCore);
  await transferOwnership("GuildCore", deployedContracts.GuildCore);
  await transferOwnership("LeaderboardCore", deployedContracts.LeaderboardCore);
  await transferOwnership("SeasonalEvents", deployedContracts.SeasonalEvents);

  // --- Save Deployment Info ---
  const deploymentData = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployedContracts,
  };

  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-phase4-deployment.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

  console.log("\n🎉 Phase 4 Deployment Complete!");
  console.log("📄 Deployment details saved to:", deploymentPath);
  console.log("\n");
  console.log("********************************************************************************");
  console.log("** 🚀🚀🚀 ALL SYSTEMS GO! THE FORGE IS OPEN! 🚀🚀🚀 **");
  console.log("********************************************************************************");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
