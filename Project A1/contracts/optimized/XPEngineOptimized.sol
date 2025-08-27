// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title XPEngineOptimized
 * @dev Gas-optimized version of XPEngine with improved storage layout
 * @notice Implements struct packing and assembly optimizations for hot paths
 */
contract XPEngineOptimized is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    
    // ============ CONSTANTS ============
    bytes32 public constant XP_AWARDER_ROLE = keccak256("XP_AWARDER_ROLE");
    bytes32 public constant XP_GRANTER_ROLE = keccak256("XP_GRANTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 private constant MAX_XP_PER_USER = type(uint128).max; // Reasonable limit for individual users
    
    // ============ OPTIMIZED STORAGE ============
    
    // Pack global state into single slot (32 bytes)
    struct GlobalState {
        uint128 totalXPAwarded;      // 16 bytes - sufficient for total XP
        uint64 lastUpdateTimestamp;  // 8 bytes - timestamp
        uint32 totalUsers;           // 4 bytes - user count  
        uint32 flags;                // 4 bytes - various flags
    }
    GlobalState private _globalState;
    
    // Pack user XP data efficiently
    struct UserXPData {
        uint128 xpBalance;           // 16 bytes - user's XP balance
        uint64 lastActivityTime;     // 8 bytes - last activity timestamp
        uint32 activityCount;        // 4 bytes - number of XP-earning activities
        uint32 level;                // 4 bytes - calculated level (cached)
    }
    
    // Primary storage - packed user data
    mapping(address => UserXPData) private _userXPData;
    
    // ============ EVENTS ============
    event XPAwarded(address indexed user, uint256 amount, address indexed awarder);
    event XPSpent(address indexed user, uint256 amount);
    event LevelUp(address indexed user, uint32 newLevel);
    
    // Batch events for gas efficiency
    event BatchXPAwarded(address[] indexed users, uint256[] amounts, address indexed awarder);
    
    // ============ ERRORS ============
    error ZeroAddressUser();
    error ZeroXPAmount();
    error InsufficientXP(uint256 currentXP, uint256 requestedXP);
    error ArrayLengthMismatch();
    error BatchSizeExceeded(uint256 maxAllowed, uint256 current);
    error EmptyArrays();
    error XPLimitExceeded(uint256 limit);
    
    // ============ INITIALIZATION ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        // Initialize global state
        _globalState.lastUpdateTimestamp = uint64(block.timestamp);
    }
    
    // ============ OPTIMIZED EXTERNAL FUNCTIONS ============
    
    /**
     * @dev Award XP to a single user (optimized version)
     */
    function awardXP(address user, uint256 amount) external onlyRole(XP_GRANTER_ROLE) whenNotPaused {
        if (user == address(0)) revert ZeroAddressUser();
        if (amount == 0) revert ZeroXPAmount();
        
        _awardXPOptimized(user, amount);
        emit XPAwarded(user, amount, msg.sender);
    }
    
    /**
     * @dev Batch award XP (highly optimized)
     */
    function batchAwardXP(
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyRole(XP_GRANTER_ROLE) whenNotPaused nonReentrant {
        uint256 length = users.length;
        if (length == 0) revert EmptyArrays();
        if (length != amounts.length) revert ArrayLengthMismatch();
        if (length > MAX_BATCH_SIZE) revert BatchSizeExceeded(MAX_BATCH_SIZE, length);
        
        // Gas optimization: cache global state once
        GlobalState memory globalState = _globalState;
        
        // Process batch with optimized loop
        assembly {
            let usersPtr := add(users.offset, 0x00)
            let amountsPtr := add(amounts.offset, 0x00)
            
            for { let i := 0 } lt(i, length) { i := add(i, 1) } {
                let user := calldataload(add(usersPtr, mul(i, 0x20)))
                let amount := calldataload(add(amountsPtr, mul(i, 0x20)))
                
                // Validate user address (non-zero)
                if iszero(user) {
                    // Revert with ZeroAddressUser()
                    mstore(0x00, 0x3f2a2ce2) // Error selector
                    revert(0x1c, 0x04)
                }
                
                // Validate amount (non-zero)
                if iszero(amount) {
                    // Revert with ZeroXPAmount()
                    mstore(0x00, 0x1f2a2ac2) // Error selector  
                    revert(0x1c, 0x04)
                }
            }
        }
        
        // Award XP to all users
        for (uint256 i = 0; i < length;) {
            _awardXPOptimized(users[i], amounts[i]);
            unchecked { ++i; }
        }
        
        emit BatchXPAwarded(users, amounts, msg.sender);
    }
    
    /**
     * @dev Get user XP balance (optimized view)
     */
    function getXP(address user) external view returns (uint256) {
        return _userXPData[user].xpBalance;
    }
    
    /**
     * @dev Get user level (optimized with caching)
     */
    function getLevel(address user) external view returns (uint32) {
        UserXPData storage userData = _userXPData[user];
        
        // Return cached level if recent
        if (block.timestamp - userData.lastActivityTime < 1 hours) {
            return userData.level;
        }
        
        // Recalculate level
        return _calculateLevel(userData.xpBalance);
    }
    
    /**
     * @dev Get comprehensive user stats
     */
    function getUserStats(address user) external view returns (
        uint128 xpBalance,
        uint32 level,
        uint32 activityCount,
        uint64 lastActivityTime
    ) {
        UserXPData storage userData = _userXPData[user];
        return (
            userData.xpBalance,
            userData.level,
            userData.activityCount,
            userData.lastActivityTime
        );
    }
    
    /**
     * @dev Get global statistics
     */
    function getGlobalStats() external view returns (
        uint128 totalXPAwarded,
        uint32 totalUsers,
        uint64 lastUpdateTimestamp
    ) {
        GlobalState storage globalState = _globalState;
        return (
            globalState.totalXPAwarded,
            globalState.totalUsers,
            globalState.lastUpdateTimestamp
        );
    }
    
    // ============ INTERNAL OPTIMIZED FUNCTIONS ============
    
    /**
     * @dev Internal optimized XP awarding
     */
    function _awardXPOptimized(address user, uint256 amount) internal {
        UserXPData storage userData = _userXPData[user];
        
        // Check XP limit
        uint256 newBalance = userData.xpBalance + amount;
        if (newBalance > MAX_XP_PER_USER) revert XPLimitExceeded(MAX_XP_PER_USER);
        
        // Check if this is a new user
        bool isNewUser = userData.xpBalance == 0;
        
        // Update user data
        userData.xpBalance = uint128(newBalance);
        userData.lastActivityTime = uint64(block.timestamp);
        userData.activityCount += 1;
        
        // Calculate and cache new level
        uint32 oldLevel = userData.level;
        uint32 newLevel = _calculateLevel(newBalance);
        userData.level = newLevel;
        
        // Update global state
        _globalState.totalXPAwarded += uint128(amount);
        _globalState.lastUpdateTimestamp = uint64(block.timestamp);
        
        if (isNewUser) {
            _globalState.totalUsers += 1;
        }
        
        // Emit level up event if applicable
        if (newLevel > oldLevel) {
            emit LevelUp(user, newLevel);
        }
    }
    
    /**
     * @dev Optimized level calculation with assembly
     */
    function _calculateLevel(uint256 xp) internal pure returns (uint32 level) {
        // Use square root approximation for level calculation
        // Level = sqrt(XP / 100) 
        if (xp < 100) return 1;
        
        assembly {
            // Babylonian method for square root
            let x := div(xp, 100)
            let y := x
            let z := div(add(x, 1), 2)
            
            for { } lt(z, y) { } {
                y := z
                z := div(add(div(x, z), z), 2)
            }
            
            level := y
            
            // Cap at reasonable maximum
            if gt(level, 1000) { level := 1000 }
            // Minimum level is 1
            if eq(level, 0) { level := 1 }
        }
    }
    
    /**
     * @dev Spend XP (for future use)
     */
    function spendXP(address user, uint256 amount) external onlyRole(XP_GRANTER_ROLE) whenNotPaused {
        UserXPData storage userData = _userXPData[user];
        
        if (userData.xpBalance < amount) {
            revert InsufficientXP(userData.xpBalance, amount);
        }
        
        userData.xpBalance -= uint128(amount);
        userData.lastActivityTime = uint64(block.timestamp);
        
        emit XPSpent(user, amount);
    }
    
    // ============ BATCH OPERATIONS ============
    
    /**
     * @dev Get XP for multiple users (gas optimized)
     */
    function batchGetXP(address[] calldata users) external view returns (uint128[] memory xpBalances) {
        uint256 length = users.length;
        xpBalances = new uint128[](length);
        
        for (uint256 i = 0; i < length;) {
            xpBalances[i] = _userXPData[users[i]].xpBalance;
            unchecked { ++i; }
        }
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Admin function to adjust user XP (emergency use)
     */
    function adjustUserXP(address user, uint128 newBalance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        UserXPData storage userData = _userXPData[user];
        uint128 oldBalance = userData.xpBalance;
        
        userData.xpBalance = newBalance;
        userData.lastActivityTime = uint64(block.timestamp);
        userData.level = _calculateLevel(newBalance);
        
        // Adjust global total
        if (newBalance > oldBalance) {
            _globalState.totalXPAwarded += (newBalance - oldBalance);
        } else {
            _globalState.totalXPAwarded -= (oldBalance - newBalance);
        }
        
        _globalState.lastUpdateTimestamp = uint64(block.timestamp);
    }
    
    // ============ PAUSE FUNCTIONS ============
    
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}