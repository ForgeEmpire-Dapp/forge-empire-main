// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IOfferManager.sol";
import "../interfaces/IMarketplaceCore.sol";
import "../libraries/ValidationUtils.sol";
import "../libraries/PaymentUtils.sol";

/**
 * @title OfferManager
 * @dev Manages offers for marketplace listings
 */
contract OfferManager is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IOfferManager
{
    bytes32 public constant OFFER_ADMIN_ROLE = keccak256("OFFER_ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    IMarketplaceCore public marketplaceCore;
    
    // Offer storage
    mapping(uint256 => Offer) public offers;
    mapping(uint256 => uint256[]) public listingOffers; // listingId => offerIds
    mapping(address => uint256[]) public userOffers; // user => offerIds
    
    uint256 public nextOfferId;
    uint256 public maxOfferDuration; // Maximum offer duration in seconds
    
    /**
     * @dev Initialize the offer manager
     */
        function initialize(
        address admin,
        address _marketplaceCore,
        uint256 _maxOfferDuration
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OFFER_ADMIN_ROLE, admin);
        
        marketplaceCore = IMarketplaceCore(_marketplaceCore);
        maxOfferDuration = _maxOfferDuration;
        nextOfferId = 1;
    }
    
    /**
     * @dev Make an offer on a listing
     */
        function makeOffer(
        uint256 listingId,
        uint256 amount,
        address paymentToken,
        uint256 duration
    ) external payable whenNotPaused nonReentrant returns (uint256 offerId) {
        IMarketplaceCore.Listing memory listing = marketplaceCore.getListing(listingId);
        _validateOfferRequirements(listing, amount, duration);
        
        // Collect payment
        PaymentUtils.collectPayment(
            paymentToken == address(0),
            IERC20(paymentToken),
            msg.sender,
            amount,
            msg.value
        );
        
        // Create offer
        offerId = nextOfferId++;
        uint256 expiration = block.timestamp + duration;
        
        offers[offerId] = Offer({
            offerId: offerId,
            listingId: listingId,
            offerer: msg.sender,
            amount: amount,
            paymentToken: paymentToken,
            expiration: expiration,
            isActive: true
        });
        
        // Update mappings
        listingOffers[listingId].push(offerId);
        userOffers[msg.sender].push(offerId);
        
        emit OfferMade(offerId, listingId, msg.sender, amount, paymentToken, expiration);
    }
    
    /**
     * @dev Accept an offer (seller only)
     */
    function acceptOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.isActive, "Offer not active");
        require(block.timestamp < offer.expiration, "Offer expired");
        
        IMarketplaceCore.Listing memory listing = marketplaceCore.getListing(offer.listingId);
        require(listing.seller == msg.sender, "Not listing owner");
        require(listing.status == IMarketplaceCore.ListingStatus.ACTIVE, "Listing not active");
        
        // Deactivate offer
        offer.isActive = false;
        
        // Execute sale through marketplace core
        // Note: This would require adding a function to MarketplaceCore for offer acceptance
        
        emit OfferAccepted(offerId, offer.listingId, msg.sender, offer.offerer, offer.amount);
    }
    
    /**
     * @dev Cancel an offer (offerer only)
     */
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.offerer == msg.sender, "Not offer owner");
        require(offer.isActive, "Offer not active");
        
        offer.isActive = false;
        
        // Refund offerer
        if (offer.paymentToken == address(0)) {
            PaymentUtils.refundETHPayment(payable(offer.offerer), offer.amount);
        } else {
            PaymentUtils.refundTokenPayment(IERC20(offer.paymentToken), offer.offerer, offer.amount);
        }
        
        emit OfferCancelled(offerId, offer.offerer);
    }
    
    /**
     * @dev Get offer details
     */
    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }
    
    /**
     * @dev Get all offers for a listing
     */
    function getOffersForListing(uint256 listingId) external view returns (uint256[] memory) {
        return listingOffers[listingId];
    }
    
    /**
     * @dev Get all offers made by a user
     */
    function getUserOffers(address user) external view returns (uint256[] memory) {
        return userOffers[user];
    }
    
    /**
     * @dev Clean up expired offers
     */
    function cleanupExpiredOffers(uint256[] calldata offerIds) external {
        for (uint256 i = 0; i < offerIds.length; i++) {
            uint256 offerId = offerIds[i];
            Offer storage offer = offers[offerId];
            
            if (offer.isActive && block.timestamp >= offer.expiration) {
                offer.isActive = false;
                
                // Refund expired offer
                if (offer.paymentToken == address(0)) {
                    PaymentUtils.refundETHPayment(payable(offer.offerer), offer.amount);
                } else {
                    PaymentUtils.refundTokenPayment(IERC20(offer.paymentToken), offer.offerer, offer.amount);
                }
                
                emit OfferExpired(offerId);
            }
        }
    }
    
    /**
     * @dev Validate offer requirements
     */
        function _validateOfferRequirements(
        IMarketplaceCore.Listing memory listing,
        uint256 amount,
        uint256 duration
    ) internal view {
        require(listing.status == IMarketplaceCore.ListingStatus.ACTIVE, "Listing not active");
        require(listing.listingType != IMarketplaceCore.ListingType.AUCTION, "Cannot offer on auction");
        ValidationUtils.requireNonZeroAmount(amount);
        ValidationUtils.requireValueInRange(duration, 3600, maxOfferDuration); // 1 hour to max duration
    }
    
    // Admin functions
    function setMaxOfferDuration(uint256 newMaxDuration) external onlyRole(OFFER_ADMIN_ROLE) {
        ValidationUtils.requireNonZeroAmount(newMaxDuration);
        maxOfferDuration = newMaxDuration;
    }
}