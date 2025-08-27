// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IGuildRewards.sol";
import "../interfaces/IGuildCore.sol";
import "../libraries/MathUtils.sol";
import "../libraries/ValidationUtils.sol";

// XP and Badge interfaces
interface IXPEngine {
    function awardXP(address user, uint256 amount) external;
}

interface IBadgeMinter {
    function mintBadge(address to, string memory tokenURI) external returns (uint256);
}

/**
 * @title GuildRewards
 * @dev Manages reward distribution for guild activities
 */
contract GuildRewards is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IGuildRewards
{
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REWARD_MANAGER_ROLE = keccak256("REWARD_MANAGER_ROLE");
    
    IGuildCore public guildCore;
    IERC20 public rewardToken;
    
    // State variables
    mapping(uint256 => RewardPool) public rewardPools;
    mapping(uint256 => mapping(address => MemberReward)) public memberRewards;
    
    uint256 public rewardDistributionPeriod;
    uint256 public minContributionForRewards;
    uint256 public totalRewardsDistributed;
    
    IXPEngine public xpEngine;
    IBadgeMinter public badgeMinter;
    
    /**
     * @dev Initialize the guild rewards system
     */
    function initialize(
        address admin,
        address _guildCore,
        address _rewardToken,
        address _xpEngine,
        address _badgeMinter
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(REWARD_MANAGER_ROLE, admin);
        
        guildCore = IGuildCore(_guildCore);
        rewardToken = IERC20(_rewardToken);
        xpEngine = IXPEngine(_xpEngine);
        badgeMinter = IBadgeMinter(_badgeMinter);
        
        rewardDistributionPeriod = 7 days;
        minContributionForRewards = 100; // Minimum contribution points
    }
    
/**
 * @dev Distribute rewards to guild members
 */
function distributeRewards(uint256 guildId, uint256 totalReward) 
    external 
    onlyRole(REWARD_MANAGER_ROLE) 
    whenNotPaused 
    nonReentrant 
{
    IGuildCore.Guild memory guild = guildCore.getGuild(guildId);
    require(guild.isActive, "Guild not active");
    ValidationUtils.requireNonZeroAmount(totalReward);

    // Transfer rewards to contract
    rewardToken.safeTransferFrom(msg.sender, address(this), totalReward);

    address[] memory members = guildCore.getGuildMembers(guildId);
    uint256 qualifiedMembers = 0;

    // Declare rewardPerPoint outside the if block so it can be used later
    uint256 rewardPerPoint = 0;

    if (guild.totalContributions > 0) {
        // Reward per point just for this batch
        rewardPerPoint = totalReward / guild.totalContributions;

        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];
            IGuildCore.Member memory memberInfo = guildCore.getMember(guildId, member);

            if (memberInfo.contributionScore >= minContributionForRewards) {
                uint256 memberReward = memberInfo.contributionScore * rewardPerPoint;
                memberRewards[guildId][member].pendingRewards += memberReward;
                qualifiedMembers++;
            }
        }
    }

    // Update pool bookkeeping (optional — for viewing/stats)
    RewardPool storage pool = rewardPools[guildId];
    pool.rewardPerContribution = rewardPerPoint;
    pool.totalPool += totalReward;
    pool.lastUpdateTime = block.timestamp;

    totalRewardsDistributed += totalReward;
    emit RewardsDistributed(guildId, totalReward, qualifiedMembers);
}


    
    /**
     * @dev Claim pending rewards
     */
    function claimRewards(uint256 guildId) external whenNotPaused nonReentrant {
        require(guildCore.isGuildMember(guildId, msg.sender), "Not guild member");
        
        MemberReward storage reward = memberRewards[guildId][msg.sender];
        uint256 pendingAmount = reward.pendingRewards;
        require(pendingAmount > 0, "No pending rewards");
        
        reward.pendingRewards = 0;
        reward.claimedRewards += pendingAmount;
        reward.lastClaimTime = block.timestamp;
        
        // Update pool
        rewardPools[guildId].distributedAmount += pendingAmount;
        
        // Transfer tokens
        rewardToken.safeTransfer(msg.sender, pendingAmount);
        
        // Award bonus XP for claiming rewards
        uint256 bonusXP = MathUtils.calculatePercentage(pendingAmount, 500); // 5% as XP
        xpEngine.awardXP(msg.sender, bonusXP);
        
        emit RewardsClaimed(guildId, msg.sender, pendingAmount);
    }
    
    /**
     * @dev Record member contribution
     */
    function recordContribution(uint256 guildId, address member, uint256 points) 
        external 
        onlyRole(REWARD_MANAGER_ROLE) 
        whenNotPaused 
    {
        require(guildCore.isGuildMember(guildId, member), "Not guild member");
        ValidationUtils.requireNonZeroAmount(points);
        
        // Update member reward tracking
        memberRewards[guildId][member].contributionPoints += points;
        
        // Update guild core contribution score
        guildCore.updateMemberContribution(guildId, member, points);
        
        // Update guild core contribution score
        guildCore.updateMemberContribution(guildId, member, points);
        
        // Award immediate XP for contribution
        uint256 xpReward = MathUtils.calculateXPReward(points, 10000, 0); // 1:1 ratio
        xpEngine.awardXP(member, xpReward);
        
        emit ContributionRecorded(guildId, member, points);
    }
    
    /**
     * @dev Get pending rewards for member
     */
    function getPendingRewards(uint256 guildId, address member) external view returns (uint256) {
        return memberRewards[guildId][member].pendingRewards;
    }
    
    /**
     * @dev Get reward pool information
     */
    function getRewardPool(uint256 guildId) external view returns (RewardPool memory) {
        return rewardPools[guildId];
    }
    
    /**
     * @dev Get member reward information
     */
    function getMemberReward(uint256 guildId, address member) external view returns (MemberReward memory) {
        return memberRewards[guildId][member];
    }
    
    /**
     * @dev Calculate reward share for member
     */
    function calculateRewardShare(uint256 guildId, address member) external view returns (uint256) {
        IGuildCore.Member memory memberInfo = guildCore.getMember(guildId, member);
        RewardPool memory pool = rewardPools[guildId];
        
        if (memberInfo.contributionScore == 0 || pool.rewardPerContribution == 0) {
            return 0;
        }
        
        return memberInfo.contributionScore * pool.rewardPerContribution;
    }
    
    /**
     * @dev Distribute milestone badges for top contributors
     */
    function distributeMilestoneBadges(uint256 guildId, string calldata badgeURI) 
        external 
        onlyRole(REWARD_MANAGER_ROLE) 
    {
        address[] memory members = guildCore.getGuildMembers(guildId);
        
        // Find top 3 contributors
        address[] memory topContributors = new address[](3);
        uint256[] memory topScores = new uint256[](3);
        
        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];
            IGuildCore.Member memory memberInfo = guildCore.getMember(guildId, member);
            
            // Check if this member should be in top 3
            for (uint256 j = 0; j < 3; j++) {
                if (memberInfo.contributionScore > topScores[j]) {
                    // Shift others down
                    for (uint256 k = 2; k > j; k--) {
                        topContributors[k] = topContributors[k-1];
                        topScores[k] = topScores[k-1];
                    }
                    topContributors[j] = member;
                    topScores[j] = memberInfo.contributionScore;
                    break;
                }
            }
        }
        
        // Mint badges for top contributors
        for (uint256 i = 0; i < 3; i++) {
            if (topContributors[i] != address(0)) {
                badgeMinter.mintBadge(topContributors[i], badgeURI);
            }
        }
    }
    
    // Admin functions
    function setRewardDistributionPeriod(uint256 newPeriod) external onlyRole(ADMIN_ROLE) {
        ValidationUtils.requireNonZeroAmount(newPeriod);
        rewardDistributionPeriod = newPeriod;
    }
    
    function setMinContributionForRewards(uint256 newMinContribution) external onlyRole(ADMIN_ROLE) {
        minContributionForRewards = newMinContribution;
    }
    
    function setRewardToken(address newToken) external onlyRole(ADMIN_ROLE) {
        ValidationUtils.requireNonZeroAddress(newToken);
        rewardToken = IERC20(newToken);
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}