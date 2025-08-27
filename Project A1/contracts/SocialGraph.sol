// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IXPEngine {
    function awardXP(address _user, uint256 _amount) external;
}

/**
 * @title SocialGraph
 * @dev Comprehensive social layer for the Avax Forge Empire ecosystem
 * @notice This contract manages user relationships, social interactions, and community features
 * @author Avax Forge Empire Team
 */
contract SocialGraph is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    IXPEngine public xpEngine;
    
    struct Post {
        uint256 id;
        address author;
        string content;
        uint256 timestamp;
        uint256 likes;
        uint256 shares;
        bool isActive;
        mapping(address => bool) likedBy;
        mapping(address => bool) sharedBy;
    }
    
    struct UserSocialStats {
        uint256 followersCount;
        uint256 followingCount;
        uint256 postsCount;
        uint256 totalLikes;
        uint256 totalShares;
        uint256 socialScore; // Calculated based on engagement
    }
    
    // Social connections
    mapping(address => address[]) public following;
    mapping(address => address[]) public followers;
    mapping(address => mapping(address => bool)) public isFollowing;
    
    // Posts and content
    mapping(uint256 => Post) public posts;
    mapping(address => uint256[]) public userPosts;
    uint256 public nextPostId;
    
    // User statistics
    mapping(address => UserSocialStats) public userStats;
    
    // Anti-farming tracking
    mapping(address => uint256) public lastFollowTime;
    mapping(address => uint256) public lastPostTime;
    mapping(address => mapping(uint256 => uint256)) public dailyFollowCount; // user => day => count
    mapping(address => mapping(uint256 => uint256)) public dailyPostCount; // user => day => count
    mapping(address => mapping(address => uint256)) public followTimestamp; // follower => followed => timestamp
    
    // Content moderation
    mapping(uint256 => bool) public reportedPosts;
    mapping(uint256 => uint256) public postReportCount;
    
    // Configuration
    uint256 public constant MAX_CONTENT_LENGTH = 280;
    uint256 public constant XP_REWARD_FOLLOW = 5;
    uint256 public constant XP_REWARD_POST = 10;
    uint256 public constant XP_REWARD_LIKE = 1;
    uint256 public constant XP_REWARD_SHARE = 3;
    uint256 public constant REPORTS_FOR_REMOVAL = 5;
    
    // Anti-farming measures
    uint256 public constant FOLLOW_COOLDOWN = 1 hours; // Cooldown between follows
    uint256 public constant POST_COOLDOWN = 10 minutes; // Cooldown between posts
    uint256 public constant MAX_FOLLOWS_PER_DAY = 50; // Maximum follows per day
    uint256 public constant MAX_POSTS_PER_DAY = 20; // Maximum posts per day
    uint256 public constant MIN_FOLLOW_DURATION = 24 hours; // Minimum time before unfollowing for XP
    
    // Events
    event UserFollowed(address indexed follower, address indexed followed);
    event UserUnfollowed(address indexed follower, address indexed unfollowed);
    event PostCreated(uint256 indexed postId, address indexed author, string content);
    event PostLiked(uint256 indexed postId, address indexed liker);
    event PostUnliked(uint256 indexed postId, address indexed unliker);
    event PostShared(uint256 indexed postId, address indexed sharer);
    event PostReported(uint256 indexed postId, address indexed reporter);
    event PostRemoved(uint256 indexed postId, string reason);
    event SocialScoreUpdated(address indexed user, uint256 newScore);
    
    // Custom Errors
    error CannotFollowSelf();
    error AlreadyFollowing();
    error NotFollowing();
    error PostNotFound();
    error PostInactive();
    error ContentTooLong();
    error EmptyContent();
    error AlreadyLiked();
    error NotLiked();
    error AlreadyShared();
    error AlreadyReported();
    error UnauthorizedAction();
    error FollowCooldownActive();
    error PostCooldownActive();
    error DailyFollowLimitReached();
    error DailyPostLimitReached();
    error FollowDurationTooShort();
    
    /**
     * @notice Initializes the SocialGraph contract
     * @param _xpEngineAddress Address of the XP Engine contract
     */
    function initialize(address _xpEngineAddress) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        xpEngine = IXPEngine(_xpEngineAddress);
        nextPostId = 1;
    }
    

    /**
     * @notice Authorizes an upgrade to a new implementation
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
    
    /**
     * @notice Follow another user
     * @param userToFollow Address of the user to follow
     */
    function followUser(address userToFollow) external whenNotPaused nonReentrant {
        if (userToFollow == msg.sender) revert CannotFollowSelf();
        if (isFollowing[msg.sender][userToFollow]) revert AlreadyFollowing();
        
        // Anti-farming validations
        if (block.timestamp < lastFollowTime[msg.sender] + FOLLOW_COOLDOWN) {
            revert FollowCooldownActive();
        }
        
        uint256 currentDay = block.timestamp / 1 days;
        if (dailyFollowCount[msg.sender][currentDay] >= MAX_FOLLOWS_PER_DAY) {
            revert DailyFollowLimitReached();
        }
        
        // Add to following list
        following[msg.sender].push(userToFollow);
        isFollowing[msg.sender][userToFollow] = true;
        
        // Add to followers list
        followers[userToFollow].push(msg.sender);
        
        // Update anti-farming tracking
        lastFollowTime[msg.sender] = block.timestamp;
        dailyFollowCount[msg.sender][currentDay]++;
        followTimestamp[msg.sender][userToFollow] = block.timestamp;
        
        // Update stats
        userStats[msg.sender].followingCount++;
        userStats[userToFollow].followersCount++;
        
        // Award XP for social interaction
        xpEngine.awardXP(msg.sender, XP_REWARD_FOLLOW);
        
        // Update social scores
        _updateSocialScore(msg.sender);
        _updateSocialScore(userToFollow);
        
        emit UserFollowed(msg.sender, userToFollow);
    }
    
    /**
     * @notice Unfollow a user
     * @param userToUnfollow Address of the user to unfollow
     */
    function unfollowUser(address userToUnfollow) external whenNotPaused nonReentrant {
        if (!isFollowing[msg.sender][userToUnfollow]) revert NotFollowing();
        
        // Anti-farming: Check minimum follow duration to prevent follow/unfollow cycling
        uint256 followTime = followTimestamp[msg.sender][userToUnfollow];
        if (block.timestamp < followTime + MIN_FOLLOW_DURATION) {
            revert FollowDurationTooShort();
        }
        
        // Remove from following list
        _removeFromArray(following[msg.sender], userToUnfollow);
        isFollowing[msg.sender][userToUnfollow] = false;
        
        // Remove from followers list
        _removeFromArray(followers[userToUnfollow], msg.sender);
        
        // Update stats
        userStats[msg.sender].followingCount--;
        userStats[userToUnfollow].followersCount--;
        
        // Update social scores
        _updateSocialScore(msg.sender);
        _updateSocialScore(userToUnfollow);
        
        emit UserUnfollowed(msg.sender, userToUnfollow);
    }
    
    /**
     * @notice Create a new post
     * @param content The content of the post
     */
    function createPost(string memory content) external whenNotPaused nonReentrant {
        if (bytes(content).length == 0) revert EmptyContent();
        if (bytes(content).length > MAX_CONTENT_LENGTH) revert ContentTooLong();
        
        // Anti-farming validations
        if (block.timestamp < lastPostTime[msg.sender] + POST_COOLDOWN) {
            revert PostCooldownActive();
        }
        
        uint256 currentDay = block.timestamp / 1 days;
        if (dailyPostCount[msg.sender][currentDay] >= MAX_POSTS_PER_DAY) {
            revert DailyPostLimitReached();
        }
        
        uint256 postId = nextPostId++;
        
        Post storage newPost = posts[postId];
        newPost.id = postId;
        newPost.author = msg.sender;
        newPost.content = content;
        newPost.timestamp = block.timestamp;
        newPost.isActive = true;
        
        // Add to user's posts
        userPosts[msg.sender].push(postId);
        
        // Update anti-farming tracking
        lastPostTime[msg.sender] = block.timestamp;
        dailyPostCount[msg.sender][currentDay]++;
        
        // Update user stats
        userStats[msg.sender].postsCount++;
        
        // Award XP for content creation
        xpEngine.awardXP(msg.sender, XP_REWARD_POST);
        
        // Update social score
        _updateSocialScore(msg.sender);
        
        emit PostCreated(postId, msg.sender, content);
    }
    
    /**
     * @notice Like a post
     * @param postId The ID of the post to like
     */
    function likePost(uint256 postId) external whenNotPaused nonReentrant {
        Post storage post = posts[postId];
        if (post.id == 0) revert PostNotFound();
        if (!post.isActive) revert PostInactive();
        if (post.likedBy[msg.sender]) revert AlreadyLiked();
        
        // Prevent self-liking for XP farming
        if (post.author == msg.sender) revert UnauthorizedAction();
        
        post.likedBy[msg.sender] = true;
        post.likes++;
        
        // Update author stats
        userStats[post.author].totalLikes++;
        
        // Award XP to liker and author
        xpEngine.awardXP(msg.sender, XP_REWARD_LIKE);
        xpEngine.awardXP(post.author, XP_REWARD_LIKE);
        
        // Update social scores
        _updateSocialScore(msg.sender);
        _updateSocialScore(post.author);
        
        emit PostLiked(postId, msg.sender);
    }
    
    /**
     * @notice Unlike a post
     * @param postId The ID of the post to unlike
     */
    function unlikePost(uint256 postId) external whenNotPaused nonReentrant {
        Post storage post = posts[postId];
        if (post.id == 0) revert PostNotFound();
        if (!post.likedBy[msg.sender]) revert NotLiked();
        
        post.likedBy[msg.sender] = false;
        post.likes--;
        
        // Update author stats
        userStats[post.author].totalLikes--;
        
        // Update social scores
        _updateSocialScore(post.author);
        
        emit PostUnliked(postId, msg.sender);
    }
    
    /**
     * @notice Share a post
     * @param postId The ID of the post to share
     */
    function sharePost(uint256 postId) external whenNotPaused nonReentrant {
        Post storage post = posts[postId];
        if (post.id == 0) revert PostNotFound();
        if (!post.isActive) revert PostInactive();
        if (post.sharedBy[msg.sender]) revert AlreadyShared();
        
        // Prevent self-sharing for XP farming
        if (post.author == msg.sender) revert UnauthorizedAction();
        
        post.sharedBy[msg.sender] = true;
        post.shares++;
        
        // Update author stats
        userStats[post.author].totalShares++;
        
        // Award XP to sharer and author
        xpEngine.awardXP(msg.sender, XP_REWARD_SHARE);
        xpEngine.awardXP(post.author, XP_REWARD_SHARE);
        
        // Update social scores
        _updateSocialScore(msg.sender);
        _updateSocialScore(post.author);
        
        emit PostShared(postId, msg.sender);
    }
    
    /**
     * @notice Report a post for inappropriate content
     * @param postId The ID of the post to report
     */
    function reportPost(uint256 postId) external whenNotPaused {
        Post storage post = posts[postId];
        if (post.id == 0) revert PostNotFound();
        if (reportedPosts[postId] && _hasUserReported(postId, msg.sender)) revert AlreadyReported();
        
        postReportCount[postId]++;
        reportedPosts[postId] = true;
        
        // Auto-remove post if it reaches the report threshold
        if (postReportCount[postId] >= REPORTS_FOR_REMOVAL) {
            _removePost(postId, "Exceeded report threshold");
        }
        
        emit PostReported(postId, msg.sender);
    }
    
    /**
     * @notice Get user's followers
     * @param user The user address to query
     * @return Array of follower addresses
     */
    function getFollowers(address user) external view returns (address[] memory) {
        return followers[user];
    }
    
    /**
     * @notice Get users that a user is following
     * @param user The user address to query
     * @return Array of following addresses
     */
    function getFollowing(address user) external view returns (address[] memory) {
        return following[user];
    }
    
    /**
     * @notice Get user's posts
     * @param user The user address to query
     * @return Array of post IDs
     */
    function getUserPosts(address user) external view returns (uint256[] memory) {
        return userPosts[user];
    }
    
    /**
     * @notice Get post details
     * @param postId The post ID to query
     * @return author Post author
     * @return content Post content
     * @return timestamp Post timestamp
     * @return likes Number of likes
     * @return shares Number of shares
     * @return isActive Whether post is active
     */
    function getPost(uint256 postId) external view returns (
        address author,
        string memory content,
        uint256 timestamp,
        uint256 likes,
        uint256 shares,
        bool isActive
    ) {
        Post storage post = posts[postId];
        if (post.id == 0) revert PostNotFound();
        
        return (
            post.author,
            post.content,
            post.timestamp,
            post.likes,
            post.shares,
            post.isActive
        );
    }
    
    /**
     * @notice Check if user has liked a post
     * @param postId The post ID to check
     * @param user The user address to check
     * @return Whether the user has liked the post
     */
    function hasUserLikedPost(uint256 postId, address user) external view returns (bool) {
        return posts[postId].likedBy[user];
    }
    
    /**
     * @notice Check if user has shared a post
     * @param postId The post ID to check
     * @param user The user address to check
     * @return Whether the user has shared the post
     */
    function hasUserSharedPost(uint256 postId, address user) external view returns (bool) {
        return posts[postId].sharedBy[user];
    }
    
    /**
     * @notice Get user's social statistics
     * @param user The user address to query
     * @return followersCount Number of followers
     * @return followingCount Number of users following
     * @return postsCount Number of posts created
     * @return totalLikes Total likes received
     * @return totalShares Total shares received
     * @return socialScore Calculated social influence score
     */
    function getUserSocialStats(address user) external view returns (
        uint256 followersCount,
        uint256 followingCount,
        uint256 postsCount,
        uint256 totalLikes,
        uint256 totalShares,
        uint256 socialScore
    ) {
        UserSocialStats storage stats = userStats[user];
        return (
            stats.followersCount,
            stats.followingCount,
            stats.postsCount,
            stats.totalLikes,
            stats.totalShares,
            stats.socialScore
        );
    }
    
    /**
     * @notice Get activity feed for a user (posts from users they follow)
     * @param user The user address to get feed for
     * @param limit Maximum number of posts to return
     * @return Array of post IDs in reverse chronological order
     */
    function getActivityFeed(address user, uint256 limit) external view returns (uint256[] memory) {
        address[] memory userFollowing = following[user];
        uint256[] memory feedPosts = new uint256[](limit);
        uint256 count = 0;
        
        // Get recent posts from followed users
        for (uint256 i = 0; i < userFollowing.length && count < limit; i++) {
            address followedUser = userFollowing[i];
            uint256[] memory followedUserPosts = userPosts[followedUser];
            
            // Add recent posts (reverse order)
            for (uint256 j = followedUserPosts.length; j > 0 && count < limit; j--) {
                uint256 postId = followedUserPosts[j - 1];
                if (posts[postId].isActive) {
                    feedPosts[count] = postId;
                    count++;
                }
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = feedPosts[i];
        }
        
        return result;
    }
    
    /**
     * @notice Remove a post (admin/moderator only)
     * @param postId The ID of the post to remove
     * @param reason The reason for removal
     */
    function removePost(uint256 postId, string memory reason) external onlyRole(MODERATOR_ROLE) {
        _removePost(postId, reason);
    }
    
    /**
     * @notice Update social score calculation for a user
     * @param user The user to update score for
     */
    function _updateSocialScore(address user) internal {
        UserSocialStats storage stats = userStats[user];
        
        // Social score algorithm: followers + (likes * 2) + (shares * 3) + (posts / 2)
        uint256 newScore = stats.followersCount + 
                          (stats.totalLikes * 2) + 
                          (stats.totalShares * 3) + 
                          (stats.postsCount / 2);
        
        if (newScore != stats.socialScore) {
            stats.socialScore = newScore;
            emit SocialScoreUpdated(user, newScore);
        }
    }
    
    /**
     * @notice Remove a post from the system
     * @param postId The ID of the post to remove
     * @param reason The reason for removal
     */
    function _removePost(uint256 postId, string memory reason) internal {
        Post storage post = posts[postId];
        if (post.id == 0) revert PostNotFound();
        
        post.isActive = false;
        
        // Update author stats
        userStats[post.author].postsCount--;
        _updateSocialScore(post.author);
        
        emit PostRemoved(postId, reason);
    }
    
    /**
     * @notice Remove an address from an array
     * @param array The array to modify
     * @param addressToRemove The address to remove
     */
    function _removeFromArray(address[] storage array, address addressToRemove) internal {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == addressToRemove) {
                array[i] = array[array.length - 1];
                array.pop();
                break;
            }
        }
    }
    
    /**
     * @notice Check if a user has already reported a post
     * @return Whether the user has reported the post
     */
    function _hasUserReported(uint256 /* postId */, address /* user */) internal pure returns (bool) {
        // Simple implementation - in production, you'd track this properly
        // For now, we'll allow re-reporting (this is a placeholder)
        return false;
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
}