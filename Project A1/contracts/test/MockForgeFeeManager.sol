// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockForgeFeeManager {
    uint16 public transferFee;
    uint16 public burnRate;
    uint16 public treasuryRate;
    uint16 public liquidityRate;
    
    uint256 public maxTransaction;
    uint256 public maxWallet;
    uint256 public cooldown;
    
    bool public feesEnabled;
    bool public limitsEnabled;
    
    uint256 public totalFees;
    uint256 public totalBurned;
    uint256 public totalTreasury;
    
    function updateFeeConfig(
        uint16 _transferFee,
        uint16 _burnRate,
        uint16 _treasuryRate,
        uint16 _liquidityRate
    ) external {
        transferFee = _transferFee;
        burnRate = _burnRate;
        treasuryRate = _treasuryRate;
        liquidityRate = _liquidityRate;
    }
    
    function updateLimitConfig(
        uint256 _maxTransaction,
        uint256 _maxWallet,
        uint256 _cooldown
    ) external {
        maxTransaction = _maxTransaction;
        maxWallet = _maxWallet;
        cooldown = _cooldown;
    }
    
    function setFeesEnabled(bool enabled) external {
        feesEnabled = enabled;
    }
    
    function setLimitsEnabled(bool enabled) external {
        limitsEnabled = enabled;
    }
    
    function getFeeStats() external view returns (uint256, uint256, uint256) {
        return (totalFees, totalBurned, totalTreasury);
    }
    
    // Mock function to simulate fee collection
    function simulateFees(uint256 fees, uint256 burned, uint256 treasury) external {
        totalFees += fees;
        totalBurned += burned;
        totalTreasury += treasury;
    }
}