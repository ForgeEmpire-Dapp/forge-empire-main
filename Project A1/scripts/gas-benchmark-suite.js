const { ethers } = require("hardhat");
const fs = require('fs');

/**
 * Comprehensive Gas Benchmarking Suite
 * Measures gas usage across all contract operations and optimizations
 */

class GasBenchmark {
    constructor() {
        this.results = {};
        this.startTime = Date.now();
    }
    
    async measureGas(contractName, functionName, operationFunction) {
        const gasStart = Date.now();
        
        try {
            const tx = await operationFunction();
            const receipt = await tx.wait();
            
            const gasUsed = receipt.gasUsed;
            const gasPrice = tx.gasPrice || ethers.parseUnits('20', 'gwei');
            const gasCostETH = (gasUsed * gasPrice) / (10n ** 18n);
            
            const result = {
                contractName,
                functionName,
                gasUsed: gasUsed.toString(),
                gasPrice: gasPrice.toString(),
                gasCostETH: gasCostETH.toString(),
                executionTime: Date.now() - gasStart,
                blockNumber: receipt.blockNumber,
                transactionHash: receipt.transactionHash
            };
            
            if (!this.results[contractName]) {
                this.results[contractName] = {};
            }
            this.results[contractName][functionName] = result;
            
            console.log(`⛽ ${contractName}.${functionName}: ${gasUsed.toLocaleString()} gas (${gasCostETH.toString().slice(0, 8)} ETH)`);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Error measuring ${contractName}.${functionName}:`, error.message);
            return null;
        }
    }
    
    async benchmarkContract(contractName, contractInstance, testData, deployer, user1) {
        console.log(`
📊 Benchmarking ${contractName}...`);
        
        const benchmarks = testData[contractName];
        if (!benchmarks) {
            console.log(`⚠️  No benchmark data for ${contractName}`);
            return;
        }
        
        for (const [functionName, testCase] of Object.entries(benchmarks)) {
            try {
                await this.measureGas(contractName, functionName, testCase(contractInstance, deployer, user1));
            } catch (error) {
                console.error(`❌ Benchmark failed for ${contractName}.${functionName}:`, error.message);
            }
        }
    }
    
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalExecutionTime: Date.now() - this.startTime,
            network: 'hardhat',
            gasPrice: '20 gwei',
            results: this.results,
            summary: this.generateSummary(),
            optimizationRecommendations: this.generateOptimizationRecommendations()
        };
        
        return report;
    }
    
    generateSummary() {
        const summary = {
            totalContracts: Object.keys(this.results).length,
            totalFunctions: 0,
            totalGasUsed: 0n,
            averageGasPerFunction: 0,
            highestGasFunction: null,
            lowestGasFunction: null,
            mostExpensiveContract: null
        };
        
        let highestGas = 0n;
        let lowestGas = null;
        const contractTotals = {};
        
        for (const [contractName, functions] of Object.entries(this.results)) {
            contractTotals[contractName] = 0n;
            
            for (const [functionName, result] of Object.entries(functions)) {
                if (!result || !result.gasUsed) continue;
                
                summary.totalFunctions++;
                const gasUsed = BigInt(result.gasUsed);
                summary.totalGasUsed += gasUsed;
                contractTotals[contractName] += gasUsed;
                
                if (gasUsed > highestGas) {
                    highestGas = gasUsed;
                    summary.highestGasFunction = { contract: contractName, function: functionName, gas: gasUsed.toString() };
                }
                
                if (lowestGas === null || gasUsed < lowestGas) {
                    lowestGas = gasUsed;
                    summary.lowestGasFunction = { contract: contractName, function: functionName, gas: gasUsed.toString() };
                }
            }
        }
        
        if (summary.totalFunctions > 0) {
            summary.averageGasPerFunction = Number(summary.totalGasUsed / BigInt(summary.totalFunctions));
        }
        
        // Find most expensive contract
        let maxContractGas = 0n;
        for (const [contractName, totalGas] of Object.entries(contractTotals)) {
            if (totalGas > maxContractGas) {
                maxContractGas = totalGas;
                summary.mostExpensiveContract = { name: contractName, totalGas: totalGas.toString() };
            }
        }
        
        return summary;
    }
    
    generateOptimizationRecommendations() {
        const recommendations = [];
        
        for (const [contractName, functions] of Object.entries(this.results)) {
            for (const [functionName, result] of Object.entries(functions)) {
                if (!result || !result.gasUsed) continue;
                
                const gasUsed = BigInt(result.gasUsed);
                
                // High gas usage recommendations
                if (gasUsed > 200000n) {
                    recommendations.push({
                        type: 'HIGH_GAS_USAGE',
                        contract: contractName,
                        function: functionName,
                        gasUsed: gasUsed.toString(),
                        recommendation: 'Consider breaking this function into smaller operations or using batch operations'
                    });
                }
                
                // Batch operation recommendations
                if (functionName.includes('batch') && gasUsed / 100n > 50000n) {
                    recommendations.push({
                        type: 'BATCH_OPTIMIZATION',
                        contract: contractName,
                        function: functionName,
                        gasUsed: gasUsed.toString(),
                        recommendation: 'Batch operation may benefit from assembly optimization or smaller batch sizes'
                    });
                }
                
                // Storage operation recommendations
                if (gasUsed > 50000n && (functionName.includes('set') || functionName.includes('update'))) {
                    recommendations.push({
                        type: 'STORAGE_OPTIMIZATION',
                        contract: contractName,
                        function: functionName,
                        gasUsed: gasUsed.toString(),
                        recommendation: 'Consider struct packing or using events instead of storage for some data'
                    });
                }
            }
        }
        
        return recommendations;
    }
}

async function main() {
    console.log("🚀 Starting Comprehensive Gas Benchmark Suite\n");
    
    const benchmark = new GasBenchmark();
    const [deployer, user1, user2] = await ethers.getSigners();
    
    // Deploy test contracts
    console.log("📦 Deploying test contracts...");
    
    const contracts = {};
    
    try {
        // Deploy XPEngine
        const XPEngine = await ethers.getContractFactory("XPEngine");
        contracts.XPEngine = await upgrades.deployProxy(XPEngine, [], { initializer: 'initialize' });
        await contracts.XPEngine.waitForDeployment();
        
        // Deploy BadgeMinter
        const BadgeMinter = await ethers.getContractFactory("BadgeMinter");
        contracts.BadgeMinter = await upgrades.deployProxy(BadgeMinter, [await contracts.XPEngine.getAddress()], { initializer: 'initialize' });
        await contracts.BadgeMinter.waitForDeployment();
        
        // Deploy ProfileRegistry
        const ProfileRegistry = await ethers.getContractFactory("ProfileRegistry");
        contracts.ProfileRegistry = await upgrades.deployProxy(ProfileRegistry, [await contracts.BadgeMinter.getAddress()], { initializer: 'initialize' });
        await contracts.ProfileRegistry.waitForDeployment();
        
        console.log("✅ All contracts deployed successfully\n");
        
    } catch (error) {
        console.error("❌ Error deploying contracts:", error.message);
        return;
    }
    
    
    
}