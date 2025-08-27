// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILeaderboardCore
 * @dev Interface for core leaderboard functionality
 */
interface ILeaderboardCore {
    
    enum LeaderboardType {
        XP_LEADERBOARD,      // Based on total XP earned
        QUEST_LEADERBOARD,   // Based on quests completed
        STREAK_LEADERBOARD,  // Based on streak achievements
        BADGE_LEADERBOARD,   // Based on badges earned
        GUILD_LEADERBOARD    // Based on guild contributions
    }
    
    enum TimeFrame {
        DAILY,    // 24 hours
        WEEKLY,   // 7 days
        MONTHLY,  // 30 days
        ALL_TIME  // No time limit
    }
    
    struct LeaderboardEntry {
        address user;
        uint256 score;
        uint256 lastUpdated;
        uint256 rank;
    }
    
    struct LeaderboardConfig {
        bool isActive;
        uint256 maxEntries;
        uint256 updateCooldown;
        uint256 seasonStartTime;
        uint256 seasonDuration;
    }
    
    // Events
    event ScoreUpdated(
        address indexed user,
        LeaderboardType indexed leaderboardType,
        TimeFrame indexed timeFrame,
        uint256 newScore,
        uint256 newRank
    );
    
    event LeaderboardReset(
        LeaderboardType indexed leaderboardType,
        TimeFrame indexed timeFrame
    );
    
    event NewLeader(
        address indexed newLeader,
        LeaderboardType indexed leaderboardType,
        TimeFrame indexed timeFrame,
        uint256 score
    );
    
    // Core Functions
    function updateScore(
        address user,
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        uint256 newScore
    ) external;
    
    function incrementScore(
        address user,
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        uint256 increment
    ) external;
    
    function getLeaderboard(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        uint256 limit
    ) external view returns (LeaderboardEntry[] memory);
    
    function getUserScore(
        address user,
        LeaderboardType leaderboardType,
        TimeFrame timeFrame
    ) external view returns (uint256 score, uint256 rank);
    
    function getUserRank(
        address user,
        LeaderboardType leaderboardType,
        TimeFrame timeFrame
    ) external view returns (uint256);
    
    function getTopUsers(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        uint256 count
    ) external view returns (address[] memory users, uint256[] memory scores);
    
    // Admin Functions
    function resetLeaderboard(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame
    ) external;
    
    function setLeaderboardConfig(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        LeaderboardConfig calldata config
    ) external;
    
    function startNewSeason(
        LeaderboardType leaderboardType,
        uint256 duration
    ) external;
}