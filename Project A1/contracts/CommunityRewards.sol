// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VestingWalletFactory.sol";

/**
 * @title CommunityRewards
 * @dev Manages the distribution of time-locked rewards to community members.
 *      Rewards are distributed via VestingWallet instances created by a factory.
 */
contract CommunityRewards is AccessControl, ReentrancyGuard {
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
    bytes32 public constant REWARD_DEPOSITOR_ROLE = keccak256("REWARD_DEPOSITOR_ROLE");

    IERC20 public rewardToken;
    VestingWalletFactory public vestingWalletFactory;

    uint256 public totalRewardsDistributed;

    // Custom Errors
    error InsufficientFunds(uint256 required, uint256 available);
    error ZeroAmount();
    error ZeroAddressBeneficiary();
    error ZeroDuration();

    // Events
    event RewardsDeposited(address indexed depositor, uint256 amount);
    event VestedRewardsDistributed(address indexed beneficiary, uint256 amount, uint256 duration, address vestingWalletAddress);

    /**
     * @dev Constructor for the CommunityRewards contract.
     * @param _rewardTokenAddress The address of the ERC20 token used for rewards.
     * @param _vestingWalletFactoryAddress The address of the VestingWalletFactory contract.
     */
    constructor(address _rewardTokenAddress, address _vestingWalletFactoryAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REWARD_DISTRIBUTOR_ROLE, msg.sender);

        rewardToken = IERC20(_rewardTokenAddress);
        vestingWalletFactory = VestingWalletFactory(_vestingWalletFactoryAddress);
    }

    /**
     * @dev Allows authorized roles to deposit reward tokens into this contract.
     * Requirements:
     * - The caller must have approved this contract to spend the tokens.
     * - Amount must be greater than zero.
     * @param _amount The amount of tokens to deposit.
     */
    function depositRewards(uint256 _amount) external onlyRole(REWARD_DEPOSITOR_ROLE) {
        if (_amount == 0) revert ZeroAmount();

        bool success = rewardToken.transferFrom(msg.sender, address(this), _amount);
        require(success, "Token transfer failed");

        emit RewardsDeposited(msg.sender, _amount);
    }

    /**
     * @dev Allows a REWARD_DISTRIBUTOR_ROLE to create a vesting schedule for a beneficiary.
     * This will deploy a new VestingWallet via the factory and transfer tokens to it.
     * Requirements:
     * - Caller must have the REWARD_DISTRIBUTOR_ROLE.
     * - Beneficiary address cannot be zero.
     * - Amount must be greater than zero.
     * - Duration must be greater than zero.
     * - This contract must have sufficient reward tokens.
     * @param _beneficiary The address of the beneficiary.
     * @param _amount The amount of tokens to vest.
     * @param _duration The duration of the vesting schedule in seconds.
     */
    function distributeVestedRewards(address _beneficiary, uint256 _amount, uint256 _duration) external onlyRole(REWARD_DISTRIBUTOR_ROLE) nonReentrant {
        if (_beneficiary == address(0)) revert ZeroAddressBeneficiary();
        if (_amount == 0) revert ZeroAmount();
        if (_duration == 0) revert ZeroDuration();

        if (rewardToken.balanceOf(address(this)) < _amount) {
            revert InsufficientFunds({required: _amount, available: rewardToken.balanceOf(address(this))});
        }

        // Deploy a new VestingWallet via the factory
        address newVestingWallet = vestingWalletFactory.createVestingWallet(
            _beneficiary,
            uint64(block.timestamp),
            uint64(_duration)
        );

        // Transfer tokens to the newly created VestingWallet
        bool success = rewardToken.transfer(newVestingWallet, _amount);
        require(success, "Token transfer to vesting wallet failed");

        totalRewardsDistributed += _amount;

        emit VestedRewardsDistributed(_beneficiary, _amount, _duration, newVestingWallet);
    }
}
