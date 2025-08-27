// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IStreakSystem.sol";
import "hardhat/console.sol";
import "hardhat/console.sol";

interface IStreakCore {
    function recordActivity(address user, uint8 streakType) external;
    function recordDailyLogin() external;
    function recordQuestCompletion() external;
    function recordTradingActivity() external;
    function recordGovernanceParticipation() external;
    function recordSocialInteraction() external;
    function getCurrentStreak(address user, uint8 streakType) external view returns (uint32);
    function getLongestStreak(address user, uint8 streakType) external view returns (uint32);
    function hasRecordedToday(address user, uint8 streakType) external view returns (bool);
}

interface IStreakRewards {
    function claimReward(uint8 streakType, uint32 threshold) external;
    function claimAllRewards(uint8 streakType) external;
    function getAvailableRewards(address user, uint8 streakType) external view returns (uint32[] memory);
    function applyBonusXP(address user, uint8 streakType, uint32 baseXP) external;
}

interface IStreakMilestones {
    function updateTotalStreakDays(address user) external;
    function claimMilestone(uint32 milestoneId) external;
    function claimAllMilestones() external;
    function getAvailableMilestones(address user) external view returns (uint32[] memory);
}

interface IStreakStats {
    function updateUserActivity(address user, uint8 streakType, uint32 newStreak) external;
    function getLeaderboard(uint8 streakType, uint32 limit) external view returns (address[] memory, uint32[] memory);
    function getUserLeaderboardPosition(address user, uint8 streakType) external view returns (uint32);
    function getGlobalStats() external view returns (uint32, uint32, address, uint32);
    function recordAchievement(address user, uint32 xpEarned, uint32 badgesEarned) external;
}

/**
 * @title StreakSystemManager
 * @dev Main coordinator for the modular streak system
 * @notice This contract manages interactions between all streak system modules
 * @author Avax Forge Empire Team
 */
contract StreakSystemManager is 
    Initializable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable,
    IStreakSystem 
{
    
    bytes32 public constant SYSTEM_MANAGER_ROLE = keccak256("SYSTEM_MANAGER_ROLE");
    
    IStreakCore public streakCore;
    IStreakRewards public streakRewards;
    IStreakMilestones public streakMilestones;
    IStreakStats public streakStats;
    
    // Events are inherited from IStreakSystem interface
    
    // Additional events
    event ModuleUpdated(string indexed moduleName, address indexed oldAddress, address indexed newAddress);
    event SystemActivityRecorded(address indexed user, uint8 indexed streakType, uint32 newStreak);
    
    // Custom Errors
    error ModuleNotSet();
    error InvalidModule();
    error CallFailed();
    
    /**
     * @notice Initializes the StreakSystemManager
     * @param _streakCoreAddress Address of StreakCore contract
     * @param _streakRewardsAddress Address of StreakRewards contract
     * @param _streakMilestonesAddress Address of StreakMilestones contract
     * @param _streakStatsAddress Address of StreakStats contract
     */
    function initialize(
        address _streakCoreAddress,
        address _streakRewardsAddress,
        address _streakMilestonesAddress,
        address _streakStatsAddress
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SYSTEM_MANAGER_ROLE, msg.sender);
        
        streakCore = IStreakCore(_streakCoreAddress);
        streakRewards = IStreakRewards(_streakRewardsAddress);
        streakMilestones = IStreakMilestones(_streakMilestonesAddress);
        streakStats = IStreakStats(_streakStatsAddress);
    }
    
    // ============ Core Streak Tracking Functions ============
    
    /**
     * @notice Record daily login for streak tracking
     */
    function recordDailyLogin() external override whenNotPaused nonReentrant {
        if (address(streakCore) == address(0)) revert ModuleNotSet();
        
        uint32 oldStreak = streakCore.getCurrentStreak(msg.sender, 0);
        
        streakCore.recordActivity(msg.sender, 0);
        
        uint32 newStreak = streakCore.getCurrentStreak(msg.sender, 0);
        
        _postActivityUpdate(msg.sender, 0, oldStreak, newStreak);
    }
    
    /**
     * @notice Record quest completion for streak tracking
     */
    function recordQuestCompletion() external override whenNotPaused nonReentrant {
        if (address(streakCore) == address(0)) revert ModuleNotSet();
        
        uint32 oldStreak = streakCore.getCurrentStreak(msg.sender, 1);
        
        streakCore.recordActivity(msg.sender, 1);
        
        uint32 newStreak = streakCore.getCurrentStreak(msg.sender, 1);
        
        _postActivityUpdate(msg.sender, 1, oldStreak, newStreak);
    }
    
    /**
     * @notice Record trading activity for streak tracking
     */
    function recordTradingActivity() external override whenNotPaused nonReentrant {
        if (address(streakCore) == address(0)) revert ModuleNotSet();
        
        uint32 oldStreak = streakCore.getCurrentStreak(msg.sender, 2);
        
        streakCore.recordActivity(msg.sender, 2);
        
        uint32 newStreak = streakCore.getCurrentStreak(msg.sender, 2);
        
        _postActivityUpdate(msg.sender, 2, oldStreak, newStreak);
    }
    
    /**
     * @notice Record governance participation for streak tracking
     */
    function recordGovernanceParticipation() external override whenNotPaused nonReentrant {
        if (address(streakCore) == address(0)) revert ModuleNotSet();
        
        uint32 oldStreak = streakCore.getCurrentStreak(msg.sender, 3);
        
        streakCore.recordActivity(msg.sender, 3);
        
        uint32 newStreak = streakCore.getCurrentStreak(msg.sender, 3);
        
        _postActivityUpdate(msg.sender, 3, oldStreak, newStreak);
    }
    
    /**
     * @notice Record social interaction for streak tracking
     */
    function recordSocialInteraction() external override whenNotPaused nonReentrant {
        if (address(streakCore) == address(0)) revert ModuleNotSet();
        
        uint32 oldStreak = streakCore.getCurrentStreak(msg.sender, 4);
        
        streakCore.recordActivity(msg.sender, 4);
        
        uint32 newStreak = streakCore.getCurrentStreak(msg.sender, 4);
        
        _postActivityUpdate(msg.sender, 4, oldStreak, newStreak);
    }
    
    /**
     * @notice Record activity for a specific streak type (manager only)
     * @param user The user address
     * @param streakType The type of streak to update
     */
    function recordActivity(address user, uint8 streakType) 
        external 
        override 
        onlyRole(SYSTEM_MANAGER_ROLE) 
        whenNotPaused 
    {
        if (address(streakCore) == address(0)) revert ModuleNotSet();
        if (streakType > 4) revert InvalidModule();
        
        uint32 oldStreak = streakCore.getCurrentStreak(user, streakType);
        
        streakCore.recordActivity(user, streakType);
        
        uint32 newStreak = streakCore.getCurrentStreak(user, streakType);
        
        _postActivityUpdate(user, streakType, oldStreak, newStreak);
    }
    
    // ============ Streak Query Functions ============
    
    /**
     * @notice Get current streak for a user and type
     */
    function getCurrentStreak(address user, uint8 streakType) 
        external 
        override 
        view 
        returns (uint32) 
    {
        if (address(streakCore) == address(0)) return 0;
        return streakCore.getCurrentStreak(user, streakType);
    }
    
    /**
     * @notice Get longest streak for a user and type
     */
    function getLongestStreak(address user, uint8 streakType) 
        external 
        override 
        view 
        returns (uint32) 
    {
        if (address(streakCore) == address(0)) return 0;
        return streakCore.getLongestStreak(user, streakType);
    }
    
    /**
     * @notice Check if user has recorded activity today
     */
    function hasRecordedToday(address user, uint8 streakType) 
        external 
        override 
        view 
        returns (bool) 
    {
        if (address(streakCore) == address(0)) return false;
        return streakCore.hasRecordedToday(user, streakType);
    }
    
    // ============ Reward Management Functions ============
    
    /**
     * @notice Claim reward for a specific streak threshold
     */
    function claimReward(uint8 streakType, uint32 threshold) 
        external 
        override 
        whenNotPaused 
        nonReentrant 
    {
        if (address(streakRewards) == address(0)) revert ModuleNotSet();
        streakRewards.claimReward(streakType, threshold);
    }
    
    /**
     * @notice Claim all available rewards for a streak type
     */
    function claimAllRewards(uint8 streakType) 
        external 
        override 
        whenNotPaused 
        nonReentrant 
    {
        if (address(streakRewards) == address(0)) revert ModuleNotSet();
        streakRewards.claimAllRewards(streakType);
    }
    
    /**
     * @notice Get available rewards for a user
     */
    function getAvailableRewards(address user, uint8 streakType) 
        external 
        override 
        view 
        returns (uint32[] memory) 
    {
        if (address(streakRewards) == address(0)) return new uint32[](0);
        return streakRewards.getAvailableRewards(user, streakType);
    }
    
    // ============ Milestone Management Functions ============
    
    /**
     * @notice Claim a specific milestone
     */
    function claimMilestone(uint32 milestoneId) 
        external 
        override 
        whenNotPaused 
        nonReentrant 
    {
        if (address(streakMilestones) == address(0)) revert ModuleNotSet();
        streakMilestones.claimMilestone(milestoneId);
    }
    
    /**
     * @notice Claim all available milestones
     */
    function claimAllMilestones() 
        external 
        override 
        whenNotPaused 
        nonReentrant 
    {
        if (address(streakMilestones) == address(0)) revert ModuleNotSet();
        streakMilestones.claimAllMilestones();
    }
    
    /**
     * @notice Get available milestones for a user
     */
    function getAvailableMilestones(address user) 
        external 
        override 
        view 
        returns (uint32[] memory) 
    {
        if (address(streakMilestones) == address(0)) return new uint32[](0);
        return streakMilestones.getAvailableMilestones(user);
    }
    
    // ============ Statistics and Leaderboard Functions ============
    
    /**
     * @notice Get leaderboard for a specific streak type
     */
    function getLeaderboard(uint8 streakType, uint32 limit) 
        external 
        override 
        view 
        returns (address[] memory, uint32[] memory) 
    {
        if (address(streakStats) == address(0)) {
            return (new address[](0), new uint32[](0));
        }
        return streakStats.getLeaderboard(streakType, limit);
    }
    
    /**
     * @notice Get user's position in leaderboard
     */
    function getUserLeaderboardPosition(address user, uint8 streakType) 
        external 
        override 
        view 
        returns (uint32) 
    {
        if (address(streakStats) == address(0)) return 0;
        return streakStats.getUserLeaderboardPosition(user, streakType);
    }
    
    /**
     * @notice Get global statistics
     */
    function getGlobalStats() 
        external 
        override 
        view 
        returns (uint32, uint32, address, uint32) 
    {
        if (address(streakStats) == address(0)) {
            return (0, 0, address(0), 0);
        }
        return streakStats.getGlobalStats();
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update a module address (admin only)
     * @param moduleName Name of the module
     * @param newAddress New module address
     */
    function updateModule(string calldata moduleName, address newAddress) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        bytes32 moduleHash = keccak256(bytes(moduleName));
        address oldAddress;
        
        if (moduleHash == keccak256("StreakCore")) {
            oldAddress = address(streakCore);
            streakCore = IStreakCore(newAddress);
        } else if (moduleHash == keccak256("StreakRewards")) {
            oldAddress = address(streakRewards);
            streakRewards = IStreakRewards(newAddress);
        } else if (moduleHash == keccak256("StreakMilestones")) {
            oldAddress = address(streakMilestones);
            streakMilestones = IStreakMilestones(newAddress);
        } else if (moduleHash == keccak256("StreakStats")) {
            oldAddress = address(streakStats);
            streakStats = IStreakStats(newAddress);
        } else {
            revert InvalidModule();
        }
        
        emit ModuleUpdated(moduleName, oldAddress, newAddress);
    }
    
    /**
     * @notice Internal function to handle post-activity updates
     */
    function _postActivityUpdate(address user, uint8 streakType, uint32 oldStreak, uint32 newStreak) internal {
        // Update statistics
        if (address(streakStats) != address(0)) {
            streakStats.updateUserActivity(user, streakType, newStreak);
        }
        
        // Update milestones
        if (address(streakMilestones) != address(0)) {
            streakMilestones.updateTotalStreakDays(user);
        }
        
        // Emit appropriate events
        if (newStreak > oldStreak) {
            emit StreakIncreased(user, streakType, newStreak);
        } else if (newStreak < oldStreak) {
            emit StreakBroken(user, streakType, oldStreak);
        }
        
        emit SystemActivityRecorded(user, streakType, newStreak);
    }
    
    /**
     * @notice Get all module addresses
     * @return core Address of StreakCore
     * @return rewards Address of StreakRewards
     * @return milestones Address of StreakMilestones
     * @return stats Address of StreakStats
     */
    function getModuleAddresses() 
        external 
        view 
        returns (address core, address rewards, address milestones, address stats) 
    {
        return (
            address(streakCore),
            address(streakRewards),
            address(streakMilestones),
            address(streakStats)
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