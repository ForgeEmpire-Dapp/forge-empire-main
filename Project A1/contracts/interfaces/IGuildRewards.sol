// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGuildRewards
 * @dev Interface for guild reward distribution
 */
interface IGuildRewards {
    
    struct RewardPool {
        uint256 totalPool;
        uint256 distributedAmount;
        uint256 rewardPerContribution;
        uint256 lastUpdateTime;
    }
    
    struct MemberReward {
        uint256 pendingRewards;
        uint256 claimedRewards;
        uint256 lastClaimTime;
        uint256 contributionPoints;
    }
    
    // Events
    event RewardsDistributed(uint256 indexed guildId, uint256 totalAmount, uint256 memberCount);
    event RewardsClaimed(uint256 indexed guildId, address indexed member, uint256 amount);
    event ContributionRecorded(uint256 indexed guildId, address indexed member, uint256 points);
    
    // Reward Functions
    function distributeRewards(uint256 guildId, uint256 totalReward) external;
    function claimRewards(uint256 guildId) external;
    function recordContribution(uint256 guildId, address member, uint256 points) external;
    
    // View Functions
    function getPendingRewards(uint256 guildId, address member) external view returns (uint256);
    function getRewardPool(uint256 guildId) external view returns (RewardPool memory);
    function getMemberReward(uint256 guildId, address member) external view returns (MemberReward memory);
    function calculateRewardShare(uint256 guildId, address member) external view returns (uint256);
    
    // Admin Functions
    function setRewardDistributionPeriod(uint256 newPeriod) external;
    function setMinContributionForRewards(uint256 newMinContribution) external;
}