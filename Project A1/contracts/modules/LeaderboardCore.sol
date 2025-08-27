// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/ILeaderboardCore.sol";
import "../libraries/ValidationUtils.sol";

/**
 * @title LeaderboardCore
 * @dev Core leaderboard functionality for ranking users
 */
contract LeaderboardCore is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ILeaderboardCore,
    UUPSUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SCORE_MANAGER_ROLE = keccak256("SCORE_MANAGER_ROLE");
    
    // Nested mappings: leaderboardType => timeFrame => user => entry
    mapping(LeaderboardType => mapping(TimeFrame => mapping(address => LeaderboardEntry))) public userEntries;
    
    // Nested mappings: leaderboardType => timeFrame => sorted array of entries
    mapping(LeaderboardType => mapping(TimeFrame => LeaderboardEntry[])) public leaderboards;
    
    // Nested mappings: leaderboardType => timeFrame => config
    mapping(LeaderboardType => mapping(TimeFrame => LeaderboardConfig)) public leaderboardConfigs;
    
    // User position in leaderboard for O(1) lookups
    mapping(LeaderboardType => mapping(TimeFrame => mapping(address => uint256))) public userPositions;
    
    uint256 public constant MAX_LEADERBOARD_SIZE = 1000;
    
    /**
     * @dev Initialize the leaderboard core
     */
    function initialize(address admin) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(SCORE_MANAGER_ROLE, admin);
        
        // Initialize default configs
        _initializeDefaultConfigs();
    }
    
    /**
     * @dev Internal function to update user score on leaderboard
     */
    function _updateScore(
        address user,
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        uint256 newScore
    ) internal whenNotPaused {
        ValidationUtils.requireNonZeroAddress(user);
        require(_isLeaderboardActive(leaderboardType, timeFrame), "Leaderboard not active");
        
        LeaderboardEntry storage userEntry = userEntries[leaderboardType][timeFrame][user];
        uint256 oldScore = userEntry.score;
        
        // Update user entry
        userEntry.user = user;
        userEntry.score = newScore;
        userEntry.lastUpdated = block.timestamp;
        
        // Update leaderboard position
        _updateLeaderboardPosition(user, leaderboardType, timeFrame, newScore, oldScore);
        
        uint256 newRank = userPositions[leaderboardType][timeFrame][user] + 1; // Position is 0-based, rank is 1-based
        userEntry.rank = newRank;
        
        emit ScoreUpdated(user, leaderboardType, timeFrame, newScore, newRank);
        
        // Check for new leader
        if (newRank == 1) {
            emit NewLeader(user, leaderboardType, timeFrame, newScore);
        }
    }

    /**
     * @dev Update user score on leaderboard (external entry point)
     */
    function updateScore(
        address user,
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        uint256 newScore
    ) external onlyRole(SCORE_MANAGER_ROLE) {
        _updateScore(user, leaderboardType, timeFrame, newScore);
    }
    
    /**
     * @dev Increment user score
     */
    function incrementScore(
        address user,
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        uint256 increment
    ) external onlyRole(SCORE_MANAGER_ROLE) whenNotPaused {
        uint256 currentScore = userEntries[leaderboardType][timeFrame][user].score;
        _updateScore(user, leaderboardType, timeFrame, currentScore + increment);
    }
    
    
    /**
     * @dev Get leaderboard entries
     */
    function getLeaderboard(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        uint256 limit
    ) external view returns (LeaderboardEntry[] memory) {
        LeaderboardEntry[] storage board = leaderboards[leaderboardType][timeFrame];
        uint256 length = board.length > limit ? limit : board.length;
        
        LeaderboardEntry[] memory result = new LeaderboardEntry[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = board[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get user score and rank
     */
    function getUserScore(
        address user,
        LeaderboardType leaderboardType,
        TimeFrame timeFrame
    ) external view returns (uint256 score, uint256 rank) {
        LeaderboardEntry memory entry = userEntries[leaderboardType][timeFrame][user];
        score = entry.score;
        rank = entry.rank;
    }
    
    /**
     * @dev Get user rank
     */
    function getUserRank(
        address user,
        LeaderboardType leaderboardType,
        TimeFrame timeFrame
    ) external view returns (uint256) {
        return userEntries[leaderboardType][timeFrame][user].rank;
    }
    
    /**
     * @dev Get top users
     */
    function getTopUsers(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        uint256 count
    ) external view returns (address[] memory users, uint256[] memory scores) {
        LeaderboardEntry[] storage board = leaderboards[leaderboardType][timeFrame];
        uint256 length = board.length > count ? count : board.length;
        
        users = new address[](length);
        scores = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            users[i] = board[i].user;
            scores[i] = board[i].score;
        }
    }
    
    /**
     * @dev Reset leaderboard
     */
    function resetLeaderboard(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame
    ) external onlyRole(ADMIN_ROLE) {
        _resetLeaderboard(leaderboardType, timeFrame);
    }

    function _resetLeaderboard(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame
    ) internal {
        LeaderboardEntry[] storage board = leaderboards[leaderboardType][timeFrame];
        
        // Clear user entries and positions
        for (uint256 i = 0; i < board.length; i++) {
            address user = board[i].user;
            delete userEntries[leaderboardType][timeFrame][user];
            delete userPositions[leaderboardType][timeFrame][user];
        }
        
        // Clear leaderboard
        delete leaderboards[leaderboardType][timeFrame];
        
        emit LeaderboardReset(leaderboardType, timeFrame);
    }
    
    /**
     * @dev Set leaderboard configuration
     */
    function setLeaderboardConfig(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame,
        LeaderboardConfig calldata config
    ) external onlyRole(ADMIN_ROLE) {
        leaderboardConfigs[leaderboardType][timeFrame] = config;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Start new season
     */
    function startNewSeason(
        LeaderboardType leaderboardType,
        uint256 duration
    ) external onlyRole(ADMIN_ROLE) {
        ValidationUtils.requireNonZeroAmount(duration);
        
        // Reset all time frames for this leaderboard type
        _resetLeaderboard(leaderboardType, TimeFrame.DAILY);
        _resetLeaderboard(leaderboardType, TimeFrame.WEEKLY);
        _resetLeaderboard(leaderboardType, TimeFrame.MONTHLY);
        
        // Update season configs
        for (uint256 i = 0; i < 4; i++) {
            TimeFrame timeFrame = TimeFrame(i);
            LeaderboardConfig storage config = leaderboardConfigs[leaderboardType][timeFrame];
            config.seasonStartTime = block.timestamp;
            config.seasonDuration = duration;
            config.isActive = true;
        }
    }
    
    /**
     * @dev Update leaderboard position for user
     */
    function _updateLeaderboardPosition(
        address user,
        LeaderboardType category,
        TimeFrame timeFrame,
        uint256 newScore,
        uint256 /* oldScore */
    ) internal {
        LeaderboardEntry[] storage board = leaderboards[category][timeFrame];
        uint256 currentPosition = userPositions[category][timeFrame][user];
        
        // If user doesn't exist in leaderboard, add them
        if (currentPosition == 0 && (board.length == 0 || board[0].user != user)) {
            board.push(LeaderboardEntry({
                user: user,
                score: newScore,
                lastUpdated: block.timestamp,
                rank: board.length + 1
            }));
            userPositions[category][timeFrame][user] = board.length - 1;
            currentPosition = board.length - 1;
        }
        
        // Update score
        board[currentPosition].score = newScore;
        board[currentPosition].lastUpdated = block.timestamp;
        
        // Simple bubble sort to maintain order (optimize for small movements)
        _bubbleSortPosition(board, currentPosition, user, category, timeFrame);
    }
    
    /**
     * @dev Bubble sort to maintain leaderboard order
     */
    function _bubbleSortPosition(
        LeaderboardEntry[] storage board,
        uint256 position,
        address user,
        LeaderboardType category,
        TimeFrame timeFrame
    ) internal {
        uint256 newPosition = position;
        
        // Move up if score increased
        while (newPosition > 0 && board[newPosition].score > board[newPosition - 1].score) {
            // Swap positions
            LeaderboardEntry memory temp = board[newPosition];
            board[newPosition] = board[newPosition - 1];
            board[newPosition - 1] = temp;
            
            // Update position mappings
            userPositions[category][timeFrame][board[newPosition].user] = newPosition;
            userPositions[category][timeFrame][board[newPosition - 1].user] = newPosition - 1;
            
            newPosition--;
        }
        
        // Move down if score decreased
        while (newPosition < board.length - 1 && board[newPosition].score < board[newPosition + 1].score) {
            // Swap positions
            LeaderboardEntry memory temp = board[newPosition];
            board[newPosition] = board[newPosition + 1];
            board[newPosition + 1] = temp;
            
            // Update position mappings
            userPositions[category][timeFrame][board[newPosition].user] = newPosition;
            userPositions[category][timeFrame][board[newPosition + 1].user] = newPosition + 1;
            
            newPosition++;
        }
        
        // Update ranks
        for (uint256 i = 0; i < board.length; i++) {
            board[i].rank = i + 1;
            userEntries[category][timeFrame][board[i].user].rank = i + 1;
        }
    }
    
    /**
     * @dev Check if leaderboard is active
     */
    function _isLeaderboardActive(
        LeaderboardType leaderboardType,
        TimeFrame timeFrame
    ) internal view returns (bool) {
        LeaderboardConfig memory config = leaderboardConfigs[leaderboardType][timeFrame];
        return config.isActive;
    }
    
    /**
     * @dev Initialize default configurations
     */
    function _initializeDefaultConfigs() internal {
        for (uint256 i = 0; i < 5; i++) {
            for (uint256 j = 0; j < 4; j++) {
                LeaderboardType lbType = LeaderboardType(i);
                TimeFrame timeFrame = TimeFrame(j);
                
                leaderboardConfigs[lbType][timeFrame] = LeaderboardConfig({
                    isActive: true,
                    maxEntries: MAX_LEADERBOARD_SIZE,
                    updateCooldown: 0,
                    seasonStartTime: block.timestamp,
                    seasonDuration: 365 days
                });
            }
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
}
