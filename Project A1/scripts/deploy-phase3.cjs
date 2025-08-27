/**
 * @title Phase 3 Deployment: Monetization & DeFi
 * @dev Deploys contracts for the limited mainnet phase.
 * @author Avax Forge Empire Team
 */

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Phase 3 Deployment: Monetization & DeFi...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Deploying contracts with account:", deployer.address);

  // Load Phase 2 deployment data
  const phase2DeploymentPath = path.join(__dirname, `../deployments/${network.name}-phase2-deployment.json`);
  if (!fs.existsSync(phase2DeploymentPath)) {
    throw new Error(`Phase 2 deployment file not found for network: ${network.name}. Please run the Phase 2 deployment first.`);
  }
  const phase2Data = JSON.parse(fs.readFileSync(phase2DeploymentPath));
  const deployedContracts = phase2Data.contracts;

  // 1. Deploy ForgeTokenCore
  console.log("\nDeploying ForgeTokenCore...");
  const ForgeTokenCore = await ethers.getContractFactory("ForgeTokenCore");
  const forgeTokenCore = await upgrades.deployProxy(ForgeTokenCore, [], { initializer: 'initialize', kind: 'uups' });
  await forgeTokenCore.waitForDeployment();
  deployedContracts.ForgeTokenCore = await forgeTokenCore.getAddress();
  console.log("✅ ForgeTokenCore deployed at:", deployedContracts.ForgeTokenCore);

  // 2. Deploy TokenLauncher
  console.log("\nDeploying TokenLauncher...");
  const TokenLauncher = await ethers.getContractFactory("TokenLauncher");
  const tokenLauncher = await TokenLauncher.deploy(deployer.address); // Assuming deployer is the initial manager
  await tokenLauncher.waitForDeployment();
  deployedContracts.TokenLauncher = await tokenLauncher.getAddress();
  console.log("✅ TokenLauncher deployed at:", deployedContracts.TokenLauncher);

  // 3. Deploy StakingRewards
  console.log("\nDeploying StakingRewards...");
  const StakingRewards = await ethers.getContractFactory("StakingRewards");
  const stakingRewards = await StakingRewards.deploy(deployedContracts.ForgeTokenCore, deployedContracts.ForgeTokenCore);
  await stakingRewards.waitForDeployment();
  deployedContracts.StakingRewards = await stakingRewards.getAddress();
  console.log("✅ StakingRewards deployed at:", deployedContracts.StakingRewards);

  // 4. Deploy ForgePass
  console.log("\nDeploying ForgePass...");
  const ForgePass = await ethers.getContractFactory("ForgePass");
  const forgePass = await upgrades.deployProxy(ForgePass, [], { initializer: 'initialize', kind: 'uups' });
  await forgePass.waitForDeployment();
  deployedContracts.ForgePass = await forgePass.getAddress();
  console.log("✅ ForgePass deployed at:", deployedContracts.ForgePass);

  // 5. Deploy VestingWalletFactory and CommunityRewards
  console.log("\nDeploying VestingWalletFactory...");
  const VestingWalletFactory = await ethers.getContractFactory("VestingWalletFactory");
  const vestingWalletFactory = await VestingWalletFactory.deploy();
  await vestingWalletFactory.waitForDeployment();
  deployedContracts.VestingWalletFactory = await vestingWalletFactory.getAddress();
  console.log("✅ VestingWalletFactory deployed at:", deployedContracts.VestingWalletFactory);

  console.log("\nDeploying CommunityRewards...");
  const CommunityRewards = await ethers.getContractFactory("CommunityRewards");
  const communityRewards = await CommunityRewards.deploy(deployedContracts.ForgeTokenCore, deployedContracts.VestingWalletFactory);
  await communityRewards.waitForDeployment();
  deployedContracts.CommunityRewards = await communityRewards.getAddress();
  console.log("✅ CommunityRewards deployed at:", deployedContracts.CommunityRewards);

  // --- Granting Roles ---
  console.log("\n--- Setting Up Access Control ---");
  const forgeTokenCoreContract = await ethers.getContractAt("ForgeTokenCore", deployedContracts.ForgeTokenCore);
  const minterRole = await forgeTokenCoreContract.MINTER_ROLE();

  console.log("Granting MINTER_ROLE to StakingRewards and CommunityRewards...");
  await forgeTokenCoreContract.grantRole(minterRole, deployedContracts.StakingRewards);
  await forgeTokenCoreContract.grantRole(minterRole, deployedContracts.CommunityRewards);
  console.log("✅ Roles granted.");

  // --- Save Deployment Info ---
  const deploymentData = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployedContracts,
  };

  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-phase3-deployment.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

  console.log("\n🎉 Phase 3 Deployment Complete!");
  console.log("📄 Deployment details saved to:", deploymentPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
