
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/finance/VestingWallet.sol";

/**
 * @title VestingWallet
 * @dev A simple extension of OpenZeppelin's VestingWallet for token vesting.
 *
 * This contract is designed to hold tokens and release them to a beneficiary
 * according to a predefined vesting schedule. It can be used for various
 * purposes, such as team token allocations, advisor grants, or community rewards.
 *
 * The vesting schedule is defined by a start timestamp, a duration, and an
 * optional cliff duration. Tokens are released linearly over the vesting period.
 */
contract ForgeVestingWallet is VestingWallet {
    /**
     * @dev Initializes a VestingWallet.
     *
     * @param beneficiary_ The address of the beneficiary.
     * @param start_ The Unix timestamp when the vesting schedule starts.
     * @param duration_ The duration of the vesting schedule in seconds.
     */
    constructor(
        address beneficiary_,
        uint64 start_,
        uint64 duration_
    ) VestingWallet(beneficiary_, start_, duration_) {}
}
