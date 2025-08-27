// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title IXPEngine
 * @dev Interface for the XP (Experience Points) Engine contract
 */
interface IXPEngine {
    /**
     * @dev Returns the XP balance for a given user
     * @param user The address to query XP for
     * @return The XP balance of the user
     */
    function getXP(address user) external view returns (uint256);
}

/**
 * @title BadgeMinter
 * @dev ERC721 contract for minting achievement badges with XP requirements
 * @notice This contract allows authorized minters to create badges for users
 * @notice Badges can have XP requirements that must be met before minting
 * @author Avax Forge Empire Team
 */
contract BadgeMinter is Initializable, ERC721URIStorageUpgradeable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    /// @dev Role identifier for addresses authorized to mint badges
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    /// @dev Role identifier for addresses authorized to pause/unpause the contract
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @dev Role identifier for addresses authorized to upgrade the contract
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice The XP Engine contract used to verify user XP balances
    IXPEngine public xpEngine;

    /// @notice Mapping from badge ID to required XP amount for minting
    mapping(uint256 => uint256) public badgeXpRequirements;
    
    /// @dev Counter for the next token ID to be minted
    uint256 private _nextTokenId;

    /// @notice Maximum number of badges that can be minted in a single batch transaction
    uint256 public constant MAX_BATCH_SIZE = 100;

    /**
     * @dev Emitted when badges are minted in batch
     * @param recipients Array of addresses that received badges
     * @param tokenIds Array of token IDs that were minted
     */
    event BatchBadgesMinted(address[] indexed recipients, uint256[] tokenIds);

    /// @dev Thrown when trying to mint to the zero address
    error ZeroAddressRecipient();
    
    /// @dev Thrown when providing empty arrays to batch functions
    error EmptyArrays();
    
    /// @dev Thrown when array parameters have mismatched lengths
    error ArrayLengthMismatch();
    
    /// @dev Thrown when batch size exceeds the maximum allowed
    error BatchSizeExceeded(uint256 maxAllowed, uint256 current);
    
    /// @dev Thrown when user doesn't have sufficient XP to mint a badge
    error InsufficientXP(uint256 required, uint256 available);
    
    /// @dev Thrown when trying to set invalid XP requirements
    error InvalidXPRequirement();
    
    /// @dev Thrown when XP engine address is invalid
    error InvalidXPEngine();

    /**
     * @notice Initializes the BadgeMinter contract
     * @dev This function replaces the constructor for upgradeable contracts
     * @param _xpEngineAddress Address of the XP Engine contract
     */
    function initialize(address _xpEngineAddress) public initializer {
        // Security: Validate critical parameters
        if (_xpEngineAddress == address(0)) revert ZeroAddressRecipient();
        
        __ERC721_init("Forge Badge", "BADGE");
        __ERC721URIStorage_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        xpEngine = IXPEngine(_xpEngineAddress);
        _nextTokenId = 1;
    }

    /**
     * @notice Mints a new badge to the specified address
     * @dev Only addresses with MINTER_ROLE can call this function
     * @param _to Address to receive the badge
     * @param _tokenURI Metadata URI for the badge
     * @return tokenId The ID of the newly minted badge
     */
    function mintBadge(address _to, string calldata _tokenURI)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        if (_to == address(0)) revert ZeroAddressRecipient();

        // Cache token ID read for gas optimization
        uint256 tokenId = _nextTokenId;
        _nextTokenId = tokenId + 1;
        
        _mint(_to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        return tokenId;
    }

    /**
     * @notice Mints a badge with XP requirements
     * @dev Checks if the recipient has sufficient XP before minting
     * @param _to Address to receive the badge
     * @param _badgeId ID of the badge type (used to check XP requirements)
     * @param _tokenURI Metadata URI for the badge
     * @return tokenId The ID of the newly minted badge
     */
    function mintBadgeWithRequirements(address _to, uint256 _badgeId, string calldata _tokenURI)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        if (_to == address(0)) revert ZeroAddressRecipient();
        
        // Additional validation: Ensure XP engine is set
        if (address(xpEngine) == address(0)) revert InvalidXPEngine();

        // Cache storage read for gas optimization
        uint256 requiredXp = badgeXpRequirements[_badgeId];
        if (requiredXp > 0) {
            uint256 userXp = xpEngine.getXP(_to);
            if (userXp < requiredXp) {
                revert InsufficientXP(requiredXp, userXp);
            }
        }

        // Cache token ID read for gas optimization
        uint256 tokenId = _nextTokenId;
        _nextTokenId = tokenId + 1;
        
        _mint(_to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        return tokenId;
    }

    /**
     * @notice Mints multiple badges in a single transaction
     * @dev Arrays must have the same length and not exceed MAX_BATCH_SIZE
     * @param _recipients Array of addresses to receive badges
     * @param _tokenURIs Array of metadata URIs for the badges
     */
    function batchMintBadge(address[] calldata _recipients, string[] calldata _tokenURIs)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        uint256 count = _recipients.length;

        if (count == 0) revert EmptyArrays();
        if (count > MAX_BATCH_SIZE) revert BatchSizeExceeded(MAX_BATCH_SIZE, count);
        if (count != _tokenURIs.length) revert ArrayLengthMismatch();

        // Cache storage read for gas optimization
        uint256 currentTokenId = _nextTokenId;
        uint256[] memory mintedTokenIds = new uint256[](count);

        // Optimized loop with minimal storage access
        for (uint256 i; i < count;) {
            address recipient = _recipients[i];
            if (recipient == address(0)) revert ZeroAddressRecipient();

            uint256 tokenId = currentTokenId + i;
            _mint(recipient, tokenId);
            _setTokenURI(tokenId, _tokenURIs[i]);
            mintedTokenIds[i] = tokenId;
            
            unchecked { ++i; }
        }

        // Single storage write at the end
        _nextTokenId = currentTokenId + count;

        emit BatchBadgesMinted(_recipients, mintedTokenIds);
    }

    /**
     * @notice Sets the XP requirement for a specific badge type
     * @dev Only administrators can call this function
     * @param _badgeId The badge type ID
     * @param _xpAmount Required XP amount (0 means no requirement)
     */
    function setBadgeXpRequirement(uint256 _badgeId, uint256 _xpAmount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        badgeXpRequirements[_badgeId] = _xpAmount;
    }
    
    /**
     * @notice Updates the XP engine address
     * @dev Only administrators can call this function
     * @param _newXpEngine The new XP engine contract address
     */
    function setXPEngine(address _newXpEngine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newXpEngine == address(0)) revert InvalidXPEngine();
        xpEngine = IXPEngine(_newXpEngine);
    }

    /**
     * @notice Returns the next token ID that will be minted
     * @return The next available token ID
     */
    function getCurrentTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorageUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
