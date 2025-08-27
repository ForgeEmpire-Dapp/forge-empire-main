// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IGuildCore.sol";
import "../libraries/ValidationUtils.sol";

// XP Engine interface for checking user XP
interface IXPEngine {
    function getXP(address user) external view returns (uint256);
}

/**
 * @title GuildCore
 * @dev Core guild management functionality
 */
contract GuildCore is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IGuildCore,
    UUPSUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GUILD_MANAGER_ROLE = keccak256("GUILD_MANAGER_ROLE");
    
    // State variables
    mapping(uint256 => Guild) public guilds;
    mapping(uint256 => mapping(address => Member)) public guildMembers;
    mapping(uint256 => address[]) public guildMembersList;
    mapping(address => uint256) public userToGuild; // user => guildId (0 = no guild)
    
    uint256 public nextGuildId;
    uint256 public minRequiredXP;
    uint256 public maxGuildSize;
    uint256 public guildCreationFee;
    
    IXPEngine public xpEngine;
    
    /**
     * @dev Initialize the guild core
     */
    function initialize(
        address admin,
        address _xpEngine,
        uint256 _minRequiredXP,
        uint256 _maxGuildSize
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(GUILD_MANAGER_ROLE, admin);
        
        xpEngine = IXPEngine(_xpEngine);
        minRequiredXP = _minRequiredXP;
        maxGuildSize = _maxGuildSize;
        nextGuildId = 1;
    }
    
    /**
     * @dev Create a new guild
     */
    function createGuild(
        string calldata name,
        string calldata description,
        uint256 requiredXP
    ) external payable whenNotPaused nonReentrant returns (uint256 guildId) {
        ValidationUtils.requireNonEmptyString(name);
        ValidationUtils.requireNonEmptyString(description);
        require(userToGuild[msg.sender] == 0, "Already in a guild");
        require(xpEngine.getXP(msg.sender) >= minRequiredXP, "Insufficient XP");
        require(requiredXP >= minRequiredXP, "Required XP too low");
        require(msg.value >= guildCreationFee, "Insufficient creation fee");
        
        guildId = nextGuildId++;
        
        guilds[guildId] = Guild({
            guildId: guildId,
            name: name,
            description: description,
            leader: msg.sender,
            memberCount: 1,
            createdAt: block.timestamp,
            requiredXP: requiredXP,
            isActive: true,
            totalContributions: 0
        });
        
        // Add creator as leader
        guildMembers[guildId][msg.sender] = Member({
            memberAddress: msg.sender,
            joinedAt: block.timestamp,
            contributionScore: 0,
            isActive: true,
            role: "Leader"
        });
        
        guildMembersList[guildId].push(msg.sender);
        userToGuild[msg.sender] = guildId;
        
        emit GuildCreated(guildId, name, msg.sender);
    }
    
    /**
     * @dev Join an existing guild
     */
    function joinGuild(uint256 guildId) external whenNotPaused nonReentrant {
        Guild storage guild = guilds[guildId];
        require(guild.isActive, "Guild not active");
        require(userToGuild[msg.sender] == 0, "Already in a guild");
        require(guild.memberCount < maxGuildSize, "Guild is full");
        require(xpEngine.getXP(msg.sender) >= guild.requiredXP, "Insufficient XP");
        
        guildMembers[guildId][msg.sender] = Member({
            memberAddress: msg.sender,
            joinedAt: block.timestamp,
            contributionScore: 0,
            isActive: true,
            role: "Member"
        });
        
        guildMembersList[guildId].push(msg.sender);
        userToGuild[msg.sender] = guildId;
        guild.memberCount++;
        
        emit MemberJoined(guildId, msg.sender);
    }
    
    /**
     * @dev Leave current guild
     */
    function leaveGuild(uint256 guildId) external nonReentrant {
        require(userToGuild[msg.sender] == guildId, "Not in this guild");
        require(guilds[guildId].leader != msg.sender, "Leader cannot leave without transfer");
        
        _removeMember(guildId, msg.sender);
        emit MemberLeft(guildId, msg.sender);
    }
    
    /**
     * @dev Transfer guild leadership
     */
    function transferLeadership(uint256 guildId, address newLeader) external nonReentrant {
        Guild storage guild = guilds[guildId];
        require(guild.leader == msg.sender, "Not guild leader");
        require(guildMembers[guildId][newLeader].isActive, "New leader not in guild");
        ValidationUtils.requireNonZeroAddress(newLeader);
        
        address oldLeader = guild.leader;
        guild.leader = newLeader;
        
        // Update roles
        guildMembers[guildId][oldLeader].role = "Member";
        guildMembers[guildId][newLeader].role = "Leader";
        
        emit LeadershipTransferred(guildId, oldLeader, newLeader);
    }
    
    /**
     * @dev Get guild information
     */
    function getGuild(uint256 guildId) external view returns (Guild memory) {
        return guilds[guildId];
    }
    
    /**
     * @dev Get member information
     */
    function getMember(uint256 guildId, address member) external view returns (Member memory) {
        return guildMembers[guildId][member];
    }

    function getMemberInfo(uint256 guildId, address member) external view returns (Member memory) {
        return guildMembers[guildId][member];
    }
    
    /**
     * @dev Get all guild members
     */
    function getGuildMembers(uint256 guildId) external view returns (address[] memory) {
        return guildMembersList[guildId];
    }
    
    /**
     * @dev Get user's guild ID
     */
    function getUserGuild(address user) external view returns (uint256) {
        return userToGuild[user];
    }
    
    /**
     * @dev Check if user is member of guild
     */
    function isGuildMember(uint256 guildId, address user) external view returns (bool) {
        return guildMembers[guildId][user].isActive;
    }
    
    /**
     * @dev Remove member from guild (internal)
     */
    function _removeMember(uint256 guildId, address member) internal {
        guildMembers[guildId][member].isActive = false;
        userToGuild[member] = 0;
        guilds[guildId].memberCount--;
        
        // Remove from members list
        address[] storage membersList = guildMembersList[guildId];
        for (uint256 i = 0; i < membersList.length; i++) {
            if (membersList[i] == member) {
                membersList[i] = membersList[membersList.length - 1];
                membersList.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Update member contribution score (called by GuildRewards)
     */
    function updateMemberContribution(
        uint256 guildId, 
        address member, 
        uint256 contributionPoints
    ) external onlyRole(GUILD_MANAGER_ROLE) {
        require(guildMembers[guildId][member].isActive, "Member not active");
        guildMembers[guildId][member].contributionScore += contributionPoints;
        guilds[guildId].totalContributions += contributionPoints;
    }
    
    // Admin functions
    function setMinRequiredXP(uint256 newMinXP) external onlyRole(ADMIN_ROLE) {
        ValidationUtils.requireNonZeroAmount(newMinXP);
        minRequiredXP = newMinXP;
    }
    
    function setMaxGuildSize(uint256 newMaxSize) external onlyRole(ADMIN_ROLE) {
        ValidationUtils.requireNonZeroAmount(newMaxSize);
        maxGuildSize = newMaxSize;
    }
    
    function setGuildCreationFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        guildCreationFee = newFee;
    }
    
    function withdrawFees() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        payable(msg.sender).transfer(balance);
    }

    // Governance-related functions
    function getTotalVotingPower(uint256 guildId) external view returns (uint256) {
        uint256 totalPower = 0;
        address[] memory members = guildMembersList[guildId];
        for (uint i = 0; i < members.length; i++) {
            // This logic should be consistent with GuildGovernance's getVotingPower
            // For simplicity, we'll use a basic calculation here
            totalPower += 1; // Placeholder logic
        }
        return totalPower;
    }

    function removeMember(uint256 guildId, address member) external onlyRole(GUILD_MANAGER_ROLE) {
        require(guildMembers[guildId][member].isActive, "Member not active");
        _removeMember(guildId, member);
        emit MemberLeft(guildId, member);
    }

    function adminTransferLeadership(uint256 guildId, address newLeader) external onlyRole(GUILD_MANAGER_ROLE) {
        Guild storage guild = guilds[guildId];
        require(guildMembers[guildId][newLeader].isActive, "New leader not in guild");
        ValidationUtils.requireNonZeroAddress(newLeader);
        
        address oldLeader = guild.leader;
        guild.leader = newLeader;
        
        guildMembers[guildId][oldLeader].role = "Member";
        guildMembers[guildId][newLeader].role = "Leader";
        
        emit LeadershipTransferred(guildId, oldLeader, newLeader);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}