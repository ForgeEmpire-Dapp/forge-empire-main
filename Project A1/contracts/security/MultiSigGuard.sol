// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title MultiSigGuard
 * @dev Multi-signature protection for critical admin functions
 * @notice Requires multiple admin approvals for sensitive operations
 */
contract MultiSigGuard is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    
    struct Proposal {
        bytes32 id;
        address target;
        bytes data;
        uint256 value;
        address proposer;
        uint256 createdAt;
        uint256 executedAt;
        uint256 approvals;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasApproved;
    }
    
    // Configuration
    uint256 public requiredApprovals;
    uint256 public proposalLifetime; // Time before proposal expires
    uint256 public minDelay; // Minimum delay before execution
    
    // Proposals
    mapping(bytes32 => Proposal) public proposals;
    bytes32[] public proposalIds;
    
    // Emergency settings
    bool public emergencyMode;
    address public emergencyAdmin;
    
    // Events
    event ProposalCreated(bytes32 indexed proposalId, address indexed target, address indexed proposer);
    event ProposalApproved(bytes32 indexed proposalId, address indexed approver, uint256 approvals);
    event ProposalExecuted(bytes32 indexed proposalId, address indexed executor);
    event ProposalCancelled(bytes32 indexed proposalId, address indexed canceller);
    event RequiredApprovalsUpdated(uint256 oldRequired, uint256 newRequired);
    event EmergencyModeToggled(bool enabled, address admin);
    
    // Custom Errors
    error ProposalNotFound();
    error ProposalAlreadyExecuted();
    error ProposalExpired();
    error InsufficientApprovals();
    error AlreadyApproved();
    error NotProposer();
    error DelayNotMet();
    error EmergencyModeActive();
    error InvalidTarget();
    error ExecutionFailed();
    
    function initialize(
        uint256 _requiredApprovals,
        uint256 _proposalLifetime,
        uint256 _minDelay,
        address[] memory _signers
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        
        require(_requiredApprovals > 0 && _requiredApprovals <= _signers.length, "Invalid required approvals");
        require(_proposalLifetime > 0, "Invalid proposal lifetime");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        // Grant signer roles
        for (uint256 i = 0; i < _signers.length; i++) {
            _grantRole(SIGNER_ROLE, _signers[i]);
        }
        
        requiredApprovals = _requiredApprovals;
        proposalLifetime = _proposalLifetime;
        minDelay = _minDelay;
        emergencyAdmin = msg.sender;
    }
    
    /**
     * @dev Create a new proposal for a critical operation
     */
    function createProposal(
        address target,
        bytes calldata data,
        uint256 value
    ) external onlyRole(SIGNER_ROLE) whenNotPaused returns (bytes32) {
        if (emergencyMode) revert EmergencyModeActive();
        if (target == address(0)) revert InvalidTarget();
        
        bytes32 proposalId = keccak256(abi.encodePacked(target, data, value, block.timestamp, msg.sender));
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.target = target;
        proposal.data = data;
        proposal.value = value;
        proposal.proposer = msg.sender;
        proposal.createdAt = block.timestamp;
        
        proposalIds.push(proposalId);
        
        emit ProposalCreated(proposalId, target, msg.sender);
        return proposalId;
    }
    
    /**
     * @dev Approve a proposal
     */
    function approveProposal(bytes32 proposalId) external onlyRole(SIGNER_ROLE) whenNotPaused {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.target == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (block.timestamp > proposal.createdAt + proposalLifetime) revert ProposalExpired();
        if (proposal.hasApproved[msg.sender]) revert AlreadyApproved();
        
        proposal.hasApproved[msg.sender] = true;
        proposal.approvals++;
        
        emit ProposalApproved(proposalId, msg.sender, proposal.approvals);
    }
    
    /**
     * @dev Execute an approved proposal
     */
    function executeProposal(bytes32 proposalId) external onlyRole(SIGNER_ROLE) nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.target == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        require(!proposal.cancelled, "Proposal cancelled");
        if (block.timestamp > proposal.createdAt + proposalLifetime) revert ProposalExpired();
        if (proposal.approvals < requiredApprovals) revert InsufficientApprovals();
        if (block.timestamp < proposal.createdAt + minDelay) revert DelayNotMet();
        
        proposal.executed = true;
        proposal.executedAt = block.timestamp;
        
        // Execute the proposal
        (bool success, bytes memory returnData) = proposal.target.call{value: proposal.value}(proposal.data);
        if (!success) {
            // Handle revert reason
            if (returnData.length > 0) {
                assembly {
                    let returnDataSize := mload(returnData)
                    revert(add(32, returnData), returnDataSize)
                }
            } else {
                revert ExecutionFailed();
            }
        }
        
        emit ProposalExecuted(proposalId, msg.sender);
    }
    
    /**
     * @dev Cancel a proposal (only proposer can cancel)
     */
    function cancelProposal(bytes32 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.target == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (msg.sender != proposal.proposer && !hasRole(ADMIN_ROLE, msg.sender)) revert NotProposer();
        
        proposal.cancelled = true;
        
        emit ProposalCancelled(proposalId, msg.sender);
    }
    
    /**
     * @dev Update required approvals (requires multi-sig)
     */
    function updateRequiredApprovals(uint256 _requiredApprovals) external onlyRole(ADMIN_ROLE) {
        require(_requiredApprovals > 0, "Required approvals must be > 0");
        
        uint256 oldRequired = requiredApprovals;
        requiredApprovals = _requiredApprovals;
        
        emit RequiredApprovalsUpdated(oldRequired, _requiredApprovals);
    }
    
    /**
     * @dev Toggle emergency mode (bypasses multi-sig for critical functions)
     */
    function toggleEmergencyMode() external {
        require(msg.sender == emergencyAdmin, "Not emergency admin");
        
        emergencyMode = !emergencyMode;
        
        emit EmergencyModeToggled(emergencyMode, msg.sender);
    }
    
    /**
     * @dev Emergency execution (only in emergency mode)
     */
    function emergencyExecute(
        address target,
        bytes calldata data,
        uint256 value
    ) external nonReentrant {
        require(emergencyMode, "Not in emergency mode");
        require(msg.sender == emergencyAdmin, "Not emergency admin");
        
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    let returnDataSize := mload(returnData)
                    revert(add(32, returnData), returnDataSize)
                }
            } else {
                revert ExecutionFailed();
            }
        }
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposal(bytes32 proposalId) external view returns (
        address target,
        bytes memory data,
        uint256 value,
        address proposer,
        uint256 createdAt,
        uint256 executedAt,
        uint256 approvals,
        bool executed,
        bool cancelled
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.target,
            proposal.data,
            proposal.value,
            proposal.proposer,
            proposal.createdAt,
            proposal.executedAt,
            proposal.approvals,
            proposal.executed,
            proposal.cancelled
        );
    }
    
    /**
     * @dev Check if address has approved a proposal
     */
    function hasApprovedProposal(bytes32 proposalId, address signer) external view returns (bool) {
        return proposals[proposalId].hasApproved[signer];
    }
    
    /**
     * @dev Get total number of proposals
     */
    function getProposalCount() external view returns (uint256) {
        return proposalIds.length;
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Receive function for ETH transfers
     */
    receive() external payable {}
}