// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title EmergencySystem
 * @dev Centralized emergency management system for coordinated shutdowns
 * @notice Provides circuit breakers, emergency stops, and recovery mechanisms
 */
contract EmergencySystem is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    
    enum EmergencyLevel {
        NONE,           // No emergency
        LOW,            // Minor issues, some functions disabled
        MEDIUM,         // Significant issues, major functions disabled
        HIGH,           // Critical issues, most functions disabled
        CRITICAL        // Complete shutdown
    }
    
    struct EmergencyState {
        EmergencyLevel level;
        uint256 activatedAt;
        uint256 duration;
        address activatedBy;
        string reason;
        bool autoResolve;
    }
    
    struct CircuitBreaker {
        uint256 threshold;          // Failure threshold to trigger
        uint256 windowSize;         // Time window to count failures
        uint256 cooldownPeriod;     // Time before reset
        uint256 failureCount;      // Current failure count
        uint256 windowStart;        // Start of current window
        uint256 lastTriggered;      // Last time circuit breaker triggered
        bool isOpen;               // Circuit breaker state
        EmergencyLevel triggerLevel; // Emergency level to trigger
    }
    
    // Global emergency state
    EmergencyState public emergencyState;
    
    // Contract-specific emergency states
    mapping(address => EmergencyState) public contractEmergencies;
    
    // Function-specific circuit breakers
    mapping(bytes4 => CircuitBreaker) public circuitBreakers;
    
    // Contract circuit breakers
    mapping(address => CircuitBreaker) public contractCircuitBreakers;
    
    // Emergency contacts (can trigger emergencies)
    mapping(address => bool) public emergencyContacts;
    
    // Guardian network (multiple guardians needed for high-level emergencies)
    mapping(address => bool) public guardians;
    mapping(bytes32 => mapping(address => bool)) public guardianVotes;
    mapping(bytes32 => uint256) public guardianVoteCount;
    uint256 public requiredGuardianVotes;
    
    // Recovery settings
    uint256 public maxEmergencyDuration = 7 days;
    bool public recoveryMode;
    uint256 public recoveryStarted;
    
    // Events
    event EmergencyActivated(EmergencyLevel level, address indexed activatedBy, string reason);
    event EmergencyDeactivated(address indexed deactivatedBy);
    event ContractEmergencyActivated(address indexed contract_, EmergencyLevel level, address indexed activatedBy);
    event ContractEmergencyDeactivated(address indexed contract_, address indexed deactivatedBy);
    event CircuitBreakerTriggered(bytes4 indexed selector, uint256 failureCount);
    event CircuitBreakerReset(bytes4 indexed selector);
    event ContractCircuitBreakerTriggered(address indexed contract_, uint256 failureCount);
    event EmergencyContactUpdated(address indexed contact, bool authorized);
    event GuardianUpdated(address indexed guardian, bool authorized);
    event RecoveryModeActivated(address indexed activatedBy);
    event RecoveryModeDeactivated(address indexed deactivatedBy);
    
    // Custom Errors
    error EmergencyActive();
    error InvalidEmergencyLevel();
    error InsufficientPermissions();
    error CircuitBreakerOpen();
    error RecoveryInProgress();
    error InvalidDuration();
    error AlreadyVoted();
    error InsufficientGuardianVotes();
    
    function initialize(
        address[] memory _guardians,
        uint256 _requiredGuardianVotes
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
        
        // Set up guardian network
        for (uint256 i = 0; i < _guardians.length; i++) {
            guardians[_guardians[i]] = true;
            _grantRole(GUARDIAN_ROLE, _guardians[i]);
        }
        
        requiredGuardianVotes = _requiredGuardianVotes;
        emergencyState.level = EmergencyLevel.NONE;
    }
    
    /**
     * @dev Activate global emergency
     */
    function activateEmergency(
        EmergencyLevel level,
        uint256 duration,
        string calldata reason,
        bool autoResolve
    ) external {
        if (level == EmergencyLevel.NONE) revert InvalidEmergencyLevel();
        
        // Check permissions based on emergency level
        if (level <= EmergencyLevel.MEDIUM) {
            require(hasRole(EMERGENCY_ROLE, msg.sender) || emergencyContacts[msg.sender], 
                    "Insufficient permissions for this emergency level");
        } else {
            // High and Critical require guardian consensus
            bytes32 voteId = keccak256(abi.encodePacked(level, duration, reason, block.timestamp));
            _requireGuardianConsensus(voteId);
        }
        
        if (duration > maxEmergencyDuration) revert InvalidDuration();
        
        emergencyState = EmergencyState({
            level: level,
            activatedAt: block.timestamp,
            duration: duration,
            activatedBy: msg.sender,
            reason: reason,
            autoResolve: autoResolve
        });
        
        emit EmergencyActivated(level, msg.sender, reason);
    }
    
    /**
     * @dev Deactivate global emergency
     */
    function deactivateEmergency() external onlyRole(ADMIN_ROLE) {
        require(emergencyState.level != EmergencyLevel.NONE, "No active emergency");
        
        delete emergencyState;
        
        emit EmergencyDeactivated(msg.sender);
    }
    
    /**
     * @dev Activate contract-specific emergency
     */
    function activateContractEmergency(
        address contract_,
        EmergencyLevel level,
        uint256 duration,
        string calldata reason
    ) external onlyRole(EMERGENCY_ROLE) {
        if (level == EmergencyLevel.NONE) revert InvalidEmergencyLevel();
        if (duration > maxEmergencyDuration) revert InvalidDuration();
        
        contractEmergencies[contract_] = EmergencyState({
            level: level,
            activatedAt: block.timestamp,
            duration: duration,
            activatedBy: msg.sender,
            reason: reason,
            autoResolve: true
        });
        
        emit ContractEmergencyActivated(contract_, level, msg.sender);
    }
    
    /**
     * @dev Set up circuit breaker for function
     */
    function setCircuitBreaker(
        bytes4 selector,
        uint256 threshold,
        uint256 windowSize,
        uint256 cooldownPeriod,
        EmergencyLevel triggerLevel
    ) external onlyRole(ADMIN_ROLE) {
        circuitBreakers[selector] = CircuitBreaker({
            threshold: threshold,
            windowSize: windowSize,
            cooldownPeriod: cooldownPeriod,
            failureCount: 0,
            windowStart: block.timestamp,
            lastTriggered: 0,
            isOpen: false,
            triggerLevel: triggerLevel
        });
    }
    
    /**
     * @dev Record failure for circuit breaker
     */
    function recordFailure(bytes4 selector) external {
        CircuitBreaker storage cb = circuitBreakers[selector];
        if (cb.threshold == 0) return; // No circuit breaker configured
        
        uint256 currentTime = block.timestamp;
        
        // Reset window if needed
        if (currentTime > cb.windowStart + cb.windowSize) {
            cb.windowStart = currentTime;
            cb.failureCount = 0;
        }
        
        cb.failureCount++;
        
        // Check if threshold exceeded
        if (cb.failureCount >= cb.threshold && !cb.isOpen) {
            cb.isOpen = true;
            cb.lastTriggered = currentTime;
            
            // Activate emergency if configured
            if (cb.triggerLevel != EmergencyLevel.NONE) {
                _autoActivateEmergency(cb.triggerLevel, "Circuit breaker triggered");
            }
            
            emit CircuitBreakerTriggered(selector, cb.failureCount);
        }
    }
    
    /**
     * @dev Check if function is blocked by emergency or circuit breaker
     */
    function checkEmergencyStatus(bytes4 selector) external view returns (bool blocked, string memory reason) {
        // Check global emergency
        if (emergencyState.level != EmergencyLevel.NONE) {
            if (_shouldBlockFunction(emergencyState.level)) {
                return (true, "Global emergency active");
            }
        }
        
        // Check contract emergency
        EmergencyState storage contractEmergency = contractEmergencies[msg.sender];
        if (contractEmergency.level != EmergencyLevel.NONE) {
            if (_shouldBlockFunction(contractEmergency.level)) {
                return (true, "Contract emergency active");
            }
        }
        
        // Check circuit breaker
        CircuitBreaker storage cb = circuitBreakers[selector];
        if (cb.isOpen) {
            if (block.timestamp < cb.lastTriggered + cb.cooldownPeriod) {
                return (true, "Circuit breaker open");
            } else {
                // Auto-reset circuit breaker after cooldown
                // Note: This is a view function, so state changes need to be done elsewhere
                return (false, "");
            }
        }
        
        return (false, "");
    }
    
    /**
     * @dev Reset circuit breaker manually
     */
    function resetCircuitBreaker(bytes4 selector) external onlyRole(ADMIN_ROLE) {
        CircuitBreaker storage cb = circuitBreakers[selector];
        cb.isOpen = false;
        cb.failureCount = 0;
        cb.windowStart = block.timestamp;
        
        emit CircuitBreakerReset(selector);
    }
    
    /**
     * @dev Vote for guardian consensus
     */
    function voteGuardianConsensus(bytes32 voteId) external onlyRole(GUARDIAN_ROLE) {
        if (guardianVotes[voteId][msg.sender]) revert AlreadyVoted();
        
        guardianVotes[voteId][msg.sender] = true;
        guardianVoteCount[voteId]++;
    }
    
    /**
     * @dev Set emergency contact
     */
    function setEmergencyContact(address contact, bool authorized) external onlyRole(ADMIN_ROLE) {
        emergencyContacts[contact] = authorized;
        emit EmergencyContactUpdated(contact, authorized);
    }
    
    /**
     * @dev Activate recovery mode
     */
    function activateRecoveryMode() external onlyRole(ADMIN_ROLE) {
        recoveryMode = true;
        recoveryStarted = block.timestamp;
        
        emit RecoveryModeActivated(msg.sender);
    }
    
    /**
     * @dev Auto-resolve emergencies that have expired
     */
    function autoResolveEmergencies() external {
        // Resolve global emergency
        if (emergencyState.level != EmergencyLevel.NONE && 
            emergencyState.autoResolve &&
            block.timestamp > emergencyState.activatedAt + emergencyState.duration) {
            
            delete emergencyState;
            emit EmergencyDeactivated(address(0));
        }
    }
    
    /**
     * @dev Internal function to check guardian consensus
     */
    function _requireGuardianConsensus(bytes32 voteId) internal view {
        if (guardianVoteCount[voteId] < requiredGuardianVotes) {
            revert InsufficientGuardianVotes();
        }
    }
    
    /**
     * @dev Internal function to auto-activate emergency
     */
    function _autoActivateEmergency(EmergencyLevel level, string memory reason) internal {
        if (emergencyState.level < level) {
            emergencyState = EmergencyState({
                level: level,
                activatedAt: block.timestamp,
                duration: 1 hours, // Short duration for auto-triggered emergencies
                activatedBy: address(this),
                reason: reason,
                autoResolve: true
            });
            
            emit EmergencyActivated(level, address(this), reason);
        }
    }
    
    /**
     * @dev Internal function to determine if function should be blocked
     */
    function _shouldBlockFunction(EmergencyLevel level) internal pure returns (bool) {
        return level >= EmergencyLevel.MEDIUM; // Block on MEDIUM, HIGH, CRITICAL
    }
    
    /**
     * @dev Get current emergency level for external contracts
     */
    function getCurrentEmergencyLevel() external view returns (EmergencyLevel) {
        EmergencyLevel contractLevel = contractEmergencies[msg.sender].level;
        return emergencyState.level > contractLevel ? emergencyState.level : contractLevel;
    }
}