/**
 * TransferForm — send RWA tokens to another KYC-approved address.
 *
 * This is the standard ERC-20 transfer interface, but with compliance awareness:
 *   • Shows the user's current balance
 *   • Checks the recipient's compliance status before submitting
 *   • Blocks submission if the recipient is not KYC-approved (pre-flight check)
 *   • Parses contract/RPC errors into friendly messages as a safety net
 *
 * DIFFERENCE FROM STANDARD ERC-20 TRANSFER:
 *   A normal ERC-20 transfer succeeds for any valid address.
 *   Our RWAComplianceToken._update() override intercepts the transfer and:
 *     1. Checks complianceRegistry.isApproved(from) → SenderNotCompliant
 *     2. Checks complianceRegistry.isApproved(to)   → RecipientNotCompliant
 *   Both parties must be in the registry, or the transaction reverts.
 *
 * AMOUNT ENCODING:
 *   The ERC-20 `transfer(to, amount)` function takes `amount` in wei
 *   (the token's smallest unit, with 18 decimals).
 *   We take a human input like "100.5" and convert it using viem's
 *   `parseUnits("100.5", 18)` → 100_500_000_000_000_000_000n.
 */

import { useState }                from 'react'
import { isAddress, parseUnits, formatUnits } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useTokenInfo, useTokenBalance } from '../hooks/useTokenInfo'
import { useComplianceStatus }     from '../hooks/useCompliance'
import { tokenConfig, txUrl }      from '../config/contracts'
import { parseContractError }      from '../utils/errors'

export function TransferForm() {
  const { address: connectedAddress } = useAccount()
  const { tokenSymbol, tokenDecimals, isComplianceActive } = useTokenInfo()
  const decimals = tokenDecimals ?? 18

  // Connected user's token balance
  const { balance, refetch: refetchBalance } = useTokenBalance(connectedAddress)

  // ── Form state ────────────────────────────────────────────────────────────
  const [recipient, setRecipient]             = useState('')
  const [amountStr, setAmountStr]             = useState('')
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

  // ── Recipient compliance check ────────────────────────────────────────────
  const recipientAddress = isAddress(recipient.trim())
    ? (recipient.trim() as `0x${string}`)
    : undefined

  const { allowed: recipientAllowed, isLoading: isCheckingRecipient } =
    useComplianceStatus(recipientAddress)

  const isBusy = isSubmitting || isConfirming

  // ── Submit handler ────────────────────────────────────────────────────────
  function handleTransfer() {
    const trimmedRecipient = recipient.trim()
    const amount = parseFloat(amountStr)

    if (!isAddress(trimmedRecipient)) {
      setValidationError('Recipient must be a valid 0x Ethereum address.')
      return
    }
    if (isNaN(amount) || amount <= 0) {
      setValidationError('Amount must be a positive number.')
      return
    }

    // Convert human amount → wei bigint
    // parseUnits handles decimal input ("100.5") correctly
    let amountWei: bigint
    try {
      amountWei = parseUnits(amountStr, decimals)
    } catch {
      setValidationError('Invalid amount format.')
      return
    }

    // Client-side balance check (the contract also checks this and will revert)
    if (balance !== undefined && amountWei > balance) {
      const balFormatted = formatUnits(balance, decimals)
      setValidationError(`Insufficient balance. You have ${balFormatted} ${tokenSymbol ?? ''}.`)
      return
    }

    setValidationError('')
    resetWrite()

    // ERC-20 transfer takes the recipient address and amount in wei
    writeContract({
      ...tokenConfig,
      functionName: 'transfer',
      args: [trimmedRecipient as `0x${string}`, amountWei],
    })
  }

  function handleReset() {
    setRecipient('')
    setAmountStr('')
    setValidationError('')
    resetWrite()
    refetchBalance()
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!connectedAddress) {
    return (
      <div className="card">
        <h2 className="card-title">Transfer Tokens</h2>
        <p className="muted-text">Connect your wallet to transfer tokens.</p>
      </div>
    )
  }

  const balanceFormatted = balance !== undefined
    ? formatUnits(balance, decimals)
    : '…'

  // ── Set max button ────────────────────────────────────────────────────────
  function handleSetMax() {
    if (balance !== undefined) {
      setAmountStr(formatUnits(balance, decimals))
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Transfer Tokens</h2>
        {isComplianceActive !== undefined && (
          <span className={`badge ${isComplianceActive ? 'badge-blue' : 'badge-yellow'}`}>
            {isComplianceActive ? 'Compliance enforced' : 'Open transfers'}
          </span>
        )}
      </div>

      {/* Balance display */}
      <div className="balance-display">
        <span className="info-label">Your balance</span>
        <span className="balance-value">
          {balanceFormatted} <span className="token-symbol">{tokenSymbol}</span>
        </span>
      </div>

      {balance === 0n && (
        <div className="info-banner info-banner-yellow">
          You have no tokens to transfer. The contract owner can mint tokens to your address.
        </div>
      )}

      {/* Recipient input */}
      <div className="form-group">
        <label className="form-label">Recipient Address</label>
        <input
          className={`input ${
            recipientAddress && !recipientAllowed && !isCheckingRecipient
              ? 'input-warning'
              : ''
          }`}
          type="text"
          placeholder="0x..."
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          disabled={isBusy || isConfirmed}
        />
        {/* Real-time compliance hint — also acts as the primary block message */}
        {recipientAddress && !isCheckingRecipient && (
          <span className={`field-hint ${recipientAllowed ? 'hint-green' : 'hint-red'}`}>
            {recipientAllowed
              ? '✓ KYC approved — can receive tokens'
              : '✗ Not KYC approved — the contract will reject this transfer'}
          </span>
        )}
      </div>

      {/* Amount input */}
      <div className="form-group">
        <label className="form-label">Amount</label>
        <div className="input-suffix-wrapper">
          <input
            className="input"
            type="number"
            placeholder="0.0"
            min="0"
            step="any"
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            disabled={isBusy || isConfirmed}
          />
          <span className="input-suffix">{tokenSymbol}</span>
        </div>
        <button
          className="btn btn-ghost btn-xs"
          onClick={handleSetMax}
          disabled={isBusy || balance === undefined}
          style={{ marginTop: '0.25rem' }}
        >
          Max
        </button>
      </div>

      {/* Compliance block — shown above the button when we know the tx will fail */}
      {recipientAddress && !isCheckingRecipient && !recipientAllowed && (
        <div className="compliance-block-message">
          <strong>Transfer blocked.</strong> The recipient address is not KYC-approved.
          The contract owner must call <code>approveAddress()</code> for that wallet
          before tokens can be sent to it.
        </div>
      )}

      {/* Errors */}
      {validationError && <p className="error-text">{validationError}</p>}
      {writeError      && <p className="error-text">{parseContractError(writeError)}</p>}

      {/* Submit / reset */}
      {!isConfirmed ? (
        <button
          className="btn btn-primary btn-full"
          onClick={handleTransfer}
          disabled={
            isBusy ||
            !recipient ||
            !amountStr ||
            balance === 0n ||
            // Pre-flight: block submission when compliance check has resolved as "not allowed"
            (recipientAddress !== undefined && !isCheckingRecipient && !recipientAllowed)
          }
        >
          {isSubmitting ? 'Waiting for signature…'
            : isConfirming ? 'Confirming transaction…'
            : `Transfer ${amountStr || '?'} ${tokenSymbol ?? 'tokens'}`}
        </button>
      ) : (
        <button className="btn btn-ghost btn-full" onClick={handleReset}>
          Make another transfer
        </button>
      )}

      {/* Transaction status */}
      {txHash && (
        <p className={`mt-sm ${isConfirmed ? 'success-text' : 'muted-text'}`}>
          {isConfirming && '⏳ Waiting for Hedera to confirm…'}
          {isConfirmed  && '✓ Transfer confirmed! '}
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
            <code>transfer(to, amountWei)</code> calls ERC-20's internal
            <code>_transfer(from, to, amount)</code>, which calls{' '}
            <code>_update(from, to, amount)</code>. Our override intercepts this:
          </p>
          <ol>
            <li>
              <strong>from</strong> (you) must be in the ComplianceRegistry.
              If not → <code>SenderNotCompliant</code> revert.
            </li>
            <li>
              <strong>to</strong> (recipient) must be in the ComplianceRegistry.
              If not → <code>RecipientNotCompliant</code> revert.
            </li>
            <li>
              Balance check: <code>from</code> must have ≥ <code>amountWei</code>.
              If not → <code>ERC20InsufficientBalance</code> revert.
            </li>
            <li>Balances updated. <code>Transfer(from, to, value)</code> event emitted.</li>
          </ol>
        </div>
      </details>
    </div>
  )
}
