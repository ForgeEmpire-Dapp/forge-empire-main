const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// Helper function to get a future timestamp
const getFutureTimestamp = async (seconds) => {
    const block = await ethers.provider.getBlock('latest');
    return block.timestamp + seconds;
};

describe("SeasonalEvents", function () {
  let seasonalEvents;
  let xpEngine;
  let mockBadgeMinter;
  let mockLeaderboards;
  let owner;
  let user1;
  let user2;
  let user3;
  let user4;
  let eventManager;

  // Constants matching the contract
  const EventType = {
    XP_MULTIPLIER: 0,
    QUEST_MARATHON: 1,
    TRADING_CONTEST: 2,
    COMMUNITY_GOAL: 3,
    BADGE_HUNT: 4,
    SOCIAL_CAMPAIGN: 5,
    GOVERNANCE_DRIVE: 6
  };

  const EventStatus = {
    SCHEDULED: 0,
    ACTIVE: 1,
    ENDED: 2,
    COMPLETED: 3
  };

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, eventManager] = await ethers.getSigners();

    // Deploy XPEngine mock
    const XPEngine = await ethers.getContractFactory("MockXPEngine");
    xpEngine = await XPEngine.deploy();
    await xpEngine.waitForDeployment();

    // Deploy BadgeMinter mock
    const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
    mockBadgeMinter = await MockBadgeMinter.deploy();
    await mockBadgeMinter.waitForDeployment();

    // Deploy Mock Leaderboards
    const MockLeaderboards = await ethers.getContractFactory("MockLeaderboards");
    mockLeaderboards = await MockLeaderboards.deploy();
    await mockLeaderboards.waitForDeployment();

    // Deploy SeasonalEvents
    const SeasonalEvents = await ethers.getContractFactory("SeasonalEvents");
    seasonalEvents = await upgrades.deployProxy(SeasonalEvents, [
      await xpEngine.getAddress(),
      await mockBadgeMinter.getAddress(),
      await mockLeaderboards.getAddress()
    ], { initializer: 'initialize' });
    await seasonalEvents.waitForDeployment();

    // Grant necessary roles
    const EVENT_MANAGER_ROLE = await seasonalEvents.EVENT_MANAGER_ROLE();
    const MINTER_ROLE = await mockBadgeMinter.MINTER_ROLE();
    
    await seasonalEvents.grantRole(EVENT_MANAGER_ROLE, eventManager.address);
    await mockBadgeMinter.grantRole(MINTER_ROLE, await seasonalEvents.getAddress());

    // Give users initial XP
    await xpEngine.awardXP(user1.address, 1000);
    await xpEngine.awardXP(user2.address, 1500);
    await xpEngine.awardXP(user3.address, 800);
    await xpEngine.awardXP(user4.address, 2000);
  });

  describe("Deployment", function () {
    it("Should set the correct addresses", async function () {
      expect(await seasonalEvents.xpEngine()).to.equal(await xpEngine.getAddress());
      expect(await seasonalEvents.badgeMinter()).to.equal(await mockBadgeMinter.getAddress());
      expect(await seasonalEvents.leaderboards()).to.equal(await mockLeaderboards.getAddress());
    });

    it("Should grant proper roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await seasonalEvents.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await seasonalEvents.ADMIN_ROLE();
      const EVENT_MANAGER_ROLE = await seasonalEvents.EVENT_MANAGER_ROLE();

      expect(await seasonalEvents.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await seasonalEvents.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await seasonalEvents.hasRole(EVENT_MANAGER_ROLE, owner.address)).to.be.true;
    });

    it("Should initialize with correct starting values", async function () {
      expect(await seasonalEvents.nextEventId()).to.equal(1);
      
      const activeEvents = await seasonalEvents.getActiveEvents();
      expect(activeEvents).to.have.lengthOf(0);

      const [totalEvents, activeEventsCount, totalParticipants, totalRewards] = await seasonalEvents.getGlobalStats();
      expect(totalEvents).to.equal(0);
      expect(activeEventsCount).to.equal(0);
      expect(totalParticipants).to.equal(0);
      expect(totalRewards).to.equal(0);
    });
  });

  describe("Event Creation", function () {
    it("Should allow event manager to create events", async function () {
      const startTime = await getFutureTimestamp(3600); // 1 hour from now
      const endTime = startTime + 7 * 24 * 3600; // 7 days duration
      
      await expect(seasonalEvents.connect(eventManager).createEvent(
        "Test Event",
        "A test seasonal event",
        EventType.XP_MULTIPLIER,
        startTime,
        endTime,
        1000, // participant limit
        15000, // 150% multiplier
        0, // no target metric
        ["ipfs://badge1"],
        [500], // 500 XP reward
        false, // no registration required
        false, // not repeating
        0 // no repeat interval
      )).to.emit(seasonalEvents, "EventCreated")
        .withArgs(1, "Test Event", EventType.XP_MULTIPLIER, startTime, endTime);

      const [totalEvents] = await seasonalEvents.getGlobalStats();
      expect(totalEvents).to.equal(1);
    });

    it("Should prevent non-event managers from creating events", async function () {
        const startTime = await getFutureTimestamp(3600);
        const endTime = startTime + 7 * 24 * 3600;

      await expect(seasonalEvents.connect(user1).createEvent(
        "Test Event",
        "Description",
        EventType.XP_MULTIPLIER,
        startTime,
        endTime,
        1000,
        15000,
        0,
        ["ipfs://badge1"],
        [500],
        false,
        false,
        0
      )).to.be.reverted;
    });

    it("Should validate event parameters", async function () {
        const currentTime = await getFutureTimestamp(0);
      
      // Invalid start time (in the past)
      await expect(seasonalEvents.connect(eventManager).createEvent(
        "Test Event", "Description", EventType.XP_MULTIPLIER,
        currentTime - 3600, currentTime + 7 * 24 * 3600,
        1000, 15000, 0, ["ipfs://badge1"], [500], false, false, 0
      )).to.be.revertedWithCustomError(seasonalEvents, "InvalidEventDuration");

      // Invalid multiplier (too low)
      const startTime = currentTime + 3600;
      const endTime = startTime + 7 * 24 * 3600;
      await expect(seasonalEvents.connect(eventManager).createEvent(
        "Test Event", "Description", EventType.XP_MULTIPLIER,
        startTime, endTime, 1000, 5000, 0, // multiplier too low (50%)
        ["ipfs://badge1"], [500], false, false, 0
      )).to.be.revertedWithCustomError(seasonalEvents, "InvalidMultiplier");

      // Mismatched reward arrays
      await expect(seasonalEvents.connect(eventManager).createEvent(
        "Test Event", "Description", EventType.XP_MULTIPLIER,
        startTime, endTime, 1000, 15000, 0,
        ["ipfs://badge1", "ipfs://badge2"], [500], // mismatched arrays
        false, false, 0
      )).to.be.revertedWithCustomError(seasonalEvents, "InvalidRewardConfiguration");
    });

    it("Should create community goal events correctly", async function () {
        const startTime = await getFutureTimestamp(3600);
        const endTime = startTime + 7 * 24 * 3600;

      await seasonalEvents.connect(eventManager).createEvent(
        "Community Challenge",
        "Reach 100,000 XP collectively",
        EventType.COMMUNITY_GOAL,
        startTime,
        endTime,
        0, // unlimited participants
        10000, // 100% multiplier (not used for community goals)
        100000, // target metric: 100,000 XP
        ["ipfs://community-badge"],
        [1000], // 1000 XP reward
        false,
        false,
        0
      );

      const [name, description, eventType, status, , , , currentProgress] = await seasonalEvents.getEventInfo(1);
      expect(name).to.equal("Community Challenge");
      expect(eventType).to.equal(EventType.COMMUNITY_GOAL);
      expect(currentProgress).to.equal(0);
    });
  });

  describe("Event Registration", function () {
    beforeEach(async function () {
        const startTime = await getFutureTimestamp(3600);
        const endTime = startTime + 7 * 24 * 3600;

      // Create event requiring registration
      await seasonalEvents.connect(eventManager).createEvent(
        "Registration Event",
        "Event requiring registration",
        EventType.QUEST_MARATHON,
        startTime,
        endTime,
        100, // participant limit
        10000,
        0,
        ["ipfs://badge1"],
        [500],
        true, // requires registration
        false,
        0
      );
    });

    it("Should allow users to register for events", async function () {
      await expect(seasonalEvents.connect(user1).registerForEvent(1))
        .to.emit(seasonalEvents, "UserRegistered")
        .withArgs(1, user1.address);

      const [isParticipant, progress, rewardsClaimed] = await seasonalEvents.getUserEventProgress(1, user1.address);
      expect(isParticipant).to.be.true;
      expect(progress).to.equal(0);
      expect(rewardsClaimed).to.be.false;

      const [eventsParticipated] = await seasonalEvents.getUserStats(user1.address);
      expect(eventsParticipated).to.equal(1);
    });

    it("Should prevent duplicate registration", async function () {
      await seasonalEvents.connect(user1).registerForEvent(1);
      
      await expect(seasonalEvents.connect(user1).registerForEvent(1))
        .to.be.revertedWithCustomError(seasonalEvents, "AlreadyRegistered");
    });

    it("Should enforce participant limits", async function () {
      // Create event with limit of 2 participants
      const startTime = await getFutureTimestamp(3600);
      const endTime = startTime + 7 * 24 * 3600;

      await seasonalEvents.connect(eventManager).createEvent(
        "Limited Event", "Description", EventType.XP_MULTIPLIER,
        startTime, endTime, 2, 15000, 0,
        ["ipfs://badge1"], [500], true, false, 0
      );

      await seasonalEvents.connect(user1).registerForEvent(2);
      await seasonalEvents.connect(user2).registerForEvent(2);
      
      await expect(seasonalEvents.connect(user3).registerForEvent(2))
        .to.be.revertedWithCustomError(seasonalEvents, "EventFull");
    });
  });

  describe("Event Lifecycle", function () {
    let eventId;

    beforeEach(async function () {
        const startTime = await getFutureTimestamp(100); // Shortly in future
        const endTime = startTime + 7 * 24 * 3600;

      await seasonalEvents.connect(eventManager).createEvent(
        "Lifecycle Test",
        "Event for testing lifecycle",
        EventType.TRADING_CONTEST,
        startTime,
        endTime,
        1000,
        10000,
        50000, // target metric
        ["ipfs://badge1", "ipfs://badge2"],
        [1000, 500], // XP rewards
        false, // no registration required
        false,
        0
      );

      eventId = 1;
    });

    it("Should start events correctly", async function () {
      // Fast forward time to start time
      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");

      await expect(seasonalEvents.connect(eventManager).startEvent(eventId))
        .to.emit(seasonalEvents, "EventStarted")
        .withArgs(eventId, "Lifecycle Test");

      const [, , , status] = await seasonalEvents.getEventInfo(eventId);
      expect(status).to.equal(EventStatus.ACTIVE);

      const activeEvents = await seasonalEvents.getActiveEvents();
      expect(activeEvents).to.include(BigInt(eventId));
    });

    it("Should update progress during active events", async function () {
      // Start event
      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");
      await seasonalEvents.connect(eventManager).startEvent(eventId);

      // Update progress
      await expect(seasonalEvents.connect(eventManager).updateProgress(eventId, user1.address, 1000))
        .to.emit(seasonalEvents, "ProgressUpdated")
        .withArgs(eventId, user1.address, 1000);

      const [isParticipant, progress] = await seasonalEvents.getUserEventProgress(eventId, user1.address);
      expect(isParticipant).to.be.true;
      expect(progress).to.equal(1000);
    });

    it("Should end events and allow reward claiming", async function () {
      // Start event and add progress
      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");
      await seasonalEvents.connect(eventManager).startEvent(eventId);
      await seasonalEvents.connect(eventManager).updateProgress(eventId, user1.address, 40000); // Meets tier 1
      await seasonalEvents.connect(eventManager).updateProgress(eventId, user2.address, 15000); // No tier

      // End event
      await expect(seasonalEvents.connect(eventManager).endEvent(eventId))
        .to.emit(seasonalEvents, "EventEnded")
        .withArgs(eventId, "Lifecycle Test", 2);

      const [, , , status] = await seasonalEvents.getEventInfo(eventId);
      expect(status).to.equal(EventStatus.ENDED);

      // Claim rewards for user 1
      const initialXP = await xpEngine.getXP(user1.address);
      await expect(seasonalEvents.connect(user1).claimRewards(eventId))
        .to.emit(seasonalEvents, "RewardDistributed")
        .withArgs(eventId, user1.address, 1000, 1); // User meets tier 1, gets 1 badge

      const finalXP = await xpEngine.getXP(user1.address);
      expect(finalXP).to.be.greaterThan(initialXP);

      // Check badge was minted
      expect(await mockBadgeMinter.balanceOf(user1.address)).to.equal(1);
    });
  });

  describe("Community Goals", function () {
    let communityEventId;

    beforeEach(async function () {
        const startTime = await getFutureTimestamp(100);
        const endTime = startTime + 7 * 24 * 3600;

      await seasonalEvents.connect(eventManager).createEvent(
        "Community Goal",
        "Collective XP challenge",
        EventType.COMMUNITY_GOAL,
        startTime,
        endTime,
        0, // unlimited
        10000,
        10000, // target: 10,000 collective XP
        ["ipfs://community-badge"],
        [2000], // 2000 XP reward for everyone
        false,
        false,
        0
      );

      communityEventId = 1;

      // Start the event
      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");
      await seasonalEvents.connect(eventManager).startEvent(communityEventId);
    });

    it("Should track community progress correctly", async function () {
      await seasonalEvents.connect(eventManager).updateProgress(communityEventId, user1.address, 3000);
      await seasonalEvents.connect(eventManager).updateProgress(communityEventId, user2.address, 4000);
      await seasonalEvents.connect(eventManager).updateProgress(communityEventId, user3.address, 2000);

      const [, , , , , , , currentProgress] = await seasonalEvents.getEventInfo(communityEventId);
      expect(currentProgress).to.equal(9000);
    });

    it("Should emit goal reached event when target is met", async function () {
      await seasonalEvents.connect(eventManager).updateProgress(communityEventId, user1.address, 5000);
      await seasonalEvents.connect(eventManager).updateProgress(communityEventId, user2.address, 6000);

      await expect(seasonalEvents.connect(eventManager).endEvent(communityEventId))
        .to.emit(seasonalEvents, "CommunityGoalReached")
        .withArgs(communityEventId, 11000);
    });

    it("Should distribute equal rewards to all participants when goal is reached", async function () {
      // Add progress from multiple users
      await seasonalEvents.connect(eventManager).updateProgress(communityEventId, user1.address, 5000);
      await seasonalEvents.connect(eventManager).updateProgress(communityEventId, user2.address, 6000);
      
      // End event
      await seasonalEvents.connect(eventManager).endEvent(communityEventId);

      // Both users should get equal rewards
      const initialXP1 = await xpEngine.getXP(user1.address);
      const initialXP2 = await xpEngine.getXP(user2.address);

      await seasonalEvents.connect(user1).claimRewards(communityEventId);
      await seasonalEvents.connect(user2).claimRewards(communityEventId);

      const finalXP1 = await xpEngine.getXP(user1.address);
      const finalXP2 = await xpEngine.getXP(user2.address);

      expect(finalXP1 - initialXP1).to.equal(2000);
      expect(finalXP2 - initialXP2).to.equal(2000);
    });
  });

  describe("XP Multiplier Events", function () {
    let multiplierEventId;

    beforeEach(async function () {
        const startTime = await getFutureTimestamp(100);
        const endTime = startTime + 7 * 24 * 3600;

      await seasonalEvents.connect(eventManager).createEvent(
        "XP Boost Event",
        "Double XP weekend",
        EventType.XP_MULTIPLIER,
        startTime,
        endTime,
        0,
        20000, // 200% multiplier
        1000, // target metric
        ["ipfs://boost-badge"],
        [1000], // base reward
        false,
        false,
        0
      );

      multiplierEventId = 1;

      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");
      await seasonalEvents.connect(eventManager).startEvent(multiplierEventId);
    });

    it("Should apply multiplier to rewards", async function () {
      await seasonalEvents.connect(eventManager).updateProgress(multiplierEventId, user1.address, 1500);
      await seasonalEvents.connect(eventManager).endEvent(multiplierEventId);

      const initialXP = await xpEngine.getXP(user1.address);
      await seasonalEvents.connect(user1).claimRewards(multiplierEventId);
      const finalXP = await xpEngine.getXP(user1.address);

      // Base reward is 1000, with 200% multiplier = 2000
      expect(finalXP - initialXP).to.equal(2000);
    });
  });

  describe("Repeating Events", function () {
    it("Should create repeat events automatically", async function () {
        const startTime = await getFutureTimestamp(100);
        const endTime = startTime + 3600; // 1 hour duration
        const repeatInterval = 7200; // 2 hours between repeats

      await seasonalEvents.connect(eventManager).createEvent(
        "Weekly Event",
        "Repeating weekly challenge",
        EventType.QUEST_MARATHON,
        startTime,
        endTime,
        0,
        10000,
        1000,
        ["ipfs://weekly-badge"],
        [500],
        false,
        true, // is repeating
        repeatInterval
      );

      // Start and end the event
      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");
      await seasonalEvents.connect(eventManager).startEvent(1);

      await expect(seasonalEvents.connect(eventManager).endEvent(1))
        .to.emit(seasonalEvents, "EventRepeated")
        .withArgs(1, 2);

      // Check that a new event was created
      const [totalEvents] = await seasonalEvents.getGlobalStats();
      expect(totalEvents).to.equal(2);

      // Verify the new event has correct timing
      const [, , , , newStartTime, newEndTime] = await seasonalEvents.getEventInfo(2);
      expect(newStartTime).to.equal(BigInt(endTime) + BigInt(repeatInterval));
      expect(newEndTime).to.equal(newStartTime + BigInt(3600));
    });
  });

  describe("Access Control and Security", function () {
    it("Should allow admin to emergency stop events", async function () {
        const startTime = await getFutureTimestamp(100);
        const endTime = startTime + 7 * 24 * 3600;

      await seasonalEvents.connect(eventManager).createEvent(
        "Emergency Test", "Description", EventType.XP_MULTIPLIER,
        startTime, endTime, 0, 15000, 0,
        ["ipfs://badge1"], [500], false, false, 0
      );

      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");
      await seasonalEvents.connect(eventManager).startEvent(1);

      // Emergency stop
      await seasonalEvents.emergencyStopEvent(1);

      const [, , , status] = await seasonalEvents.getEventInfo(1);
      expect(status).to.equal(EventStatus.ENDED);
    });

    it("Should allow admin to pause and unpause", async function () {
      await seasonalEvents.pause();
      expect(await seasonalEvents.paused()).to.be.true;

      await expect(seasonalEvents.connect(user1).registerForEvent(1))
        .to.be.revertedWithCustomError(seasonalEvents, "EnforcedPause");

      await seasonalEvents.unpause();
      expect(await seasonalEvents.paused()).to.be.false;
    });

    it("Should prevent non-admin from emergency actions", async function () {
      await expect(seasonalEvents.connect(user1).emergencyStopEvent(1))
        .to.be.reverted;

      await expect(seasonalEvents.connect(user1).pause())
        .to.be.reverted;
    });
  });

  describe("Error Handling", function () {
    it("Should handle non-existent events", async function () {
      await expect(seasonalEvents.getEventInfo(999))
        .to.be.revertedWithCustomError(seasonalEvents, "EventNotFound");

      await expect(seasonalEvents.connect(user1).registerForEvent(999))
        .to.be.revertedWithCustomError(seasonalEvents, "EventNotFound");
    });

    it("Should prevent progress updates on inactive events", async function () {
        const startTime = await getFutureTimestamp(3600);
        const endTime = startTime + 7 * 24 * 3600;

      await seasonalEvents.connect(eventManager).createEvent(
        "Inactive Event", "Description", EventType.XP_MULTIPLIER,
        startTime, endTime, 0, 15000, 0,
        ["ipfs://badge1"], [500], false, false, 0
      );

      await expect(seasonalEvents.connect(eventManager).updateProgress(1, user1.address, 1000))
        .to.be.revertedWithCustomError(seasonalEvents, "EventNotActive");
    });

    it("Should prevent double reward claims", async function () {
        const startTime = await getFutureTimestamp(100);
        const endTime = startTime + 7 * 24 * 3600;

      await seasonalEvents.connect(eventManager).createEvent(
        "Double Claim Test", "Description", EventType.XP_MULTIPLIER,
        startTime, endTime, 0, 15000, 1000,
        ["ipfs://badge1"], [500], false, false, 0
      );

      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");
      await seasonalEvents.connect(eventManager).startEvent(1);
      await seasonalEvents.connect(eventManager).updateProgress(1, user1.address, 1500);
      await seasonalEvents.connect(eventManager).endEvent(1);

      await seasonalEvents.connect(user1).claimRewards(1);
      
      await expect(seasonalEvents.connect(user1).claimRewards(1))
        .to.be.revertedWithCustomError(seasonalEvents, "RewardsAlreadyClaimed");
    });
  });
});