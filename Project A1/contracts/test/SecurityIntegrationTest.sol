
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../security/SecurityIntegration.sol";

contract SecurityIntegrationTest is SecurityIntegration {
    
    uint256 public testValue;
    mapping(address => uint256) public userBalances;
    
    function initialize(
        address payable _multiSigGuard,
        address _rateLimiter,
        address _emergencySystem
    ) external initializer {
        __SecurityIntegration_init(_multiSigGuard, _rateLimiter, _emergencySystem);
    }
    
    // Test function with rate limiting
    function testRateLimitedFunction() external withRateLimit {
        testValue++;
    }
    
    // Test function with emergency check
    function testEmergencyFunction() external withEmergencyCheck {
        testValue += 10;
    }
    
    // Test function with multi-sig requirement
    function testMultiSigFunction() external withMultiSig {
        testValue += 100;
    }
    
    // Test function with all security features
    function testFullSecurityFunction() external 
        withRateLimit 
        withEmergencyCheck 
        withMultiSig 
        nonReentrant 
    {
        testValue += 1000;
    }
    
    // Test function with input validation
    function testValidationFunction(
        address _address,
        uint256 _amount,
        string memory _message
    ) external 
        validAddress(_address)
        validAmount(_amount)
        validString(_message, 1, 100)
    {
        userBalances[_address] += _amount;
    }
    
    // Test pausable function
    function testPausableFunction() external whenNotPaused {
        testValue += 5;
    }
    
    // Test secure execution
    function testSecureExecution() external returns (bool) {
        return _secureExecute(msg.sig);
    }
    
    // Test failure recording
    function testRecordFailure() external {
        _recordSecurityFailure(msg.sig);
    }
}