/**
 * @title Upgrade Management System
 * @dev Handles upgrades for all upgradeable contracts with safety checks
 * @author Avax Forge Empire Team
 */

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Contract upgrade configurations
const UPGRADE_CONFIG = {
  // Safety checks
  SAFETY_CHECKS: {
    storageLayoutCheck: true,
    initializerCheck: true,
    constructorCheck: true,
    nonProxyableCheck: true,
  },
  
  // Upgrade timelock (in seconds)
  TIMELOCK_DELAY: 3600 * 24 * 2, // 48 hours
  
  // Contracts that support upgrades
  UPGRADEABLE_CONTRACTS: [
    "XPEngine",
    "BadgeMinter", 
    "ForgePass",
    "ProfileRegistry",
    "QuestRegistry",
    "TokenManagerCore",
    "TokenLauncher",
    "CommunityDAO",
    "CommunityRewards",
    "StakingRewards",
    "ReferralEngine",
    "TipJar",
    "VestingWalletFactory"
  ]
};

async function main() {
  const action = process.argv[2];
  const contractName = process.argv[3];
  
  console.log("🔧 Avax Forge Empire Upgrade Management System\n");
  
  switch (action) {
    case "prepare":
      await prepareUpgrade(contractName);
      break;
    case "propose":
      await proposeUpgrade(contractName);
      break;
    case "execute":
      await executeUpgrade(contractName);
      break;
    case "status":
      await checkUpgradeStatus(contractName);
      break;
    case "validate":
      await validateUpgrade(contractName);
      break;
    case "list":
      await listUpgrades();
      break;
    default:
      printUsage();
  }
}

async function prepareUpgrade(contractName) {
  if (!contractName) {
    console.error("❌ Contract name is required for prepare action");
    process.exit(1);
  }
  
  if (!UPGRADE_CONFIG.UPGRADEABLE_CONTRACTS.includes(contractName)) {
    console.error(`❌ ${contractName} is not in the list of upgradeable contracts`);
    process.exit(1);
  }
  
  console.log(`🔍 Preparing upgrade for ${contractName}...`);
  
  try {
    // Load current deployment
    const deploymentPath = path.join(__dirname, `../deployments/${network.name}-deployment.json`);
    if (!fs.existsSync(deploymentPath)) {
      console.error("❌ Deployment file not found:", deploymentPath);
      process.exit(1);
    }
    
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const currentAddress = deploymentData.contracts[contractName];
    
    if (!currentAddress) {
      console.error(`❌ ${contractName} not found in deployment data`);
      process.exit(1);
    }
    
    console.log(`📄 Current ${contractName} address:`, currentAddress);
    
    // Get the new implementation
    const ContractFactory = await ethers.getContractFactory(contractName);
    
    // Validate the upgrade
    console.log("🔍 Validating upgrade compatibility...");
    await upgrades.validateUpgrade(currentAddress, ContractFactory, UPGRADE_CONFIG.SAFETY_CHECKS);
    console.log("✅ Upgrade validation passed");
    
    // Prepare the upgrade
    console.log("⚙️  Preparing upgrade implementation...");
    const newImplementationAddress = await upgrades.prepareUpgrade(currentAddress, ContractFactory);
    console.log("✅ New implementation deployed at:", newImplementationAddress);
    
    // Save upgrade information
    const upgradeData = {
      contractName,
      network: network.name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      proxyAddress: currentAddress,
      oldImplementation: await upgrades.erc1967.getImplementationAddress(currentAddress),
      newImplementation: newImplementationAddress,
      timestamp: new Date().toISOString(),
      status: "prepared",
      preparedBy: (await ethers.getSigners())[0].address
    };
    
    const upgradesDir = path.join(__dirname, "../upgrades");
    if (!fs.existsSync(upgradesDir)) {
      fs.mkdirSync(upgradesDir, { recursive: true });
    }
    
    const upgradeFilePath = path.join(upgradesDir, `${contractName}-${Date.now()}.json`);
    fs.writeFileSync(upgradeFilePath, JSON.stringify(upgradeData, null, 2));
    
    console.log("📄 Upgrade prepared and saved to:", upgradeFilePath);
    console.log("\n📋 Next steps:");
    console.log("1. Review the upgrade implementation");
    console.log("2. Run integration tests");
    console.log(`3. Propose upgrade: npm run upgrade:propose ${contractName}`);
    
  } catch (error) {
    console.error(`❌ Failed to prepare upgrade for ${contractName}:`, error.message);
    process.exit(1);
  }
}

async function proposeUpgrade(contractName) {
  console.log(`📝 Proposing upgrade for ${contractName}...`);
  
  // Find the latest prepared upgrade
  const upgradesDir = path.join(__dirname, "../upgrades");
  const upgradeFiles = fs.readdirSync(upgradesDir)
    .filter(file => file.startsWith(contractName) && file.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a)); // Most recent first
  
  if (upgradeFiles.length === 0) {
    console.error(`❌ No prepared upgrades found for ${contractName}`);
    console.log("Run prepare command first");
    process.exit(1);
  }
  
  const latestUpgradeFile = path.join(upgradesDir, upgradeFiles[0]);
  const upgradeData = JSON.parse(fs.readFileSync(latestUpgradeFile, 'utf8'));
  
  if (upgradeData.status !== "prepared") {
    console.error(`❌ Upgrade status is ${upgradeData.status}, expected 'prepared'`);
    process.exit(1);
  }
  
  try {
    // Create governance proposal (if governance is deployed)
    console.log("🗳️  Creating governance proposal...");
    
    // Update upgrade status
    upgradeData.status = "proposed";
    upgradeData.proposedAt = new Date().toISOString();
    upgradeData.proposedBy = (await ethers.getSigners())[0].address;
    upgradeData.executionTime = new Date(Date.now() + UPGRADE_CONFIG.TIMELOCK_DELAY * 1000).toISOString();
    
    fs.writeFileSync(latestUpgradeFile, JSON.stringify(upgradeData, null, 2));
    
    console.log("✅ Upgrade proposal created");
    console.log("⏰ Execution time:", upgradeData.executionTime);
    console.log("📄 Proposal saved to:", latestUpgradeFile);
    
  } catch (error) {
    console.error(`❌ Failed to propose upgrade for ${contractName}:`, error.message);
    process.exit(1);
  }
}

async function executeUpgrade(contractName) {
  console.log(`⚡ Executing upgrade for ${contractName}...`);
  
  // Find the proposed upgrade
  const upgradesDir = path.join(__dirname, "../upgrades");
  const upgradeFiles = fs.readdirSync(upgradesDir)
    .filter(file => file.startsWith(contractName) && file.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));
  
  if (upgradeFiles.length === 0) {
    console.error(`❌ No upgrades found for ${contractName}`);
    process.exit(1);
  }
  
  const latestUpgradeFile = path.join(upgradesDir, upgradeFiles[0]);
  const upgradeData = JSON.parse(fs.readFileSync(latestUpgradeFile, 'utf8'));
  
  if (upgradeData.status !== "proposed") {
    console.error(`❌ Upgrade status is ${upgradeData.status}, expected 'proposed'`);
    process.exit(1);
  }
  
  // Check timelock
  const executionTime = new Date(upgradeData.executionTime);
  const now = new Date();
  
  if (now < executionTime) {
    console.error(`❌ Timelock not expired. Can execute after: ${executionTime.toISOString()}`);
    process.exit(1);
  }
  
  try {
    console.log("🔄 Executing upgrade...");
    
    const ContractFactory = await ethers.getContractFactory(contractName);
    const upgraded = await upgrades.upgradeProxy(upgradeData.proxyAddress, ContractFactory);
    await upgraded.waitForDeployment();
    
    console.log("✅ Upgrade executed successfully");
    console.log("📄 Proxy address (unchanged):", upgradeData.proxyAddress);
    console.log("🔄 New implementation:", await upgrades.erc1967.getImplementationAddress(upgradeData.proxyAddress));
    
    // Update upgrade status
    upgradeData.status = "executed";
    upgradeData.executedAt = new Date().toISOString();
    upgradeData.executedBy = (await ethers.getSigners())[0].address;
    upgradeData.finalImplementation = await upgrades.erc1967.getImplementationAddress(upgradeData.proxyAddress);
    
    fs.writeFileSync(latestUpgradeFile, JSON.stringify(upgradeData, null, 2));
    
    console.log("📄 Upgrade record updated:", latestUpgradeFile);
    
    // Update deployment file
    const deploymentPath = path.join(__dirname, `../deployments/${network.name}-deployment.json`);
    if (fs.existsSync(deploymentPath)) {
      const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      deploymentData.lastUpgrade = {
        contract: contractName,
        timestamp: upgradeData.executedAt,
        implementation: upgradeData.finalImplementation
      };
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    }
    
  } catch (error) {
    console.error(`❌ Failed to execute upgrade for ${contractName}:`, error.message);
    
    // Update status to failed
    upgradeData.status = "failed";
    upgradeData.failedAt = new Date().toISOString();
    upgradeData.error = error.message;
    fs.writeFileSync(latestUpgradeFile, JSON.stringify(upgradeData, null, 2));
    
    process.exit(1);
  }
}

async function checkUpgradeStatus(contractName) {
  console.log(`📊 Checking upgrade status for ${contractName || 'all contracts'}...\n`);
  
  const upgradesDir = path.join(__dirname, "../upgrades");
  if (!fs.existsSync(upgradesDir)) {
    console.log("📄 No upgrades directory found");
    return;
  }
  
  const upgradeFiles = fs.readdirSync(upgradesDir)
    .filter(file => file.endsWith('.json'))
    .filter(file => !contractName || file.startsWith(contractName));
  
  if (upgradeFiles.length === 0) {
    console.log(`📄 No upgrades found${contractName ? ` for ${contractName}` : ''}`);
    return;
  }
  
  for (const file of upgradeFiles) {
    const upgradeData = JSON.parse(fs.readFileSync(path.join(upgradesDir, file), 'utf8'));
    
    console.log(`📋 ${upgradeData.contractName}:`);
    console.log(`   Status: ${getStatusEmoji(upgradeData.status)} ${upgradeData.status}`);
    console.log(`   Proxy: ${upgradeData.proxyAddress}`);
    console.log(`   Implementation: ${upgradeData.finalImplementation || upgradeData.newImplementation}`);
    console.log(`   Updated: ${upgradeData.executedAt || upgradeData.proposedAt || upgradeData.timestamp}`);
    
    if (upgradeData.status === "proposed") {
      console.log(`   ⏰ Can execute after: ${upgradeData.executionTime}`);
    }
    
    if (upgradeData.error) {
      console.log(`   ❌ Error: ${upgradeData.error}`);
    }
    
    console.log();
  }
}

async function validateUpgrade(contractName) {
  console.log(`🔍 Validating upgrade compatibility for ${contractName}...`);
  
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-deployment.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Deployment file not found");
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const currentAddress = deploymentData.contracts[contractName];
  
  if (!currentAddress) {
    console.error(`❌ ${contractName} not found in deployments`);
    process.exit(1);
  }
  
  try {
    const ContractFactory = await ethers.getContractFactory(contractName);
    await upgrades.validateUpgrade(currentAddress, ContractFactory, UPGRADE_CONFIG.SAFETY_CHECKS);
    
    console.log("✅ Upgrade validation passed");
    console.log("📋 Validation checks:");
    console.log("   ✅ Storage layout compatibility");
    console.log("   ✅ Initializer compatibility");
    console.log("   ✅ Constructor safety");
    console.log("   ✅ Proxy compatibility");
    
  } catch (error) {
    console.error("❌ Upgrade validation failed:", error.message);
    process.exit(1);
  }
}

async function listUpgrades() {
  console.log("📋 Available upgradeable contracts:\n");
  
  for (const contractName of UPGRADE_CONFIG.UPGRADEABLE_CONTRACTS) {
    console.log(`   ${contractName}`);
  }
  
  console.log(`\n📊 Total: ${UPGRADE_CONFIG.UPGRADEABLE_CONTRACTS.length} contracts`);
}

function getStatusEmoji(status) {
  const emojis = {
    "prepared": "⚙️",
    "proposed": "📝",
    "executed": "✅",
    "failed": "❌"
  };
  return emojis[status] || "❓";
}

function printUsage() {
  console.log("Usage: npm run upgrade:<action> [contractName]");
  console.log("\nActions:");
  console.log("  prepare <contract>  - Prepare upgrade implementation");
  console.log("  propose <contract>  - Propose upgrade for governance");
  console.log("  execute <contract>  - Execute approved upgrade");
  console.log("  status [contract]   - Check upgrade status");
  console.log("  validate <contract> - Validate upgrade compatibility");
  console.log("  list               - List upgradeable contracts");
  console.log("\nExample:");
  console.log("  npm run upgrade:prepare BadgeMinter");
  console.log("  npm run upgrade:status");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});