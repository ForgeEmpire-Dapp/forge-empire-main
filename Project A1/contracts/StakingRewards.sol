// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ForgePass.sol";

interface IBadgeMinter {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title StakingRewards
 * @dev A contract for staking ERC20 tokens and earning rewards.
 *      Rewards are distributed based on the amount staked and the duration of staking.
 */
contract StakingRewards is AccessControl, ReentrancyGuard, Pausable, UUPSUpgradeable{
    using SafeERC20 for IERC20;
    IERC20 public stakingToken;
    IERC20 public rewardsToken;
    ForgePass public forgePass; // ForgePass contract for reward bonus
    IBadgeMinter public badgeMinter; // BadgeMinter contract for booster badge

    uint256 public totalStaked; // Total amount of stakingToken staked in this contract

    // Reward calculation variables
    uint256 public rewardsPerSecond; // Rate at which rewards are generated per second
    uint256 public lastUpdateTime;   // Last time rewards were calculated
    uint256 public rewardPerTokenStored; // Accumulated rewards per token staked
    uint256 public constant BONUS_MULTIPLIER = 110; // 10% bonus
    uint256 public boosterBadgeId; // ID of the badge that gives a staking boost
    
    // Security and validation constants
    uint256 public constant MAX_REWARD_RATE = 1000 * 1e18; // Maximum 1000 tokens per second
    uint256 public constant MIN_REWARD_DURATION = 1 days; // Minimum funding duration required
    uint256 public constant MAX_REWARD_MULTIPLIER = 200; // Maximum 2x multiplier (100% bonus)
    uint256 public lastRateChangeTime; // Track when rate was last changed
    uint256 public constant RATE_CHANGE_COOLDOWN = 1 hours; // Minimum time between rate changes

    // User-specific data
    mapping(address => uint256) public stakedBalances; // Amount staked by each user
    mapping(address => uint256) public userRewardPerTokenPaid; // User's last recorded rewardPerTokenStored
    mapping(address => uint256) public rewards; // User's pending rewards

    

    // Custom Errors
    error ZeroAmount();
    error InsufficientStakedAmount(uint256 required, uint256 available);
    error NoRewardsToClaim();
    error InvalidRewardRate();
    error InsufficientRewardBalance(uint256 required, uint256 available);
    error RewardTransferFailed();
    error RewardRateExceedsMaximum(uint256 rate, uint256 maximum);
    error InsufficientFundingDuration(uint256 available, uint256 required);
    error RateChangeCooldownActive(uint256 timeRemaining);
    error InvalidMultiplier(uint256 multiplier, uint256 maximum);

    // Events
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    event ForgePassAddressUpdated(address indexed forgePassAddress);
    event EmergencyPause();
    event EmergencyUnpause();
    event RewardTokensDeposited(uint256 amount);
    event RewardTokensWithdrawn(uint256 amount);

    /**
     * @dev Constructor for the StakingRewards contract.
     * @param _stakingTokenAddress The address of the ERC20 token to be staked.
     * @param _rewardsTokenAddress The address of the ForgeToken contract used for rewards.
     */
    constructor(address _stakingTokenAddress, address _rewardsTokenAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        stakingToken = IERC20(_stakingTokenAddress);
        rewardsToken = IERC20(_rewardsTokenAddress);
        lastUpdateTime = block.timestamp;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /* ========== EMERGENCY FUNCTIONS ========== */

    /**
     * @dev Emergency pause function - stops all operations
     * Only callable by admin in emergency situations
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPause();
    }

    /**
     * @dev Unpause contract operations
     * Only callable by admin
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpause();
    }

    /**
     * @dev Allows admin to deposit reward tokens into the contract
     * @param _amount Amount of reward tokens to deposit
     */
    function depositRewardTokens(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_amount == 0) revert ZeroAmount();
        rewardsToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit RewardTokensDeposited(_amount);
    }

    /**
     * @dev Emergency withdrawal of reward tokens (only for excess amounts)
     * @param _amount Amount to withdraw
     */
    function emergencyWithdrawRewardTokens(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_amount == 0) revert ZeroAmount();
        uint256 contractBalance = rewardsToken.balanceOf(address(this));
        if (_amount > contractBalance) revert InsufficientRewardBalance({required: _amount, available: contractBalance});
        
        rewardsToken.safeTransfer(msg.sender, _amount);
        emit RewardTokensWithdrawn(_amount);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address _account) {
        rewardPerTokenStored = _getRewardPerToken();
        lastUpdateTime = block.timestamp;
        if (_account != address(0)) {
            rewards[_account] += (stakedBalances[_account] * (rewardPerTokenStored - userRewardPerTokenPaid[_account])) / 1e18; // 1e18 for precision
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }
        _;
    }

    

    /* ========== EXTERNAL FUNCTIONS ========== */

    /**
     * @dev Sets the ForgePass contract address.
     * Only callable by the owner.
     * @param _forgePassAddress The address of the ForgePass contract.
     */
    function setForgePassAddress(address _forgePassAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        forgePass = ForgePass(_forgePassAddress);
        emit ForgePassAddressUpdated(_forgePassAddress);
    }

    /**
     * @dev Sets the BadgeMinter contract address.
     * Only callable by the owner.
     * @param _badgeMinterAddress The address of the BadgeMinter contract.
     */
    function setBadgeMinterAddress(address _badgeMinterAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        badgeMinter = IBadgeMinter(_badgeMinterAddress);
    }

    /**
     * @dev Sets the ID of the booster badge.
     * Only callable by the owner.
     * @param _boosterBadgeId The ID of the badge that gives a staking boost.
     */
    function setBoosterBadgeId(uint256 _boosterBadgeId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        boosterBadgeId = _boosterBadgeId;
    }

    /**
     * @dev Allows users to stake tokens.
     * @param _amount The amount of tokens to stake.
     */
    function stake(uint256 _amount) external updateReward(msg.sender) nonReentrant whenNotPaused {
        if (_amount == 0) revert ZeroAmount();

        // Transfer tokens from user to this contract using SafeERC20
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        stakedBalances[msg.sender] += _amount;
        totalStaked += _amount;

        emit Staked(msg.sender, _amount);
    }

    /**
     * @dev Allows users to unstake tokens.
     * @param _amount The amount of tokens to unstake.
     */
    function unstake(uint256 _amount) external updateReward(msg.sender) nonReentrant whenNotPaused {
        if (_amount == 0) revert ZeroAmount();
        if (stakedBalances[msg.sender] < _amount) revert InsufficientStakedAmount({required: _amount, available: stakedBalances[msg.sender]});

        stakedBalances[msg.sender] -= _amount;
        totalStaked -= _amount;

        // Transfer tokens from this contract back to user using SafeERC20
        stakingToken.safeTransfer(msg.sender, _amount);

        emit Unstaked(msg.sender, _amount);
    }

    /**
     * @dev Allows users to claim their accumulated rewards.
     */
    function claimRewards() external updateReward(msg.sender) nonReentrant whenNotPaused {
        uint256 totalClaimableRewards = getRewardAmount(msg.sender); // Get the total rewards including bonuses
        if (totalClaimableRewards == 0) revert NoRewardsToClaim();

        // Critical: Check if contract has sufficient balance before transfer
        uint256 contractRewardBalance = rewardsToken.balanceOf(address(this));
        if (contractRewardBalance < totalClaimableRewards) {
            revert InsufficientRewardBalance({required: totalClaimableRewards, available: contractRewardBalance});
        }

        // Clear pending rewards for the current user before transfer (CEI pattern)
        rewards[msg.sender] = 0;

        // Transfer rewards to user using SafeERC20
        rewardsToken.safeTransfer(msg.sender, totalClaimableRewards);

        emit RewardsClaimed(msg.sender, totalClaimableRewards);
    }

    /**
     * @dev Sets the rewards distribution rate.
     * Only callable by the owner.
     * @param _rewardsPerSecond The new rewards distribution rate per second.
     */
    function setRewardsPerSecond(uint256 _rewardsPerSecond) external onlyRole(DEFAULT_ADMIN_ROLE) updateReward(address(0)) {
        if (_rewardsPerSecond == 0) revert InvalidRewardRate();
        if (_rewardsPerSecond > MAX_REWARD_RATE) {
            revert RewardRateExceedsMaximum(_rewardsPerSecond, MAX_REWARD_RATE);
        }
        
        // Enforce cooldown between rate changes to prevent manipulation
        if (lastRateChangeTime != 0 && block.timestamp < lastRateChangeTime + RATE_CHANGE_COOLDOWN) {
            uint256 timeRemaining = (lastRateChangeTime + RATE_CHANGE_COOLDOWN) - block.timestamp;
            revert RateChangeCooldownActive(timeRemaining);
        }
        
        // Verify sufficient funding for minimum duration
        uint256 contractBalance = rewardsToken.balanceOf(address(this));
        uint256 minimumRequiredBalance = _rewardsPerSecond * MIN_REWARD_DURATION;
        if (contractBalance < minimumRequiredBalance) {
            revert InsufficientFundingDuration(contractBalance, minimumRequiredBalance);
        }
        
        lastRateChangeTime = block.timestamp;
        rewardsPerSecond = _rewardsPerSecond;
        emit RewardRateUpdated(_rewardsPerSecond);
    }

    /**
     * @dev Calculates the pending rewards for a user.
     * @param _account The address of the user.
     * @return The amount of pending rewards.
     */
    function getRewardAmount(address _account) public view returns (uint256) {
        uint256 currentRewardPerToken = _getRewardPerToken();
        uint256 earned = (stakedBalances[_account] * (currentRewardPerToken - userRewardPerTokenPaid[_account])) / 1e18;
        uint256 totalRewards = rewards[_account] + earned;

        // Apply ForgePass bonus with validation
        if (address(forgePass) != address(0) && forgePass.balanceOf(_account) > 0) {
            if (BONUS_MULTIPLIER <= MAX_REWARD_MULTIPLIER) {
                totalRewards = (totalRewards * BONUS_MULTIPLIER) / 100;
            }
        }

        // Apply booster badge bonus with validation
        if (address(badgeMinter) != address(0) && boosterBadgeId != 0) {
            try badgeMinter.ownerOf(boosterBadgeId) returns (address owner) {
                if (owner == _account) {
                    uint256 boostMultiplier = 110; // 10% boost
                    if (boostMultiplier <= MAX_REWARD_MULTIPLIER) {
                        totalRewards = (totalRewards * boostMultiplier) / 100;
                    }
                }
            } catch {
                // Handle case where badgeId does not exist or ownerOf fails
                // No boost applied if badge does not exist or cannot be queried
            }
        }
        return totalRewards;
    }

    /**
     * @dev Returns the current reward token balance of the contract
     * @return The balance of reward tokens available for distribution
     */
    function getRewardTokenBalance() external view returns (uint256) {
        return rewardsToken.balanceOf(address(this));
    }

    /**
     * @dev Calculates estimated days of rewards remaining at current rate
     * @return Number of days of rewards remaining (scaled by 1e18 for precision)
     */
    function getRewardDaysRemaining() external view returns (uint256) {
        uint256 contractBalance = rewardsToken.balanceOf(address(this));
        if (contractBalance == 0 || rewardsPerSecond == 0) {
            return 0;
        }
        
        uint256 dailyRewardCost = rewardsPerSecond * 86400; // 24 hours
        if (dailyRewardCost == 0) return 0;
        
        return (contractBalance * 1e18) / dailyRewardCost; // Returns days with precision
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @dev Calculates the accumulated rewards per token staked.
     * @return The accumulated rewards per token.
     */
    function _getRewardPerToken() internal view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + ((block.timestamp - lastUpdateTime) * rewardsPerSecond * 1e18) / totalStaked;
    }
}