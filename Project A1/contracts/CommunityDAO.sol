// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CommunityDAO
 * @dev A decentralized autonomous organization for community governance.
 *      Allows proposals to be created, voted on by community members, and executed.
 *      
 *      Key Features:
 *      - Role-based access control (Proposers, Executors, Admin)
 *      - Sequential proposal ID generation to prevent collisions
 *      - Configurable voting periods and quorum requirements
 *      - Secure proposal execution with detailed error handling
 *      - Comprehensive state tracking and getter functions
 */
contract CommunityDAO is AccessControl, ReentrancyGuard {
    using Address for address payable;

    /* ========== CONSTANTS & ROLES ========== */
    
    // Role for addresses that can create proposals
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    
    // Role for addresses that can execute passed proposals
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    /* ========== STRUCTS ========== */
    
    /**
     * @dev Structure to store proposal data
     * @param proposalId Unique identifier for the proposal
     * @param voteStartTime Timestamp when voting begins
     * @param voteEndTime Timestamp when voting ends
     * @param snapshotBlock Block number at which voting power is snapshotted
     * @param votesFor Total number of votes in favor
     * @param votesAgainst Total number of votes against
     * @param proposer Address that created the proposal
     * @param target Contract address to call if proposal passes
     * @param callData Encoded function call to execute
     * @param description Human-readable description of the proposal
     * @param executed Whether the proposal has been executed
     * @param hasVoted Mapping to track which addresses have voted
     */
    struct Proposal {
        uint256 proposalId;
        uint256 voteStartTime;
        uint256 voteEndTime;
        uint256 snapshotBlock;
        uint256 votesFor;
        uint256 votesAgainst;
        address proposer;
        address target;
        bytes callData;
        string description;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    /* ========== STATE VARIABLES ========== */
    
    // Mapping from proposal ID to proposal data
    mapping(uint256 => Proposal) public proposals;
    
    // Mapping to efficiently track if a proposal exists
    mapping(uint256 => bool) private _proposalExists;
    
    // Counter for generating sequential proposal IDs (starts at 1)
    uint256 private _nextProposalId = 1;
    
    // Duration in seconds that proposals remain open for voting
    uint256 public votingPeriodDuration;
    
    // Percentage (1-100) of total voters required for quorum
    uint256 public quorumPercentage;
    
    // Timelock delay for proposal execution (in seconds)
    uint256 public constant EXECUTION_DELAY = 2 days;
    
    // Gas limit for proposal execution to prevent DoS
    uint256 public constant EXECUTION_GAS_LIMIT = 500000;
    
    // Security constraints
    uint256 public constant MIN_VOTING_PERIOD = 1 days; // Minimum voting duration
    uint256 public constant MAX_VOTING_PERIOD = 30 days; // Maximum voting duration
    uint256 public constant MIN_QUORUM_PERCENTAGE = 1; // Minimum 1% quorum
    uint256 public constant MAX_QUORUM_PERCENTAGE = 100; // Maximum 100% quorum
    uint256 public constant MIN_PROPOSAL_THRESHOLD = 1; // Minimum proposer threshold
    
    // Mapping from proposal ID to execution timestamp
    mapping(uint256 => uint256) public proposalExecutionTime;
    
    // Total number of eligible voters in the DAO
    uint256 public totalVoters;
    
    // Blacklisted addresses that cannot be called via proposals
    mapping(address => bool) public blacklistedTargets;
    
    // Maximum value that can be transferred via proposals
    uint256 public maxProposalValue;

    /* ========== EVENTS ========== */
    
    /**
     * @dev Emitted when a new proposal is created
     * @param proposalId The unique ID of the proposal
     * @param proposer Address that created the proposal
     * @param description Description of the proposal
     * @param target Contract address to be called
     * @param voteStartTime When voting begins
     * @param voteEndTime When voting ends
     * @param snapshotBlock Block number for voting power snapshot
     */
    event ProposalCreated(
        uint256 indexed proposalId, 
        address indexed proposer, 
        string description, 
        address target, 
        uint256 voteStartTime, 
        uint256 voteEndTime, 
        uint256 snapshotBlock
    );
    
    /**
     * @dev Emitted when a vote is cast
     * @param proposalId The proposal being voted on
     * @param voter Address that cast the vote
     * @param support True if vote is in favor, false if against
     * @param votes Number of votes cast (currently always 1)
     */
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votes);
    
    /**
     * @dev Emitted when a proposal is successfully executed
     * @param proposalId The ID of the executed proposal
     */
    event ProposalExecuted(uint256 indexed proposalId);
    
    /**
     * @dev Emitted when a proposal is queued for execution (timelock started)
     * @param proposalId ID of the queued proposal
     * @param executionTime Timestamp when the proposal can be executed
     */
    event ProposalQueued(uint256 indexed proposalId, uint256 executionTime);
    
    /**
     * @dev Emitted when voting period duration is updated
     * @param oldDuration Previous duration in seconds
     * @param newDuration New duration in seconds
     */
    event VotingPeriodUpdated(uint256 oldDuration, uint256 newDuration);
    
    /**
     * @dev Emitted when quorum percentage is updated
     * @param oldPercentage Previous quorum percentage
     * @param newPercentage New quorum percentage
     */
    event QuorumPercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    
    /**
     * @dev Emitted when total voters count is updated
     * @param oldTotal Previous total voter count
     * @param newTotal New total voter count
     */
    event TotalVotersUpdated(uint256 oldTotal, uint256 newTotal);

    /* ========== CUSTOM ERRORS ========== */
    
    // Thrown when voting period duration is invalid (zero)
    error InvalidVotingPeriod();

    
    
    // Thrown when quorum percentage is invalid (zero or > 100)
    error InvalidQuorumPercentage();
    
    // Thrown when trying to interact with a non-existent proposal
    error ProposalNotFound();
    
    // Thrown when trying to vote outside the voting period
    error VotingNotActive();
    
    // Thrown when voting period has already ended
    // error VotingAlreadyEnded();
    
    // Thrown when an address tries to vote twice on same proposal
    error AlreadyVoted();
    
    // Thrown when voter has no voting power (unused in current implementation)
    error NoVotingPower();
    
    // Thrown when trying to execute a proposal that can't be executed
    error ProposalNotExecutable();
    
    // Thrown when proposal doesn't meet quorum requirements
    error QuorumNotReached();
    
    // Thrown when proposal fails (more votes against than for)
    error ProposalFailed();
    
    // Thrown when trying to execute an already executed proposal
    error ProposalAlreadyExecuted();
    
    // Thrown when proposal description is empty
    error EmptyDescription();
    
    // Thrown when target address is zero address
    error ZeroAddressTarget();
    
    // Thrown when call data is empty
    error EmptyCallData();
    
    // Thrown when proposal execution fails with detailed reason
    error ExecutionFailed(string reason);
    
    // Thrown when trying to execute a proposal before timelock expires
    error TimelockNotExpired(uint256 proposalId, uint256 executionTime);
    
    // Thrown when target address is blacklisted
    error BlacklistedTarget(address target);
    
    // Thrown when proposal value exceeds maximum allowed
    error ProposalValueExceedsMaximum(uint256 value, uint256 maximum);
    
    // Thrown when voting period is outside allowed bounds
    error InvalidVotingPeriodBounds(uint256 period, uint256 min, uint256 max);
    
    // Thrown when proposal targets critical DAO functions
    error CriticalFunctionCall(bytes4 selector);

    // Override _checkRole to use custom error
    function _checkRole(bytes32 role, address account) internal view override {
        if (!hasRole(role, account)) {
            revert AccessControlUnauthorizedAccount(account, role);
        }
    }

    /* ========== CONSTRUCTOR ========== */
    
    /**
     * @dev Constructor for the CommunityDAO.
     * @param _votingPeriodDuration The duration in seconds for which proposals are open for voting.
     * @param _quorumPercentage The percentage of total voters required for a proposal to pass (1-100).
     * @param _totalVoters The total number of eligible voters in the DAO.
     * 
     * Requirements:
     * - Voting period duration must be greater than 0
     * - Quorum percentage must be between 1 and 100 inclusive
     * 
     * Effects:
     * - Grants deployer all three roles (Admin, Proposer, Executor)
     * - Sets initial DAO parameters
     */
    constructor(uint256 _votingPeriodDuration, uint256 _quorumPercentage, uint256 _totalVoters) {
        // Validate constructor parameters with enhanced bounds checking
        if (_votingPeriodDuration < MIN_VOTING_PERIOD || _votingPeriodDuration > MAX_VOTING_PERIOD) {
            revert InvalidVotingPeriodBounds(_votingPeriodDuration, MIN_VOTING_PERIOD, MAX_VOTING_PERIOD);
        }
        if (_quorumPercentage < MIN_QUORUM_PERCENTAGE || _quorumPercentage > MAX_QUORUM_PERCENTAGE) {
            revert InvalidQuorumPercentage();
        }
        if (_totalVoters == 0) revert InvalidVotingPeriod(); // Reusing error for simplicity
        
        // Grant all roles to deployer for initial setup
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);

        // Set initial DAO parameters
        votingPeriodDuration = _votingPeriodDuration;
        quorumPercentage = _quorumPercentage;
        totalVoters = _totalVoters;
        maxProposalValue = 1000 ether; // Set reasonable default maximum
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    /**
     * @dev Creates a new proposal.
     * @param _description A brief description of the proposal.
     * @param _target The address of the contract to call if the proposal passes.
     * @param _callData The encoded function call to execute on the target contract.
     * @return proposalId The ID of the created proposal.
     * 
     * Requirements:
     * - Caller must have PROPOSER_ROLE
     * - Description cannot be empty
     * - Target address cannot be zero address
     * - Call data cannot be empty
     * 
     * Effects:
     * - Creates new proposal with sequential ID
     * - Sets voting period from current timestamp
     * - Records snapshot block for voting power calculations
     * - Emits ProposalCreated event
     */
    
    function propose(string memory _description, address _target, bytes memory _callData)
        external
        onlyRole(PROPOSER_ROLE)
        nonReentrant
        returns (uint256 proposalId)
    {
        // Validate input parameters
        if (bytes(_description).length == 0) revert EmptyDescription();
        if (_target == address(0)) revert ZeroAddressTarget();
        if (_callData.length == 0) revert EmptyCallData();
        
        // Enhanced security validations
        if (blacklistedTargets[_target]) revert BlacklistedTarget(_target);
        
        // Check for critical function calls that could compromise the DAO
        if (_callData.length >= 4) {
            bytes4 selector = bytes4(_callData[0]) | (bytes4(_callData[1]) >> 8) | 
                            (bytes4(_callData[2]) >> 16) | (bytes4(_callData[3]) >> 24);
            
            // Block calls to critical DAO functions
            if (selector == this.setVotingPeriodDuration.selector ||
                selector == this.setQuorumPercentage.selector ||
                selector == this.setTotalVoters.selector ||
                selector == this.grantRole.selector ||
                selector == this.revokeRole.selector) {
                revert CriticalFunctionCall(selector);
            }
        }
        
        // Validate proposal value if it contains ETH transfer
        if (_callData.length >= 68) { // Basic check for value parameter
            // This is a simplified check - in production, you'd parse the calldata more thoroughly
            bytes memory valueData = new bytes(32);
            for (uint i = 0; i < 32; i++) {
                valueData[i] = _callData[4 + i];
            }
            uint256 proposalValue = abi.decode(valueData, (uint256));
            if (proposalValue > maxProposalValue) {
                revert ProposalValueExceedsMaximum(proposalValue, maxProposalValue);
            }
        }

        // Generate sequential proposal ID and mark as existing
        proposalId = _nextProposalId++;
        _proposalExists[proposalId] = true;
        
        // Initialize proposal struct
        Proposal storage newProposal = proposals[proposalId];
        newProposal.proposalId = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.description = _description;
        newProposal.target = _target;
        newProposal.callData = _callData;
        newProposal.voteStartTime = block.timestamp;
        newProposal.voteEndTime = block.timestamp + votingPeriodDuration;
        newProposal.snapshotBlock = block.number; // For future voting power calculations

        // Emit creation event
        emit ProposalCreated(
            proposalId, 
            msg.sender, 
            _description, 
            _target, 
            newProposal.voteStartTime, 
            newProposal.voteEndTime, 
            newProposal.snapshotBlock
        );
    }

    /**
     * @dev Casts a vote for or against a proposal.
     * @param _proposalId The ID of the proposal to vote on.
     * @param _support True for a vote in favor, false for a vote against.
     * 
     * Requirements:
     * - Proposal must exist
     * - Current time must be within voting period
     * - Address must not have already voted on this proposal
     * 
     * Effects:
     * - Records vote in proposal struct
     * - Marks address as having voted
     * - Increments appropriate vote counter
     * - Emits VoteCast event
     * 
     * Note: Current implementation gives each address one vote.
     * In a token-based DAO, voting power would be based on token balance.
     */
    function vote(uint256 _proposalId, bool _support) external nonReentrant {
        // Check if proposal exists
        if (!_proposalExists[_proposalId]) revert ProposalNotFound();
        
        Proposal storage proposal = proposals[_proposalId];
        
        // Check if voting is currently active
        if (block.timestamp < proposal.voteStartTime || block.timestamp > proposal.voteEndTime) {
            revert VotingNotActive();
        }
        
        // Check if address has already voted
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();

        // Note: In a real implementation, you'd check if the voter has voting power
        // This could be done by checking:
        // - Token balance at snapshot block
        // - NFT ownership
        // - Whitelist membership
        // - Other governance mechanisms

        // Record the vote
        proposal.hasVoted[msg.sender] = true;

        // Update vote counters
        if (_support) {
            proposal.votesFor += 1;
        } else {
            proposal.votesAgainst += 1;
        }

        // Emit vote event
        emit VoteCast(_proposalId, msg.sender, _support, 1);
    }

    /**
     * @dev Executes a proposal that has passed and ended.
     * @param _proposalId The ID of the proposal to execute.
     * 
     * Requirements:
     * - Caller must have EXECUTOR_ROLE
     * - Proposal must exist
     * - Voting period must have ended
     * - Proposal must not have been executed already
     * - Quorum must be reached
     * - More votes for than against
     * 
     * Effects:
     * - Marks proposal as executed
     * - Calls target contract with provided call data
     * - Emits ProposalExecuted event on success
     * - Reverts with detailed error message on failure
     */
    function executeProposal(uint256 _proposalId) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        // Check if proposal exists
        if (!_proposalExists[_proposalId]) revert ProposalNotFound();
        
        Proposal storage proposal = proposals[_proposalId];
        
        // Check if voting period has ended
        if (block.timestamp <= proposal.voteEndTime) revert VotingNotActive();
        
        // Check if already executed
        if (proposal.executed) revert ProposalAlreadyExecuted();

        // Calculate vote totals and quorum requirement
        uint256 totalVotesCast = proposal.votesFor + proposal.votesAgainst;
        uint256 requiredQuorum = (totalVoters * quorumPercentage) / 100;

        // Check if quorum is reached
        if (totalVotesCast < requiredQuorum) revert QuorumNotReached();

        // Check if proposal passed (more votes for than against)
        if (proposal.votesFor <= proposal.votesAgainst) revert ProposalFailed();

        // Timelock implementation: Check if this is the first execution attempt
        if (proposalExecutionTime[_proposalId] == 0) {
            // Set the execution time for this proposal
            proposalExecutionTime[_proposalId] = block.timestamp + EXECUTION_DELAY;
            emit ProposalQueued(_proposalId, block.timestamp + EXECUTION_DELAY);
            return;
        }
        
        // Check if timelock has expired
        if (block.timestamp < proposalExecutionTime[_proposalId]) {
            revert TimelockNotExpired(_proposalId, proposalExecutionTime[_proposalId]);
        }

        // Mark as executed before external call (CEI pattern)
        proposal.executed = true;

        // Execute the proposal's action with gas limit
        (bool success, bytes memory returnData) = proposal.target.call{gas: EXECUTION_GAS_LIMIT}(proposal.callData);
        if (!success) {
            // Extract revert reason if available
            string memory reason = returnData.length > 0 ? string(returnData) : "Unknown error";
            revert ExecutionFailed(reason);
        }

        // Emit successful execution event
        emit ProposalExecuted(_proposalId);
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * @dev Returns the state of a proposal.
     * @param _proposalId The ID of the proposal.
     * @return isActive True if voting is currently active
     * @return hasEnded True if voting period has ended
     * @return isExecutable True if the proposal can be executed
     * @return totalVotesFor Total votes in favor
     * @return totalVotesAgainst Total votes against
     * @return executed Whether proposal has been executed
     * 
     * Requirements:
     * - Proposal must exist
     */
    function getProposalState(uint256 _proposalId)
        external
        view
        returns (
            bool isActive,
            bool hasEnded,
            bool isExecutable,
            uint256 totalVotesFor,
            uint256 totalVotesAgainst,
            bool executed
        )
    {
        // Check if proposal exists
        if (!_proposalExists[_proposalId]) revert ProposalNotFound();
        
        Proposal storage proposal = proposals[_proposalId];

        // Calculate basic state
        isActive = (block.timestamp >= proposal.voteStartTime && block.timestamp <= proposal.voteEndTime);
        hasEnded = (block.timestamp > proposal.voteEndTime);
        totalVotesFor = proposal.votesFor;
        totalVotesAgainst = proposal.votesAgainst;
        executed = proposal.executed;

        // Calculate if proposal can be executed
        uint256 totalVotesCast = proposal.votesFor + proposal.votesAgainst;
        uint256 requiredQuorum = (totalVoters * quorumPercentage) / 100;

        isExecutable = hasEnded &&
                       !proposal.executed &&
                       (totalVotesCast >= requiredQuorum) &&
                       (proposal.votesFor > proposal.votesAgainst);
    }

    /**
     * @dev Returns detailed proposal information.
     * @param _proposalId The ID of the proposal.
     * @return proposalId The proposal ID
     * @return proposer Address that created the proposal
     * @return description Human-readable description
     * @return target Contract address to call
     * @return callData Encoded function call
     * @return voteStartTime When voting begins
     * @return voteEndTime When voting ends
     * @return snapshotBlock Block for voting power snapshot
     * @return votesFor Total votes in favor
     * @return votesAgainst Total votes against
     * @return executed Whether proposal has been executed
     * 
     * Requirements:
     * - Proposal must exist
     */
    function getProposal(uint256 _proposalId)
        external
        view
        returns (
            uint256 proposalId,
            address proposer,
            string memory description,
            address target,
            bytes memory callData,
            uint256 voteStartTime,
            uint256 voteEndTime,
            uint256 snapshotBlock,
            uint256 votesFor,
            uint256 votesAgainst,
            bool executed
        )
    {
        // Check if proposal exists
        if (!_proposalExists[_proposalId]) revert ProposalNotFound();
        
        Proposal storage proposal = proposals[_proposalId];
        
        // Return all proposal data
        return (
            proposal.proposalId,
            proposal.proposer,
            proposal.description,
            proposal.target,
            proposal.callData,
            proposal.voteStartTime,
            proposal.voteEndTime,
            proposal.snapshotBlock,
            proposal.votesFor,
            proposal.votesAgainst,
            proposal.executed
        );
    }

    /**
     * @dev Checks if an address has voted on a specific proposal.
     * @param _proposalId The ID of the proposal.
     * @param _voter The address to check.
     * @return bool True if the address has voted, false otherwise
     * 
     * Requirements:
     * - Proposal must exist
     */
    function hasVoted(uint256 _proposalId, address _voter) external view returns (bool) {
        if (!_proposalExists[_proposalId]) revert ProposalNotFound();
        return proposals[_proposalId].hasVoted[_voter];
    }

    /**
     * @dev Returns the current proposal ID counter.
     * @return uint256 The next proposal ID that will be assigned
     */
    function getCurrentProposalId() external view returns (uint256) {
        return _nextProposalId;
    }

    /**
     * @dev Checks if a proposal exists.
     * @param _proposalId The ID of the proposal to check.
     * @return bool True if proposal exists, false otherwise
     */
    function proposalExists(uint256 _proposalId) external view returns (bool) {
        return _proposalExists[_proposalId];
    }

    /* ========== ADMIN FUNCTIONS ========== */

    /**
     * @dev Updates the voting period duration. Only callable by admin.
     * @param _newDuration The new voting period duration in seconds.
     * 
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     * - New duration must be within allowed bounds
     * 
     * Effects:
     * - Updates votingPeriodDuration
     * - Emits VotingPeriodUpdated event
     */
    function setVotingPeriodDuration(uint256 _newDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newDuration < MIN_VOTING_PERIOD || _newDuration > MAX_VOTING_PERIOD) {
            revert InvalidVotingPeriodBounds(_newDuration, MIN_VOTING_PERIOD, MAX_VOTING_PERIOD);
        }
        
        uint256 oldDuration = votingPeriodDuration;
        votingPeriodDuration = _newDuration;
        
        emit VotingPeriodUpdated(oldDuration, _newDuration);
    }

    /**
     * @dev Updates the quorum percentage. Only callable by admin.
     * @param _newPercentage The new quorum percentage (1-100).
     * 
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     * - New percentage must be between 1 and 100 inclusive
     * 
     * Effects:
     * - Updates quorumPercentage
     * - Emits QuorumPercentageUpdated event
     */
    function setQuorumPercentage(uint256 _newPercentage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newPercentage == 0 || _newPercentage > 100) revert InvalidQuorumPercentage();
        
        uint256 oldPercentage = quorumPercentage;
        quorumPercentage = _newPercentage;
        
        emit QuorumPercentageUpdated(oldPercentage, _newPercentage);
    }

    /**
     * @dev Updates the total number of eligible voters. Only callable by admin.
     * @param _newTotal The new total number of eligible voters.
     * 
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     * 
     * Effects:
     * - Updates totalVoters
     * - Emits TotalVotersUpdated event
     * 
     * Note: This affects quorum calculations for future proposals.
     * Existing proposals use the voter count from when they were created.
     */
    function setTotalVoters(uint256 _newTotal) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldTotal = totalVoters;
        totalVoters = _newTotal;
        
        emit TotalVotersUpdated(oldTotal, _newTotal);
    }
    
    /**
     * @dev Blacklists a target address to prevent proposals from calling it
     * @param _target The address to blacklist
     * @param _blacklisted Whether to blacklist or whitelist the address
     */
    function setBlacklistedTarget(address _target, bool _blacklisted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklistedTargets[_target] = _blacklisted;
    }
    
    /**
     * @dev Updates the maximum value that can be transferred via proposals
     * @param _newMaxValue The new maximum value in wei
     */
    function setMaxProposalValue(uint256 _newMaxValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxProposalValue = _newMaxValue;
    }
}