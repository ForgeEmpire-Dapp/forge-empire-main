// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockStreakRewardManager {
    address public lastUser;
    uint8 public lastStreakType;
    uint256 public lastStreakLength;
    uint256 public callCount;

    function checkAndAwardRewards(address user, uint8 streakType, uint256 streakLength) external {
        lastUser = user;
        lastStreakType = streakType;
        lastStreakLength = streakLength;
        callCount++;
    }
}