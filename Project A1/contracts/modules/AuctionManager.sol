// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAuctionManager.sol";
import "../interfaces/IMarketplaceCore.sol";
import "../libraries/MathUtils.sol";
import "../libraries/ValidationUtils.sol";
import "../libraries/PaymentUtils.sol";

/**
 * @title AuctionManager
 * @dev Manages auction functionality for the marketplace
 */
contract AuctionManager is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IAuctionManager
{
    bytes32 public constant AUCTION_ADMIN_ROLE = keccak256("AUCTION_ADMIN_ROLE");
    
    IMarketplaceCore public marketplaceCore;
    
    // Auction-specific storage
    mapping(uint256 => AuctionData) public auctions;
    mapping(address => uint256) public lastBidTime;
    
    uint256 public minBidIncrement; // Basis points (e.g., 500 = 5%)
    uint256 public auctionExtensionTime; // Time to extend auction when bid placed near end
    uint256 public constant MIN_BID_DELAY = 60; // 1 minute delay between bids
    
    /**
     * @dev Initialize the auction manager
     */
    function initialize(
        address admin,
        address _marketplaceCore,
        uint256 _minBidIncrement
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AUCTION_ADMIN_ROLE, admin);
        
        marketplaceCore = IMarketplaceCore(_marketplaceCore);
        minBidIncrement = _minBidIncrement;
        auctionExtensionTime = 300; // 5 minutes
    }

    function pause() external onlyRole(AUCTION_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(AUCTION_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Place bid on auction
     */
    function placeBid(uint256 listingId, uint256 bidAmount) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
    {
        // Anti front-running protection
        require(block.timestamp >= lastBidTime[msg.sender] + MIN_BID_DELAY, "Bid too soon");
        lastBidTime[msg.sender] = block.timestamp;
        
        IMarketplaceCore.Listing memory listing = marketplaceCore.getListing(listingId);
        _validateAuctionBid(listing, msg.sender);
        
        uint256 actualBidAmount = listing.paymentToken == address(0) ? msg.value : bidAmount;
        _validateBidAmount(listing, actualBidAmount);
        
        // Handle payment collection
        PaymentUtils.collectPayment(
            listing.paymentToken == address(0),
            IERC20(listing.paymentToken),
            msg.sender,
            actualBidAmount,
            msg.value
        );
        
        // Process the bid
        _processBid(listingId, listing, msg.sender, actualBidAmount);
        
        emit BidPlaced(listingId, msg.sender, actualBidAmount, block.timestamp);
    }
    
    /**
     * @dev End auction and finalize sale
     */
    function endAuction(uint256 listingId) external nonReentrant {
        IMarketplaceCore.Listing memory listing = marketplaceCore.getListing(listingId);
        require(listing.listingType == IMarketplaceCore.ListingType.AUCTION, "Not an auction");
        require(block.timestamp >= listing.endTime, "Auction not ended");
        require(listing.status == IMarketplaceCore.ListingStatus.ACTIVE, "Auction not active");
        
        AuctionData storage auction = auctions[listingId];
        require(!auction.ended, "Auction already ended");
        auction.ended = true;
        
        if (auction.currentBidder != address(0)) {
            // Execute sale through marketplace core
            // Note: This would require adding a function to MarketplaceCore for auction completion
            emit AuctionEnded(listingId, auction.currentBidder, auction.currentBid);
        } else {
            // No bids - cancel listing
            emit AuctionEnded(listingId, address(0), 0);
        }
    }
    
    /**
     * @dev Get auction data
     */
    function getAuctionData(uint256 listingId) external view returns (AuctionData memory) {
        return auctions[listingId];
    }
    
    /**
     * @dev Check if auction is active
     */
    function isAuctionActive(uint256 listingId) external view returns (bool) {
        IMarketplaceCore.Listing memory listing = marketplaceCore.getListing(listingId);
        return listing.status == IMarketplaceCore.ListingStatus.ACTIVE && 
               listing.listingType == IMarketplaceCore.ListingType.AUCTION &&
               block.timestamp < listing.endTime;
    }
    
    /**
     * @dev Get current bid information
     */
    function getCurrentBid(uint256 listingId) external view returns (uint256, address) {
        AuctionData memory auction = auctions[listingId];
        return (auction.currentBid, auction.currentBidder);
    }
    
    /**
     * @dev Validate auction bid requirements
     */
    function _validateAuctionBid(IMarketplaceCore.Listing memory listing, address bidder) internal view {
        require(listing.status == IMarketplaceCore.ListingStatus.ACTIVE, "Listing not active");
        require(listing.listingType == IMarketplaceCore.ListingType.AUCTION, "Not an auction");
        require(block.timestamp < listing.endTime, "Auction ended");
        require(bidder != listing.seller, "Cannot bid on own item");
    }
    
    /**
     * @dev Validate bid amount
     */
    function _validateBidAmount(IMarketplaceCore.Listing memory listing, uint256 bidAmount) internal view {
        ValidationUtils.requireNonZeroAmount(bidAmount);
        require(bidAmount >= listing.price, "Bid below starting price");
        
        AuctionData memory auction = auctions[listing.listingId];
        if (auction.currentBid > 0) {
            uint256 minBid = MathUtils.calculatePercentage(auction.currentBid, 10000 + minBidIncrement);
            require(bidAmount >= minBid, "Bid increment too low");
        }
    }
    
    /**
     * @dev Process a valid bid
     */
    function _processBid(
        uint256 listingId, 
        IMarketplaceCore.Listing memory listing,
        address bidder, 
        uint256 bidAmount
    ) internal {
        AuctionData storage auction = auctions[listingId];
        
        // Initialize auction data if first bid
        if (auction.listingId == 0) {
            auction.listingId = listingId;
            auction.startingBid = listing.price;
            auction.endTime = listing.endTime;
            auction.minBidIncrement = minBidIncrement;
        }
        
        // Refund previous bidder
        if (auction.currentBidder != address(0)) {
            if (listing.paymentToken == address(0)) {
                PaymentUtils.refundETHPayment(payable(auction.currentBidder), auction.currentBid);
            } else {
                IERC20(listing.paymentToken).transfer(auction.currentBidder, auction.currentBid);
            }
        }
        
        // Update auction with new bid
        auction.currentBid = bidAmount;
        auction.currentBidder = bidder;
        
        // Extend auction if bid placed near end
        if (listing.endTime - block.timestamp < auctionExtensionTime) {
            auction.endTime = block.timestamp + auctionExtensionTime;
            emit AuctionExtended(listingId, auction.endTime);
        }
    }
    
    // Admin functions
    function setMinBidIncrement(uint256 newIncrement) external onlyRole(AUCTION_ADMIN_ROLE) {
        ValidationUtils.requireValidPercentage(newIncrement);
        minBidIncrement = newIncrement;
    }
    
    function setAuctionExtensionTime(uint256 newExtensionTime) external onlyRole(AUCTION_ADMIN_ROLE) {
        ValidationUtils.requireNonZeroAmount(newExtensionTime);
        auctionExtensionTime = newExtensionTime;
    }
}