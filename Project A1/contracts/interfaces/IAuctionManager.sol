// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAuctionManager
 * @dev Interface for auction-specific functionality
 */
interface IAuctionManager {
    
    struct AuctionData {
        uint256 listingId;
        uint256 startingBid;
        uint256 currentBid;
        address currentBidder;
        uint256 endTime;
        uint256 minBidIncrement;
        bool ended;
    }
    
    // Events
    event BidPlaced(
        uint256 indexed listingId,
        address indexed bidder,
        uint256 bidAmount,
        uint256 timestamp
    );
    
    event AuctionEnded(
        uint256 indexed listingId,
        address indexed winner,
        uint256 winningBid
    );
    
    event AuctionExtended(
        uint256 indexed listingId,
        uint256 newEndTime
    );
    
    // Auction Functions
    function placeBid(uint256 listingId, uint256 bidAmount) external payable;
    function endAuction(uint256 listingId) external;
    function getAuctionData(uint256 listingId) external view returns (AuctionData memory);
    function isAuctionActive(uint256 listingId) external view returns (bool);
    function getCurrentBid(uint256 listingId) external view returns (uint256, address);
    
    // Admin Functions
    function setMinBidIncrement(uint256 newIncrement) external;
    function setAuctionExtensionTime(uint256 newExtensionTime) external;
}