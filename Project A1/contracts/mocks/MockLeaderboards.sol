// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockLeaderboards
 * @dev Mock contract for testing SeasonalEvents integration
 */
contract MockLeaderboards {
    
    mapping(address => mapping(uint8 => uint256)) public userScores;
    
    event ScoreUpdated(address indexed user, uint8 indexed category, uint256 newScore);
    event ScoreIncremented(address indexed user, uint8 indexed category, uint256 increment);
    
    function updateScore(address user, uint8 category, uint256 score) external {
        userScores[user][category] = score;
        emit ScoreUpdated(user, category, score);
    }
    
    function incrementScore(address user, uint8 category, uint256 increment) external {
        userScores[user][category] += increment;
        emit ScoreIncremented(user, category, increment);
    }
    
    function getScore(address user, uint8 category) external view returns (uint256) {
        return userScores[user][category];
    }
}