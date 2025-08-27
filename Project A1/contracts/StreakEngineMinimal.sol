// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IStreakRewardManager {
    function checkAndAwardRewards(address user, uint8 streakType, uint256 streakLength) external;
}

interface IStreakMilestoneManager {
    function checkMilestones(address user, uint256 streakLength) external;
}

interface IStreakStatisticsManager {
    function updateGlobalStats(address user, uint8 streakType, uint256 newStreakLength, uint256 totalUserStreakDays) external;
    function getUserStats(address user) external view returns (uint256, uint256, bool);
}

/**
 * @title StreakEngineMinimal
 * @dev Ultra-lightweight streak tracking that delegates to external managers
 * @notice Core streak functionality with external reward/milestone/stats management
 */
contract StreakEngineMinimal is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable{
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant STREAK_MANAGER_ROLE = keccak256("STREAK_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    enum StreakType { DAILY_LOGIN, QUEST_COMPLETION, TRADING, GOVERNANCE, SOCIAL_INTERACTION }
    
    struct UserStreaks {
        uint128 dailyLogin;
        uint128 questCompletion; 
        uint128 trading;
        uint128 governance;
        uint128 social;
        uint32 lastLoginDate;
        uint32 lastQuestDate;
        uint32 lastTradingDate;
        uint32 lastGovernanceDate;
        uint32 lastSocialDate;
    }
    
    // External managers
    IStreakRewardManager public rewardManager;
    IStreakMilestoneManager public milestoneManager;
    IStreakStatisticsManager public statsManager;
    
    // Core data
    mapping(address => UserStreaks) public userStreaks;
    
    // Events
    event StreakIncreased(address indexed user, StreakType streakType, uint256 newStreak);
    event StreakBroken(address indexed user, StreakType streakType, uint256 finalStreak);
    
    function initialize(
        address _rewardManager,
        address _milestoneManager,
        address _statsManager
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    
        rewardManager = IStreakRewardManager(_rewardManager);
        milestoneManager = IStreakMilestoneManager(_milestoneManager);
        statsManager = IStreakStatisticsManager(_statsManager);
    }

    /**
     * @notice Authorizes an upgrade to a new implementation
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
    
    function recordDailyLogin() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, StreakType.DAILY_LOGIN);
    }
    
    function recordQuestCompletion() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, StreakType.QUEST_COMPLETION);
    }
    
    function recordTradingActivity() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, StreakType.TRADING);
    }
    
    function recordGovernanceParticipation() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, StreakType.GOVERNANCE);
    }
    
    function recordSocialInteraction() external whenNotPaused nonReentrant {
        _updateStreak(msg.sender, StreakType.SOCIAL_INTERACTION);
    }
    
    function _updateStreak(address user, StreakType streakType) internal {
        UserStreaks storage streaks = userStreaks[user];
        uint256 today = block.timestamp / 86400;
        uint256 currentStreak;
        uint256 lastDate;
        
        if (streakType == StreakType.DAILY_LOGIN) {
            lastDate = streaks.lastLoginDate;
            if (today == lastDate + 1) {
                streaks.dailyLogin++;
                currentStreak = streaks.dailyLogin;
            } else if (today > lastDate + 1) {
                streaks.dailyLogin = 1;
                currentStreak = 1;
                if (lastDate > 0) emit StreakBroken(user, streakType, streaks.dailyLogin);
            } else {
                return; // Same day, no update
            }
            streaks.lastLoginDate = uint32(today);
        } else if (streakType == StreakType.QUEST_COMPLETION) {
            lastDate = streaks.lastQuestDate;
            if (today == lastDate + 1) {
                streaks.questCompletion++;
                currentStreak = streaks.questCompletion;
            } else if (today > lastDate + 1) {
                streaks.questCompletion = 1;
                currentStreak = 1;
                if (lastDate > 0) emit StreakBroken(user, streakType, streaks.questCompletion);
            } else {
                return;
            }
            streaks.lastQuestDate = uint32(today);
        } else if (streakType == StreakType.TRADING) {
            lastDate = streaks.lastTradingDate;
            if (today == lastDate + 1) {
                streaks.trading++;
                currentStreak = streaks.trading;
            } else if (today > lastDate + 1) {
                streaks.trading = 1;
                currentStreak = 1;
                if (lastDate > 0) emit StreakBroken(user, streakType, streaks.trading);
            } else {
                return;
            }
            streaks.lastTradingDate = uint32(today);
        } else if (streakType == StreakType.GOVERNANCE) {
            lastDate = streaks.lastGovernanceDate;
            if (today == lastDate + 1) {
                streaks.governance++;
                currentStreak = streaks.governance;
            } else if (today > lastDate + 1) {
                streaks.governance = 1;
                currentStreak = 1;
                if (lastDate > 0) emit StreakBroken(user, streakType, streaks.governance);
            } else {
                return;
            }
            streaks.lastGovernanceDate = uint32(today);
        } else if (streakType == StreakType.SOCIAL_INTERACTION) {
            lastDate = streaks.lastSocialDate;
            if (today == lastDate + 1) {
                streaks.social++;
                currentStreak = streaks.social;
            } else if (today > lastDate + 1) {
                streaks.social = 1;
                currentStreak = 1;
                if (lastDate > 0) emit StreakBroken(user, streakType, streaks.social);
            } else {
                return;
            }
            streaks.lastSocialDate = uint32(today);
        }
        
        emit StreakIncreased(user, streakType, currentStreak);
        
        // Delegate to external managers
        rewardManager.checkAndAwardRewards(user, uint8(streakType), currentStreak);
        milestoneManager.checkMilestones(user, currentStreak);
        
        // Calculate total streak days for stats
        uint256 totalDays = uint256(streaks.dailyLogin) + streaks.questCompletion + 
                           streaks.trading + streaks.governance + streaks.social;
        statsManager.updateGlobalStats(user, uint8(streakType), currentStreak, totalDays);
    }
    
    function getUserStreaks(address user) external view returns (
        uint256 dailyLogin,
        uint256 questCompletion,
        uint256 trading,
        uint256 governance,
        uint256 social,
        uint256 lastLogin,
        uint256 lastQuest,
        uint256 lastTrading,
        uint256 lastGov,
        uint256 lastSocial
    ) {
        UserStreaks storage streaks = userStreaks[user];
        return (
            streaks.dailyLogin,
            streaks.questCompletion,
            streaks.trading,
            streaks.governance,
            streaks.social,
            streaks.lastLoginDate,
            streaks.lastQuestDate,
            streaks.lastTradingDate,
            streaks.lastGovernanceDate,
            streaks.lastSocialDate
        );
    }
    
    function setManagers(
        address _rewardManager,
        address _milestoneManager,
        address _statsManager
    ) external onlyRole(ADMIN_ROLE) {
        rewardManager = IStreakRewardManager(_rewardManager);
        milestoneManager = IStreakMilestoneManager(_milestoneManager);
        statsManager = IStreakStatisticsManager(_statsManager);
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}