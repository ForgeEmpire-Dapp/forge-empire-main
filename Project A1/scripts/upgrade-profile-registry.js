const { ethers, upgrades } = require("hardhat");

async function main() {
  // IMPORTANT: Replace with the actual address of your ProfileRegistry proxy
  const PROXY_ADDRESS = "0x7eaec5746077a31a167a1E0497b2188AE03294Ba"; 

  console.log(`Upgrading QuestRegistry at proxy: ${PROXY_ADDRESS}`);

  const QuestRegistry = await ethers.getContractFactory("ProfileRegistryV2");
  const upgradedProfileRegistry = await upgrades.upgradeProxy(PROXY_ADDRESS, ProfileRegistryV2);

  console.log("QuestRegistry upgraded successfully");
  console.log("New implementation address:", await upgrades.erc1967.getImplementationAddress(await upgradedQuestRegistry.getAddress()));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });