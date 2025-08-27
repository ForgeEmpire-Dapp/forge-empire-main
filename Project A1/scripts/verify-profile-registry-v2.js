const { run } = require("hardhat");

async function main() {
  // IMPORTANT: Replace with the actual address of your new ProfileRegistryV2 implementation contract
  const IMPLEMENTATION_ADDRESS = "0x44b45cE9DAb6FA4d652B417d7279bA6b6b05D337";

  console.log(`Verifying QuestRegistry implementation at: ${IMPLEMENTATION_ADDRESS}`);

  try {
    await run("verify:verify", {
      address: IMPLEMENTATION_ADDRESS,
      constructorArguments: [], // No constructor arguments for this contract
    });
    console.log("✅ Contract verification successful!");
  } catch (error) {
    console.error("❌ Contract verification failed!");
    console.error(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });