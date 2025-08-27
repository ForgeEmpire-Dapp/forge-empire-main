// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IForgeTokenCore {
    function isExcludedFromFees(address account) external view returns (bool);
    function burn(uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title ForgeFeeManager
 * @dev Handles fee processing, burning, and distribution for Forge Token
 * @notice Manages transfer fees, burn mechanisms, and treasury distributions
 * @author Avax Forge Empire Team
 */
contract ForgeFeeManager is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    
    bytes32 public constant FEE_ADMIN_ROLE = keccak256("FEE_ADMIN_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    IForgeTokenCore public forgeToken;
    
    // Fee Configuration (basis points: 10000 = 100%)
    struct FeeConfig {
        uint16 transferFeeRate;  // Base transfer fee rate
        uint16 burnRate;         // Percentage of fees to burn
        uint16 treasuryRate;     // Percentage of fees to treasury
        uint16 liquidityRate;    // Percentage of fees to liquidity
        bool feesEnabled;        // Global fee toggle
    }
    
    FeeConfig public feeConfig;
    
    // Fee distribution wallets
    address public treasuryWallet;
    address public liquidityWallet;
    
    // Anti-whale and limit configuration
    struct LimitConfig {
        uint256 maxTransactionAmount;
        uint256 maxWalletBalance;
        uint256 transactionCooldown;
        bool limitsEnabled;
    }
    
    LimitConfig public limitConfig;
    
    // Transaction tracking
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => bool) public isMarketMaker;
    
    // Fee collection tracking
    uint256 public totalFeesCollected;
    uint256 public totalBurned;
    uint256 public totalToTreasury;
    
    // Events
    event FeesProcessed(address indexed from, address indexed to, uint256 amount, uint256 feeAmount);
    event FeeConfigUpdated(uint16 transferFee, uint16 burnRate, uint16 treasuryRate, uint16 liquidityRate);
    event LimitConfigUpdated(uint256 maxTransaction, uint256 maxWallet, uint256 cooldown);
    event WalletsUpdated(address treasury, address liquidity);
    event FeesDistributed(uint256 burned, uint256 treasury, uint256 liquidity);
    event MarketMakerUpdated(address indexed account, bool isMarketMaker);
    
    // Custom Errors
    error ExceedsMaxTransaction();
    error ExceedsMaxWallet();
    error TransactionTooSoon();
    error InvalidFeeRate();
    error InvalidWallet();
    error UnauthorizedToken();
    error FeesDisabled();
    
    // Constants
    uint256 private constant MAX_FEE_RATE = 1000; // 10% maximum total fee
    uint256 private constant BASIS_POINTS = 10000;
    
    /**
     * @notice Initializes the ForgeFeeManager
     * @param _forgeToken Address of ForgeTokenCore contract
     * @param _treasuryWallet Treasury wallet address
     * @param _liquidityWallet Liquidity wallet address
     */
    function initialize(
        address _forgeToken,
        address _treasuryWallet,
        address _liquidityWallet
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FEE_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        
        forgeToken = IForgeTokenCore(_forgeToken);
        treasuryWallet = _treasuryWallet;
        liquidityWallet = _liquidityWallet;
        
        // Initialize default fee configuration
        feeConfig = FeeConfig({
            transferFeeRate: 100,    // 1% default transfer fee
            burnRate: 4000,          // 40% of fees burned
            treasuryRate: 4000,      // 40% of fees to treasury
            liquidityRate: 2000,     // 20% of fees to liquidity
            feesEnabled: true
        });
        
        // Initialize default limits
        limitConfig = LimitConfig({
            maxTransactionAmount: 5_000_000 * 10**18, // 5M tokens
            maxWalletBalance: 10_000_000 * 10**18,    // 10M tokens
            transactionCooldown: 0,                    // No cooldown by default
            limitsEnabled: true
        });
    }
    
    /**
     * @notice Process fees for a token transfer
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @return netAmount Amount after fees
     */
    function processFees(address from, address to, uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
        returns (uint256 netAmount) 
    {
        if (msg.sender != address(forgeToken)) revert UnauthorizedToken();
        
        // Apply limits if enabled
        if (limitConfig.limitsEnabled) {
            _enforceTransactionLimits(from, to, amount);
        }
        
        // Skip fees if disabled or addresses are excluded
        if (!feeConfig.feesEnabled || 
            forgeToken.isExcludedFromFees(from) || 
            forgeToken.isExcludedFromFees(to)) {
            return amount;
        }
        
        // Calculate and apply fees
        uint256 feeAmount = _calculateFees(from, to, amount);
        
        if (feeAmount > 0) {
            _distributeFees(feeAmount);
            emit FeesProcessed(from, to, amount, feeAmount);
        }
        
        return amount - feeAmount;
    }
    
    /**
     * @notice Calculate fees for a transfer
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @return feeAmount Total fee amount
     */
    function _calculateFees(address from, address to, uint256 amount) internal view returns (uint256) {
        uint256 baseFee = feeConfig.transferFeeRate;
        
        // Apply higher fees for market maker transactions
        if (isMarketMaker[from] || isMarketMaker[to]) {
            baseFee = (baseFee * 150) / 100; // 1.5x fees for market makers
        }
        
        return (amount * baseFee) / BASIS_POINTS;
    }
    
    /**
     * @notice Distribute collected fees
     * @param feeAmount Total fee amount to distribute
     */
    function _distributeFees(uint256 feeAmount) internal {
        uint256 burnAmount = (feeAmount * feeConfig.burnRate) / BASIS_POINTS;
        uint256 treasuryAmount = (feeAmount * feeConfig.treasuryRate) / BASIS_POINTS;
        uint256 liquidityAmount = (feeAmount * feeConfig.liquidityRate) / BASIS_POINTS;
        
        // Burn tokens
        if (burnAmount > 0) {
            forgeToken.burn(burnAmount);
            totalBurned += burnAmount;
        }
        
        // Transfer to treasury
        if (treasuryAmount > 0 && treasuryWallet != address(0)) {
            forgeToken.transfer(treasuryWallet, treasuryAmount);
            totalToTreasury += treasuryAmount;
        }
        
        // Transfer to liquidity wallet
        if (liquidityAmount > 0 && liquidityWallet != address(0)) {
            forgeToken.transfer(liquidityWallet, liquidityAmount);
        }
        
        totalFeesCollected += feeAmount;
        emit FeesDistributed(burnAmount, treasuryAmount, liquidityAmount);
    }
    
    /**
     * @notice Enforce transaction limits
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     */
    function _enforceTransactionLimits(address from, address to, uint256 amount) internal {
        // Skip limits for excluded addresses
        if (forgeToken.isExcludedFromFees(from) || forgeToken.isExcludedFromFees(to)) {
            return;
        }
        
        // Check max transaction amount
        if (amount > limitConfig.maxTransactionAmount) revert ExceedsMaxTransaction();
        
        // Check max wallet balance (for buys)
        if (to != address(0)) {
            uint256 recipientBalance = forgeToken.balanceOf(to);
            if (recipientBalance + amount > limitConfig.maxWalletBalance) revert ExceedsMaxWallet();
        }
        
        // Check transaction cooldown
        if (limitConfig.transactionCooldown > 0) {
            uint256 timeSinceLastTx = block.timestamp - lastTransactionTime[from];
            if (timeSinceLastTx < limitConfig.transactionCooldown) revert TransactionTooSoon();
            lastTransactionTime[from] = block.timestamp;
        }
    }
    
    /**
     * @notice Update fee configuration (admin only)
     * @param transferFee Transfer fee rate in basis points
     * @param burnRate Percentage of fees to burn
     * @param treasuryRate Percentage of fees to treasury
     * @param liquidityRate Percentage of fees to liquidity
     */
    function updateFeeConfig(
        uint16 transferFee,
        uint16 burnRate,
        uint16 treasuryRate,
        uint16 liquidityRate
    ) external onlyRole(FEE_ADMIN_ROLE) {
        if (transferFee > MAX_FEE_RATE) revert InvalidFeeRate();
        if (burnRate + treasuryRate + liquidityRate > BASIS_POINTS) revert InvalidFeeRate();
        
        feeConfig.transferFeeRate = transferFee;
        feeConfig.burnRate = burnRate;
        feeConfig.treasuryRate = treasuryRate;
        feeConfig.liquidityRate = liquidityRate;
        
        emit FeeConfigUpdated(transferFee, burnRate, treasuryRate, liquidityRate);
    }
    
    /**
     * @notice Update limit configuration (admin only)
     * @param maxTransaction Maximum transaction amount
     * @param maxWallet Maximum wallet balance
     * @param cooldown Transaction cooldown in seconds
     */
    function updateLimitConfig(
        uint256 maxTransaction,
        uint256 maxWallet,
        uint256 cooldown
    ) external onlyRole(FEE_ADMIN_ROLE) {
        limitConfig.maxTransactionAmount = maxTransaction;
        limitConfig.maxWalletBalance = maxWallet;
        limitConfig.transactionCooldown = cooldown;
        
        emit LimitConfigUpdated(maxTransaction, maxWallet, cooldown);
    }
    
    /**
     * @notice Update wallet addresses (admin only)
     * @param _treasuryWallet New treasury wallet
     * @param _liquidityWallet New liquidity wallet
     */
    function updateWallets(address _treasuryWallet, address _liquidityWallet) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (_treasuryWallet == address(0) || _liquidityWallet == address(0)) revert InvalidWallet();
        
        treasuryWallet = _treasuryWallet;
        liquidityWallet = _liquidityWallet;
        
        emit WalletsUpdated(_treasuryWallet, _liquidityWallet);
    }
    
    /**
     * @notice Set market maker status (admin only)
     * @param account Address to update
     * @param _isMarketMaker Whether address is a market maker
     */
    function setMarketMaker(address account, bool _isMarketMaker) 
        external 
        onlyRole(FEE_ADMIN_ROLE) 
    {
        isMarketMaker[account] = _isMarketMaker;
        emit MarketMakerUpdated(account, _isMarketMaker);
    }
    
    /**
     * @notice Enable/disable fees (admin only)
     * @param enabled Whether fees should be enabled
     */
    function setFeesEnabled(bool enabled) external onlyRole(FEE_ADMIN_ROLE) {
        feeConfig.feesEnabled = enabled;
    }
    
    /**
     * @notice Enable/disable limits (admin only)
     * @param enabled Whether limits should be enabled
     */
    function setLimitsEnabled(bool enabled) external onlyRole(FEE_ADMIN_ROLE) {
        limitConfig.limitsEnabled = enabled;
    }
    
    /**
     * @notice Get fee statistics
     * @return totalFees Total fees collected
     * @return totalBurnedAmount Total amount burned
     * @return totalTreasuryAmount Total amount sent to treasury
     */
    function getFeeStats() external view returns (uint256 totalFees, uint256 totalBurnedAmount, uint256 totalTreasuryAmount) {
        return (totalFeesCollected, totalBurned, totalToTreasury);
    }
    
    /**
     * @notice Preview fees for a transfer
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @return feeAmount Estimated fee amount
     * @return netAmount Amount after fees
     */
    function previewFees(address from, address to, uint256 amount) 
        external 
        view 
        returns (uint256 feeAmount, uint256 netAmount) 
    {
        if (!feeConfig.feesEnabled || 
            forgeToken.isExcludedFromFees(from) || 
            forgeToken.isExcludedFromFees(to)) {
            return (0, amount);
        }
        
        feeAmount = _calculateFees(from, to, amount);
        netAmount = amount - feeAmount;
    }
    
    /**
     * @notice Pause contract (admin only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause contract (admin only)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}