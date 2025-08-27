// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract MockMarketplaceCore {
    using EnumerableSet for EnumerableSet.AddressSet;

    enum ListingStatus { ACTIVE, SOLD, CANCELLED }
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

    mapping(uint256 => Listing) public listings;

    function setListing(
        uint256 listingId,
        address seller,
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        ListingType listingType,
        ListingStatus status,
        uint256 startTime,
        uint256 endTime,
        address highestBidder,
        uint256 highestBid,
        uint256 reservePrice,    
        uint256 buyNowPrice
    ) external {
        listings[listingId] = Listing(
            listingId,
            seller,
            nftContract,
            tokenId,
            price,
            paymentToken,
            listingType,
            status,
            startTime,
            endTime,
            highestBidder,
            highestBid,
            reservePrice,
            buyNowPrice
        );
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
}
