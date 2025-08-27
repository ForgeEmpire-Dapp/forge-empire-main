// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

interface IForgeTokenCore {
    function setManager(string calldata managerType, address manager) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function pause() external;
    function unpause() external;
    function setTradingEnabled(bool enabled) external;
}

interface IForgeFeeManager {
    function updateFeeConfig(uint16 transferFee, uint16 burnRate, uint16 treasuryRate, uint16 liquidityRate) external;
    function updateLimitConfig(uint256 maxTransaction, uint256 maxWallet, uint256 cooldown) external;
    function setFeesEnabled(bool enabled) external;
    function setLimitsEnabled(bool enabled) external;
    function getFeeStats() external view returns (uint256, uint256, uint256);
}

interface IForgeUtilityManager {
    function updateUserUtility(address user) external;
    function recordGovernanceParticipation(address user, uint256 participationWeight) external;
    function getUserUtility(address user) external view returns (uint32, uint32, uint8, bool);
    function setPremiumFeaturesEnabled(bool enabled) external;
    function setStakingEnabled(bool enabled) external;
}

/**
 * @title ForgeTokenManager
 * @dev Main coordinator for the modular Forge Token system
 * @notice Manages interactions between ForgeTokenCore, ForgeFeeManager, and ForgeUtilityManager
 * @author Avax Forge Empire Team
 */
contract ForgeTokenManager is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    
    bytes32 public constant TOKEN_ADMIN_ROLE = keccak256("TOKEN_ADMIN_ROLE");
    bytes32 public constant FEE_ADMIN_ROLE = keccak256("FEE_ADMIN_ROLE");
    bytes32 public constant UTILITY_ADMIN_ROLE = keccak256("UTILITY_ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    IForgeTokenCore public forgeTokenCore;
    IForgeFeeManager public feeManager;
    IForgeUtilityManager public utilityManager;
    
    // System-wide configuration
    struct SystemConfig {
        bool emergencyMode;
        bool feesEnabled;
        bool utilitiesEnabled;
        bool governanceEnabled;
        uint256 lastMaintenanceTime;
    }
    
    SystemConfig public systemConfig;
    
    // Events
    event ModuleUpdated(string indexed moduleType, address indexed oldModule, address indexed newModule);
    event SystemConfigUpdated(bool emergencyMode, bool feesEnabled, bool utilitiesEnabled, bool governanceEnabled);
    event BatchOperationCompleted(string indexed operationType, uint256 processed, uint256 failed);
    event MaintenancePerformed(uint256 timestamp, string maintenanceType);
    
    // Custom Errors
    error ModuleNotSet();
    error InvalidModule();
    error EmergencyModeActive();
    error UnauthorizedOperation();
    error BatchOperationFailed();
    
    /**
     * @notice Initializes the ForgeTokenManager
     * @param _forgeTokenCore Address of ForgeTokenCore contract
     * @param _feeManager Address of ForgeFeeManager contract
     * @param _utilityManager Address of ForgeUtilityManager contract
     */
    function initialize(
        address _forgeTokenCore,
        address _feeManager,
        address _utilityManager
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TOKEN_ADMIN_ROLE, msg.sender);
        _grantRole(FEE_ADMIN_ROLE, msg.sender);
        _grantRole(UTILITY_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        
        forgeTokenCore = IForgeTokenCore(_forgeTokenCore);
        feeManager = IForgeFeeManager(_feeManager);
        utilityManager = IForgeUtilityManager(_utilityManager);
        
        // Set up module connections
        _setupModuleConnections();
        
        // Initialize system configuration
        systemConfig = SystemConfig({
            emergencyMode: false,
            feesEnabled: true,
            utilitiesEnabled: true,
            governanceEnabled: true,
            lastMaintenanceTime: block.timestamp
        });
    }
    
    /**
     * @notice Setup connections between modules
     */
    function _setupModuleConnections() internal {
        // Connect fee manager to token core
        forgeTokenCore.setManager("fee", address(feeManager));
        
        // Connect utility manager to token core
        forgeTokenCore.setManager("utility", address(utilityManager));
    }
    
    // ============ Token Management Functions ============
    
    /**
     * @notice Enable/disable trading (admin only)
     * @param enabled Whether trading should be enabled
     */
    function setTradingEnabled(bool enabled) external onlyRole(TOKEN_ADMIN_ROLE) {
        if (systemConfig.emergencyMode && enabled) revert EmergencyModeActive();
        forgeTokenCore.setTradingEnabled(enabled);
    }
    
    /**
     * @notice Mint tokens to multiple addresses (admin only)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) 
        external 
        onlyRole(TOKEN_ADMIN_ROLE) 
        whenNotPaused 
    {
        if (recipients.length != amounts.length || recipients.length == 0) revert BatchOperationFailed();
        
        uint256 processed = 0;
        uint256 failed = 0;
        
        for (uint256 i = 0; i < recipients.length; i++) {
            try forgeTokenCore.mint(recipients[i], amounts[i]) {
                processed++;
            } catch {
                failed++;
            }
        }
        
        emit BatchOperationCompleted("mint", processed, failed);
    }
    
    /**
     * @notice Update utility features for multiple users
     * @param users Array of user addresses
     */
    function batchUpdateUtilities(address[] calldata users) 
        external 
        onlyRole(UTILITY_ADMIN_ROLE) 
        whenNotPaused 
    {
        if (!systemConfig.utilitiesEnabled) revert EmergencyModeActive();
        
        uint256 processed = 0;
        uint256 failed = 0;
        
        for (uint256 i = 0; i < users.length; i++) {
            try utilityManager.updateUserUtility(users[i]) {
                processed++;
            } catch {
                failed++;
            }
        }
        
        emit BatchOperationCompleted("utility_update", processed, failed);
    }
    
    // ============ Fee Management Functions ============
    
    /**
     * @notice Update fee configuration (fee admin only)
     * @param transferFee Transfer fee rate in basis points
     * @param burnRate Percentage of fees to burn
     * @param treasuryRate Percentage of fees to treasury
     * @param liquidityRate Percentage of fees to liquidity
     */
    function updateFeeConfig(
        uint16 transferFee,
        uint16 burnRate,
        uint16 treasuryRate,
        uint16 liquidityRate
    ) external onlyRole(FEE_ADMIN_ROLE) {
        if (address(feeManager) == address(0)) revert ModuleNotSet();
        feeManager.updateFeeConfig(transferFee, burnRate, treasuryRate, liquidityRate);
    }
    
    /**
     * @notice Update transaction limits (fee admin only)
     * @param maxTransaction Maximum transaction amount
     * @param maxWallet Maximum wallet balance
     * @param cooldown Transaction cooldown in seconds
     */
    function updateLimitConfig(
        uint256 maxTransaction,
        uint256 maxWallet,
        uint256 cooldown
    ) external onlyRole(FEE_ADMIN_ROLE) {
        if (address(feeManager) == address(0)) revert ModuleNotSet();
        feeManager.updateLimitConfig(maxTransaction, maxWallet, cooldown);
    }
    
    // ============ Governance Functions ============
    
    /**
     * @notice Record governance participation for multiple users
     * @param users Array of user addresses
     * @param participationWeights Array of participation weights
     */
    function batchRecordGovernance(
        address[] calldata users,
        uint256[] calldata participationWeights
    ) external onlyRole(GOVERNANCE_ROLE) whenNotPaused {
        if (users.length != participationWeights.length || users.length == 0) revert BatchOperationFailed();
        if (!systemConfig.governanceEnabled) revert EmergencyModeActive();
        
        uint256 processed = 0;
        uint256 failed = 0;
        
        for (uint256 i = 0; i < users.length; i++) {
            try utilityManager.recordGovernanceParticipation(users[i], participationWeights[i]) {
                processed++;
            } catch {
                failed++;
            }
        }
        
        emit BatchOperationCompleted("governance_participation", processed, failed);
    }
    
    // ============ System Administration Functions ============
    
    /**
     * @notice Update a module address (admin only)
     * @param moduleType Type of module ("core", "fee", "utility")
     * @param newModule New module address
     */
    function updateModule(string calldata moduleType, address newModule) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        bytes32 typeHash = keccak256(bytes(moduleType));
        address oldModule;
        
        if (typeHash == keccak256("core")) {
            oldModule = address(forgeTokenCore);
            forgeTokenCore = IForgeTokenCore(newModule);
        } else if (typeHash == keccak256("fee")) {
            oldModule = address(feeManager);
            feeManager = IForgeFeeManager(newModule);
        } else if (typeHash == keccak256("utility")) {
            oldModule = address(utilityManager);
            utilityManager = IForgeUtilityManager(newModule);
        } else {
            revert InvalidModule();
        }
        
        // Re-setup module connections
        _setupModuleConnections();
        
        emit ModuleUpdated(moduleType, oldModule, newModule);
    }
    
    /**
     * @notice Update system configuration (admin only)
     * @param emergencyMode Whether emergency mode should be active
     * @param feesEnabled Whether fees should be enabled
     * @param utilitiesEnabled Whether utilities should be enabled
     * @param governanceEnabled Whether governance should be enabled
     */
    function updateSystemConfig(
        bool emergencyMode,
        bool feesEnabled,
        bool utilitiesEnabled,
        bool governanceEnabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        systemConfig.emergencyMode = emergencyMode;
        systemConfig.feesEnabled = feesEnabled;
        systemConfig.utilitiesEnabled = utilitiesEnabled;
        systemConfig.governanceEnabled = governanceEnabled;
        
        // Apply configurations to modules
        if (address(feeManager) != address(0)) {
            feeManager.setFeesEnabled(feesEnabled && !emergencyMode);
        }
        
        if (address(utilityManager) != address(0)) {
            utilityManager.setPremiumFeaturesEnabled(utilitiesEnabled && !emergencyMode);
            utilityManager.setStakingEnabled(utilitiesEnabled && !emergencyMode);
        }
        
        emit SystemConfigUpdated(emergencyMode, feesEnabled, utilitiesEnabled, governanceEnabled);
    }
    
    /**
     * @notice Perform system maintenance (admin only)
     * @param maintenanceType Type of maintenance to perform
     */
    function performMaintenance(string calldata maintenanceType) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        bytes32 typeHash = keccak256(bytes(maintenanceType));
        
        if (typeHash == keccak256("emergency_pause")) {
            // Emergency pause all modules
            forgeTokenCore.pause();
            systemConfig.emergencyMode = true;
        } else if (typeHash == keccak256("emergency_unpause")) {
            // Emergency unpause all modules
            forgeTokenCore.unpause();
            systemConfig.emergencyMode = false;
        } else if (typeHash == keccak256("reset_connections")) {
            // Reset module connections
            _setupModuleConnections();
        }
        
        systemConfig.lastMaintenanceTime = block.timestamp;
        emit MaintenancePerformed(block.timestamp, maintenanceType);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get comprehensive token information
     * @return totalSupply Total token supply
     * @return totalFees Total fees collected
     * @return totalBurned Total tokens burned
     * @return totalTreasury Total sent to treasury
     */
    function getTokenInfo() 
        external 
        view 
        returns (uint256 totalSupply, uint256 totalFees, uint256 totalBurned, uint256 totalTreasury) 
    {
        totalSupply = forgeTokenCore.totalSupply();
        
        if (address(feeManager) != address(0)) {
            (totalFees, totalBurned, totalTreasury) = feeManager.getFeeStats();
        }
    }
    
    /**
     * @notice Get user comprehensive information
     * @param user User address
     * @return balance Token balance
     * @return stakingPower Staking power multiplier
     * @return governancePower Governance power multiplier
     * @return premiumTier Premium tier level
     * @return isPremium Whether user has premium status
     */
    function getUserInfo(address user) 
        external 
        view 
        returns (uint256 balance, uint32 stakingPower, uint32 governancePower, uint8 premiumTier, bool isPremium) 
    {
        balance = forgeTokenCore.balanceOf(user);
        
        if (address(utilityManager) != address(0)) {
            (stakingPower, governancePower, premiumTier, isPremium) = utilityManager.getUserUtility(user);
        } else {
            // Default values when utility manager not set
            stakingPower = 100;
            governancePower = 100;
            premiumTier = 0;
            isPremium = false;
        }
    }
    
    /**
     * @notice Get all module addresses
     * @return core Address of ForgeTokenCore
     * @return fee Address of ForgeFeeManager
     * @return utility Address of ForgeUtilityManager
     */
    function getModuleAddresses() 
        external 
        view 
        returns (address core, address fee, address utility) 
    {
        return (address(forgeTokenCore), address(feeManager), address(utilityManager));
    }
    
    /**
     * @notice Get system status
     * @return emergencyMode Whether emergency mode is active
     * @return feesEnabled Whether fees are enabled
     * @return utilitiesEnabled Whether utilities are enabled
     * @return governanceEnabled Whether governance is enabled
     * @return lastMaintenance Last maintenance timestamp
     */
    function getSystemStatus() 
        external 
        view 
        returns (
            bool emergencyMode,
            bool feesEnabled,
            bool utilitiesEnabled,
            bool governanceEnabled,
            uint256 lastMaintenance
        ) 
    {
        SystemConfig memory config = systemConfig;
        return (
            config.emergencyMode,
            config.feesEnabled,
            config.utilitiesEnabled,
            config.governanceEnabled,
            config.lastMaintenanceTime
        );
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