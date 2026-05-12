/**
 * deploy.ts — Hardhat deployment script for the Hedera RWA DApp
 *
 * WHAT THIS SCRIPT DOES:
 *   1. Deploys ComplianceRegistry
 *   2. Deploys RWAComplianceToken (pointing at the registry)
 *   3. Approves the deployer in the registry (so you can mint immediately)
 *   4. Runs a sanity check to verify everything wired up correctly
 *   5. Saves deployment addresses to JSON files (for the frontend to read)
 *
 * RUN WITH:
 *   npx hardhat run scripts/deploy.ts --network hederaTestnet
 *   npx hardhat run scripts/deploy.ts --network localhost
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  printDivider("Hedera RWA DApp — Deployment Script");

  // ── Deployer Account ────────────────────────────────────────────────────
  // ethers.getSigners() reads accounts from hardhat.config.ts → networks[x].accounts
  // The first signer is the deployer (index 0).
  const [deployer] = await ethers.getSigners();

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer address :", deployer.address);
  console.log("Deployer balance :", ethers.formatEther(balance), "HBAR\n");

  if (balance === 0n) {
    console.error("ERROR: Deployer account has zero balance.");
    console.error("Visit https://portal.hedera.com to fund your testnet account.");
    process.exit(1);
  }

  // ── Step 1: Deploy ComplianceRegistry ───────────────────────────────────
  console.log("Step 1 — Deploying ComplianceRegistry...");

  // getContractFactory() compiles (if needed) and returns a factory object
  // that knows how to deploy the contract.
  const ComplianceRegistryFactory = await ethers.getContractFactory("ComplianceRegistry");

  // .deploy() sends the deployment transaction. The returned object is a
  // contract instance that is not yet confirmed on-chain.
  const registry = await ComplianceRegistryFactory.deploy();

  // waitForDeployment() waits for the transaction to be mined and the
  // contract address to be assigned.
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log("  ✓ ComplianceRegistry deployed:", registryAddress);

  // ── Step 2: Deploy RWAComplianceToken ────────────────────────────────────
  console.log("\nStep 2 — Deploying RWAComplianceToken...");

  // Token configuration — customise these for your RWA scenario
  const TOKEN_NAME    = "Hedera RWA Demo Token";
  const TOKEN_SYMBOL  = "HRWAT";
  const MAX_SUPPLY    = 1_000_000; // 1,000,000 whole tokens (script converts to wei)

  const RWATokenFactory = await ethers.getContractFactory("RWAComplianceToken");
  const token = await RWATokenFactory.deploy(
    TOKEN_NAME,
    TOKEN_SYMBOL,
    MAX_SUPPLY,
    registryAddress  // Pass the registry address so the token can query it
  );
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("  ✓ RWAComplianceToken deployed:", tokenAddress);
  console.log("    Name      :", TOKEN_NAME);
  console.log("    Symbol    :", TOKEN_SYMBOL);
  console.log("    Max supply:", MAX_SUPPLY.toLocaleString(), "tokens");

  // ── Step 3: Approve the deployer in the registry ─────────────────────────
  // Without this step, the deployer can't mint (minting requires the recipient
  // to be KYC-approved, and the deployer is also the first recipient).
  console.log("\nStep 3 — Approving deployer in ComplianceRegistry...");

  const approveTx = await registry.approveAddress(deployer.address);
  await approveTx.wait(); // Wait for the approval transaction to be mined

  console.log("  ✓ Deployer approved:", deployer.address);

  // ── Step 4: Sanity checks ────────────────────────────────────────────────
  console.log("\nStep 4 — Running sanity checks...");

  const isApproved = await registry.isApproved(deployer.address);
  console.log("  Deployer is approved:", isApproved);

  const info = await token.getTokenInfo();
  console.log("  Token name          :", info.tokenName);
  console.log("  Token symbol        :", info.tokenSymbol);
  console.log("  Max supply (tokens) :", ethers.formatEther(info.maxSupplyCap));
  console.log("  Compliance active   :", info.isComplianceActive);

  if (!isApproved) {
    console.warn("  ⚠ WARNING: Deployer approval failed — check registry");
  }

  // ── Step 5: Save addresses to JSON ───────────────────────────────────────
  console.log("\nStep 5 — Saving deployment info...");

  const network = await ethers.provider.getNetwork();

  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ComplianceRegistry: {
        address: registryAddress,
      },
      RWAComplianceToken: {
        address: tokenAddress,
        name: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
        maxSupply: MAX_SUPPLY,
      },
    },
  };

  // Write to project root (reference copy)
  const rootPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(rootPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("  ✓ deployments.json written to project root");

  // Write to frontend config directory (frontend reads this file)
  const frontendPath = path.join(__dirname, "../frontend/src/config/deployments.json");
  const frontendDir  = path.dirname(frontendPath);
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }
  fs.writeFileSync(frontendPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("  ✓ deployments.json written to frontend/src/config/");

  // ── Summary ──────────────────────────────────────────────────────────────
  printDivider("DEPLOYMENT COMPLETE");
  console.log("ComplianceRegistry :", registryAddress);
  console.log("RWAComplianceToken  :", tokenAddress);
  console.log("");
  console.log("View on HashScan:");
  console.log(`  https://hashscan.io/testnet/contract/${registryAddress}`);
  console.log(`  https://hashscan.io/testnet/contract/${tokenAddress}`);
  console.log("");
  console.log("Next steps:");
  console.log("  cd frontend");
  console.log("  npm install");
  console.log("  npm run dev");
  console.log("");
}

// ── Utility ─────────────────────────────────────────────────────────────────
function printDivider(label: string) {
  const line = "─".repeat(60);
  console.log(line);
  console.log(`  ${label}`);
  console.log(line);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nDeployment failed:", err);
    process.exit(1);
  });
