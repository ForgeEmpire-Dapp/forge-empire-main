// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockForgeUtilityManager {
    struct UserUtility {
        uint32 stakingPower;
        uint32 governancePower;
        uint8 premiumTier;
        bool isPremium;
    }
    
    mapping(address => UserUtility) public userUtilities;
    mapping(address => uint256) public governanceParticipation;
    
    bool public premiumFeaturesEnabled;
    bool public stakingEnabled;
    
    constructor() {
        premiumFeaturesEnabled = true;
        stakingEnabled = true;
    }
    
    function updateUserUtility(address user) external {
        // Mock utility update - set some default values
        userUtilities[user] = UserUtility({
            stakingPower: 150,
            governancePower: 120,
            premiumTier: 1,
            isPremium: true
        });
    }
    
    function recordGovernanceParticipation(address user, uint256 participationWeight) external {
        governanceParticipation[user] += participationWeight;
        
        // Update governance power based on participation
        userUtilities[user].governancePower += uint32(participationWeight / 10);
    }
    
    function getUserUtility(address user) external view returns (uint32, uint32, uint8, bool) {
        UserUtility memory utility = userUtilities[user];
        return (
            utility.stakingPower == 0 ? 100 : utility.stakingPower,
            utility.governancePower == 0 ? 100 : utility.governancePower,
            utility.premiumTier,
            utility.isPremium
        );
    }
    
    function setPremiumFeaturesEnabled(bool enabled) external {
        premiumFeaturesEnabled = enabled;
    }
    
    function setStakingEnabled(bool enabled) external {
        stakingEnabled = enabled;
    }
}