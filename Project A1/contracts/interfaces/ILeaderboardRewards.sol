// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ILeaderboardCore.sol";

/**
 * @title ILeaderboardRewards
 * @dev Interface for leaderboard reward distribution
 */
interface ILeaderboardRewards {
    
    struct RewardTier {
        uint256 minRank;
        uint256 maxRank;
        uint256 tokenReward;
        uint256 xpReward;
        string badgeURI;
        bool hasBadge;
    }
    
    struct SeasonRewards {
        uint256 totalPool;
        uint256 distributedAmount;
        mapping(uint256 => RewardTier) tiers; // rank => tier
        uint256 tierCount;
        bool isActive;
        uint256 seasonEndTime;
    }
    
    struct UserRewards {
        uint256 pendingTokens;
        uint256 claimedTokens;
        uint256 pendingXP;
        uint256 claimedXP;
        uint256 badgesEarned;
        uint256 lastClaimTime;
    }
    
    // Events
    event RewardTierCreated(
        ILeaderboardCore.LeaderboardType indexed leaderboardType,
        ILeaderboardCore.TimeFrame indexed timeFrame,
        uint256 minRank,
        uint256 maxRank,
        uint256 tokenReward,
        uint256 xpReward
    );
    
    event SeasonRewardsDistributed(
        ILeaderboardCore.LeaderboardType indexed leaderboardType,
        ILeaderboardCore.TimeFrame indexed timeFrame,
        uint256 totalRewards,
        uint256 recipientCount
    );
    
    event RewardsClaimed(
        address indexed user,
        uint256 tokenAmount,
        uint256 xpAmount,
        uint256 badgeCount
    );
    
    event RankRewardEarned(
        address indexed user,
        ILeaderboardCore.LeaderboardType indexed leaderboardType,
        uint256 rank,
        uint256 reward
    );
    
    // Reward Functions
    function setupRewardTiers(
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame,
        RewardTier[] calldata tiers
    ) external;
    
    function distributeSeasonRewards(
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame
    ) external;
    
    function claimRewards() external;
    function calculateUserRewards(address user) external view returns (UserRewards memory);
    
    // Instant Rewards (for rank achievements)
    function awardRankReward(
        address user,
        ILeaderboardCore.LeaderboardType leaderboardType,
        uint256 rank
    ) external;
    
    // View Functions
    function getRewardTier(
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame,
        uint256 rank
    ) external view returns (RewardTier memory);
    
    function getPendingRewards(address user) external view returns (
        uint256 pendingTokens,
        uint256 pendingXP,
        uint256 pendingBadges
    );
    
    function getSeasonInfo(
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame
    ) external view returns (
        uint256 totalPool,
        uint256 distributedAmount,
        bool isActive,
        uint256 seasonEndTime
    );
    
    // Admin Functions
    function setRewardPool(
        ILeaderboardCore.LeaderboardType leaderboardType,
        ILeaderboardCore.TimeFrame timeFrame,
        uint256 poolAmount
    ) external;
    
    function emergencyWithdraw(address token, uint256 amount) external;
}