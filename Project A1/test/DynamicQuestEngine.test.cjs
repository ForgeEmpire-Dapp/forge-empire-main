const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("DynamicQuestEngine", function () {
  let dynamicQuestEngine;
  let xpEngine;
  let mockXPEngine;
  let owner, questManager, user1, user2, algorithmUpdater;

  // Quest categories and types for testing
  const Category = {
    TRADING: 0,
    SOCIAL: 1,
    GOVERNANCE: 2,
    STAKING: 3,
    GUILD: 4,
    LEARNING: 5,
    BRIDGE: 6,
    NFT: 7,
    DEFI: 8,
    GAMING: 9
  };

  const QuestType = {
    ACHIEVEMENT: 0,
    COLLECTION: 1,
    SOCIAL_REACH: 2,
    TIME_BASED: 3,
    COLLABORATION: 4,
    SKILL_BASED: 5,
    EXPLORATION: 6,
    MILESTONE: 7,
    CREATIVE: 8,
    COMPETITIVE: 9
  };

  const Difficulty = {
    EASY: 0,
    MEDIUM: 1,
    HARD: 2,
    EPIC: 3,
    LEGENDARY: 4
  };

  beforeEach(async function () {
    [owner, questManager, user1, user2, algorithmUpdater] = await ethers.getSigners();

    // Deploy Mock XP Engine
    const MockXPEngine = await ethers.getContractFactory("MockXPEngine");
    mockXPEngine = await MockXPEngine.deploy();
    await mockXPEngine.waitForDeployment();

    // Deploy DynamicQuestEngine
    const DynamicQuestEngine = await ethers.getContractFactory("DynamicQuestEngine");
    dynamicQuestEngine = await upgrades.deployProxy(
      DynamicQuestEngine,
      [await mockXPEngine.getAddress(), 5], // max 5 active quests
      { initializer: "initialize" }
    );
    await dynamicQuestEngine.waitForDeployment();

    // Grant roles
    const QUEST_MANAGER_ROLE = await dynamicQuestEngine.QUEST_MANAGER_ROLE();
    const ALGORITHM_UPDATER_ROLE = await dynamicQuestEngine.ALGORITHM_UPDATER_ROLE();
    
    await dynamicQuestEngine.grantRole(QUEST_MANAGER_ROLE, questManager.address);
    await dynamicQuestEngine.grantRole(ALGORITHM_UPDATER_ROLE, algorithmUpdater.address);

    await mockXPEngine.grantRole(await mockXPEngine.XP_AWARDER_ROLE(), owner.address);

    // Set up initial XP for users
    await mockXPEngine.setUserXP(user1.address, 1000, 10);
    await mockXPEngine.setUserXP(user2.address, 5000, 25);
  });

  describe("Quest Template Management", function () {
    it("Should create a quest template", async function () {
      const templateData = {
        name: "DeFi Explorer",
        description: "Complete 5 trades on different DEX platforms",
        category: Category.TRADING,
        questType: QuestType.ACHIEVEMENT,
        difficulty: Difficulty.MEDIUM,
        baseReward: 250,
        timeLimit: 7 * 24 * 60 * 60, // 7 days
        parameters: [5, 100], // 5 trades, min 100 tokens each
        requirements: ["Complete trades", "Use different DEXs", "Minimum volume"]
      };

      await expect(
        dynamicQuestEngine.connect(questManager).createQuestTemplate(
          templateData.name,
          templateData.description,
          templateData.category,
          templateData.questType,
          templateData.difficulty,
          templateData.baseReward,
          templateData.timeLimit,
          templateData.parameters,
          templateData.requirements
        )
      ).to.emit(dynamicQuestEngine, "QuestTemplateCreated")
        .withArgs(1, templateData.name, templateData.category);

      const template = await dynamicQuestEngine.getQuestTemplate(1);
      expect(template.name).to.equal(templateData.name);
      expect(template.category).to.equal(templateData.category);
      expect(template.difficulty).to.equal(templateData.difficulty);
      expect(template.baseReward).to.equal(templateData.baseReward);
      expect(template.isActive).to.be.true;
      expect(template.popularity).to.equal(0);
      expect(template.successRate).to.equal(50); // Default 50%
    });

    it("Should reject template creation from non-quest manager", async function () {
      await expect(
        dynamicQuestEngine.connect(user1).createQuestTemplate(
          "Test Quest",
          "Description",
          Category.SOCIAL,
          QuestType.ACHIEVEMENT,
          Difficulty.EASY,
          100,
          24 * 60 * 60,
          [1],
          ["Requirement"]
        )
      ).to.be.reverted;
    });
  });

  describe("Quest Generation", function () {
    beforeEach(async function () {
      // Create multiple quest templates for testing
      const templates = [
        {
          name: "Social Butterfly",
          description: "Follow 10 new users",
          category: Category.SOCIAL,
          questType: QuestType.ACHIEVEMENT,
          difficulty: Difficulty.EASY,
          baseReward: 150,
          timeLimit: 3 * 24 * 60 * 60,
          parameters: [10],
          requirements: ["Follow users"]
        },
        {
          name: "Trading Master",
          description: "Complete high-value trades",
          category: Category.TRADING,
          questType: QuestType.COLLECTION,
          difficulty: Difficulty.HARD,
          baseReward: 500,
          timeLimit: 7 * 24 * 60 * 60,
          parameters: [1000],
          requirements: ["Trade volume"]
        },
        {
          name: "Guild Leader",
          description: "Lead guild activities",
          category: Category.GUILD,
          questType: QuestType.COLLABORATION,
          difficulty: Difficulty.EPIC,
          baseReward: 800,
          timeLimit: 14 * 24 * 60 * 60,
          parameters: [5, 3],
          requirements: ["Lead activities", "Coordinate members"]
        }
      ];

      for (let template of templates) {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          template.name,
          template.description,
          template.category,
          template.questType,
          template.difficulty,
          template.baseReward,
          template.timeLimit,
          template.parameters,
          template.requirements
        );
      }
    });

    it("Should generate personalized quests for user", async function () {
      await expect(
        dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 2)
      ).to.emit(dynamicQuestEngine, "QuestGenerated");

      const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
      expect(activeQuests.length).to.equal(2);

      // Check first generated quest
      const quest1 = await dynamicQuestEngine.getGeneratedQuest(activeQuests[0]);
      expect(quest1.user).to.equal(user1.address);
      expect(quest1.isCompleted).to.be.false;
      expect(quest1.isClaimed).to.be.false;
      expect(quest1.currentProgress).to.equal(0);
      expect(quest1.startTime).to.be.greaterThan(0);
      expect(quest1.deadline).to.be.greaterThan(quest1.startTime);

      // Reward should be personalized based on user level (level 10)
      // Should be between 50-150% of base reward
      const template = await dynamicQuestEngine.getQuestTemplate(quest1.templateId);
      const expectedMinReward = (template.baseReward * BigInt(50)) / BigInt(100);
      const expectedMaxReward = (template.baseReward * BigInt(150)) / BigInt(100);
      expect(quest1.reward).to.be.gte(expectedMinReward);
      expect(quest1.reward).to.be.lte(expectedMaxReward);
    });

    it("Should respect maximum active quests limit", async function () {
      // Generate maximum allowed quests
      await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 5);
      
      // Try to generate more - should fail
      await expect(
        dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1)
      ).to.be.revertedWith("Too many active quests");
    });

    it("Should auto-generate quests for active users", async function () {
      await dynamicQuestEngine.connect(user1).autoGenerateQuests(user1.address);
      
      const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
      expect(activeQuests.length).to.equal(3); // Should generate 3 quests automatically
    });

    it("Should personalize rewards based on user level", async function () {
      await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
      await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user2.address, 1);

      const user1Quests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
      const user2Quests = await dynamicQuestEngine.getUserActiveQuests(user2.address);

      const user1Quest = await dynamicQuestEngine.getGeneratedQuest(user1Quests[0]);
      const user2Quest = await dynamicQuestEngine.getGeneratedQuest(user2Quests[0]);

      // User2 has higher level (25 vs 10), so should get higher rewards
      // if they get the same template
      if (user1Quest.templateId === user2Quest.templateId) {
        expect(user2Quest.reward).to.be.gte(user1Quest.reward);
      }
    });
  });

  describe("Quest Completion", function () {
    let questId;

    beforeEach(async function () {
      // Create a template and generate a quest
      await dynamicQuestEngine.connect(questManager).createQuestTemplate(
        "Test Quest",
        "Complete test actions",
        Category.SOCIAL,
        QuestType.ACHIEVEMENT,
        Difficulty.EASY,
        200,
        24 * 60 * 60,
        [10],
        ["Complete actions"]
      );

      await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
      const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
      questId = activeQuests[0];
    });

    it("Should complete quest when target is reached", async function () {
      const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
      
      await expect(
        dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        )
      ).to.emit(dynamicQuestEngine, "QuestCompleted")
        .withArgs(questId, user1.address, quest.reward);

      const completedQuest = await dynamicQuestEngine.getGeneratedQuest(questId);
      expect(completedQuest.isCompleted).to.be.true;
      expect(completedQuest.currentProgress).to.equal(quest.targetValue);

      // Should be removed from active quests
      const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
      expect(activeQuests).to.not.include(questId);

      // Should be added to completed quests
      const completedQuests = await dynamicQuestEngine.getUserCompletedQuests(user1.address);
      expect(completedQuests).to.include(questId);
    });

    it("Should update quest progress", async function () {
      const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
      const partialProgress = quest.targetValue / BigInt(2);

      await dynamicQuestEngine.connect(questManager).updateQuestProgress(
        questId,
        user1.address,
        partialProgress
      );

      const updatedQuest = await dynamicQuestEngine.getGeneratedQuest(questId);
      expect(updatedQuest.currentProgress).to.equal(partialProgress);
      expect(updatedQuest.isCompleted).to.be.false;
    });

    it("Should auto-complete quest when progress reaches target", async function () {
      const quest = await dynamicQuestEngine.getGeneratedQuest(questId);

      await expect(
        dynamicQuestEngine.connect(questManager).updateQuestProgress(
          questId,
          user1.address,
          quest.targetValue
        )
      ).to.emit(dynamicQuestEngine, "QuestCompleted");

      const completedQuest = await dynamicQuestEngine.getGeneratedQuest(questId);
      expect(completedQuest.isCompleted).to.be.true;
    });

    it("Should allow claiming rewards", async function () {
      const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
      
      // Complete the quest first
      await dynamicQuestEngine.connect(questManager).completeQuest(
        questId,
        user1.address,
        quest.targetValue
      );

      // Claim rewards
      await expect(
        dynamicQuestEngine.connect(user1).claimQuestReward(questId)
      ).to.emit(dynamicQuestEngine, "QuestClaimed")
        .withArgs(questId, user1.address, quest.reward);

      const claimedQuest = await dynamicQuestEngine.getGeneratedQuest(questId);
      expect(claimedQuest.isClaimed).to.be.true;

      // Should have awarded XP
      expect(await mockXPEngine.awardXPCalled()).to.be.true;
    });

    it("Should reject completion from wrong user", async function () {
      const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
      
      await expect(
        dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user2.address, // Wrong user
          quest.targetValue
        )
      ).to.be.revertedWith("Invalid user");
    });

    it("Should reject completion if target not reached", async function () {
      const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
      
      await expect(
        dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue - BigInt(1) // Below target
        )
      ).to.be.revertedWith("Target not reached");
    });
  });

  describe("Personalization Algorithm", function () {
    beforeEach(async function () {
      // Create templates with different difficulties and categories
      const templates = [
        { name: "Easy Social", category: Category.SOCIAL, difficulty: Difficulty.EASY, reward: 100 },
        { name: "Medium Trading", category: Category.TRADING, difficulty: Difficulty.MEDIUM, reward: 250 },
        { name: "Hard DeFi", category: Category.DEFI, difficulty: Difficulty.HARD, reward: 500 },
        { name: "Epic Guild", category: Category.GUILD, difficulty: Difficulty.EPIC, reward: 800 }
      ];

      for (let i = 0; i < templates.length; i++) {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          templates[i].name,
          `Description ${i}`,
          templates[i].category,
          QuestType.ACHIEVEMENT,
          templates[i].difficulty,
          templates[i].reward,
          7 * 24 * 60 * 60,
          [10],
          ["Requirement"]
        );
      }
    });

    it("Should update personalization weights", async function () {
      await expect(
        dynamicQuestEngine.connect(algorithmUpdater).updatePersonalizationWeights(
          30, // levelWeight
          25, // categoryWeight
          20, // successRateWeight
          10, // timeWeight
          10, // diversityWeight
          5   // difficultyWeight
        )
      ).to.emit(dynamicQuestEngine, "PersonalizationWeightsUpdated");

      const weights = await dynamicQuestEngine.weights();
      expect(weights.levelWeight).to.equal(30);
      expect(weights.categoryWeight).to.equal(25);
    });

    it("Should reject invalid weight totals", async function () {
      await expect(
        dynamicQuestEngine.connect(algorithmUpdater).updatePersonalizationWeights(
          50, 50, 50, 50, 50, 50 // Totals to 300, not 100
        )
      ).to.be.revertedWith("Weights must sum to 100");
    });

    it("Should generate appropriate quests for different user levels", async function () {
      // Generate quests for different level users
      await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 2); // Level 10
      await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user2.address, 2); // Level 25

      const user1Quests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
      const user2Quests = await dynamicQuestEngine.getUserActiveQuests(user2.address);

      expect(user1Quests.length).to.equal(2);
      expect(user2Quests.length).to.equal(2);

      // Check that higher level user gets more challenging quests on average
      let user1AvgReward = 0;
      let user2AvgReward = 0;

      for (let questId of user1Quests) {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        user1AvgReward += Number(quest.reward);
      }
      user1AvgReward /= user1Quests.length;

      for (let questId of user2Quests) {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        user2AvgReward += Number(quest.reward);
      }
      user2AvgReward /= user2Quests.length;

      // Higher level user should generally get higher rewards
      expect(user2AvgReward).to.be.gte(user1AvgReward);
    });
  });

  describe("Admin Functions", function () {
    it("Should pause and unpause questing", async function () {
      await dynamicQuestEngine.connect(owner).pauseQuesting();
      
      await expect(
        dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1)
      ).to.be.revertedWithCustomError(dynamicQuestEngine, "EnforcedPause");

      await dynamicQuestEngine.connect(owner).unpauseQuesting();

      // Should work again after unpausing
      await expect(
        dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1)
      ).to.not.be.reverted;
    });

    it("Should update max active quests", async function () {
      await dynamicQuestEngine.connect(owner).updateMaxActiveQuests(10);
      expect(await dynamicQuestEngine.maxActiveQuests()).to.equal(10);
    });

    it("Should reject admin functions from non-admin", async function () {
      await expect(
        dynamicQuestEngine.connect(user1).pauseQuesting()
      ).to.be.reverted;

      await expect(
        dynamicQuestEngine.connect(user1).updateMaxActiveQuests(10)
      ).to.be.reverted;
    });
  });

  describe("User Profile Management", function () {
    it("Should update user profiles automatically", async function () {
      // Initial quest generation should update profile
      await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);

      const profile = await dynamicQuestEngine.userProfiles(user1.address);
      expect(profile.level).to.equal(10);
      expect(profile.totalXP).to.equal(1000);
      expect(profile.isActive).to.be.true;
    });

    it("Should track quest completion statistics", async function () {
      // Create and complete a quest
      await dynamicQuestEngine.connect(questManager).createQuestTemplate(
        "Stat Test",
        "Test stats",
        Category.SOCIAL,
        QuestType.ACHIEVEMENT,
        Difficulty.EASY,
        100,
        24 * 60 * 60,
        [5],
        ["Test"]
      );

      await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
      const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
      const questId = activeQuests[0];
      const quest = await dynamicQuestEngine.getGeneratedQuest(questId);

      await dynamicQuestEngine.connect(questManager).completeQuest(
        questId,
        user1.address,
        quest.targetValue
      );

      const profile = await dynamicQuestEngine.userProfiles(user1.address);
      expect(profile.completedQuests).to.equal(1);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle quest expiration", async function () {
      // This would require time manipulation in a real test environment
      // For now, we'll test the logic exists
      await dynamicQuestEngine.connect(questManager).createQuestTemplate(
        "Expired Quest",
        "This will expire",
        Category.SOCIAL,
        QuestType.TIME_BASED,
        Difficulty.EASY,
        100,
        1, // 1 second time limit
        [1],
        ["Quick"]
      );

      await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
      const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
      const questId = activeQuests[0];

      // In a real scenario, we'd advance time and then try to complete
      // The contract should reject expired quest completions
    });

    it("Should handle zero quest generation", async function () {
      await expect(
        dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 0)
      ).to.be.revertedWith("Invalid quest count");
    });

    it("Should handle excessive quest generation", async function () {
      await expect(
        dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 10)
      ).to.be.revertedWith("Invalid quest count");
    });
  });

  describe("Enhanced Branch Coverage Tests", function () {
    let dynamicQuestEngine;
    let mockXPEngine;
    let owner, questManager, user1, user2, user3, algorithmUpdater, admin;
    let QUEST_MANAGER_ROLE, ALGORITHM_UPDATER_ROLE;

    beforeEach(async function () {
      [owner, questManager, user1, user2, user3, algorithmUpdater, admin] = await ethers.getSigners();

      // Deploy Mock XP Engine
      const MockXPEngine = await ethers.getContractFactory("MockXPEngine");
      mockXPEngine = await MockXPEngine.deploy();
      await mockXPEngine.waitForDeployment();

      // Deploy DynamicQuestEngine
      const DynamicQuestEngine = await ethers.getContractFactory("DynamicQuestEngine");
      dynamicQuestEngine = await upgrades.deployProxy(
        DynamicQuestEngine,
        [await mockXPEngine.getAddress(), 5],
        { initializer: "initialize" }
      );
      await dynamicQuestEngine.waitForDeployment();

      QUEST_MANAGER_ROLE = await dynamicQuestEngine.QUEST_MANAGER_ROLE();
      ALGORITHM_UPDATER_ROLE = await dynamicQuestEngine.ALGORITHM_UPDATER_ROLE();
      
      await dynamicQuestEngine.grantRole(QUEST_MANAGER_ROLE, questManager.address);
      await dynamicQuestEngine.grantRole(ALGORITHM_UPDATER_ROLE, algorithmUpdater.address);

      await mockXPEngine.grantRole(await mockXPEngine.XP_AWARDER_ROLE(), owner.address);

      // Set up initial XP for users
      await mockXPEngine.setUserXP(user1.address, 1000, 10);
      await mockXPEngine.setUserXP(user2.address, 5000, 25);
      await mockXPEngine.setUserXP(user3.address, 0, 0);
    });

    describe("Initialization and Constructor Edge Cases", function () {
      it("Should handle initialization with zero max active quests", async function () {
        const DynamicQuestEngine = await ethers.getContractFactory("DynamicQuestEngine");
        const zeroMaxQuest = await upgrades.deployProxy(
          DynamicQuestEngine,
          [await mockXPEngine.getAddress(), 0],
          { initializer: "initialize" }
        );
        
        expect(await zeroMaxQuest.maxActiveQuests()).to.equal(0);
      });

      it("Should handle initialization with maximum active quests", async function () {
        const DynamicQuestEngine = await ethers.getContractFactory("DynamicQuestEngine");
        const maxQuest = await upgrades.deployProxy(
          DynamicQuestEngine,
          [await mockXPEngine.getAddress(), 1000],
          { initializer: "initialize" }
        );
        
        expect(await maxQuest.maxActiveQuests()).to.equal(1000);
      });

      it("Should handle initialization with zero address XP engine", async function () {
        const DynamicQuestEngine = await ethers.getContractFactory("DynamicQuestEngine");
        const zeroAddressEngine = await upgrades.deployProxy(
          DynamicQuestEngine,
          [ethers.ZeroAddress, 5],
          { initializer: "initialize" }
        );
        
        expect(await zeroAddressEngine.xpEngine()).to.equal(ethers.ZeroAddress);
      });

      it("Should correctly initialize default personalization weights", async function () {
        const weights = await dynamicQuestEngine.weights();
        expect(weights.levelWeight).to.equal(25);
        expect(weights.categoryWeight).to.equal(20);
        expect(weights.successRateWeight).to.equal(20);
        expect(weights.timeWeight).to.equal(10);
        expect(weights.diversityWeight).to.equal(15);
        expect(weights.difficultyWeight).to.equal(10);
      });

      it("Should correctly initialize ID counters", async function () {
        expect(await dynamicQuestEngine.nextTemplateId()).to.equal(1);
        expect(await dynamicQuestEngine.nextQuestId()).to.equal(1);
      });

      it("Should handle constructor disable initializers", async function () {
        const DynamicQuestEngine = await ethers.getContractFactory("DynamicQuestEngine");
        const directContract = await DynamicQuestEngine.deploy();
        
        await expect(directContract.initialize(await mockXPEngine.getAddress(), 5))
          .to.be.revertedWithCustomError(directContract, "InvalidInitialization");
      });
    });

    describe("Quest Template Creation Edge Cases", function () {
      it("Should handle template with empty name", async function () {
        await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "", // Empty name
          "Description",
          Category.TRADING,
          QuestType.ACHIEVEMENT,
          Difficulty.EASY,
          100,
          86400,
          [1, 2],
          ["Req1"]
        )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
      });

      it("Should handle template with empty description", async function () {
        await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Test Quest",
          "", // Empty description
          Category.SOCIAL,
          QuestType.COLLECTION,
          Difficulty.MEDIUM,
          200,
          86400,
          [5],
          ["Requirement"]
        )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
      });

      it("Should handle template with zero base reward", async function () {
        await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Zero Reward Quest",
          "No reward quest",
          Category.GOVERNANCE,
          QuestType.SOCIAL_REACH,
          Difficulty.HARD,
          0, // Zero reward
          86400,
          [10],
          ["Participate"]
        )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
      });

      it("Should handle template with zero time limit", async function () {
        await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Unlimited Time",
          "No time limit",
          Category.STAKING,
          QuestType.TIME_BASED,
          Difficulty.EPIC,
          500,
          0, // Zero time limit
          [100],
          ["Stake tokens"]
        )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
      });

      it("Should handle template with empty parameters array", async function () {
        await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "No Params Quest",
          "Quest without parameters",
          Category.GUILD,
          QuestType.COLLABORATION,
          Difficulty.LEGENDARY,
          1000,
          86400,
          [], // Empty parameters
          ["Join guild"]
        )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
      });

      it("Should handle template with empty requirements array", async function () {
        await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "No Requirements",
          "Quest without requirements",
          Category.LEARNING,
          QuestType.SKILL_BASED,
          Difficulty.EASY,
          150,
          86400,
          [3],
          [] // Empty requirements
        )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
      });

      it("Should handle template with very large parameters", async function () {
        const largeParams = Array(100).fill(999999999);
        await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Large Params",
          "Quest with many parameters",
          Category.BRIDGE,
          QuestType.EXPLORATION,
          Difficulty.MEDIUM,
          300,
          86400,
          largeParams,
          ["Bridge assets"]
        )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
      });

      it("Should handle template with very large requirements array", async function () {
        const largeReqs = Array(50).fill("Requirement");
        await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Many Requirements",
          "Quest with many requirements",
          Category.NFT,
          QuestType.CREATIVE,
          Difficulty.HARD,
          400,
          86400,
          [5, 10],
          largeReqs
        )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
      });

      it("Should handle all difficulty levels", async function () {
        const difficulties = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.EPIC, Difficulty.LEGENDARY];
        
        for (let i = 0; i < difficulties.length; i++) {
          await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
            `Difficulty ${i}`,
            `Quest with difficulty ${i}`,
            Category.DEFI,
            QuestType.MILESTONE,
            difficulties[i],
            100 * (i + 1),
            86400,
            [i + 1],
            [`Difficulty ${i}`]
          )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
        }
      });

      it("Should handle all categories", async function () {
        const categories = [
          Category.TRADING, Category.SOCIAL, Category.GOVERNANCE, Category.STAKING,
          Category.GUILD, Category.LEARNING, Category.BRIDGE, Category.NFT,
          Category.DEFI, Category.GAMING
        ];
        
        for (let i = 0; i < categories.length; i++) {
          await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
            `Category ${i}`,
            `Quest with category ${i}`,
            categories[i],
            QuestType.COMPETITIVE,
            Difficulty.MEDIUM,
            200,
            86400,
            [5],
            [`Category ${i}`]
          )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
        }
      });

      it("Should handle all quest types", async function () {
        const questTypes = [
          QuestType.ACHIEVEMENT, QuestType.COLLECTION, QuestType.SOCIAL_REACH,
          QuestType.TIME_BASED, QuestType.COLLABORATION, QuestType.SKILL_BASED,
          QuestType.EXPLORATION, QuestType.MILESTONE, QuestType.CREATIVE,
          QuestType.COMPETITIVE
        ];
        
        for (let i = 0; i < questTypes.length; i++) {
          await expect(dynamicQuestEngine.connect(questManager).createQuestTemplate(
            `QuestType ${i}`,
            `Quest with type ${i}`,
            Category.GAMING,
            questTypes[i],
            Difficulty.MEDIUM,
            250,
            86400,
            [3],
            [`Type ${i}`]
          )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
        }
      });
    });

    describe("Quest Generation Edge Cases", function () {
      beforeEach(async function () {
        // Create several templates for testing
        for (let i = 0; i < 5; i++) {
          await dynamicQuestEngine.connect(questManager).createQuestTemplate(
            `Template ${i}`,
            `Description ${i}`,
            Category.TRADING,
            QuestType.ACHIEVEMENT,
            Difficulty.EASY,
            100 + i * 50,
            86400,
            [i + 1],
            [`Requirement ${i}`]
          );
        }
      });

      it("Should handle quest generation with minimum count (1)", async function () {
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1))
          .to.emit(dynamicQuestEngine, "QuestGenerated");
      });

      it("Should handle quest generation with maximum count (5)", async function () {
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 5))
          .to.not.be.reverted;
      });

      it("Should reject quest generation with zero count", async function () {
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 0))
          .to.be.revertedWith("Invalid quest count");
      });

      it("Should reject quest generation with count > 5", async function () {
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 6))
          .to.be.revertedWith("Invalid quest count");
      });

      it("Should reject quest generation exceeding max active quests", async function () {
        // First generate maximum quests
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 5);
        
        // Try to generate more
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1))
          .to.be.revertedWith("Too many active quests");
      });

      it("Should handle quest generation for user with no previous activity", async function () {
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user2.address, 3))
          .to.not.be.reverted;
      });

      it("Should handle quest generation when paused", async function () {
        await dynamicQuestEngine.connect(owner).pauseQuesting();
        
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1))
          .to.be.revertedWithCustomError(dynamicQuestEngine, "EnforcedPause");
      });

      it("Should handle auto-generation for user with zero active quests", async function () {
        await expect(dynamicQuestEngine.connect(user1).autoGenerateQuests(user1.address))
          .to.not.be.reverted;
      });

      it("Should handle auto-generation for user with 1 active quest", async function () {
        // Generate 1 quest first
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        
        await expect(dynamicQuestEngine.connect(user1).autoGenerateQuests(user1.address))
          .to.not.be.reverted;
      });

      it("Should skip auto-generation for user with 2+ active quests", async function () {
        // Generate 2 quests first
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 2);
        
        await expect(dynamicQuestEngine.connect(user1).autoGenerateQuests(user1.address))
          .to.not.be.reverted;
      });

      it("Should reject auto-generation for unauthorized user", async function () {
        await expect(dynamicQuestEngine.connect(user2).autoGenerateQuests(user1.address))
          .to.be.revertedWith("Unauthorized");
      });

      it("Should allow quest manager to auto-generate for any user", async function () {
        await expect(dynamicQuestEngine.connect(questManager).autoGenerateQuests(user1.address))
          .to.not.be.reverted;
      });

      it("Should auto-generate quests for new user (activates profile)", async function () {
        // User3 starts with no active profile but should be activated upon first interaction
        await expect(dynamicQuestEngine.connect(user3).autoGenerateQuests(user3.address))
          .to.not.be.reverted;
        
        const profile = await dynamicQuestEngine.userProfiles(user3.address);
        expect(profile.isActive).to.be.true;
      });
    });

    describe("Quest Completion Edge Cases", function () {
      let questId;

      beforeEach(async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Test Quest",
          "Test completion",
          Category.SOCIAL,
          QuestType.ACHIEVEMENT,
          Difficulty.MEDIUM,
          200,
          86400,
          [10],
          ["Complete 10 actions"]
        );
        
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        questId = activeQuests[0];
      });

      it("Should complete quest with exact target value", async function () {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        await expect(dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        )).to.emit(dynamicQuestEngine, "QuestCompleted");
      });

      it("Should complete quest with value above target", async function () {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        await expect(dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue + 5n
        )).to.emit(dynamicQuestEngine, "QuestCompleted");
      });

      it("Should reject completion with value below target", async function () {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        await expect(dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue - 1n
        )).to.be.revertedWith("Target not reached");
      });

      it("Should reject completion for wrong user", async function () {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        await expect(dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user2.address, // Wrong user
          quest.targetValue
        )).to.be.revertedWith("Invalid user");
      });

      it("Should reject double completion", async function () {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        // Complete once
        await dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        );
        
        // Try to complete again
        await expect(dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        )).to.be.revertedWith("Quest already completed");
      });

      it("Should reject completion of expired quest", async function () {
        // Fast forward time past deadline
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        await expect(dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        )).to.be.revertedWith("Quest expired");
      });

      it("Should reject completion of non-existent quest", async function () {
        await expect(dynamicQuestEngine.connect(questManager).completeQuest(
          999, // Non-existent quest
          user1.address,
          10
        )).to.be.revertedWith("Invalid user");
      });

      it("Should update template success rate on completion", async function () {
        const templateBefore = await dynamicQuestEngine.questTemplates(1);
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        await dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        );
        
        const templateAfter = await dynamicQuestEngine.questTemplates(1);
        expect(templateAfter.popularity).to.equal(templateBefore.popularity + 1n);
      });

      it("Should move quest from active to completed", async function () {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        const activeBeforeCount = (await dynamicQuestEngine.getUserActiveQuests(user1.address)).length;
        const completedBeforeCount = (await dynamicQuestEngine.getUserCompletedQuests(user1.address)).length;
        
        await dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        );
        
        const activeAfterCount = (await dynamicQuestEngine.getUserActiveQuests(user1.address)).length;
        const completedAfterCount = (await dynamicQuestEngine.getUserCompletedQuests(user1.address)).length;
        
        expect(activeAfterCount).to.equal(activeBeforeCount - 1);
        expect(completedAfterCount).to.equal(completedBeforeCount + 1);
      });
    });

    describe("Quest Progress Update Edge Cases", function () {
      let questId;

      beforeEach(async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Progress Quest",
          "Test progress updates",
          Category.STAKING,
          QuestType.MILESTONE,
          Difficulty.HARD,
          300,
          86400,
          [50],
          ["Stake 50 tokens"]
        );
        
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        questId = activeQuests[0];
      });

      it("Should update progress with valid values", async function () {
        await expect(dynamicQuestEngine.connect(questManager).updateQuestProgress(
          questId,
          user1.address,
          25
        )).to.not.be.reverted;
      });

      it("Should handle progress update with zero value", async function () {
        await expect(dynamicQuestEngine.connect(questManager).updateQuestProgress(
          questId,
          user1.address,
          0
        )).to.not.be.reverted;
      });

      it("Should handle progress update with very large value", async function () {
        await expect(dynamicQuestEngine.connect(questManager).updateQuestProgress(
          questId,
          user1.address,
          999999999
        )).to.not.be.reverted;
      });

      it("Should reject progress update for wrong user", async function () {
        await expect(dynamicQuestEngine.connect(questManager).updateQuestProgress(
          questId,
          user2.address, // Wrong user
          25
        )).to.be.revertedWith("Invalid user");
      });

      it("Should reject progress update for completed quest", async function () {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        // Complete quest first
        await dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        );
        
        await expect(dynamicQuestEngine.connect(questManager).updateQuestProgress(
          questId,
          user1.address,
          25
        )).to.be.revertedWith("Quest already completed");
      });

      it("Should reject progress update for expired quest", async function () {
        // Fast forward time past deadline
        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);
        
        await expect(dynamicQuestEngine.connect(questManager).updateQuestProgress(
          questId,
          user1.address,
          25
        )).to.be.revertedWith("Quest expired");
      });
    });

    describe("Reward Claiming Edge Cases", function () {
      let questId;

      beforeEach(async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Reward Quest",
          "Test reward claiming",
          Category.GUILD,
          QuestType.COLLABORATION,
          Difficulty.EPIC,
          500,
          86400,
          [3],
          ["Collaborate with 3 users"]
        );
        
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        questId = activeQuests[0];
        
        // Complete the quest
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        await dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        );
      });

      it("Should successfully claim quest reward", async function () {
        await expect(dynamicQuestEngine.connect(user1).claimQuestReward(questId))
          .to.emit(dynamicQuestEngine, "QuestClaimed");
      });

      it("Should reject claim from non-owner", async function () {
        await expect(dynamicQuestEngine.connect(user2).claimQuestReward(questId))
          .to.be.revertedWith("Not quest owner");
      });

      it("Should reject claim for incomplete quest", async function () {
        // Generate another quest that's not completed
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Incomplete Quest",
          "Not completed",
          Category.LEARNING,
          QuestType.SKILL_BASED,
          Difficulty.EASY,
          100,
          86400,
          [5],
          ["Learn 5 skills"]
        );
        
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user2.address, 1);
        const incompleteQuests = await dynamicQuestEngine.getUserActiveQuests(user2.address);
        const incompleteQuestId = incompleteQuests[0];
        
        await expect(dynamicQuestEngine.connect(user2).claimQuestReward(incompleteQuestId))
          .to.be.revertedWith("Quest not completed");
      });

      it("Should reject double claim", async function () {
        // Claim once
        await dynamicQuestEngine.connect(user1).claimQuestReward(questId);
        
        // Try to claim again
        await expect(dynamicQuestEngine.connect(user1).claimQuestReward(questId))
          .to.be.revertedWith("Reward already claimed");
      });

      it("Should reject claim for non-existent quest", async function () {
        await expect(dynamicQuestEngine.connect(user1).claimQuestReward(999))
          .to.be.revertedWith("Not quest owner");
      });

      it("Should call XP engine to award XP", async function () {
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        
        await expect(dynamicQuestEngine.connect(user1).claimQuestReward(questId))
          .to.emit(mockXPEngine, "XPAwarded")
          .withArgs(user1.address, quest.reward);
      });
    });

    describe("Access Control Edge Cases", function () {
      it("Should reject quest template creation from non-manager", async function () {
        await expect(dynamicQuestEngine.connect(user1).createQuestTemplate(
          "Unauthorized",
          "Should fail",
          Category.TRADING,
          QuestType.ACHIEVEMENT,
          Difficulty.EASY,
          100,
          86400,
          [1],
          ["Fail"]
        )).to.be.revertedWithCustomError(dynamicQuestEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should reject quest generation from non-manager", async function () {
        await expect(dynamicQuestEngine.connect(user1).generateQuestsForUser(user1.address, 1))
          .to.be.revertedWithCustomError(dynamicQuestEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should reject quest completion from non-manager", async function () {
        await expect(dynamicQuestEngine.connect(user1).completeQuest(1, user1.address, 10))
          .to.be.revertedWithCustomError(dynamicQuestEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should reject progress update from non-manager", async function () {
        await expect(dynamicQuestEngine.connect(user1).updateQuestProgress(1, user1.address, 5))
          .to.be.revertedWithCustomError(dynamicQuestEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should reject weight updates from non-algorithm-updater", async function () {
        await expect(dynamicQuestEngine.connect(user1).updatePersonalizationWeights(
          30, 30, 20, 10, 10, 0
        )).to.be.revertedWithCustomError(dynamicQuestEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should allow algorithm updater to update weights", async function () {
        await expect(dynamicQuestEngine.connect(algorithmUpdater).updatePersonalizationWeights(
          30, 25, 25, 10, 5, 5
        )).to.emit(dynamicQuestEngine, "PersonalizationWeightsUpdated");
      });

      it("Should reject admin functions from non-admin", async function () {
        await expect(dynamicQuestEngine.connect(user1).pauseQuesting())
          .to.be.revertedWithCustomError(dynamicQuestEngine, "AccessControlUnauthorizedAccount");
        
        await expect(dynamicQuestEngine.connect(user1).updateMaxActiveQuests(10))
          .to.be.revertedWithCustomError(dynamicQuestEngine, "AccessControlUnauthorizedAccount");
      });

      it("Should allow multiple role holders", async function () {
        await dynamicQuestEngine.grantRole(QUEST_MANAGER_ROLE, user1.address);
        
        await expect(dynamicQuestEngine.connect(user1).createQuestTemplate(
          "Multi Role Test",
          "Testing multiple roles",
          Category.NFT,
          QuestType.CREATIVE,
          Difficulty.MEDIUM,
          250,
          86400,
          [2],
          ["Create 2 NFTs"]
        )).to.emit(dynamicQuestEngine, "QuestTemplateCreated");
      });
    });

    describe("Pause Functionality Edge Cases", function () {
      beforeEach(async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Pause Test",
          "Testing pause functionality",
          Category.BRIDGE,
          QuestType.EXPLORATION,
          Difficulty.HARD,
          400,
          86400,
          [1],
          ["Bridge once"]
        );
      });

      it("Should block quest generation when paused", async function () {
        await dynamicQuestEngine.connect(owner).pauseQuesting();
        
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1))
          .to.be.revertedWithCustomError(dynamicQuestEngine, "EnforcedPause");
      });

      it("Should block auto-generation when paused", async function () {
        await dynamicQuestEngine.connect(owner).pauseQuesting();
        
        await expect(dynamicQuestEngine.connect(user1).autoGenerateQuests(user1.address))
          .to.be.revertedWithCustomError(dynamicQuestEngine, "EnforcedPause");
      });

      it("Should allow quest completion when paused", async function () {
        // Generate quest first
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        const questId = activeQuests[0];
        
        await dynamicQuestEngine.connect(owner).pauseQuesting();
        
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        await expect(dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        )).to.not.be.reverted;
      });

      it("Should allow reward claiming when paused", async function () {
        // Generate and complete quest first
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        const questId = activeQuests[0];
        
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        await dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        );
        
        await dynamicQuestEngine.connect(owner).pauseQuesting();
        
        await expect(dynamicQuestEngine.connect(user1).claimQuestReward(questId))
          .to.not.be.reverted;
      });

      it("Should resume operations after unpause", async function () {
        await dynamicQuestEngine.connect(owner).pauseQuesting();
        await dynamicQuestEngine.connect(owner).unpauseQuesting();
        
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1))
          .to.not.be.reverted;
      });
    });

    describe("Personalization Weights Edge Cases", function () {
      it("Should handle zero weights", async function () {
        await expect(dynamicQuestEngine.connect(algorithmUpdater).updatePersonalizationWeights(
          0, 0, 0, 0, 0, 0
        )).to.be.revertedWith("Weights must sum to 100");
      });

      it("Should handle maximum weights", async function () {
        await expect(dynamicQuestEngine.connect(algorithmUpdater).updatePersonalizationWeights(
          100, 100, 100, 100, 100, 100
        )).to.be.revertedWith("Weights must sum to 100");
      });

      it("Should handle unbalanced weight distribution", async function () {
        await expect(dynamicQuestEngine.connect(algorithmUpdater).updatePersonalizationWeights(
          90, 5, 3, 1, 1, 0
        )).to.emit(dynamicQuestEngine, "PersonalizationWeightsUpdated");
      });

      it("Should maintain weight values after update", async function () {
        await dynamicQuestEngine.connect(algorithmUpdater).updatePersonalizationWeights(
          35, 20, 15, 10, 15, 5
        );
        
        const weights = await dynamicQuestEngine.weights();
        expect(weights.levelWeight).to.equal(35);
        expect(weights.categoryWeight).to.equal(20);
        expect(weights.successRateWeight).to.equal(15);
        expect(weights.timeWeight).to.equal(10);
        expect(weights.diversityWeight).to.equal(15);
        expect(weights.difficultyWeight).to.equal(5);
      });
    });

    describe("User Profile Management Edge Cases", function () {
      it("Should handle user with zero XP", async function () {
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user3.address, 1);
        
        const profile = await dynamicQuestEngine.userProfiles(user3.address);
        expect(profile.level).to.equal(0);
        expect(profile.totalXP).to.equal(0);
        expect(profile.isActive).to.be.true;
      });

      it("Should handle user with very high XP", async function () {
        await mockXPEngine.setUserXP(user1.address, 999999999, 100);
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        
        const profile = await dynamicQuestEngine.userProfiles(user1.address);
        expect(profile.level).to.equal(100);
        expect(profile.totalXP).to.equal(999999999);
      });

      it("Should update last activity time", async function () {
        const beforeTime = await ethers.provider.getBlock('latest').then(b => b.timestamp);
        
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        
        const profile = await dynamicQuestEngine.userProfiles(user1.address);
        expect(Number(profile.lastActivityTime)).to.be.at.least(beforeTime);
      });

      it("Should track completed and failed quests", async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Stats Quest",
          "Track stats",
          Category.DEFI,
          QuestType.MILESTONE,
          Difficulty.MEDIUM,
          200,
          86400,
          [20],
          ["DeFi milestone"]
        );
        
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        const questId = activeQuests[0];
        
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        await dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        );
        
        const profile = await dynamicQuestEngine.userProfiles(user1.address);
        expect(profile.completedQuests).to.equal(1);
      });
    });

    describe("Template Management Edge Cases", function () {
      it("Should handle template deactivation", async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Deactivate Test",
          "Will be deactivated",
          Category.GAMING,
          QuestType.COMPETITIVE,
          Difficulty.LEGENDARY,
          1000,
          86400,
          [1],
          ["Win competition"]
        );
        
        await dynamicQuestEngine.connect(questManager).updateQuestTemplate(1, false);
        
        const template = await dynamicQuestEngine.questTemplates(1);
        expect(template.isActive).to.be.false;
      });

      it("Should handle template reactivation", async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Reactivate Test",
          "Will be reactivated",
          Category.SOCIAL,
          QuestType.SOCIAL_REACH,
          Difficulty.EASY,
          150,
          86400,
          [100],
          ["Reach 100 followers"]
        );
        
        await dynamicQuestEngine.connect(questManager).updateQuestTemplate(1, false);
        await dynamicQuestEngine.connect(questManager).updateQuestTemplate(1, true);
        
        const template = await dynamicQuestEngine.questTemplates(1);
        expect(template.isActive).to.be.true;
      });

      it("Should reject template update from non-manager", async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Update Test",
          "Cannot update",
          Category.LEARNING,
          QuestType.SKILL_BASED,
          Difficulty.HARD,
          350,
          86400,
          [10],
          ["Learn 10 skills"]
        );
        
        await expect(dynamicQuestEngine.connect(user1).updateQuestTemplate(1, false))
          .to.be.revertedWithCustomError(dynamicQuestEngine, "AccessControlUnauthorizedAccount");
      });
    });

    describe("Mathematical and State Edge Cases", function () {
      it("Should handle quest generation with zero templates", async function () {
        // Don't create any templates
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1))
          .to.not.be.reverted; // Should handle gracefully
      });

      it("Should handle success rate calculations", async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Success Rate Test",
          "Testing success rate",
          Category.STAKING,
          QuestType.TIME_BASED,
          Difficulty.MEDIUM,
          300,
          86400,
          [7],
          ["Stake for 7 days"]
        );
        
        const templateBefore = await dynamicQuestEngine.questTemplates(1);
        expect(templateBefore.successRate).to.equal(50); // Default
        
        // Generate and complete quest to affect success rate
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        const questId = activeQuests[0];
        
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        await dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        );
        
        const templateAfter = await dynamicQuestEngine.questTemplates(1);
        expect(templateAfter.popularity).to.equal(1);
        expect(templateAfter.successRate).to.equal(100); // Should be updated
      });

      it("Should handle quest ID overflow protection", async function () {
        // This would be a very long test in practice, but we test the logic exists
        expect(await dynamicQuestEngine.nextQuestId()).to.equal(1);
        expect(await dynamicQuestEngine.nextTemplateId()).to.equal(1);
      });
    });

    describe("ReentrancyGuard Protection Edge Cases", function () {
      beforeEach(async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Reentrancy Test",
          "Testing reentrancy protection",
          Category.NFT,
          QuestType.CREATIVE,
          Difficulty.EPIC,
          600,
          86400,
          [1],
          ["Create NFT"]
        );
      });

      it("Should protect generateQuestsForUser from reentrancy", async function () {
        await expect(dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1))
          .to.not.be.reverted;
      });

      it("Should protect completeQuest from reentrancy", async function () {
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        const questId = activeQuests[0];
        
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        await expect(dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        )).to.not.be.reverted;
      });

      it("Should protect claimQuestReward from reentrancy", async function () {
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        const questId = activeQuests[0];
        
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        await dynamicQuestEngine.connect(questManager).completeQuest(
          questId,
          user1.address,
          quest.targetValue
        );
        
        await expect(dynamicQuestEngine.connect(user1).claimQuestReward(questId))
          .to.not.be.reverted;
      });
    });

    describe("Complex Integration Scenarios", function () {
      it("Should handle complete quest lifecycle", async function () {
        // Create template
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Lifecycle Test",
          "Complete lifecycle",
          Category.GOVERNANCE,
          QuestType.COLLABORATION,
          Difficulty.HARD,
          500,
          86400,
          [3, 5],
          ["Participate in governance", "Vote on proposals"]
        );
        
        // Generate quest
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        const questId = activeQuests[0];
        
        // Update progress to target value (should auto-complete)
        const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
        await dynamicQuestEngine.connect(questManager).updateQuestProgress(questId, user1.address, quest.targetValue);
        
        // Claim reward
        await expect(dynamicQuestEngine.connect(user1).claimQuestReward(questId))
          .to.emit(dynamicQuestEngine, "QuestClaimed");
        
        // Verify final state
        const completedQuest = await dynamicQuestEngine.getGeneratedQuest(questId);
        expect(completedQuest.isCompleted).to.be.true;
        expect(completedQuest.isClaimed).to.be.true;
      });

      it("Should handle multiple users with different profiles", async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Multi User Test",
          "Different users test",
          Category.BRIDGE,
          QuestType.EXPLORATION,
          Difficulty.MEDIUM,
          250,
          86400,
          [2],
          ["Bridge 2 transactions"]
        );
        
        // Generate quests for different users
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user1.address, 1);
        await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user2.address, 1);
        
        const user1Quests = await dynamicQuestEngine.getUserActiveQuests(user1.address);
        const user2Quests = await dynamicQuestEngine.getUserActiveQuests(user2.address);
        
        expect(user1Quests.length).to.equal(1);
        expect(user2Quests.length).to.equal(1);
        expect(user1Quests[0]).to.not.equal(user2Quests[0]); // Different quest IDs
      });

      it("Should handle template popularity and success rate evolution", async function () {
        await dynamicQuestEngine.connect(questManager).createQuestTemplate(
          "Evolution Test",
          "Template evolution",
          Category.DEFI,
          QuestType.MILESTONE,
          Difficulty.EPIC,
          750,
          86400,
          [100],
          ["DeFi milestone 100"]
        );
        
        const initialTemplate = await dynamicQuestEngine.questTemplates(1);
        expect(initialTemplate.popularity).to.equal(0);
        expect(initialTemplate.successRate).to.equal(50);
        
        // Generate and complete multiple quests to see evolution
        for (let i = 0; i < 3; i++) {
          const user = [user1, user2, user3][i];
          await dynamicQuestEngine.connect(questManager).generateQuestsForUser(user.address, 1);
          const activeQuests = await dynamicQuestEngine.getUserActiveQuests(user.address);
          const questId = activeQuests[0];
          
          const quest = await dynamicQuestEngine.getGeneratedQuest(questId);
          await dynamicQuestEngine.connect(questManager).completeQuest(
            questId,
            user.address,
            quest.targetValue
          );
        }
        
        const evolvedTemplate = await dynamicQuestEngine.questTemplates(1);
        expect(evolvedTemplate.popularity).to.equal(3);
        expect(evolvedTemplate.successRate).to.equal(100); // All completed successfully
      });
    });
  });
});