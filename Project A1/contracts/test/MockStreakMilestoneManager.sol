// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockStreakMilestoneManager {
    address public lastUser;
    uint256 public lastStreakLength;
    uint256 public callCount;

    function checkMilestones(address user, uint256 streakLength) external {
        lastUser = user;
        lastStreakLength = streakLength;
        callCount++;
    }
}