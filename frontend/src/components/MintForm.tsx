/**
 * MintForm — owner-only form to issue (mint) new RWA tokens.
 *
 * In RWA tokenization, "minting" represents the issuer allocating new token
 * units to an investor — e.g., an investor buys $10,000 of a real-estate
 * token and the issuer mints 10,000 tokens to their wallet.
 *
 * IMPORTANT: Both the connected wallet AND the recipient must be KYC-approved
 * for a mint to succeed. The contract enforces this even if this form doesn't
 * show a warning — it will just revert with RecipientNotCompliant.
 *
 * FORM STATE MACHINE:
 *   idle → submitting (MetaMask open) → confirming (tx in mempool) → success/error
 *
 * This pattern (useWriteContract + useWaitForTransactionReceipt) is the
 * standard wagmi v2 approach for all state-changing contract calls.
 */

import { useState }                from 'react'
import { isAddress, formatUnits }  from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useTokenOwner, useTokenInfo, useTokenBalance } from '../hooks/useTokenInfo'
import { useComplianceStatus }     from '../hooks/useCompliance'
import { tokenConfig, txUrl }      from '../config/contracts'
import { parseContractError }      from '../utils/errors'

export function MintForm() {
  const { address: connectedAddress } = useAccount()
  const { owner }      = useTokenOwner()
  const { tokenSymbol, maxSupplyCap, currentSupply, tokenDecimals, refetch: refetchInfo } =
    useTokenInfo()
  const { refetch: refetchBalance } = useTokenBalance(connectedAddress)

  // Is the connected wallet the token owner?
  const isOwner =
    connectedAddress &&
    owner &&
    connectedAddress.toLowerCase() === owner.toLowerCase()

  // ── Form state ────────────────────────────────────────────────────────────
  const [recipient, setRecipient]       = useState('')
  const [amountStr, setAmountStr]       = useState('')
  const [validationError, setValidationError] = useState('')

  // ── Contract write ────────────────────────────────────────────────────────
  const {
    writeContract,
    data: txHash,
    isPending: isSubmitting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash })

  // ── Check recipient's compliance status ───────────────────────────────────
  const recipientAddress = isAddress(recipient.trim())
    ? (recipient.trim() as `0x${string}`)
    : undefined

  const { allowed: recipientAllowed, isLoading: isCheckingRecipient } =
    useComplianceStatus(recipientAddress)

  const isBusy = isSubmitting || isConfirming

  // ── Submit handler ────────────────────────────────────────────────────────
  function handleMint() {
    const trimmedRecipient = recipient.trim()
    const amount = parseFloat(amountStr)

    // Client-side validation (the contract will also validate on-chain)
    if (!isAddress(trimmedRecipient)) {
      setValidationError('Recipient must be a valid 0x Ethereum address.')
      return
    }
    if (isNaN(amount) || amount <= 0) {
      setValidationError('Amount must be a positive number.')
      return
    }
    if (!Number.isInteger(amount)) {
      setValidationError('Amount must be a whole number (no decimals).')
      return
    }

    // Check supply cap client-side for a friendlier error message
    const decimals = tokenDecimals ?? 18
    const requestedWei = BigInt(amount) * (10n ** BigInt(decimals))
    const available    = (maxSupplyCap ?? 0n) - (currentSupply ?? 0n)
    if (requestedWei > available) {
      const avail = formatUnits(available, decimals)
      setValidationError(`Exceeds available supply. Only ${avail} ${tokenSymbol ?? ''} remaining.`)
      return
    }

    setValidationError('')
    resetWrite()

    // `writeContract` dispatches the transaction to MetaMask for signing.
    // The `amount` argument is in WHOLE tokens — the contract multiplies by 10^18.
    writeContract({
      ...tokenConfig,
      functionName: 'mint',
      args: [trimmedRecipient as `0x${string}`, BigInt(amount)],
    })
  }

  function handleReset() {
    setRecipient('')
    setAmountStr('')
    setValidationError('')
    resetWrite()
    // Refetch contract data so the UI reflects the new supply
    refetchInfo()
    refetchBalance()
  }

  // ── Not owner: hide this form ─────────────────────────────────────────────
  if (!connectedAddress) {
    return null // Hidden when wallet not connected
  }

  if (!isOwner) {
    return (
      <div className="card card-muted">
        <h2 className="card-title">Mint Tokens</h2>
        <p className="muted-text">
          Only the contract owner can mint new tokens.
          Connect the deployer wallet to access this form.
        </p>
      </div>
    )
  }

  const decimals = tokenDecimals ?? 18
  const available = formatUnits(
    (maxSupplyCap ?? 0n) - (currentSupply ?? 0n),
    decimals
  )

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Mint Tokens</h2>
        <span className="badge badge-purple">Owner Only</span>
      </div>

      <p className="muted-text">
        Issue new tokens to a KYC-approved investor. Available to mint:{' '}
        <strong>{available} {tokenSymbol}</strong>
      </p>

      {/* Recipient input */}
      <div className="form-group">
        <label className="form-label">Recipient Address</label>
        <input
          className={`input ${recipientAddress && !recipientAllowed && !isCheckingRecipient ? 'input-warning' : ''}`}
          type="text"
          placeholder="0x..."
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          disabled={isBusy || isConfirmed}
        />
        {/* Real-time compliance feedback as the user types */}
        {recipientAddress && !isCheckingRecipient && (
          <span className={`field-hint ${recipientAllowed ? 'hint-green' : 'hint-red'}`}>
            {recipientAllowed
              ? '✓ KYC approved — can receive tokens'
              : '✗ Not KYC approved — mint will be rejected by the contract'}
          </span>
        )}
      </div>

      {/* Amount input */}
      <div className="form-group">
        <label className="form-label">Amount (whole tokens)</label>
        <div className="input-suffix-wrapper">
          <input
            className="input"
            type="number"
            placeholder="e.g. 1000"
            min="1"
            step="1"
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            disabled={isBusy || isConfirmed}
          />
          <span className="input-suffix">{tokenSymbol}</span>
        </div>
      </div>

      {/* Compliance block */}
      {recipientAddress && !isCheckingRecipient && !recipientAllowed && (
        <div className="compliance-block-message">
          <strong>Mint blocked.</strong> Recipient is not KYC-approved.
          Approve that address in the Compliance Status panel first.
        </div>
      )}

      {/* Errors */}
      {validationError && <p className="error-text">{validationError}</p>}
      {writeError      && <p className="error-text">{parseContractError(writeError)}</p>}

      {/* Submit / reset */}
      {!isConfirmed ? (
        <button
          className="btn btn-primary btn-full"
          onClick={handleMint}
          disabled={
            isBusy ||
            !recipient ||
            !amountStr ||
            (recipientAddress !== undefined && !isCheckingRecipient && !recipientAllowed)
          }
        >
          {isSubmitting ? 'Waiting for signature…'
            : isConfirming ? 'Confirming transaction…'
            : `Mint ${amountStr || '?'} ${tokenSymbol ?? 'tokens'}`}
        </button>
      ) : (
        <button className="btn btn-ghost btn-full" onClick={handleReset}>
          Mint more tokens
        </button>
      )}

      {/* Transaction status */}
      {txHash && (
        <p className={`mt-sm ${isConfirmed ? 'success-text' : 'muted-text'}`}>
          {isConfirming && '⏳ Waiting for Hedera to confirm…'}
          {isConfirmed  && `✓ Minted successfully! `}
          <a href={txUrl(txHash)} target="_blank" rel="noreferrer" className="link">
            View on HashScan ↗
          </a>
        </p>
      )}

      {/* Educational note */}
      <details className="edu-details">
        <summary>What happens on-chain?</summary>
        <div className="edu-content">
          <p>
            Calling <code>mint(recipient, amount)</code> triggers:
          </p>
          <ol>
            <li>Owner check: reverts if caller ≠ owner</li>
            <li>Input validation: non-zero address and amount</li>
            <li>Supply cap: reverts if amount would exceed MAX_SUPPLY</li>
            <li>Compliance check: reverts if recipient is not KYC-approved</li>
            <li>
              <code>_mint(recipient, amount × 10¹⁸)</code> — updates balances
              and emits a <code>Transfer(0x0, recipient, amount)</code> event
            </li>
          </ol>
        </div>
      </details>
    </div>
  )
}
