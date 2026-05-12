# Architecture Overview

## Project Goal
A beginner-to-intermediate educational template that demonstrates how to build a **compliant Real World Asset (RWA) token** on Hedera EVM.

## High-Level Architecture
Frontend (React + TypeScript + Vite)
↓ (wagmi + viem)
Hedera EVM Testnet
↓
RWAComplianceToken.sol  ← ERC-20 with compliance hooks
↓
ComplianceRegistry.sol  ← On-chain whitelist/KYC simulation


## Key Design Decisions

- **Two-contract pattern**: Separates token logic from compliance rules (highly modular and realistic)
- **On-chain compliance checks**: Every `mint()` and `transfer()` calls `isCompliant()` before proceeding
- **Owner-only minting**: Simulates real-world RWA issuers controlling supply
- **Simple whitelist model**: Demonstrates the core concept without requiring complex off-chain KYC

## Why This Matters for RWAs

Real tokenized assets (real estate, carbon credits, invoices, etc.) must comply with securities laws. This demo shows how you can enforce compliance rules **directly on-chain** — one of the biggest technical challenges when moving traditional assets onto blockchain.

