// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract MockBadgeMinter is AccessControl, ERC721URIStorage {
    mapping(uint256 => address) private _owners;
    bool private _revertOwnerOf;
    uint256 public totalMinted;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC721("Mock Badge", "MBG") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        totalMinted = 0;
    }

    function mint(address to, uint256 tokenId, string memory tokenURI) public onlyRole(MINTER_ROLE) {
        // console.log("MockBadgeMinter: minting to", to, "tokenId", tokenId, "tokenURI", tokenURI);
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        totalMinted++;
    }

    // Add the function signature that QuestRegistry expects
    uint256 private _nextTokenId = 1;
    
    function mintBadge(address to, string memory tokenURI) public onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        totalMinted++;
        return tokenId;
    }

    function ownerOf(uint256 tokenId) public view override(ERC721, IERC721) returns (address) {
        if (_revertOwnerOf) {
            revert("MockBadgeMinter: ownerOf reverted");
        }
        return super.ownerOf(tokenId);
    }

    function setRevertOwnerOf(bool revertIndeed) public {
        _revertOwnerOf = revertIndeed;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function hasBadge(address user) public view returns (bool) {
        return balanceOf(user) > 0;
    }
}
