// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockReverter {
    function revertTest() public pure {
        revert("MockReverter: This function always reverts");
    }
}
