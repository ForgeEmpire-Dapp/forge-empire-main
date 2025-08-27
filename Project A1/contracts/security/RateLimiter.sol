// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title RateLimiter
 * @dev Flexible rate limiting system to prevent spam and DoS attacks
 * @notice Supports multiple rate limiting strategies: fixed window, sliding window, token bucket
 */
contract RateLimiter is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RATE_MANAGER_ROLE = keccak256("RATE_MANAGER_ROLE");
    
    enum LimitType {
        FIXED_WINDOW,      // Fixed time window
        SLIDING_WINDOW,    // Sliding time window
        TOKEN_BUCKET       // Token bucket algorithm
    }
    
    struct RateLimit {
        LimitType limitType;
        uint256 maxRequests;     // Maximum requests allowed
        uint256 windowSize;      // Time window in seconds
        uint256 refillRate;      // For token bucket: tokens per second
        bool active;
        bool globalLimit;        // If true, applies to all users combined
    }
    
    struct UserLimit {
        uint256 requestCount;
        uint256 lastRequest;
        uint256 windowStart;
        uint256 tokens;          // For token bucket
        uint256 lastRefill;      // For token bucket
    }
    
    // Rate limit configurations by function selector
    mapping(bytes4 => RateLimit) public rateLimits;
    
    // User-specific rate limit tracking
    mapping(address => mapping(bytes4 => UserLimit)) public userLimits;
    
    // Global rate limit tracking
    mapping(bytes4 => UserLimit) public globalLimits;
    
    // Whitelist for bypassing rate limits
    mapping(address => bool) public isWhitelisted;
    
    // Function selector to name mapping for events
    mapping(bytes4 => string) public functionNames;
    
    // Events
    event RateLimitSet(bytes4 indexed selector, string functionName, LimitType limitType, uint256 maxRequests, uint256 windowSize);
    event RateLimitExceededEvent(address indexed user, bytes4 indexed selector, string functionName, uint256 attempts);
    event UserWhitelisted(address indexed user, bool whitelisted);
    event RateLimitCleared(address indexed user, bytes4 indexed selector);
    
    // Custom Errors
    error RateLimitExceeded();
    error InvalidRateLimit();
    error FunctionNotFound();
    
    function initialize() public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(RATE_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @dev Set rate limit for a specific function
     */
    function setRateLimit(
        bytes4 selector,
        string calldata functionName,
        LimitType limitType,
        uint256 maxRequests,
        uint256 windowSize,
        uint256 refillRate,
        bool globalLimit
    ) external onlyRole(RATE_MANAGER_ROLE) {
        require(maxRequests > 0, "Max requests must be > 0");
        require(windowSize > 0, "Window size must be > 0");
        
        if (limitType == LimitType.TOKEN_BUCKET) {
            require(refillRate > 0, "Refill rate must be > 0");
        }
        
        rateLimits[selector] = RateLimit({
            limitType: limitType,
            maxRequests: maxRequests,
            windowSize: windowSize,
            refillRate: refillRate,
            active: true,
            globalLimit: globalLimit
        });
        
        functionNames[selector] = functionName;
        
        emit RateLimitSet(selector, functionName, limitType, maxRequests, windowSize);
    }
    
    /**
     * @dev Check if user can perform action (call this in your contracts)
     */
    function checkRateLimit(address user, bytes4 selector) external returns (bool) {
        if (isWhitelisted[user]) {
            return true;
        }
        
        RateLimit storage limit = rateLimits[selector];
        if (!limit.active) {
            return true;
        }
        
        UserLimit storage userLimit = limit.globalLimit ? globalLimits[selector] : userLimits[user][selector];
        
        if (limit.limitType == LimitType.FIXED_WINDOW) {
            return _checkFixedWindow(user, selector, limit, userLimit);
        } else if (limit.limitType == LimitType.SLIDING_WINDOW) {
            return _checkSlidingWindow(user, selector, limit, userLimit);
        } else if (limit.limitType == LimitType.TOKEN_BUCKET) {
            return _checkTokenBucket(user, selector, limit, userLimit);
        }
        
        return true;
    }
    
    /**
     * @dev Fixed window rate limiting
     */
    function _checkFixedWindow(
        address user,
        bytes4 selector,
        RateLimit storage limit,
        UserLimit storage userLimit
    ) internal returns (bool) {
        uint256 currentTime = block.timestamp;
        
        // Check if we're in a new window
        if (currentTime >= userLimit.windowStart + limit.windowSize) {
            userLimit.windowStart = currentTime;
            userLimit.requestCount = 0;
        }
        
        // Check if limit exceeded
        if (userLimit.requestCount >= limit.maxRequests) {
            emit RateLimitExceededEvent(user, selector, functionNames[selector], userLimit.requestCount + 1);
            return false;
        }
        
        userLimit.requestCount++;
        userLimit.lastRequest = currentTime;
        
        return true;
    }
    
    /**
     * @dev Sliding window rate limiting
     */
    function _checkSlidingWindow(
        address user,
        bytes4 selector,
        RateLimit storage limit,
        UserLimit storage userLimit
    ) internal returns (bool) {
        uint256 currentTime = block.timestamp;
        
        // If more than windowSize has passed, reset
        if (currentTime > userLimit.lastRequest + limit.windowSize) {
            userLimit.requestCount = 0;
        } else {
            // Calculate how many requests should have "expired" from the sliding window
            uint256 timePassed = currentTime - userLimit.lastRequest;
            uint256 requestsToSubtract = (userLimit.requestCount * timePassed) / limit.windowSize;
            
            if (requestsToSubtract >= userLimit.requestCount) {
                userLimit.requestCount = 0;
            } else {
                userLimit.requestCount -= requestsToSubtract;
            }
        }
        
        // Check if limit exceeded
        if (userLimit.requestCount >= limit.maxRequests) {
            emit RateLimitExceededEvent(user, selector, functionNames[selector], userLimit.requestCount + 1);
            return false;
        }
        
        userLimit.requestCount++;
        userLimit.lastRequest = currentTime;
        
        return true;
    }
    
    /**
     * @dev Token bucket rate limiting
     */
    function _checkTokenBucket(
        address user,
        bytes4 selector,
        RateLimit storage limit,
        UserLimit storage userLimit
    ) internal returns (bool) {
        uint256 currentTime = block.timestamp;
        
        // Initialize if first request
        if (userLimit.lastRefill == 0) {
            userLimit.tokens = limit.maxRequests;
            userLimit.lastRefill = currentTime;
        }
        
        // Refill tokens based on time passed
        uint256 timePassed = currentTime - userLimit.lastRefill;
        uint256 tokensToAdd = timePassed * limit.refillRate;
        
        userLimit.tokens = userLimit.tokens + tokensToAdd > limit.maxRequests 
            ? limit.maxRequests 
            : userLimit.tokens + tokensToAdd;
        userLimit.lastRefill = currentTime;
        
        // Check if tokens available
        if (userLimit.tokens == 0) {
            emit RateLimitExceededEvent(user, selector, functionNames[selector], 0);
            return false;
        }
        
        userLimit.tokens--;
        userLimit.lastRequest = currentTime;
        
        return true;
    }
    
    /**
     * @dev Add/remove user from whitelist
     */
    function setWhitelisted(address user, bool whitelisted) external onlyRole(ADMIN_ROLE) {
        isWhitelisted[user] = whitelisted;
        emit UserWhitelisted(user, whitelisted);
    }
    
    /**
     * @dev Bulk whitelist users
     */
    function bulkSetWhitelisted(address[] calldata users, bool whitelisted) external onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < users.length; i++) {
            isWhitelisted[users[i]] = whitelisted;
            emit UserWhitelisted(users[i], whitelisted);
        }
    }
    
    /**
     * @dev Clear rate limit for a user (emergency use)
     */
    function clearUserRateLimit(address user, bytes4 selector) external onlyRole(ADMIN_ROLE) {
        delete userLimits[user][selector];
        emit RateLimitCleared(user, selector);
    }
    
    /**
     * @dev Clear global rate limit (emergency use)
     */
    function clearGlobalRateLimit(bytes4 selector) external onlyRole(ADMIN_ROLE) {
        delete globalLimits[selector];
        emit RateLimitCleared(address(0), selector);
    }
    
    /**
     * @dev Activate/deactivate rate limit
     */
    function setRateLimitActive(bytes4 selector, bool active) external onlyRole(RATE_MANAGER_ROLE) {
        rateLimits[selector].active = active;
    }
    
    /**
     * @dev Get user's current rate limit status
     */
    function getUserRateLimit(address user, bytes4 selector) external view returns (
        uint256 requestCount,
        uint256 lastRequest,
        uint256 windowStart,
        uint256 tokens,
        uint256 lastRefill
    ) {
        RateLimit storage limit = rateLimits[selector];
        UserLimit storage userLimit = limit.globalLimit ? globalLimits[selector] : userLimits[user][selector];
        
        return (
            userLimit.requestCount,
            userLimit.lastRequest,
            userLimit.windowStart,
            userLimit.tokens,
            userLimit.lastRefill
        );
    }
    
    /**
     * @dev Get rate limit configuration
     */
    function getRateLimit(bytes4 selector) external view returns (
        LimitType limitType,
        uint256 maxRequests,
        uint256 windowSize,
        uint256 refillRate,
        bool active,
        bool globalLimit
    ) {
        RateLimit storage limit = rateLimits[selector];
        return (
            limit.limitType,
            limit.maxRequests,
            limit.windowSize,
            limit.refillRate,
            limit.active,
            limit.globalLimit
        );
    }
}