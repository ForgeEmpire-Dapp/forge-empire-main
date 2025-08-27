const { ethers, upgrades } = require("hardhat");

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

async function setupDynamicQuestEngine() {
  let dynamicQuestEngine;
  let mockXPEngine;
  let owner, questManager, user1, user2, user3, algorithmUpdater, admin;

  [owner, questManager, user1, user2, user3, algorithmUpdater, admin] = await ethers.getSigners();

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
  await mockXPEngine.awardXP(user1.address, 1000);
  await mockXPEngine.awardXP(user2.address, 5000);
  await mockXPEngine.awardXP(user3.address, 0);

  return {
    dynamicQuestEngine,
    mockXPEngine,
    owner,
    questManager,
    user1,
    user2,
    user3,
    algorithmUpdater,
    admin,
    QUEST_MANAGER_ROLE,
    ALGORITHM_UPDATER_ROLE
  };
}

module.exports = {
  setupDynamicQuestEngine,
  Category,
  QuestType,
  Difficulty
};