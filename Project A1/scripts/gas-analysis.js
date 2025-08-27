/**
 * @title Gas Analysis Script
 * @dev Analyzes gas usage patterns across all contracts
 * @author Avax Forge Empire Team
 */

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Starting Gas Analysis for Avax Forge Empire Contracts...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Analyzing with account:", deployer.address);
  
  const gasResults = {
    timestamp: new Date().toISOString(),
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {}
  };

  // Deploy and analyze ForgePass
  console.log("📊 Analyzing ForgePass gas usage...");
  try {
    const ForgePass = await ethers.getContractFactory("ForgePass");
    const forgePass = await upgrades.deployProxy(ForgePass, [], { initializer: 'initialize' });
    await forgePass.waitForDeployment();
    console.log("ForgePass deployed. Deployment transaction:", await forgePass.deploymentTransaction());
    
    // Test single mint
    const singleMintTx = await forgePass.mintPass(deployer.address, 1, 3600);
    console.log("ForgePass singleMintTx hash:", singleMintTx.hash);
    const singleMintReceipt = await singleMintTx.wait();
    console.log("ForgePass singleMintReceipt:", singleMintReceipt);
    
    // Test batch mint (5 passes)
    const recipients = Array(5).fill(deployer.address);
    const tiers = Array(5).fill(1);
    const durations = Array(5).fill(3600);
    
    const batchMintTx = await forgePass.batchMintPass(recipients, tiers, durations);
    console.log("ForgePass batchMintTx hash:", batchMintTx.hash);
    const batchMintReceipt = await batchMintTx.wait();
    console.log("ForgePass batchMintReceipt:", batchMintReceipt);
    
    if (singleMintReceipt && batchMintReceipt) {
      const deploymentTx = await forgePass.deploymentTransaction();
      if (deploymentTx) {
        const deploymentReceipt = await deploymentTx.wait();
        if (deploymentReceipt && deploymentReceipt.gasUsed) {
          gasResults.contracts.ForgePass = {
            deployment: deploymentReceipt.gasUsed.toString(),
            singleMint: singleMintReceipt.gasUsed.toString(),
            batchMint5: batchMintReceipt.gasUsed.toString(),
            gasPerBatchItem: Math.floor(Number(batchMintReceipt.gasUsed) / 5),
            address: await forgePass.getAddress()
          };
          
          console.log(`✅ ForgePass - Single mint: ${singleMintReceipt.gasUsed} gas`);
          console.log(`✅ ForgePass - Batch mint (5): ${batchMintReceipt.gasUsed} gas`);
        } else {
          console.error("❌ ForgePass analysis failed: Deployment transaction receipt or its gasUsed was undefined.");
          gasResults.contracts.ForgePass = { error: "Deployment transaction receipt or its gasUsed was undefined." };
        }
      } else {
        console.error("❌ ForgePass analysis failed: Deployment transaction was undefined.");
        gasResults.contracts.ForgePass = { error: "Deployment transaction was undefined." };
      }
    } else {
      console.error("❌ ForgePass analysis failed: One or more transaction receipts were undefined.");
      gasResults.contracts.ForgePass = { error: "One or more transaction receipts were undefined." };
    }
    
  } catch (error) {
    console.error("❌ ForgePass analysis failed:", error.message);
    gasResults.contracts.ForgePass = { error: error.message };
  }

  // Deploy and analyze BadgeMinter
  console.log("\n📊 Analyzing BadgeMinter gas usage...");
  try {
    const XPEngine = await ethers.getContractFactory("XPEngine");
    const xpEngine = await upgrades.deployProxy(XPEngine, [], { initializer: 'initialize' });
    await xpEngine.waitForDeployment();
    
    const BadgeMinter = await ethers.getContractFactory("BadgeMinter");
    const badgeMinter = await upgrades.deployProxy(BadgeMinter, [await xpEngine.getAddress()], { initializer: 'initialize' });
    await badgeMinter.waitForDeployment();
    console.log("BadgeMinter deployed. Deployment transaction:", await badgeMinter.deploymentTransaction());
    
    // Test single mint
    const singleMintTx = await badgeMinter.mintBadge(deployer.address, "ipfs://test");
    console.log("BadgeMinter singleMintTx hash:", singleMintTx.hash);
    const singleMintReceipt = await singleMintTx.wait();
    console.log("BadgeMinter singleMintReceipt:", singleMintReceipt);
    
    // Test batch mint (5 badges)
    const recipients = Array(5).fill(deployer.address);
    const tokenURIs = Array(5).fill("ipfs://test");
    
    const batchMintTx = await badgeMinter.batchMintBadge(recipients, tokenURIs);
    console.log("BadgeMinter batchMintTx hash:", batchMintTx.hash);
    const batchMintReceipt = await batchMintTx.wait();
    console.log("BadgeMinter batchMintReceipt:", batchMintReceipt);
    
    if (singleMintReceipt && batchMintReceipt) {
      const deploymentTx = await badgeMinter.deploymentTransaction();
      if (deploymentTx) {
        const deploymentReceipt = await deploymentTx.wait();
        if (deploymentReceipt && deploymentReceipt.gasUsed) {
          gasResults.contracts.BadgeMinter = {
            deployment: deploymentReceipt.gasUsed.toString(),
            singleMint: singleMintReceipt.gasUsed.toString(),
            batchMint5: batchMintReceipt.gasUsed.toString(),
            gasPerBatchItem: Math.floor(Number(batchMintReceipt.gasUsed) / 5),
            address: await badgeMinter.getAddress()
          };
          
          console.log(`✅ BadgeMinter - Single mint: ${singleMintReceipt.gasUsed} gas`);
          console.log(`✅ BadgeMinter - Batch mint (5): ${batchMintReceipt.gasUsed} gas`);
        } else {
          console.error("❌ BadgeMinter analysis failed: Deployment transaction receipt or its gasUsed was undefined.");
          gasResults.contracts.BadgeMinter = { error: "Deployment transaction receipt or its gasUsed was undefined." };
        }
      } else {
        console.error("❌ BadgeMinter analysis failed: Deployment transaction was undefined.");
        gasResults.contracts.BadgeMinter = { error: "Deployment transaction was undefined." };
      }
    } else {
      console.error("❌ BadgeMinter analysis failed: One or more transaction receipts were undefined.");
      gasResults.contracts.BadgeMinter = { error: "One or more transaction receipts were undefined." };
    }
    
  } catch (error) {
    console.error("❌ BadgeMinter analysis failed:", error.message);
    gasResults.contracts.BadgeMinter = { error: error.message };
  }

  // Analyze XPEngine
  console.log("\n📊 Analyzing XPEngine gas usage...");
  try {
    const XPEngine = await ethers.getContractFactory("XPEngine");
    const xpEngine = await upgrades.deployProxy(XPEngine, [], { initializer: 'initialize' });
    await xpEngine.waitForDeployment();
    
    const deploymentTx = await xpEngine.deploymentTransaction();
    if (deploymentTx) {
      const deploymentReceipt = await deploymentTx.wait();
      if (deploymentReceipt && deploymentReceipt.gasUsed) {
        gasResults.contracts.XPEngine = {
          deployment: deploymentReceipt.gasUsed.toString(),
          address: await xpEngine.getAddress()
        };
      } else {
        console.error("❌ XPEngine analysis failed: Deployment transaction receipt or its gasUsed was undefined.");
        gasResults.contracts.XPEngine = { error: "Deployment transaction receipt or its gasUsed was undefined." };
      }
    } else {
      console.error("❌ XPEngine analysis failed: Deployment transaction was undefined.");
      gasResults.contracts.XPEngine = { error: "Deployment transaction was undefined." };
    }

    // Initialize XPEngine entry in gasResults if not already done due to deployment error
    if (!gasResults.contracts.XPEngine) {
      gasResults.contracts.XPEngine = {};
    }

    // Grant XP_GRANTER_ROLE and XP_AWARDER_ROLE to deployer
    const XP_GRANTER_ROLE = await xpEngine.XP_GRANTER_ROLE();
    await xpEngine.grantRole(XP_GRANTER_ROLE, deployer.address);
    const XP_AWARDER_ROLE = await xpEngine.XP_AWARDER_ROLE();
    await xpEngine.grantRole(XP_AWARDER_ROLE, deployer.address);

    // Check if paused and unpause if necessary
    if (await xpEngine.paused()) {
      console.log("XPEngine is paused. Attempting to unpause...");
      await xpEngine.unpause();
      console.log("XPEngine unpaused.");
    }
    
    // Test single XP grant
    try {
      const singleGrantTx = await xpEngine.awardXP(deployer.address, 100, { gasLimit: 500000 });
      console.log("XPEngine singleGrantTx hash:", singleGrantTx.hash);
      const singleGrantReceipt = await singleGrantTx.wait();
      console.log("XPEngine singleGrantReceipt:", singleGrantReceipt);
      if (singleGrantReceipt && singleGrantReceipt.gasUsed) {
        gasResults.contracts.XPEngine.singleGrant = singleGrantReceipt.gasUsed.toString();
        console.log(`✅ XPEngine - Single grant: ${singleGrantReceipt.gasUsed} gas`);
      } else {
        console.error("❌ XPEngine single XP grant failed: Transaction receipt or its gasUsed was undefined.");
        gasResults.contracts.XPEngine.singleGrant = { error: "Transaction receipt or its gasUsed was undefined." };
      }
    } catch (e) {
      console.error("❌ XPEngine single XP grant failed:", e.reason || e.message, e.data);
      gasResults.contracts.XPEngine.singleGrant = { error: e.reason || e.message, data: e.data };
    }
    
    // Test batch XP grant (5 users)
    const recipients = Array(5).fill(deployer.address);
    const amounts = Array(5).fill(100);
    
    try {
      await xpEngine.awardXpBatch.staticCall(recipients, amounts);
      const batchGrantTx = await xpEngine.awardXpBatch(recipients, amounts);
      console.log("XPEngine batchGrantTx hash:", batchGrantTx.hash);
      const batchGrantReceipt = await batchGrantTx.wait();
      console.log("XPEngine batchGrantReceipt:", batchGrantReceipt);
      if (batchGrantReceipt && batchGrantReceipt.gasUsed) {
        gasResults.contracts.XPEngine.batchGrant5 = batchGrantReceipt.gasUsed.toString();
        gasResults.contracts.XPEngine.gasPerBatchItem = Math.floor(Number(batchGrantReceipt.gasUsed) / 5);
        console.log(`✅ XPEngine - Batch grant (5): ${batchGrantReceipt.gasUsed} gas`);
      } else {
        console.error("❌ XPEngine batch XP grant failed: Transaction receipt or its gasUsed was undefined.");
        gasResults.contracts.XPEngine.batchGrant5 = { error: "Transaction receipt or its gasUsed was undefined." };
      }
    } catch (e) {
      console.error("❌ XPEngine batch XP grant failed:", e.reason || e.message, e.data);
      gasResults.contracts.XPEngine.batchGrant5 = { error: e.reason || e.message, data: e.data };
    }
    
  } catch (error) {
    console.error("❌ XPEngine analysis failed:", error);
    gasResults.contracts.XPEngine = { error: error.message };
  }

  // Calculate optimization metrics
  console.log("\n📈 Gas Optimization Analysis:");
  
  const contracts = Object.keys(gasResults.contracts).filter(name => 
    gasResults.contracts[name].gasPerBatchItem && !gasResults.contracts[name].error
  );
  
  for (const contractName of contracts) {
    const contract = gasResults.contracts[contractName];
    const singleGas = parseInt(contract.singleMint || contract.singleGrant);
    const batchItemGas = contract.gasPerBatchItem;
    const efficiency = ((singleGas - batchItemGas) / singleGas * 100).toFixed(1);
    
    console.log(`  ${contractName}:`);
    console.log(`    Single operation: ${singleGas.toLocaleString()} gas`);
    console.log(`    Batch per item: ${batchItemGas.toLocaleString()} gas`);
    console.log(`    Batch efficiency: ${efficiency}% savings per item`);
  }

  // Save results to file
  const resultsPath = path.join(__dirname, "../gas-analysis-results.json");
  function replacer(key, value) {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }
  fs.writeFileSync(resultsPath, JSON.stringify(gasResults, replacer, 2));
  
  console.log(`\n💾 Gas analysis results saved to: ${resultsPath}`);
  
  // Generate recommendations
  console.log("\n💡 Gas Optimization Recommendations:");
  
  contracts.forEach(contractName => {
    const contract = gasResults.contracts[contractName];
    const batchEfficiency = ((parseInt(contract.singleMint || contract.singleGrant) - contract.gasPerBatchItem) / parseInt(contract.singleMint || contract.singleGrant) * 100);
    
    if (batchEfficiency > 30) {
      console.log(`  ✅ ${contractName}: Excellent batch optimization (${batchEfficiency.toFixed(1)}% savings)`);
    } else if (batchEfficiency > 15) {
      console.log(`  ⚠️  ${contractName}: Good batch optimization (${batchEfficiency.toFixed(1)}% savings)`);
    } else {
      console.log(`  🔴 ${contractName}: Poor batch optimization (${batchEfficiency.toFixed(1)}% savings) - needs improvement`);
    }
  });

  console.log("\n🎯 Summary:");
  console.log(`  Total contracts analyzed: ${contracts.length}`);
  console.log(`  Average batch efficiency: ${(contracts.reduce((sum, name) => {
    const contract = gasResults.contracts[name];
    return sum + ((parseInt(contract.singleMint || contract.singleGrant) - contract.gasPerBatchItem) / parseInt(contract.singleMint || contract.singleGrant) * 100);
  }, 0) / contracts.length).toFixed(1)}%`);
  
  console.log("\n🚀 Gas analysis completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});