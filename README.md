# Build Your First RWA Token + React Frontend on Hedera EVM

A complete beginner-to-intermediate educational project that walks you through building, deploying, and interacting with a **Real World Asset (RWA) compliance token** on the **Hedera EVM testnet**.

---

## Table of Contents

1. [What You'll Build](#1-what-youll-build)
2. [Key Concepts](#2-key-concepts)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Environment Setup](#5-environment-setup)
6. [Smart Contract Deep-Dive](#6-smart-contract-deep-dive)
7. [Compile & Test Contracts](#7-compile--test-contracts)
8. [Deploy to Hedera Testnet](#8-deploy-to-hedera-testnet)
9. [Run the Frontend](#9-run-the-frontend)
10. [Using the DApp](#10-using-the-dapp)
11. [How Everything Connects](#11-how-everything-connects)
12. [Hedera EVM Specifics](#12-hedera-evm-specifics)
13. [Going Further](#13-going-further)

---

## 1. What You'll Build

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Wallet    │  │  Token   │  │   Mint   │  │ Transfer │   │
│  │  Connect   │  │   Info   │  │   Form   │  │   Form   │   │
│  └────────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                  ┌────────────────────────┐                 │
│                  │  Compliance Status     │                 │
│                  └────────────────────────┘                 │
└─────────────────────────────┬───────────────────────────────┘
                              │ viem + wagmi
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Hedera Testnet (Chain ID 296)              │
│                                                             │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │   ComplianceRegistry  │◄──│    RWAComplianceToken     │  │
│  │                       │   │                           │  │
│  │  - whitelist mapping  │   │  - ERC-20 standard logic  │  │
│  │  - approve/revoke     │   │  - _update hook override  │  │
│  │  - isApproved()       │   │  - mint (owner only)      │  │
│  └───────────────────────┘   └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**What makes this different from a regular ERC-20:**
- Transfers are **blocked** unless both sender and recipient are in the compliance registry
- Token issuance (minting) is restricted to the owner
- The compliance check is a hard requirement enforced at the protocol level — no frontend code can bypass it

---

## 2. Key Concepts

### What is a Real World Asset (RWA)?

RWA tokenization converts ownership rights in physical or financial assets into blockchain tokens:

| Traditional Asset | RWA Token Equivalent |
|---|---|
| Real estate deed | Property token (e.g., 10,000 tokens = 100% ownership) |
| Corporate bond | Bond token (each token = $1,000 face value) |
| Private equity share | Equity token |
| Invoice receivable | Invoice token |

**Why tokenize?**
- **Fractional ownership** — a $10M building can be owned by 10,000 investors at $1,000 each
- **24/7 liquidity** — trade on secondary markets without traditional brokerage
- **Programmable compliance** — rules enforced automatically at the protocol level
- **Global access** — any investor with a wallet can participate (within legal limits)

### What is KYC/AML?

- **KYC (Know Your Customer)** — verifying the identity of investors (passport, ID check)
- **AML (Anti-Money Laundering)** — screening for funds from illicit sources

In traditional finance, this happens at the brokerage. In DeFi-based RWA, it happens on-chain via a compliance registry.

### How the Compliance Hook Works

```
User calls token.transfer(recipient, amount)
         │
         ▼
   ERC20.transferFrom()
         │
         ▼
   ERC20._transfer()
         │
         ▼
   ERC20._update(from, to, value)   ◄── We override this
         │
         ├── Is compliance enabled?
         │     NO → proceed normally
         │     YES ↓
         ├── Is `from` approved? (skip for mints)
         │     NO → revert SenderNotCompliant
         │     YES ↓
         ├── Is `to` approved? (skip for burns)
         │     NO → revert RecipientNotCompliant
         │     YES ↓
         ▼
   super._update(from, to, value)   ← actually updates balances
```

By overriding the single internal `_update` function (OpenZeppelin v5), we intercept 100% of balance-changing operations with one piece of code.

---

## 3. Project Structure

```
hedera-first-rwa-dapp/
│
├── contracts/                    Solidity smart contracts
│   ├── ComplianceRegistry.sol    KYC whitelist (deploy this first)
│   └── RWAComplianceToken.sol    Compliance-gated ERC-20 token
│
├── scripts/
│   └── deploy.ts                 Hardhat deployment script
│
├── test/
│   ├── ComplianceRegistry.test.ts
│   └── RWAComplianceToken.test.ts
│
├── frontend/                     React + TypeScript + Vite
│   └── src/
│       ├── components/           UI components
│       ├── hooks/                Custom wagmi hooks
│       ├── config/               Chain + contract config
│       └── abis/                 Contract ABIs (auto-generated)
│
├── hardhat.config.ts             Hardhat configuration
├── package.json                  Root dependencies (Hardhat + Solidity)
├── .env.example                  Template for environment variables
└── README.md                     This file
```

---

## 4. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 18.x | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9.x | Comes with Node.js |
| MetaMask | Latest | [metamask.io](https://metamask.io) |
| Git | Any | [git-scm.com](https://git-scm.com) |

You do **not** need to install Hardhat globally — it runs from the local `node_modules`.

---

## 5. Environment Setup

### Step 5.1 — Clone and install dependencies

```bash
git clone <this-repo-url>
cd hedera-first-rwa-dapp

# Install Hardhat and Solidity tooling
npm install
```

### Step 5.2 — Create your .env file

```bash
cp .env.example .env
```

Open `.env` in your editor and add your private key:

```
PRIVATE_KEY=your_private_key_here
```

> **Where to get a private key:**
> - MetaMask → click account name → Account Details → Export Private Key
> - Hedera Portal: create a new testnet account at [portal.hedera.com](https://portal.hedera.com)

### Step 5.3 — Add Hedera Testnet to MetaMask

1. Open MetaMask → Settings → Networks → Add Network
2. Enter these values:

| Field | Value |
|---|---|
| Network Name | Hedera Testnet |
| RPC URL | `https://testnet.hashio.io/api` |
| Chain ID | `296` |
| Currency Symbol | `HBAR` |
| Block Explorer | `https://hashscan.io/testnet` |

### Step 5.4 — Get testnet HBAR

1. Go to [portal.hedera.com](https://portal.hedera.com)
2. Create a testnet account
3. The portal auto-funds testnet accounts with HBAR
4. Copy the **EVM address** and **private key** into your `.env`

---

## 6. Smart Contract Deep-Dive

### ComplianceRegistry.sol

This contract is a simple on-chain registry of approved addresses. Think of it as the KYC database.

**Key design decisions:**

```solidity
// Why 'private' mapping + getter instead of 'public'?
mapping(address => bool) private _approvedAddresses;

// Because 'public' auto-generates a getter with no custom logic.
// 'private' + manual getter lets us add logic later without breaking callers.
function isApproved(address account) external view returns (bool) {
    return _approvedAddresses[account];
}
```

```solidity
// Why custom errors instead of require() strings?
error AlreadyApproved(address account);  // ~50% cheaper in gas
// vs.
require(!_approved[account], "Already approved");  // more expensive
```

```solidity
// Why 'unchecked' increment in loops?
unchecked { ++i; }
// 'i' is uint256 — it will never realistically overflow.
// Skipping the overflow check saves ~30 gas per iteration.
// On 100-address batch, that's ~3,000 gas saved.
```

### RWAComplianceToken.sol

The token contract. The magic is in the `_update` override:

```solidity
function _update(address from, address to, uint256 value) internal override {
    if (!complianceEnabled) {
        super._update(from, to, value);  // Skip all checks
        return;
    }

    bool isMint = (from == address(0));  // Mints come "from" zero
    bool isBurn = (to   == address(0));  // Burns go "to" zero

    if (!isMint && !complianceRegistry.isApproved(from)) {
        revert SenderNotCompliant(from);
    }
    if (!isBurn && !complianceRegistry.isApproved(to)) {
        revert RecipientNotCompliant(to);
    }

    super._update(from, to, value);  // Proceed with balance update
}
```

**Why `immutable` for the registry reference?**

```solidity
ComplianceRegistry public immutable complianceRegistry;
```

`immutable` values are written once (in the constructor) then embedded directly in the contract bytecode. Reading them costs **3 gas** vs. ~2,100 gas for a regular storage slot. For a value read on every transfer, this matters.

---

## 7. Compile & Test Contracts

### Compile

```bash
npm run compile
```

This runs `hardhat compile`, which:
1. Downloads the Solidity compiler (`solc`) for version 0.8.24
2. Compiles your contracts
3. Generates ABI + bytecode in `artifacts/`
4. Generates TypeScript types in `typechain-types/`

You'll see output like:
```
Compiling 2 files with Solc 0.8.24
Compilation finished successfully
```

### Run Tests

```bash
npm test
```

Expected output:
```
  ComplianceRegistry
    Deployment
      ✓ sets the deployer as owner
      ✓ starts with zero approved addresses
      ✓ starts with every address unapproved
    approveAddress
      ✓ owner can approve an address
      ✓ increments totalApproved
      ✓ emits AddressApproved with correct args
      ✓ reverts when called by non-owner
      ✓ reverts for zero address
      ✓ reverts when approving an already-approved address
    ...

  RWAComplianceToken
    Deployment
      ✓ sets correct token name and symbol
      ...

  32 passing (2s)
```

### Run with Gas Report

```bash
REPORT_GAS=true npm test
```

This shows how much gas each function costs — important for estimating user transaction fees.

---

## 8. Deploy to Hedera Testnet

> **Before deploying:** Make sure you have HBAR in your testnet account. Each deployment costs gas (paid in HBAR).

```bash
npm run deploy
```

This runs `hardhat run scripts/deploy.ts --network hederaTestnet`.

**Sample output:**

```
────────────────────────────────────────────────────────────
  Hedera RWA DApp — Deployment Script
────────────────────────────────────────────────────────────
Deployer address : 0xYourAddress...
Deployer balance : 100.0 HBAR

Step 1 — Deploying ComplianceRegistry...
  ✓ ComplianceRegistry deployed: 0xRegistryAddress...

Step 2 — Deploying RWAComplianceToken...
  ✓ RWAComplianceToken deployed: 0xTokenAddress...

Step 3 — Approving deployer in ComplianceRegistry...
  ✓ Deployer approved: 0xYourAddress...

Step 4 — Running sanity checks...
  Deployer is approved: true
  Token name          : Hedera RWA Demo Token
  Compliance active   : true

Step 5 — Saving deployment info...
  ✓ deployments.json written to project root
  ✓ deployments.json written to frontend/src/config/
```

After deployment, two files are written:
- `deployments.json` — root reference
- `frontend/src/config/deployments.json` — auto-loaded by the React app

**View your contracts on HashScan:**
- Registry: `https://hashscan.io/testnet/contract/0xRegistryAddress`
- Token: `https://hashscan.io/testnet/contract/0xTokenAddress`

---

## 9. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open your browser at **http://localhost:5173**.

> **Make sure** you deployed contracts first (Step 8), so `frontend/src/config/deployments.json` exists.

---

## 10. Using the DApp

### Workflow

1. **Connect Wallet** — Click "Connect Wallet" and approve in MetaMask
2. **Check Compliance Status** — See if your address is KYC-approved
3. **Approve an Address** (owner only) — Enter an address and click "Approve"
4. **Mint Tokens** (owner only) — Enter an amount and recipient address
5. **Transfer Tokens** — Enter recipient and amount; will fail if either party isn't approved

### Important Notes

- The wallet that deployed the contracts is the **owner** — only it can mint and approve addresses
- If you try to transfer to a non-approved address, the transaction will revert
- The UI shows each address's compliance status in real time

---

## 11. How Everything Connects

```
User action in React UI
       │
       ▼ wagmi hook (useWriteContract)
       │
       ▼ viem encodes the calldata
       │
       ▼ MetaMask prompts user to sign
       │
       ▼ Signed transaction → Hedera JSON-RPC relay (HashIO)
       │
       ▼ Hedera consensus nodes process the transaction
       │
       ▼ EVM executes the Solidity function
       │
       ├── if RWAComplianceToken.transfer():
       │       _update() called
       │       → complianceRegistry.isApproved(from) ← cross-contract call
       │       → complianceRegistry.isApproved(to)
       │       → super._update() updates balances
       │
       ▼ Transaction receipt returned to frontend
       │
       ▼ wagmi invalidates query cache → UI re-renders with new data
```

---

## 12. Hedera EVM Specifics

Hedera runs an **EVM-compatible** layer, but there are differences from Ethereum to know:

| Feature | Ethereum | Hedera |
|---|---|---|
| Chain ID | 1 (mainnet), 11155111 (Sepolia) | 295 (mainnet), 296 (testnet) |
| Gas token | ETH | HBAR |
| Block time | ~12 seconds | ~3–5 seconds |
| RPC endpoint | Various | `https://testnet.hashio.io/api` |
| Explorer | Etherscan | HashScan |
| Address format | 0x hex | `0.0.XXXXX` (Hedera native) or 0x hex |

**Hedera address formats:**
- Native Hedera: `0.0.12345` (account ID)
- EVM: `0x000000000000000000000000000000000000XXXX`
- Both point to the same account — MetaMask uses the EVM format

**Transaction costs:**
- Hedera testnet is free (HBAR from faucet)
- Gas prices on Hedera are predictable and generally lower than Ethereum mainnet

---

## 13. Going Further

Once you understand this project, here are natural next steps:

### Security Improvements
- Add a **timelock** to the compliance toggle (prevent instant disabling)
- Replace single-owner with a **multi-sig** (Gnosis Safe) for admin functions
- Add **role-based access control** (RBAC) — separate KYC admin from token admin

### Feature Additions
- **Burn function** — allow token holders to redeem tokens for underlying assets
- **Dividend distribution** — distribute yield proportionally to token holders
- **Transfer restrictions** — add per-address transfer limits (anti-whale)
- **Compliance expiry** — make KYC approvals expire after 1 year

### Production Considerations
- Connect to a real KYC provider via Chainlink oracle
- Add contract verification on HashScan (`hardhat-verify`)
- Deploy a **proxy** (ERC-1967) for upgradeability
- Use a **subgraph** (The Graph) for efficient event indexing

### Related Standards
- **ERC-1400** — Securities token standard with transfer restrictions
- **ERC-3643** — T-REX protocol (widely used in regulated RWA tokenization)
- **ERC-4626** — Tokenized vault standard (for yield-bearing RWA)

---

## License

MIT — use this freely for learning, building, and teaching.

---

*Built on [Hedera](https://hedera.com) · Smart contracts with [Hardhat](https://hardhat.org) · Frontend with [Vite](https://vitejs.dev) + [wagmi](https://wagmi.sh)*
