// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  ComplianceRegistry
 * @notice On-chain KYC/AML whitelist for Real World Asset token holders.
 *
 * ── EDUCATIONAL CONTEXT ─────────────────────────────────────────────────────
 *
 * Real World Asset (RWA) tokenization converts rights to physical or financial
 * assets — real estate, private equity, bonds, commodities — into blockchain
 * tokens. This unlocks 24/7 trading, fractional ownership, and global access.
 *
 * But RWA tokens face a challenge normal crypto doesn't: REGULATION.
 * Securities laws in most jurisdictions require:
 *   • KYC  (Know Your Customer)  — verifying investor identity
 *   • AML  (Anti-Money Laundering) — screening for illicit funds
 *   • Accredited investor checks  — ensuring investors meet wealth thresholds
 *
 * This contract is an on-chain registry of addresses that have passed those
 * checks off-chain. In a real production system:
 *   1. User completes identity verification with a KYC provider (Jumio, Onfido)
 *   2. An oracle or admin backend calls approveAddress() on success
 *   3. The RWA token checks this registry on every transfer
 *
 * ── CONTRACT DESIGN ─────────────────────────────────────────────────────────
 *
 * • Inherits Ownable — only the designated admin can approve/revoke
 * • Uses custom errors (gas-efficient vs. require strings since Solidity 0.8.4)
 * • Emits events with timestamps for off-chain audit trails
 * • Supports batch operations to reduce gas when onboarding many users
 *
 * @dev Deployed independently from RWAComplianceToken so the registry can
 *      be shared across multiple token contracts (a whole token suite can
 *      reference one registry).
 */
contract ComplianceRegistry is Ownable {

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /**
     * @dev Core data structure: maps address → approval status.
     *
     *      A Solidity `mapping` is a hash table. Reading costs ~800 gas (warm)
     *      or ~2100 gas (cold). Writing costs ~20,000 gas (new slot) or ~2900
     *      gas (updating existing slot).
     *
     *      `private` means only this contract can read it directly — external
     *      callers use isApproved() below. This lets us add logic later without
     *      breaking the public interface.
     */
    mapping(address => bool) private _approvedAddresses;

    /**
     * @dev Tracks total approved count for analytics / reporting.
     *      Could alternatively derive this from events, but storing it on-chain
     *      makes a single read cheap for the frontend.
     */
    uint256 private _totalApproved;

    // =========================================================================
    // EVENTS
    // =========================================================================
    //
    // Events are the primary way smart contracts communicate with the outside
    // world. They are stored in transaction logs — cheap to write (~375 gas per
    // topic), but NOT readable by other contracts. Ideal for frontends and
    // off-chain indexers (The Graph, etc.).
    //
    // `indexed` parameters can be filtered efficiently. Up to 3 per event.

    /**
     * @dev Fired when a new address is KYC-approved.
     * @param account     The newly approved wallet.
     * @param approvedBy  The admin who triggered the approval (for audit trail).
     * @param timestamp   Block timestamp when approval was granted.
     */
    event AddressApproved(
        address indexed account,
        address indexed approvedBy,
        uint256 timestamp
    );

    /**
     * @dev Fired when an address has its approval revoked.
     * @param account    The wallet losing compliance status.
     * @param revokedBy  The admin who triggered the revocation.
     * @param timestamp  Block timestamp of revocation.
     */
    event AddressRevoked(
        address indexed account,
        address indexed revokedBy,
        uint256 timestamp
    );

    // =========================================================================
    // CUSTOM ERRORS
    // =========================================================================
    //
    // Custom errors (introduced in Solidity 0.8.4) are ~50% cheaper than
    // require() with string messages. They also carry typed parameters for
    // richer debugging info in wallets and block explorers.

    /// @dev Thrown when approving an address that is already in the registry.
    error AlreadyApproved(address account);

    /// @dev Thrown when revoking an address that was never approved.
    error NotApproved(address account);

    /// @dev Thrown for any operation that receives address(0) incorrectly.
    error ZeroAddress();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * @dev OpenZeppelin's Ownable(msg.sender) sets the deployer as the initial
     *      owner. The owner is the only account that can call functions marked
     *      with the `onlyOwner` modifier.
     *
     *      The owner can later transfer ownership via transferOwnership() or
     *      renounceOwnership() (both inherited from Ownable).
     */
    constructor() Ownable(msg.sender) {}

    // =========================================================================
    // OWNER-ONLY WRITE FUNCTIONS
    // =========================================================================

    /**
     * @notice Approve a single address — marks them as KYC-passed.
     *
     * @dev The `external` visibility is slightly more gas-efficient than
     *      `public` for functions called only from outside the contract,
     *      because `external` parameters use calldata (read-only) rather
     *      than being copied to memory.
     *
     *      The `onlyOwner` modifier from OpenZeppelin inserts:
     *        require(msg.sender == owner(), "Ownable: caller is not the owner");
     *      before the function body executes.
     *
     * @param account Wallet address to approve.
     */
    function approveAddress(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        if (_approvedAddresses[account]) revert AlreadyApproved(account);

        _approvedAddresses[account] = true;
        _totalApproved++;

        emit AddressApproved(account, msg.sender, block.timestamp);
    }

    /**
     * @notice Approve multiple addresses in a single transaction.
     *
     * @dev WHY BATCH?
     *      Every Ethereum/Hedera transaction has a base cost of ~21,000 gas.
     *      If you need to approve 100 users, 100 separate transactions cost:
     *        100 × 21,000 = 2,100,000 gas in base fees alone.
     *      One batch transaction costs:
     *        21,000 + (100 × ~22,000) ≈ 2,221,000 gas total — similar total
     *        computation but MUCH cheaper in practice because you avoid 99
     *        separate base transaction fees.
     *
     *      `calldata` keyword: for array parameters in external functions,
     *      using `calldata` instead of `memory` saves gas because the data
     *      is read directly from the transaction without being copied.
     *
     * @param accounts Array of wallet addresses to approve.
     */
    function approveAddresses(address[] calldata accounts) external onlyOwner {
        uint256 length = accounts.length;

        for (uint256 i = 0; i < length; ) {
            address account = accounts[i];

            if (account == address(0)) revert ZeroAddress();

            // Skip already-approved addresses instead of reverting —
            // useful for idempotent batch operations
            if (!_approvedAddresses[account]) {
                _approvedAddresses[account] = true;
                _totalApproved++;
                emit AddressApproved(account, msg.sender, block.timestamp);
            }

            // `unchecked` block: skips Solidity's overflow protection for `i`.
            // Safe here because `i` can never realistically reach uint256.max.
            // Saves ~30 gas per iteration.
            unchecked { ++i; }
        }
    }

    /**
     * @notice Revoke compliance approval from a single address.
     *
     * @dev Revocation use cases in production:
     *      • Ongoing AML monitoring flags suspicious activity
     *      • User fails periodic re-verification
     *      • User requests removal (GDPR "right to be forgotten" — note: the
     *        event log is permanent on-chain, but you can stop future access)
     *      • Regulatory order to freeze a specific account
     *
     * @param account Wallet address to revoke.
     */
    function revokeAddress(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        if (!_approvedAddresses[account]) revert NotApproved(account);

        _approvedAddresses[account] = false;
        _totalApproved--;

        emit AddressRevoked(account, msg.sender, block.timestamp);
    }

    /**
     * @notice Revoke compliance approval from multiple addresses at once.
     * @param accounts Array of wallet addresses to revoke.
     */
    function revokeAddresses(address[] calldata accounts) external onlyOwner {
        uint256 length = accounts.length;

        for (uint256 i = 0; i < length; ) {
            address account = accounts[i];

            if (account == address(0)) revert ZeroAddress();

            if (_approvedAddresses[account]) {
                _approvedAddresses[account] = false;
                _totalApproved--;
                emit AddressRevoked(account, msg.sender, block.timestamp);
            }

            unchecked { ++i; }
        }
    }

    // =========================================================================
    // VIEW FUNCTIONS (free to call off-chain, costs gas when called on-chain)
    // =========================================================================

    /**
     * @notice Check whether an address is compliance-approved.
     *
     * @dev This is the PRIMARY function that RWAComplianceToken calls before
     *      every transfer. It is `external view` — read-only, so:
     *      • Costs zero gas when called off-chain (e.g., from a frontend)
     *      • Costs gas proportional to one SLOAD when called by another contract
     *
     * @param  account The address to check.
     * @return bool    True if approved to hold/transfer RWA tokens.
     */
    function isApproved(address account) external view returns (bool) {
        return _approvedAddresses[account];
    }

    /**
     * @notice Returns the count of currently approved addresses.
     * @return uint256 Number of approved addresses.
     */
    function totalApproved() external view returns (uint256) {
        return _totalApproved;
    }
}
