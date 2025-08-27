// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStreakSystem
 * @dev Interface for the modular streak system
 * @notice Defines the interface for interacting with the streak system modules
 */
interface IStreakSystem {
    
    // Core streak tracking
    function recordDailyLogin() external;
    function recordQuestCompletion() external;
    function recordTradingActivity() external;
    function recordGovernanceParticipation() external;
    function recordSocialInteraction() external;
    function recordActivity(address user, uint8 streakType) external;
    
    // Streak queries
    function getCurrentStreak(address user, uint8 streakType) external view returns (uint32);
    function getLongestStreak(address user, uint8 streakType) external view returns (uint32);
    function hasRecordedToday(address user, uint8 streakType) external view returns (bool);
    
    // Reward management
    function claimReward(uint8 streakType, uint32 threshold) external;
    function claimAllRewards(uint8 streakType) external;
    function getAvailableRewards(address user, uint8 streakType) external view returns (uint32[] memory);
    
    // Milestone management
    function claimMilestone(uint32 milestoneId) external;
    function claimAllMilestones() external;
    function getAvailableMilestones(address user) external view returns (uint32[] memory);
    
    // Statistics and leaderboards
    function getLeaderboard(uint8 streakType, uint32 limit) external view returns (address[] memory, uint32[] memory);
    function getUserLeaderboardPosition(address user, uint8 streakType) external view returns (uint32);
    function getGlobalStats() external view returns (uint32, uint32, address, uint32);
    
    // Events
    event StreakIncreased(address indexed user, uint8 indexed streakType, uint32 newStreak);
    event StreakBroken(address indexed user, uint8 indexed streakType, uint32 finalStreak);
    event RewardClaimed(address indexed user, uint8 indexed streakType, uint32 threshold, uint32 xpReward, uint256 badgeId);
    event MilestoneAchieved(address indexed user, uint32 indexed milestoneId, string title, uint32 specialReward, uint256 badgeId);
}