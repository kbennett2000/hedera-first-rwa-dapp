/**
 * contracts.ts — Single source of truth for contract addresses and ABIs.
 *
 * This file imports:
 *   1. `deployments.json` — written by `npm run deploy` in the project root
 *   2. The ABI files we defined manually
 *
 * Every component and hook imports from here rather than directly
 * from individual files — makes it easy to swap addresses for a new deployment.
 *
 * ── HOW DEPLOYMENT ADDRESSES FLOW ──────────────────────────────────────────
 *
 *   npm run deploy (Hardhat)
 *       └─→ scripts/deploy.ts runs
 *             └─→ writes frontend/src/config/deployments.json
 *                   └─→ this file imports it
 *                         └─→ components use REGISTRY_ADDRESS, TOKEN_ADDRESS
 */

import deployments from './deployments.json'
import { complianceRegistryAbi } from '../abis/ComplianceRegistry'
import { rwaTokenAbi }           from '../abis/RWAComplianceToken'

// ── Contract Addresses ────────────────────────────────────────────────────────
//
// We cast to `0x${string}` because viem/wagmi require addresses in that format
// (a template literal type that guarantees the "0x" prefix).
export const REGISTRY_ADDRESS = deployments.contracts.ComplianceRegistry.address as `0x${string}`
export const TOKEN_ADDRESS    = deployments.contracts.RWAComplianceToken.address  as `0x${string}`

// ── Zero Address Check ────────────────────────────────────────────────────────
//
// The placeholder deployments.json uses zero addresses.
// Components check this flag to show a "deploy first" banner.
const ZERO = '0x0000000000000000000000000000000000000000'
export const isDeployed = REGISTRY_ADDRESS !== ZERO && TOKEN_ADDRESS !== ZERO

// ── Contract Config Objects ───────────────────────────────────────────────────
//
// Spreading these into wagmi hooks gives a clean, DRY call:
//
//   useReadContract({ ...registryConfig, functionName: 'isApproved', args: [addr] })
//   useWriteContract({ ...tokenConfig })
//
// Instead of:
//   useReadContract({ address: REGISTRY_ADDRESS, abi: registryAbi, functionName: 'isApproved', ... })
export const registryConfig = {
  address: REGISTRY_ADDRESS,
  abi: complianceRegistryAbi,
} as const

export const tokenConfig = {
  address: TOKEN_ADDRESS,
  abi: rwaTokenAbi,
} as const

// ── Network Info ──────────────────────────────────────────────────────────────
export const CHAIN_ID      = deployments.chainId
export const EXPLORER_URL  = 'https://hashscan.io/testnet'

/** Returns a HashScan URL for a given transaction hash. */
export function txUrl(hash: string): string {
  return `${EXPLORER_URL}/transaction/${hash}`
}

/** Returns a HashScan URL for a given contract address. */
export function contractUrl(address: string): string {
  return `${EXPLORER_URL}/contract/${address}`
}
