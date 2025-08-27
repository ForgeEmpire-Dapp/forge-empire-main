// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title StreakCore
 * @dev Core streak tracking functionality - optimized for size and gas efficiency
 * @notice This contract handles basic streak tracking without rewards or statistics
 * @author Avax Forge Empire Team
 */
contract StreakCore is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    
    bytes32 public constant STREAK_MANAGER_ROLE = keccak256("STREAK_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    enum StreakType {
        DAILY_LOGIN,
        QUEST_COMPLETION,
        TRADING,
        GOVERNANCE,
        SOCIAL_INTERACTION
    }
    
    // Packed struct for gas efficiency
    struct UserStreak {
        uint32 currentStreak;
        uint32 longestStreak;
        uint32 lastActivityDay;
        uint32 freezesUsed;
    }
    
    // User streaks: user => streakType => UserStreak
    mapping(address => mapping(uint8 => UserStreak)) public userStreaks;
    
    // Streak freezes available: user => streakType => freezes
    mapping(address => mapping(uint8 => uint32)) public streakFreezes;
    
    // Events
    event StreakIncreased(address indexed user, uint8 indexed streakType, uint32 newStreak);
    event StreakBroken(address indexed user, uint8 indexed streakType, uint32 finalStreak);
    event StreakFrozen(address indexed user, uint8 indexed streakType, uint32 frozenStreak);
    event ActivityRecorded(address indexed user, uint8 indexed streakType, bool streakContinued);
    
    // Custom Errors
    error AlreadyRecordedToday();
    error InvalidStreakType();
    error NoFreezesAvailable();
    error StreakNotActive();
    
    // Constants
    uint256 private constant DAY_IN_SECONDS = 86400;
    uint256 private constant GRACE_PERIOD = 3600; // 1 hour grace period
    
    /**
     * @notice Initializes the StreakCore contract
     */
    function initialize() public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(STREAK_MANAGER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    /**
     * @notice Authorizes an upgrade to a new implementation
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
    
    /**
     * @notice Record activity for a specific streak type
     * @param user The user address
     * @param streakType The type of streak to update (0-4)
     */
    function recordActivity(address user, uint8 streakType) 
        external 
        onlyRole(STREAK_MANAGER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        if (streakType > 4) revert InvalidStreakType();
        _updateStreak(user, streakType);
    }
    
    /**
     * @notice Record daily login for streak tracking
     */
    function recordDailyLogin() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, uint8(StreakType.DAILY_LOGIN));
    }
    
    /**
     * @notice Record quest completion for streak tracking
     */
    function recordQuestCompletion() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, uint8(StreakType.QUEST_COMPLETION));
    }
    
    /**
     * @notice Record trading activity for streak tracking
     */
    function recordTradingActivity() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, uint8(StreakType.TRADING));
    }
    
    /**
     * @notice Record governance participation for streak tracking
     */
    function recordGovernanceParticipation() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, uint8(StreakType.GOVERNANCE));
    }
    
    /**
     * @notice Record social interaction for streak tracking
     */
    function recordSocialInteraction() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, uint8(StreakType.SOCIAL_INTERACTION));
    }
    
    /**
     * @notice Use a streak freeze to protect a streak
     * @param streakType The type of streak to freeze
     */
    function useStreakFreeze(uint8 streakType) external whenNotPaused {
        if (streakType > 4) revert InvalidStreakType();
        if (streakFreezes[msg.sender][streakType] == 0) revert NoFreezesAvailable();
        
        UserStreak storage streak = userStreaks[msg.sender][streakType];
        if (streak.currentStreak == 0) revert StreakNotActive();
        
        // Use freeze and extend grace period
        streakFreezes[msg.sender][streakType]--;
        streak.freezesUsed++;
        
        // Extend the last activity day by 2 days
        streak.lastActivityDay = uint32(_getCurrentDay() + 2);
        
        emit StreakFrozen(msg.sender, streakType, streak.currentStreak);
    }
    
    /**
     * @notice Add streak freezes to a user (admin only)
     * @param user The user address
     * @param streakType The streak type
     * @param amount Number of freezes to add
     */
    function addStreakFreezes(address user, uint8 streakType, uint32 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (streakType > 4) revert InvalidStreakType();
        streakFreezes[user][streakType] += amount;
    }
    
    /**
     * @notice Get current streak for a user and type
     * @param user The user address
     * @param streakType The streak type
     * @return current streak count
     */
    function getCurrentStreak(address user, uint8 streakType) external view returns (uint32) {
        if (streakType > 4) return 0;
        return userStreaks[user][streakType].currentStreak;
    }
    
    /**
     * @notice Get longest streak for a user and type
     * @param user The user address
     * @param streakType The streak type
     * @return longest streak count
     */
    function getLongestStreak(address user, uint8 streakType) external view returns (uint32) {
        if (streakType > 4) return 0;
        return userStreaks[user][streakType].longestStreak;
    }
    
    /**
     * @notice Check if user has recorded activity today
     * @param user The user address
     * @param streakType The streak type
     * @return true if activity recorded today
     */
    function hasRecordedToday(address user, uint8 streakType) external view returns (bool) {
        if (streakType > 4) return false;
        return userStreaks[user][streakType].lastActivityDay == _getCurrentDay();
    }
    
    /**
     * @notice Internal function to update streak
     * @param user The user address
     * @param streakType The streak type
     */
    function _updateStreak(address user, uint8 streakType) internal {
        UserStreak storage streak = userStreaks[user][streakType];
        uint32 currentDay = _getCurrentDay();
        
        // Check if already recorded today
        if (streak.lastActivityDay == currentDay) revert AlreadyRecordedToday();
        
        bool streakContinued = false;
        
        if (streak.lastActivityDay == 0) {
            // First time recording this streak type
            streak.currentStreak = 1;
            streak.longestStreak = 1;
            streakContinued = true;
        } else if (streak.lastActivityDay == currentDay - 1) {
            // Consecutive day - increase streak
            streak.currentStreak++;
            if (streak.currentStreak > streak.longestStreak) {
                streak.longestStreak = streak.currentStreak;
            }
            streakContinued = true;
        } else if (streak.lastActivityDay < currentDay - 1) {
            // Streak broken - check if within grace period or frozen
            uint32 daysSinceActivity = currentDay - streak.lastActivityDay;
            
            if (daysSinceActivity <= 2 && streak.freezesUsed > 0) {
                // Within frozen grace period - continue streak
                streak.currentStreak++;
                if (streak.currentStreak > streak.longestStreak) {
                    streak.longestStreak = streak.currentStreak;
                }
                streakContinued = true;
            } else {
                // Streak broken - reset
                emit StreakBroken(user, streakType, streak.currentStreak);
                streak.currentStreak = 1;
                streakContinued = false;
            }
        }
        
        streak.lastActivityDay = currentDay;
        
        if (streakContinued) {
            emit StreakIncreased(user, streakType, streak.currentStreak);
        }
        
        emit ActivityRecorded(user, streakType, streakContinued);
    }
    
    /**
     * @notice Get current day number (days since epoch)
     * @return current day number
     */
    function _getCurrentDay() internal view returns (uint32) {
        return uint32(block.timestamp / DAY_IN_SECONDS);
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