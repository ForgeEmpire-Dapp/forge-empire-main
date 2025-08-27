// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IXPEngine {
    function awardXP(address _user, uint256 _amount) external;
    function getXP(address _user) external view returns (uint256);
}

interface IBadgeMinter {
    function mintBadge(address _to, string memory _tokenURI) external returns (uint256);
}

interface IEnhancedLeaderboards {
    function updateScore(address user, uint8 category, uint256 score) external;
    function incrementScore(address user, uint8 category, uint256 increment) external;
}

/**
 * @title SeasonalEvents
 * @dev Time-limited campaigns and special events system
 * @notice This contract manages seasonal events, special campaigns, and community challenges
 * @author Avax Forge Empire Team
 */
contract SeasonalEvents is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EVENT_MANAGER_ROLE = keccak256("EVENT_MANAGER_ROLE");
    
    IXPEngine public xpEngine;
    IBadgeMinter public badgeMinter;
    IEnhancedLeaderboards public leaderboards;
    
    enum EventType {
        XP_MULTIPLIER,      // 0 - Events that multiply XP gains
        QUEST_MARATHON,     // 1 - Special quest completion events
        TRADING_CONTEST,    // 2 - Trading volume competitions
        COMMUNITY_GOAL,     // 3 - Collective community targets
        BADGE_HUNT,         // 4 - Special badge collection events
        SOCIAL_CAMPAIGN,    // 5 - Social engagement campaigns
        GOVERNANCE_DRIVE    // 6 - DAO participation events
    }
    
    enum EventStatus {
        SCHEDULED,  // 0 - Event created but not started
        ACTIVE,     // 1 - Event currently running
        ENDED,      // 2 - Event finished, rewards pending
        COMPLETED   // 3 - Event finished, rewards distributed
    }
    
    struct Event {
        uint256 id;
        string name;
        string description;
        EventType eventType;
        EventStatus status;
        uint256 startTime;
        uint256 endTime;
        uint256 participantLimit;
        uint256 participantCount;
        uint256 totalRewardPool;
        uint256 multiplier;         // For XP multiplier events (basis points, 10000 = 100%)
        uint256 targetMetric;       // Target value for community goals
        uint256 currentProgress;    // Current progress towards target
        string[] rewardBadgeURIs;   // Badge rewards
        uint256[] rewardTiers;      // XP reward tiers
        mapping(address => bool) participants;
        mapping(address => uint256) participantProgress;
        mapping(address => bool) rewardsClaimed;
        mapping(uint256 => address) participantList;
        bool requiresRegistration;
        bool isRepeating;
        uint256 repeatInterval;
    }
    
    struct GlobalStats {
        uint256 totalEvents;
        uint256 activeEvents;
        uint256 totalParticipants;
        uint256 totalRewardsDistributed;
        uint256 averageParticipation;
    }
    
    struct UserEventStats {
        uint256 eventsParticipated;
        uint256 eventsWon;
        uint256 totalXPFromEvents;
        uint256 totalBadgesFromEvents;
        uint256[] eventHistory;
        mapping(EventType => uint256) typeParticipation;
        mapping(EventType => uint256) typeWins;
    }
    
    // Storage
    mapping(uint256 => Event) public events;
    mapping(address => UserEventStats) public userStats;
    uint256 public nextEventId;
    uint256[] public activeEventIds;
    GlobalStats public globalStats;
    
    // Configuration
    uint256 public constant MAX_EVENT_DURATION = 90 days;
    uint256 public constant MIN_EVENT_DURATION = 1 hours;
    uint256 public constant MAX_PARTICIPANT_LIMIT = 100000;
    uint256 public constant BASIS_POINTS = 10000;
    
    // Events
    event EventCreated(uint256 indexed eventId, string name, EventType eventType, uint256 startTime, uint256 endTime);
    event EventStarted(uint256 indexed eventId, string name);
    event EventEnded(uint256 indexed eventId, string name, uint256 participants);
    event UserRegistered(uint256 indexed eventId, address indexed user);
    event ProgressUpdated(uint256 indexed eventId, address indexed user, uint256 progress);
    event RewardDistributed(uint256 indexed eventId, address indexed user, uint256 xpReward, uint256 badgeCount);
    event CommunityGoalReached(uint256 indexed eventId, uint256 finalProgress);
    event EventRepeated(uint256 indexed originalEventId, uint256 indexed newEventId);
    
    // Custom Errors
    error EventNotFound();
    error EventNotActive();
    error EventNotScheduled();
    error EventFull();
    error AlreadyRegistered();
    error NotRegistered();
    error RegistrationRequired();
    error RewardsAlreadyClaimed();
    error InvalidEventDuration();
    error InvalidMultiplier();
    error InvalidRewardConfiguration();
    error EventAlreadyStarted();
    error EventNotEnded();
    error InsufficientProgress();
    
    /**
     * @notice Initializes the Seasonal Events contract
     * @param _xpEngineAddress Address of the XP Engine contract
     * @param _badgeMinterAddress Address of the Badge Minter contract
     * @param _leaderboardsAddress Address of the Enhanced Leaderboards contract
     */
    function initialize(
        address _xpEngineAddress,
        address _badgeMinterAddress,
        address _leaderboardsAddress
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(EVENT_MANAGER_ROLE, msg.sender);
        
        xpEngine = IXPEngine(_xpEngineAddress);
        badgeMinter = IBadgeMinter(_badgeMinterAddress);
        leaderboards = IEnhancedLeaderboards(_leaderboardsAddress);
        
        nextEventId = 1;
    }
    
    /**
     * @notice Create a new seasonal event
     * @param name Event name
     * @param description Event description
     * @param eventType Type of event
     * @param startTime Event start timestamp
     * @param endTime Event end timestamp
     * @param participantLimit Maximum participants (0 for unlimited)
     * @param multiplier XP multiplier in basis points (for XP_MULTIPLIER events)
     * @param targetMetric Target value for community goals
     * @param rewardBadgeURIs Array of badge URIs for rewards
     * @param rewardTiers Array of XP reward tiers
     * @param requiresRegistration Whether users need to register
     * @param isRepeating Whether event repeats automatically
     * @param repeatInterval Interval for repeating events (in seconds)
     */
    function createEvent(
        string memory name,
        string memory description,
        EventType eventType,
        uint256 startTime,
        uint256 endTime,
        uint256 participantLimit,
        uint256 multiplier,
        uint256 targetMetric,
        string[] memory rewardBadgeURIs,
        uint256[] memory rewardTiers,
        bool requiresRegistration,
        bool isRepeating,
        uint256 repeatInterval
    ) external onlyRole(EVENT_MANAGER_ROLE) whenNotPaused {
        if (startTime < block.timestamp || endTime <= startTime) revert InvalidEventDuration();
        if (endTime - startTime > MAX_EVENT_DURATION || endTime - startTime < MIN_EVENT_DURATION) {
            revert InvalidEventDuration();
        }
        if (participantLimit > MAX_PARTICIPANT_LIMIT) revert InvalidEventDuration();
        if (eventType == EventType.XP_MULTIPLIER && (multiplier < BASIS_POINTS || multiplier > BASIS_POINTS * 10)) {
            revert InvalidMultiplier();
        }
        if (rewardBadgeURIs.length != rewardTiers.length) revert InvalidRewardConfiguration();
        
        uint256 eventId = nextEventId++;
        Event storage newEvent = events[eventId];
        
        newEvent.id = eventId;
        newEvent.name = name;
        newEvent.description = description;
        newEvent.eventType = eventType;
        newEvent.status = EventStatus.SCHEDULED;
        newEvent.startTime = startTime;
        newEvent.endTime = endTime;
        newEvent.participantLimit = participantLimit;
        newEvent.participantCount = 0;
        newEvent.multiplier = multiplier;
        newEvent.targetMetric = targetMetric;
        newEvent.currentProgress = 0;
        newEvent.requiresRegistration = requiresRegistration;
        newEvent.isRepeating = isRepeating;
        newEvent.repeatInterval = repeatInterval;
        
        // Set rewards
        for (uint256 i = 0; i < rewardBadgeURIs.length; i++) {
            newEvent.rewardBadgeURIs.push(rewardBadgeURIs[i]);
            newEvent.rewardTiers.push(rewardTiers[i]);
            newEvent.totalRewardPool += rewardTiers[i];
        }
        
        globalStats.totalEvents++;
        
        emit EventCreated(eventId, name, eventType, startTime, endTime);
    }
    
    /**
     * @notice Register for an event (if registration required)
     * @param eventId Event ID to register for
     */
    function registerForEvent(uint256 eventId) external whenNotPaused {
        Event storage eventData = events[eventId];
        if (eventData.id == 0) revert EventNotFound();
        if (eventData.status != EventStatus.SCHEDULED && eventData.status != EventStatus.ACTIVE) {
            revert EventNotActive();
        }
        if (!eventData.requiresRegistration) revert RegistrationRequired();
        if (eventData.participants[msg.sender]) revert AlreadyRegistered();
        if (eventData.participantLimit > 0 && eventData.participantCount >= eventData.participantLimit) {
            revert EventFull();
        }
        
        eventData.participants[msg.sender] = true;
        eventData.participantList[eventData.participantCount] = msg.sender;
        eventData.participantCount++;
        
        // Update user stats
        userStats[msg.sender].eventsParticipated++;
        userStats[msg.sender].eventHistory.push(eventId);
        userStats[msg.sender].typeParticipation[eventData.eventType]++;
        
        globalStats.totalParticipants++;
        
        emit UserRegistered(eventId, msg.sender);
    }
    
    /**
     * @notice Start an event (admin only)
     * @param eventId Event ID to start
     */
    function startEvent(uint256 eventId) external onlyRole(EVENT_MANAGER_ROLE) {
        Event storage eventData = events[eventId];
        if (eventData.id == 0) revert EventNotFound();
        if (eventData.status != EventStatus.SCHEDULED) revert EventNotScheduled();
        if (block.timestamp < eventData.startTime) revert EventNotScheduled();
        
        eventData.status = EventStatus.ACTIVE;
        activeEventIds.push(eventId);
        globalStats.activeEvents++;
        
        emit EventStarted(eventId, eventData.name);
    }
    
    /**
     * @notice End an event and prepare for reward distribution
     * @param eventId Event ID to end
     */
    function endEvent(uint256 eventId) external onlyRole(EVENT_MANAGER_ROLE) {
        Event storage eventData = events[eventId];
        if (eventData.id == 0) revert EventNotFound();
        if (eventData.status != EventStatus.ACTIVE) revert EventNotActive();
        
        eventData.status = EventStatus.ENDED;
        _removeFromActiveEvents(eventId);
        globalStats.activeEvents--;
        
        // Check if community goal was reached
        if (eventData.eventType == EventType.COMMUNITY_GOAL && 
            eventData.currentProgress >= eventData.targetMetric) {
            emit CommunityGoalReached(eventId, eventData.currentProgress);
        }
        
        emit EventEnded(eventId, eventData.name, eventData.participantCount);
        
        // Schedule repeat if applicable
        if (eventData.isRepeating && eventData.repeatInterval > 0) {
            _scheduleRepeatEvent(eventId);
        }
    }
    
    /**
     * @notice Update user progress in an active event
     * @param eventId Event ID
     * @param user User address
     * @param progress Progress amount to add
     */
    function updateProgress(
        uint256 eventId,
        address user,
        uint256 progress
    ) external onlyRole(EVENT_MANAGER_ROLE) whenNotPaused {
        Event storage eventData = events[eventId];
        if (eventData.id == 0) revert EventNotFound();
        if (eventData.status != EventStatus.ACTIVE) revert EventNotActive();
        
        // Auto-register users for events that don't require registration
        if (!eventData.requiresRegistration && !eventData.participants[user]) {
            if (eventData.participantLimit == 0 || eventData.participantCount < eventData.participantLimit) {
                eventData.participants[user] = true;
                eventData.participantList[eventData.participantCount] = user;
                eventData.participantCount++;
                
                userStats[user].eventsParticipated++;
                userStats[user].eventHistory.push(eventId);
                userStats[user].typeParticipation[eventData.eventType]++;
                
                emit UserRegistered(eventId, user);
            }
        }
        
        if (!eventData.participants[user]) revert NotRegistered();
        
        eventData.participantProgress[user] += progress;
        
        // Update community progress for community goals
        if (eventData.eventType == EventType.COMMUNITY_GOAL) {
            eventData.currentProgress += progress;
        }
        
        // Update leaderboards for competitive events
        if (eventData.eventType == EventType.TRADING_CONTEST) {
            leaderboards.incrementScore(user, 1, progress); // Trading volume category
        } else if (eventData.eventType == EventType.QUEST_MARATHON) {
            leaderboards.incrementScore(user, 2, progress); // Quest completion category
        }
        
        emit ProgressUpdated(eventId, user, eventData.participantProgress[user]);
    }
    
    /**
     * @notice Claim rewards for a completed event
     * @param eventId Event ID to claim rewards for
     */
    function claimRewards(uint256 eventId) external whenNotPaused nonReentrant {
        Event storage eventData = events[eventId];
        if (eventData.id == 0) revert EventNotFound();
        if (eventData.status != EventStatus.ENDED && eventData.status != EventStatus.COMPLETED) {
            revert EventNotEnded();
        }
        if (!eventData.participants[msg.sender]) revert NotRegistered();
        if (eventData.rewardsClaimed[msg.sender]) revert RewardsAlreadyClaimed();
        
        uint256 userProgress = eventData.participantProgress[msg.sender];
        if (userProgress == 0 && eventData.eventType != EventType.COMMUNITY_GOAL) {
            revert InsufficientProgress();
        }
        
        eventData.rewardsClaimed[msg.sender] = true;
        
        uint256 xpReward = 0;
        uint256 badgeCount = 0;
        
        // Calculate rewards based on event type and progress
        if (eventData.eventType == EventType.COMMUNITY_GOAL) {
            // Community goals: equal rewards for all participants if goal reached
            if (eventData.currentProgress >= eventData.targetMetric && eventData.rewardTiers.length > 0) {
                xpReward = eventData.rewardTiers[0];
                badgeCount = eventData.rewardBadgeURIs.length > 0 ? 1 : 0;
            }
        } else {
            // Individual progress-based rewards (highest tier achieved)
            for (uint256 i = eventData.rewardTiers.length; i > 0; i--) {
                uint256 tierIndex = i - 1;
                uint256 tierThreshold = (i * eventData.targetMetric) / eventData.rewardTiers.length;
                if (userProgress >= tierThreshold) {
                    xpReward = eventData.rewardTiers[tierIndex];
                    badgeCount = i;
                    break; // Award highest tier reached
                }
            }
        }
        
        // Apply XP multiplier for XP_MULTIPLIER events
        if (eventData.eventType == EventType.XP_MULTIPLIER && xpReward > 0) {
            xpReward = (xpReward * eventData.multiplier) / BASIS_POINTS;
        }
        
        // Distribute rewards
        if (xpReward > 0) {
            xpEngine.awardXP(msg.sender, xpReward);
            userStats[msg.sender].totalXPFromEvents += xpReward;
            globalStats.totalRewardsDistributed += xpReward;
        }
        
        // Mint badges based on the number of tiers achieved
        for (uint256 i = 0; i < badgeCount && i < eventData.rewardBadgeURIs.length; i++) {
            badgeMinter.mintBadge(msg.sender, eventData.rewardBadgeURIs[i]);
            userStats[msg.sender].totalBadgesFromEvents++;
        }
        
        // Update win statistics if user received rewards
        if (xpReward > 0 || badgeCount > 0) {
            userStats[msg.sender].eventsWon++;
            userStats[msg.sender].typeWins[eventData.eventType]++;
        }
        
        emit RewardDistributed(eventId, msg.sender, xpReward, badgeCount);
    }
    
    /**
     * @notice Get event information
     * @param eventId Event ID to query
     * @return name Event name
     * @return description Event description
     * @return eventType Event type
     * @return status Event status
     * @return startTime Event start time
     * @return endTime Event end time
     * @return participantCount Number of participants
     * @return currentProgress Current progress (for community goals)
     */
    function getEventInfo(uint256 eventId) external view returns (
        string memory name,
        string memory description,
        EventType eventType,
        EventStatus status,
        uint256 startTime,
        uint256 endTime,
        uint256 participantCount,
        uint256 currentProgress
    ) {
        Event storage eventData = events[eventId];
        if (eventData.id == 0) revert EventNotFound();
        
        return (
            eventData.name,
            eventData.description,
            eventData.eventType,
            eventData.status,
            eventData.startTime,
            eventData.endTime,
            eventData.participantCount,
            eventData.currentProgress
        );
    }
    
    /**
     * @notice Get user's progress in an event
     * @param eventId Event ID
     * @param user User address
     * @return isParticipant Whether user is participating
     * @return progress User's progress
     * @return rewardsClaimed Whether rewards have been claimed
     */
    function getUserEventProgress(uint256 eventId, address user) external view returns (
        bool isParticipant,
        uint256 progress,
        bool rewardsClaimed
    ) {
        Event storage eventData = events[eventId];
        if (eventData.id == 0) revert EventNotFound();
        
        return (
            eventData.participants[user],
            eventData.participantProgress[user],
            eventData.rewardsClaimed[user]
        );
    }
    
    /**
     * @notice Get active events
     * @return activeIds Array of active event IDs
     */
    function getActiveEvents() external view returns (uint256[] memory activeIds) {
        return activeEventIds;
    }
    
    /**
     * @notice Get user event statistics
     * @param user User address
     * @return eventsParticipated Total events participated in
     * @return eventsWon Total events won
     * @return totalXPFromEvents Total XP earned from events
     * @return totalBadgesFromEvents Total badges earned from events
     */
    function getUserStats(address user) external view returns (
        uint256 eventsParticipated,
        uint256 eventsWon,
        uint256 totalXPFromEvents,
        uint256 totalBadgesFromEvents
    ) {
        UserEventStats storage stats = userStats[user];
        return (
            stats.eventsParticipated,
            stats.eventsWon,
            stats.totalXPFromEvents,
            stats.totalBadgesFromEvents
        );
    }
    
    /**
     * @notice Get global event statistics
     * @return totalEvents Total events created
     * @return activeEvents Currently active events
     * @return totalParticipants Total unique participants
     * @return totalRewardsDistributed Total rewards distributed
     */
    function getGlobalStats() external view returns (
        uint256 totalEvents,
        uint256 activeEvents,
        uint256 totalParticipants,
        uint256 totalRewardsDistributed
    ) {
        return (
            globalStats.totalEvents,
            globalStats.activeEvents,
            globalStats.totalParticipants,
            globalStats.totalRewardsDistributed
        );
    }
    
    /**
     * @notice Remove event from active events array
     * @param eventId Event ID to remove
     */
    function _removeFromActiveEvents(uint256 eventId) internal {
        for (uint256 i = 0; i < activeEventIds.length; i++) {
            if (activeEventIds[i] == eventId) {
                activeEventIds[i] = activeEventIds[activeEventIds.length - 1];
                activeEventIds.pop();
                break;
            }
        }
    }
    
    /**
     * @notice Schedule a repeat event
     * @param originalEventId Original event ID
     */
    function _scheduleRepeatEvent(uint256 originalEventId) internal {
        Event storage original = events[originalEventId];
        
        // Create new event with same parameters
        uint256 newEventId = nextEventId++;
        Event storage newEvent = events[newEventId];
        
        newEvent.id = newEventId;
        newEvent.name = string(abi.encodePacked(original.name, " (Repeat)"));
        newEvent.description = original.description;
        newEvent.eventType = original.eventType;
        newEvent.status = EventStatus.SCHEDULED;
        newEvent.startTime = original.endTime + original.repeatInterval;
        newEvent.endTime = newEvent.startTime + (original.endTime - original.startTime);
        newEvent.participantLimit = original.participantLimit;
        newEvent.participantCount = 0;
        newEvent.multiplier = original.multiplier;
        newEvent.targetMetric = original.targetMetric;
        newEvent.currentProgress = 0;
        newEvent.requiresRegistration = original.requiresRegistration;
        newEvent.isRepeating = original.isRepeating;
        newEvent.repeatInterval = original.repeatInterval;
        
        // Copy rewards
        for (uint256 i = 0; i < original.rewardBadgeURIs.length; i++) {
            newEvent.rewardBadgeURIs.push(original.rewardBadgeURIs[i]);
            newEvent.rewardTiers.push(original.rewardTiers[i]);
            newEvent.totalRewardPool += original.rewardTiers[i];
        }
        
        globalStats.totalEvents++;
        
        emit EventRepeated(originalEventId, newEventId);
        emit EventCreated(newEventId, newEvent.name, newEvent.eventType, newEvent.startTime, newEvent.endTime);
    }
    
    /**
     * @notice Emergency stop for an event
     * @param eventId Event ID to stop
     */
    function emergencyStopEvent(uint256 eventId) external onlyRole(ADMIN_ROLE) {
        Event storage eventData = events[eventId];
        if (eventData.id == 0) revert EventNotFound();
        
        if (eventData.status == EventStatus.ACTIVE) {
            _removeFromActiveEvents(eventId);
            globalStats.activeEvents--;
        }
        
        eventData.status = EventStatus.ENDED;
    }
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}