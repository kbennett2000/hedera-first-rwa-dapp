/**
 * useCompliance — compliance status hooks for the RWA dApp.
 *
 * These hooks abstract the compliance-related contract reads so components
 * don't need to know which contract to call or how to decode the result.
 *
 * CONTRACTS INVOLVED:
 *   • RWAComplianceToken.canTransact(address) — checks both the registry
 *     status AND whether compliance enforcement is active. One call covers all.
 *
 *   • ComplianceRegistry.isApproved(address) — the raw whitelist check.
 *     Used when you only want the registry state, not the compound result.
 *
 * CACHING BEHAVIOUR:
 *   wagmi caches reads with React Query. If two components both call
 *   `useComplianceStatus('0xabc...')`, only one eth_call is made —
 *   the second component gets the cached result instantly.
 *
 *   The cache is invalidated when:
 *     • The `staleTime` (10s, set in wagmi.ts) expires
 *     • You call `refetch()` manually (do this after an approve/revoke tx)
 */

import { useReadContract } from 'wagmi'
import { tokenConfig, registryConfig } from '../config/contracts'

// ── Main compliance status hook ───────────────────────────────────────────────

/**
 * Check whether an address can send and receive RWA tokens.
 *
 * Returns the compound result from `RWAComplianceToken.canTransact()`:
 *   • `allowed`            — true if this address can currently transact
 *   • `isRegistryApproved` — true if the address is in the KYC whitelist
 *   • `isComplianceActive` — true if compliance enforcement is currently on
 *
 * The `allowed` field combines both: if compliance is OFF, everyone is
 * allowed regardless of registry status.
 */
export function useComplianceStatus(address: `0x${string}` | undefined) {
  const { data, isLoading, isError, refetch } = useReadContract({
    ...tokenConfig,
    functionName: 'canTransact',
    args: [address!],
    query: {
      enabled: !!address,
    },
  })

  return {
    // data is a tuple: [allowed, isRegistryApproved, isComplianceActive]
    allowed:            data?.[0] ?? false,
    isRegistryApproved: data?.[1] ?? false,
    isComplianceActive: data?.[2] ?? true,  // default to "compliance on" when loading

    isLoading,
    isError,
    refetch,
  }
}

// ── Raw registry approval check ───────────────────────────────────────────────

/**
 * Direct check against the ComplianceRegistry contract.
 * Useful in the ComplianceStatus component's address search feature,
 * where you want to check any arbitrary address — not just the connected wallet.
 */
export function useIsRegistryApproved(address: `0x${string}` | undefined) {
  const { data: isApproved, isLoading, refetch } = useReadContract({
    ...registryConfig,
    functionName: 'isApproved',
    args: [address!],
    query: {
      enabled: !!address,
    },
  })

  return { isApproved: isApproved ?? false, isLoading, refetch }
}

// ── Registry total count ──────────────────────────────────────────────────────

/** Returns the total number of currently KYC-approved addresses. */
export function useTotalApproved() {
  const { data: total, isLoading } = useReadContract({
    ...registryConfig,
    functionName: 'totalApproved',
  })

  return { total: total ?? 0n, isLoading }
}
