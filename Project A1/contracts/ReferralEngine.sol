
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title ReferralEngine
 * @dev Tracks and rewards referrals for trades and launches.
 *
 * This contract is responsible for managing the referral system of the protocol.
 * It allows users to earn rewards by referring others to use the platform.
 * The referral data is stored on-chain, ensuring transparency and immutability.
 *
 * The contract is designed to be called by other core contracts, such as the
 * TokenLauncher, to handle referral logic in a modular and decoupled manner.
 */
contract ReferralEngine is AccessControl, Pausable, ReentrancyGuard {
    using Address for address payable;
    
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant REWARDER_ROLE = keccak256("REWARDER_ROLE");
    

    /* ========== STATE VARIABLES ========== */

    // Mapping from a user to their referrer
    mapping(address => address) public referrers;

    // Mapping from a referrer to the list of their referred users
    // mapping(address => address[]) public referredUsers;

    // Mapping from a referrer to their total referral rewards
    mapping(address => uint256) public referralRewards;
    
    // Emergency withdrawal mapping for failed transfers
    mapping(address => uint256) public failedTransfers;
    
    // Maximum reward per claim to prevent large withdrawals
    uint256 public constant MAX_REWARD_PER_CLAIM = 10 ether;

    // Custom Errors
    error CannotReferYourself();
    error UserAlreadyHasReferrer();
    error ZeroAddressReferrer();
    error ZeroAmountReward();
    error InsufficientReward();
    error TransferFailed();
    error RewardExceedsMaximum(uint256 amount, uint256 maximum);
    error InsufficientContractBalance(uint256 required, uint256 available);

    /* ========== EVENTS ========== */

    event Referred(
        address indexed user,
        address indexed referrer
    );

    event RewardPaid(
        address indexed referrer,
        uint256 amount
    );

    event RewardClaimed(
        address indexed referrer,
        uint256 amount
    );
    
    event TransferFailedEvent(
        address indexed recipient,
        uint256 amount
    );
    
    event FailedTransferRecovered(
        address indexed recipient,
        uint256 amount
    );

    /* ========== CONSTRUCTOR ========== */

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    function registerReferral(address _user, address _referrer) external whenNotPaused onlyRole(REGISTRAR_ROLE) {
        if (_user == _referrer) revert CannotReferYourself();
        if (referrers[_user] != address(0)) revert UserAlreadyHasReferrer();
        if (_referrer == address(0)) revert ZeroAddressReferrer();

        referrers[_user] = _referrer;
        // referredUsers[_referrer].push(_user);

        emit Referred(_user, _referrer);
    }

    function payReward(address _referrer, uint256 _amount) external onlyRole(REWARDER_ROLE) whenNotPaused {
        if (_amount == 0) revert ZeroAmountReward();

        referralRewards[_referrer] += _amount;

        emit RewardPaid(_referrer, _amount);
    }

    function claimReward() external whenNotPaused nonReentrant {
        uint256 totalAvailable = referralRewards[msg.sender] + failedTransfers[msg.sender];
        if (totalAvailable == 0) revert InsufficientReward();
        
        // Limit claim amount to prevent large withdrawals
        uint256 claimAmount = totalAvailable > MAX_REWARD_PER_CLAIM ? MAX_REWARD_PER_CLAIM : totalAvailable;
        
        // Check contract has sufficient balance
        if (address(this).balance < claimAmount) {
            revert InsufficientContractBalance(claimAmount, address(this).balance);
        }
        
        // Clear claimed amount from user's balance (CEI pattern)
        uint256 fromFailed = 0;
        if (failedTransfers[msg.sender] > 0) {
            fromFailed = failedTransfers[msg.sender] >= claimAmount ? claimAmount : failedTransfers[msg.sender];
            failedTransfers[msg.sender] -= fromFailed;
        }

        if (claimAmount > fromFailed) {
            referralRewards[msg.sender] -= (claimAmount - fromFailed);
        }
        
        // Safe transfer with fallback mechanism
        (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
        if (success) {
            emit RewardClaimed(msg.sender, claimAmount);
        } else {
            // If transfer fails, add back to failed transfers for later recovery
            failedTransfers[msg.sender] += claimAmount;
            emit TransferFailedEvent(msg.sender, claimAmount);
            revert TransferFailed();
        }
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /* ========== VIEW FUNCTIONS ========== */

    function getReferrer(address _user) external view returns (address) {
        return referrers[_user];
    }
    
    /**
     * @dev Get total available rewards for a user (including failed transfers)
     */
    function getTotalAvailableRewards(address _user) external view returns (uint256) {
        return referralRewards[_user] + failedTransfers[_user];
    }
    
    /**
     * @dev Get failed transfer amount for a user
     */
    function getFailedTransfers(address _user) external view returns (uint256) {
        return failedTransfers[_user];
    }

    /* ========== ADMIN FUNCTIONS ========== */
    
    /**
     * @dev Emergency function to recover failed transfers for a user
     * @param _user The user to recover transfers for
     */
    function recoverFailedTransfer(address _user) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 amount = failedTransfers[_user];
        if (amount == 0) revert InsufficientReward();
        
        if (address(this).balance < amount) {
            revert InsufficientContractBalance(amount, address(this).balance);
        }
        
        failedTransfers[_user] = 0;
        
        // Use admin as intermediary for recovery
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit FailedTransferRecovered(_user, amount);
    }
    
    /**
     * @dev Emergency withdrawal function for admin
     */
    function emergencyWithdraw(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_amount > address(this).balance) {
            revert InsufficientContractBalance(_amount, address(this).balance);
        }
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        if (!success) revert TransferFailed();
    }

    // Fallback function to receive Ether
    receive() external payable {}
}
