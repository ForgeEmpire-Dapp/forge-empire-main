// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This is a mock contract for GuildCore, used for testing GuildGovernance.
// It does not inherit from the real GuildCore to avoid dealing with upgradeability complexities in tests.

// Minimal struct definitions to match what GuildGovernance expects.
struct Guild {
    uint256 guildId;
    string name;
    string description;
    address leader;
    uint256 memberCount;
    uint256 createdAt;
    uint256 requiredXP;
    bool isActive;
    uint256 totalContributions;
}

struct Member {
    address memberAddress;
    uint256 joinedAt;
    uint256 contributionScore;
    bool isActive;
    string role;
}

contract MockGuildCore {
    mapping(uint256 => Guild) private _guilds;
    mapping(uint256 => mapping(address => Member)) private _membersInfo;
    mapping(uint256 => mapping(address => bool)) private _isMember;
    mapping(uint256 => address[]) private _membersList;
    mapping(uint256 => uint256) private _totalVotingPower;

    // --- Functions for test setup ---

    function setMockGuild(uint256 guildId, Guild memory guild) external {
        _guilds[guildId] = guild;
    }

    function setMockMember(uint256 guildId, address memberAddress, Member memory member) external {
        _membersInfo[guildId][memberAddress] = member;
    }

    function setGuildMembership(uint256 guildId, address memberAddress, bool isMember) external {
        _isMember[guildId][memberAddress] = isMember;
    }

    function setGuildMembers(uint256 guildId, address[] memory members) external {
        _membersList[guildId] = members;
    }

    function setTotalVotingPower(uint256 guildId, uint256 power) external {
        _totalVotingPower[guildId] = power;
    }

        function updateMemberContribution(uint256 guildId, address member, uint256 contributionPoints) external {
        // Mock implementation: do nothing or store for verification if needed
        _lastUpdatedMember = member;
        _lastContributionUpdate = contributionPoints;
    }

    address public _lastUpdatedMember;
    uint256 public _lastContributionUpdate;

    function lastUpdatedMember() external view returns (address) {
        return _lastUpdatedMember;
    }

    function lastContributionUpdate() external view returns (uint256) {
        return _lastContributionUpdate;
    }

    // --- Functions called by GuildGovernance contract ---

    function getGuild(uint256 guildId) external view returns (Guild memory) {
        return _guilds[guildId];
    }

    function getMember(uint256 guildId, address memberAddress) external view returns (Member memory) {
        return _membersInfo[guildId][memberAddress];
    }

    function getMemberInfo(uint256 guildId, address memberAddress) external view returns (Member memory) {
        return _membersInfo[guildId][memberAddress];
    }

    function isGuildMember(uint256 guildId, address account) external view returns (bool) {
        return _isMember[guildId][account];
    }

    function getGuildMembers(uint256 guildId) external view returns (address[] memory) {
        return _membersList[guildId];
    }

    function getTotalVotingPower(uint256 guildId) external view returns (uint256) {
        // In a real scenario, this would calculate power based on members' contributions or other factors.
        // For the mock, we return a pre-set value.
        if (_totalVotingPower[guildId] > 0) {
            return _totalVotingPower[guildId];
        }
        return _membersList[guildId].length; // Fallback to member count if not set
    }
}
