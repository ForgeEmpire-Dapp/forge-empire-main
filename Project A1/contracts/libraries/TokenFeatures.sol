// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TokenFeatures
 * @dev Library for advanced token features to reduce main contract size
 */
library TokenFeatures {
    
    struct FeeConfig {
        uint256 transferFeeRate;
        uint256 burnRate;
        uint256 reflectionRate;
        bool feesEnabled;
    }
    
    struct LimitConfig {
        uint256 maxTransactionAmount;
        uint256 maxWalletBalance;
        uint256 transactionCooldown;
        bool limitsEnabled;
    }
    
    struct UserFlags {
        bool excludedFromFees;
        bool excludedFromMaxTx;
        bool blacklisted;
        bool authorizedExchange;
    }
    
    // Events
    event FeeConfigUpdated(uint256 transferFee, uint256 burnRate, uint256 reflectionRate);
    event LimitConfigUpdated(uint256 maxTx, uint256 maxWallet, uint256 cooldown);
    event UserFlagsUpdated(address indexed user, bool excludedFromFees, bool excludedFromMaxTx, bool blacklisted, bool authorizedExchange);
    
    /**
     * @dev Calculate transfer fees
     */
    function calculateFees(
        FeeConfig memory feeConfig,
        address from,
        address to,
        uint256 amount,
        mapping(address => UserFlags) storage userFlags
    ) internal view returns (uint256 totalFee, uint256 burnAmount, uint256 reflectionAmount) {
        if (!feeConfig.feesEnabled || userFlags[from].excludedFromFees || userFlags[to].excludedFromFees) {
            return (0, 0, 0);
        }
        
        totalFee = (amount * feeConfig.transferFeeRate) / 10000;
        burnAmount = (totalFee * feeConfig.burnRate) / 10000;
        reflectionAmount = (totalFee * feeConfig.reflectionRate) / 10000;
    }
    
    /**
     * @dev Validate transaction limits
     */
    function validateLimits(
        LimitConfig memory limitConfig,
        address from,
        address to,
        uint256 amount,
        uint256 recipientBalance,
        mapping(address => UserFlags) storage userFlags,
        mapping(address => uint256) storage lastTransactionTime
    ) internal view returns (bool) {
        if (!limitConfig.limitsEnabled) return true;
        
        // Check transaction amount limit
        if (!userFlags[from].excludedFromMaxTx && amount > limitConfig.maxTransactionAmount) {
            return false;
        }
        
        // Check wallet balance limit
        if (!userFlags[to].excludedFromMaxTx && recipientBalance + amount > limitConfig.maxWalletBalance) {
            return false;
        }
        
        // Check transaction cooldown
        if (limitConfig.transactionCooldown > 0 && 
            block.timestamp < lastTransactionTime[from] + limitConfig.transactionCooldown) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Update user flags efficiently using bit manipulation
     */
    function setUserFlags(
        mapping(address => UserFlags) storage userFlags,
        address user,
        bool excludedFromFees,
        bool excludedFromMaxTx,
        bool blacklisted,
        bool authorizedExchange
    ) internal {
        userFlags[user] = UserFlags({
            excludedFromFees: excludedFromFees,
            excludedFromMaxTx: excludedFromMaxTx,
            blacklisted: blacklisted,
            authorizedExchange: authorizedExchange
        });
        
        emit UserFlagsUpdated(user, excludedFromFees, excludedFromMaxTx, blacklisted, authorizedExchange);
    }
    
    /**
     * @dev Check if address is blacklisted
     */
    function isBlacklisted(
        mapping(address => UserFlags) storage userFlags,
        address account
    ) internal view returns (bool) {
        return userFlags[account].blacklisted;
    }
    
    /**
     * @dev Update fee configuration
     */
    function updateFeeConfig(
        FeeConfig storage feeConfig,
        uint256 transferFeeRate,
        uint256 burnRate,
        uint256 reflectionRate,
        bool feesEnabled
    ) internal {
        require(transferFeeRate <= 1000, "Fee too high"); // Max 10%
        require(burnRate + reflectionRate <= 10000, "Invalid rate distribution");
        
        feeConfig.transferFeeRate = transferFeeRate;
        feeConfig.burnRate = burnRate;
        feeConfig.reflectionRate = reflectionRate;
        feeConfig.feesEnabled = feesEnabled;
        
        emit FeeConfigUpdated(transferFeeRate, burnRate, reflectionRate);
    }
    
    /**
     * @dev Update limit configuration
     */
    function updateLimitConfig(
        LimitConfig storage limitConfig,
        uint256 maxTransactionAmount,
        uint256 maxWalletBalance,
        uint256 transactionCooldown,
        bool limitsEnabled
    ) internal {
        limitConfig.maxTransactionAmount = maxTransactionAmount;
        limitConfig.maxWalletBalance = maxWalletBalance;
        limitConfig.transactionCooldown = transactionCooldown;
        limitConfig.limitsEnabled = limitsEnabled;
        
        emit LimitConfigUpdated(maxTransactionAmount, maxWalletBalance, transactionCooldown);
    }
}