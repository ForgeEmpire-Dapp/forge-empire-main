// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGuildGovernance
 * @dev Interface for guild governance and voting functionality
 */
interface IGuildGovernance {
    
    enum ProposalType {
        MEMBER_REMOVAL,    // Remove a member from guild
        LEADERSHIP_CHANGE, // Change guild leadership
        SETTINGS_UPDATE,   // Update guild settings
        REWARD_ALLOCATION, // Allocate reward funds
        GENERAL            // General proposal
    }
    
    enum ProposalStatus {
        PENDING,    // Proposal is active and can be voted on
        EXECUTED,   // Proposal was successful and executed
        REJECTED,   // Proposal was rejected by votes
        EXPIRED     // Proposal expired without reaching quorum
    }
    
    struct Proposal {
        uint256 proposalId;
        uint256 guildId;
        address proposer;
        ProposalType proposalType;
        ProposalStatus status;
        string title;
        string description;
        uint256 createdAt;
        uint256 votingDeadline;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 totalEligibleVoters;
        uint256 totalVoters;
        bytes executionData;
    }
    
    struct Vote {
        address voter;
        bool support;
        uint256 votingPower;
        uint256 timestamp;
    }
    
    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed guildId,
        address indexed proposer,
        ProposalType proposalType,
        string title
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 votingPower
    );
    
    event ProposalExecuted(uint256 indexed proposalId, bool successful);
    event ProposalExpired(uint256 indexed proposalId);
    
    // Governance Functions
    function createProposal(
        uint256 guildId,
        ProposalType proposalType,
        string calldata title,
        string calldata description,
        bytes calldata executionData,
        uint256 votingDuration
    ) external returns (uint256 proposalId);
    
    function castVote(uint256 proposalId, bool support) external;
    function executeProposal(uint256 proposalId) external;
    function cancelProposal(uint256 proposalId) external;
    
    // View Functions
    function getProposal(uint256 proposalId) external view returns (Proposal memory);
    function getVote(uint256 proposalId, address voter) external view returns (Vote memory);
    function getVotingPower(uint256 guildId, address member) external view returns (uint256);
    function hasVoted(uint256 proposalId, address voter) external view returns (bool);
    function getProposalResult(uint256 proposalId) external view returns (bool passed, bool executed);
    
    // Admin Functions
    function setVotingParameters(
        uint256 newQuorumPercentage,
        uint256 newMinVotingDuration,
        uint256 newMaxVotingDuration
    ) external;
}