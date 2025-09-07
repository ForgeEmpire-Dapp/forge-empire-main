const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("QuestRegistry", function () {
  let owner, questAdmin, pauser, upgrader, questSigner, progressRecorder, user, other;
  let xpEngine, badgeMinterMock, questRegistry;

  beforeEach(async function () {
    [owner, questAdmin, pauser, upgrader, questSigner, progressRecorder, user, other] = await ethers.getSigners();

    // Deploy XPEngine as upgradeable (if Initializable/UUPS)
    const XPEngine = await ethers.getContractFactory("XPEngine");
    xpEngine = await upgrades.deployProxy(XPEngine, [], { initializer: "initialize" });
    await xpEngine.waitForDeployment();

    // Deploy MockBadgeMinter
    const MockBadgeMinter = await ethers.getContractFactory("MockBadgeMinter");
    badgeMinterMock = await MockBadgeMinter.deploy();
    await badgeMinterMock.waitForDeployment();

    // Deploy QuestRegistry (upgradeable)
    const QuestRegistry = await ethers.getContractFactory("QuestRegistry");
    questRegistry = await upgrades.deployProxy(
      QuestRegistry,
      [
        owner.address,
        questAdmin.address,
        pauser.address,
        upgrader.address,
        questSigner.address,
        await xpEngine.getAddress(),
        await badgeMinterMock.getAddress()
      ],
      { initializer: "initialize" }
    );
    await questRegistry.waitForDeployment();

    // Grant PROGRESS_RECORDER_ROLE to progressRecorder
    const PROGRESS_RECORDER_ROLE = await questRegistry.PROGRESS_RECORDER_ROLE();
    await questRegistry.grantRole(PROGRESS_RECORDER_ROLE, progressRecorder.address);
  });

  describe("Deployment & Roles", function () {
    it("Should set roles correctly", async function () {
      const QUEST_ADMIN_ROLE = await questRegistry.QUEST_ADMIN_ROLE();
      expect(await questRegistry.hasRole(QUEST_ADMIN_ROLE, questAdmin.address)).to.be.true;

      const PAUSER_ROLE = await questRegistry.PAUSER_ROLE();
      expect(await questRegistry.hasRole(PAUSER_ROLE, pauser.address)).to.be.true;

      const UPGRADER_ROLE = await questRegistry.UPGRADER_ROLE();
      expect(await questRegistry.hasRole(UPGRADER_ROLE, upgrader.address)).to.be.true;

      const QUEST_SIGNER_ROLE = await questRegistry.QUEST_SIGNER_ROLE();
      expect(await questRegistry.hasRole(QUEST_SIGNER_ROLE, questSigner.address)).to.be.true;
    });
  });

  describe("Quest Creation Validation", function () {
    it("Should revert if quest type is NONE", async function () {
        await expect(questRegistry.connect(questAdmin).createQuest(0, "d", "0x", 100, 1, false))
            .to.be.revertedWithCustomError(questRegistry, "InvalidQuestType");
    });

    it("Should revert if description is empty", async function () {
        await expect(questRegistry.connect(questAdmin).createQuest(1, "", "0x", 100, 1, false))
            .to.be.revertedWithCustomError(questRegistry, "EmptyDescription");
    });

    it("Should revert if both XP and badge rewards are zero", async function () {
        await expect(questRegistry.connect(questAdmin).createQuest(1, "d", "0x", 0, 0, false))
            .to.be.revertedWithCustomError(questRegistry, "ZeroXPReward");
    });
  });

  describe("Quest Lifecycle", function () {
    it("Should create a REFERRAL quest", async function () {
      const questType = 1; // REFERRAL
      const description = "Invite 3 friends";
      const parameters = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [3]);
      const xpReward = 100;
      const badgeId = 1;
      const isRepeatable = false;

      await expect(questRegistry.connect(questAdmin).createQuest(
        questType,
        description,
        parameters,
        xpReward,
        badgeId,
        isRepeatable
      )).to.emit(questRegistry, "QuestCreated").withArgs(1, questType, description, xpReward, badgeId, isRepeatable);

      const quest = await questRegistry.getQuest(1);
      expect(quest.id).to.equal(1);
      expect(quest.description).to.equal(description);
      expect(quest.questType).to.equal(questType);
    });

    it("Should allow quest admin to update a quest", async function () {
        const questType = 1; // REFERRAL
        const description = "Invite 3 friends";
        const parameters = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [3]);
        const xpReward = 100;
        const badgeId = 1;
        const isRepeatable = false;

        await questRegistry.connect(questAdmin).createQuest(
            questType,
            description,
            parameters,
            xpReward,
            badgeId,
            isRepeatable
        );

        const newDescription = "Invite 5 friends";
        const newParameters = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [5]);
        const newXpReward = 150;

        await expect(questRegistry.connect(questAdmin).updateQuest(
            1,
            questType,
            newDescription,
            newParameters,
            newXpReward,
            badgeId,
            isRepeatable,
            true
        )).to.emit(questRegistry, "QuestUpdated");

        const updatedQuest = await questRegistry.getQuest(1);
        expect(updatedQuest.description).to.equal(newDescription);
        expect(updatedQuest.xpReward).to.equal(newXpReward);
    });

    it("Should prevent non-admin from updating a quest", async function () {
        const questType = 1; // REFERRAL
        const description = "Invite 3 friends";
        const parameters = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [3]);
        const xpReward = 100;
        const badgeId = 1;
        const isRepeatable = false;

        await questRegistry.connect(questAdmin).createQuest(
            questType,
            description,
            parameters,
            xpReward,
            badgeId,
            isRepeatable
        );

        await expect(questRegistry.connect(other).updateQuest(
            1,
            questType,
            "new description",
            "0x",
            200,
            1,
            false,
            true
        )).to.be.reverted;
    });


    it("Should record progress and complete quest", async function () {
      // Create a REFERRAL quest requiring 3 invites
      const questType = 1; // REFERRAL
      const description = "Invite 3 friends";
      const parameters = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [3]);
      const xpReward = 100;
      const badgeId = 1;
      const isRepeatable = false;

      await questRegistry.connect(questAdmin).createQuest(
        questType,
        description,
        parameters,
        xpReward,
        badgeId,
        isRepeatable
      );

      // Record partial progress
      await questRegistry.connect(progressRecorder).recordProgress(user.address, 1, 2);
      let progress = await questRegistry.userQuestProgress(user.address, 1);
      expect(progress).to.equal(2);

      // Complete the quest
      await expect(questRegistry.connect(progressRecorder).recordProgress(user.address, 1, 1))
        .to.emit(questRegistry, "QuestCompleted")
        .withArgs(user.address, 1, xpReward, badgeId);

      // User quest completion should now be true
      const completed = await questRegistry.userQuestCompleted(user.address, 1);
      expect(completed).to.be.true;
    });

    it("Should complete a CUSTOM quest with a valid signature", async function () {
        const questType = 4; // CUSTOM
        const description = "A custom quest";
        const parameters = "0x";
        const xpReward = 50;
        const badgeId = 2;
        const isRepeatable = true;

        await questRegistry.connect(questAdmin).createQuest(questType, description, parameters, xpReward, badgeId, isRepeatable);

        const questId = 1;
        const messageHash = ethers.solidityPackedKeccak256(["address", "uint256", "address"], [await questRegistry.getAddress(), questId, user.address]);
        const signature = await questSigner.signMessage(ethers.getBytes(messageHash));

        await expect(questRegistry.connect(user).completeQuest(user.address, questId, signature))
            .to.emit(questRegistry, "QuestCompleted").withArgs(user.address, questId, xpReward, badgeId);
    });

    it("Should revert CUSTOM quest completion with an invalid signature", async function () {
        const questType = 4; // CUSTOM
        const description = "A custom quest";
        const parameters = "0x";
        const xpReward = 50;
        const badgeId = 2;
        const isRepeatable = true;

        await questRegistry.connect(questAdmin).createQuest(questType, description, parameters, xpReward, badgeId, isRepeatable);

        const questId = 1;
        const messageHash = ethers.solidityPackedKeccak256(["address", "uint256", "address"], [await questRegistry.getAddress(), questId, user.address]);
        const signature = await other.signMessage(ethers.getBytes(messageHash)); // Signed by wrong person

        await expect(questRegistry.connect(user).completeQuest(user.address, questId, signature))
            .to.be.revertedWithCustomError(questRegistry, "InvalidSigner");
    });
  });

  describe("Pause & Unpause", function () {
    it("Should allow pauser to pause and unpause", async function () {
      await questRegistry.connect(pauser).pause();
      expect(await questRegistry.paused()).to.be.true;

      await questRegistry.connect(pauser).unpause();
      expect(await questRegistry.paused()).to.be.false;
    });
  });
});
