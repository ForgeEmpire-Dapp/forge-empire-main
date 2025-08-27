// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ILeaderboardCore.sol";

/**
 * @title ILeaderboardStats
 * @dev Interface for leaderboard analytics and statistics
 */
interface ILeaderboardStats {
    
    struct UserStats {
        uint256 totalScoreEarned;
        uint256 highestRank;
        uint256 averageRank;
        uint256 participationCount;
        uint256 firstParticipation;
        uint256 lastActivity;
        mapping(ILeaderboardCore.LeaderboardType => uint256) typeScores;
        mapping(ILeaderboardCore.TimeFrame => uint256) timeFrameScores;
    }
    
    struct LeaderboardAnalytics {
        uint256 totalParticipants;
        uint256 activeParticipants;
        uint256 averageScore;
        uint256 highestScore;
        uint256 totalScoreDistributed;
        uint256 lastUpdateTime;
        address currentLeader;
    }
    
    struct RankHistory {
        uint256 timestamp;
        uint256 rank;
        uint256 score;
    }
    
    struct TrendData {
        uint256 period;
        uint256 averageScore;
        uint256 participantCount;
        uint256 topScore;
        address topScorer;
    }
    
    // Events
    event StatsUpdated(
        address indexed user,
        ILeaderboardCore.LeaderboardType indexed leaderboardType,
        uint256 newTotalScore,
        uint256 participationCount
    );
    
    event AnalyticsCalculated(
        ILeaderboardCore.LeaderboardType indexed leaderboardType,
        ILeaderboardCore.TimeFrame indexed timeFrame,
        uint256 totalParticipants,
        uint256 averageScore
    );
    
    event MilestoneAchieved(
        address indexed user,
        string milestone,
        uint256 value
    );
    
    // Statistics Functions
    function recordActivity(
        address user,
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame,
        uint256 score,
        uint256 rank
    ) external;
    
    function calculateAnalytics(
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame
    ) external returns (LeaderboardAnalytics memory);
    
    // View Functions
    function getUserStats(address user) external view returns (
        uint256 totalScoreEarned,
        uint256 highestRank,
        uint256 averageRank,
        uint256 participationCount,
        uint256 firstParticipation,
        uint256 lastActivity
    );
    
    function getUserTypeScore(
        address user,
        ILeaderboardCore.LeaderboardType leaderboardType
    ) external view returns (uint256);
    
    function getUserTimeFrameScore(
        address user,
        ILeaderboardCore.TimeFrame timeFrame
    ) external view returns (uint256);
    
    function getLeaderboardAnalytics(
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame
    ) external view returns (LeaderboardAnalytics memory);
    
    function getRankHistory(
        address user,
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame,
        uint256 limit
    ) external view returns (RankHistory[] memory);
    
    function getTrendData(
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame,
        uint256 periods
    ) external view returns (TrendData[] memory);
    
    function getTopPerformers(
        ILeaderboardCore.LeaderboardType leaderboardType,
        uint256 timeRange
    ) external view returns (
        address[] memory users,
        uint256[] memory scores,
        uint256[] memory ranks
    );
    
    function getUserComparison(
        address user1,
        address user2,
        ILeaderboardCore.LeaderboardType leaderboardType
    ) external view returns (
        uint256 user1Score,
        uint256 user2Score,
        uint256 user1Rank,
        uint256 user2Rank,
        int256 scoreDifference
    );
    
    // Milestone Functions
    function checkMilestones(address user) external;
    function getUserMilestones(address user) external view returns (string[] memory);
    
    // Admin Functions
    function resetUserStats(address user) external;
    function exportAnalytics(
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame
    ) external view returns (bytes memory);
}