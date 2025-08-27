/**
 * @title Production Configuration for Avax Forge Empire
 * @dev Contains all production-ready settings and parameters
 * @author Avax Forge Empire Team
 */

const { ethers } = require("ethers");

module.exports = {
  // Network Configuration
  NETWORKS: {
    avalanche: {
      name: "Avalanche Mainnet",
      chainId: 43114,
      rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
      explorerUrl: "https://snowtrace.io",
      nativeCurrency: {
        name: "AVAX",
        symbol: "AVAX",
        decimals: 18
      },
      gasPrice: "25000000000", // 25 nAVAX
      maxFeePerGas: "40000000000", // 40 nAVAX
      maxPriorityFeePerGas: "2000000000", // 2 nAVAX
    },
    fuji: {
      name: "Avalanche Fuji Testnet",
      chainId: 43113,
      rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
      explorerUrl: "https://testnet.snowtrace.io",
      nativeCurrency: {
        name: "AVAX",
        symbol: "AVAX", 
        decimals: 18
      },
      gasPrice: "25000000000",
      maxFeePerGas: "40000000000",
      maxPriorityFeePerGas: "2000000000",
    }
  },

  // Contract Deployment Settings
  DEPLOYMENT: {
    // Governance parameters
    VOTING_PERIOD_DURATION: 3600 * 24 * 7, // 7 days
    QUORUM_PERCENTAGE: 15, // 15% quorum required
    INITIAL_TOTAL_VOTERS: 1000,
    
    // Token economics
    FORGE_TOKEN: {
      name: "Forge Token",
      symbol: "FORGE",
      initialSupply: ethers.parseEther("100000000"), // 10M tokens
      maxSupply: ethers.parseEther("1000000000"), // 100M max supply
    },
    
    // NFT Configuration
    FORGE_PASS: {
      name: "Forge Pass",
      symbol: "FPASS",
      maxBatchSize: 50, // Production batch limit
    },
    
    BADGES: {
      name: "Forge Badge",
      symbol: "BADGE",
      maxBatchSize: 100,
    },
    
    // Staking parameters
    STAKING: {
      rewardRate: ethers.parseEther("0.1"), // 0.1 tokens per second base rate
      lockupPeriods: [
        { duration: 3600 * 24 * 30, multiplier: 110 },   // 1 month: 1.1x
        { duration: 3600 * 24 * 90, multiplier: 125 },   // 3 months: 1.25x
        { duration: 3600 * 24 * 180, multiplier: 150 },  // 6 months: 1.5x
        { duration: 3600 * 24 * 365, multiplier: 200 },  // 1 year: 2x
      ],
      minStakeAmount: ethers.parseEther("100"), // 100 tokens minimum
    },
    
    // Quest system
    QUESTS: {
      maxActiveQuests: 10,
      maxXpReward: 1000,
      cooldownPeriod: 3600, // 1 hour between quest completions
    },
    
    // Referral system
    REFERRALS: {
      baseReward: ethers.parseEther("10"), // 10 tokens for referral
      maxTierLevel: 5,
      tierMultipliers: [100, 120, 150, 180, 220], // Percentage multipliers
    }
  },

  // Security Configuration
  SECURITY: {
    // Emergency controls
    EMERGENCY_PAUSE_ENABLED: true,
    EMERGENCY_CONTACTS: [
      // Add emergency multisig addresses here
    ],
    
    // Access control settings
    ROLE_MANAGEMENT: {
      // Require 2-of-3 multisig for admin operations
      ADMIN_MULTISIG_THRESHOLD: 2,
      ADMIN_MULTISIG_OWNERS: 3,
      
      // Time delays for critical operations
      TIMELOCK_DELAY: 3600 * 24 * 2, // 48 hours for critical changes
    },
    
    // Rate limiting
    RATE_LIMITS: {
      maxBadgesPerUser: 10, // Per day
      maxQuestCompletions: 5, // Per hour
      maxStakeOperations: 3, // Per hour
    },
    
    // Validation settings
    VALIDATION: {
      maxTokenUriLength: 200,
      maxUsernameLength: 32,
      maxQuestDescriptionLength: 500,
      minStakingPeriod: 3600 * 24, // 1 day minimum
    }
  },

  // Economic Parameters
  ECONOMICS: {
    // Fee structure (in basis points - 100 = 1%)
    PLATFORM_FEES: {
      stakingFee: 200, // 2% staking fee
      withdrawalFee: 100, // 1% withdrawal fee
      questCreationFee: ethers.parseEther("1"), // 1 token to create quest
      badgeMintingFee: ethers.parseEther("0.1"), // 0.1 token per badge
    },
    
    // Treasury allocation
    TREASURY: {
      teamAllocation: 20, // 20% to team
      communityAllocation: 30, // 30% to community rewards
      developmentAllocation: 25, // 25% to development
      marketingAllocation: 15, // 15% to marketing
      reserveAllocation: 10, // 10% reserve
    },
    
    // Vesting schedules (in seconds)
    VESTING: {
      teamVesting: 3600 * 24 * 365 * 2, // 2 years team vesting
      communityVesting: 3600 * 24 * 30, // 1 month community vesting
      advisorVesting: 3600 * 24 * 365, // 1 year advisor vesting
    }
  },

  // Integration Settings
  INTEGRATIONS: {
    // Oracle settings (for future price feeds)
    ORACLES: {
      updateFrequency: 3600, // 1 hour
      maxPriceDeviation: 500, // 5% max deviation
    },
    
    // External protocol integrations
    EXTERNAL_PROTOCOLS: {
      // Add DeFi protocol addresses here
      traderjoe: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4",
      pangolin: "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106",
    },
    
    // API configurations
    API: {
      maxRequestsPerHour: 1000,
      rateLimitWindowMs: 3600000, // 1 hour
      enableCORS: true,
      allowedOrigins: [
        "https://forge-empire.com",
        "https://avax-forge-empire.com"
      ]
    }
  },

  // Monitoring & Analytics
  MONITORING: {
    // Health check parameters
    HEALTH_CHECKS: {
      contractCallTimeout: 10000, // 10 seconds
      blockchainSyncThreshold: 100, // blocks behind threshold
      gasUsageThreshold: ethers.parseEther("0.1"), // AVAX
    },
    
    // Alert configurations
    ALERTS: {
      criticalGasPrice: "100000000000", // 100 nAVAX - alert threshold
      lowContractBalance: ethers.parseEther("1"), // 1 AVAX minimum
      highFailureRate: 5, // 5% failure rate threshold
    },
    
    // Metrics collection
    METRICS: {
      enableDetailedMetrics: true,
      metricsRetentionDays: 90,
      enablePerformanceMonitoring: true,
    }
  },

  // Deployment Verification
  VERIFICATION: {
    // Contract verification settings
    ETHERSCAN_API_KEYS: {
      avalanche: process.env.SNOWTRACE_API_KEY,
      fuji: process.env.SNOWTRACE_API_KEY,
    },
    
    // Post-deployment checks
    POST_DEPLOYMENT_CHECKS: [
      "verify_contract_initialization",
      "verify_access_control_setup",
      "verify_contract_interactions",
      "verify_upgrade_functionality",
      "verify_emergency_controls"
    ],
    
    // Integration test scenarios
    INTEGRATION_TESTS: [
      "complete_user_journey",
      "quest_creation_and_completion",
      "badge_minting_flow",
      "staking_and_rewards",
      "governance_proposal_flow"
    ]
  },

  // Environment-specific overrides
  ENVIRONMENT_OVERRIDES: {
    development: {
      DEPLOYMENT: {
        QUORUM_PERCENTAGE: 5, // Lower for testing
        INITIAL_TOTAL_VOTERS: 10,
      },
      SECURITY: {
        EMERGENCY_PAUSE_ENABLED: false,
        RATE_LIMITS: {
          maxBadgesPerUser: 100, // Higher for testing
          maxQuestCompletions: 50,
          maxStakeOperations: 30,
        }
      }
    },
    
    testnet: {
      DEPLOYMENT: {
        FORGE_TOKEN: {
          initialSupply: ethers.parseEther("1000000"), // 1M for testnet
        }
      },
      ECONOMICS: {
        PLATFORM_FEES: {
          stakingFee: 50, // Lower fees for testing
          withdrawalFee: 25,
        }
      }
    }
  }
};

// Helper functions for configuration
module.exports.getNetworkConfig = (networkName) => {
  return module.exports.NETWORKS[networkName] || null;
};

module.exports.getEnvironmentConfig = (environment = 'production') => {
  const baseConfig = { ...module.exports };
  const overrides = baseConfig.ENVIRONMENT_OVERRIDES[environment] || {};
  
  // Deep merge overrides
  return deepMerge(baseConfig, overrides);
};

// Deep merge utility function
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}