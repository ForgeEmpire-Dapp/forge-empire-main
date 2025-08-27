// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockStreakRewards {
    event RewardClaimed(address indexed user, uint8 indexed streakType, uint32 threshold, uint32 xpReward, uint256 badgeId);
    event BatchRewardsClaimed(address indexed user, uint32 totalXP, uint256[] badgeIds);

    function claimReward(uint8 streakType, uint32 threshold) external {
        emit RewardClaimed(msg.sender, streakType, threshold, 100, 1);
    }

    function claimAllRewards(uint8 streakType) external {
        uint256[] memory badgeIds = new uint256[](1);
        badgeIds[0] = 1;
        emit BatchRewardsClaimed(msg.sender, 100, badgeIds);
    }

    function getAvailableRewards(address user, uint8 streakType) external view returns (uint32[] memory) {
        uint32[] memory rewards = new uint32[](1);
        rewards[0] = 5;
        return rewards;
    }
}