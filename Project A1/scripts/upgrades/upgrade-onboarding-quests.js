const { ethers, upgrades } = require("hardhat");

async function main() {
  const OnboardingQuestsV2 = await ethers.getContractFactory("OnboardingQuestsV2");
  const onboardingQuests = await upgrades.upgradeProxy("0x4F16D66F3c183A27A56980f552267eB6344F6d83", OnboardingQuestsV2);
  console.log("OnboardingQuests upgraded");

  await onboardingQuests.initializeV2();
  console.log("OnboardingQuestsV2 initialized");
}

main();
