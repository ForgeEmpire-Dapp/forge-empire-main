/**
 * @title Phase 2 Deployment: Engagement & Social Expansion
 * @dev Deploys contracts for the open beta phase.
 * @author Avax Forge Empire Team
 */

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Phase 2 Deployment: Engagement & Social Expansion...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Deploying contracts with account:", deployer.address);

  // Load Phase 1 deployment data
  const phase1DeploymentPath = path.join(__dirname, `../deployments/${network.name}-phase1-deployment.json`);
  if (!fs.existsSync(phase1DeploymentPath)) {
    throw new Error(`Phase 1 deployment file not found for network: ${network.name}. Please run the Phase 1 deployment first.`);
  }
  const phase1Data = JSON.parse(fs.readFileSync(phase1DeploymentPath));
  const deployedContracts = phase1Data.contracts;

  // 1. Deploy SocialGraph
  console.log("\nDeploying SocialGraph...");
  const SocialGraph = await ethers.getContractFactory("SocialGraph");
  const socialGraph = await upgrades.deployProxy(SocialGraph, [deployedContracts.XPEngine], { initializer: 'initialize', kind: 'uups' });
  await socialGraph.waitForDeployment();
  deployedContracts.SocialGraph = await socialGraph.getAddress();
  console.log("✅ SocialGraph deployed at:", deployedContracts.SocialGraph);

  // 2. Deploy QuestRegistry
// ensure deployedContracts contains addresses for XPEngine and BadgeMinter (or deploy them earlier)
console.log("\nDeploying QuestRegistry...");
const QuestRegistry = await ethers.getContractFactory("QuestRegistry");

// prepare the 7 initializer args
const defaultAdminAddr = deployedContracts.DEFAULT_ADMIN || deployer.address;
const questAdminAddr   = deployedContracts.QUEST_ADMIN   || deployer.address;
const pauserAddr       = deployedContracts.PAUSER        || deployer.address;
const upgraderAddr     = deployedContracts.UPGRADER      || deployer.address;
const questSignerAddr  = deployedContracts.QUEST_SIGNER  || deployer.address;

// make sure XPEngine and BadgeMinter are valid addresses (if they are proxies, getAddress())
let xpEngineAddr = deployedContracts.XPEngine;
if (!xpEngineAddr) throw new Error("XPEngine address missing in deployedContracts");
let badgeMinterAddr = deployedContracts.BadgeMinter;
if (!badgeMinterAddr) throw new Error("BadgeMinter address missing in deployedContracts");

// if the objects in deployedContracts are proxy contract objects, normalize to addresses:
// (uncomment the following lines if deployedContracts stores contract instances instead of raw addresses)
// if (typeof xpEngineAddr.getAddress === "function") xpEngineAddr = await xpEngineAddr.getAddress();
// if (typeof badgeMinterAddr.getAddress === "function") badgeMinterAddr = await badgeMinterAddr.getAddress();

const initializerArgs = [
  defaultAdminAddr,
  questAdminAddr,
  pauserAddr,
  upgraderAddr,
  questSignerAddr,
  xpEngineAddr,
  badgeMinterAddr
];

const questRegistry = await upgrades.deployProxy(
  QuestRegistry,
  initializerArgs,
  { initializer: "initialize", kind: "uups" }
);
await questRegistry.waitForDeployment();
deployedContracts.QuestRegistry = await questRegistry.getAddress();
console.log("✅ QuestRegistry deployed at:", deployedContracts.QuestRegistry);

  // 3. Deploy Streak Contracts
  console.log("\nDeploying StreakCore...");
  const StreakCore = await ethers.getContractFactory("StreakCore");
  const streakCore = await upgrades.deployProxy(StreakCore, [], { initializer: 'initialize', kind: 'uups' });
  await streakCore.waitForDeployment();
  deployedContracts.StreakCore = await streakCore.getAddress();
  console.log("✅ StreakCore deployed at:", deployedContracts.StreakCore);

  console.log("\nDeploying StreakRewards...");
  const StreakRewards = await ethers.getContractFactory("StreakRewards");
  const streakRewards = await upgrades.deployProxy(StreakRewards, [deployedContracts.XPEngine, deployedContracts.BadgeMinter, deployedContracts.StreakCore], { initializer: 'initialize', kind: 'uups' });
  await streakRewards.waitForDeployment();
  deployedContracts.StreakRewards = await streakRewards.getAddress();
  console.log("✅ StreakRewards deployed at:", deployedContracts.StreakRewards);

  console.log("\nDeploying StreakMilestones...");
  const StreakMilestones = await ethers.getContractFactory("StreakMilestones");
  const streakMilestones = await upgrades.deployProxy(StreakMilestones, [deployedContracts.XPEngine, deployedContracts.BadgeMinter, deployedContracts.StreakCore], { initializer: 'initialize', kind: 'uups' });
  await streakMilestones.waitForDeployment();
  deployedContracts.StreakMilestones = await streakMilestones.getAddress();
  console.log("✅ StreakMilestones deployed at:", deployedContracts.StreakMilestones);

  // 4. Deploy DynamicQuestEngine
  console.log("\nDeploying DynamicQuestEngine...");
  const DynamicQuestEngine = await ethers.getContractFactory("DynamicQuestEngine");
  const dynamicQuestEngine = await upgrades.deployProxy(DynamicQuestEngine, [deployedContracts.XPEngine, 5], { initializer: 'initialize', kind: 'uups' });
  await dynamicQuestEngine.waitForDeployment();
  deployedContracts.DynamicQuestEngine = await dynamicQuestEngine.getAddress();
  console.log("✅ DynamicQuestEngine deployed at:", deployedContracts.DynamicQuestEngine);

// --- Granting Roles ---
  console.log("\n--- Setting Up Access Control ---");
  const xpEngine = await ethers.getContractAt("XPEngine", deployedContracts.XPEngine);
  const badgeMinter = await ethers.getContractAt("BadgeMinter", deployedContracts.BadgeMinter);
  const xpAwarderRole = ethers.keccak256(ethers.toUtf8Bytes("XP_AWARDER_ROLE"));
  const minterRole = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  console.log("Granting XP_AWARDER_ROLE to SocialGraph, QuestRegistry, and StreakRewards...");
  await xpEngine.grantRole(await xpEngine.DEFAULT_ADMIN_ROLE(), deployer.address);
  await badgeMinter.grantRole(await badgeMinter.DEFAULT_ADMIN_ROLE(), deployer.address);
  await xpEngine.grantRole(xpAwarderRole, deployedContracts.SocialGraph);
  await xpEngine.grantRole(xpAwarderRole, deployedContracts.QuestRegistry);
  await xpEngine.grantRole(xpAwarderRole, deployedContracts.StreakRewards);
  console.log("✅ Roles granted.");

  console.log("Granting MINTER_ROLE to QuestRegistry and StreakMilestones...");
  await badgeMinter.grantRole(minterRole, deployedContracts.QuestRegistry);
  await badgeMinter.grantRole(minterRole, deployedContracts.StreakMilestones);
  console.log("✅ Roles granted.");

  // --- Save Deployment Info ---
  const deploymentData = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployedContracts,
  };

  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-phase2-deployment.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

  console.log("\n🎉 Phase 2 Deployment Complete!");
  console.log("📄 Deployment details saved to:", deploymentPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
