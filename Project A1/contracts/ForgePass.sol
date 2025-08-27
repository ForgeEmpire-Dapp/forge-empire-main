// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract ForgePass is Initializable, ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable,
    UUPSUpgradeable
 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct Pass {
        uint256 expiresAt;
        uint8 tier;
    }

    mapping(uint256 => Pass) public passDetails;
    uint256 private _nextTokenId;
    uint256 public constant MAX_BATCH_SIZE = 100;

    event PassMinted(address indexed owner, uint256 indexed tokenId, uint8 tier, uint256 expiresAt);
    event PassUpgraded(uint256 indexed tokenId, uint8 newTier);
    event PassRenewed(uint256 indexed tokenId, uint256 newExpiresAt);
    event TokenURIUpdated(uint256 indexed tokenId, string newURI);
    event BatchPassesMinted(address[] indexed recipients, uint256[] tokenIds);

    error PassDoesNotExist(uint256 tokenId);
    error NewTierMustBeHigher();
    error NotOwnerOfPass();
    error ZeroAddressRecipient();
    error ZeroTokenURI();
    error EmptyArrays();
    error ArrayLengthMismatch();
    error BatchSizeExceeded(uint256 maxAllowed, uint256 current);

    function initialize() public initializer {
        __ERC721_init("Forge Pass", "FORGE");
        __ERC721URIStorage_init();
        __ERC721Enumerable_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _nextTokenId = 1;
    }

    function mintPass(address _to, uint8 _tier, uint256 _duration) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        if (_to == address(0)) revert ZeroAddressRecipient();
        uint256 tokenId = _nextTokenId++;
        uint256 expiresAt = block.timestamp + _duration;

        _mint(_to, tokenId);
        _setTokenURI(tokenId, "");
        passDetails[tokenId] = Pass({tier: _tier, expiresAt: expiresAt});

        emit PassMinted(_to, tokenId, _tier, expiresAt);
    }

    function batchMintPass(address[] calldata _recipients, uint8[] calldata _tiers, uint256[] calldata _durations)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        uint256 length = _recipients.length;
        if (length == 0) revert EmptyArrays();
        if (length > MAX_BATCH_SIZE) revert BatchSizeExceeded(MAX_BATCH_SIZE, length);
        if (length != _tiers.length || length != _durations.length) revert ArrayLengthMismatch();

        // Cache storage read and calculate all token IDs upfront
        uint256 currentTokenId = _nextTokenId;
        uint256[] memory mintedTokenIds = new uint256[](length);
        uint256 currentTimestamp = block.timestamp;

        // Optimized loop with minimal storage access
        for (uint256 i; i < length;) {
            address recipient = _recipients[i];
            if (recipient == address(0)) revert ZeroAddressRecipient();

            uint256 tokenId = currentTokenId + i;
            uint256 expiresAt = currentTimestamp + _durations[i];

            _mint(recipient, tokenId);
            _setTokenURI(tokenId, "");
            passDetails[tokenId] = Pass({tier: _tiers[i], expiresAt: expiresAt});
            mintedTokenIds[i] = tokenId;

            emit PassMinted(recipient, tokenId, _tiers[i], expiresAt);
            
            unchecked { ++i; }
        }

        // Single storage write at the end
        _nextTokenId = currentTokenId + length;

        emit BatchPassesMinted(_recipients, mintedTokenIds);
    }

    function upgradePass(uint256 _tokenId, uint8 _newTier) external onlyRole(UPGRADER_ROLE) whenNotPaused {
        if (_ownerOf(_tokenId) == address(0)) revert PassDoesNotExist(_tokenId);
        if (_newTier <= passDetails[_tokenId].tier) revert NewTierMustBeHigher();

        passDetails[_tokenId].tier = _newTier;
        emit PassUpgraded(_tokenId, _newTier);
    }

    function renewPass(uint256 _tokenId, uint256 _duration) external whenNotPaused nonReentrant {
        if (ownerOf(_tokenId) != msg.sender) revert NotOwnerOfPass();

        uint256 newExpiresAt = passDetails[_tokenId].expiresAt + _duration;
        passDetails[_tokenId].expiresAt = newExpiresAt;

        emit PassRenewed(_tokenId, newExpiresAt);
    }

    function setTokenURI(uint256 _tokenId, string memory _newURI) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        if (_ownerOf(_tokenId) == address(0)) revert PassDoesNotExist(_tokenId);
        if (bytes(_newURI).length == 0) revert ZeroTokenURI();

        _setTokenURI(_tokenId, _newURI);
        emit TokenURIUpdated(_tokenId, _newURI);
    }

    function isPassActive(uint256 _tokenId) external view returns (bool) {
        return _ownerOf(_tokenId) != address(0) && passDetails[_tokenId].expiresAt > block.timestamp;
    }

       /* ========== Overrides ========== */

    

function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    returns (string memory)
{
    return super.tokenURI(tokenId);
}



function supportsInterface(bytes4 interfaceId)
    public
    view
    override(AccessControlUpgradeable, ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable)
    returns (bool)
{
    return super.supportsInterface(interfaceId);
}

function _update(address to, uint256 tokenId, address auth)
    internal
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    returns (address)
{
    return super._update(to, tokenId, auth);
}

function _increaseBalance(address account, uint128 value) internal virtual override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
    super._increaseBalance(account, value);
}

    /* ========== Pausing ========== */


        function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
