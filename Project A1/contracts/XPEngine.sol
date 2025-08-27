
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title XPEngine
 * @dev Manages the Experience Points (XP) system for the protocol.
 *
 * This contract is responsible for tracking and awarding XP to users for performing
 * specific actions within the ecosystem, such as trading, referring others, or
 * completing quests. XP is a non-transferable metric to measure user
 * engagement and unlock rewards.
 *
 * The contract uses AccessControl to ensure that only authorized contracts or
 * addresses (e.g., a game master or quest contract) can award XP.
 */
contract XPEngine is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    /* ========== ROLES ========== */

    bytes32 public constant XP_AWARDER_ROLE = keccak256("XP_AWARDER_ROLE");
    bytes32 public constant XP_GRANTER_ROLE = keccak256("XP_GRANTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /* ========== STATE VARIABLES ========== */

    // Mapping from user address to their XP balance
    mapping(address => uint256) public userXP;

    // Total XP awarded across the entire protocol
    uint256 public totalXPAwarded;

    /* ========== EVENTS ========== */

    event XPAwarded(address indexed user, uint256 amount, address indexed awarder);
    event XPSpent(address indexed user, uint256 amount);

    // Custom Errors
    error ZeroAddressUser();
    error ZeroXPAmount();
    error InsufficientXP(uint256 currentXP, uint256 requestedXP);
    error ArrayLengthMismatch();
    error BatchSizeExceeded(uint256 maxAllowed, uint256 current);
    error EmptyArrays();

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable MAX_BATCH_SIZE = 100;

    /* ========== CONSTRUCTOR ========== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(XP_AWARDER_ROLE, msg.sender);
        _grantRole(XP_GRANTER_ROLE, msg.sender);
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    /**
     * @dev Awards a specified amount of XP to a user.
     *
     * Requirements:
     * - The caller must have the `XP_GRANTER_ROLE`.
     *
     * Emits an {XPAwarded} event.
     *
     * @param _user The address of the user to receive XP.
     * @param _amount The amount of XP to award.
     */
    function awardXP(address _user, uint256 _amount) external onlyRole(XP_AWARDER_ROLE) whenNotPaused {
        if (_user == address(0)) revert ZeroAddressUser();
        if (_amount == 0) revert ZeroXPAmount();

        userXP[_user] += _amount;
        totalXPAwarded += _amount;

        emit XPAwarded(_user, _amount, msg.sender);
    }

    /**
     * @dev Awards XP to multiple users in a single transaction.
     *
     * This function is useful for batch-processing rewards, such as for quest
     * completions or seasonal leaderboards.
     *
     * Requirements:
     * - The caller must have the `XP_GRANTER_ROLE`.
     * - The `_users` and `_amounts` arrays must have the same length.
     *
     * @param _users An array of user addresses to receive XP.
     * @param _amounts An array of XP amounts to award.
     */
    function awardXpBatch(address[] calldata _users, uint256[] calldata _amounts) external onlyRole(XP_GRANTER_ROLE) whenNotPaused {
        if (_users.length == 0) revert EmptyArrays();
        if (_users.length > MAX_BATCH_SIZE) revert BatchSizeExceeded(MAX_BATCH_SIZE, _users.length);
        if (_users.length != _amounts.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < _users.length; i++) {
            if (_users[i] == address(0)) revert ZeroAddressUser();
            if (_amounts[i] == 0) revert ZeroXPAmount();

            userXP[_users[i]] += _amounts[i];
            totalXPAwarded += _amounts[i];
            emit XPAwarded(_users[i], _amounts[i], msg.sender);
        }
    }

    /**
     * @dev Allows a user to spend their accumulated XP.
     *
     * Requirements:
     * - The contract must not be paused.
     * - The amount of XP to spend must be greater than 0.
     * - The caller must have sufficient XP.
     *
     * Emits an {XPSpent} event.
     *
     * @param _amount The amount of XP to spend.
     */
    function spendXP(uint256 _amount) external whenNotPaused nonReentrant {
        if (_amount == 0) revert ZeroXPAmount();
        if (userXP[msg.sender] < _amount) revert InsufficientXP(userXP[msg.sender], _amount);

        userXP[msg.sender] -= _amount;

        emit XPSpent(msg.sender, _amount);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * @dev Returns the XP balance of a specific user.
     * @param _user The address of the user.
     */
    function getXP(address _user) external view returns (uint256) {
        return userXP[_user];
    }

    /**
     * @dev Calculate user level based on XP using simple square root formula
     * @param _user Address of the user
     * @return Current level of the user
     */
    function getLevel(address _user) external view returns (uint256) {
        uint256 xp = userXP[_user];
        
        // Optimized O(1) level calculation using square root algorithm
        // This prevents DoS attacks with high XP values
        if (xp == 0) return 1;
        
        // Use Newton's method for square root: level = sqrt(xp/1000) + 1
        uint256 level = 1 + _sqrt(xp / 1000);
        
        // Cap at level 100
        return level > 100 ? 100 : level;
    }
    
    /**
     * @dev Internal square root function using Newton's method
     * @param x The number to calculate square root for
     * @return The square root of x
     */
    function _sqrt(uint256 x) private pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @dev Pauses all token transfers.
     *
     * See {Pausable-pause}.
     *
     * Requirements:
     *
     * - the caller must have the `DEFAULT_ADMIN_ROLE`.
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     *
     * See {Pausable-unpause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Authorizes an upgrade to a new implementation contract.
     *
     * This function is required for UUPS upgradeability.
     * Only accounts with the `UPGRADER_ROLE` can authorize an upgrade.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
