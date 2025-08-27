// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IForgeTokenCore {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function setAddressFlags(address account, uint8 flags) external;
}

/**
 * @title ForgeUtilityManager
 * @dev Manages utility features for Forge Token - staking, governance, premium access
 * @notice Handles staking power, governance participation, and premium tier management
 * @author Avax Forge Empire Team
 */
contract ForgeUtilityManager is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    
    bytes32 public constant UTILITY_ADMIN_ROLE = keccak256("UTILITY_ADMIN_ROLE");
    bytes32 public constant STAKING_MANAGER_ROLE = keccak256("STAKING_MANAGER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    IForgeTokenCore public forgeToken;
    
    // Staking Configuration
    struct StakingConfig {
        uint256 baseStakingPower;      // Base staking power multiplier (100 = 1x)
        uint256 premiumBonusRate;      // Additional bonus for premium tiers
        uint256 governanceBonusRate;   // Additional bonus for governance participation
        bool stakingEnabled;
        uint256 balanceBonusRate;
    }
    
    StakingConfig public stakingConfig;
    
    // User utility data (packed for gas efficiency)
    struct UserUtility {
        uint32 stakingPower;        // Staking power multiplier (100 = 1x)
        uint32 governancePower;     // Governance voting power multiplier
        uint8 premiumTierLevel;     // Premium access level (0-5)
        uint8 governanceLevel;      // Governance participation level
        uint32 lastActivity;       // Last activity timestamp
        bool isPremiumActive;       // Whether premium is currently active
    }
    
    mapping(address => UserUtility) public userUtilities;
    
    // Premium tier configurations
    struct PremiumTier {
        uint256 requiredBalance;    // Required token balance
        uint32 stakingBonus;        // Staking power bonus percentage
        uint32 governanceBonus;     // Governance power bonus percentage
        uint8 feeDiscount;          // Fee discount percentage (0-100)
        bool isActive;
    }
    
    mapping(uint8 => PremiumTier) public premiumTiers;
    
    // Governance participation tracking
    mapping(address => uint256) public governanceParticipation;
    mapping(address => uint256) public lastGovernanceActivity;
    
    // Utility feature toggles
    bool public premiumFeaturesEnabled;
    bool public governanceFeaturesEnabled;
    
    // Statistics
    uint256 public totalPremiumUsers;
    uint256 public totalStakingPower;
    
    // Events
    event UtilityUpdated(address indexed user, uint32 stakingPower, uint32 governancePower, uint8 premiumTier);
    event PremiumTierUpdated(uint8 indexed tier, uint256 requiredBalance, uint32 stakingBonus, uint32 governanceBonus);
    event GovernanceParticipation(address indexed user, uint256 participationScore);
    event StakingConfigUpdated(uint256 baseStakingPower, uint256 premiumBonusRate, uint256 governanceBonusRate);
    event PremiumStatusChanged(address indexed user, bool isPremium, uint8 tierLevel);
    
    // Custom Errors
    error InsufficientBalance();
    error InvalidTierLevel();
    error FeatureDisabled();
    error UnauthorizedToken();
    error InvalidConfiguration();
    
    /**
     * @notice Initializes the ForgeUtilityManager
     * @param _forgeToken Address of ForgeTokenCore contract
     */
    function initialize(address _forgeToken) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UTILITY_ADMIN_ROLE, msg.sender);
        _grantRole(STAKING_MANAGER_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        
        forgeToken = IForgeTokenCore(_forgeToken);
        
        // Initialize default staking configuration
        stakingConfig = StakingConfig({
            baseStakingPower: 100,      // 1x base multiplier
            premiumBonusRate: 25,       // 25% bonus for premium
            governanceBonusRate: 50,    // 50% bonus for governance participation
            stakingEnabled: true,
            balanceBonusRate: 5
        });
        
        // Initialize default premium tiers
        _initializePremiumTiers();
        
        premiumFeaturesEnabled = true;
        governanceFeaturesEnabled = true;
    }
    
    /**
     * @notice Update user utility features based on token balance and activity  
     * @param user Address to update
     */
    function updateUserUtility(address user) external whenNotPaused nonReentrant {
        UserUtility storage utility = userUtilities[user];
        uint256 userBalance = forgeToken.balanceOf(user);
        
        // Update premium tier based on balance
        uint8 newTierLevel = _calculatePremiumTier(userBalance);
        bool wasPremium = utility.isPremiumActive;
        bool isPremiumNow = newTierLevel > 0;
        
        if (wasPremium != isPremiumNow) {
            if (isPremiumNow) {
                totalPremiumUsers++;
            } else {
                totalPremiumUsers--;
            }
        }
        
        utility.premiumTierLevel = newTierLevel;
        utility.isPremiumActive = isPremiumNow;
        
        // Calculate staking power
        uint32 newStakingPower = _calculateStakingPower(user, userBalance, newTierLevel);
        
        // Calculate governance power
        uint32 newGovernancePower = _calculateGovernancePower(user, userBalance, newTierLevel);
        
        // Update stored values
        utility.stakingPower = newStakingPower;
        utility.governancePower = newGovernancePower;
        utility.lastActivity = uint32(block.timestamp);
        
        // Update token contract flags if premium status changed
        if (wasPremium != isPremiumNow) {
            uint8 flags = isPremiumNow ? 1 : 0; // Set fee exclusion flag for premium users
            forgeToken.setAddressFlags(user, flags);
            emit PremiumStatusChanged(user, isPremiumNow, newTierLevel);
        }
        
        emit UtilityUpdated(user, newStakingPower, newGovernancePower, newTierLevel);
    }
    
    /**
     * @notice Record governance participation
     * @param user Address of participating user
     * @param participationWeight Weight of participation (e.g., vote power used)
     */
    function recordGovernanceParticipation(address user, uint256 participationWeight) 
        external 
        onlyRole(GOVERNANCE_ROLE) 
        whenNotPaused 
    {
        if (!governanceFeaturesEnabled) revert FeatureDisabled();
        
        governanceParticipation[user] += participationWeight;
        lastGovernanceActivity[user] = block.timestamp;
        
        // Update governance level based on participation
        UserUtility storage utility = userUtilities[user];
        utility.governanceLevel = _calculateGovernanceLevel(governanceParticipation[user]);
        
        emit GovernanceParticipation(user, participationWeight);
        
        // Trigger utility update to recalculate powers
        this.updateUserUtility(user);
    }
    
    /**
     * @notice Calculate premium tier based on token balance
     * @param balance User's token balance
     * @return tierLevel Premium tier level (0-5)
     */
    function _calculatePremiumTier(uint256 balance) internal view returns (uint8 tierLevel) {
        if (!premiumFeaturesEnabled) return 0;
        
        for (uint8 i = 5; i > 0; i--) {
            PremiumTier memory tier = premiumTiers[i];
            if (tier.isActive && balance >= tier.requiredBalance) {
                return i;
            }
        }
        return 0;
    }
    
    /**
     * @notice Calculate staking power for a user
     * @param user User address
     * @param balance User's token balance
     * @param tierLevel Premium tier level
     * @return stakingPower Calculated staking power
     */
    function _calculateStakingPower(address user, uint256 balance, uint8 tierLevel) internal view returns (uint32) {
    if (!stakingConfig.stakingEnabled) return 100;

    uint256 power = stakingConfig.baseStakingPower;

    // Tier bonus
    if (tierLevel > 0 && premiumTiers[tierLevel].isActive) {
        power += (power * premiumTiers[tierLevel].stakingBonus) / 100;
    }

    // Governance bonus
    uint256 participationScore = governanceParticipation[user];
    if (participationScore > 0) {
        uint256 baseGovernanceBonus = (power * stakingConfig.governanceBonusRate) / 100;
        uint256 governanceBonus = (baseGovernanceBonus * participationScore) / 10000;

        uint256 maxGovBonus = (power * stakingConfig.governanceBonusRate * 2) / 100;
        if (governanceBonus > maxGovBonus) {
            governanceBonus = maxGovBonus;
        }

        power += governanceBonus;
    }

    // Balance-based bonus (optional)
    if (stakingConfig.balanceBonusRate > 0 && balance > 0) {
        power += (balance * stakingConfig.balanceBonusRate) / 1e18;
    }

    // Cap total staking power
    uint256 maxPower = stakingConfig.baseStakingPower * 5;
    if (power > maxPower) {
        power = maxPower;
    }

    return uint32(power);
}
    
    /**
     * @notice Calculate governance power for a user
     * @param user User address
     * @param balance User's token balance
     * @param tierLevel Premium tier level
     * @return governancePower Calculated governance power
     */
    function _calculateGovernancePower(address user, uint256 balance, uint8 tierLevel) internal view returns (uint32) {
        if (!governanceFeaturesEnabled) return 100;
        
        uint256 power = 100; // Base governance power
        
        // Add premium tier bonus
        if (tierLevel > 0 && premiumTiers[tierLevel].isActive) {
            power += (power * premiumTiers[tierLevel].governanceBonus) / 100;
        }
        
        // Add participation history bonus
        uint256 participationScore = governanceParticipation[user];
        if (participationScore > 0) {
            power += (power * participationScore) / 10000; // Scale by participation
        }
        
        // Balance-based scaling (holders with more tokens get slightly more power)
        uint256 totalSupply = forgeToken.totalSupply();
        if (totalSupply > 0) {
            uint256 balanceRatio = (balance * 1000) / totalSupply; // Balance as permille of total supply
            if (balanceRatio > 10) { // Only for significant holders (>1% of supply)
                power += (power * balanceRatio) / 1000;
            }
        }
        
        // Cap at reasonable maximum (3x base power)
        if (power > 300) {
            power = 300;
        }
        
        return uint32(power);
    }
    
    /**
     * @notice Calculate governance level based on participation score
     * @param participationScore Total participation score
     * @return level Governance level (0-10)
     */
    function _calculateGovernanceLevel(uint256 participationScore) internal pure returns (uint8 level) {
        if (participationScore >= 10000) return 10;
        if (participationScore >= 5000) return 9;
        if (participationScore >= 2500) return 8;
        if (participationScore >= 1000) return 7;
        if (participationScore >= 500) return 6;
        if (participationScore >= 250) return 5;
        if (participationScore >= 100) return 4;
        if (participationScore >= 50) return 3;
        if (participationScore >= 25) return 2;
        if (participationScore >= 10) return 1;
        return 0;
    }
    
    /**
     * @notice Initialize default premium tiers
     */
    function _initializePremiumTiers() internal {
        // Tier 1: Bronze (10K tokens)
        premiumTiers[1] = PremiumTier({
            requiredBalance: 10_000 * 10**18,
            stakingBonus: 10,      // 10% staking bonus
            governanceBonus: 5,    // 5% governance bonus
            feeDiscount: 25,       // 25% fee discount
            isActive: true
        });
        
        // Tier 2: Silver (50K tokens)
        premiumTiers[2] = PremiumTier({
            requiredBalance: 50_000 * 10**18,
            stakingBonus: 25,      // 25% staking bonus
            governanceBonus: 15,   // 15% governance bonus
            feeDiscount: 50,       // 50% fee discount
            isActive: true
        });
        
        // Tier 3: Gold (100K tokens)
        premiumTiers[3] = PremiumTier({
            requiredBalance: 100_000 * 10**18,
            stakingBonus: 50,      // 50% staking bonus
            governanceBonus: 30,   // 30% governance bonus
            feeDiscount: 75,       // 75% fee discount
            isActive: true
        });
        
        // Tier 4: Platinum (500K tokens)
        premiumTiers[4] = PremiumTier({
            requiredBalance: 500_000 * 10**18,
            stakingBonus: 100,     // 100% staking bonus
            governanceBonus: 50,   // 50% governance bonus
            feeDiscount: 90,       // 90% fee discount
            isActive: true
        });
        
        // Tier 5: Diamond (1M tokens)
        premiumTiers[5] = PremiumTier({
            requiredBalance: 1_000_000 * 10**18,
            stakingBonus: 200,     // 200% staking bonus
            governanceBonus: 100,  // 100% governance bonus
            feeDiscount: 100,      // 100% fee discount (no fees)
            isActive: true
        });
    }
    
    /**
     * @notice Update premium tier configuration (admin only)
     * @param tierLevel Tier level to update
     * @param requiredBalance Required token balance
     * @param stakingBonus Staking power bonus percentage
     * @param governanceBonus Governance power bonus percentage
     * @param feeDiscount Fee discount percentage
     */
    function updatePremiumTier(
        uint8 tierLevel,
        uint256 requiredBalance,
        uint32 stakingBonus,
        uint32 governanceBonus,
        uint8 feeDiscount
    ) external onlyRole(UTILITY_ADMIN_ROLE) {
        if (tierLevel == 0 || tierLevel > 5) revert InvalidTierLevel();
        if (feeDiscount > 100) revert InvalidConfiguration();
        
        premiumTiers[tierLevel] = PremiumTier({
            requiredBalance: requiredBalance,
            stakingBonus: stakingBonus,
            governanceBonus: governanceBonus,
            feeDiscount: feeDiscount,
            isActive: true
        });
        
        emit PremiumTierUpdated(tierLevel, requiredBalance, stakingBonus, governanceBonus);
    }
    
    /**
     * @notice Update staking configuration (admin only)
     * @param baseStakingPower Base staking power multiplier
     * @param premiumBonusRate Premium bonus rate
     * @param governanceBonusRate Governance bonus rate
     */
    function updateStakingConfig(
        uint256 baseStakingPower,
        uint256 premiumBonusRate,
        uint256 governanceBonusRate
    ) external onlyRole(UTILITY_ADMIN_ROLE) {
        stakingConfig.baseStakingPower = baseStakingPower;
        stakingConfig.premiumBonusRate = premiumBonusRate;
        stakingConfig.governanceBonusRate = governanceBonusRate;
        
        emit StakingConfigUpdated(baseStakingPower, premiumBonusRate, governanceBonusRate);
    }
    
    /**
     * @notice Get user utility information
     * @param user User address
     * @return stakingPower Current staking power
     * @return governancePower Current governance power  
     * @return premiumTier Current premium tier level
     * @return isPremium Whether user has premium status
     */
    function getUserUtility(address user) 
        external 
        view 
        returns (uint32 stakingPower, uint32 governancePower, uint8 premiumTier, bool isPremium) 
    {
        UserUtility memory utility = userUtilities[user];
        return (utility.stakingPower, utility.governancePower, utility.premiumTierLevel, utility.isPremiumActive);
    }
    
    /**
     * @notice Get premium tier requirements
     * @param tierLevel Tier level to query
     * @return requiredBalance Required token balance
     * @return stakingBonus Staking bonus percentage
     * @return governanceBonus Governance bonus percentage
     * @return feeDiscount Fee discount percentage
     */
    function getPremiumTier(uint8 tierLevel) 
        external 
        view 
        returns (uint256 requiredBalance, uint32 stakingBonus, uint32 governanceBonus, uint8 feeDiscount) 
    {
        PremiumTier memory tier = premiumTiers[tierLevel];
        return (tier.requiredBalance, tier.stakingBonus, tier.governanceBonus, tier.feeDiscount);
    }
    
    /**
     * @notice Enable/disable premium features (admin only)
     * @param enabled Whether premium features should be enabled
     */
    function setPremiumFeaturesEnabled(bool enabled) external onlyRole(UTILITY_ADMIN_ROLE) {
        premiumFeaturesEnabled = enabled;
    }
    
    /**
     * @notice Enable/disable governance features (admin only)
     * @param enabled Whether governance features should be enabled
     */
    function setGovernanceFeaturesEnabled(bool enabled) external onlyRole(UTILITY_ADMIN_ROLE) {
        governanceFeaturesEnabled = enabled;
    }
    
    /**
     * @notice Enable/disable staking (admin only)
     * @param enabled Whether staking should be enabled
     */
    function setStakingEnabled(bool enabled) external onlyRole(UTILITY_ADMIN_ROLE) {
        stakingConfig.stakingEnabled = enabled;
    }
    
    /**
     * @notice Get utility statistics
     * @return totalPremium Total number of premium users
     * @return totalStaking Total staking power across all users
     */
    function getUtilityStats() external view returns (uint256 totalPremium, uint256 totalStaking) {
        return (totalPremiumUsers, totalStakingPower);
    }
    
    /**
     * @notice Pause contract (admin only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause contract (admin only)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}