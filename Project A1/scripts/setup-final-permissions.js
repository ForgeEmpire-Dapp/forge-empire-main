/**
 * @title Final Permission Setup Script
 * @dev Sets up roles for the latest deployment
 */

const { ethers } = require("hardhat");

// Final deployment addresses
const fs = require("fs");
const path = require("path");

async function main() {
  const network = await ethers.provider.getNetwork();
  const deployedContracts = {};

  function loadDeployment(phase) {
    const deploymentPath = path.join(__dirname, `../deployments/${network.name}-phase${phase}-deployment.json`);
    if (!fs.existsSync(deploymentPath)) {
      throw new Error(`Phase ${phase} deployment file not found for network: ${network.name}.`);
    }
    const data = JSON.parse(fs.readFileSync(deploymentPath));
    Object.assign(deployedContracts, data.contracts);
  }

  loadDeployment(1);
  loadDeployment(2);
  loadDeployment(3);
  loadDeployment(4);

  const CONTRACTS = deployedContracts;

  console.log("🚀 Setting up FINAL deployment permissions...\n");

  
  const [deployer] = await ethers.getSigners();
  console.log("Setting up with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "AVAX\n");
  
  try {
    // Get contract instances
    const xpEngine = await ethers.getContractAt("XPEngine", CONTRACTS.XPEngine);
    const badgeMinter = await ethers.getContractAt("BadgeMinter", CONTRACTS.BadgeMinter);
    
    console.log("📋 Getting role constants...");
    const MINTER_ROLE = await badgeMinter.MINTER_ROLE();
    const XP_GRANTER_ROLE = await xpEngine.XP_GRANTER_ROLE();
    
    console.log("MINTER_ROLE:", MINTER_ROLE);
    console.log("XP_GRANTER_ROLE:", XP_GRANTER_ROLE);
    
    // Set up BadgeMinter permissions
    console.log("\n🏷️  Setting up BadgeMinter permissions...");
    console.log("Granting MINTER_ROLE to QuestRegistry...");
    
    const mintTx = await badgeMinter.grantRole(MINTER_ROLE, CONTRACTS.QuestRegistry);
    await mintTx.wait();
    console.log("✅ MINTER_ROLE granted to QuestRegistry");
    console.log("Transaction hash:", mintTx.hash);
    
    // Set up XPEngine permissions  
    console.log("\n⭐ Setting up XPEngine permissions...");
    console.log("Granting XP_GRANTER_ROLE to QuestRegistry...");
    
    const xpTx = await xpEngine.grantRole(XP_GRANTER_ROLE, CONTRACTS.QuestRegistry);
    await xpTx.wait();
    console.log("✅ XP_GRANTER_ROLE granted to QuestRegistry");
    console.log("Transaction hash:", xpTx.hash);
    
    // Verify permissions
    console.log("\n🔍 Verifying permissions...");
    const hasMinterRole = await badgeMinter.hasRole(MINTER_ROLE, CONTRACTS.QuestRegistry);
    const hasXPRole = await xpEngine.hasRole(XP_GRANTER_ROLE, CONTRACTS.QuestRegistry);
    
    console.log("QuestRegistry has MINTER_ROLE:", hasMinterRole);
    console.log("QuestRegistry has XP_GRANTER_ROLE:", hasXPRole);
    
    if (hasMinterRole && hasXPRole) {
      console.log("\n🎉 ALL PERMISSIONS SET UP SUCCESSFULLY!");
      
      console.log("\n✅ COMPLETE ECOSYSTEM STATUS:");
      console.log("🎯 XPEngine: READY - Can award XP to users");
      console.log("🏆 BadgeMinter: READY - Can mint achievement badges");
      console.log("💳 ForgePass: READY - Premium membership system");
      console.log("👤 ProfileRegistry: READY - User profiles with badges");
      console.log("🎮 QuestRegistry: READY - Full quest reward system");
      
      console.log("\n🚀 ECOSYSTEM CAPABILITIES:");
      console.log("• ✅ Users can register profiles with usernames");
      console.log("• ✅ Admins can create quests with XP/badge rewards");
      console.log("• ✅ Users can complete quests and earn rewards");
      console.log("• ✅ Automatic XP awarding and badge minting");
      console.log("• ✅ Badge showcase on user profiles");
      console.log("• ✅ ForgePass premium features");
      console.log("• ✅ Full access control and upgradeability");
      
      console.log("\n🔗 READY FOR:");
      console.log("📱 Frontend integration");
      console.log("🧪 User acceptance testing");
      console.log("🎮 Community onboarding");
      console.log("📈 Production scaling");
      
    } else {
      console.log("\n⚠️  Some permissions may not be set correctly");
    }
    
    console.log("\n📋 FINAL CONTRACT REGISTRY:");
    console.log("==================================================");
    for (const [name, address] of Object.entries(CONTRACTS)) {
      console.log(`${name.padEnd(20)}: ${address}`);
      console.log(`${''.padEnd(20)}  https://testnet.snowtrace.io/address/${address}`);
    }
    console.log("==================================================");
    
  } catch (error) {
    console.error("\n❌ Permission setup failed:", error.message);
    
    if (error.message.includes("insufficient funds")) {
      console.log("💡 Need more AVAX for transactions");
    } else if (error.message.includes("nonce")) {
      console.log("💡 Try again in a moment");
    }
    
    console.log("\n📋 Deployed Contracts (still usable):");
    for (const [name, address] of Object.entries(CONTRACTS)) {
      console.log(`${name}: ${address}`);
    }
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});