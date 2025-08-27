// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "hardhat/console.sol";

/**
 * @title TipJar
 * @dev A contract that allows users to deposit ERC20 tokens and tip other users.
 */
contract TipJar is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    IERC20 public erc20Token;

    // Mapping from user address to their deposited balance in the TipJar
    mapping(address => uint256) public depositedBalances;

    // Mapping from user address to total tips they have received
    mapping(address => uint256) public tipsReceived;

    // Custom Errors
    error InsufficientBalance(uint256 required, uint256 available);
    error ZeroAmount();
    error CannotTipSelf();
    error InvalidERC20Address();

    // Events
    event Deposited(address indexed user, uint256 amount);
    event Tipped(address indexed tipper, address indexed recipient, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
    }

    /**
     * @dev Initialize the TipJar.
     * @param _erc20TokenAddress The address of the ERC20 token to be used for tipping.
     */
        function initialize(address _erc20TokenAddress) public initializer {
        console.log("Initializing TipJar with token address:", _erc20TokenAddress);
        if (_erc20TokenAddress == address(0)) revert InvalidERC20Address();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        erc20Token = IERC20(_erc20TokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    /**
     * @dev Allows users to deposit ERC20 tokens into the TipJar.
     * Requires prior approval of the TipJar contract to spend the tokens.
     * @param _amount The amount of tokens to deposit.
     */
    function deposit(uint256 _amount) external nonReentrant whenNotPaused {
        if (_amount == 0) revert ZeroAmount();
        
        // Transfer tokens from the user to the TipJar contract
        bool success = erc20Token.transferFrom(msg.sender, address(this), _amount);
        require(success, "Token transfer failed");

        depositedBalances[msg.sender] += _amount;
        emit Deposited(msg.sender, _amount);
    }

    /**
     * @dev Allows a user to send a tip to another user from their deposited balance.
     * @param _recipient The address of the user to tip.
     * @param _amount The amount of tokens to tip.
     */
    function tip(address _recipient, uint256 _amount) external nonReentrant whenNotPaused {
        if (_amount == 0) revert ZeroAmount();
        if (_recipient == msg.sender) revert CannotTipSelf();
        if (depositedBalances[msg.sender] < _amount) revert InsufficientBalance({required: _amount, available: depositedBalances[msg.sender]});

        depositedBalances[msg.sender] -= _amount;
        tipsReceived[_recipient] += _amount;

        emit Tipped(msg.sender, _recipient, _amount);
    }

    /**
     * @dev Allows a user to withdraw their deposited tokens from the TipJar.
     * @param _amount The amount of tokens to withdraw.
     */
    function withdraw(uint256 _amount) external nonReentrant whenNotPaused {
        if (_amount == 0) revert ZeroAmount();
        if (depositedBalances[msg.sender] < _amount) revert InsufficientBalance({required: _amount, available: depositedBalances[msg.sender]});

        depositedBalances[msg.sender] -= _amount;
        
        // Transfer tokens from the TipJar contract back to the user
        bool success = erc20Token.transfer(msg.sender, _amount);
        require(success, "Token transfer failed");

        emit Withdrawn(msg.sender, _amount);
    }

    /**
     * @dev Returns a user's deposited balance in the TipJar.
     * @param _user The address of the user.
     * @return The deposited balance.
     */
    function getDepositedBalance(address _user) external view returns (uint256) {
        return depositedBalances[_user];
    }

    /**
     * @dev Returns the total tips received by a user.
     * @param _user The address of the user.
     * @return The total tips received.
     */
    function getTipsReceived(address _user) external view returns (uint256) {
        return tipsReceived[_user];
    }

    /**
     * @dev Pauses the contract.
     * Only accounts with the PAUSER_ROLE can call this.
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses the contract.
     * Only accounts with the PAUSER_ROLE can call this.
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
