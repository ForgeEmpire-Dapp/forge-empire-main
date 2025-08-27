// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IXPEngine {
    function getXP(address _account) external view returns (uint256);
    function awardXP(address _user, uint256 _amount) external;
    function getLevel(address _user) external view returns (uint256);
}
