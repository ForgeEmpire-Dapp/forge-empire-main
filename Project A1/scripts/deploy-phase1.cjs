/**
 * @title Phase 1 Deployment: Foundation & Core Loop
 * @dev Deploys contracts for the initial closed alpha phase.
 * @author Avax Forge Empire Team
 */

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Phase 1 Deployment: Foundation & Core Loop...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  const deployedContracts = {};

  // Deploy a MockERC20 for TipJar in this phase. The real token comes later.
  console.log("Deploying MockERC20 for TipJar...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy("Mock Token", "MOCK");
  await mockToken.waitForDeployment();
  deployedContracts.MockERC20 = await mockToken.getAddress();
  console.log("✅ MockERC20 deployed at:", deployedContracts.MockERC20);

  // 1. Deploy XPEngine
  console.log("\nDeploying XPEngine...");
  const XPEngine = await ethers.getContractFactory("XPEngine");
  const xpEngine = await upgrades.deployProxy(XPEngine, [], { initializer: 'initialize', kind: 'uups' });
  await xpEngine.waitForDeployment();
  deployedContracts.XPEngine = await xpEngine.getAddress();
  console.log("✅ XPEngine deployed at:", deployedContracts.XPEngine);

  // 2. Deploy BadgeMinter
  console.log("\nDeploying BadgeMinter...");
  const BadgeMinter = await ethers.getContractFactory("BadgeMinter");
  const badgeMinter = await upgrades.deployProxy(BadgeMinter, [deployedContracts.XPEngine], { initializer: 'initialize', kind: 'uups' });
  await badgeMinter.waitForDeployment();
  deployedContracts.BadgeMinter = await badgeMinter.getAddress();
  console.log("✅ BadgeMinter deployed at:", deployedContracts.BadgeMinter);

  // 3. Deploy ProfileRegistry
  console.log("\nDeploying ProfileRegistryV2...");
  const ProfileRegistryV2 = await ethers.getContractFactory("ProfileRegistryV2");
  const profileRegistryV2 = await upgrades.deployProxy(ProfileRegistryV2, [deployedContracts.BadgeMinter], { initializer: 'initialize', kind: 'uups' });
  await profileRegistryV2.waitForDeployment();
  deployedContracts.ProfileRegistryV2 = await profileRegistryV2.getAddress();
  console.log("✅ ProfileRegistry deployed at:", deployedContracts.ProfileRegistryV2);

  // 4. Deploy OnboardingQuests
  console.log("\nDeploying OnboardingQuests...");
  const OnboardingQuests = await ethers.getContractFactory("OnboardingQuests");
  const onboardingQuests = await upgrades.deployProxy(OnboardingQuests, [deployedContracts.XPEngine, deployedContracts.BadgeMinter], { initializer: 'initialize', kind: 'uups' });
  await onboardingQuests.waitForDeployment();
  deployedContracts.OnboardingQuests = await onboardingQuests.getAddress();
  console.log("✅ OnboardingQuests deployed at:", deployedContracts.OnboardingQuests);

  // 5. Deploy Kudos
  console.log("\nDeploying Kudos...");
  const Kudos = await ethers.getContractFactory("Kudos");
  const kudos = await Kudos.deploy();
  await kudos.waitForDeployment();
  deployedContracts.Kudos = await kudos.getAddress();
  console.log("✅ Kudos deployed at:", deployedContracts.Kudos);

  // 6. Deploy TipJar
  console.log("\nDeploying TipJar...");
  const TipJar = await ethers.getContractFactory("TipJar");
  const tipJar = await upgrades.deployProxy(TipJar, [deployedContracts.MockERC20], { initializer: 'initialize', kind: 'uups' });
  await tipJar.waitForDeployment();
  deployedContracts.TipJar = await tipJar.getAddress();
  console.log("✅ TipJar deployed at:", deployedContracts.TipJar);

  // --- Granting Roles ---
  console.log("\n--- Setting Up Access Control ---");
  const xpAwarderRole = ethers.keccak256(ethers.toUtf8Bytes("XP_AWARDER_ROLE"));
  const minterRole = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  console.log("Granting XP_AWARDER_ROLE to OnboardingQuests...");
  await xpEngine.grantRole(await xpEngine.DEFAULT_ADMIN_ROLE(), deployer.address);
  await badgeMinter.grantRole(await badgeMinter.DEFAULT_ADMIN_ROLE(), deployer.address);
  await xpEngine.grantRole(xpAwarderRole, deployedContracts.OnboardingQuests);
  console.log("✅ Role granted.");

  console.log("Granting MINTER_ROLE to OnboardingQuests...");
  await badgeMinter.grantRole(minterRole, deployedContracts.OnboardingQuests);
  console.log("✅ Role granted.");

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
  const deploymentPath = path.join(deploymentsDir, `${network.name}-phase1-deployment.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

  console.log("\n🎉 Phase 1 Deployment Complete!");
  console.log("📄 Deployment details saved to:", deploymentPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
