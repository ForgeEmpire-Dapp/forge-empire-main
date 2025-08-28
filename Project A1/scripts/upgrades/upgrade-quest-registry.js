const { ethers, upgrades } = require("hardhat");

async function main() {
  const QuestRegistryV2 = await ethers.getContractFactory("QuestRegistryV2");
  const questRegistry = await upgrades.upgradeProxy("0x1200312ADF5f85E21Cb15A8008145a3dba65B159", QuestRegistryV2);
  console.log("QuestRegistry upgraded");

  await questRegistry.initializeV2();
  console.log("QuestRegistryV2 initialized");
}

main();
