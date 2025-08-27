// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./BadgeMinter.sol";

/**
 * @title ProfileRegistryV2
 * @dev A contract for users to manage their public profile, including a username,
 *      a curated list of their owned BadgeMinter NFTs, and a Twitter handle.
 */
contract ProfileRegistryV2 is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // Mapping from user address to their chosen username
    mapping(address => string) public usernames;
    mapping(string => address) private _usernameToAddress;

    // Mapping from user address to an array of badge token IDs they wish to display
    mapping(address => uint256[]) public userBadges;

    // Mapping to quickly check if a badge is already on a user's profile
    mapping(address => mapping(uint256 => bool)) private _isBadgeOnProfile;

    // Instance of the BadgeMinter contract
    BadgeMinter public badgeMinter;

    // New state variable for Twitter handles
    mapping(address => string) public twitterHandles;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Custom Errors
    error UsernameAlreadyTaken(string username);
    error BadgeNotOwned(uint256 tokenId);
    error BadgeAlreadyOnProfile(uint256 tokenId);
    error BadgeNotOnProfile(uint256 tokenId);
    error UsernameCannotBeEmpty();
    error UsernameTooLong();
    error InvalidCharacter();

    // Events
    event UsernameUpdated(address indexed user, string newUsername);
    event BadgeAddedToProfile(address indexed user, uint256 indexed tokenId);
    event BadgeRemovedFromProfile(address indexed user, uint256 indexed tokenId);
    event TwitterHandleUpdated(address indexed user, string newTwitterHandle);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the ProfileRegistry.
     * @param _badgeMinterAddress The address of the BadgeMinter NFT contract.
     */
    function initialize(address _badgeMinterAddress) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        badgeMinter = BadgeMinter(_badgeMinterAddress);
    }

    /**
     * @dev Allows a user to set or update their username.
     * @param _username The desired username.
     */
    function setUsername(string memory _username) external nonReentrant {
        // Validate length
        if (bytes(_username).length == 0) revert UsernameCannotBeEmpty();
        if (bytes(_username).length > 32) revert UsernameTooLong();
        
        // Validate characters
        bytes memory b = bytes(_username);
        for (uint i = 0; i < b.length; i++) {
            bytes1 char = b[i];
            if (
                !(char >= 0x30 && char <= 0x39) && // 0-9
                !(char >= 0x41 && char <= 0x5A) && // A-Z
                !(char >= 0x61 && char <= 0x7A) && // a-z
                !(char == 0x5F) // _
            ) {
                revert InvalidCharacter();
            }
        }
        
        // Normalize to lowercase
        string memory normalizedUsername = _toLower(_username);
        
        // Check availability
        address existingOwner = _usernameToAddress[normalizedUsername];
        if (existingOwner != address(0) && existingOwner != msg.sender) {
            revert UsernameAlreadyTaken(normalizedUsername);
        }

        // Clear old username
        string storage oldUsername = usernames[msg.sender];
        if (bytes(oldUsername).length > 0) {
            delete _usernameToAddress[oldUsername];
        }

        // Set new username
        usernames[msg.sender] = normalizedUsername;
        _usernameToAddress[normalizedUsername] = msg.sender;
        emit UsernameUpdated(msg.sender, normalizedUsername);
    }

    // Helper function for lowercase conversion
    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint i = 0; i < bStr.length; i++) {
            if ((uint8(bStr[i]) >= 65) && (uint8(bStr[i]) <= 90)) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }

    /**
     * @dev Allows a user to add a badge they own to their public profile.
     * Requirements:
     * - The caller must own the badge.
     * - The badge must not already be on the user's profile.
     * @param _tokenId The ID of the badge token to add.
     */
    function addBadgeToProfile(uint256 _tokenId) external nonReentrant {
        if (badgeMinter.ownerOf(_tokenId) != msg.sender) revert BadgeNotOwned(_tokenId);
        if (_isBadgeOnProfile[msg.sender][_tokenId]) revert BadgeAlreadyOnProfile(_tokenId);

        userBadges[msg.sender].push(_tokenId);
        _isBadgeOnProfile[msg.sender][_tokenId] = true;

        emit BadgeAddedToProfile(msg.sender, _tokenId);
    }

    /**
     * @dev Allows a user to remove a badge from their public profile.
     * Requirements:
     * - The badge must be on the user's profile.
     * @param _tokenId The ID of the badge token to remove.
     */
    function removeBadgeFromProfile(uint256 _tokenId) external nonReentrant {
        if (!_isBadgeOnProfile[msg.sender][_tokenId]) revert BadgeNotOnProfile(_tokenId);

        uint256[] storage badges = userBadges[msg.sender];
        uint256 lastIndex = badges.length - 1;
        uint256 indexToRemove = type(uint256).max; // Sentinel value

        for (uint256 i = 0; i < badges.length; i++) {
            if (badges[i] == _tokenId) {
                indexToRemove = i;
                break;
            }
        }

        // If the badge to remove is not the last element, swap it with the last element
        if (indexToRemove != lastIndex) {
            badges[indexToRemove] = badges[lastIndex];
        }
        // Remove the last element (either the original last element or the swapped one)
        badges.pop();

        _isBadgeOnProfile[msg.sender][_tokenId] = false;
        emit BadgeRemovedFromProfile(msg.sender, _tokenId);
    }

    /**
     * @dev Allows a user to set or update their Twitter handle.
     * @param _twitterHandle The desired Twitter handle.
     */
    function setTwitterHandle(string memory _twitterHandle) external nonReentrant {
        // Add any validation for the twitter handle here
        twitterHandles[msg.sender] = _twitterHandle;
        emit TwitterHandleUpdated(msg.sender, _twitterHandle);
    }

    /**
     * @dev Returns a user's profile information, including the new twitter handle.
     * @param _user The address of the user.
     * @return username The user's chosen username.
     * @return badgeIds An array of badge token IDs displayed on the user's profile.
     * @return twitterHandle The user's Twitter handle.
     */
    function getProfile(address _user) external view returns (string memory username, uint256[] memory badgeIds, string memory twitterHandle) {
        username = usernames[_user];
        badgeIds = userBadges[_user];
        twitterHandle = twitterHandles[_user];
    }

    function addressForUsername(string memory username) external view returns (address) {
        return _usernameToAddress[username];
    }

    function getUserBadges(address _user) external view returns (uint256[] memory) {
        return userBadges[_user];
    }
    
    /**
     * @dev Returns only the badges that the user currently owns (verified ownership)
     * This prevents displaying badges that may have been transferred away
     * @param _user The address of the user
     * @return validBadges Array of badge token IDs that the user currently owns
     */
    function getVerifiedUserBadges(address _user) external view returns (uint256[] memory validBadges) {
        uint256[] memory allBadges = userBadges[_user];
        uint256 validCount = 0;
        
        // First pass: count valid badges
        for (uint256 i = 0; i < allBadges.length; i++) {
            try badgeMinter.ownerOf(allBadges[i]) returns (address owner) {
                if (owner == _user) {
                    validCount++;
                }
            } catch {
                // Badge doesn't exist or call failed, skip it
            }
        }
        
        // Second pass: collect valid badges
        validBadges = new uint256[](validCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allBadges.length; i++) {
            try badgeMinter.ownerOf(allBadges[i]) returns (address owner) {
                if (owner == _user) {
                    validBadges[index] = allBadges[i];
                    index++;
                }
            } catch {
                // Badge doesn't exist or call failed, skip it
            }
        }
    }
    
    /**
     * @dev Cleanup function to remove invalid badges from user profiles
     * Can be called by anyone to help maintain data integrity
     * @param _user The address of the user to cleanup
     */
    function cleanupInvalidBadges(address _user) external nonReentrant {
        uint256[] storage badges = userBadges[_user];
        uint256 writeIndex = 0;
        
        // Compact array by removing invalid badges
        for (uint256 readIndex = 0; readIndex < badges.length; readIndex++) {
            uint256 tokenId = badges[readIndex];
            bool isValid = false;
            
            try badgeMinter.ownerOf(tokenId) returns (address owner) {
                if (owner == _user) {
                    isValid = true;
                }
            } catch {
                // Badge doesn't exist or call failed, mark as invalid
            }
            
            if (isValid) {
                if (writeIndex != readIndex) {
                    badges[writeIndex] = badges[readIndex];
                }
                writeIndex++;
            } else {
                // Remove from mapping
                _isBadgeOnProfile[_user][tokenId] = false;
                emit BadgeRemovedFromProfile(_user, tokenId);
            }
        }
        
        // Trim array to new size
        while (badges.length > writeIndex) {
            badges.pop();
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
