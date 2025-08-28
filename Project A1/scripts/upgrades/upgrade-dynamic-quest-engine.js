const { ethers, upgrades } = require("hardhat");

async function main() {
  const DynamicQuestEngineV2 = await ethers.getContractFactory("DynamicQuestEngineV2");
  const dynamicQuestEngine = await upgrades.upgradeProxy("0x5f6bA70b9D6832c857Fe443042a6006E325f032f", DynamicQuestEngineV2);
  console.log("DynamicQuestEngine upgraded");

  await dynamicQuestEngine.initializeV2();
  console.log("DynamicQuestEngineV2 initialized");
}

main();
