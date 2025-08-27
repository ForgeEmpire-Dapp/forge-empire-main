const { ethers } = require("hardhat");

async function main() {
  // IMPORTANT: Replace with the actual address of your new QuestRegistry proxy
  const PROXY_ADDRESS = "0x44b45cE9DAb6FA4d652B417d7279bA6b6b05D337"; 
  const [signer] = await ethers.getSigners();

  console.log(`Verifying upgrade for QuestRegistry at proxy: ${PROXY_ADDRESS}`);

  const QuestRegistry = await ethers.getContractAt("QuestRegistry", PROXY_ADDRESS);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });