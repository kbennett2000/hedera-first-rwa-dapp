# Deployment Guide

This document explains how to deploy the RWA demo contracts and run the frontend.

## Prerequisites

- Node.js (v18+ recommended)
- MetaMask (or another EVM wallet)
- Hedera Testnet account with HBAR (get one at https://portal.hedera.com)

## 1. Deploy the Smart Contracts

```bash
# From project root
npx hardhat run scripts/deploy.ts --network hederaTestnet
```

This will:
- Deploy `ComplianceRegistry`
- Deploy `RWAComplianceToken`
- Approve the deployer address
- Save contract addresses to `deployments.json` and `frontend/src/config/deployments.json`

## 2. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```

The app will open at `http://localhost:5173`

## 3. Connect Your Wallet
- Switch MetaMask to Hedera Testnet (Chain ID 296)
- Refresh the app
- Click "Connect Wallet"

## Common Commands
```bash
# Compile contracts only
npx hardhat compile

# Run on local Hardhat node (fast testing)
npx hardhat node

# Deploy to local node
npx hardhat run scripts/deploy.ts --network localhost
```

## Troubleshooting
- "Insufficient funds" → Make sure your account has HBAR on Hedera Testnet.
- Wallet not detected → Switch MetaMask to Hedera Testnet and refresh.
- Contract addresses not loading → Check that `frontend/src/config/deployments.json` exists and has the correct addresses.