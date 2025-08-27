/**
 * @title Full System Deployment
 * @dev Deploys all contracts for all phases.
 * @author Avax Forge Empire Team
 */

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("🚀 Starting Full System Deployment...\n");
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Phase 1: Foundation & Core Loop
  console.log("--- Starting Phase 1 ---");
  const deployedContracts = {};

  console.log("Deploying MockERC20 for TipJar...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy("Mock Token", "MOCK");
  await mockToken.waitForDeployment();
  deployedContracts.MockERC20 = await mockToken.getAddress();
  console.log("✅ MockERC20 deployed at:", deployedContracts.MockERC20);

  console.log("\nDeploying XPEngine...");
  const XPEngine = await ethers.getContractFactory("XPEngine");
  const xpEngine = await upgrades.deployProxy(XPEngine, [], { initializer: 'initialize', kind: 'uups' });
  await xpEngine.waitForDeployment();
  deployedContracts.XPEngine = await xpEngine.getAddress();
  console.log("✅ XPEngine deployed at:", deployedContracts.XPEngine);

  console.log("\nDeploying BadgeMinter...");
  const BadgeMinter = await ethers.getContractFactory("BadgeMinter");
  const badgeMinter = await upgrades.deployProxy(BadgeMinter, [deployedContracts.XPEngine], { initializer: 'initialize', kind: 'uups' });
  await badgeMinter.waitForDeployment();
  deployedContracts.BadgeMinter = await badgeMinter.getAddress();
  console.log("✅ BadgeMinter deployed at:", deployedContracts.BadgeMinter);

  console.log("\nDeploying ProfileRegistry...");
  const ProfileRegistry = await ethers.getContractFactory("ProfileRegistry");
  const profileRegistry = await upgrades.deployProxy(ProfileRegistry, [deployedContracts.BadgeMinter], { initializer: 'initialize', kind: 'uups' });
  await profileRegistry.waitForDeployment();
  deployedContracts.ProfileRegistry = await profileRegistry.getAddress();
  console.log("✅ ProfileRegistry deployed at:", deployedContracts.ProfileRegistry);

  console.log("\nDeploying OnboardingQuests...");
  const OnboardingQuests = await ethers.getContractFactory("OnboardingQuests");
  const onboardingQuests = await upgrades.deployProxy(OnboardingQuests, [deployedContracts.XPEngine, deployedContracts.BadgeMinter], { initializer: 'initialize', kind: 'uups' });
  await onboardingQuests.waitForDeployment();
  deployedContracts.OnboardingQuests = await onboardingQuests.getAddress();
  console.log("✅ OnboardingQuests deployed at:", deployedContracts.OnboardingQuests);

  console.log("\nDeploying Kudos...");
  const Kudos = await ethers.getContractFactory("Kudos");
  const kudos = await Kudos.deploy();
  await kudos.waitForDeployment();
  deployedContracts.Kudos = await kudos.getAddress();
  console.log("✅ Kudos deployed at:", deployedContracts.Kudos);

  console.log("\nDeploying TipJar...");
  const TipJar = await ethers.getContractFactory("TipJar");
  const tipJar = await upgrades.deployProxy(TipJar, [deployedContracts.MockERC20], { initializer: 'initialize', kind: 'uups' });
  await tipJar.waitForDeployment();
  deployedContracts.TipJar = await tipJar.getAddress();
  console.log("✅ TipJar deployed at:", deployedContracts.TipJar);

  console.log("\n--- Setting Up Phase 1 Access Control ---");
  const xpAwarderRole = ethers.keccak256(ethers.toUtf8Bytes("XP_AWARDER_ROLE"));
  const minterRole = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  console.log("Granting XP_AWARDER_ROLE to OnboardingQuests...");
  await xpEngine.grantRole(xpAwarderRole, deployedContracts.OnboardingQuests);
  console.log("✅ Role granted.");

  console.log("Granting MINTER_ROLE to OnboardingQuests...");
  await badgeMinter.grantRole(minterRole, deployedContracts.OnboardingQuests);
  console.log("✅ Role granted.");

  // Phase 2: Engagement & Social Expansion
  console.log("\n--- Starting Phase 2 ---");

  console.log("\nDeploying SocialGraph...");
  const SocialGraph = await ethers.getContractFactory("SocialGraph");
  const socialGraph = await upgrades.deployProxy(SocialGraph, [deployedContracts.XPEngine], { initializer: 'initialize', kind: 'uups' });
  await socialGraph.waitForDeployment();
  deployedContracts.SocialGraph = await socialGraph.getAddress();
  console.log("✅ SocialGraph deployed at:", deployedContracts.SocialGraph);

  console.log("\nDeploying QuestRegistry...");
  const QuestRegistry = await ethers.getContractFactory("QuestRegistry");
  const questRegistry = await upgrades.deployProxy(QuestRegistry, [deployedContracts.XPEngine, deployedContracts.BadgeMinter], { initializer: 'initialize', kind: 'uups' });
  await questRegistry.waitForDeployment();
  deployedContracts.QuestRegistry = await questRegistry.getAddress();
  console.log("✅ QuestRegistry deployed at:", deployedContracts.QuestRegistry);

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

  console.log("\nDeploying DynamicQuestEngine...");
  const DynamicQuestEngine = await ethers.getContractFactory("DynamicQuestEngine");
  const dynamicQuestEngine = await upgrades.deployProxy(DynamicQuestEngine, [deployedContracts.XPEngine, 5], { initializer: 'initialize', kind: 'uups' });
  await dynamicQuestEngine.waitForDeployment();
  deployedContracts.DynamicQuestEngine = await dynamicQuestEngine.getAddress();
  console.log("✅ DynamicQuestEngine deployed at:", deployedContracts.DynamicQuestEngine);

  console.log("\n--- Setting Up Phase 2 Access Control ---");

  console.log("Granting XP_AWARDER_ROLE to SocialGraph, QuestRegistry, and StreakRewards...");
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

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const deploymentPath = path.join(deploymentsDir, `${network.name}-full-deployment.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

  console.log("\n🎉 Full System Deployment Complete!");
  console.log("📄 Deployment details saved to:", deploymentPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
