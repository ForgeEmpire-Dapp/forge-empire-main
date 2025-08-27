// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IMarketplaceCore.sol";
import "../libraries/MathUtils.sol";
import "../libraries/ValidationUtils.sol";
import "../libraries/PaymentUtils.sol";

/**
 * @title MarketplaceCore
 * @dev Enhanced: Core marketplace functionality for listing and buying NFTs
 */
contract MarketplaceCore is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IERC721Receiver,
    IMarketplaceCore,
    UUPSUpgradeable
{
    // Custom errors
    error InsufficientPayment();
    error CannotBuyOwnItem();
    error CannotBidOnOwnItem();
    error AuctionNotActive();
    error AuctionNotEnded();
    error BidTooLow();
    error BidIncrementTooLow();
    error OnlyMarketplace();
    error UnapprovedPaymentToken();
    error InvalidListing();
    error AuctionDurationTooShort();
    error Unauthorized();

    bytes32 public constant MARKETPLACE_ADMIN_ROLE = keccak256("MARKETPLACE_ADMIN_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    mapping(uint256 => Listing) public listings;
    mapping(address => CollectionStats) public collectionStats;
    mapping(address => uint256[]) public userListings;
    mapping(address => bool) public approvedPaymentTokens;

    uint256 public nextListingId;
    uint256 public marketplaceFee;
    uint256 public maxRoyalty;
    address public feeRecipient;

    event MarketplaceFeeUpdated(uint256 newFee);
    event FeeRecipientChanged(address newRecipient);
    event PaymentTokenApprovalUpdated(address token, bool approved);
    event BidPlaced(uint256 indexed listingId, address indexed bidder, uint256 amount);
    event EmergencyWithdrawal(uint256 amount);

    modifier onlyAdmin() {
        require(hasRole(MARKETPLACE_ADMIN_ROLE, msg.sender), "Not marketplace admin");
        _;
    }

    modifier onlyFeeManager() {
        require(hasRole(FEE_MANAGER_ROLE, msg.sender), "Not fee manager");
        _;
    }

    receive() external payable {}  // Added to accept ETH deposits

    function initialize(
        address admin,
        address _feeRecipient,
        uint256 _marketplaceFee
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MARKETPLACE_ADMIN_ROLE, admin);
        _grantRole(FEE_MANAGER_ROLE, admin);

        feeRecipient = _feeRecipient;
        marketplaceFee = _marketplaceFee;
        maxRoyalty = 1000; // 10% max royalty
        nextListingId = 1;

        approvedPaymentTokens[address(0)] = true; // ETH is approved by default
    }

    function listItem(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        ListingType listingType,
        uint256 duration,
        uint256 reservePrice,
        uint256 buyNowPrice
    ) external whenNotPaused nonReentrant returns (uint256 listingId) {
        ValidationUtils.requireNonZeroAddress(nftContract);
        ValidationUtils.requireNonZeroAmount(price);
        
        if (!approvedPaymentTokens[paymentToken]) 
            revert UnapprovedPaymentToken();
        
        IERC721 nft = IERC721(nftContract);
        
        if (nft.ownerOf(tokenId) != msg.sender) 
            revert InvalidListing();
            
        if (!(nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(tokenId) == address(this))) 
            revert InvalidListing();
            
        if (listingType == ListingType.AUCTION && duration == 0) 
            revert AuctionDurationTooShort();

        listingId = nextListingId++;
        uint256 endTime = listingType == ListingType.AUCTION ? block.timestamp + duration : 0;

        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            paymentToken: paymentToken,
            listingType: listingType,
            status: ListingStatus.ACTIVE,
            startTime: block.timestamp,
            endTime: endTime,
            highestBidder: address(0),
            highestBid: 0,
            reservePrice: reservePrice,
            buyNowPrice: buyNowPrice
        });

        userListings[msg.sender].push(listingId);
        nft.safeTransferFrom(msg.sender, address(this), tokenId);

        emit ItemListed(listingId, msg.sender, nftContract, tokenId, listingType, price);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        
        if (listing.status != ListingStatus.ACTIVE)
            revert InvalidListing();
            
        if (listing.seller != msg.sender && !hasRole(MARKETPLACE_ADMIN_ROLE, msg.sender))
            revert Unauthorized();

        listing.status = ListingStatus.CANCELLED;
        IERC721(listing.nftContract).safeTransferFrom(address(this), listing.seller, listing.tokenId);
        emit ListingCancelled(listingId, listing.seller);
    }

    function buyNow(uint256 listingId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        
        if (listing.status != ListingStatus.ACTIVE)
            revert InvalidListing();
        if (listing.listingType != ListingType.FIXED_PRICE)
            revert InvalidListing();
        if (msg.sender == listing.seller)
            revert CannotBuyOwnItem();

        uint256 totalPrice = listing.price;
        
        // Handle ETH payments
        if (listing.paymentToken == address(0)) {
            if (msg.value < totalPrice) revert InsufficientPayment();
        }
        // ERC20 payments handled in collectPayment

        PaymentUtils.collectPayment(
            listing.paymentToken == address(0),
            IERC20(listing.paymentToken),
            msg.sender,
            totalPrice,
            msg.value
        );

        _executeSale(listingId, msg.sender, totalPrice);
    }

    function placeBid(uint256 listingId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        
        if (listing.status != ListingStatus.ACTIVE)
            revert AuctionNotActive();
        if (listing.listingType != ListingType.AUCTION)
            revert AuctionNotActive();
        if (msg.sender == listing.seller)
            revert CannotBidOnOwnItem();
        if (block.timestamp >= listing.endTime)
            revert AuctionNotEnded();
            
        uint256 bidAmount = msg.value;
        
        if (bidAmount < listing.price)
            revert BidTooLow();
        if (listing.highestBidder != address(0) && bidAmount < listing.highestBid + (listing.highestBid * 500 / 10000))
            revert BidIncrementTooLow();

        // Handle buy now functionality
        if (listing.buyNowPrice > 0 && bidAmount >= listing.buyNowPrice) {
            _executeSale(listingId, msg.sender, bidAmount);
            return;
        }

        // Refund previous bidder
        if (listing.highestBidder != address(0)) {
            (bool success, ) = listing.highestBidder.call{value: listing.highestBid}("");
            require(success, "Refund failed");
        }

        // Update bid state
        listing.highestBidder = msg.sender;
        listing.highestBid = bidAmount;
        emit BidPlaced(listingId, msg.sender, bidAmount);
    }

    function finalizeAuction(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        
        if (listing.status != ListingStatus.ACTIVE)
            revert InvalidListing();
        if (listing.listingType != ListingType.AUCTION)
            revert AuctionNotActive();
        if (block.timestamp < listing.endTime)
            revert AuctionNotEnded();

        if (listing.highestBid >= listing.reservePrice) {
            _executeSale(listingId, listing.highestBidder, listing.highestBid);
        } else {
            listing.status = ListingStatus.EXPIRED;
            IERC721(listing.nftContract).safeTransferFrom(address(this), listing.seller, listing.tokenId);
            emit ListingCancelled(listingId, listing.seller);
        }
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getCollectionStats(address nftContract) external view returns (CollectionStats memory) {
        return collectionStats[nftContract];
    }

    function _executeSale(uint256 listingId, address buyer, uint256 salePrice) internal {
        Listing storage listing = listings[listingId];
        listing.status = ListingStatus.SOLD;

        uint256 royaltyAmount = _calculateRoyalty(listing.nftContract, listing.tokenId, salePrice);
        (uint256 marketplaceFeeAmount, uint256 adjustedRoyalty, uint256 sellerAmount) = 
            MathUtils.calculateFeeDistribution(salePrice, marketplaceFee, royaltyAmount);

        _processPayments(listing, sellerAmount, marketplaceFeeAmount, adjustedRoyalty);
        IERC721(listing.nftContract).safeTransferFrom(address(this), buyer, listing.tokenId);
        _updateStats(listing.nftContract, salePrice);

        emit ItemSold(listingId, listing.seller, buyer, salePrice, marketplaceFeeAmount, adjustedRoyalty);
    }

    function _processPayments(
        Listing storage listing,
        uint256 sellerAmount,
        uint256 marketplaceFeeAmount,
        uint256 royaltyAmount
    ) internal {
        address payable royaltyRecipient = payable(address(0));
        if (royaltyAmount > 0) {
            (address recipient,) = IERC2981(listing.nftContract).royaltyInfo(listing.tokenId, royaltyAmount);
            royaltyRecipient = payable(recipient);
        }

        PaymentUtils.processMarketplacePayments(
            listing.paymentToken == address(0),
            IERC20(listing.paymentToken),
            sellerAmount + marketplaceFeeAmount + royaltyAmount,
            payable(listing.seller),
            payable(feeRecipient),
            royaltyRecipient,
            sellerAmount,
            marketplaceFeeAmount,
            royaltyAmount
        );
    }

    function _calculateRoyalty(address nftContract, uint256 tokenId, uint256 salePrice) internal view returns (uint256) {
        if (IERC165(nftContract).supportsInterface(type(IERC2981).interfaceId)) {
            (, uint256 royaltyFeeAmount) = IERC2981(nftContract).royaltyInfo(tokenId, salePrice);
            return royaltyFeeAmount > MathUtils.calculatePercentage(salePrice, maxRoyalty)
                ? MathUtils.calculatePercentage(salePrice, maxRoyalty)
                : royaltyFeeAmount;
        }
        return 0;
    }

    function _updateStats(address nftContract, uint256 salePrice) internal {
        CollectionStats storage stats = collectionStats[nftContract];
        stats.totalVolume += salePrice;
        stats.totalSales++;
        stats.averagePrice = stats.totalVolume / stats.totalSales;
        if (stats.floorPrice == 0 || salePrice < stats.floorPrice) {
            stats.floorPrice = salePrice;
        }
    }

    function setMarketplaceFee(uint256 newFee) external onlyFeeManager {
        ValidationUtils.requireValidPercentage(newFee);
        marketplaceFee = newFee;
        emit MarketplaceFeeUpdated(newFee);
    }

    function setFeeRecipient(address newRecipient) external onlyAdmin {
        ValidationUtils.requireNonZeroAddress(newRecipient);
        feeRecipient = newRecipient;
        emit FeeRecipientChanged(newRecipient);
    }

    function approvePaymentToken(address token, bool approved) external onlyAdmin {
        approvedPaymentTokens[token] = approved;
        emit PaymentTokenApprovalUpdated(token, approved);
    }

    function emergencyWithdraw() external onlyAdmin {
        uint256 balance = address(this).balance;
        payable(feeRecipient).transfer(balance);
        emit EmergencyWithdrawal(balance);
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}