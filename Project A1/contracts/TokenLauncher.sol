// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./libraries/BondingCurveLib.sol";

interface ITokenManagerCore {
    function isTokenLaunched(address token) external view returns (bool);
    function protocolConfig() external view returns (address feeWallet, uint256 protocolFee);
}

interface IMintableToken {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IReferralEngine {
    function registerReferral(address user, address referrer) external;
}

/**
 * @title TokenLauncher
 * @dev Optimized token launcher with bonding curve mechanics
 * @notice Handles token buying/selling with linear bonding curve pricing
 * @author Avax Forge Empire Team
 */
contract TokenLauncher is AccessControl, Pausable, ReentrancyGuard {
    
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant WHITELIST_MANAGER_ROLE = keccak256("WHITELIST_MANAGER_ROLE");
    bytes32 public constant PRIVATE_SALE_MANAGER_ROLE = keccak256("PRIVATE_SALE_MANAGER_ROLE");
    
    // External contracts
    ITokenManagerCore public immutable tokenManagerCore;
    IReferralEngine public referralEngine;
    
    // Protocol limits
    uint256 public constant MAX_SUPPLY_PER_TOKEN = 1_000_000 * 1e18; // 1M tokens
    uint256 public constant MAX_TRANSACTION_AMOUNT = 10_000 * 1e18; // 10K tokens
    uint256 public constant MAX_PRIVATE_SALE_DURATION = 30 days;
    
    // Token supply tracking
    mapping(address => uint256) public tokenSupplies;
    
    // Private sale configuration (packed struct)
    struct PrivateSale {
        uint64 startTime;
        uint64 endTime;
        uint128 price; // Price per token in wei
        bool isActive;
    }
    
    mapping(address => PrivateSale) public privateSales;
    mapping(address => mapping(address => bool)) public privateSaleParticipants;
    
    // Whitelist management
    mapping(address => mapping(address => bool)) public whitelisted;
    mapping(address => bool) public whitelistEnabled;
    
    // Emergency tracking
    mapping(address => uint256) public emergencyWithdrawableBalance;
    
    // Flash loan protection
    mapping(address => uint256) public lastTransactionBlock;
    uint256 public constant FLASH_LOAN_PROTECTION_BLOCKS = 1; // Minimum blocks between transactions
    
    // Events
    event TokenPurchased(address indexed buyer, address indexed token, uint256 amount, uint256 cost, uint256 newPrice);
    event TokenSold(address indexed seller, address indexed token, uint256 amount, uint256 proceeds, uint256 newPrice);
    event PrivateSaleCreated(address indexed token, uint64 startTime, uint64 endTime, uint128 price);
    event WhitelistUpdated(address indexed token, address indexed user, bool whitelisted);
    event EmergencyWithdrawal(address indexed token, uint256 amount);
    
    // Custom Errors
    error TokenNotLaunched();
    error NotWhitelisted();
    error InsufficientPayment();
    error PrivateSaleNotActive();
    error PrivateSaleNotStarted();
    error PrivateSaleEnded();
    error NotPrivateSaleParticipant();
    error AmountMustBeGreaterThanZero();
    error MaxSupplyExceeded();
    error MaxTransactionAmountExceeded();
    error ZeroAddress();
    error SlippageExceeded();
    error InsufficientBalance();
    error InvalidTimeframe();
    error InvalidPrice();
    error FlashLoanProtectionActive();
    
    constructor(address _tokenManagerCore) {
        if (_tokenManagerCore == address(0)) revert ZeroAddress();
        
        tokenManagerCore = ITokenManagerCore(_tokenManagerCore);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(WHITELIST_MANAGER_ROLE, msg.sender);
        _grantRole(PRIVATE_SALE_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @notice Buy tokens using bonding curve or private sale pricing
     * @param tokenAddress Token contract address
     * @param amount Amount of tokens to buy
     * @param maxCost Maximum cost willing to pay (slippage protection)
     * @param referrer Optional referrer address
     */
    function buyToken(
        address tokenAddress,
        uint256 amount,
        uint256 maxCost,
        address referrer
    ) external payable whenNotPaused nonReentrant {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        if (amount > MAX_TRANSACTION_AMOUNT) revert MaxTransactionAmountExceeded();
        if (!tokenManagerCore.isTokenLaunched(tokenAddress)) revert TokenNotLaunched();
        
        // Flash loan protection: prevent same-block buy/sell
        if (lastTransactionBlock[msg.sender] + FLASH_LOAN_PROTECTION_BLOCKS > block.number) {
            revert FlashLoanProtectionActive();
        }
        
        // Check whitelist if enabled
        if (whitelistEnabled[tokenAddress] && !whitelisted[tokenAddress][msg.sender]) {
            revert NotWhitelisted();
        }
        
        uint256 currentSupply = tokenSupplies[tokenAddress];
        if (currentSupply + amount > MAX_SUPPLY_PER_TOKEN) revert MaxSupplyExceeded();
        
        uint256 cost;
        bool isPrivateSale = false;
        
        // Check for active private sale
        PrivateSale memory sale = privateSales[tokenAddress];
        if (sale.isActive) {
            if (block.timestamp < sale.startTime) revert PrivateSaleNotStarted();
            if (block.timestamp > sale.endTime) revert PrivateSaleEnded();
            if (!privateSaleParticipants[tokenAddress][msg.sender]) {
                revert NotPrivateSaleParticipant();
            }
            
            cost = (amount * sale.price) / 1e18;
            isPrivateSale = true;
        } else {
            // Use bonding curve pricing
            cost = BondingCurveLib.calculateBuyCost(currentSupply, amount);
        }
        
        if (cost > maxCost) revert SlippageExceeded();
        if (msg.value < cost) revert InsufficientPayment();
        
        // Handle protocol fee calculation
        (address feeWallet, uint256 protocolFee) = tokenManagerCore.protocolConfig();
        uint256 protocolFeeAmount = (cost * protocolFee) / 10000;
        
        // Update supply (state update before external interactions)
        tokenSupplies[tokenAddress] = currentSupply + amount;
        
        // Get new price for event
        uint256 newPrice = isPrivateSale ? sale.price : BondingCurveLib.getCurrentPrice(currentSupply + amount);
        
        // Emit event before external interactions
        emit TokenPurchased(msg.sender, tokenAddress, amount, cost, newPrice);
        
        // External interactions after all state updates
        // Mint tokens
        IMintableToken(tokenAddress).mint(msg.sender, amount);
        
        // Process referral if provided
        if (referrer != address(0) && address(referralEngine) != address(0)) {
            try referralEngine.registerReferral(msg.sender, referrer) {} catch {}
        }
        
        // Transfer protocol fee
        if (protocolFeeAmount > 0 && feeWallet != address(0)) {
            payable(feeWallet).transfer(protocolFeeAmount);
        }
        
        // Refund excess payment
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
        
        // Update last transaction block for flash loan protection
        lastTransactionBlock[msg.sender] = block.number;
    }
    
    /**
     * @notice Sell tokens back using bonding curve pricing
     * @param tokenAddress Token contract address
     * @param amount Amount of tokens to sell
     * @param minProceeds Minimum proceeds expected (slippage protection)
     */
    function sellToken(
        address tokenAddress,
        uint256 amount,
        uint256 minProceeds
    ) external whenNotPaused nonReentrant {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        
        // Flash loan protection: prevent same-block buy/sell
        if (lastTransactionBlock[msg.sender] + FLASH_LOAN_PROTECTION_BLOCKS > block.number) {
            revert FlashLoanProtectionActive();
        }
        
        uint256 currentSupply = tokenSupplies[tokenAddress];
        if (currentSupply < amount) revert InsufficientBalance();
        
        // Calculate proceeds using bonding curve
        uint256 proceeds = BondingCurveLib.calculateSellProceeds(currentSupply, amount);
        if (proceeds < minProceeds) revert SlippageExceeded();
        if (address(this).balance < proceeds) revert InsufficientBalance();
        
        // Update supply (state update before external interactions)
        tokenSupplies[tokenAddress] = currentSupply - amount;
        
        // Calculate new price for event
        uint256 newPrice = BondingCurveLib.getCurrentPrice(currentSupply - amount);
        
        // Emit event before external interactions
        emit TokenSold(msg.sender, tokenAddress, amount, proceeds, newPrice);
        
        // External interactions after all state updates
        // Burn tokens from seller
        IMintableToken(tokenAddress).transferFrom(msg.sender, address(this), amount);
        IMintableToken(tokenAddress).burn(amount);
        
        // Transfer proceeds
        payable(msg.sender).transfer(proceeds);
        
        // Update last transaction block for flash loan protection
        lastTransactionBlock[msg.sender] = block.number;
    }
    
    /**
     * @notice Create a private sale for a token
     * @param tokenAddress Token contract address
     * @param startTime Sale start timestamp
     * @param endTime Sale end timestamp
     * @param price Price per token in wei
     * @param participants Array of participant addresses
     */
    function createPrivateSale(
        address tokenAddress,
        uint64 startTime,
        uint64 endTime,
        uint128 price,
        address[] calldata participants
    ) external onlyRole(PRIVATE_SALE_MANAGER_ROLE) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (startTime >= endTime) revert InvalidTimeframe();
        if (endTime > block.timestamp + MAX_PRIVATE_SALE_DURATION) revert InvalidTimeframe();
        if (price == 0) revert InvalidPrice();
        
        privateSales[tokenAddress] = PrivateSale({
            startTime: startTime,
            endTime: endTime,
            price: price,
            isActive: true
        });
        
        // Add participants
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] != address(0)) {
                privateSaleParticipants[tokenAddress][participants[i]] = true;
            }
        }
        
        emit PrivateSaleCreated(tokenAddress, startTime, endTime, price);
    }
    
    /**
     * @notice End a private sale
     * @param tokenAddress Token contract address
     */
    function endPrivateSale(address tokenAddress) external onlyRole(PRIVATE_SALE_MANAGER_ROLE) {
        privateSales[tokenAddress].isActive = false;
    }
    
    /**
     * @notice Update whitelist for a token
     * @param tokenAddress Token contract address
     * @param users Array of user addresses
     * @param whitelistStatus Array of whitelist statuses
     */
    function updateWhitelist(
        address tokenAddress,
        address[] calldata users,
        bool[] calldata whitelistStatus
    ) external onlyRole(WHITELIST_MANAGER_ROLE) {
        if (users.length != whitelistStatus.length) revert InvalidTimeframe();
        
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] != address(0)) {
                whitelisted[tokenAddress][users[i]] = whitelistStatus[i];
                emit WhitelistUpdated(tokenAddress, users[i], whitelistStatus[i]);
            }
        }
    }
    
    /**
     * @notice Enable/disable whitelist for a token
     * @param tokenAddress Token contract address
     * @param enabled Whether whitelist should be enabled
     */
    function setWhitelistEnabled(address tokenAddress, bool enabled) 
        external 
        onlyRole(WHITELIST_MANAGER_ROLE) 
    {
        whitelistEnabled[tokenAddress] = enabled;
    }
    
    /**
     * @notice Set referral engine contract
     * @param _referralEngine Referral engine contract address
     */
    function setReferralEngine(address _referralEngine) external onlyRole(ADMIN_ROLE) {
        referralEngine = IReferralEngine(_referralEngine);
    }
    
    /**
     * @notice Get current price for a token
     * @param tokenAddress Token contract address
     * @return Current price per token
     */
    function getCurrentPrice(address tokenAddress) external view returns (uint256) {
        return BondingCurveLib.getCurrentPrice(tokenSupplies[tokenAddress]);
    }
    
    /**
     * @notice Preview buy cost for a token amount
     * @param tokenAddress Token contract address
     * @param amount Amount of tokens
     * @return cost Total cost in ETH
     */
    function previewBuyCost(address tokenAddress, uint256 amount) external view returns (uint256 cost) {
        PrivateSale memory sale = privateSales[tokenAddress];
        if (sale.isActive && block.timestamp >= sale.startTime && block.timestamp <= sale.endTime) {
            cost = (amount * sale.price) / 1e18;
        } else {
            cost = BondingCurveLib.calculateBuyCost(tokenSupplies[tokenAddress], amount);
        }
    }
    
    /**
     * @notice Preview sell proceeds for a token amount
     * @param tokenAddress Token contract address
     * @param amount Amount of tokens
     * @return proceeds Total proceeds in ETH
     */
    function previewSellProceeds(address tokenAddress, uint256 amount) external view returns (uint256 proceeds) {
        proceeds = BondingCurveLib.calculateSellProceeds(tokenSupplies[tokenAddress], amount);
    }
    
    /**
     * @notice Emergency withdrawal (admin only)
     * @param tokenAddress Token to withdraw (address(0) for ETH)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address tokenAddress, uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (tokenAddress == address(0)) {
            // Withdraw ETH
            if (amount > address(this).balance) revert InsufficientBalance();
            payable(msg.sender).transfer(amount);
        } else {
            // Withdraw tokens
            if (amount > IMintableToken(tokenAddress).balanceOf(address(this))) revert InsufficientBalance();
            IMintableToken(tokenAddress).transfer(msg.sender, amount);
        }
        
        emit EmergencyWithdrawal(tokenAddress, amount);
    }
    
    /**
     * @notice Pause contract (admin only)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause contract (admin only)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Receive ETH for token sales
     */
    receive() external payable {}
}