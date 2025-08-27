// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract MockXPEngine is AccessControl {
    mapping(address => uint256) public xp;
    mapping(address => uint256) public level;
    bool private _awardXPCalled;

    bytes32 public constant XP_AWARDER_ROLE = keccak256("XP_AWARDER_ROLE");

    event XPAwarded(address indexed user, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(XP_AWARDER_ROLE, msg.sender);
    }

    function awardXP(address user, uint256 amount) external {
        // For testing purposes, we can remove the onlyRole modifier
        // to allow easier testing of other contracts.
        // require(hasRole(XP_AWARDER_ROLE, msg.sender), "MockXPEngine: Caller is not an XP awarder");
        xp[user] += amount;
        _awardXPCalled = true;
        emit XPAwarded(user, amount);
    }

    function getXP(address user) external view returns (uint256) {
        return xp[user];
    }

    function getLevel(address user) external view returns (uint256) {
        return level[user] == 0 ? 1 : level[user];
    }

    function setLevel(address user, uint256 _level) external {
        level[user] = _level;
    }

    function resetXP(address user) external {
        xp[user] = 0;
    }

    function awardXPCalled() external view returns (bool) {
        return _awardXPCalled;
    }
    
    function setUserXP(address user, uint256 amount, uint256 _level) external {
        xp[user] = amount;
        level[user] = _level;
    }
}