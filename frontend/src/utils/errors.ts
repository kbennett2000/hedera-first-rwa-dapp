/**
 * errors.ts — Human-friendly contract error messages.
 *
 * WHY THIS IS NEEDED ON HEDERA:
 *   On Ethereum mainnet/testnets, a reverted transaction returns ABI-encoded
 *   revert data (e.g. the bytes for `RecipientNotCompliant(address)`), which
 *   viem decodes into a typed `ContractFunctionRevertedError`.
 *
 *   Hedera's HashIO JSON-RPC relay sometimes returns an HTTP 4xx status
 *   instead of the EVM revert payload, so viem only sees:
 *     "RPC endpoint returned HTTP client error"
 *   — losing all the useful on-chain context.
 *
 *   This utility handles BOTH cases:
 *   1. viem successfully decoded the custom error → check the error name
 *   2. viem got an opaque HTTP error → pattern-match the message string
 */

/**
 * Turn any contract/wallet error into a one-line message suitable for
 * displaying in the UI.
 *
 * @param error  Any error thrown by wagmi's writeContract or
 *               useWaitForTransactionReceipt.
 * @returns      A short, user-facing string.
 */
export function parseContractError(error: unknown): string {
  if (!error) return 'An unknown error occurred.'

  const raw = error instanceof Error ? error.message : String(error)

  // ── Custom errors from our Solidity contracts ──────────────────────────
  // viem may include the error name in the message, or the message itself
  // may contain the name when decoded from revert data.
  if (raw.includes('RecipientNotCompliant'))
    return 'Recipient is not KYC-approved. Ask the contract owner to approve that address in the compliance registry first.'

  if (raw.includes('SenderNotCompliant'))
    return 'Your wallet is not KYC-approved. Ask the contract owner to approve your address in the compliance registry.'

  if (raw.includes('ExceedsMaxSupply'))
    return 'This mint would exceed the token\'s maximum supply cap.'

  if (raw.includes('AlreadyApproved'))
    return 'That address is already approved in the compliance registry.'

  if (raw.includes('NotApproved'))
    return 'That address is not currently approved in the compliance registry.'

  if (raw.includes('ZeroAmount'))
    return 'Amount must be greater than zero.'

  if (raw.includes('ZeroAddress'))
    return 'Address cannot be the zero address.'

  if (raw.includes('OwnableUnauthorizedAccount'))
    return 'Only the contract owner can perform this action.'

  // ── Standard ERC-20 errors (OpenZeppelin v5) ───────────────────────────
  if (raw.includes('ERC20InsufficientBalance'))
    return 'Insufficient token balance for this transfer.'

  if (raw.includes('ERC20InvalidReceiver'))
    return 'Invalid recipient address.'

  if (raw.includes('ERC20InsufficientAllowance'))
    return 'Insufficient allowance. Call approve() before transferFrom().'

  // ── User-rejected in wallet ────────────────────────────────────────────
  if (
    raw.includes('User rejected') ||
    raw.includes('user rejected') ||
    raw.includes('rejected the request') ||
    raw.includes('User denied')
  ) {
    return 'Transaction cancelled in wallet.'
  }

  // ── Hedera-specific: RPC relay returned HTTP error instead of revert ───
  // This is the case the user hit — Hedera's HashIO doesn't always return
  // EVM revert data, so viem gets an HTTP client error. We can't know the
  // exact reason, but we can give a much more helpful message than the raw one.
  if (raw.includes('HTTP client error') || raw.includes('RPC endpoint')) {
    return (
      'Transaction rejected by the contract. ' +
      'This usually means a compliance check failed — ' +
      'check that both the sender and recipient are KYC-approved in the registry.'
    )
  }

  // ── Generic fallback: truncate very long viem error strings ───────────
  const firstLine = raw.split('\n')[0]
  return firstLine.length > 180 ? firstLine.slice(0, 180) + '…' : firstLine
}
