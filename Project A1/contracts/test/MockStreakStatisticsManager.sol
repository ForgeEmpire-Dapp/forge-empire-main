// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockStreakStatisticsManager {
    address public lastUser;
    uint8 public lastStreakType;
    uint256 public lastNewStreakLength;
    uint256 public lastTotalUserStreakDays;
    uint256 public callCount;

    function updateGlobalStats(address user, uint8 streakType, uint256 newStreakLength, uint256 totalUserStreakDays) external {
        lastUser = user;
        lastStreakType = streakType;
        lastNewStreakLength = newStreakLength;
        lastTotalUserStreakDays = totalUserStreakDays;
        callCount++;
    }

    function getUserStats(address user) external pure returns (uint256, uint256, bool) {
        // Mock implementation
        return (0, 0, false);
    }
}