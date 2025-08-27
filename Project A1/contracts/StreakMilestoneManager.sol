// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IXPEngine {
    function awardXP(address _user, uint256 _amount) external;
}

interface IBadgeMinter {
    function mintBadge(address _to, string memory _tokenURI) external returns (uint256);
}

/**
 * @title StreakMilestoneManager
 * @dev Manages milestone achievements for streak systems
 * @notice This contract handles special milestone rewards for significant streak achievements
 * @author Avax Forge Empire Team
 */
contract StreakMilestoneManager is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant STREAK_MANAGER_ROLE = keccak256("STREAK_MANAGER_ROLE");
    
    IXPEngine public xpEngine;
    IBadgeMinter public badgeMinter;
    
    struct StreakMilestone {
        uint256 day;               // Day required for milestone
        string title;              // Milestone title
        string description;        // Milestone description
        uint256 specialReward;     // Special XP reward amount
        string specialBadgeURI;    // Special badge URI
        bool isActive;             // Whether milestone is active
    }
    
    // Milestone configuration
    mapping(uint256 => StreakMilestone) public milestones;
    uint256[] public milestoneDays;
    
    // Track achieved milestones to prevent double claiming
    mapping(address => mapping(uint256 => bool)) public achievedMilestones;
    
    // Events
    event MilestoneAchieved(address indexed user, uint256 day, string title, uint256 specialReward, uint256 badgeId);
    event MilestoneConfigured(uint256 day, string title, string description, uint256 specialReward, string specialBadgeURI);
    
    // Custom Errors
    error MilestoneAlreadyAchieved();
    error MilestoneNotActive();
    error InvalidMilestoneDay();
    error MilestoneAlreadyExists();
    
    /**
     * @notice Initializes the StreakMilestoneManager contract
     * @param _xpEngineAddress Address of the XP Engine contract
     * @param _badgeMinterAddress Address of the Badge Minter contract
     */
    function initialize(
        address _xpEngineAddress,
        address _badgeMinterAddress
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(STREAK_MANAGER_ROLE, msg.sender);
        
        xpEngine = IXPEngine(_xpEngineAddress);
        badgeMinter = IBadgeMinter(_badgeMinterAddress);
        
        _initializeMilestones();
    }
    
    /**
     * @notice Checks and awards milestones for a user's streak achievement
     * @dev Called by the main StreakEngine contract
     * @param user Address of the user
     * @param streakLength Current length of the user's longest streak
     */
    function checkMilestones(address user, uint256 streakLength) 
        external 
        onlyRole(STREAK_MANAGER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        for (uint256 i = 0; i < milestoneDays.length; i++) {
            uint256 day = milestoneDays[i];
            
            // Check if user has reached this milestone and hasn't achieved it yet
            if (streakLength >= day && !achievedMilestones[user][day]) {
                StreakMilestone memory milestone = milestones[day];
                
                if (!milestone.isActive) continue;
                
                // Mark as achieved first (CEI pattern)
                achievedMilestones[user][day] = true;
                
                uint256 badgeId = 0;
                
                // Award special XP if specified
                if (milestone.specialReward > 0) {
                    try xpEngine.awardXP(user, milestone.specialReward) {
                        // XP awarded successfully
                    } catch {
                        // Continue with other rewards even if XP fails
                    }
                }
                
                // Mint special badge if specified
                if (bytes(milestone.specialBadgeURI).length > 0) {
                    try badgeMinter.mintBadge(user, milestone.specialBadgeURI) returns (uint256 tokenId) {
                        badgeId = tokenId;
                    } catch {
                        // Continue even if badge minting fails
                    }
                }
                
                emit MilestoneAchieved(user, day, milestone.title, milestone.specialReward, badgeId);
            }
        }
    }
    
    /**
     * @notice Gets milestone information for a specific day
     * @param day Milestone day
     * @return milestone StreakMilestone struct containing milestone details
     */
    function getMilestoneInfo(uint256 day) 
        external 
        view 
        returns (StreakMilestone memory milestone) 
    {
        return milestones[day];
    }
    
    /**
     * @notice Gets all milestone days
     * @return Array of milestone day values
     */
    function getMilestoneDays() 
        external 
        view 
        returns (uint256[] memory) 
    {
        return milestoneDays;
    }
    
    /**
     * @notice Checks if a user has achieved a specific milestone
     * @param user Address of the user
     * @param day Milestone day
     * @return achieved True if milestone has been achieved
     */
    function hasAchievedMilestone(address user, uint256 day) 
        external 
        view 
        returns (bool achieved) 
    {
        return achievedMilestones[user][day];
    }
    
    /**
     * @notice Gets the number of milestones a user is eligible for
     * @param user Address of the user
     * @param streakLength Current streak length
     * @return count Number of eligible milestones
     */
    function getEligibleMilestonesCount(address user, uint256 streakLength) 
        external 
        view 
        returns (uint256 count) 
    {
        for (uint256 i = 0; i < milestoneDays.length; i++) {
            uint256 day = milestoneDays[i];
            
            if (streakLength >= day && 
                !achievedMilestones[user][day] && 
                milestones[day].isActive) {
                count++;
            }
        }
    }
    
    /**
     * @notice Sets a milestone configuration
     * @dev Only admin can call this function
     * @param day Day required for milestone
     * @param title Milestone title
     * @param description Milestone description
     * @param specialReward Special XP reward amount
     * @param specialBadgeURI Special badge URI
     * @param isActive Whether the milestone is active
     */
    function setMilestone(
        uint256 day,
        string calldata title,
        string calldata description,
        uint256 specialReward,
        string calldata specialBadgeURI,
        bool isActive
    ) external onlyRole(ADMIN_ROLE) {
        if (day == 0) revert InvalidMilestoneDay();
        
        // Check if milestone day already exists
        bool exists = false;
        for (uint256 i = 0; i < milestoneDays.length; i++) {
            if (milestoneDays[i] == day) {
                exists = true;
                break;
            }
        }
        
        // Add day if it doesn't exist
        if (!exists) {
            milestoneDays.push(day);
            
            // Keep days sorted for efficiency
            for (uint256 i = milestoneDays.length - 1; i > 0; i--) {
                if (milestoneDays[i] < milestoneDays[i - 1]) {
                    uint256 temp = milestoneDays[i];
                    milestoneDays[i] = milestoneDays[i - 1];
                    milestoneDays[i - 1] = temp;
                } else {
                    break;
                }
            }
        }
        
        // Set the milestone
        milestones[day] = StreakMilestone({
            day: day,
            title: title,
            description: description,
            specialReward: specialReward,
            specialBadgeURI: specialBadgeURI,
            isActive: isActive
        });
        
        emit MilestoneConfigured(day, title, description, specialReward, specialBadgeURI);
    }
    
    /**
     * @notice Initialize default milestones
     */
    function _initializeMilestones() internal {
        // Week Warrior
        milestones[7] = StreakMilestone({
            day: 7,
            title: "Week Warrior",
            description: "Maintained a streak for 7 consecutive days",
            specialReward: 100,
            specialBadgeURI: "https://badges.avaxforge.com/milestone-week",
            isActive: true
        });
        milestoneDays.push(7);
        
        // Month Master
        milestones[30] = StreakMilestone({
            day: 30,
            title: "Month Master",
            description: "Maintained a streak for 30 consecutive days",
            specialReward: 500,
            specialBadgeURI: "https://badges.avaxforge.com/milestone-month",
            isActive: true
        });
        milestoneDays.push(30);
        
        // Quarter Conqueror
        milestones[90] = StreakMilestone({
            day: 90,
            title: "Quarter Conqueror",
            description: "Maintained a streak for 90 consecutive days",
            specialReward: 1500,
            specialBadgeURI: "https://badges.avaxforge.com/milestone-quarter",
            isActive: true
        });
        milestoneDays.push(90);
        
        // Year Champion
        milestones[365] = StreakMilestone({
            day: 365,
            title: "Year Champion",
            description: "Maintained a streak for 365 consecutive days",
            specialReward: 5000,
            specialBadgeURI: "https://badges.avaxforge.com/milestone-year",
            isActive: true
        });
        milestoneDays.push(365);
        
        // Legendary Streaker
        milestones[1000] = StreakMilestone({
            day: 1000,
            title: "Legendary Streaker",
            description: "Maintained a streak for 1000 consecutive days",
            specialReward: 10000,
            specialBadgeURI: "https://badges.avaxforge.com/milestone-legendary",
            isActive: true
        });
        milestoneDays.push(1000);
    }
    
    /**
     * @notice Update XP Engine address
     * @dev Only admin can call this function
     * @param _xpEngineAddress New XP Engine address
     */
    function updateXPEngine(address _xpEngineAddress) external onlyRole(ADMIN_ROLE) {
        require(_xpEngineAddress != address(0), "Invalid address");
        xpEngine = IXPEngine(_xpEngineAddress);
    }
    
    /**
     * @notice Update Badge Minter address
     * @dev Only admin can call this function
     * @param _badgeMinterAddress New Badge Minter address
     */
    function updateBadgeMinter(address _badgeMinterAddress) external onlyRole(ADMIN_ROLE) {
        require(_badgeMinterAddress != address(0), "Invalid address");
        badgeMinter = IBadgeMinter(_badgeMinterAddress);
    }
    
    /**
     * @notice Pause the contract
     * @dev Only admin can call this function
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     * @dev Only admin can call this function
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}