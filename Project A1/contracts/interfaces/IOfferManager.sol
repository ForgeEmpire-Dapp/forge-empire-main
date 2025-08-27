// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOfferManager
 * @dev Interface for offer management functionality
 */
interface IOfferManager {
    
    struct Offer {
        uint256 offerId;
        uint256 listingId;
        address offerer;
        uint256 amount;
        address paymentToken;
        uint256 expiration;
        bool isActive;
    }
    
    // Events
    event OfferMade(
        uint256 indexed offerId,
        uint256 indexed listingId,
        address indexed offerer,
        uint256 amount,
        address paymentToken,
        uint256 expiration
    );
    
    event OfferAccepted(
        uint256 indexed offerId,
        uint256 indexed listingId,
        address indexed seller,
        address offerer,
        uint256 amount
    );
    
    event OfferCancelled(
        uint256 indexed offerId,
        address indexed offerer
    );
    
    event OfferExpired(
        uint256 indexed offerId
    );
    
    // Offer Functions
    function makeOffer(
        uint256 listingId,
        uint256 amount,
        address paymentToken,
        uint256 duration
    ) external payable returns (uint256 offerId);
    
    function acceptOffer(uint256 offerId) external;
    function cancelOffer(uint256 offerId) external;
    function getOffer(uint256 offerId) external view returns (Offer memory);
    function getOffersForListing(uint256 listingId) external view returns (uint256[] memory);
    function getUserOffers(address user) external view returns (uint256[] memory);
    
    // Admin Functions
    function setMaxOfferDuration(uint256 newMaxDuration) external;
    function cleanupExpiredOffers(uint256[] calldata offerIds) external;
}