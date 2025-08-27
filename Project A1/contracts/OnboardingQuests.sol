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

/**
 * @title OnboardingQuests
 * @dev Progressive onboarding system to guide new users through the Avax Forge Empire ecosystem
 * @notice This contract creates a structured 5-step onboarding experience with rewards
 * @author Avax Forge Empire Team
 */
contract OnboardingQuests is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant QUEST_MANAGER_ROLE = keccak256("QUEST_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    IXPEngine public xpEngine;
    IBadgeMinter public badgeMinter;
    
    enum OnboardingStep {
        PROFILE_CREATION,      // Step 1: Create profile and set username
        QUEST_EXPLORATION,     // Step 2: Browse and understand quest system
        COMMUNITY_INTERACTION, // Step 3: Follow someone or give kudos
        TOKEN_ACTIVITY,        // Step 4: Complete first trade or stake
        DAO_PARTICIPATION      // Step 5: Cast first governance vote
    }
    
    struct StepConfig {
        string title;
        string description;
        string instructions;
        uint256 xpReward;
        string badgeURI;
        bool isActive;
        uint256 timeLimit; // Optional time limit in seconds (0 = no limit)
    }
    
    struct UserProgress {
        uint256 currentStep;
        uint256 completedSteps; // Bitmask of completed steps
        uint256 totalXPEarned;
        uint256 startedAt;
        bool isCompleted;
        mapping(OnboardingStep => uint256) stepCompletedAt;
    }
    
    // Configuration for each onboarding step
    mapping(OnboardingStep => StepConfig) public stepConfigs;
    
    // User onboarding progress
    mapping(address => UserProgress) public userProgress;
    
    // Statistics
    uint256 public totalUsersStarted;
    uint256 public totalUsersCompleted;
    mapping(OnboardingStep => uint256) public stepCompletionCounts;
    
    // Events
    event OnboardingStarted(address indexed user, uint256 timestamp);
    event StepCompleted(address indexed user, OnboardingStep step, uint256 xpAwarded, uint256 badgeId);
    event OnboardingCompleted(address indexed user, uint256 totalXP, uint256 completionTime);
    event StepConfigUpdated(OnboardingStep step, string title, uint256 xpReward);
    
    // Custom Errors
    error OnboardingAlreadyStarted();
    error OnboardingNotStarted();
    error StepAlreadyCompleted();
    error StepNotActive();
    error InvalidStep();
    error StepTimeLimitExceeded();
    error MustCompleteInOrder();
    
    /**
     * @notice Initializes the OnboardingQuests contract
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
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(QUEST_MANAGER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        xpEngine = IXPEngine(_xpEngineAddress);
        badgeMinter = IBadgeMinter(_badgeMinterAddress);
        
        _initializeDefaultSteps();
    }
    
    /**
     * @notice Starts the onboarding process for a new user
     * @dev Can only be called once per user
     */
    function startOnboarding() external whenNotPaused nonReentrant {
        if (userProgress[msg.sender].startedAt != 0) revert OnboardingAlreadyStarted();
        
        userProgress[msg.sender].startedAt = block.timestamp;
        userProgress[msg.sender].currentStep = 0;
        
        totalUsersStarted++;
        
        emit OnboardingStarted(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Completes a specific onboarding step for the user
     * @param step The onboarding step to complete
     * @dev Steps must be completed in order
     */
    function completeStep(OnboardingStep step) external whenNotPaused nonReentrant {
        UserProgress storage progress = userProgress[msg.sender];
        
        if (progress.startedAt == 0) revert OnboardingNotStarted();
        if (progress.isCompleted) revert OnboardingAlreadyStarted(); // Reusing error for "already completed"
        if (_isStepCompleted(msg.sender, step)) revert StepAlreadyCompleted();
        if (!stepConfigs[step].isActive) revert StepNotActive();
        if (uint256(step) != progress.currentStep) revert MustCompleteInOrder();
        
        StepConfig memory config = stepConfigs[step];
        
        // Check time limit if set
        if (config.timeLimit > 0) {
            if (block.timestamp > progress.startedAt + config.timeLimit) {
                revert StepTimeLimitExceeded();
            }
        }
        
        // Mark step as completed
        progress.completedSteps |= (1 << uint256(step));
        progress.stepCompletedAt[step] = block.timestamp;
        progress.currentStep++;
        progress.totalXPEarned += config.xpReward;
        
        stepCompletionCounts[step]++;
        
        // Award XP
        if (config.xpReward > 0) {
            xpEngine.awardXP(msg.sender, config.xpReward);
        }
        
        // Mint badge
        uint256 badgeId = 0;
        if (bytes(config.badgeURI).length > 0) {
            badgeId = badgeMinter.mintBadge(msg.sender, config.badgeURI);
        }
        
        emit StepCompleted(msg.sender, step, config.xpReward, badgeId);
        
        // Check if onboarding is completed
        if (progress.currentStep >= 5) { // All 5 steps completed
            progress.isCompleted = true;
            totalUsersCompleted++;
            
            uint256 completionTime = block.timestamp - progress.startedAt;
            emit OnboardingCompleted(msg.sender, progress.totalXPEarned, completionTime);
            
            // Bonus reward for completing full onboarding
            _awardCompletionBonus(msg.sender);
        }
    }
    
    /**
     * @notice Awards special completion bonus for finishing all onboarding steps
     */
    function _awardCompletionBonus(address user) internal {
        // Award completion bonus: 500 XP + special "Forge Initiate" badge
        xpEngine.awardXP(user, 500);
        badgeMinter.mintBadge(user, "ipfs://badges/forge-initiate");
    }
    
    /**
     * @notice Checks if a user has completed a specific step
     * @param user The user address to check
     * @param step The step to check completion for
     * @return True if step is completed
     */
    function _isStepCompleted(address user, OnboardingStep step) internal view returns (bool) {
        return (userProgress[user].completedSteps & (1 << uint256(step))) != 0;
    }
    
    /**
     * @notice Gets user's onboarding progress
     * @param user The user address to query
     * @return currentStep Current step index
     * @return completedSteps Bitmask of completed steps
     * @return totalXPEarned Total XP earned from onboarding
     * @return isCompleted Whether onboarding is fully completed
     * @return startedAt Timestamp when onboarding started
     */
    function getUserProgress(address user) external view returns (
        uint256 currentStep,
        uint256 completedSteps,
        uint256 totalXPEarned,
        bool isCompleted,
        uint256 startedAt
    ) {
        UserProgress storage progress = userProgress[user];
        return (
            progress.currentStep,
            progress.completedSteps,
            progress.totalXPEarned,
            progress.isCompleted,
            progress.startedAt
        );
    }
    
    /**
     * @notice Gets the next step for a user
     * @param user The user address to query
     * @return step The next onboarding step
     * @return config The configuration for the next step
     */
    function getNextStep(address user) external view returns (
        OnboardingStep step,
        StepConfig memory config
    ) {
        UserProgress storage progress = userProgress[user];
        if (progress.isCompleted || progress.currentStep >= 5) {
            revert InvalidStep();
        }
        
        step = OnboardingStep(progress.currentStep);
        config = stepConfigs[step];
    }
    
    /**
     * @notice Gets onboarding statistics
     * @return totalStarted Total users who started onboarding
     * @return totalCompleted Total users who completed onboarding
     * @return completionRate Overall completion rate (percentage * 100)
     */
    function getOnboardingStats() external view returns (
        uint256 totalStarted,
        uint256 totalCompleted,
        uint256 completionRate
    ) {
        totalStarted = totalUsersStarted;
        totalCompleted = totalUsersCompleted;
        
        if (totalStarted > 0) {
            completionRate = (totalCompleted * 10000) / totalStarted; // Basis points
        }
    }
    
    /**
     * @notice Updates configuration for an onboarding step
     * @param step The step to update
     * @param title The new title
     * @param description The new description
     * @param instructions The new instructions
     * @param xpReward The new XP reward
     * @param badgeURI The new badge URI
     * @param isActive Whether the step is active
     * @param timeLimit Time limit in seconds (0 = no limit)
     */
    function updateStepConfig(
        OnboardingStep step,
        string memory title,
        string memory description,
        string memory instructions,
        uint256 xpReward,
        string memory badgeURI,
        bool isActive,
        uint256 timeLimit
    ) external onlyRole(ADMIN_ROLE) {
        stepConfigs[step] = StepConfig({
            title: title,
            description: description,
            instructions: instructions,
            xpReward: xpReward,
            badgeURI: badgeURI,
            isActive: isActive,
            timeLimit: timeLimit
        });
        
        emit StepConfigUpdated(step, title, xpReward);
    }
    
    /**
     * @notice Initializes default onboarding steps
     */
    function _initializeDefaultSteps() internal {
        // Step 1: Profile Creation
        stepConfigs[OnboardingStep.PROFILE_CREATION] = StepConfig({
            title: "Create Your Profile",
            description: "Set up your unique identity in the Forge Empire",
            instructions: "Go to Profile settings and choose a username",
            xpReward: 50,
            badgeURI: "ipfs://badges/welcome-badge",
            isActive: true,
            timeLimit: 0
        });
        
        // Step 2: Quest Exploration
        stepConfigs[OnboardingStep.QUEST_EXPLORATION] = StepConfig({
            title: "Discover Quests",
            description: "Learn about the quest system and rewards",
            instructions: "Visit the Quests page and browse available challenges",
            xpReward: 100,
            badgeURI: "ipfs://badges/explorer-badge",
            isActive: true,
            timeLimit: 0
        });
        
        // Step 3: Community Interaction
        stepConfigs[OnboardingStep.COMMUNITY_INTERACTION] = StepConfig({
            title: "Join the Community",
            description: "Connect with other users and start building relationships",
            instructions: "Follow another user or send kudos to someone",
            xpReward: 75,
            badgeURI: "ipfs://badges/social-badge",
            isActive: true,
            timeLimit: 0
        });
        
        // Step 4: Token Activity
        stepConfigs[OnboardingStep.TOKEN_ACTIVITY] = StepConfig({
            title: "Enter DeFi",
            description: "Make your first trade or stake tokens",
            instructions: "Use TokenLauncher to trade or StakingRewards to stake",
            xpReward: 150,
            badgeURI: "ipfs://badges/trader-badge",
            isActive: true,
            timeLimit: 0
        });
        
        // Step 5: DAO Participation
        stepConfigs[OnboardingStep.DAO_PARTICIPATION] = StepConfig({
            title: "Become a Citizen",
            description: "Participate in governance and shape the future",
            instructions: "Cast your first vote in an active DAO proposal",
            xpReward: 200,
            badgeURI: "ipfs://badges/citizen-badge",
            isActive: true,
            timeLimit: 0
        });
    }
    
    /**
     * @notice Pauses the contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}