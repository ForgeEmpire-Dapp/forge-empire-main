// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockStreakMilestones {
    event MilestoneAchieved(address indexed user, uint32 indexed milestoneId, string title, uint32 specialReward, uint256 badgeId);

    function claimMilestone(uint32 milestoneId) external {
        emit MilestoneAchieved(msg.sender, milestoneId, "Test Milestone", 100, 1);
    }

    function updateTotalStreakDays(address user) external {}
}