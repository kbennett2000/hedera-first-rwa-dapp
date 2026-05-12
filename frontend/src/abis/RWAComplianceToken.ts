/**
 * RWAComplianceToken ABI
 *
 * This token inherits from OpenZeppelin ERC20 + Ownable, so its ABI includes
 * all the standard ERC-20 functions plus our custom compliance additions.
 *
 * Key additions over a standard ERC-20:
 *   • mint()              — owner-only token issuance
 *   • setComplianceEnabled() — toggle compliance enforcement
 *   • getTokenInfo()      — batch-read all metadata in one call
 *   • canTransact()       — check if an address can participate in transfers
 *   • MAX_SUPPLY          — hard supply cap
 *   • complianceEnabled   — current enforcement status
 *   • complianceRegistry  — address of the linked ComplianceRegistry
 */
export const rwaTokenAbi = [
  // ── Constructor ──────────────────────────────────────────────────────────
  {
    type: 'constructor',
    inputs: [
      { name: 'name_',            type: 'string',  internalType: 'string'  },
      { name: 'symbol_',          type: 'string',  internalType: 'string'  },
      { name: 'maxSupply_',       type: 'uint256', internalType: 'uint256' },
      { name: 'registryAddress',  type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },

  // ── Custom Errors ────────────────────────────────────────────────────────
  {
    type: 'error',
    name: 'SenderNotCompliant',
    inputs: [{ name: 'sender', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'RecipientNotCompliant',
    inputs: [{ name: 'recipient', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'ExceedsMaxSupply',
    inputs: [
      { name: 'requested',  type: 'uint256', internalType: 'uint256' },
      { name: 'available',  type: 'uint256', internalType: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
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
  // Standard ERC-20 errors (OpenZeppelin v5)
  {
    type: 'error',
    name: 'ERC20InsufficientBalance',
    inputs: [
      { name: 'sender',  type: 'address', internalType: 'address' },
      { name: 'balance', type: 'uint256', internalType: 'uint256' },
      { name: 'needed',  type: 'uint256', internalType: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidSender',
    inputs: [{ name: 'sender', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'ERC20InvalidReceiver',
    inputs: [{ name: 'receiver', type: 'address', internalType: 'address' }],
  },

  // ── Events ───────────────────────────────────────────────────────────────
  // Standard ERC-20 events — every wallet and block explorer knows these
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from',  type: 'address', indexed: true,  internalType: 'address' },
      { name: 'to',    type: 'address', indexed: true,  internalType: 'address' },
      { name: 'value', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner',   type: 'address', indexed: true,  internalType: 'address' },
      { name: 'spender', type: 'address', indexed: true,  internalType: 'address' },
      { name: 'value',   type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  // Custom events
  {
    type: 'event',
    name: 'TokensMinted',
    inputs: [
      { name: 'to',       type: 'address', indexed: true,  internalType: 'address' },
      { name: 'amount',   type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'mintedBy', type: 'address', indexed: true,  internalType: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'ComplianceStatusChanged',
    inputs: [
      { name: 'enabled',   type: 'bool',    indexed: false, internalType: 'bool'    },
      { name: 'changedBy', type: 'address', indexed: true,  internalType: 'address' },
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

  // ── Write Functions ──────────────────────────────────────────────────────
  // Standard ERC-20 writes
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to',    type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from',  type: 'address', internalType: 'address' },
      { name: 'to',    type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'value',   type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  // Custom writes
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to',     type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setComplianceEnabled',
    inputs: [{ name: 'enabled', type: 'bool', internalType: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Read Functions ───────────────────────────────────────────────────────
  // Standard ERC-20 reads
  {
    type: 'function',
    name: 'name',
    inputs:  [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs:  [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs:  [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs:  [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs:  [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs:  [
      { name: 'owner',   type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Custom reads
  {
    type: 'function',
    name: 'owner',
    inputs:  [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_SUPPLY',
    inputs:  [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'complianceEnabled',
    inputs:  [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'complianceRegistry',
    inputs:  [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    // Returns all token metadata in one RPC call — saves 5 round-trips
    type: 'function',
    name: 'getTokenInfo',
    inputs: [],
    outputs: [
      { name: 'tokenName',          type: 'string',  internalType: 'string'  },
      { name: 'tokenSymbol',        type: 'string',  internalType: 'string'  },
      { name: 'tokenDecimals',      type: 'uint8',   internalType: 'uint8'   },
      { name: 'currentSupply',      type: 'uint256', internalType: 'uint256' },
      { name: 'maxSupplyCap',       type: 'uint256', internalType: 'uint256' },
      { name: 'isComplianceActive', type: 'bool',    internalType: 'bool'    },
    ],
    stateMutability: 'view',
  },
  {
    // Returns compliance status for a given address in one call
    type: 'function',
    name: 'canTransact',
    inputs:  [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'allowed',            type: 'bool', internalType: 'bool' },
      { name: 'isRegistryApproved', type: 'bool', internalType: 'bool' },
      { name: 'isComplianceActive', type: 'bool', internalType: 'bool' },
    ],
    stateMutability: 'view',
  },
] as const
