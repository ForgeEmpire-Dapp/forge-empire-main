const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// Helper function to fast-forward time
const fastForward = async (seconds) => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
};

describe("SocialGraph", function () {
  let socialGraph;
  let xpEngine;
  let owner;
  let user1;
  let user2;
  let user3;
  let moderator;

  beforeEach(async function () {
    [owner, user1, user2, user3, moderator] = await ethers.getSigners();

    // Deploy XPEngine mock
    const XPEngine = await ethers.getContractFactory("MockXPEngine");
    xpEngine = await XPEngine.deploy();
    await xpEngine.waitForDeployment();

    // Deploy SocialGraph
    const SocialGraph = await ethers.getContractFactory("SocialGraph");
    socialGraph = await upgrades.deployProxy(SocialGraph, [
      await xpEngine.getAddress()
    ], { initializer: 'initialize' });
    await socialGraph.waitForDeployment();

    // Grant moderator role
    const MODERATOR_ROLE = await socialGraph.MODERATOR_ROLE();
    await socialGraph.grantRole(MODERATOR_ROLE, moderator.address);
  });

  describe("Deployment", function () {
    it("Should set the correct XP engine address", async function () {
      expect(await socialGraph.xpEngine()).to.equal(await xpEngine.getAddress());
    });

    it("Should grant proper roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await socialGraph.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await socialGraph.ADMIN_ROLE();
      const MODERATOR_ROLE = await socialGraph.MODERATOR_ROLE();

      expect(await socialGraph.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await socialGraph.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await socialGraph.hasRole(MODERATOR_ROLE, owner.address)).to.be.true;
    });

    it("Should initialize with nextPostId as 1", async function () {
      expect(await socialGraph.nextPostId()).to.equal(1);
    });
  });

  describe("Follow/Unfollow Functionality", function () {
    it("Should allow a user to follow another user", async function () {
      await expect(socialGraph.connect(user1).followUser(user2.address))
        .to.emit(socialGraph, "UserFollowed")
        .withArgs(user1.address, user2.address);

      expect(await socialGraph.isFollowing(user1.address, user2.address)).to.be.true;

      const followers = await socialGraph.getFollowers(user2.address);
      expect(followers).to.deep.equal([user1.address]);

      const following = await socialGraph.getFollowing(user1.address);
      expect(following).to.deep.equal([user2.address]);

      // Check stats update
      const user1Stats = await socialGraph.getUserSocialStats(user1.address);
      const user2Stats = await socialGraph.getUserSocialStats(user2.address);
      expect(user1Stats.followingCount).to.equal(1);
      expect(user2Stats.followersCount).to.equal(1);

      // Check XP award
      expect(await xpEngine.getXP(user1.address)).to.equal(5); // XP_REWARD_FOLLOW
    });

    it("Should allow a user to unfollow another user", async function () {
      // First follow
      await socialGraph.connect(user1).followUser(user2.address);

      // Fast-forward time to bypass unfollow cooldown
      await fastForward(24 * 60 * 60); // 24 hours

      // Then unfollow
      await expect(socialGraph.connect(user1).unfollowUser(user2.address))
        .to.emit(socialGraph, "UserUnfollowed")
        .withArgs(user1.address, user2.address);

      expect(await socialGraph.isFollowing(user1.address, user2.address)).to.be.false;

      const followers = await socialGraph.getFollowers(user2.address);
      expect(followers.length).to.equal(0);

      const following = await socialGraph.getFollowing(user1.address);
      expect(following.length).to.equal(0);

      // Check stats update
      const user1Stats = await socialGraph.getUserSocialStats(user1.address);
      const user2Stats = await socialGraph.getUserSocialStats(user2.address);
      expect(user1Stats.followingCount).to.equal(0);
      expect(user2Stats.followersCount).to.equal(0);
    });

    it("Should prevent following oneself", async function () {
      await expect(socialGraph.connect(user1).followUser(user1.address))
        .to.be.revertedWithCustomError(socialGraph, "CannotFollowSelf");
    });

    it("Should prevent following the same user twice", async function () {
      await socialGraph.connect(user1).followUser(user2.address);
      
      await expect(socialGraph.connect(user1).followUser(user2.address))
        .to.be.revertedWithCustomError(socialGraph, "AlreadyFollowing");
    });

    it("Should prevent unfollowing a user not followed", async function () {
      await expect(socialGraph.connect(user1).unfollowUser(user2.address))
        .to.be.revertedWithCustomError(socialGraph, "NotFollowing");
    });

    it("Should handle multiple followers correctly", async function () {
      await socialGraph.connect(user1).followUser(user3.address);
      await fastForward(3601); // Fast-forward to bypass follow cooldown
      await socialGraph.connect(user2).followUser(user3.address);

      const followers = await socialGraph.getFollowers(user3.address);
      expect(followers).to.have.lengthOf(2);
      expect(followers).to.include(user1.address);
      expect(followers).to.include(user2.address);

      const user3Stats = await socialGraph.getUserSocialStats(user3.address);
      expect(user3Stats.followersCount).to.equal(2);
    });
  });

  describe("Post Creation and Management", function () {
    it("Should allow creating a post", async function () {
      const content = "Hello, Forge Empire!";
      
      await expect(socialGraph.connect(user1).createPost(content))
        .to.emit(socialGraph, "PostCreated")
        .withArgs(1, user1.address, content);

      const post = await socialGraph.getPost(1);
      expect(post.author).to.equal(user1.address);
      expect(post.content).to.equal(content);
      expect(post.likes).to.equal(0);
      expect(post.shares).to.equal(0);
      expect(post.isActive).to.be.true;

      // Check user stats
      const userStats = await socialGraph.getUserSocialStats(user1.address);
      expect(userStats.postsCount).to.equal(1);

      // Check XP award
      expect(await xpEngine.getXP(user1.address)).to.equal(10); // XP_REWARD_POST

      // Check user posts
      const userPosts = await socialGraph.getUserPosts(user1.address);
      expect(userPosts).to.deep.equal([ethers.getBigInt(1)]);
    });

    it("Should prevent creating empty posts", async function () {
      await expect(socialGraph.connect(user1).createPost(""))
        .to.be.revertedWithCustomError(socialGraph, "EmptyContent");
    });

    it("Should prevent creating posts that are too long", async function () {
      const longContent = "a".repeat(281); // MAX_CONTENT_LENGTH is 280
      
      await expect(socialGraph.connect(user1).createPost(longContent))
        .to.be.revertedWithCustomError(socialGraph, "ContentTooLong");
    });

    it("Should increment post IDs correctly", async function () {
      await socialGraph.connect(user1).createPost("First post");
      await fastForward(601); // Fast-forward to bypass post cooldown
      await socialGraph.connect(user2).createPost("Second post");

      expect(await socialGraph.nextPostId()).to.equal(3);

      const post1 = await socialGraph.getPost(1);
      const post2 = await socialGraph.getPost(2);
      
      expect(post1.author).to.equal(user1.address);
      expect(post2.author).to.equal(user2.address);
    });
  });

  describe("Post Interactions (Like/Unlike)", function () {
    beforeEach(async function () {
      await socialGraph.connect(user1).createPost("Test post for interactions");
    });

    it("Should allow liking a post", async function () {
      await expect(socialGraph.connect(user2).likePost(1))
        .to.emit(socialGraph, "PostLiked")
        .withArgs(1, user2.address);

      const post = await socialGraph.getPost(1);
      expect(post.likes).to.equal(1);

      expect(await socialGraph.hasUserLikedPost(1, user2.address)).to.be.true;

      // Check stats update
      const user1Stats = await socialGraph.getUserSocialStats(user1.address);
      expect(user1Stats.totalLikes).to.equal(1);

      // Check XP awards (liker and author both get XP)
      expect(await xpEngine.getXP(user2.address)).to.equal(1); // XP_REWARD_LIKE
      expect(await xpEngine.getXP(user1.address)).to.equal(11); // XP_REWARD_POST + XP_REWARD_LIKE
    });

    it("Should allow unliking a post", async function () {
      await socialGraph.connect(user2).likePost(1);
      
      await expect(socialGraph.connect(user2).unlikePost(1))
        .to.emit(socialGraph, "PostUnliked")
        .withArgs(1, user2.address);

      const post = await socialGraph.getPost(1);
      expect(post.likes).to.equal(0);

      expect(await socialGraph.hasUserLikedPost(1, user2.address)).to.be.false;

      // Check stats update
      const user1Stats = await socialGraph.getUserSocialStats(user1.address);
      expect(user1Stats.totalLikes).to.equal(0);
    });

    it("Should prevent liking the same post twice", async function () {
      await socialGraph.connect(user2).likePost(1);
      
      await expect(socialGraph.connect(user2).likePost(1))
        .to.be.revertedWithCustomError(socialGraph, "AlreadyLiked");
    });

    it("Should prevent unliking a post not liked", async function () {
      await expect(socialGraph.connect(user2).unlikePost(1))
        .to.be.revertedWithCustomError(socialGraph, "NotLiked");
    });

    it("Should prevent interacting with non-existent posts", async function () {
      await expect(socialGraph.connect(user2).likePost(999))
        .to.be.revertedWithCustomError(socialGraph, "PostNotFound");
    });

    it("Should handle multiple likes from different users", async function () {
      await socialGraph.connect(user2).likePost(1);
      await socialGraph.connect(user3).likePost(1);

      const post = await socialGraph.getPost(1);
      expect(post.likes).to.equal(2);

      expect(await socialGraph.hasUserLikedPost(1, user2.address)).to.be.true;
      expect(await socialGraph.hasUserLikedPost(1, user3.address)).to.be.true;
    });
  });

  describe("Post Sharing", function () {
    beforeEach(async function () {
      await socialGraph.connect(user1).createPost("Test post for sharing");
    });

    it("Should allow sharing a post", async function () {
      await expect(socialGraph.connect(user2).sharePost(1))
        .to.emit(socialGraph, "PostShared")
        .withArgs(1, user2.address);

      const post = await socialGraph.getPost(1);
      expect(post.shares).to.equal(1);

      expect(await socialGraph.hasUserSharedPost(1, user2.address)).to.be.true;

      // Check stats update
      const user1Stats = await socialGraph.getUserSocialStats(user1.address);
      expect(user1Stats.totalShares).to.equal(1);

      // Check XP awards (sharer and author both get XP)
      expect(await xpEngine.getXP(user2.address)).to.equal(3); // XP_REWARD_SHARE
      expect(await xpEngine.getXP(user1.address)).to.equal(13); // XP_REWARD_POST + XP_REWARD_SHARE
    });

    it("Should prevent sharing the same post twice", async function () {
      await socialGraph.connect(user2).sharePost(1);
      
      await expect(socialGraph.connect(user2).sharePost(1))
        .to.be.revertedWithCustomError(socialGraph, "AlreadyShared");
    });

    it("Should prevent sharing non-existent posts", async function () {
      await expect(socialGraph.connect(user2).sharePost(999))
        .to.be.revertedWithCustomError(socialGraph, "PostNotFound");
    });
  });

  describe("Social Score Calculation", function () {
    it("Should calculate social score correctly", async function () {
      // Create some social activity
      await socialGraph.connect(user1).createPost("Post 1");
      await fastForward(601);
      await socialGraph.connect(user1).createPost("Post 2");
      await fastForward(3601);
      
      await socialGraph.connect(user2).followUser(user1.address);
      await fastForward(3601);
      await socialGraph.connect(user3).followUser(user1.address);
      
      await socialGraph.connect(user2).likePost(1);
      await socialGraph.connect(user3).likePost(1);
      await socialGraph.connect(user2).likePost(2);
      
      await socialGraph.connect(user2).sharePost(1);

      const stats = await socialGraph.getUserSocialStats(user1.address);
      
      // Social score = followers + (likes * 2) + (shares * 3) + (posts / 2)
      // Expected: 2 + (3 * 2) + (1 * 3) + (2 / 2) = 2 + 6 + 3 + 1 = 12
      expect(stats.socialScore).to.equal(12);
      expect(stats.followersCount).to.equal(2);
      expect(stats.postsCount).to.equal(2);
      expect(stats.totalLikes).to.equal(3);
      expect(stats.totalShares).to.equal(1);
    });

    it("Should emit SocialScoreUpdated event when score changes", async function () {
      await socialGraph.connect(user2).followUser(user1.address);
      
      // The followUser function should trigger a score update for user1
      const events = await socialGraph.queryFilter(socialGraph.filters.SocialScoreUpdated());
      const user1ScoreEvent = events.find(e => e.args[0] === user1.address);
      
      expect(user1ScoreEvent).to.not.be.undefined;
      expect(user1ScoreEvent.args[1]).to.equal(1); // Score should be 1 (1 follower)
    });
  });

  describe("Activity Feed", function () {
    beforeEach(async function () {
      // Set up social connections
      await socialGraph.connect(user1).followUser(user2.address);
      await fastForward(3601);
      await socialGraph.connect(user1).followUser(user3.address);
      await fastForward(601);

      // Create posts from followed users
      await socialGraph.connect(user2).createPost("Post from user2");
      await fastForward(601);
      await socialGraph.connect(user3).createPost("Post from user3");
      await fastForward(601);
      await socialGraph.connect(user3).createPost("Another post from user3");
    });

    it("Should return activity feed for a user", async function () {
      const feed = await socialGraph.getActivityFeed(user1.address, 10);
      
      // Should include posts from followed users
      expect(feed.length).to.be.greaterThan(0);
      
      // Verify posts are from followed users
      for (let i = 0; i < feed.length; i++) {
        const postId = feed[i];
        if (postId > 0) { // Filter out empty slots
          const post = await socialGraph.getPost(postId);
          expect([user2.address, user3.address]).to.include(post.author);
        }
      }
    });

    it("Should limit activity feed results", async function () {
      const feed = await socialGraph.getActivityFeed(user1.address, 2);
      
      // Count non-empty posts
      const nonEmptyPosts = feed.filter(postId => postId > 0);
      expect(nonEmptyPosts.length).to.be.at.most(2);
    });

    it("Should return empty feed for user with no followings", async function () {
      const feed = await socialGraph.getActivityFeed(user2.address, 10);
      const nonEmptyPosts = feed.filter(postId => postId > 0);
      expect(nonEmptyPosts.length).to.equal(0);
    });
  });

  describe("Post Reporting and Moderation", function () {
    beforeEach(async function () {
      await socialGraph.connect(user1).createPost("Test post for reporting");
    });

    it("Should allow reporting a post", async function () {
      await expect(socialGraph.connect(user2).reportPost(1))
        .to.emit(socialGraph, "PostReported")
        .withArgs(1, user2.address);

      expect(await socialGraph.reportedPosts(1)).to.be.true;
      expect(await socialGraph.postReportCount(1)).to.equal(1);
    });

    it("Should auto-remove post when report threshold is reached", async function () {
      // Report the post 5 times (REPORTS_FOR_REMOVAL = 5)
      await socialGraph.connect(user2).reportPost(1);
      await socialGraph.connect(user3).reportPost(1);
      
      // Create more users to reach threshold
      const [, , , , user4, user5, user6] = await ethers.getSigners();
      await socialGraph.connect(user4).reportPost(1);
      await socialGraph.connect(user5).reportPost(1);
      
      await expect(socialGraph.connect(user6).reportPost(1))
        .to.emit(socialGraph, "PostRemoved")
        .withArgs(1, "Exceeded report threshold");

      const post = await socialGraph.getPost(1);
      expect(post.isActive).to.be.false;
    });

    it("Should allow moderator to remove posts", async function () {
      await expect(socialGraph.connect(moderator).removePost(1, "Inappropriate content"))
        .to.emit(socialGraph, "PostRemoved")
        .withArgs(1, "Inappropriate content");

      const post = await socialGraph.getPost(1);
      expect(post.isActive).to.be.false;
    });

    it("Should prevent non-moderator from removing posts", async function () {
      await expect(socialGraph.connect(user2).removePost(1, "Test removal"))
        .to.be.reverted; // AccessControl revert
    });

    it("Should prevent interactions with inactive posts", async function () {
      await socialGraph.connect(moderator).removePost(1, "Test removal");

      await expect(socialGraph.connect(user2).likePost(1))
        .to.be.revertedWithCustomError(socialGraph, "PostInactive");

      await expect(socialGraph.connect(user2).sharePost(1))
        .to.be.revertedWithCustomError(socialGraph, "PostInactive");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await socialGraph.connect(user1).followUser(user2.address);
      await fastForward(601);
      await socialGraph.connect(user1).createPost("Test post");
    });

    it("Should return correct followers list", async function () {
      const followers = await socialGraph.getFollowers(user2.address);
      expect(followers).to.deep.equal([user1.address]);
    });

    it("Should return correct following list", async function () {
      const following = await socialGraph.getFollowing(user1.address);
      expect(following).to.deep.equal([user2.address]);
    });

    it("Should return correct user posts", async function () {
      const userPosts = await socialGraph.getUserPosts(user1.address);
      expect(userPosts).to.deep.equal([ethers.getBigInt(1)]);
    });

    it("Should return correct post details", async function () {
      const post = await socialGraph.getPost(1);
      expect(post.author).to.equal(user1.address);
      expect(post.content).to.equal("Test post");
      expect(post.isActive).to.be.true;
    });

    it("Should return correct social stats", async function () {
      await socialGraph.connect(user2).likePost(1);
      
      const stats = await socialGraph.getUserSocialStats(user1.address);
      expect(stats.followingCount).to.equal(1);
      expect(stats.postsCount).to.equal(1);
      expect(stats.totalLikes).to.equal(1);
    });

    it("Should revert when getting non-existent post", async function () {
      await expect(socialGraph.getPost(999))
        .to.be.revertedWithCustomError(socialGraph, "PostNotFound");
    });
  });

  describe("Access Control and Security", function () {
    it("Should allow admin to pause and unpause", async function () {
      await socialGraph.pause();
      expect(await socialGraph.paused()).to.be.true;

      await expect(socialGraph.connect(user1).createPost("Test"))
        .to.be.revertedWithCustomError(socialGraph, "EnforcedPause");

      await socialGraph.unpause();
      expect(await socialGraph.paused()).to.be.false;

      await expect(socialGraph.connect(user1).createPost("Test"))
        .to.emit(socialGraph, "PostCreated");
    });

    it("Should prevent non-admin from pausing", async function () {
      await expect(socialGraph.connect(user1).pause())
        .to.be.reverted;
    });

    it("Should prevent operations when paused", async function () {
      await socialGraph.pause();

      await expect(socialGraph.connect(user1).followUser(user2.address))
        .to.be.revertedWithCustomError(socialGraph, "EnforcedPause");

      await expect(socialGraph.connect(user1).createPost("Test"))
        .to.be.revertedWithCustomError(socialGraph, "EnforcedPause");
    });
  });

  describe("Integration with XPEngine", function () {
    it("Should award correct XP for different actions", async function () {
      // Follow action
      await socialGraph.connect(user1).followUser(user2.address);
      expect(await xpEngine.getXP(user1.address)).to.equal(5);

      // Post creation
      await fastForward(601);
      await socialGraph.connect(user1).createPost("Test post");
      expect(await xpEngine.getXP(user1.address)).to.equal(15); // 5 + 10

      // Like action (both liker and author get XP)
      await socialGraph.connect(user2).likePost(1);
      expect(await xpEngine.getXP(user2.address)).to.equal(1);
      expect(await xpEngine.getXP(user1.address)).to.equal(16); // 15 + 1

      // Share action (both sharer and author get XP)
      await socialGraph.connect(user2).sharePost(1);
      expect(await xpEngine.getXP(user2.address)).to.equal(4); // 1 + 3
      expect(await xpEngine.getXP(user1.address)).to.equal(19); // 16 + 3
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle empty arrays correctly", async function () {
      const followers = await socialGraph.getFollowers(user1.address);
      const following = await socialGraph.getFollowing(user1.address);
      const userPosts = await socialGraph.getUserPosts(user1.address);

      expect(followers.length).to.equal(0);
      expect(following.length).to.equal(0);
      expect(userPosts.length).to.equal(0);
    });

    it("Should maintain data consistency after unfollow", async function () {
      // Create multiple connections
      await socialGraph.connect(user1).followUser(user2.address);
      await fastForward(3601);
      await socialGraph.connect(user1).followUser(user3.address);
      await fastForward(3601);
      await socialGraph.connect(user2).followUser(user3.address);

      // Unfollow and check consistency
      await fastForward(24 * 60 * 60);
      await socialGraph.connect(user1).unfollowUser(user2.address);

      const user1Following = await socialGraph.getFollowing(user1.address);
      const user2Followers = await socialGraph.getFollowers(user2.address);
      const user3Followers = await socialGraph.getFollowers(user3.address);

      expect(user1Following).to.deep.equal([user3.address]);
      expect(user2Followers.length).to.equal(0);
      expect(user3Followers).to.have.lengthOf(2);
    });
  });
});