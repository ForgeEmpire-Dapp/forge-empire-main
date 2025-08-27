// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IGuildGovernance.sol";
import "../interfaces/IGuildCore.sol";
import "../libraries/ValidationUtils.sol";
import "../libraries/MathUtils.sol";

/**
 * @title GuildGovernance
 * @dev Manages guild governance and voting mechanisms
 */
contract GuildGovernance is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IGuildGovernance
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ADMIN_ROLE = keccak256("GOVERNANCE_ADMIN_ROLE");
    
    IGuildCore public guildCore;
    
    // State variables
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => Vote)) public votes;
    mapping(uint256 => mapping(address => bool)) public hasVotedMap;
    mapping(uint256 => uint256) public votedCount;
    
    uint256 public nextProposalId;
    uint256 public quorumPercentage; // Percentage of members needed to vote (basis points)
    uint256 public minVotingDuration;
    uint256 public maxVotingDuration;
    
    /**
     * @dev Initialize the guild governance system
     */
    function initialize(
        address admin,
        address _guildCore,
        uint256 _quorumPercentage
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ADMIN_ROLE, admin);
        
        guildCore = IGuildCore(_guildCore);
        quorumPercentage = _quorumPercentage;
        minVotingDuration = 1 days;
        maxVotingDuration = 7 days;
        nextProposalId = 1;
    }
    
    /**
     * @dev Create a new proposal
     */
    function createProposal(
        uint256 guildId,
        ProposalType proposalType,
        string calldata title,
        string calldata description,
        bytes calldata executionData,
        uint256 votingDuration
    ) external whenNotPaused nonReentrant returns (uint256 proposalId) {
        require(guildCore.isGuildMember(guildId, msg.sender), "Not guild member");
        ValidationUtils.requireNonEmptyString(title);
        ValidationUtils.requireValueInRange(votingDuration, minVotingDuration, maxVotingDuration);
        
        IGuildCore.Guild memory guild = guildCore.getGuild(guildId);
        require(guild.isActive, "Guild not active");
        
        proposalId = nextProposalId++;
        uint256 deadline = block.timestamp + votingDuration;
        
        proposals[proposalId] = Proposal({
            proposalId: proposalId,
            guildId: guildId,
            proposer: msg.sender,
            proposalType: proposalType,
            status: ProposalStatus.PENDING,
            title: title,
            description: description,
            createdAt: block.timestamp,
            votingDeadline: deadline,
            votesFor: 0,
            votesAgainst: 0,
            totalEligibleVoters: guildCore.getTotalVotingPower(guildId),
            totalVoters: guild.memberCount,
            executionData: executionData
        });
        
        emit ProposalCreated(proposalId, guildId, msg.sender, proposalType, title);
    }
    
    /**
     * @dev Cast a vote on a proposal
     */
    function castVote(uint256 proposalId, bool support) external whenNotPaused nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.PENDING, "Proposal not active");
        require(block.timestamp < proposal.votingDeadline, "Voting period ended");
        require(!hasVotedMap[proposalId][msg.sender], "Already voted");
        require(guildCore.isGuildMember(proposal.guildId, msg.sender), "Not guild member");
        
        uint256 votingPower = getVotingPower(proposal.guildId, msg.sender);
        require(votingPower > 0, "No voting power");
        
        // Record vote
        votes[proposalId][msg.sender] = Vote({
            voter: msg.sender,
            support: support,
            votingPower: votingPower,
            timestamp: block.timestamp
        });
        
        hasVotedMap[proposalId][msg.sender] = true;
        votedCount[proposalId]++;
        
        // Update vote counts
        if (support) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }
        
        emit VoteCast(proposalId, msg.sender, support, votingPower);
        
        // Check if proposal can be executed immediately
        _checkAndExecuteProposal(proposalId);
    }
    
    /**
     * @dev Execute a proposal if it has passed
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.PENDING, "Proposal not pending");
        require(block.timestamp >= proposal.votingDeadline, "Voting still active");
        
        bool passed = _hasProposalPassed(proposalId);
        
        if (passed) {
            proposal.status = ProposalStatus.EXECUTED;
            _executeProposalLogic(proposalId);
            emit ProposalExecuted(proposalId, true);
        } else {
            proposal.status = ProposalStatus.REJECTED;
            emit ProposalExecuted(proposalId, false);
        }
    }
    
    /**
     * @dev Cancel a proposal (proposer or admin only)
     */
    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.PENDING, "Proposal not pending");
        require(
            proposal.proposer == msg.sender || hasRole(GOVERNANCE_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        
        proposal.status = ProposalStatus.EXPIRED;
        emit ProposalExpired(proposalId);
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }
    
    /**
     * @dev Get vote details
     */
    function getVote(uint256 proposalId, address voter) external view returns (Vote memory) {
        return votes[proposalId][voter];
    }
    
    /**
     * @dev Get voting power for a guild member
     */
    function getVotingPower(uint256 guildId, address member) public view returns (uint256) {
        if (!guildCore.isGuildMember(guildId, member)) {
            return 0;
        }
        
        IGuildCore.Member memory memberInfo = guildCore.getMemberInfo(guildId, member);
        IGuildCore.Guild memory guild = guildCore.getGuild(guildId);
        
        // Base voting power of 1
        uint256 basePower = 1;
        
        // Leader gets additional voting power
        if (guild.leader == member) {
            basePower += 1;
        }
        
        // Additional power based on contribution score
        uint256 contributionBonus = memberInfo.contributionScore / 1000; // 1 extra vote per 1000 contribution
        return basePower + contributionBonus;
    }
    
    /**
     * @dev Check if member has voted
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return hasVotedMap[proposalId][voter];
    }
    
    /**
     * @dev Get proposal result
     */
    function getProposalResult(uint256 proposalId) external view returns (bool passed, bool executed) {
        Proposal memory proposal = proposals[proposalId];
        passed = _hasProposalPassed(proposalId);
        executed = proposal.status == ProposalStatus.EXECUTED;

        // If quorum is not met, the proposal is considered failed but not yet formally rejected
        if (!_isQuorumMet(proposalId)) {
            passed = false;
        }
    }

    /**
     * @dev Check if proposal has passed
     */
    function _hasProposalPassed(uint256 proposalId) internal view returns (bool) {
        Proposal memory proposal = proposals[proposalId];
        
        if (!_isQuorumMet(proposalId)) {
            return false;
        }
        
        // Simple majority
        return proposal.votesFor > proposal.votesAgainst;
    }

    /**
     * @dev Check if quorum has been met
     */
    function _isQuorumMet(uint256 proposalId) internal view returns (bool) {
        Proposal memory proposal = proposals[proposalId];
        uint256 totalVotedPower = proposal.votesFor + proposal.votesAgainst;
        uint256 totalVotingPower = guildCore.getTotalVotingPower(proposal.guildId);
        uint256 requiredVotes = MathUtils.calculatePercentage(totalVotingPower, quorumPercentage);
        
        return totalVotedPower >= requiredVotes;
    }
    
    /**
     * @dev Check and execute proposal if ready
     */
    function _checkAndExecuteProposal(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        
        if (block.timestamp >= proposal.votingDeadline) {
            if (_hasProposalPassed(proposalId)) {
                proposal.status = ProposalStatus.EXECUTED;
                _executeProposalLogic(proposalId);
                emit ProposalExecuted(proposalId, true);
            } else {
                proposal.status = ProposalStatus.REJECTED;
                emit ProposalExecuted(proposalId, false);
            }
        }
    }
    
    /**
     * @dev Execute proposal logic based on type
     */
    function _executeProposalLogic(uint256 proposalId) internal {
        Proposal memory proposal = proposals[proposalId];
        
        if (proposal.proposalType == ProposalType.MEMBER_REMOVAL) {
            address memberToRemove = abi.decode(proposal.executionData, (address));
            guildCore.removeMember(proposal.guildId, memberToRemove);
        } else if (proposal.proposalType == ProposalType.LEADERSHIP_CHANGE) {
            address newLeader = abi.decode(proposal.executionData, (address));
            guildCore.adminTransferLeadership(proposal.guildId, newLeader);
        }
        // Add more proposal type executions as needed
    }
    
    // Admin functions
    function setVotingParameters(
        uint256 newQuorumPercentage,
        uint256 newMinVotingDuration,
        uint256 newMaxVotingDuration
    ) external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        ValidationUtils.requireValidPercentage(newQuorumPercentage);
        ValidationUtils.requireNonZeroAmount(newMinVotingDuration);
        ValidationUtils.requireNonZeroAmount(newMaxVotingDuration);
        require(newMinVotingDuration < newMaxVotingDuration, "Invalid duration range");
        
        quorumPercentage = newQuorumPercentage;
        minVotingDuration = newMinVotingDuration;
        maxVotingDuration = newMaxVotingDuration;
    }

    function pause() external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        _unpause();
    }
}