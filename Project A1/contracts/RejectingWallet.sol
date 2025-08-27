// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RejectingWallet {
    error PaymentRejected();

    receive() external payable {
        revert PaymentRejected();
    }

    fallback() external payable {
        revert PaymentRejected();
    }
}
