// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";

contract MockStreakCore {
    mapping(address => mapping(uint8 => uint32)) public currentStreaks;
    mapping(address => mapping(uint8 => uint32)) public longestStreaks;
    mapping(address => mapping(uint8 => bool)) public recordedToday;

    function _recordActivity(address user, uint8 streakType) internal {
        currentStreaks[user][streakType]++;
        if (currentStreaks[user][streakType] > longestStreaks[user][streakType]) {
            longestStreaks[user][streakType] = currentStreaks[user][streakType];
        }
        recordedToday[user][streakType] = true;
    }

    function recordActivity(address user, uint8 streakType) external {
        _recordActivity(user, streakType);
    }

    function recordDailyLogin() external {
        // This function is no longer directly called by StreakSystemManager
    }

    function recordQuestCompletion() external {
        // This function is no longer directly called by StreakSystemManager
    }

    function recordTradingActivity() external {
        // This function is no longer directly called by StreakSystemManager
    }

    function recordGovernanceParticipation() external {
        // This function is no longer directly called by StreakSystemManager
    }

    function recordSocialInteraction() external {
        // This function is no longer directly called by StreakSystemManager
    }

    function getCurrentStreak(address user, uint8 streakType) external view returns (uint32) {
        return currentStreaks[user][streakType];
    }

    function getLongestStreak(address user, uint8 streakType) external view returns (uint32) {
        return longestStreaks[user][streakType];
    }

    function hasRecordedToday(address user, uint8 streakType) external view returns (bool) {
        return recordedToday[user][streakType];
    }

    function setCurrentStreak(address user, uint8 streakType, uint32 streak) external {
        currentStreaks[user][streakType] = streak;
    }
}