/**
 * TokenInfo — displays token metadata fetched from the contract.
 *
 * Uses our custom `useTokenInfo` hook to call `RWAComplianceToken.getTokenInfo()`
 * in a single RPC call, then formats and displays the results.
 *
 * KEY FORMATTING CONCEPT: bigint → human-readable string
 *
 * Solidity uint256 values come back as JavaScript `bigint`.
 * For a token with 18 decimals, 1 token = 1_000_000_000_000_000_000n (1e18).
 * viem provides `formatUnits(bigint, decimals)` to convert this to "1.0".
 *
 * Example:
 *   formatUnits(1_000_000_000_000_000_000n, 18) → "1.0"
 *   formatUnits(500_000_000_000_000_000n,   18) → "0.5"
 */

import { formatUnits }    from 'viem'
import { useTokenInfo }   from '../hooks/useTokenInfo'
import { useTotalApproved } from '../hooks/useCompliance'
import { contractUrl }    from '../config/contracts'
import { TOKEN_ADDRESS, REGISTRY_ADDRESS } from '../config/contracts'

export function TokenInfo() {
  const {
    tokenName,
    tokenSymbol,
    tokenDecimals,
    currentSupply,
    maxSupplyCap,
    isComplianceActive,
    isLoading,
    isError,
  } = useTokenInfo()

  const { total: totalApproved } = useTotalApproved()

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="card-title">Token Info</h2>
        <div className="loading-row">
          <div className="skeleton" style={{ width: '60%' }} />
          <div className="skeleton" style={{ width: '40%' }} />
          <div className="skeleton" style={{ width: '50%' }} />
        </div>
      </div>
    )
  }

  if (isError || !tokenName) {
    return (
      <div className="card">
        <h2 className="card-title">Token Info</h2>
        <p className="error-text">
          Could not load token data. Make sure you are connected to Hedera Testnet
          and contracts are deployed.
        </p>
      </div>
    )
  }

  // Calculate percentage of supply used
  const supplyPct =
    maxSupplyCap && maxSupplyCap > 0n
      ? Number((currentSupply! * 10000n) / maxSupplyCap!) / 100
      : 0

  const decimals = tokenDecimals ?? 18

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Token Info</h2>
        <span className={`badge ${isComplianceActive ? 'badge-blue' : 'badge-yellow'}`}>
          {isComplianceActive ? '🔒 Compliance ON' : '🔓 Compliance OFF'}
        </span>
      </div>

      {/* Token identity */}
      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">Name</span>
          <span className="info-value">{tokenName}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Symbol</span>
          <span className="info-value token-symbol">{tokenSymbol}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Decimals</span>
          <span className="info-value">{decimals}</span>
        </div>
        <div className="info-item">
          <span className="info-label">KYC Approved Wallets</span>
          <span className="info-value">{totalApproved.toString()}</span>
        </div>
      </div>

      {/* Supply bar */}
      <div className="supply-section">
        <div className="supply-header">
          <span className="info-label">Token Supply</span>
          <span className="supply-pct">{supplyPct.toFixed(2)}%</span>
        </div>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(supplyPct, 100)}%` }}
          />
        </div>
        <div className="supply-numbers">
          <span>
            {/* formatUnits converts wei bigint → decimal string */}
            {formatUnits(currentSupply ?? 0n, decimals)} {tokenSymbol} minted
          </span>
          <span>
            Max: {formatUnits(maxSupplyCap ?? 0n, decimals)} {tokenSymbol}
          </span>
        </div>
      </div>

      {/* Contract links */}
      <div className="contract-links">
        <a
          href={contractUrl(TOKEN_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="link"
        >
          Token ↗
        </a>
        <a
          href={contractUrl(REGISTRY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="link"
        >
          Registry ↗
        </a>
      </div>
    </div>
  )
}
