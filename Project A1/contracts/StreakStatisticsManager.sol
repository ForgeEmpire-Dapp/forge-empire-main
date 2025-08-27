// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title StreakStatisticsManager
 * @dev Manages global statistics and leaderboards for streak systems
 * @notice This contract handles global streak tracking and leaderboard functionality
 * @author Avax Forge Empire Team
 */
contract StreakStatisticsManager is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant STREAK_MANAGER_ROLE = keccak256("STREAK_MANAGER_ROLE");
    
    enum StreakType {
        DAILY_LOGIN,
        QUEST_COMPLETION,
        TRADING,
        GOVERNANCE,
        SOCIAL_INTERACTION
    }
    
    // Global statistics
    uint256 public totalActiveStreakers;
    uint256 public longestGlobalStreak;
    address public streakLeader;
    mapping(StreakType => uint256) public globalStreakCounts;
    
    // User statistics tracking
    mapping(address => bool) public isActiveStreaker;
    mapping(address => uint256) public userTotalStreakDays;
    mapping(address => uint256) public userLongestStreak;
    
    // Leaderboard tracking (top 10)
    address[10] public topStreakers;
    uint256[10] public topStreakValues;
    
    // Events
    event NewStreakLeader(address indexed user, uint256 totalStreakDays);
    event ActiveStreakersUpdated(uint256 newCount);
    event GlobalStatsUpdated(StreakType streakType, uint256 newCount);
    event LeaderboardUpdated(address indexed user, uint256 position, uint256 streakValue);
    
    /**
     * @notice Initializes the StreakStatisticsManager contract
     */
    function initialize() public initializer {
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(STREAK_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @notice Updates global statistics when a user's streak changes
     * @dev Called by the main StreakEngine contract
     * @param user Address of the user
     * @param streakType Type of streak
     * @param newStreakLength New streak length
     * @param totalUserStreakDays User's total streak days across all types
     */
    function updateGlobalStats(
        address user, 
        StreakType streakType, 
        uint256 newStreakLength,
        uint256 totalUserStreakDays
    ) external onlyRole(STREAK_MANAGER_ROLE) whenNotPaused {
        
        // Update streak type counter
        if (newStreakLength > 0) {
            globalStreakCounts[streakType]++;
        }
        
        // Track if user becomes or stops being an active streaker
        bool wasActive = isActiveStreaker[user];
        bool isNowActive = totalUserStreakDays > 0;
        
        if (!wasActive && isNowActive) {
            totalActiveStreakers++;
            isActiveStreaker[user] = true;
            emit ActiveStreakersUpdated(totalActiveStreakers);
        } else if (wasActive && !isNowActive) {
            totalActiveStreakers = totalActiveStreakers > 0 ? totalActiveStreakers - 1 : 0;
            isActiveStreaker[user] = false;
            emit ActiveStreakersUpdated(totalActiveStreakers);
        }
        
        // Update user's total streak days
        userTotalStreakDays[user] = totalUserStreakDays;
        
        // Update user's longest streak if this is longer
        if (newStreakLength > userLongestStreak[user]) {
            userLongestStreak[user] = newStreakLength;
        }
        
        // Check for new global streak leader
        if (totalUserStreakDays > longestGlobalStreak) {
            longestGlobalStreak = totalUserStreakDays;
            streakLeader = user;
            emit NewStreakLeader(user, totalUserStreakDays);
        }
        
        // Update leaderboard
        _updateLeaderboard(user, totalUserStreakDays);
        
        emit GlobalStatsUpdated(streakType, globalStreakCounts[streakType]);
    }
    
    /**
     * @notice Updates the leaderboard with a user's new streak value
     * @param user Address of the user
     * @param streakValue User's total streak days
     */
    function _updateLeaderboard(address user, uint256 streakValue) internal {
        // Find if user is already in leaderboard
        int256 currentPosition = -1;
        for (uint256 i = 0; i < 10; i++) {
            if (topStreakers[i] == user) {
                currentPosition = int256(i);
                break;
            }
        }
        
        // Find the position where this streak value should be inserted
        uint256 insertPosition = 10; // Default to not in top 10
        for (uint256 i = 0; i < 10; i++) {
            if (streakValue > topStreakValues[i]) {
                insertPosition = i;
                break;
            }
        }
        
        // If user should be in top 10
        if (insertPosition < 10) {
            // If user was already in leaderboard
            if (currentPosition >= 0) {
                // Remove from current position first
                for (uint256 i = uint256(currentPosition); i < 9; i++) {
                    topStreakers[i] = topStreakers[i + 1];
                    topStreakValues[i] = topStreakValues[i + 1];
                }
                topStreakers[9] = address(0);
                topStreakValues[9] = 0;
                
                // Adjust insert position if it was after the removed position
                if (insertPosition > uint256(currentPosition)) {
                    insertPosition--;
                }
            }
            
            // Shift existing entries down
            for (uint256 i = 9; i > insertPosition; i--) {
                if (topStreakers[i - 1] != address(0)) {
                    topStreakers[i] = topStreakers[i - 1];
                    topStreakValues[i] = topStreakValues[i - 1];
                }
            }
            
            // Insert new entry
            topStreakers[insertPosition] = user;
            topStreakValues[insertPosition] = streakValue;
            
            emit LeaderboardUpdated(user, insertPosition, streakValue);
        }
        // If user was in leaderboard but no longer qualifies
        else if (currentPosition >= 0) {
            // Remove from leaderboard
            for (uint256 i = uint256(currentPosition); i < 9; i++) {
                topStreakers[i] = topStreakers[i + 1];
                topStreakValues[i] = topStreakValues[i + 1];
            }
            topStreakers[9] = address(0);
            topStreakValues[9] = 0;
        }
    }
    
    /**
     * @notice Gets global statistics
     * @return _totalActiveStreakers Total number of active streakers
     * @return _longestGlobalStreak Longest global streak
     * @return _streakLeader Address of the streak leader
     * @return _dailyLoginCount Total daily login streaks
     * @return _questCompletionCount Total quest completion streaks
     * @return _tradingCount Total trading streaks
     * @return _governanceCount Total governance streaks
     * @return _socialCount Total social interaction streaks
     */
    function getGlobalStats() external view returns (
        uint256 _totalActiveStreakers,
        uint256 _longestGlobalStreak,
        address _streakLeader,
        uint256 _dailyLoginCount,
        uint256 _questCompletionCount,
        uint256 _tradingCount,
        uint256 _governanceCount,
        uint256 _socialCount
    ) {
        return (
            totalActiveStreakers,
            longestGlobalStreak,
            streakLeader,
            globalStreakCounts[StreakType.DAILY_LOGIN],
            globalStreakCounts[StreakType.QUEST_COMPLETION],
            globalStreakCounts[StreakType.TRADING],
            globalStreakCounts[StreakType.GOVERNANCE],
            globalStreakCounts[StreakType.SOCIAL_INTERACTION]
        );
    }
    
    /**
     * @notice Gets the current leaderboard
     * @return streakers Array of top streaker addresses
     * @return streakValues Array of corresponding streak values
     */
    function getLeaderboard() external view returns (
        address[10] memory streakers,
        uint256[10] memory streakValues
    ) {
        return (topStreakers, topStreakValues);
    }
    
    /**
     * @notice Gets a user's rank on the leaderboard
     * @param user Address of the user
     * @return rank User's rank (0-9 if in top 10, type(uint256).max if not)
     */
    function getUserRank(address user) external view returns (uint256 rank) {
        for (uint256 i = 0; i < 10; i++) {
            if (topStreakers[i] == user) {
                return i;
            }
        }
        return type(uint256).max; // Not in top 10
    }
    
    /**
     * @notice Gets user statistics
     * @param user Address of the user
     * @return totalStreakDays User's total streak days
     * @return longestStreak User's longest individual streak
     * @return isActive Whether user is currently an active streaker
     */
    function getUserStats(address user) external view returns (
        uint256 totalStreakDays,
        uint256 longestStreak,
        bool isActive
    ) {
        return (
            userTotalStreakDays[user],
            userLongestStreak[user],
            isActiveStreaker[user]
        );
    }
    
    /**
     * @notice Gets streak count for a specific type
     * @param streakType Type of streak
     * @return count Number of streaks of this type
     */
    function getStreakTypeCount(StreakType streakType) external view returns (uint256 count) {
        return globalStreakCounts[streakType];
    }
    
    /**
     * @notice Admin function to reset global statistics
     * @dev Emergency function for maintenance
     */
    function resetGlobalStats() external onlyRole(ADMIN_ROLE) {
        totalActiveStreakers = 0;
        longestGlobalStreak = 0;
        streakLeader = address(0);
        
        // Reset streak type counters
        for (uint256 i = 0; i < 5; i++) {
            globalStreakCounts[StreakType(i)] = 0;
        }
        
        // Clear leaderboard
        for (uint256 i = 0; i < 10; i++) {
            topStreakers[i] = address(0);
            topStreakValues[i] = 0;
        }
    }
    
    /**
     * @notice Pause the contract
     * @dev Only admin can call this function
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     * @dev Only admin can call this function
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}