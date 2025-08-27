// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IXPEngine {
    function awardXP(address _user, uint256 _amount) external;
}

interface IBadgeMinter {
    function mintBadge(address _to, string memory _tokenURI) external returns (uint256);
}

/**
 * @title QuestRegistry
 * @dev Manages the definition and tracking of quests and achievements.
 */
contract QuestRegistry is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    bytes32 public constant QUEST_ADMIN_ROLE = keccak256("QUEST_ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant PROGRESS_RECORDER_ROLE = keccak256("PROGRESS_RECORDER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant QUEST_SIGNER_ROLE = keccak256("QUEST_SIGNER_ROLE");

    enum QuestType {
        NONE,
        REFERRAL,
        DAO_VOTE,
        BADGE_MINT,
        CUSTOM // For quests triggered by a signature from a trusted backend
    }

    struct Quest {
        uint256 id;
        uint256 xpReward;
        uint256 badgeIdReward; // 0 if no badge reward
        QuestType questType;
        bool isRepeatable;
        bool isActive;
        string description;
        bytes parameters; // ABI-encoded parameters specific to the quest type
    }

    mapping(uint256 => Quest) public quests;

    // userAddress => questId => progress (e.g., count of referrals, amount staked)
    mapping(address => mapping(uint256 => uint256)) public userQuestProgress;
    mapping(address => mapping(uint256 => bool)) public userQuestCompleted;

    uint256 private _nextQuestId;

    IXPEngine public xpEngine;
    IBadgeMinter public badgeMinter;

    // Custom Errors
    error QuestDoesNotExist(uint256 questId);
    error ZeroXPReward();
    error EmptyDescription();
    error InvalidQuestType();
    error QuestAlreadyExists(uint256 questId);
    error QuestNotActive(uint256 questId);
    error QuestAlreadyCompleted(uint256 questId);
    error QuestNotRepeatable(uint256 questId);
    error InsufficientProgress(uint256 required, uint256 current);
    error InvalidQuestParameters();
    error InvalidSigner();

    event QuestCreated(
        uint256 indexed questId,
        QuestType questType,
        string description,
        uint256 xpReward,
        uint256 badgeIdReward,
        bool isRepeatable
    );
    event QuestUpdated(
        uint256 indexed questId,
        QuestType questType,
        string description,
        uint256 xpReward,
        uint256 badgeIdReward,
        bool isRepeatable,
        bool isActive
    );
    event QuestProgressUpdated(
        address indexed user,
        uint256 indexed questId,
        uint256 newProgress
    );
    event QuestCompleted(
        address indexed user,
        uint256 indexed questId,
        uint256 xpAwarded,
        uint256 badgeIdMinted
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _defaultAdmin,
        address _questAdmin,
        address _pauser,
        address _upgrader,
        address _questSigner,
        address _xpEngineAddress,
        address _badgeMinterAddress
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(PAUSER_ROLE, _pauser);
        _grantRole(QUEST_ADMIN_ROLE, _questAdmin);
        _grantRole(UPGRADER_ROLE, _upgrader);
        _grantRole(QUEST_SIGNER_ROLE, _questSigner);

        xpEngine = IXPEngine(_xpEngineAddress);
        badgeMinter = IBadgeMinter(_badgeMinterAddress);
        _nextQuestId = 1; // Initialize with 1 to avoid 0 as a valid quest ID
    }

    /**
     * @notice Authorizes an upgrade to a new implementation
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /**
     * @dev Creates a new quest definition.
     * Only accounts with the QUEST_ADMIN_ROLE can call this.
     */
    function createQuest(
        QuestType _questType,
        string memory _description,
        bytes memory _parameters,
        uint256 _xpReward,
        uint256 _badgeIdReward,
        bool _isRepeatable
    ) external onlyRole(QUEST_ADMIN_ROLE) whenNotPaused {
        if (_questType == QuestType.NONE) revert InvalidQuestType();
        if (bytes(_description).length == 0) revert EmptyDescription();
        if (_xpReward == 0 && _badgeIdReward == 0) revert ZeroXPReward(); // Must have some reward

        uint256 questId = _nextQuestId++;
        quests[questId] = Quest({
            id: questId,
            questType: _questType,
            description: _description,
            parameters: _parameters,
            xpReward: _xpReward,
            badgeIdReward: _badgeIdReward,
            isRepeatable: _isRepeatable,
            isActive: true // Quests are active by default upon creation
        });

        emit QuestCreated(
            questId,
            _questType,
            _description,
            _xpReward,
            _badgeIdReward,
            _isRepeatable
        );
    }

    /**
     * @dev Updates an existing quest definition.
     * Only accounts with the QUEST_ADMIN_ROLE can call this.
     */
    function updateQuest(
        uint256 _questId,
        QuestType _questType,
        string memory _description,
        bytes memory _parameters,
        uint256 _xpReward,
        uint256 _badgeIdReward,
        bool _isRepeatable,
        bool _isActive
    ) external onlyRole(QUEST_ADMIN_ROLE) whenNotPaused {
        if (quests[_questId].id == 0) revert QuestDoesNotExist(_questId);
        if (_questType == QuestType.NONE) revert InvalidQuestType();
        if (bytes(_description).length == 0) revert EmptyDescription();
        if (_xpReward == 0 && _badgeIdReward == 0) revert ZeroXPReward();

        quests[_questId].questType = _questType;
        quests[_questId].description = _description;
        quests[_questId].parameters = _parameters;
        quests[_questId].xpReward = _xpReward;
        quests[_questId].badgeIdReward = _badgeIdReward;
        quests[_questId].isRepeatable = _isRepeatable;
        quests[_questId].isActive = _isActive;

        emit QuestUpdated(
            _questId,
            _questType,
            _description,
            _xpReward,
            _badgeIdReward,
            _isRepeatable,
            _isActive
        );
    }

    /**
     * @dev Records progress for a user on a specific quest.
     * This function is intended to be called by other contracts (e.g., ReferralEngine, CommunityDAO).
     */
    function recordProgress(address _user, uint256 _questId, uint256 _progressAmount) external onlyRole(PROGRESS_RECORDER_ROLE) whenNotPaused nonReentrant {
        if (quests[_questId].id == 0) revert QuestDoesNotExist(_questId);
        if (!quests[_questId].isActive) revert QuestNotActive(_questId);
        if (!quests[_questId].isRepeatable && userQuestCompleted[_user][_questId]) revert QuestAlreadyCompleted(_questId);

        userQuestProgress[_user][_questId] += _progressAmount;
        emit QuestProgressUpdated(_user, _questId, userQuestProgress[_user][_questId]);

        // Check for completion after updating progress
        checkAndCompleteQuest(_user, _questId);
    }

    /**
     * @dev Completes a quest for a user, typically for CUSTOM quest types requiring off-chain validation.
     * This function requires a valid signature from a QUEST_SIGNER_ROLE.
     * @param _user The address of the user completing the quest.
     * @param _questId The ID of the quest to complete.
     * @param _signature The signature from a trusted signer.
     */
    function completeQuest(address _user, uint256 _questId, bytes memory _signature) external whenNotPaused nonReentrant {
        Quest storage quest = quests[_questId];
        if (quest.id == 0) revert QuestDoesNotExist(_questId);
        if (quest.questType != QuestType.CUSTOM) revert InvalidQuestType();

        address signer = _verifySignature(_questId, _user, _signature);
        if (!hasRole(QUEST_SIGNER_ROLE, signer)) {
            revert InvalidSigner();
        }

        // For CUSTOM quests, the signature is the proof. We pass true to the internal completion function.
        _awardRewards(_user, _questId);
    }

    /**
     * @dev Internal function to check if a quest is completed based on its type and progress.
     * This is called by recordProgress.
     */
    function checkAndCompleteQuest(address _user, uint256 _questId) public whenNotPaused {
        Quest storage quest = quests[_questId];
        if (quest.id == 0) revert QuestDoesNotExist(_questId);
        if (!quest.isActive) revert QuestNotActive(_questId);
        if (!quest.isRepeatable && userQuestCompleted[_user][_questId]) revert QuestAlreadyCompleted(_questId);

        bool completed = false;
        uint256 requiredProgress;

        if (quest.questType == QuestType.REFERRAL) {
            (requiredProgress) = abi.decode(quest.parameters, (uint256));
            if (userQuestProgress[_user][_questId] >= requiredProgress) {
                completed = true;
            } else {
                revert InsufficientProgress(requiredProgress, userQuestProgress[_user][_questId]);
            }
        } else if (quest.questType == QuestType.DAO_VOTE) {
            (requiredProgress) = abi.decode(quest.parameters, (uint256));
            if (userQuestProgress[_user][_questId] >= requiredProgress) {
                completed = true;
            } else {
                revert InsufficientProgress(requiredProgress, userQuestProgress[_user][_questId]);
            }
        } else if (quest.questType == QuestType.BADGE_MINT) {
            (, requiredProgress) = abi.decode(quest.parameters, (uint256, uint256));
            if (userQuestProgress[_user][_questId] >= requiredProgress) {
                completed = true;
            } else {
                revert InsufficientProgress(requiredProgress, userQuestProgress[_user][_questId]);
            }
        } else if (quest.questType == QuestType.CUSTOM) {
            if (userQuestProgress[_user][_questId] >= 1) {
                completed = true;
            }
        }

        if (completed) {
            _awardRewards(_user, _questId);
        }
    }

    /**
     * @dev Internal function to grant rewards to a user.
     */
    function _awardRewards(address _user, uint256 _questId) internal {
        Quest storage quest = quests[_questId]; // Re-read storage pointer

        // Award XP
        if (quest.xpReward > 0) {
            xpEngine.awardXP(_user, quest.xpReward);
        }

        // Mint Badge
        if (quest.badgeIdReward > 0) {
            badgeMinter.mintBadge(_user, string(abi.encodePacked("ipfs://questbadge/", Strings.toString(quest.badgeIdReward))));
        }

        if (!quest.isRepeatable) {
            userQuestCompleted[_user][_questId] = true;
        }

        emit QuestCompleted(_user, _questId, quest.xpReward, quest.badgeIdReward);
    }

    /**
     * @dev Verifies the signature for a quest completion.
     */
    function _verifySignature(uint256 _questId, address _user, bytes memory _signature) internal view returns (address) {
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(abi.encodePacked(address(this), _questId, _user));
        return ECDSA.recover(messageHash, _signature);
    }

    /**
     * @dev Returns the details of a specific quest.
     * @param _questId The ID of the quest.
     * @return The Quest struct.
     */
    function getQuest(uint256 _questId) external view returns (Quest memory) {
        if (quests[_questId].id == 0) revert QuestDoesNotExist(_questId);
        return quests[_questId];
    }

    /**
     * @dev Returns a paginated list of all quests.
     * @param _offset The starting index for pagination.
     * @param _limit The maximum number of quests to return.
     * @return An array of Quest structs.
     */
    function getAllQuests(uint256 _offset, uint256 _limit) external view returns (Quest[] memory) {
        uint256 questCount = _nextQuestId - 1;
        if (_offset >= questCount) {
            return new Quest[](0);
        }

        uint256 limit = _limit;
        if (_offset + _limit > questCount) {
            limit = questCount - _offset;
        }

        Quest[] memory allQuests = new Quest[](limit);
        for (uint256 i = 0; i < limit; i++) {
            allQuests[i] = quests[_offset + i + 1];
        }
        return allQuests;
    }

    /**
     * @dev Pauses the contract.
     * Only accounts with the PAUSER_ROLE can call this.
     */
    function pause() public onlyRole(PAUSER_ROLE) { // Line 209
        _pause();
    }

    /**
     * @dev Unpauses the contract.
     * Only accounts with the PAUSER_ROLE can call this.
     */
    function unpause() public onlyRole(PAUSER_ROLE) { // Line 218
        _unpause();
    }

    
}