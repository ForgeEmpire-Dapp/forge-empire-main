// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockReferralEngine {
    mapping(address => address) public registeredReferrals;
    
    function registerReferral(address user, address referrer) external {
        registeredReferrals[user] = referrer;
    }
}