/**
 * useTokenInfo — fetches all token metadata in a single contract call.
 *
 * ── WHY A CUSTOM HOOK? ───────────────────────────────────────────────────────
 *
 * We could call `useReadContract` directly in each component, but:
 *   1. Multiple components need the same data (TokenInfo, MintForm, etc.)
 *   2. React Query caches the result — only ONE RPC call is made regardless
 *      of how many components call this hook simultaneously.
 *   3. A custom hook encapsulates the "what data" from the "how to use it".
 *
 * ── DATA FLOW ────────────────────────────────────────────────────────────────
 *
 *   useTokenInfo()
 *       └─→ useReadContract({ functionName: 'getTokenInfo' })
 *             └─→ wagmi → viem → JSON-RPC eth_call
 *                   └─→ Hedera EVM executes getTokenInfo() view function
 *                         └─→ returns (name, symbol, decimals, supply, max, compliance)
 *
 * ── RETURN VALUES ────────────────────────────────────────────────────────────
 *
 * Raw contract values use `bigint` for uint256 because JavaScript `number`
 * can't represent 256-bit integers safely. Use viem's `formatUnits` or
 * `formatEther` to convert bigints to human-readable strings.
 */

import { useReadContract } from 'wagmi'
import { tokenConfig }     from '../config/contracts'

export function useTokenInfo() {
  // useReadContract wraps a single eth_call.
  // With a typed ABI (as const), TypeScript knows the exact return type —
  // in this case an object with named fields matching the Solidity return vars.
  const { data, isLoading, isError, error, refetch } = useReadContract({
    ...tokenConfig,
    functionName: 'getTokenInfo',
  })

  return {
    // Destructure named tuple fields — viem v2 returns named outputs as an object
    tokenName:          data?.[0],
    tokenSymbol:        data?.[1],
    tokenDecimals:      data?.[2],
    currentSupply:      data?.[3],   // bigint (wei units)
    maxSupplyCap:       data?.[4],   // bigint (wei units)
    isComplianceActive: data?.[5],

    isLoading,
    isError,
    error,
    refetch,             // Call this to manually re-fetch after a write
  }
}

// ── Separate hook for the token owner address ─────────────────────────────────
// Kept separate from getTokenInfo() so components that only need the owner
// don't trigger a full metadata fetch.
export function useTokenOwner() {
  const { data: owner, isLoading } = useReadContract({
    ...tokenConfig,
    functionName: 'owner',
  })

  return { owner, isLoading }
}

// ── Hook for a single address's token balance ─────────────────────────────────
export function useTokenBalance(address: `0x${string}` | undefined) {
  const { data: balance, isLoading, refetch } = useReadContract({
    ...tokenConfig,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      // Only run the query when we actually have an address
      enabled: !!address,
    },
  })

  return { balance, isLoading, refetch }
}
