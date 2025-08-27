// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PaymentUtils
 * @dev Utility functions for handling payments in ETH and ERC20 tokens
 */
library PaymentUtils {
    using SafeERC20 for IERC20;
    
    /**
     * @dev Execute ETH payment safely
     * @param recipient Payment recipient
     * @param amount Amount to transfer
     */
    function executeETHPayment(address payable recipient, uint256 amount) internal {
        require(amount > 0, "PaymentUtils: zero amount");
        require(recipient != address(0), "PaymentUtils: zero recipient");
        
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "PaymentUtils: ETH transfer failed");
    }
    
    /**
     * @dev Execute ERC20 payment safely
     * @param token Token contract
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer
     */
        function executeTokenPayment(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) internal {
        require(amount > 0, "PaymentUtils: zero amount");
        require(to != address(0), "PaymentUtils: zero recipient");
        
        if (from == address(this)) {
            token.safeTransfer(to, amount);
        } else {
            token.safeTransferFrom(from, to, amount);
        }
    }
    
    /**
     * @dev Process marketplace payment distribution
     * @param isETHPayment Whether payment is in ETH
     * @param paymentToken Token contract (ignored if ETH)
     * @param totalAmount Total payment amount
     * @param seller Seller address
     * @param feeRecipient Fee recipient address
     * @param royaltyRecipient Royalty recipient address
     * @param sellerAmount Amount for seller
     * @param feeAmount Fee amount
     * @param royaltyAmount Royalty amount
     */
    function processMarketplacePayments(
        bool isETHPayment,
        IERC20 paymentToken,
        uint256 totalAmount,
        address payable seller,
        address payable feeRecipient,
        address payable royaltyRecipient,
        uint256 sellerAmount,
        uint256 feeAmount,
        uint256 royaltyAmount
    ) internal {
        require(sellerAmount + feeAmount + royaltyAmount == totalAmount, "PaymentUtils: amount mismatch");
        
        if (isETHPayment) {
            if (sellerAmount > 0) executeETHPayment(seller, sellerAmount);
            if (feeAmount > 0) executeETHPayment(feeRecipient, feeAmount);
            if (royaltyAmount > 0) executeETHPayment(royaltyRecipient, royaltyAmount);
        } else {
            if (sellerAmount > 0) executeTokenPayment(paymentToken, address(this), seller, sellerAmount);
            if (feeAmount > 0) executeTokenPayment(paymentToken, address(this), feeRecipient, feeAmount);
            if (royaltyAmount > 0) executeTokenPayment(paymentToken, address(this), royaltyRecipient, royaltyAmount);
        }
    }
    
    /**
     * @dev Refund ETH payment
     * @param recipient Refund recipient
     * @param amount Amount to refund
     */
    function refundETHPayment(address payable recipient, uint256 amount) internal {
        if (amount > 0) {
            executeETHPayment(recipient, amount);
        }
    }
    
    /**
     * @dev Refund token payment
     * @param token Token contract
     * @param recipient Refund recipient
     * @param amount Amount to refund
     */
    function refundTokenPayment(IERC20 token, address recipient, uint256 amount) internal {
        if (amount > 0) {
            executeTokenPayment(token, address(this), recipient, amount);
        }
    }
    
    /**
     * @dev Check and transfer payment from user
     * @param isETHPayment Whether payment is in ETH
     * @param paymentToken Token contract (ignored if ETH)
     * @param payer Address making payment
     * @param amount Payment amount
     * @param msgValue msg.value from transaction
     */
            function collectPayment(
        bool isETHPayment,
        IERC20 paymentToken,
        address payer,
        uint256 amount,
        uint256 msgValue
    ) internal {
        if (isETHPayment) {
            require(msgValue == amount, "PaymentUtils: incorrect ETH amount");
        } else {
            require(msgValue == 0, "PaymentUtils: unexpected ETH sent");
            executeTokenPayment(paymentToken, payer, address(this), amount);
        }
    }
}