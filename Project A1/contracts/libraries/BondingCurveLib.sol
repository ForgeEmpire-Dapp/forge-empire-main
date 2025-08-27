// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BondingCurveLib
 * @dev Library for bonding curve calculations - optimized for gas efficiency
 * @notice Handles linear bonding curve math for token pricing
 * @author Avax Forge Empire Team
 */
library BondingCurveLib {
    
    // Constants
    uint256 internal constant INITIAL_PRICE = 1e15; // 0.001 ETH
    uint256 internal constant PRICE_INCREMENT = 1e12; // Price increment per token
    uint256 internal constant PRECISION = 1e18;
    
    /**
     * @notice Calculate cost for buying tokens using bonding curve
     * @param currentSupply Current token supply
     * @param amount Amount of tokens to buy
     * @return cost Total cost in ETH
     */
    function calculateBuyCost(uint256 currentSupply, uint256 amount) internal pure returns (uint256 cost) {
        // Linear bonding curve: cost = (startPrice + endPrice) * amount / 2
        uint256 startPrice = INITIAL_PRICE + (currentSupply * PRICE_INCREMENT) / PRECISION;
        uint256 endPrice = INITIAL_PRICE + ((currentSupply + amount) * PRICE_INCREMENT) / PRECISION;
        
        cost = ((startPrice + endPrice) * amount) / (2 * PRECISION);
    }
    
    /**
     * @notice Calculate proceeds for selling tokens using bonding curve
     * @param currentSupply Current token supply
     * @param amount Amount of tokens to sell
     * @return proceeds Total proceeds in ETH
     */
    function calculateSellProceeds(uint256 currentSupply, uint256 amount) internal pure returns (uint256 proceeds) {
        if (currentSupply < amount) return 0;
        
        // Linear bonding curve sell (reverse of buy)
        uint256 newSupply = currentSupply - amount;
        uint256 startPrice = INITIAL_PRICE + (newSupply * PRICE_INCREMENT) / PRECISION;
        uint256 endPrice = INITIAL_PRICE + (currentSupply * PRICE_INCREMENT) / PRECISION;
        
        proceeds = ((startPrice + endPrice) * amount) / (2 * PRECISION);
    }
    
    /**
     * @notice Get current price for a token at given supply
     * @param currentSupply Current token supply
     * @return price Current price per token
     */
    function getCurrentPrice(uint256 currentSupply) internal pure returns (uint256 price) {
        // Check for overflow before multiplication
        if (currentSupply > type(uint256).max / PRICE_INCREMENT) {
            // If overflow would occur, return max price
            price = type(uint256).max;
        } else {
            price = INITIAL_PRICE + (currentSupply * PRICE_INCREMENT) / PRECISION;
        }
    }
    
    /**
     * @notice Calculate token amount for a given ETH amount
     * @param currentSupply Current token supply
     * @param ethAmount ETH amount to spend
     * @return tokenAmount Amount of tokens that can be bought
     */
    function calculateTokensForEth(uint256 currentSupply, uint256 ethAmount) internal pure returns (uint256 tokenAmount) {
        if (ethAmount == 0) return 0;
        
        // Use iterative approach for better precision
        // Start with an estimate and refine
        uint256 low = 0;
        uint256 high = ethAmount * PRECISION / INITIAL_PRICE; // Maximum possible tokens at minimum price
        
        // Binary search to find the right amount
        while (low < high) {
            uint256 mid = (low + high + 1) / 2;
            uint256 cost = calculateBuyCost(currentSupply, mid);
            
            if (cost <= ethAmount) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        
        tokenAmount = low;
    }
    
    /**
     * @notice Calculate square root using Babylonian method
     * @param y Number to find square root of
     * @return z Square root
     */
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}