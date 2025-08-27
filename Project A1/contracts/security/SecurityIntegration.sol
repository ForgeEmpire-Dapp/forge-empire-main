// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./MultiSigGuard.sol";
import "./RateLimiter.sol";
import "./EmergencySystem.sol";
import "../libraries/InputValidator.sol";

/**
 * @title SecurityIntegration
 * @dev Base contract that integrates all security features
 * @notice Inherit from this contract to get comprehensive security protection
 */
abstract contract SecurityIntegration is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable 
{
    using InputValidator for string;
    using InputValidator for address;
    using InputValidator for uint256;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SECURITY_MANAGER_ROLE = keccak256("SECURITY_MANAGER_ROLE");
    
    // Security system contracts
    MultiSigGuard public multiSigGuard;
    RateLimiter public rateLimiter;
    EmergencySystem public emergencySystem;
    
    // Security settings
    bool public securityFeaturesEnabled;
    mapping(bytes4 => bool) public rateLimitedFunctions;
    mapping(bytes4 => bool) public multiSigRequiredFunctions;
    
    // Events
    event SecuritySystemUpdated(address indexed system, string systemType);
    event SecurityFeatureToggled(string feature, bool enabled);
    event FunctionSecurityUpdated(bytes4 indexed selector, string securityType, bool enabled);
    
    // Modifiers
    modifier withRateLimit() {
        if (securityFeaturesEnabled && rateLimitedFunctions[msg.sig] && address(rateLimiter) != address(0)) {
            require(rateLimiter.checkRateLimit(msg.sender, msg.sig), "Rate limit exceeded");
        }
        _;
    }
    
    modifier withEmergencyCheck() {
        if (securityFeaturesEnabled && address(emergencySystem) != address(0)) {
            (bool blocked, string memory reason) = emergencySystem.checkEmergencyStatus(msg.sig);
            require(!blocked, reason);
        }
        _;
    }
    
    modifier withMultiSig() {
        if (securityFeaturesEnabled && multiSigRequiredFunctions[msg.sig] && address(multiSigGuard) != address(0)) {
            // For multi-sig functions, they should be called through MultiSigGuard.executeProposal
            require(msg.sender == address(multiSigGuard), "Multi-sig required");
        }
        _;
    }
    
    modifier validAddress(address _address) {
        _address.validateAddress();
        _;
    }
    
    modifier validAmount(uint256 amount) {
        amount.validateAmount();
        _;
    }
    
    modifier validString(string memory str, uint256 minLength, uint256 maxLength) {
        str.validateStringLength(minLength, maxLength);
        _;
    }
    
    function __SecurityIntegration_init(
        address payable _multiSigGuard,
        address _rateLimiter,
        address _emergencySystem
    ) internal onlyInitializing {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(SECURITY_MANAGER_ROLE, msg.sender);
        
        multiSigGuard = MultiSigGuard(_multiSigGuard);
        rateLimiter = RateLimiter(_rateLimiter);
        emergencySystem = EmergencySystem(_emergencySystem);
        
        securityFeaturesEnabled = true;
    }
    
    /**
     * @dev Update security system contracts
     */
    function updateSecuritySystem(
        address payable _multiSigGuard,
        address _rateLimiter,
        address _emergencySystem
    ) external onlyRole(ADMIN_ROLE) {
        if (_multiSigGuard != address(0)) {
            multiSigGuard = MultiSigGuard(_multiSigGuard);
            emit SecuritySystemUpdated(_multiSigGuard, "MultiSigGuard");
        }
        
        if (_rateLimiter != address(0)) {
            rateLimiter = RateLimiter(_rateLimiter);
            emit SecuritySystemUpdated(_rateLimiter, "RateLimiter");
        }
        
        if (_emergencySystem != address(0)) {
            emergencySystem = EmergencySystem(_emergencySystem);
            emit SecuritySystemUpdated(_emergencySystem, "EmergencySystem");
        }
    }
    
    /**
     * @dev Toggle security features on/off
     */
    function toggleSecurityFeatures(bool enabled) external onlyRole(ADMIN_ROLE) {
        securityFeaturesEnabled = enabled;
        emit SecurityFeatureToggled("AllFeatures", enabled);
    }
    
    /**
     * @dev Configure function-level security
     */
    function configureFunctionSecurity(
        bytes4 selector,
        bool requiresRateLimit,
        bool requiresMultiSig
    ) external onlyRole(SECURITY_MANAGER_ROLE) {
        rateLimitedFunctions[selector] = requiresRateLimit;
        multiSigRequiredFunctions[selector] = requiresMultiSig;
        
        emit FunctionSecurityUpdated(selector, "RateLimit", requiresRateLimit);
        emit FunctionSecurityUpdated(selector, "MultiSig", requiresMultiSig);
    }
    
    /**
     * @dev Bulk configure function security
     */
    function bulkConfigureFunctionSecurity(
        bytes4[] calldata selectors,
        bool[] calldata requiresRateLimit,
        bool[] calldata requiresMultiSig
    ) external onlyRole(SECURITY_MANAGER_ROLE) {
        require(selectors.length == requiresRateLimit.length && 
                selectors.length == requiresMultiSig.length, "Array length mismatch");
        
        for (uint256 i = 0; i < selectors.length; i++) {
            rateLimitedFunctions[selectors[i]] = requiresRateLimit[i];
            multiSigRequiredFunctions[selectors[i]] = requiresMultiSig[i];
            
            emit FunctionSecurityUpdated(selectors[i], "RateLimit", requiresRateLimit[i]);
            emit FunctionSecurityUpdated(selectors[i], "MultiSig", requiresMultiSig[i]);
        }
    }
    
    /**
     * @dev Record failure for circuit breaker
     */
    function _recordSecurityFailure(bytes4 selector) internal {
        if (securityFeaturesEnabled && address(emergencySystem) != address(0)) {
            emergencySystem.recordFailure(selector);
        }
    }
    
    /**
     * @dev Secure function execution wrapper (simplified)
     */
    function _secureExecute(bytes4 selector) internal withRateLimit withEmergencyCheck returns (bool success) {
        // Simplified version - actual execution should be in calling contract
        return true;
    }
    
    /**
     * @dev Get security status
     */
    function getSecurityStatus() external view returns (
        bool featuresEnabled,
        address multiSigAddress,
        address rateLimiterAddress,
        address emergencySystemAddress
    ) {
        return (
            securityFeaturesEnabled,
            address(multiSigGuard),
            address(rateLimiter),
            address(emergencySystem)
        );
    }
    
    /**
     * @dev Check if function has security features enabled
     */
    function getFunctionSecurity(bytes4 selector) external view returns (
        bool hasRateLimit,
        bool hasMultiSig
    ) {
        return (
            rateLimitedFunctions[selector],
            multiSigRequiredFunctions[selector]
        );
    }
    
    /**
     * @dev Emergency pause (can be called by emergency system)
     */
    function emergencyPause() external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || 
            msg.sender == address(emergencySystem) ||
            (address(emergencySystem) != address(0) && 
             emergencySystem.emergencyContacts(msg.sender)),
            "Unauthorized emergency pause"
        );
        
        _pause();
    }
    
    /**
     * @dev Emergency unpause
     */
    function emergencyUnpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Override pause to integrate with emergency system
     */
    function pause() public virtual onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Override unpause to integrate with emergency system
     */
    function unpause() public virtual onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}