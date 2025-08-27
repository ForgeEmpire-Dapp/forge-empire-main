// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IXPEngine {
    function awardXP(address _user, uint256 _amount) external;
}

interface IBadgeMinter {
    function mintBadge(address _to, string memory _tokenURI) external returns (uint256);
}

interface IStreakCore {
    function getCurrentStreak(address user, uint8 streakType) external view returns (uint32);
    function getLongestStreak(address user, uint8 streakType) external view returns (uint32);
}

/**
 * @title StreakMilestones
 * @dev Manages special milestone achievements and rewards
 * @notice This contract handles major streak achievements and special rewards
 * @author Avax Forge Empire Team
 */
contract StreakMilestones is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    
    bytes32 public constant MILESTONE_MANAGER_ROLE = keccak256("MILESTONE_MANAGER_ROLE");
    
    IXPEngine public xpEngine;
    IBadgeMinter public badgeMinter;
    IStreakCore public streakCore;
    
    // Packed milestone struct for gas efficiency
    struct PackedMilestone {
        uint32 day;
        uint32 specialReward;
        bool isActive;
        bool isGlobal; // True if milestone applies to total streak days
    }
    
    // Milestone configurations: milestoneId => PackedMilestone
    mapping(uint32 => PackedMilestone) public milestones;
    
    // Milestone metadata: milestoneId => title, description, badgeURI
    mapping(uint32 => string) public milestoneTitles;
    mapping(uint32 => string) public milestoneDescriptions;
    mapping(uint32 => string) public milestoneBadgeURIs;
    
    // Track achieved milestones: user => milestoneId => achieved
    mapping(address => mapping(uint32 => bool)) public achievedMilestones;
    
    // User's total streak days across all types
    mapping(address => uint32) public totalStreakDays;
    
    // Active milestone IDs (sorted for efficient iteration)
    uint32[] public activeMilestones;
    
    // Special achievement tracking
    mapping(address => bool) public hasLegendaryStreak; // 365+ days
    mapping(address => bool) public hasEpicStreak; // 100+ days
    mapping(address => uint32) public milestoneCount; // Number of milestones achieved
    
    // Events
    event MilestoneAchieved(address indexed user, uint32 indexed milestoneId, string title, uint32 specialReward, uint256 badgeId);
    event MilestoneConfigured(uint32 indexed milestoneId, string title, uint32 day, uint32 specialReward);
    event TotalStreakUpdated(address indexed user, uint32 newTotal);
    event LegendaryStreakAchieved(address indexed user, uint32 totalDays);
    event BatchMilestonesAchieved(address indexed user, uint32[] milestoneIds, uint32 totalReward);
    
    // Custom Errors
    error MilestoneAlreadyAchieved();
    error MilestoneNotActive();
    error InsufficientStreak();
    error InvalidMilestoneId();
    error NoMilestonesAvailable();
    
    /**
     * @notice Initializes the StreakMilestones contract
     * @param _xpEngineAddress Address of the XP Engine contract
     * @param _badgeMinterAddress Address of the Badge Minter contract
     * @param _streakCoreAddress Address of the StreakCore contract
     */
    function initialize(
        address _xpEngineAddress,
        address _badgeMinterAddress,
        address _streakCoreAddress
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MILESTONE_MANAGER_ROLE, msg.sender);
        
        xpEngine = IXPEngine(_xpEngineAddress);
        badgeMinter = IBadgeMinter(_badgeMinterAddress);
        streakCore = IStreakCore(_streakCoreAddress);
        
        _initializeDefaultMilestones();
    }
    
    /**
     * @notice Update user's total streak days and check for milestones
     * @param user The user address
     */
    function updateTotalStreakDays(address user) 
        external 
        onlyRole(MILESTONE_MANAGER_ROLE) 
        whenNotPaused 
    {
        uint32 newTotal = _calculateTotalStreakDays(user);
        uint32 oldTotal = totalStreakDays[user];
        
        if (newTotal != oldTotal) {
            totalStreakDays[user] = newTotal;
            emit TotalStreakUpdated(user, newTotal);
            
            // Check for special achievements
            _checkSpecialAchievements(user, newTotal);
            
            // Auto-check for milestone achievements
            _checkAvailableMilestones(user);
        }
    }
    
    /**
     * @notice Claim a specific milestone
     * @param milestoneId The milestone ID to claim
     */
    function claimMilestone(uint32 milestoneId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        _claimSingleMilestone(msg.sender, milestoneId);
    }
    
    /**
     * @notice Claim all available milestones for a user
     */
    function claimAllMilestones() 
        external 
        whenNotPaused 
        nonReentrant 
    {
        uint32[] memory availableMilestones = getAvailableMilestones(msg.sender);
        
        if (availableMilestones.length == 0) revert NoMilestonesAvailable();
        
        uint32 totalReward = 0;
        
        for (uint256 i = 0; i < availableMilestones.length; i++) {
            uint32 milestoneId = availableMilestones[i];
            PackedMilestone memory milestone = milestones[milestoneId];
            
            achievedMilestones[msg.sender][milestoneId] = true;
            milestoneCount[msg.sender]++;
            
            // Award XP
            if (milestone.specialReward > 0) {
                totalReward += milestone.specialReward;
            }
            
            // Mint badge
            string memory badgeURI = milestoneBadgeURIs[milestoneId];
            uint256 badgeId = 0;
            if (bytes(badgeURI).length > 0) {
                badgeId = badgeMinter.mintBadge(msg.sender, badgeURI);
            }
            
            emit MilestoneAchieved(
                msg.sender, 
                milestoneId, 
                milestoneTitles[milestoneId], 
                milestone.specialReward, 
                badgeId
            );
        }
        
        if (totalReward > 0) {
            xpEngine.awardXP(msg.sender, totalReward);
        }
        
        emit BatchMilestonesAchieved(msg.sender, availableMilestones, totalReward);
    }
    
    /**
     * @notice Get available milestones for a user
     * @param user The user address
     * @return availableMilestoneIds Array of claimable milestone IDs
     */
    function getAvailableMilestones(address user) 
        public 
        view 
        returns (uint32[] memory availableMilestoneIds) 
    {
        uint32 userTotal = totalStreakDays[user];
        
        // Count available milestones
        uint256 count = 0;
        for (uint256 i = 0; i < activeMilestones.length; i++) {
            uint32 milestoneId = activeMilestones[i];
            PackedMilestone memory milestone = milestones[milestoneId];
            
            if (milestone.isActive && 
                !achievedMilestones[user][milestoneId] &&
                userTotal >= milestone.day) {
                count++;
            }
        }
        
        // Build result array
        availableMilestoneIds = new uint32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < activeMilestones.length; i++) {
            uint32 milestoneId = activeMilestones[i];
            PackedMilestone memory milestone = milestones[milestoneId];
            
            if (milestone.isActive && 
                !achievedMilestones[user][milestoneId] &&
                userTotal >= milestone.day) {
                availableMilestoneIds[index] = milestoneId;
                index++;
            }
        }
    }
    
    /**
     * @notice Configure a milestone (admin only)
     * @param milestoneId The milestone ID
     * @param day Required streak days
     * @param title Milestone title
     * @param description Milestone description
     * @param specialReward XP reward amount
     * @param badgeURI Badge URI
     * @param isGlobal Whether this applies to total streak days
     */
    function configureMilestone(
        uint32 milestoneId,
        uint32 day,
        string calldata title,
        string calldata description,
        uint32 specialReward,
        string calldata badgeURI,
        bool isGlobal
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        PackedMilestone storage milestone = milestones[milestoneId];
        
        // If this is a new milestone, add to active list
        if (milestone.day == 0) {
            activeMilestones.push(milestoneId);
        }
        
        milestone.day = day;
        milestone.specialReward = specialReward;
        milestone.isActive = true;
        milestone.isGlobal = isGlobal;
        
        milestoneTitles[milestoneId] = title;
        milestoneDescriptions[milestoneId] = description;
        milestoneBadgeURIs[milestoneId] = badgeURI;
        
        emit MilestoneConfigured(milestoneId, title, day, specialReward);
    }
    
    /**
     * @notice Get milestone details
     * @param milestoneId The milestone ID
     * @return day Required streak days
     * @return title Milestone title
     * @return description Milestone description
     * @return specialReward XP reward amount
     * @return badgeURI Badge URI
     * @return isActive Whether milestone is active
     * @return isGlobal Whether milestone applies to total streak days
     */
    function getMilestoneDetails(uint32 milestoneId) 
        external 
        view 
        returns (
            uint32 day,
            string memory title,
            string memory description,
            uint32 specialReward,
            string memory badgeURI,
            bool isActive,
            bool isGlobal
        ) 
    {
        PackedMilestone memory milestone = milestones[milestoneId];
        return (
            milestone.day,
            milestoneTitles[milestoneId],
            milestoneDescriptions[milestoneId],
            milestone.specialReward,
            milestoneBadgeURIs[milestoneId],
            milestone.isActive,
            milestone.isGlobal
        );
    }
    
    /**
     * @notice Internal function to claim a single milestone
     */
    function _claimSingleMilestone(address user, uint32 milestoneId) internal {
        if (achievedMilestones[user][milestoneId]) revert MilestoneAlreadyAchieved();
        
        PackedMilestone memory milestone = milestones[milestoneId];
        if (!milestone.isActive) revert MilestoneNotActive();
        
        uint32 userTotal = totalStreakDays[user];
        if (userTotal < milestone.day) revert InsufficientStreak();
        
        achievedMilestones[user][milestoneId] = true;
        milestoneCount[user]++;
        
        // Award XP
        if (milestone.specialReward > 0) {
            xpEngine.awardXP(user, milestone.specialReward);
        }
        
        // Mint badge
        string memory badgeURI = milestoneBadgeURIs[milestoneId];
        uint256 badgeId = 0;
        if (bytes(badgeURI).length > 0) {
            badgeId = badgeMinter.mintBadge(user, badgeURI);
        }
        
        emit MilestoneAchieved(
            user, 
            milestoneId, 
            milestoneTitles[milestoneId], 
            milestone.specialReward, 
            badgeId
        );
    }
    
    /**
     * @notice Calculate total streak days for a user
     */
    function _calculateTotalStreakDays(address user) internal view returns (uint32) {
        uint32 total = 0;
        for (uint8 i = 0; i < 5; i++) {
            total += streakCore.getCurrentStreak(user, i);
        }
        return total;
    }
    
    /**
     * @notice Check and award special achievements
     */
    function _checkSpecialAchievements(address user, uint32 totalDays) internal {
        // Legendary Streak (365+ days)
        if (totalDays >= 365 && !hasLegendaryStreak[user]) {
            hasLegendaryStreak[user] = true;
            emit LegendaryStreakAchieved(user, totalDays);
        }
        
        // Epic Streak (100+ days)
        if (totalDays >= 100 && !hasEpicStreak[user]) {
            hasEpicStreak[user] = true;
        }
    }
    
    /**
     * @notice Auto-check available milestones (internal)
     */
    function _checkAvailableMilestones(address user) internal {
        uint32 userTotal = totalStreakDays[user];
        
        for (uint256 i = 0; i < activeMilestones.length; i++) {
            uint32 milestoneId = activeMilestones[i];
            PackedMilestone memory milestone = milestones[milestoneId];
            
            if (milestone.isActive && 
                !achievedMilestones[user][milestoneId] &&
                userTotal >= milestone.day) {
                // Milestone available but not claimed - user needs to claim manually
                break;
            }
        }
    }
    
    /**
     * @notice Initialize default milestones
     */
    function _initializeDefaultMilestones() internal {
        // Early milestones
        _setDefaultMilestone(1, 10, "First Steps", "Completed 10 total streak days", 500, "First Steps Badge");
        _setDefaultMilestone(2, 25, "Getting Started", "Completed 25 total streak days", 1000, "Getting Started Badge");
        _setDefaultMilestone(3, 50, "Committed", "Completed 50 total streak days", 2000, "Committed Badge");
        
        // Major milestones
        _setDefaultMilestone(4, 100, "Epic Achiever", "Completed 100 total streak days", 5000, "Epic Achiever Badge");
        _setDefaultMilestone(5, 200, "Streak Master", "Completed 200 total streak days", 10000, "Streak Master Badge");
        _setDefaultMilestone(6, 365, "Legendary", "Completed 365 total streak days", 25000, "Legendary Badge");
        
        // Ultra milestones
        _setDefaultMilestone(7, 500, "Unstoppable", "Completed 500 total streak days", 50000, "Unstoppable Badge");
        _setDefaultMilestone(8, 1000, "Mythical", "Completed 1000 total streak days", 100000, "Mythical Badge");
    }
    
    /**
     * @notice Helper function to set default milestones
     */
    function _setDefaultMilestone(
        uint32 milestoneId,
        uint32 day,
        string memory title,
        string memory description,
        uint32 specialReward,
        string memory badgeURI
    ) internal {
        PackedMilestone storage milestone = milestones[milestoneId];
        milestone.day = day;
        milestone.specialReward = specialReward;
        milestone.isActive = true;
        milestone.isGlobal = true;
        
        milestoneTitles[milestoneId] = title;
        milestoneDescriptions[milestoneId] = description;
        milestoneBadgeURIs[milestoneId] = badgeURI;
        
        activeMilestones.push(milestoneId);
    }
    
    /**
     * @notice Get all active milestone IDs
     */
    function getActiveMilestones() external view returns (uint32[] memory) {
        return activeMilestones;
    }
    
    /**
     * @notice Pause contract (admin only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause contract (admin only)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}