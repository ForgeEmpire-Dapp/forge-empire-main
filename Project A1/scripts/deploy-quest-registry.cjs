// deploy-quest-registry.cjs
require("dotenv").config();
const { ethers, upgrades } = require("hardhat");

function isValidAddress(addr) {
  // simple, reliable check that doesn't depend on ethers.utils
  return typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

async function main() {
  console.log("Starting QuestRegistry proxy deployment...");

  // Read initializer args from environment
  const {
    DEFAULT_ADMIN,
    QUEST_ADMIN,
    PAUSER,
    UPGRADER,
    QUEST_SIGNER,
    XP_ENGINE,
    BADGE_MINTER,
  } = process.env;

  // Basic sanity check
  const missing = [];
  if (!DEFAULT_ADMIN) missing.push("DEFAULT_ADMIN");
  if (!QUEST_ADMIN) missing.push("QUEST_ADMIN");
  if (!PAUSER) missing.push("PAUSER");
  if (!UPGRADER) missing.push("UPGRADER");
  if (!QUEST_SIGNER) missing.push("QUEST_SIGNER");
  if (!XP_ENGINE) missing.push("XP_ENGINE");
  if (!BADGE_MINTER) missing.push("BADGE_MINTER");

  if (missing.length > 0) {
    console.error("Missing required env vars:", missing.join(", "));
    console.error("Please set them in your .env file or environment and try again.");
    process.exit(1);
  }

  // Validate addresses using regex (avoids relying on ethers.utils)
  const addrs = { DEFAULT_ADMIN, QUEST_ADMIN, PAUSER, UPGRADER, QUEST_SIGNER, XP_ENGINE, BADGE_MINTER };
  const invalid = [];
  for (const [key, val] of Object.entries(addrs)) {
    if (!isValidAddress(val)) invalid.push(`${key} (${val})`);
  }
  if (invalid.length > 0) {
    console.error("Invalid address(es) in env:", invalid.join(", "));
    process.exit(2);
  }

  // Prepare initializer args for initialize()
  const initializerArgs = [
    DEFAULT_ADMIN,
    QUEST_ADMIN,
    PAUSER,
    UPGRADER,
    QUEST_SIGNER,
    XP_ENGINE,
    BADGE_MINTER,
  ];

  // Get factory and deploy proxy
  const QuestRegistry = await ethers.getContractFactory("QuestRegistry");

  console.log("Deploying proxy and calling initialize(...) with:");
  console.log(initializerArgs);

  // deployProxy will deploy implementation + proxy and call initialize(...)
  const questRegistryProxy = await upgrades.deployProxy(QuestRegistry, initializerArgs, {
    initializer: "initialize",
  });

  // Wait for deployment to be ready (handle ethers v5/v6 differences)
  try {
    if (typeof questRegistryProxy.waitForDeployment === "function") {
      // ethers v6 style
      await questRegistryProxy.waitForDeployment();
    } else if (typeof questRegistryProxy.deployed === "function") {
      // ethers v5 style
      await questRegistryProxy.deployed();
    } else if (questRegistryProxy.deployTransaction && typeof questRegistryProxy.deployTransaction.wait === "function") {
      await questRegistryProxy.deployTransaction.wait();
    }
  } catch (err) {
    console.warn("Warning: waitForDeployment/deployed fallback failed, continuing — you may still be OK.", err);
  }

  // Determine proxy address robustly
  let deployedAddress = questRegistryProxy.address || null;
  if (!deployedAddress && typeof questRegistryProxy.getAddress === "function") {
    try {
      deployedAddress = await questRegistryProxy.getAddress();
    } catch (e) {
      // ignore
    }
  }

  console.log("QuestRegistry proxy deployed to:", deployedAddress || "<unknown address>");

  // Get implementation address (best effort)
  try {
    if (deployedAddress) {
      const impl = await upgrades.erc1967.getImplementationAddress(deployedAddress);
      console.log("Implementation address:", impl || "<none>");
    } else {
      console.log("Skipping implementation lookup because proxy address is unknown.");
    }
  } catch (err) {
    console.warn("Could not read implementation address:", err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
