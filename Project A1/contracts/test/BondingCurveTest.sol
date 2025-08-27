// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/BondingCurveLib.sol";

contract BondingCurveTest {
    using BondingCurveLib for uint256;
    
    function getCurrentPrice(uint256 currentSupply) external pure returns (uint256) {
        return BondingCurveLib.getCurrentPrice(currentSupply);
    }
    
    function calculateBuyCost(uint256 currentSupply, uint256 amount) external pure returns (uint256) {
        return BondingCurveLib.calculateBuyCost(currentSupply, amount);
    }
    
    function calculateSellProceeds(uint256 currentSupply, uint256 amount) external pure returns (uint256) {
        return BondingCurveLib.calculateSellProceeds(currentSupply, amount);
    }
    
    function calculateTokensForEth(uint256 currentSupply, uint256 ethAmount) external pure returns (uint256) {
        return BondingCurveLib.calculateTokensForEth(currentSupply, ethAmount);
    }
    
    function sqrt(uint256 y) external pure returns (uint256) {
        // Re-implement sqrt function for testing since _sqrt is internal
        if (y > 3) {
            uint256 z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
            return z;
        } else if (y != 0) {
            return 1;
        }
        return 0;
    }
}