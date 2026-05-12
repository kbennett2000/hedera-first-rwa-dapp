import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Load variables from .env into process.env
dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Private Key Setup
//
// We read from .env and fall back to a dummy key so Hardhat doesn't crash when
// you haven't set up .env yet (e.g., on a fresh clone just running `compile`).
// The dummy key is never used for actual transactions.
// ─────────────────────────────────────────────────────────────────────────────
const DEPLOYER_PRIVATE_KEY = process.env.HEDERA_TESTNET_PRIVATE_KEY;

if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error(
    "Missing HEDERA_TESTNET_PRIVATE_KEY in .env file. " +
    "Please make sure your .env file has the correct variable name."
  );
}

// Make sure it has the 0x prefix (required by Hardhat/ethers)
const accounts = DEPLOYER_PRIVATE_KEY.startsWith("0x")
  ? [DEPLOYER_PRIVATE_KEY]
  : [`0x${DEPLOYER_PRIVATE_KEY}`];

const config: HardhatUserConfig = {
  // ── Solidity Compiler ───────────────────────────────────────────────────
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Higher = smaller runtime cost, larger bytecode
      },
      // viaIR: true, // Uncomment for complex contracts that hit stack depth limits
    },
  },

  // ── Network Definitions ─────────────────────────────────────────────────
  networks: {
    // ── Hedera Testnet ──
    // Chain ID 296 | Explorer: https://hashscan.io/testnet
    // Faucet: https://portal.hedera.com  (create account → get testnet HBAR)
    //
    // Hedera EVM compatibility notes:
    // • HBAR is the gas token (not ETH), but Hardhat treats it like ETH
    // • RPC endpoint: HashIO is Hedera's official JSON-RPC relay
    // • Block time: ~3–5 seconds on testnet
    hederaTestnet: {
      url: "https://testnet.hashio.io/api",
      accounts: accounts,
      chainId: 296,
      // Hedera testnet sometimes needs explicit gas settings
      // Uncomment if you get "transaction underpriced" errors:
      // gasPrice: 300000000000, // 300 Gwei
    },

    // ── Hedera Mainnet ──
    // ⚠️  Real money — only use after thorough testing
    hederaMainnet: {
      url: "https://mainnet.hashio.io/api",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 295,
    },

    // ── Local Hardhat Node ──
    // Run `npm run node` in a separate terminal, then deploy here
    // Useful for fast iteration without waiting for testnet confirmations
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },

  // ── File Paths ──────────────────────────────────────────────────────────
  paths: {
    sources: "./contracts",   // Solidity source files
    tests: "./test",          // Test files
    cache: "./cache",         // Compiler cache (safe to delete)
    artifacts: "./artifacts", // Compiled ABIs and bytecode
  },

  // ── Gas Reporter ────────────────────────────────────────────────────────
  // Shows gas usage per function after running tests
  // Set REPORT_GAS=true in .env to enable
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },
};

export default config;
