// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IXPEngine {
    function awardXP(address _user, uint256 _amount) external;
}

interface IBadgeMinter {
    function mintBadge(address _to, string memory _tokenURI) external returns (uint256);
}

interface IStreakCore {
    function getCurrentStreak(address user, uint8 streakType) external view returns (uint32);
    function getLongestStreak(address user, uint8 streakType) external view returns (uint32);
}

/**
 * @title StreakRewards
 * @dev Handles reward distribution for streak achievements
 * @notice This contract manages XP awards and badge minting for streak milestones
 * @author Avax Forge Empire Team
 */
contract StreakRewards is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    
    bytes32 public constant REWARD_MANAGER_ROLE = keccak256("REWARD_MANAGER_ROLE");
    
    IXPEngine public xpEngine;
    IBadgeMinter public badgeMinter;
    IStreakCore public streakCore;
    
    // Packed reward struct for gas efficiency
    struct PackedReward {
        uint32 threshold;
        uint32 xpReward;
        uint32 multiplier; // 100 = 1x, 200 = 2x
        bool isActive;
    }
    
    // Reward configurations: streakType => threshold => PackedReward
    mapping(uint8 => mapping(uint32 => PackedReward)) public streakRewards;
    
    // Badge URIs for rewards: streakType => threshold => badgeURI
    mapping(uint8 => mapping(uint32 => string)) public rewardBadgeURIs;
    
    // Reward thresholds for each streak type (sorted for binary search)
    mapping(uint8 => uint32[]) public rewardThresholds;
    
    // Track claimed rewards: user => streakType => threshold => claimed
    mapping(address => mapping(uint8 => mapping(uint32 => bool))) public claimedRewards;
    
    // Multiplier tracking for bonus XP
    mapping(address => mapping(uint8 => uint32)) public activeMultipliers;
    
    // Events
    event RewardClaimed(address indexed user, uint8 indexed streakType, uint32 threshold, uint32 xpReward, uint256 badgeId);
    event MultiplierApplied(address indexed user, uint8 indexed streakType, uint32 multiplier, uint32 bonusXP);
    event RewardConfigured(uint8 indexed streakType, uint32 threshold, uint32 xpReward, uint32 multiplier);
    event BatchRewardsClaimed(address indexed user, uint32 totalXP, uint256[] badgeIds);
    
    // Custom Errors
    error InvalidStreakType();
    error RewardNotActive();
    error AlreadyClaimed();
    error InsufficientStreak();
    error NoRewardsAvailable();
    error InvalidThreshold();
    
    /**
     * @notice Initializes the StreakRewards contract
     * @param _xpEngineAddress Address of the XP Engine contract
     * @param _badgeMinterAddress Address of the Badge Minter contract
     * @param _streakCoreAddress Address of the StreakCore contract
     */
    function initialize(
        address _xpEngineAddress,
        address _badgeMinterAddress,
        address _streakCoreAddress
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REWARD_MANAGER_ROLE, msg.sender);
        
        xpEngine = IXPEngine(_xpEngineAddress);
        badgeMinter = IBadgeMinter(_badgeMinterAddress);
        streakCore = IStreakCore(_streakCoreAddress);
        
        _initializeDefaultRewards();
    }
    
    /**
     * @notice Claim reward for a specific streak threshold
     * @param streakType The streak type (0-4)
     * @param threshold The streak threshold to claim
     */
    function claimReward(uint8 streakType, uint32 threshold) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        _claimSingleReward(msg.sender, streakType, threshold);
    }
    
    /**
     * @notice Claim all available rewards for a user
     * @param streakType The streak type to claim rewards for
     */
    function claimAllRewards(uint8 streakType) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        if (streakType > 4) revert InvalidStreakType();
        
        uint32 currentStreak = streakCore.getCurrentStreak(msg.sender, streakType);
        uint32[] memory thresholds = rewardThresholds[streakType];
        
        uint32 totalXP = 0;
        uint256[] memory badgeIds = new uint256[](thresholds.length);
        uint256 badgeCount = 0;
        
        for (uint256 i = 0; i < thresholds.length; i++) {
            uint32 threshold = thresholds[i];
            
            if (currentStreak >= threshold && 
                !claimedRewards[msg.sender][streakType][threshold] &&
                streakRewards[streakType][threshold].isActive) {
                
                PackedReward memory reward = streakRewards[streakType][threshold];
                claimedRewards[msg.sender][streakType][threshold] = true;
                
                // Award XP
                if (reward.xpReward > 0) {
                    totalXP += reward.xpReward;
                }
                
                // Mint badge if URI exists
                string memory badgeURI = rewardBadgeURIs[streakType][threshold];
                if (bytes(badgeURI).length > 0) {
                    uint256 badgeId = badgeMinter.mintBadge(msg.sender, badgeURI);
                    badgeIds[badgeCount] = badgeId;
                    badgeCount++;
                }
                
                // Apply multiplier
                if (reward.multiplier > 100) {
                    activeMultipliers[msg.sender][streakType] = reward.multiplier;
                }
            }
        }
        
        if (totalXP == 0 && badgeCount == 0) revert NoRewardsAvailable();
        
        if (totalXP > 0) {
            xpEngine.awardXP(msg.sender, totalXP);
        }
        
        // Trim badge array
        uint256[] memory finalBadgeIds = new uint256[](badgeCount);
        for (uint256 i = 0; i < badgeCount; i++) {
            finalBadgeIds[i] = badgeIds[i];
        }
        
        emit BatchRewardsClaimed(msg.sender, totalXP, finalBadgeIds);
    }
    
    /**
     * @notice Check available rewards for a user
     * @param user The user address
     * @param streakType The streak type
     * @return availableThresholds Array of claimable thresholds
     */
    function getAvailableRewards(address user, uint8 streakType) 
        external 
        view 
        returns (uint32[] memory availableThresholds) 
    {
        if (streakType > 4) {
            return new uint32[](0);
        }
        
        uint32 currentStreak = streakCore.getCurrentStreak(user, streakType);
        uint32[] memory thresholds = rewardThresholds[streakType];
        
        // Count available rewards
        uint256 count = 0;
        for (uint256 i = 0; i < thresholds.length; i++) {
            uint32 threshold = thresholds[i];
            if (currentStreak >= threshold && 
                !claimedRewards[user][streakType][threshold] &&
                streakRewards[streakType][threshold].isActive) {
                count++;
            }
        }
        
        // Build result array
        availableThresholds = new uint32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < thresholds.length; i++) {
            uint32 threshold = thresholds[i];
            if (currentStreak >= threshold && 
                !claimedRewards[user][streakType][threshold] &&
                streakRewards[streakType][threshold].isActive) {
                availableThresholds[index] = threshold;
                index++;
            }
        }
    }
    
    /**
     * @notice Configure reward for a streak threshold (admin only)
     * @param streakType The streak type
     * @param threshold The streak threshold
     * @param xpReward XP reward amount
     * @param multiplier XP multiplier (100 = 1x)
     * @param badgeURI Badge URI (empty for no badge)
     */
    function configureReward(
        uint8 streakType,
        uint32 threshold,
        uint32 xpReward,
        uint32 multiplier,
        string calldata badgeURI
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (streakType > 4) revert InvalidStreakType();
        if (threshold == 0) revert InvalidThreshold();
        
        PackedReward storage reward = streakRewards[streakType][threshold];
        
        // If this is a new threshold, add to array
        if (reward.threshold == 0) {
            _insertThreshold(streakType, threshold);
        }
        
        reward.threshold = threshold;
        reward.xpReward = xpReward;
        reward.multiplier = multiplier;
        reward.isActive = true;
        
        if (bytes(badgeURI).length > 0) {
            rewardBadgeURIs[streakType][threshold] = badgeURI;
        }
        
        emit RewardConfigured(streakType, threshold, xpReward, multiplier);
    }
    
    /**
     * @notice Apply bonus XP with multiplier
     * @param user The user address
     * @param streakType The streak type
     * @param baseXP Base XP amount
     */
    function applyBonusXP(address user, uint8 streakType, uint32 baseXP) 
        external 
        onlyRole(REWARD_MANAGER_ROLE) 
        whenNotPaused 
    {
        uint32 multiplier = activeMultipliers[user][streakType];
        if (multiplier > 100) {
            uint32 bonusXP = (baseXP * (multiplier - 100)) / 100;
            xpEngine.awardXP(user, bonusXP);
            emit MultiplierApplied(user, streakType, multiplier, bonusXP);
        }
    }
    
    /**
     * @notice Internal function to claim a single reward
     */
    function _claimSingleReward(address user, uint8 streakType, uint32 threshold) internal {
        if (streakType > 4) revert InvalidStreakType();
        if (claimedRewards[user][streakType][threshold]) revert AlreadyClaimed();
        
        PackedReward memory reward = streakRewards[streakType][threshold];
        if (!reward.isActive) revert RewardNotActive();
        
        uint32 currentStreak = streakCore.getCurrentStreak(user, streakType);
        if (currentStreak < threshold) revert InsufficientStreak();
        
        claimedRewards[user][streakType][threshold] = true;
        
        uint256 badgeId = 0;
        
        // Award XP
        if (reward.xpReward > 0) {
            xpEngine.awardXP(user, reward.xpReward);
        }
        
        // Mint badge if URI exists
        string memory badgeURI = rewardBadgeURIs[streakType][threshold];
        if (bytes(badgeURI).length > 0) {
            badgeId = badgeMinter.mintBadge(user, badgeURI);
        }
        
        // Apply multiplier
        if (reward.multiplier > 100) {
            activeMultipliers[user][streakType] = reward.multiplier;
        }
        
        emit RewardClaimed(user, streakType, threshold, reward.xpReward, badgeId);
    }
    
    /**
     * @notice Insert threshold into sorted array
     */
    function _insertThreshold(uint8 streakType, uint32 threshold) internal {
        uint32[] storage thresholds = rewardThresholds[streakType];
        
        // Find insertion point
        uint256 insertIndex = thresholds.length;
        for (uint256 i = 0; i < thresholds.length; i++) {
            if (thresholds[i] > threshold) {
                insertIndex = i;
                break;
            }
        }
        
        // Insert at position
        thresholds.push(0);
        for (uint256 i = thresholds.length - 1; i > insertIndex; i--) {
            thresholds[i] = thresholds[i - 1];
        }
        thresholds[insertIndex] = threshold;
    }
    
    /**
     * @notice Initialize default reward configurations
     */
    function _initializeDefaultRewards() internal {
        // Daily Login rewards
        _setDefaultReward(0, 3, 100, 110, "Daily Login 3 Day Badge");
        _setDefaultReward(0, 7, 300, 120, "Daily Login Week Badge");
        _setDefaultReward(0, 30, 1000, 150, "Daily Login Month Badge");
        
        // Quest Completion rewards
        _setDefaultReward(1, 5, 200, 110, "Quest Completion 5 Day Badge");
        _setDefaultReward(1, 10, 500, 125, "Quest Completion 10 Day Badge");
        _setDefaultReward(1, 25, 1500, 160, "Quest Completion 25 Day Badge");
        
        // Trading rewards
        _setDefaultReward(2, 7, 400, 115, "Trading Week Badge");
        _setDefaultReward(2, 21, 1200, 140, "Trading 3 Week Badge");
        
        // Governance rewards
        _setDefaultReward(3, 5, 300, 120, "Governance 5 Day Badge");
        _setDefaultReward(3, 15, 800, 135, "Governance 15 Day Badge");
        
        // Social rewards
        _setDefaultReward(4, 10, 250, 110, "Social 10 Day Badge");
        _setDefaultReward(4, 20, 600, 130, "Social 20 Day Badge");
    }
    
    /**
     * @notice Helper function to set default rewards
     */
    function _setDefaultReward(
        uint8 streakType,
        uint32 threshold,
        uint32 xpReward,
        uint32 multiplier,
        string memory badgeURI
    ) internal {
        PackedReward storage reward = streakRewards[streakType][threshold];
        reward.threshold = threshold;
        reward.xpReward = xpReward;
        reward.multiplier = multiplier;
        reward.isActive = true;
        
        rewardBadgeURIs[streakType][threshold] = badgeURI;
        rewardThresholds[streakType].push(threshold);
    }
    
    /**
     * @notice Get reward thresholds for a streak type
     */
    function getRewardThresholds(uint8 streakType) external view returns (uint32[] memory) {
        return rewardThresholds[streakType];
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

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}