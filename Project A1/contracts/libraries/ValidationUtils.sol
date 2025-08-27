// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ValidationUtils
 * @dev Common validation functions and utilities
 */
library ValidationUtils {
    
    /**
     * @dev Validate address is not zero
     * @param addr Address to validate
     */
    function requireNonZeroAddress(address addr) internal pure {
        require(addr != address(0), "ValidationUtils: zero address");
    }
    
    /**
     * @dev Validate amount is greater than zero
     * @param amount Amount to validate
     */
    function requireNonZeroAmount(uint256 amount) internal pure {
        require(amount > 0, "ValidationUtils: zero amount");
    }
    
    /**
     * @dev Validate string is not empty
     * @param str String to validate
     */
    function requireNonEmptyString(string memory str) internal pure {
        require(bytes(str).length > 0, "ValidationUtils: empty string");
    }
    
    /**
     * @dev Validate percentage is within valid range (0-10000 basis points)
     * @param percentage Percentage in basis points
     */
    function requireValidPercentage(uint256 percentage) internal pure {
        require(percentage <= 10000, "ValidationUtils: invalid percentage");
    }
    
    /**
     * @dev Validate array lengths match
     * @param array1Length Length of first array
     * @param array2Length Length of second array
     */
    function requireMatchingArrayLengths(uint256 array1Length, uint256 array2Length) internal pure {
        require(array1Length == array2Length, "ValidationUtils: array length mismatch");
    }
    
    /**
     * @dev Validate timestamp is in the future
     * @param timestamp Timestamp to validate
     */
    function requireFutureTimestamp(uint256 timestamp) internal view {
        require(timestamp > block.timestamp, "ValidationUtils: timestamp not in future");
    }
    
    /**
     * @dev Validate timestamp is in the past
     * @param timestamp Timestamp to validate
     */
    function requirePastTimestamp(uint256 timestamp) internal view {
        require(timestamp <= block.timestamp, "ValidationUtils: timestamp not in past");
    }
    
    /**
     * @dev Validate value is within range
     * @param value Value to validate
     * @param min Minimum allowed value
     * @param max Maximum allowed value
     */
    function requireValueInRange(uint256 value, uint256 min, uint256 max) internal pure {
        require(value >= min && value <= max, "ValidationUtils: value out of range");
    }
    
    /**
     * @dev Validate marketplace listing parameters
     * @param price Listing price
     * @param endTime End time for auction
     * @param nftContract NFT contract address
     */
    function validateListingParams(
        uint256 price,
        uint256 endTime,
        address nftContract
    ) internal view {
        requireNonZeroAmount(price);
        requireFutureTimestamp(endTime);
        requireNonZeroAddress(nftContract);
    }
    
    /**
     * @dev Validate quest parameters
     * @param rewardAmount Reward amount
     * @param deadline Quest deadline
     * @param maxParticipants Maximum participants
     */
    function validateQuestParams(
        uint256 rewardAmount,
        uint256 deadline,
        uint256 maxParticipants
    ) internal view {
        requireNonZeroAmount(rewardAmount);
        requireFutureTimestamp(deadline);
        requireNonZeroAmount(maxParticipants);
    }
}