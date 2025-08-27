
require("@nomicfoundation/hardhat-toolbox");
require('solidity-coverage');
require("dotenv").config();
require("@openzeppelin/hardhat-upgrades");


const { task } = require("hardhat/config");

task("test", async (taskArgs, hre, runSuper) => {
  const { HardhatEthersProvider } = await import(
    "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider.js"
  );

  HardhatEthersProvider.prototype.resolveName = async function (name) {
    return name;
  };

  return runSuper(taskArgs);
});

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          metadata: {
            bytecodeHash: "none"
          },
          viaIR: false
        }
      },
      {
        version: "0.8.22",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          metadata: {
            bytecodeHash: "none"
          },
          viaIR: true
        }
      }
    ],
    overrides: {}
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  // Explicitly define output for ProfileRegistryV2 to ensure correct ABI generation
  outputSelection: {
    "*": {
      "*": [
        "abi",
        "evm.bytecode",
        "evm.deployedBytecode",
        "evm.methodIdentifiers",
        "metadata"
      ]
    },
    "contracts/ProfileRegistryV2.sol": {
      "ProfileRegistryV2": {
        "abi": true,
        "evm.bytecode": true,
        "evm.deployedBytecode": true,
        "evm.methodIdentifiers": true,
        "metadata": true
      }
    }
  },
  networks: {
    hardhat: {
      allowBlocksWithSameTimestamp: true,
      // Increase mining speed for tests
      mining: {
        auto: true,
        interval: 0
      },
      // Increase block gas limit for complex tests
      blockGasLimit: 50000000,
      accounts: {
        count: 20,
        initialIndex: 0,
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        accountsBalance: "10000000000000000000000000000"
      }
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      chainId: 43114,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 225000000000, // 225 nAVAX (typical for mainnet)
      gas: 8000000,
      timeout: 60000
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      chainId: 43113,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 35000000000, // 35 nAVAX
      gas: 8000000,
      timeout: 60000
    }
  },
  // Disable gas reporter for faster tests
  gasReporter: {
    enabled: false
  },
  etherscan: {
    apiKey: {
      avalanche: process.env.SNOWTRACE_API_KEY || "placeholder",
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || "placeholder"
    },
    customChains: [
      {
        network: "avalanche",
        chainId: 43114,
        urls: {
          apiURL: "https://api.snowtrace.io/api",
          browserURL: "https://snowtrace.io/"
        }
      },
      {
        network: "avalancheFujiTestnet",
        chainId: 43113,
        urls: {
          apiURL: "https://api-testnet.snowtrace.io/api",
          browserURL: "https://testnet.snowtrace.io/"
        }
      }
    ]
  },
  // Add mocha timeout for long-running tests
  mocha: {
    timeout: 120000, // 120 seconds (2 minutes)
    parallel: false,
    jobs: 4 // Number of parallel jobs
  },
  // Coverage configuration
  solcover: {
    skipFiles: [
      'test/',
      'mocks/',
      'interfaces/',
      'optimized/',
      'security/',
      'modules/'
    ],
    configureYulOptimizer: true,
    measureStatementCoverage: true,
    measureFunctionCoverage: true,
    measureBranchCoverage: true,
    modifierWhitelist: [],
    skipBranches: false,
    // Explicitly include ProfileRegistryV2.sol
    include: [
      'contracts/ProfileRegistryV2.sol'
    ]
  }
};
