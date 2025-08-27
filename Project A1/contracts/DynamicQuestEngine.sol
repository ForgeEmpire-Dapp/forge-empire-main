// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IXPEngine.sol";

/**
 * @title DynamicQuestEngine
 * @dev Advanced quest generation system that creates personalized quests based on user behavior and preferences
 */
contract DynamicQuestEngine is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant QUEST_MANAGER_ROLE = keccak256("QUEST_MANAGER_ROLE");
    bytes32 public constant ALGORITHM_UPDATER_ROLE = keccak256("ALGORITHM_UPDATER_ROLE");

    // Quest difficulty levels
    enum Difficulty { EASY, MEDIUM, HARD, EPIC, LEGENDARY }
    
    // Quest categories
    enum Category { 
        TRADING,      // DEX trading, swaps, liquidity
        SOCIAL,       // Following, posting, engaging
        GOVERNANCE,   // Voting, proposals, participation
        STAKING,      // Token staking, yield farming
        GUILD,        // Guild activities, collaboration
        LEARNING,     // Educational content, tutorials
        BRIDGE,       // Cross-chain activities
        NFT,          // NFT trading, collection
        DEFI,         // DeFi protocols, lending
        GAMING        // Gaming activities, achievements
    }

    // Quest types for generation
    enum QuestType {
        ACHIEVEMENT,     // Complete X actions
        COLLECTION,      // Collect X items/tokens
        SOCIAL_REACH,    // Reach X followers/likes
        TIME_BASED,      // Complete within timeframe
        COLLABORATION,   // Work with others
        SKILL_BASED,     // Demonstrate skill level
        EXPLORATION,     // Try new features/protocols
        MILESTONE,       // Reach specific milestone
        CREATIVE,        // Create content/NFTs
        COMPETITIVE      // Compete in leaderboards
    }

    struct QuestTemplate {
        uint256 id;
        string name;
        string description;
        Category category;
        QuestType questType;
        Difficulty difficulty;
        uint256 baseReward;
        uint256 timeLimit;
        uint256[] parameters; // Flexible parameters for quest logic
        string[] requirements; // Human-readable requirements
        bool isActive;
        uint256 popularity; // How often this template is used
        uint256 successRate; // Percentage of users who complete it
    }

    struct GeneratedQuest {
        uint256 id;
        uint256 templateId;
        address user;
        string personalizedName;
        string personalizedDescription;
        uint256 targetValue;
        uint256 currentProgress;
        uint256 reward;
        uint256 startTime;
        uint256 deadline;
        bool isCompleted;
        bool isClaimed;
        uint256[] customParameters;
    }

    struct UserProfile {
        uint256 level;
        uint256 totalXP;
        Category[] preferredCategories;
        Difficulty preferredDifficulty;
        uint256 completedQuests;
        uint256 failedQuests;
        uint256 averageCompletionTime;
        uint256 lastActivityTime;
        uint256 lastAutoQuestTime;
        mapping(Category => uint256) categoryExperience;
        mapping(QuestType => uint256) questTypeSuccess;
        uint256[] completedTemplates;
        bool isActive;
    }

    struct PersonalizationWeights {
        uint256 levelWeight;          // Weight based on user level
        uint256 categoryWeight;       // Weight based on preferred categories
        uint256 successRateWeight;    // Weight based on historical success
        uint256 timeWeight;          // Weight based on activity timing
        uint256 diversityWeight;     // Weight for trying new quest types
        uint256 difficultyWeight;    // Weight based on preferred difficulty
    }

    // State variables
    mapping(uint256 => QuestTemplate) public questTemplates;
    mapping(uint256 => GeneratedQuest) public generatedQuests;
    mapping(address => UserProfile) public userProfiles;
    mapping(address => uint256[]) public userActiveQuests;
    mapping(address => uint256[]) public userCompletedQuests;
    
    uint256 public nextTemplateId;
    uint256 public nextQuestId;
    uint256 public maxActiveQuests;
    PersonalizationWeights public weights;
    
    IXPEngine public xpEngine;
    
    // Events
    event QuestTemplateCreated(uint256 indexed templateId, string name, Category category);
    event QuestGenerated(uint256 indexed questId, address indexed user, uint256 templateId);
    event QuestCompleted(uint256 indexed questId, address indexed user, uint256 reward);
    event QuestClaimed(uint256 indexed questId, address indexed user, uint256 reward);
    event UserProfileUpdated(address indexed user, uint256 level, uint256 totalXP);
    event PersonalizationWeightsUpdated();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _xpEngine,
        uint256 _maxActiveQuests
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(QUEST_MANAGER_ROLE, msg.sender);
        _grantRole(QUEST_MANAGER_ROLE, address(this));
        _grantRole(ALGORITHM_UPDATER_ROLE, msg.sender);

        xpEngine = IXPEngine(_xpEngine);
        maxActiveQuests = _maxActiveQuests;
        nextTemplateId = 1;
        nextQuestId = 1;

        // Initialize default personalization weights
        weights = PersonalizationWeights({
            levelWeight: 25,
            categoryWeight: 20,
            successRateWeight: 20,
            timeWeight: 10,
            diversityWeight: 15,
            difficultyWeight: 10
        });
    }

    /**
     * @dev Create a new quest template
     */
    function createQuestTemplate(
        string memory _name,
        string memory _description,
        Category _category,
        QuestType _questType,
        Difficulty _difficulty,
        uint256 _baseReward,
        uint256 _timeLimit,
        uint256[] memory _parameters,
        string[] memory _requirements
    ) external onlyRole(QUEST_MANAGER_ROLE) {
        uint256 templateId = nextTemplateId++;
        
        questTemplates[templateId] = QuestTemplate({
            id: templateId,
            name: _name,
            description: _description,
            category: _category,
            questType: _questType,
            difficulty: _difficulty,
            baseReward: _baseReward,
            timeLimit: _timeLimit,
            parameters: _parameters,
            requirements: _requirements,
            isActive: true,
            popularity: 0,
            successRate: 50 // Start with 50% assumption
        });

        emit QuestTemplateCreated(templateId, _name, _category);
    }

    function updateQuestTemplate(uint256 _templateId, bool _isActive) external onlyRole(QUEST_MANAGER_ROLE) {
        questTemplates[_templateId].isActive = _isActive;
    }

    /**
     * @dev Generate personalized quests for a user
     */
    function generateQuestsForUser(address _user, uint256 _count) 
        external 
        onlyRole(QUEST_MANAGER_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(_count > 0 && _count <= 5, "Invalid quest count");
        require(userActiveQuests[_user].length + _count <= maxActiveQuests, "Too many active quests");

        _updateUserProfile(_user);

        uint256[] memory selectedTemplates = _selectQuestTemplates(_user, _count);
        
        for (uint256 i = 0; i < selectedTemplates.length; i++) {
            _generatePersonalizedQuest(_user, selectedTemplates[i]);
        }
    }

    /**
     * @dev Auto-generate quests based on user activity patterns
     */
    function autoGenerateQuests(address _user) external whenNotPaused {
    require(msg.sender == _user || hasRole(QUEST_MANAGER_ROLE, msg.sender), "Unauthorized");

    _updateUserProfile(_user);
    UserProfile storage profile = userProfiles[_user];

    // Optional: Cooldown period (e.g. 6 hours) to prevent abuse
    uint256 cooldownPeriod = 6 hours;
    require(
        block.timestamp >= profile.lastAutoQuestTime + cooldownPeriod,
        "Quest generation is on cooldown"
    );

    // Only auto-generate if user has few active quests
    if (userActiveQuests[_user].length < 2) {
        uint256 questsToGenerate = 3 - userActiveQuests[_user].length;
        uint256[] memory selectedTemplates = _selectQuestTemplates(_user, questsToGenerate);

        for (uint256 i = 0; i < selectedTemplates.length; i++) {
            if (selectedTemplates[i] != 0) {
                _generatePersonalizedQuest(_user, selectedTemplates[i]);
            }
        }

        // Update last auto quest generation time
        profile.lastAutoQuestTime = block.timestamp;
    }
}

    /**
     * @dev Complete a quest (called by external systems)
     */
    function completeQuest(
        uint256 _questId, 
        address _user, 
        uint256 _finalValue
    ) external onlyRole(QUEST_MANAGER_ROLE) nonReentrant {
        GeneratedQuest storage quest = generatedQuests[_questId];
        require(quest.user == _user, "Invalid user");
        require(!quest.isCompleted, "Quest already completed");
        require(block.timestamp <= quest.deadline, "Quest expired");
        require(_finalValue >= quest.targetValue, "Target not reached");

        quest.currentProgress = _finalValue;
        quest.isCompleted = true;

        // Update template success rate
        QuestTemplate storage template = questTemplates[quest.templateId];
        template.successRate = (template.successRate * template.popularity + 100) / (template.popularity + 1);
        template.popularity++;

        // Update user profile
        _updateQuestCompletion(_user, quest.templateId, true);

        // Remove from active quests
        _removeFromActiveQuests(_user, _questId);
        userCompletedQuests[_user].push(_questId);

        emit QuestCompleted(_questId, _user, quest.reward);
    }

    /**
     * @dev Claim quest rewards
     */
    function claimQuestReward(uint256 _questId) external nonReentrant {
        GeneratedQuest storage quest = generatedQuests[_questId];
        require(quest.user == msg.sender, "Not quest owner");
        require(quest.isCompleted, "Quest not completed");
        require(!quest.isClaimed, "Reward already claimed");

        quest.isClaimed = true;

        // Award XP through XP Engine
        xpEngine.awardXP(msg.sender, quest.reward);

        emit QuestClaimed(_questId, msg.sender, quest.reward);
    }

    /**
     * @dev Update quest progress (called by external systems)
     */
    function updateQuestProgress(
        uint256 _questId, 
        address _user, 
        uint256 _newProgress
    ) external onlyRole(QUEST_MANAGER_ROLE) {
        GeneratedQuest storage quest = generatedQuests[_questId];
        require(quest.user == _user, "Invalid user");
        require(!quest.isCompleted, "Quest already completed");
        require(block.timestamp <= quest.deadline, "Quest expired");

        quest.currentProgress = _newProgress;

        // Auto-complete if target reached
        if (_newProgress >= quest.targetValue) {
            this.completeQuest(_questId, _user, _newProgress);
        }
    }

    /**
     * @dev Select appropriate quest templates for a user
     */
    function _selectQuestTemplates(address _user, uint256 _count) 
        internal 
        view 
        returns (uint256[] memory) 
    {
        if (nextTemplateId == 1) {
            return new uint256[](0);
        }

        uint256[] memory scores = new uint256[](nextTemplateId - 1);
        uint256[] memory templateIds = new uint256[](_count);
        
        // Calculate personalization scores for each template
        for (uint256 i = 1; i < nextTemplateId; i++) {
            if (!questTemplates[i].isActive) continue;
            scores[i-1] = _calculatePersonalizationScore(_user, i);
        }

        // Select top scoring templates (simplified selection)
        for (uint256 i = 0; i < _count && i < nextTemplateId - 1; i++) {
            uint256 maxScore = 0;
            uint256 selectedIndex = 0;
            
            for (uint256 j = 0; j < nextTemplateId - 1; j++) {
                if (scores[j] > maxScore) {
                    maxScore = scores[j];
                    selectedIndex = j;
                }
            }
            
            templateIds[i] = selectedIndex + 1;
            scores[selectedIndex] = 0; // Remove from next selection
        }

        return templateIds;
    }

    /**
     * @dev Calculate personalization score for a quest template
     */
    function _calculatePersonalizationScore(address _user, uint256 _templateId) 
        internal 
        view 
        returns (uint256) 
    {
        UserProfile storage profile = userProfiles[_user];
        QuestTemplate storage template = questTemplates[_templateId];
        
        uint256 score = 0;
        
        // Level-based scoring
        uint256 levelScore = _calculateLevelScore(profile.level, template.difficulty);
        score += (levelScore * weights.levelWeight) / 100;
        
        // Category preference scoring
        uint256 categoryScore = _calculateCategoryScore(_user, template.category);
        score += (categoryScore * weights.categoryWeight) / 100;
        
        // Success rate scoring
        uint256 successScore = template.successRate;
        score += (successScore * weights.successRateWeight) / 100;
        
        // Diversity scoring (encourage trying new quest types)
        uint256 diversityScore = _calculateDiversityScore(_user, template.questType);
        score += (diversityScore * weights.diversityWeight) / 100;
        
        return score;
    }

    /**
     * @dev Calculate level-based score for difficulty matching
     */
    function _calculateLevelScore(uint256 _userLevel, Difficulty _difficulty) 
        internal 
        pure 
        returns (uint256) 
    {
        uint256 idealLevel;
        
        if (_difficulty == Difficulty.EASY) idealLevel = 5;
        else if (_difficulty == Difficulty.MEDIUM) idealLevel = 15;
        else if (_difficulty == Difficulty.HARD) idealLevel = 30;
        else if (_difficulty == Difficulty.EPIC) idealLevel = 50;
        else idealLevel = 80; // LEGENDARY
        
        // Score based on how close user level is to ideal level
        uint256 diff = _userLevel > idealLevel ? _userLevel - idealLevel : idealLevel - _userLevel;
        return diff > 20 ? 20 : 100 - (diff * 4);
    }

    /**
     * @dev Calculate category preference score 
     */
    function _calculateCategoryScore(address _user, Category _category) 
        internal 
        view 
        returns (uint256) 
    {
        UserProfile storage profile = userProfiles[_user];
        uint256 categoryXP = profile.categoryExperience[_category];
        
        // Higher score for categories user has experience in
        if (categoryXP > 1000) return 90;
        else if (categoryXP > 500) return 75;
        else if (categoryXP > 100) return 60;
        else return 40; // Encourage trying new categories
    }

    /**
     * @dev Calculate diversity score to encourage variety
     */
    function _calculateDiversityScore(address _user, QuestType _questType) 
        internal 
        view 
        returns (uint256) 
    {
        UserProfile storage profile = userProfiles[_user];
        uint256 typeSuccess = profile.questTypeSuccess[_questType];
        
        // Higher score for less attempted quest types
        if (typeSuccess == 0) return 80; // New type
        else if (typeSuccess < 3) return 70;
        else if (typeSuccess < 10) return 60;
        else return 40; // Frequently attempted
    }

    /**
     * @dev Generate a personalized quest from template
     */
    function _generatePersonalizedQuest(address _user, uint256 _templateId) internal {
        QuestTemplate storage template = questTemplates[_templateId];
        UserProfile storage profile = userProfiles[_user];
        
        uint256 questId = nextQuestId++;
        
        // Personalize difficulty and rewards based on user level
        uint256 personalizedReward = _calculatePersonalizedReward(template.baseReward, profile.level);
        uint256 personalizedTarget = 0;
        if (template.parameters.length > 0) {
            personalizedTarget = _calculatePersonalizedTarget(template.parameters[0], profile.level);
        }
        
        generatedQuests[questId] = GeneratedQuest({
            id: questId,
            templateId: _templateId,
            user: _user,
            personalizedName: template.name,
            personalizedDescription: template.description,
            targetValue: personalizedTarget,
            currentProgress: 0,
            reward: personalizedReward,
            startTime: block.timestamp,
            deadline: block.timestamp + template.timeLimit,
            isCompleted: false,
            isClaimed: false,
            customParameters: template.parameters
        });

        userActiveQuests[_user].push(questId);
        
        emit QuestGenerated(questId, _user, _templateId);
    }

    /**
     * @dev Calculate personalized reward based on user level
     */
    function _calculatePersonalizedReward(uint256 _baseReward, uint256 _userLevel) 
        internal 
        pure 
        returns (uint256) 
    {
        // Scale reward based on user level (50-150% of base)
        uint256 multiplier = 50 + (_userLevel * 2);
        if (multiplier > 150) multiplier = 150;
        
        return (_baseReward * multiplier) / 100;
    }

    /**
     * @dev Calculate personalized target based on user level
     */
    function _calculatePersonalizedTarget(uint256 _baseTarget, uint256 _userLevel) 
        internal 
        pure 
        returns (uint256) 
    {
        // Scale target based on user level (75-125% of base)
        uint256 multiplier = 75 + (_userLevel / 2);
        if (multiplier > 125) multiplier = 125;
        
        return (_baseTarget * multiplier) / 100;
    }

    /**
     * @dev Update user profile based on current state
     */
    function _updateUserProfile(address _user) internal {
        UserProfile storage profile = userProfiles[_user];
        
        // Get current XP from XP Engine
        uint256 currentXP = xpEngine.getXP(_user);
        uint256 currentLevel = xpEngine.getLevel(_user);
        
        if (currentXP != profile.totalXP || !profile.isActive) {
            profile.totalXP = currentXP;
            profile.level = currentXP == 0 ? 0 : currentLevel;
            profile.lastActivityTime = block.timestamp;
            profile.isActive = true;
            
            emit UserProfileUpdated(_user, profile.level, currentXP);
        }
    }

    /**
     * @dev Update quest completion statistics
     */
    function _updateQuestCompletion(address _user, uint256 _templateId, bool _success) internal {
        UserProfile storage profile = userProfiles[_user];
        QuestTemplate storage template = questTemplates[_templateId];
        
        if (_success) {
            profile.completedQuests++;
            profile.categoryExperience[template.category] += template.baseReward / 10;
            profile.questTypeSuccess[template.questType]++;
        } else {
            profile.failedQuests++;
        }
        
        profile.completedTemplates.push(_templateId);
    }

    /**
     * @dev Remove quest from user's active quests
     */
    function _removeFromActiveQuests(address _user, uint256 _questId) internal {
        uint256[] storage activeQuests = userActiveQuests[_user];
        
        for (uint256 i = 0; i < activeQuests.length; i++) {
            if (activeQuests[i] == _questId) {
                activeQuests[i] = activeQuests[activeQuests.length - 1];
                activeQuests.pop();
                break;
            }
        }
    }

    // View functions
    function getUserActiveQuests(address _user) external view returns (uint256[] memory) {
        return userActiveQuests[_user];
    }

    function getUserCompletedQuests(address _user) external view returns (uint256[] memory) {
        return userCompletedQuests[_user];
    }

    function getQuestTemplate(uint256 _templateId) external view returns (QuestTemplate memory) {
        return questTemplates[_templateId];
    }

    function getGeneratedQuest(uint256 _questId) external view returns (GeneratedQuest memory) {
        return generatedQuests[_questId];
    }

    // Admin functions
    function updatePersonalizationWeights(
        uint256 _levelWeight,
        uint256 _categoryWeight,
        uint256 _successRateWeight,
        uint256 _timeWeight,
        uint256 _diversityWeight,
        uint256 _difficultyWeight
    ) external onlyRole(ALGORITHM_UPDATER_ROLE) {
        require(_levelWeight + _categoryWeight + _successRateWeight + 
               _timeWeight + _diversityWeight + _difficultyWeight == 100, 
               "Weights must sum to 100");
        
        weights = PersonalizationWeights({
            levelWeight: _levelWeight,
            categoryWeight: _categoryWeight,
            successRateWeight: _successRateWeight,
            timeWeight: _timeWeight,
            diversityWeight: _diversityWeight,
            difficultyWeight: _difficultyWeight
        });

        emit PersonalizationWeightsUpdated();
    }

    function pauseQuesting() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpauseQuesting() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function updateMaxActiveQuests(uint256 _maxActiveQuests) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxActiveQuests = _maxActiveQuests;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}