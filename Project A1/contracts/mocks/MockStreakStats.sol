// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockStreakStats {
    event UserActivity(address indexed user, uint8 indexed streakType, uint32 newStreak);

    function updateUserActivity(address user, uint8 streakType, uint32 newStreak) external {
        emit UserActivity(user, streakType, newStreak);
    }
}