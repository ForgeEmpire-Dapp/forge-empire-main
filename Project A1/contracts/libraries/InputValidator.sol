// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title InputValidator
 * @dev Comprehensive input validation library for security and data integrity
 * @notice Provides validation functions for common input types and patterns
 */
library InputValidator {
    
    // Custom Errors
    error InvalidAddress();
    error InvalidAmount();
    error InvalidString();
    error InvalidLength();
    error InvalidFormat();
    error InvalidRange();
    error EmptyInput();
    error ContainsProfanity();
    error InvalidCharacters();
    error StringTooLong();
    error StringTooShort();
    error InvalidEmailFormat();
    error InvalidUrlFormat();
    
    // Constants
    uint256 public constant MAX_STRING_LENGTH = 1000;
    uint256 public constant MAX_USERNAME_LENGTH = 50;
    uint256 public constant MIN_USERNAME_LENGTH = 3;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 500;
    uint256 public constant MAX_URL_LENGTH = 200;
    
    /**
     * @dev Validate Ethereum address
     */
    function validateAddress(address _address) internal pure {
        if (_address == address(0)) revert InvalidAddress();
    }
    
    /**
     * @dev Validate non-zero amount
     */
    function validateAmount(uint256 amount) internal pure {
        if (amount == 0) revert InvalidAmount();
    }
    
    /**
     * @dev Validate amount within range
     */
    function validateAmountRange(uint256 amount, uint256 min, uint256 max) internal pure {
        if (amount < min || amount > max) revert InvalidRange();
    }
    
    /**
     * @dev Validate string length
     */
    function validateStringLength(string memory str, uint256 minLength, uint256 maxLength) internal pure {
        uint256 length = bytes(str).length;
        if (length < minLength) revert StringTooShort();
        if (length > maxLength) revert StringTooLong();
    }
    
    /**
     * @dev Validate non-empty string
     */
    function validateNonEmptyString(string memory str) internal pure {
        if (bytes(str).length == 0) revert EmptyInput();
    }
    
    /**
     * @dev Validate username format
     */
    function validateUsername(string memory username) internal pure {
        bytes memory usernameBytes = bytes(username);
        uint256 length = usernameBytes.length;
        
        if (length < MIN_USERNAME_LENGTH) revert StringTooShort();
        if (length > MAX_USERNAME_LENGTH) revert StringTooLong();
        
        // Check first character is alphanumeric
        bytes1 firstChar = usernameBytes[0];
        if (!_isAlphanumeric(firstChar)) revert InvalidFormat();
        
        // Check all characters are valid
        for (uint256 i = 0; i < length; i++) {
            bytes1 char = usernameBytes[i];
            if (!_isValidUsernameChar(char)) revert InvalidCharacters();
        }
        
        // Check for profanity (simple implementation)
        if (_containsProfanity(username)) revert ContainsProfanity();
    }
    
    /**
     * @dev Validate description/bio text
     */
    function validateDescription(string memory description) internal pure {
        uint256 length = bytes(description).length;
        if (length > MAX_DESCRIPTION_LENGTH) revert StringTooLong();
        
        // Check for basic profanity
        if (length > 0 && _containsProfanity(description)) revert ContainsProfanity();
        
        // Check for valid characters (allow most printable ASCII + some unicode)
        bytes memory descBytes = bytes(description);
        for (uint256 i = 0; i < length; i++) {
            bytes1 char = descBytes[i];
            if (!_isValidTextChar(char)) revert InvalidCharacters();
        }
    }
    
    /**
     * @dev Validate URL format (basic validation)
     */
    function validateUrl(string memory url) internal pure {
        bytes memory urlBytes = bytes(url);
        uint256 length = urlBytes.length;
        
        if (length == 0) return; // Empty URL is allowed
        if (length > MAX_URL_LENGTH) revert StringTooLong();
        
        // Must start with http:// or https://
        if (length < 7) revert InvalidFormat(); // Minimum "http://"
        
        bool validProtocol = false;
        if (length >= 7) {
            // Check for "http://"
            if (urlBytes[0] == 'h' && urlBytes[1] == 't' && urlBytes[2] == 't' && 
                urlBytes[3] == 'p' && urlBytes[4] == ':' && urlBytes[5] == '/' && urlBytes[6] == '/') {
                validProtocol = true;
            }
        }
        if (!validProtocol && length >= 8) {
            // Check for "https://"
            if (urlBytes[0] == 'h' && urlBytes[1] == 't' && urlBytes[2] == 't' && 
                urlBytes[3] == 'p' && urlBytes[4] == 's' && urlBytes[5] == ':' && 
                urlBytes[6] == '/' && urlBytes[7] == '/') {
                validProtocol = true;
            }
        }
        
        if (!validProtocol) revert InvalidUrlFormat();
    }
    
    /**
     * @dev Validate array length
     */
    function validateArrayLength(uint256 length, uint256 maxLength) internal pure {
        if (length > maxLength) revert InvalidLength();
    }
    
    /**
     * @dev Validate percentage (0-10000 for basis points)
     */
    function validatePercentage(uint256 percentage) internal pure {
        if (percentage > 10000) revert InvalidRange(); // 100% in basis points
    }
    
    /**
     * @dev Validate timestamp is not in the past
     */
    function validateFutureTimestamp(uint256 timestamp) internal view {
        if (timestamp <= block.timestamp) revert InvalidRange();
    }
    
    /**
     * @dev Validate duration is reasonable
     */
    function validateDuration(uint256 duration, uint256 minDuration, uint256 maxDuration) internal pure {
        if (duration < minDuration || duration > maxDuration) revert InvalidRange();
    }
    
    /**
     * @dev Check if character is alphanumeric
     */
    function _isAlphanumeric(bytes1 char) private pure returns (bool) {
        return (char >= '0' && char <= '9') || 
               (char >= 'A' && char <= 'Z') || 
               (char >= 'a' && char <= 'z');
    }
    
    /**
     * @dev Check if character is valid for username
     */
    function _isValidUsernameChar(bytes1 char) private pure returns (bool) {
        return _isAlphanumeric(char) || char == '_' || char == '-';
    }
    
    /**
     * @dev Check if character is valid for text content
     */
    function _isValidTextChar(bytes1 char) private pure returns (bool) {
        // Allow printable ASCII characters and some common symbols
        uint8 charCode = uint8(char);
        return (charCode >= 32 && charCode <= 126) || // Printable ASCII
               charCode == 9 ||  // Tab
               charCode == 10 || // Line feed
               charCode == 13;   // Carriage return
    }
    
    /**
     * @dev Basic profanity check (simple implementation)
     * Note: In production, consider using a more sophisticated approach
     */
    function _containsProfanity(string memory text) private pure returns (bool) {
        bytes memory textBytes = bytes(_toLower(text));
        
        // Simple blacklist check
        bytes memory badWord1 = bytes("spam");
        bytes memory badWord2 = bytes("scam");
        bytes memory badWord3 = bytes("hack");
        
        return _containsSubstring(textBytes, badWord1) ||
               _containsSubstring(textBytes, badWord2) ||
               _containsSubstring(textBytes, badWord3);
    }
    
    /**
     * @dev Convert string to lowercase
     */
    function _toLower(string memory str) private pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        
        for (uint256 i = 0; i < bStr.length; i++) {
            if (uint8(bStr[i]) >= 65 && uint8(bStr[i]) <= 90) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        
        return string(bLower);
    }
    
    /**
     * @dev Check if text contains substring
     */
    function _containsSubstring(bytes memory text, bytes memory substring) private pure returns (bool) {
        if (substring.length > text.length) return false;
        
        for (uint256 i = 0; i <= text.length - substring.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < substring.length; j++) {
                if (text[i + j] != substring[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        
        return false;
    }
    
    /**
     * @dev Validate quest parameters
     */
    function validateQuestParams(
        string memory title,
        string memory description,
        uint256 xpReward,
        uint256 duration
    ) internal pure {
        validateStringLength(title, 3, 100);
        validateStringLength(description, 10, 500);
        validateAmountRange(xpReward, 1, 10000);
        validateDuration(duration, 1 hours, 30 days);
    }
    
    /**
     * @dev Validate badge parameters
     */
    function validateBadgeParams(
        string memory name,
        string memory description,
        string memory tokenURI,
        uint256 xpRequirement
    ) internal pure {
        validateStringLength(name, 3, 50);
        validateStringLength(description, 10, 200);
        validateUrl(tokenURI);
        validateAmount(xpRequirement);
    }
    
    /**
     * @dev Validate profile parameters
     */
    function validateProfileParams(
        string memory username,
        string memory bio,
        string memory avatarUrl
    ) internal pure {
        validateUsername(username);
        validateDescription(bio);
        validateUrl(avatarUrl);
    }
    
    /**
     * @dev Validate social interaction parameters
     */
    function validateSocialParams(
        string memory content,
        address[] memory mentions
    ) internal pure {
        validateStringLength(content, 1, 280); // Twitter-like limit
        validateArrayLength(mentions.length, 10); // Max mentions
        
        for (uint256 i = 0; i < mentions.length; i++) {
            validateAddress(mentions[i]);
        }
        
        if (_containsProfanity(content)) revert ContainsProfanity();
    }
    
    /**
     * @dev Validate staking parameters
     */
    function validateStakingParams(
        uint256 amount,
        uint256 duration,
        uint256 minStake,
        uint256 maxStake
    ) internal pure {
        validateAmount(amount);
        validateAmountRange(amount, minStake, maxStake);
        validateDuration(duration, 1 days, 365 days);
    }
}