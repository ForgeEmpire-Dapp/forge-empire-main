// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MathUtils
 * @dev Common mathematical operations and utilities
 */
library MathUtils {
    
    /**
     * @dev Calculate percentage of a value
     * @param value The base value
     * @param percentage The percentage in basis points (10000 = 100%)
     * @return The calculated percentage amount
     */
    function calculatePercentage(uint256 value, uint256 percentage) internal pure returns (uint256) {
        return (value * percentage) / 10000;
    }
    
    /**
     * @dev Calculate fee amounts for marketplace transactions
     * @param totalAmount Total transaction amount
     * @param marketplaceFee Marketplace fee in basis points
     * @param royaltyFee Royalty fee in basis points
     * @return marketplaceFeeAmount The marketplace fee amount
     * @return royaltyFeeAmount The royalty fee amount
     * @return sellerAmount The amount for the seller
     */
    function calculateFeeDistribution(
        uint256 totalAmount,
        uint256 marketplaceFee,
        uint256 royaltyFee
    ) internal pure returns (
        uint256 marketplaceFeeAmount,
        uint256 royaltyFeeAmount,
        uint256 sellerAmount
    ) {
        marketplaceFeeAmount = calculatePercentage(totalAmount, marketplaceFee);
        royaltyFeeAmount = calculatePercentage(totalAmount, royaltyFee);
        sellerAmount = totalAmount - marketplaceFeeAmount - royaltyFeeAmount;
    }
    
    /**
     * @dev Calculate XP rewards with multipliers
     * @param baseXP Base XP amount
     * @param multiplier Multiplier in basis points (10000 = 100%)
     * @param bonus Additional bonus amount
     * @return Total XP reward
     */
    function calculateXPReward(
        uint256 baseXP,
        uint256 multiplier,
        uint256 bonus
    ) internal pure returns (uint256) {
        return calculatePercentage(baseXP, multiplier) + bonus;
    }
    
    /**
     * @dev Calculate streak bonuses
     * @param streakCount Number of consecutive days
     * @param baseReward Base reward amount
     * @return bonusReward Streak bonus reward
     */
    function calculateStreakBonus(
        uint256 streakCount,
        uint256 baseReward
    ) internal pure returns (uint256 bonusReward) {
        if (streakCount >= 30) {
            bonusReward = calculatePercentage(baseReward, 5000); // 50% bonus
        } else if (streakCount >= 14) {
            bonusReward = calculatePercentage(baseReward, 3000); // 30% bonus
        } else if (streakCount >= 7) {
            bonusReward = calculatePercentage(baseReward, 1500); // 15% bonus
        } else if (streakCount >= 3) {
            bonusReward = calculatePercentage(baseReward, 500); // 5% bonus
        }
    }
    
    /**
     * @dev Safely add two numbers with overflow check
     * @param a First number
     * @param b Second number
     * @return Sum of a and b
     */
    function safeAdd(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "MathUtils: addition overflow");
        return c;
    }
    
    /**
     * @dev Safely subtract two numbers with underflow check
     * @param a First number
     * @param b Second number
     * @return Difference of a and b
     */
    function safeSub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "MathUtils: subtraction underflow");
        return a - b;
    }
}