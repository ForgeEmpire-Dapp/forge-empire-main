// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGuildCore
 * @dev Interface for core guild functionality
 */
interface IGuildCore {
    
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
    
    // Events
    event GuildCreated(uint256 indexed guildId, string name, address indexed leader);
    event MemberJoined(uint256 indexed guildId, address indexed member);
    event MemberLeft(uint256 indexed guildId, address indexed member);
    event LeadershipTransferred(uint256 indexed guildId, address indexed oldLeader, address indexed newLeader);
    
    // Core Functions
    function createGuild(
        string calldata name,
        string calldata description,
        uint256 requiredXP
    ) external payable returns (uint256 guildId);
    
    function joinGuild(uint256 guildId) external;
    function leaveGuild(uint256 guildId) external;
    function transferLeadership(uint256 guildId, address newLeader) external;
    
    // View Functions
    function getGuild(uint256 guildId) external view returns (Guild memory);
    function getMember(uint256 guildId, address member) external view returns (Member memory);
    function getGuildMembers(uint256 guildId) external view returns (address[] memory);
    function getUserGuild(address user) external view returns (uint256);
    function isGuildMember(uint256 guildId, address user) external view returns (bool);
    function getTotalVotingPower(uint256 guildId) external view returns (uint256);
    function getMemberInfo(uint256 guildId, address member) external view returns (Member memory);
    
    // Management Functions
    function updateMemberContribution(uint256 guildId, address member, uint256 contributionPoints) external;
    
    // Admin Functions
    function setMinRequiredXP(uint256 newMinXP) external;
    function setMaxGuildSize(uint256 newMaxSize) external;
    function removeMember(uint256 guildId, address member) external;
    function adminTransferLeadership(uint256 guildId, address newLeader) external;
}