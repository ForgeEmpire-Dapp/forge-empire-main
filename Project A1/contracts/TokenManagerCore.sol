// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenManagerCore
 * @dev Central registry for token metadata, roles, and global configuration.
 *
 * This contract serves as the single source of truth for all launched tokens in the protocol.
 * It manages token metadata, creator information, and protocol-level configuration settings.
 * 
 * Key Features:
 * - Role-based access control for secure operations
 * - Comprehensive token metadata storage and retrieval
 * - Protocol configuration management with fee settings
 * - Pausable functionality for emergency stops
 * - Enumerable token registry for efficient iteration
 * - Comprehensive validation and error handling
 *
 * Roles:
 * - DEFAULT_ADMIN_ROLE: Administrative control, can grant/revoke roles
 * - CREATOR_ROLE: Can register new tokens in the protocol
 * - VERIFIER_ROLE: Can verify off-chain data or events (future use)
 * - PAUSER_ROLE: Can pause/unpause the contract
 * - DAO_GOVERNOR_ROLE: Can update protocol configuration
 */
contract TokenManagerCore is AccessControl, Pausable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    /* ========== CONSTANTS ========== */
    
    // Maximum protocol fee (10% = 1000 basis points)
    uint16 public constant MAX_PROTOCOL_FEE = 1000;
    
    // Fee denominator for percentage calculations (10000 = 100%)
    uint16 public constant FEE_DENOMINATOR = 10000;

    /* ========== ROLES ========== */

    // Role for addresses that can register new tokens
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    
    // Role for addresses that can verify off-chain data
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    
    // Role for addresses that can pause/unpause the contract
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // Role for DAO governance that can update protocol settings
    bytes32 public constant DAO_GOVERNOR_ROLE = keccak256("DAO_GOVERNOR_ROLE");

    /* ========== STRUCTS ========== */

    /**
     * @dev Global protocol configuration structure
     * @param feeWallet Address that receives protocol fees
     * @param protocolFee Fee percentage in basis points (e.g., 100 = 1%)
     */
    struct ProtocolConfig {
        address payable feeWallet;
        uint16 protocolFee;
    }

    /**
     * @dev Metadata structure for each launched token
     * @param tokenAddress The ERC-20 token contract address
     * @param creationTimestamp Unix timestamp when token was registered
     * @param creator Address that registered the token
     * @param name Human-readable name of the token
     * @param symbol Trading symbol of the token
     * @param isActive Whether the token is currently active
     * @param totalSupply Initial/maximum supply of the token
     */
    struct TokenMetadata {
        address tokenAddress;
        address creator;
        uint64 creationTimestamp;
        bool isActive;
        string name;
        string symbol;
        uint256 totalSupply;
    }

    /* ========== STATE VARIABLES ========== */

    // Global protocol configuration
    ProtocolConfig public protocolConfig;

    // Mapping from token address to its metadata
    mapping(address => TokenMetadata) public tokenMetadata;

    // Set of all launched token addresses for enumeration
    EnumerableSet.AddressSet private _launchedTokens;
    
    // Mapping to track tokens by creator for easy lookup
    mapping(address => EnumerableSet.AddressSet) private _tokensByCreator;
    
    // Counter for total tokens ever launched
    uint256 public totalTokensLaunched;

    /* ========== EVENTS ========== */

    /**
     * @dev Emitted when a new token is registered
     * @param tokenAddress The address of the registered token
     * @param creator The address that registered the token
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param totalSupply The total supply of the token
     */
    event TokenLaunched(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply
    );

    /**
     * @dev Emitted when protocol configuration is updated
     * @param feeWallet The new fee wallet address
     * @param protocolFee The new protocol fee in basis points
     * @param updatedBy The address that made the update
     */
    event ProtocolConfigUpdated(
        address indexed feeWallet, 
        uint256 protocolFee,
        address indexed updatedBy
    );

    /**
     * @dev Emitted when a token's active status is changed
     * @param tokenAddress The address of the token
     * @param isActive The new active status
     * @param updatedBy The address that made the change
     */
    event TokenStatusUpdated(
        address indexed tokenAddress,
        bool isActive,
        address indexed updatedBy
    );

    /* ========== CUSTOM ERRORS ========== */

    // Input validation errors
    error TokenAddressCannotBeZero();
    error FeeWalletCannotBeZero();
    error EmptyTokenName();
    error EmptyTokenSymbol();
    error ZeroTotalSupply();
    
    // State validation errors
    error TokenAlreadyLaunched(address tokenAddress);
    error TokenNotLaunched(address tokenAddress);
    error ProtocolFeeExceedsMaximum(uint256 provided, uint256 maximum);
    error IndexOutOfBounds();
    
    // Access control errors
    error UnauthorizedCreator(address creator);

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Sets up the contract with initial configuration
     * @param _feeWallet The initial address for collecting protocol fees
     * @param _protocolFee The initial protocol fee in basis points
     * 
     * Requirements:
     * - Fee wallet cannot be zero address
     * - Protocol fee cannot exceed maximum allowed
     * 
     * Effects:
     * - Grants deployer all administrative roles
     * - Sets initial protocol configuration
     */
    constructor(address _feeWallet, uint256 _protocolFee) {
        // Grant all roles to deployer for initial setup
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(DAO_GOVERNOR_ROLE, msg.sender);
        _grantRole(CREATOR_ROLE, msg.sender);
        
        // Set initial protocol configuration
        _updateProtocolConfig(_feeWallet, _protocolFee);
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    /**
     * @dev Registers a new token in the protocol
     * @param _tokenAddress The address of the token contract
     * @param _name The name of the token
     * @param _symbol The symbol of the token
     * @param _totalSupply The total supply of the token
     * 
     * Requirements:
     * - Caller must have CREATOR_ROLE
     * - Contract must not be paused
     * - Token address cannot be zero
     * - Token must not already be registered
     * - Name and symbol cannot be empty
     * - Total supply must be greater than zero
     * 
     * Effects:
     * - Creates new TokenMetadata entry
     * - Adds token to enumerable sets
     * - Increments counters
     * - Emits TokenLaunched event
     */
    function launchToken(
        address _tokenAddress,
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply
    ) external onlyRole(CREATOR_ROLE) whenNotPaused nonReentrant {
        // Input validation
        if (_tokenAddress == address(0)) revert TokenAddressCannotBeZero();
        if (bytes(_name).length == 0) revert EmptyTokenName();
        if (bytes(_symbol).length == 0) revert EmptyTokenSymbol();
        if (_totalSupply == 0) revert ZeroTotalSupply();
        
        // Check if token already exists
        if (_launchedTokens.contains(_tokenAddress)) {
            revert TokenAlreadyLaunched(_tokenAddress);
        }

        // Create token metadata
        tokenMetadata[_tokenAddress] = TokenMetadata({
            tokenAddress: _tokenAddress,
            creator: msg.sender,
            creationTimestamp: uint64(block.timestamp),
            isActive: true, // New tokens are active by default
            name: _name,
            symbol: _symbol,
            totalSupply: _totalSupply
        });

        // Add to enumerable sets
        _launchedTokens.add(_tokenAddress);
        _tokensByCreator[msg.sender].add(_tokenAddress);
        
        // Update counter
        totalTokensLaunched++;

        // Emit event
        emit TokenLaunched(_tokenAddress, msg.sender, _name, _symbol, _totalSupply);
    }

    /**
     * @dev Updates the active status of a token
     * @param _tokenAddress The address of the token
     * @param _isActive The new active status
     * 
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     * - Token must be registered
     * 
     * Effects:
     * - Updates token's active status
     * - Emits TokenStatusUpdated event
     */
    function updateTokenStatus(
        address _tokenAddress,
        bool _isActive
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        if (!_launchedTokens.contains(_tokenAddress)) {
            revert TokenNotLaunched(_tokenAddress);
        }

        if (tokenMetadata[_tokenAddress].isActive == _isActive) {
            return; // Avoid redundant state changes and event emissions
        }

        tokenMetadata[_tokenAddress].isActive = _isActive;
        emit TokenStatusUpdated(_tokenAddress, _isActive, msg.sender);
    }

    /**
     * @dev Updates the protocol configuration
     * @param _feeWallet The new address for the fee wallet
     * @param _protocolFee The new protocol fee in basis points
     * 
     * Requirements:
     * - Caller must have DAO_GOVERNOR_ROLE
     * - Contract must not be paused
     * - Fee wallet cannot be zero address
     * - Protocol fee cannot exceed maximum
     * 
     * Effects:
     * - Updates protocol configuration
     * - Emits ProtocolConfigUpdated event
     */
    function updateProtocolConfig(
        address _feeWallet,
        uint256 _protocolFee
    ) external onlyRole(DAO_GOVERNOR_ROLE) whenNotPaused nonReentrant {
        _updateProtocolConfig(_feeWallet, _protocolFee);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * @dev Returns the total number of launched tokens
     * @return uint256 The count of registered tokens
     */
    function launchedTokensCount() external view returns (uint256) {
        return _launchedTokens.length();
    }

    /**
     * @dev Returns a token address at a specific index
     * @param _index The index in the launched tokens array
     * @return address The token address at the given index
     * 
     * Requirements:
     * - Index must be less than total count
     */
    function getTokenAtIndex(uint256 _index) external view returns (address) {
        if (_index >= _launchedTokens.length()) revert IndexOutOfBounds();
        return _launchedTokens.at(_index);
    }

    /**
     * @dev Checks if a token has been registered
     * @param _tokenAddress The address of the token to check
     * @return bool True if token is registered, false otherwise
     */
    function isTokenLaunched(address _tokenAddress) external view returns (bool) {
        return _launchedTokens.contains(_tokenAddress);
    }

    /**
     * @dev Returns the number of tokens created by a specific address
     * @param _creator The creator address to query
     * @return uint256 The number of tokens created by the address
     */
    function getTokenCountByCreator(address _creator) external view returns (uint256) {
        return _tokensByCreator[_creator].length();
    }

    /**
     * @dev Returns a token address created by a specific creator at an index
     * @param _creator The creator address
     * @param _index The index in the creator's token array
     * @return address The token address
     */
    function getTokenByCreatorAtIndex(
        address _creator, 
        uint256 _index
    ) external view returns (address) {
        if (_index >= _tokensByCreator[_creator].length()) revert IndexOutOfBounds();
        return _tokensByCreator[_creator].at(_index);
    }

    /**
     * @dev Returns all token addresses created by a specific creator
     * @param _creator The creator address
     * @return address[] Array of token addresses
     */
    function getTokensByCreator(address _creator) external view returns (address[] memory) {
        return _tokensByCreator[_creator].values();
    }

    /**
     * @dev Returns complete metadata for a token
     * @param _tokenAddress The token address to query
     * @return TokenMetadata The complete token metadata
     */
    function getTokenMetadata(address _tokenAddress) external view returns (TokenMetadata memory) {
        if (!_launchedTokens.contains(_tokenAddress)) {
            revert TokenNotLaunched(_tokenAddress);
        }
        return tokenMetadata[_tokenAddress];
    }

    /**
     * @dev Returns all registered token addresses
     * @return address[] Array of all token addresses
     */
    function getAllTokens() external view returns (address[] memory) {
        return _launchedTokens.values();
    }

    /**
     * @dev Returns protocol configuration
     * @return feeWallet The current fee wallet address
     * @return protocolFee The current protocol fee in basis points
     */
    function getProtocolConfig() external view returns (address feeWallet, uint16 protocolFee) {
        return (protocolConfig.feeWallet, protocolConfig.protocolFee);
    }

    /* ========== ADMIN FUNCTIONS ========== */

    /**
     * @dev Pauses all contract operations
     * 
     * Requirements:
     * - Caller must have PAUSER_ROLE
     * 
     * Effects:
     * - Pauses the contract using OpenZeppelin's Pausable
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all contract operations
     * 
     * Requirements:
     * - Caller must have PAUSER_ROLE
     * 
     * Effects:
     * - Unpauses the contract using OpenZeppelin's Pausable
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @dev Internal function to update protocol configuration
     * @param _feeWallet The new fee wallet address
     * @param _protocolFee The new protocol fee in basis points
     * 
     * Requirements:
     * - Fee wallet cannot be zero address
     * - Protocol fee cannot exceed maximum
     * 
     * Effects:
     * - Updates protocolConfig struct
     * - Emits ProtocolConfigUpdated event
     */
    function _updateProtocolConfig(address _feeWallet, uint256 _protocolFee) internal {
        // Validate inputs
        if (_feeWallet == address(0)) revert FeeWalletCannotBeZero();
        if (_protocolFee > MAX_PROTOCOL_FEE) {
            revert ProtocolFeeExceedsMaximum(_protocolFee, MAX_PROTOCOL_FEE);
        }

        // Update configuration
        protocolConfig = ProtocolConfig({
            feeWallet: payable(_feeWallet),
            protocolFee: uint16(_protocolFee)
        });

        // Emit event
        emit ProtocolConfigUpdated(_feeWallet, _protocolFee, msg.sender);
    }
}