/**
 * ComplianceStatus — shows KYC/compliance state for any address.
 *
 * Features:
 *   1. Auto-shows status for the connected wallet
 *   2. Search field to check any arbitrary address
 *   3. Owner-only section: approve/revoke buttons for the registry
 *
 * WAGMI WRITE PATTERN:
 *   To send a transaction, wagmi v2 uses two steps:
 *
 *   Step 1 — useWriteContract()
 *     Provides a `writeContract` function. Calling it submits the transaction
 *     to MetaMask for signing. Returns the transaction `hash` once submitted.
 *
 *   Step 2 — useWaitForTransactionReceipt({ hash })
 *     Polls for the transaction to be mined and confirmed.
 *     `isLoading` is true while waiting. `isSuccess` when confirmed.
 *
 *   This two-step pattern lets you show progress:
 *     "Waiting for signature" → "Transaction submitted" → "Confirmed!"
 */

import { useState }                         from 'react'
import { isAddress }                        from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useComplianceStatus, useIsRegistryApproved } from '../hooks/useCompliance'
import { useTokenOwner }                    from '../hooks/useTokenInfo'
import { registryConfig, txUrl }            from '../config/contracts'
import { parseContractError }               from '../utils/errors'

// ── Sub-component: Status badge ───────────────────────────────────────────────
function StatusBadge({
  allowed,
  isRegistryApproved,
  isComplianceActive,
  isLoading,
}: {
  allowed: boolean
  isRegistryApproved: boolean
  isComplianceActive: boolean
  isLoading: boolean
}) {
  if (isLoading) return <div className="skeleton" style={{ width: 120, height: 28 }} />

  if (!isComplianceActive) {
    return (
      <span className="badge badge-yellow" title="Compliance checks are currently disabled">
        ⚡ Compliance OFF — anyone can transact
      </span>
    )
  }

  if (allowed && isRegistryApproved) {
    return <span className="badge badge-green">✓ KYC Approved — can transact</span>
  }

  return <span className="badge badge-red">✗ Not KYC Approved — transfers blocked</span>
}

// ── Main component ────────────────────────────────────────────────────────────
export function ComplianceStatus() {
  const { address: connectedAddress } = useAccount()
  const { owner } = useTokenOwner()

  // Is the connected wallet the contract owner?
  const isOwner =
    connectedAddress &&
    owner &&
    connectedAddress.toLowerCase() === owner.toLowerCase()

  // Compliance status for the connected wallet
  const connectedStatus = useComplianceStatus(connectedAddress)

  // ── Search state: check any address ────────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [searchAddress, setSearchAddress] = useState<`0x${string}` | undefined>(undefined)
  const [searchError, setSearchError]     = useState('')

  const searchStatus = useIsRegistryApproved(searchAddress)

  function handleSearch() {
    const trimmed = searchInput.trim()
    if (!isAddress(trimmed)) {
      setSearchError('Please enter a valid 0x Ethereum address.')
      return
    }
    setSearchError('')
    setSearchAddress(trimmed as `0x${string}`)
  }

  // ── Approve / Revoke (owner only) ───────────────────────────────────────
  const [adminAddress, setAdminAddress] = useState('')
  const [adminError, setAdminError]     = useState('')

  // Step 1: submit transaction
  const { writeContract, data: txHash, isPending: isSubmitting, error: writeError } =
    useWriteContract()

  // Step 2: wait for confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash })

  function handleApprove() {
    const trimmed = adminAddress.trim()
    if (!isAddress(trimmed)) {
      setAdminError('Enter a valid 0x address to approve.')
      return
    }
    setAdminError('')

    // Calling writeContract triggers MetaMask to show a sign prompt
    writeContract({
      ...registryConfig,
      functionName: 'approveAddress',
      args: [trimmed as `0x${string}`],
    })
  }

  function handleRevoke() {
    const trimmed = adminAddress.trim()
    if (!isAddress(trimmed)) {
      setAdminError('Enter a valid 0x address to revoke.')
      return
    }
    setAdminError('')

    writeContract({
      ...registryConfig,
      functionName: 'revokeAddress',
      args: [trimmed as `0x${string}`],
    })
  }

  const isBusy = isSubmitting || isConfirming

  return (
    <div className="card">
      <h2 className="card-title">Compliance Status</h2>

      {/* ── Connected wallet status ───────────────────────────── */}
      {connectedAddress ? (
        <div className="compliance-row">
          <span className="info-label">Your wallet</span>
          <code className="address-code">{connectedAddress}</code>
          <StatusBadge {...connectedStatus} />
        </div>
      ) : (
        <p className="muted-text">Connect your wallet to see your compliance status.</p>
      )}

      <hr className="divider" />

      {/* ── Search any address ────────────────────────────────── */}
      <div className="section-label">Check any address</div>
      <div className="input-row">
        <input
          className="input"
          type="text"
          placeholder="0x..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className="btn btn-secondary" onClick={handleSearch}>
          Check
        </button>
      </div>
      {searchError && <p className="error-text">{searchError}</p>}

      {searchAddress && (
        <div className="compliance-row mt-sm">
          <code className="address-code">{searchAddress}</code>
          {searchStatus.isLoading ? (
            <div className="skeleton" style={{ width: 120, height: 28 }} />
          ) : (
            <span className={`badge ${searchStatus.isApproved ? 'badge-green' : 'badge-red'}`}>
              {searchStatus.isApproved ? '✓ Approved' : '✗ Not Approved'}
            </span>
          )}
        </div>
      )}

      {/* ── Owner admin panel ─────────────────────────────────── */}
      {isOwner && (
        <>
          <hr className="divider" />
          <div className="section-label">
            Admin: Approve / Revoke Address
            <span className="badge badge-purple ml-sm">Owner Only</span>
          </div>

          <div className="input-row">
            <input
              className="input"
              type="text"
              placeholder="0x address to approve or revoke"
              value={adminAddress}
              onChange={e => setAdminAddress(e.target.value)}
              disabled={isBusy}
            />
          </div>

          <div className="btn-row mt-sm">
            <button
              className="btn btn-success"
              onClick={handleApprove}
              disabled={isBusy || !adminAddress}
            >
              {isSubmitting ? 'Signing…' : isConfirming ? 'Confirming…' : 'Approve'}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleRevoke}
              disabled={isBusy || !adminAddress}
            >
              {isBusy ? '…' : 'Revoke'}
            </button>
          </div>

          {adminError  && <p className="error-text mt-sm">{adminError}</p>}
          {writeError  && <p className="error-text mt-sm">{parseContractError(writeError)}</p>}

          {txHash && (
            <p className="success-text mt-sm">
              {isConfirming ? '⏳ Waiting for confirmation…' : ''}
              {isConfirmed  ? '✓ Transaction confirmed! ' : ''}
              <a href={txUrl(txHash)} target="_blank" rel="noreferrer" className="link">
                View on HashScan ↗
              </a>
            </p>
          )}
        </>
      )}
    </div>
  )
}
