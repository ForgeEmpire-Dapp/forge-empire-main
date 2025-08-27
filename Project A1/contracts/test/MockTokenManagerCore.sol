// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockTokenManagerCore {
    mapping(address => bool) public tokenLaunched;
    address public feeWallet;
    uint256 public protocolFee;
    
    function setTokenLaunched(address token, bool launched) external {
        tokenLaunched[token] = launched;
    }
    
    function setProtocolConfig(address _feeWallet, uint256 _protocolFee) external {
        feeWallet = _feeWallet;
        protocolFee = _protocolFee;
    }
    
    function isTokenLaunched(address token) external view returns (bool) {
        return tokenLaunched[token];
    }
    
    function protocolConfig() external view returns (address, uint256) {
        return (feeWallet, protocolFee);
    }
}