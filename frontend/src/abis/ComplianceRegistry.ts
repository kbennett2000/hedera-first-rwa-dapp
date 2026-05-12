/**
 * ComplianceRegistry ABI — Application Binary Interface
 *
 * The ABI is the "contract interface" that tells your JavaScript code how to
 * encode function calls and decode return values when talking to a Solidity
 * contract.
 *
 * Think of it like a TypeScript type definition for a remote API:
 * • function name and parameter types → used to encode the calldata
 * • return types → used to decode the bytes the EVM sends back
 * • events → used to decode log entries in transaction receipts
 *
 * WHY `as const`?
 * Without it, TypeScript infers the types as `string`, `boolean`, etc.
 * With `as const`, TypeScript infers the exact literal types
 * (e.g., `"address"` not just `string`). wagmi uses these literal types
 * to give you full type inference on hook arguments and return values.
 */
export const complianceRegistryAbi = [
  // ── Constructor ──────────────────────────────────────────────────────────
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Custom Errors ────────────────────────────────────────────────────────
  // These are thrown by `revert` statements in the contract.
  // wagmi/viem decodes them automatically so your catch blocks get typed errors.
  {
    type: 'error',
    name: 'AlreadyApproved',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'NotApproved',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
  // From OpenZeppelin Ownable:
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
  },

  // ── Events ───────────────────────────────────────────────────────────────
  // `indexed` parameters are stored as topics in the log, making them
  // filterable. Non-indexed parameters are in the log data (cheaper to store).
  {
    type: 'event',
    name: 'AddressApproved',
    inputs: [
      { name: 'account',    type: 'address', indexed: true,  internalType: 'address' },
      { name: 'approvedBy', type: 'address', indexed: true,  internalType: 'address' },
      { name: 'timestamp',  type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'AddressRevoked',
    inputs: [
      { name: 'account',   type: 'address', indexed: true,  internalType: 'address' },
      { name: 'revokedBy', type: 'address', indexed: true,  internalType: 'address' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'newOwner',      type: 'address', indexed: true, internalType: 'address' },
    ],
  },

  // ── Write Functions (cost gas, change blockchain state) ─────────────────
  {
    type: 'function',
    name: 'approveAddress',
    inputs:  [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approveAddresses',
    inputs:  [{ name: 'accounts', type: 'address[]', internalType: 'address[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeAddress',
    inputs:  [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeAddresses',
    inputs:  [{ name: 'accounts', type: 'address[]', internalType: 'address[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs:  [{ name: 'newOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs:  [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Read Functions (free, don't change state) ────────────────────────────
  {
    type: 'function',
    name: 'isApproved',
    inputs:  [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalApproved',
    inputs:  [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs:  [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
] as const
