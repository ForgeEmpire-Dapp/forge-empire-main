// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

interface IStreakCore {
    function getCurrentStreak(address user, uint8 streakType) external view returns (uint32);
    function getLongestStreak(address user, uint8 streakType) external view returns (uint32);
}

/**
 * @title StreakStats
 * @dev Handles global statistics and leaderboards for streak tracking
 * @notice This contract manages global stats, leaderboards, and analytics
 * @author Avax Forge Empire Team
 */
contract StreakStats is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    
    bytes32 public constant STATS_MANAGER_ROLE = keccak256("STATS_MANAGER_ROLE");
    
    IStreakCore public streakCore;
    
    // Global statistics
    struct GlobalStats {
        uint32 totalActiveStreakers;
        uint32 longestGlobalStreak;
        address streakLeader;
        uint32 totalStreakDays;
    }
    
    GlobalStats public globalStats;
    
    // Streak type specific global counts
    mapping(uint8 => uint32) public globalStreakCounts;
    mapping(uint8 => address) public streakTypeLeaders;
    mapping(uint8 => uint32) public longestStreaksByType;
    
    // Leaderboard data (top 100 users per streak type)
    mapping(uint8 => address[]) public leaderboards;
    mapping(uint8 => mapping(address => uint32)) public leaderboardPositions;
    
    // User activity tracking
    mapping(address => uint32) private userLastActiveDay;
    mapping(address => bool) public isActiveStreaker;
    mapping(address => uint32) public lastActivityTimestamp;
    mapping(address => uint8) public activeStreakTypes; // Bitmask of active streak types
    
    // Daily/Weekly/Monthly stats
    struct PeriodStats {
        uint32 day;
        uint32 activeUsers;
        uint32 totalActivities;
        uint32 newStreakers;
    }
    
    mapping(uint32 => PeriodStats) public dailyStats;
    mapping(uint32 => PeriodStats) public weeklyStats;
    mapping(uint32 => PeriodStats) public monthlyStats;
    
    // Achievement statistics
    mapping(address => uint32) public totalAchievements;
    mapping(address => uint32) public totalXPEarned;
    mapping(address => uint32) public totalBadgesEarned;
    
    // Events
    event GlobalStatsUpdated(uint32 totalActiveStreakers, uint32 longestGlobalStreak, address streakLeader);
    event NewStreakLeader(address indexed user, uint8 indexed streakType, uint32 streak);
    event LeaderboardUpdated(uint8 indexed streakType, address indexed user, uint32 position);
    event DailyStatsRecorded(uint32 day, uint32 activeUsers, uint32 totalActivities, uint32 newStreakers);
    event UserActivityUpdated(address indexed user, uint8 streakTypeMask, bool isActive);
    event ActiveStreakTypesChanged(address indexed user, uint8 oldMask, uint8 newMask);
    


    
    // Constants
    uint256 private constant DAY_IN_SECONDS = 86400;
    uint32 private constant LEADERBOARD_SIZE = 100;
    uint32 private constant INACTIVE_THRESHOLD = 7 days;
    
    /**
     * @notice Initializes the StreakStats contract
     * @param _streakCoreAddress Address of the StreakCore contract
     */
    function initialize(address _streakCoreAddress) public initializer {
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(STATS_MANAGER_ROLE, msg.sender);
        
        streakCore = IStreakCore(_streakCoreAddress);
    }
    
    /**
     * @notice Update user activity and global statistics
     * @param user The user address
     * @param streakType The streak type that was updated
     * @param newStreak The new streak value
     */
    function updateUserActivity(address user, uint8 streakType, uint32 newStreak) 
        external 
        onlyRole(STATS_MANAGER_ROLE) 
        whenNotPaused 
    {
        if (streakType > 4) return;
        
        // Update user activity tracking
        bool wasActive = isActiveStreaker[user];
        lastActivityTimestamp[user] = uint32(block.timestamp);
        
        // Store previous mask for comparison
uint8 oldMask = activeStreakTypes[user];

// Update bitmask based on streak status
if (newStreak > 0) {
    activeStreakTypes[user] |= uint8(1 << streakType);
} else {
    activeStreakTypes[user] &= ~uint8(1 << streakType);
}

uint8 newMask = activeStreakTypes[user];

// Calculate added and removed streak types
uint8 addedStreaks = ~oldMask & newMask;    // bits turned from 0 to 1
uint8 removedStreaks = oldMask & ~newMask;  // bits turned from 1 to 0

// Update global streak counts
for (uint8 i = 0; i < 8; i++) {
    uint8 mask = uint8(1 << i);

    if ((addedStreaks & mask) != 0) {
        // User gained streak type i
        globalStreakCounts[i] += 1;
        // Optionally: add user to leaderboard for streak type i
        // _addUserToLeaderboard(i, user);
    }

    if ((removedStreaks & mask) != 0) {
        // User lost streak type i
        if (globalStreakCounts[i] > 0) {
            globalStreakCounts[i] -= 1;
        }
        // Optionally: remove user from leaderboard for streak type i
        // _removeUserFromLeaderboard(i, user);
    }
}

// Update whether the user is considered active overall
bool isNowActive = newMask > 0;
isActiveStreaker[user] = isNowActive;

// Optional: emit event about changes
emit ActiveStreakTypesChanged(user, oldMask, newMask);

        
        // Update global active streaker count
        if (!wasActive && isNowActive) {
            globalStats.totalActiveStreakers++;
        } else if (wasActive && !isNowActive) {
            globalStats.totalActiveStreakers--;
        }
        
        // Update leaderboard
        _updateLeaderboard(user, streakType, newStreak);
        
        // Update global streak records
        _updateGlobalRecords(user, streakType, newStreak);
        
        // Update daily statistics
        _updateDailyStats(user, !wasActive && isNowActive);
        
        // Update total streak days
        globalStats.totalStreakDays += newStreak;
        
        emit UserActivityUpdated(user, activeStreakTypes[user], isNowActive);
    }
    
    /**
     * @notice Get leaderboard for a specific streak type
     * @param streakType The streak type (0-4)
     * @param limit Maximum number of entries to return
     * @return users Array of user addresses
     * @return streaks Array of corresponding streak values
     */
    function getLeaderboard(uint8 streakType, uint32 limit) 
        external 
        view 
        returns (address[] memory users, uint32[] memory streaks) 
    {
        if (streakType > 4) {
            return (new address[](0), new uint32[](0));
        }
        
        address[] memory leaderboard = leaderboards[streakType];
        uint32 actualLimit = limit > leaderboard.length ? uint32(leaderboard.length) : limit;
        
        users = new address[](actualLimit);
        streaks = new uint32[](actualLimit);
        
        for (uint32 i = 0; i < actualLimit; i++) {
            users[i] = leaderboard[i];
            streaks[i] = streakCore.getCurrentStreak(leaderboard[i], streakType);
        }
    }
    
    /**
     * @notice Get user's position in leaderboard
     * @param user The user address
     * @param streakType The streak type
     * @return position (0 if not in leaderboard)
     */
    function getUserLeaderboardPosition(address user, uint8 streakType) 
        external 
        view 
        returns (uint32 position) 
    {
        if (streakType > 4) return 0;
        return leaderboardPositions[streakType][user];
    }
    
    /**
     * @notice Get global statistics
     * @return totalActiveStreakers, longestGlobalStreak, streakLeader, totalStreakDays
     */
    function getGlobalStats() 
        external 
        view 
        returns (uint32, uint32, address, uint32) 
    {
        return (
            globalStats.totalActiveStreakers,
            globalStats.longestGlobalStreak,
            globalStats.streakLeader,
            globalStats.totalStreakDays
        );
    }
    
    /**
     * @notice Get daily statistics for a specific day
     * @param day The day (days since epoch)
     * @return activeUsers Number of active users
     * @return totalActivities Total activities recorded
     * @return newStreakers Number of new streakers
     */
    function getDailyStats(uint32 day) 
        external 
        view 
        returns (uint32 activeUsers, uint32 totalActivities, uint32 newStreakers) 
    {
        PeriodStats memory stats = dailyStats[day];
        return (stats.activeUsers, stats.totalActivities, stats.newStreakers);
    }
    
    /**
     * @notice Get user achievement statistics
     * @param user The user address
     * @return totalAchievements, totalXPEarned, totalBadgesEarned, activeStreakTypes
     */
    function getUserStats(address user) 
        external 
        view 
        returns (uint32, uint32, uint32, uint8) 
    {
        return (
            totalAchievements[user],
            totalXPEarned[user],
            totalBadgesEarned[user],
            activeStreakTypes[user]
        );
    }
    
    /**
     * @notice Record achievement for user statistics
     * @param user The user address
     * @param xpEarned XP amount earned
     * @param badgesEarned Number of badges earned
     */
    function recordAchievement(address user, uint32 xpEarned, uint32 badgesEarned) 
        external 
        onlyRole(STATS_MANAGER_ROLE) 
    {
        totalAchievements[user]++;
        totalXPEarned[user] += xpEarned;
        totalBadgesEarned[user] += badgesEarned;
    }
    
    /**
     * @notice Clean up inactive streakers (admin only)
     * @param users Array of user addresses to check
     */
    function cleanupInactiveStreakers(address[] calldata users) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        uint32 currentTime = uint32(block.timestamp);
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            
            if (isActiveStreaker[user] && 
                currentTime - lastActivityTimestamp[user] > INACTIVE_THRESHOLD) {
                
                isActiveStreaker[user] = false;
                activeStreakTypes[user] = 0;
                globalStats.totalActiveStreakers--;
                
                // Remove from leaderboards
                for (uint8 streakType = 0; streakType < 5; streakType++) {
                    _removeFromLeaderboard(user, streakType);
                }
                
                emit UserActivityUpdated(user, 0, false);
            }
        }
    }
    
    /**
     * @notice Internal function to update leaderboard
     */
    function _updateLeaderboard(address user, uint8 streakType, uint32 newStreak) internal {
        address[] storage leaderboard = leaderboards[streakType];
        uint32 currentPosition = leaderboardPositions[streakType][user];
        
        if (newStreak == 0) {
            // Remove user from leaderboard
            _removeFromLeaderboard(user, streakType);
            return;
        }
        
        if (currentPosition == 0) {
            // User not in leaderboard, try to add
            if (leaderboard.length < LEADERBOARD_SIZE) {
                // Add to end and bubble up
                leaderboard.push(user);
                currentPosition = uint32(leaderboard.length);
                leaderboardPositions[streakType][user] = currentPosition;
            } else {
                // Check if streak is better than last place
                address lastUser = leaderboard[LEADERBOARD_SIZE - 1];
                uint32 lastStreak = streakCore.getCurrentStreak(lastUser, streakType);
                
                if (newStreak > lastStreak) {
                    // Replace last place
                    leaderboardPositions[streakType][lastUser] = 0;
                    leaderboard[LEADERBOARD_SIZE - 1] = user;
                    currentPosition = LEADERBOARD_SIZE;
                    leaderboardPositions[streakType][user] = currentPosition;
                }
            }
        }
        
        // Bubble up user based on new streak
        _bubbleUpLeaderboard(user, streakType, currentPosition, newStreak);
    }
    
    /**
     * @notice Internal function to bubble up user in leaderboard
     */
    function _bubbleUpLeaderboard(address user, uint8 streakType, uint32 position, uint32 streak) internal {
        address[] storage leaderboard = leaderboards[streakType];
        
        while (position > 1) {
            address aboveUser = leaderboard[position - 2];
            uint32 aboveStreak = streakCore.getCurrentStreak(aboveUser, streakType);
            
            if (streak <= aboveStreak) break;
            
            // Swap positions
            leaderboard[position - 1] = aboveUser;
            leaderboard[position - 2] = user;
            
            leaderboardPositions[streakType][aboveUser] = position;
            leaderboardPositions[streakType][user] = position - 1;
            
            position--;
        }
        
        if (position == 1) {
            emit NewStreakLeader(user, streakType, streak);
        }
        
        emit LeaderboardUpdated(streakType, user, position);
    }
    
    /**
     * @notice Internal function to remove user from leaderboard
     */
    function _removeFromLeaderboard(address user, uint8 streakType) internal {
        uint32 position = leaderboardPositions[streakType][user];
        if (position == 0) return;

        address[] storage leaderboard = leaderboards[streakType];
        uint32 lastIndex = uint32(leaderboard.length - 1);

        if (position - 1 != lastIndex) {
            // Move the last user to the removed user's position
            address lastUser = leaderboard[lastIndex];
            leaderboard[position - 1] = lastUser;
            leaderboardPositions[streakType][lastUser] = position;
        }

        leaderboard.pop();
        leaderboardPositions[streakType][user] = 0;
    }
    
    /**
     * @notice Internal function to update global records
     */
    function _updateGlobalRecords(address user, uint8 streakType, uint32 newStreak) internal {
        // Update streak type leader
        if (newStreak > longestStreaksByType[streakType]) {
            longestStreaksByType[streakType] = newStreak;
            streakTypeLeaders[streakType] = user;
        }
        
        // Update global streak leader
        uint32 userTotalStreak = 0;
        for (uint8 i = 0; i < 5; i++) {
            userTotalStreak += streakCore.getCurrentStreak(user, i);
        }
        
        if (userTotalStreak > globalStats.longestGlobalStreak) {
            globalStats.longestGlobalStreak = userTotalStreak;
            globalStats.streakLeader = user;
            
            emit GlobalStatsUpdated(
                globalStats.totalActiveStreakers,
                userTotalStreak,
                user
            );
        }
    }
    
    /**
     * @notice Internal function to update daily statistics
     */
    function _updateDailyStats(address user, bool isNewStreaker) internal {
    uint32 currentDay = uint32(block.timestamp / DAY_IN_SECONDS);

    PeriodStats storage dayStats = dailyStats[currentDay];
    dayStats.day = currentDay;
    dayStats.totalActivities++;

    if (isNewStreaker) {
        dayStats.newStreakers++;
    }

    // If user hasn't been marked active today yet, increment activeUsers and update last active day
    if (userLastActiveDay[user] != currentDay) {
        dayStats.activeUsers++;
        userLastActiveDay[user] = currentDay;
    }

    emit DailyStatsRecorded(currentDay, dayStats.activeUsers, dayStats.totalActivities, dayStats.newStreakers);
}
    
    /**
     * @notice Get streak type leaders
     * @return leaders Array of leader addresses for each streak type
     * @return streaks Array of corresponding streak values
     */
    function getStreakTypeLeaders() 
        external 
        view 
        returns (address[5] memory leaders, uint32[5] memory streaks) 
    {
        for (uint8 i = 0; i < 5; i++) {
            leaders[i] = streakTypeLeaders[i];
            streaks[i] = longestStreaksByType[i];
        }
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