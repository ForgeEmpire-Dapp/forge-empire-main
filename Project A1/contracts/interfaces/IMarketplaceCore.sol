// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IMarketplaceCore
 * @dev Interface for the core marketplace functionality
 */
interface IMarketplaceCore {
    
    enum ListingStatus { ACTIVE, SOLD, CANCELLED, EXPIRED }
    enum ListingType { FIXED_PRICE, AUCTION, BUNDLE }
    
    struct Listing {
        uint256 listingId;
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        address paymentToken;
        ListingType listingType;
        ListingStatus status;
        uint256 startTime;
        uint256 endTime;
        address highestBidder;
        uint256 highestBid;
        uint256 reservePrice;    
        uint256 buyNowPrice;     
    }
    
    struct CollectionStats {
        uint256 totalVolume;
        uint256 totalSales;
        uint256 averagePrice;
        uint256 floorPrice;
    }
    
    // Events
    event ItemListed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        ListingType listingType,
        uint256 price
    );
    
    event ListingCancelled(uint256 indexed listingId, address indexed seller);
    event ItemSold(
        uint256 indexed listingId,
        address indexed seller,
        address indexed buyer,
        uint256 salePrice,
        uint256 marketplaceFee,
        uint256 royaltyFee
    );
    
    // Core Functions
    function listItem(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        ListingType listingType,
        uint256 duration,
        uint256 reservePrice,   
        uint256 buyNowPrice     
    ) external returns (uint256 listingId);
    
    function cancelListing(uint256 listingId) external;
    function buyNow(uint256 listingId) external payable;
    function getListing(uint256 listingId) external view returns (Listing memory);
    function getCollectionStats(address nftContract) external view returns (CollectionStats memory);
    
    // Admin Functions
    function setMarketplaceFee(uint256 newFee) external;
    function setFeeRecipient(address newRecipient) external;
    function pause() external;
    function unpause() external;
}
