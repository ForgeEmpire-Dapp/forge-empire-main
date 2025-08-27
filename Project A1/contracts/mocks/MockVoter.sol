// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICommunityDAO {
    function vote(uint256 proposalId, bool support) external;
}

contract MockVoter {
    function voteOnDAO(address daoAddress, uint256 proposalId, bool support) external {
        ICommunityDAO(daoAddress).vote(proposalId, support);
    }
}
