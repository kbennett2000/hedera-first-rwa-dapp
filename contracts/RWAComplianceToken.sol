// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ComplianceRegistry.sol";

/**
 * @title  RWAComplianceToken
 * @notice Permissioned ERC-20 token representing a tokenized Real World Asset.
 *         Every transfer and mint is gated by the ComplianceRegistry.
 *
 * ── EDUCATIONAL CONTEXT ─────────────────────────────────────────────────────
 *
 * Standard ERC-20 tokens are fully permissionless — anyone can send tokens to
 * anyone. This is great for DeFi, but illegal for security tokens and RWAs,
 * where regulators require:
 *   • Both sender AND receiver to be KYC-verified
 *   • The issuer to maintain a cap table (who holds what)
 *   • Controlled issuance (tokens represent real asset units)
 *
 * This contract implements a "permissioned ERC-20" pattern:
 *   1. Inherits standard OpenZeppelin ERC20 for all the boring token plumbing
 *   2. Overrides the internal `_update` hook to inject compliance checks
 *   3. Provides owner-only mint for controlled token issuance
 *
 * The result: it looks exactly like a normal ERC-20 to wallets and DEXes,
 * but silently enforces compliance at the protocol level.
 *
 * ── REAL-WORLD ANALOGY ──────────────────────────────────────────────────────
 *
 * Imagine tokenizing a $10M commercial real estate property:
 *   • Issue 10,000 tokens at $1,000 face value each (= $10M total)
 *   • Each token represents a 0.01% ownership stake
 *   • Only accredited investors (KYC'd in the registry) can hold tokens
 *   • Transfers on a secondary market automatically enforce compliance
 *
 * ── INHERITANCE CHAIN ───────────────────────────────────────────────────────
 *
 *   RWAComplianceToken
 *     ├── ERC20        (balance tracking, transfer logic, allowances)
 *     └── Ownable      (admin control for mint and compliance toggle)
 *
 * @dev Uses OpenZeppelin v5, which changed the internal hook from
 *      `_beforeTokenTransfer` (v4) to `_update` (v5). This is important
 *      if you're migrating older contracts.
 */
contract RWAComplianceToken is ERC20, Ownable {

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /**
     * @dev Reference to the deployed ComplianceRegistry contract.
     *
     *      `immutable` — written once in the constructor, then baked directly
     *      into the contract's runtime bytecode. Reading an immutable costs
     *      only 3 gas (vs. ~2100 gas for a cold storage read). Perfect for
     *      values that never change after deployment.
     *
     *      `public` — Solidity auto-generates a getter function called
     *      `complianceRegistry()` that returns this address.
     */
    ComplianceRegistry public immutable complianceRegistry;

    /**
     * @dev Hard cap on the total token supply.
     *
     *      In our real estate example: if the property is $10M and each token
     *      is worth $1 in base units, MAX_SUPPLY would be 10,000,000 tokens.
     *
     *      Note: internally we multiply by 10^18 in the constructor to account
     *      for token decimals (standard ERC-20 precision).
     */
    uint256 public immutable MAX_SUPPLY;

    /**
     * @dev Whether compliance checks are currently being enforced.
     *
     *      Default: true (always enforced).
     *
     *      When false, the token behaves like a standard ERC-20 — useful for:
     *        • Emergency redemptions during asset liquidation
     *        • Contract migration periods
     *        • Local development/testing without setting up KYC
     */
    bool public complianceEnabled;

    // =========================================================================
    // EVENTS
    // =========================================================================

    /**
     * @dev Emitted when new tokens are issued to an investor.
     * @param to        Recipient wallet (must be KYC-approved).
     * @param amount    Tokens minted in wei (18 decimal units).
     * @param mintedBy  Admin who triggered the issuance.
     */
    event TokensMinted(
        address indexed to,
        uint256 amount,
        address indexed mintedBy
    );

    /**
     * @dev Emitted when the compliance enforcement mode changes.
     * @param enabled   New state of compliance enforcement.
     * @param changedBy Admin who made the change.
     */
    event ComplianceStatusChanged(bool enabled, address indexed changedBy);

    // =========================================================================
    // CUSTOM ERRORS
    // =========================================================================

    /// @dev Transfer/mint rejected because the sender isn't KYC-approved.
    error SenderNotCompliant(address sender);

    /// @dev Transfer/mint rejected because the recipient isn't KYC-approved.
    error RecipientNotCompliant(address recipient);

    /// @dev Mint would push total supply above MAX_SUPPLY.
    error ExceedsMaxSupply(uint256 requested, uint256 available);

    /// @dev Cannot mint zero tokens.
    error ZeroAmount();

    /// @dev Cannot mint to the zero address.
    error ZeroAddress();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * @dev Deploy the RWA token and wire it to a ComplianceRegistry.
     *
     * @param name_             Token name       e.g., "Manhattan Office Token"
     * @param symbol_           Ticker symbol    e.g., "MOT"
     * @param maxSupply_        Max supply in WHOLE tokens (we convert to wei)
     *                          e.g., pass 10000000 for 10 million tokens
     * @param registryAddress   Address of the already-deployed ComplianceRegistry
     *
     * Constructor call chain:
     *   ERC20(name_, symbol_)  → stores name & symbol, sets decimals to 18
     *   Ownable(msg.sender)    → stores deployer as owner
     *   then our body runs     → validates inputs, stores registry & cap
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        address registryAddress
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        require(registryAddress != address(0), "Registry cannot be zero address");
        require(maxSupply_ > 0, "Max supply must be positive");

        complianceRegistry = ComplianceRegistry(registryAddress);

        // Convert from whole-token units to wei (smallest unit)
        // decimals() returns 18 for standard ERC-20
        // Example: 1,000,000 tokens × 10^18 = 1_000_000_000_000_000_000_000_000 wei
        MAX_SUPPLY = maxSupply_ * (10 ** decimals());

        // Compliance is active from day one
        complianceEnabled = true;
    }

    // =========================================================================
    // OWNER-ONLY FUNCTIONS
    // =========================================================================

    /**
     * @notice Issue (mint) new tokens to a KYC-approved investor.
     *
     * @dev In the real-estate analogy: minting represents the initial sale of
     *      token shares to investors. Only the asset issuer (owner) can do this.
     *
     *      Why check compliance here AND in _update?
     *        • mint() provides a clear, gas-efficient early revert with a
     *          descriptive error BEFORE any state changes
     *        • _update is the ultimate safety net — it catches any path
     *          that reaches balance modification
     *      This is a defense-in-depth pattern.
     *
     * @param to     Recipient address. Must be approved in ComplianceRegistry.
     * @param amount Number of WHOLE tokens to mint (we convert to wei internally).
     *               Example: pass 100 to mint 100 tokens (not 100 wei).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Convert whole tokens to wei
        uint256 amountWei = amount * (10 ** decimals());

        // Supply cap check
        uint256 available = MAX_SUPPLY - totalSupply();
        if (amountWei > available) revert ExceedsMaxSupply(amountWei, available);

        // Compliance check before minting
        if (complianceEnabled && !complianceRegistry.isApproved(to)) {
            revert RecipientNotCompliant(to);
        }

        // OpenZeppelin's internal _mint: updates balance + totalSupply, emits Transfer
        _mint(to, amountWei);

        emit TokensMinted(to, amountWei, msg.sender);
    }

    /**
     * @notice Enable or disable compliance enforcement.
     *
     * @dev This is an administrative escape hatch. In production, disabling
     *      compliance would likely require a timelock or multi-sig to prevent
     *      unilateral action by a single admin key.
     *
     * @param enabled True = enforce KYC on all transfers. False = open transfers.
     */
    function setComplianceEnabled(bool enabled) external onlyOwner {
        complianceEnabled = enabled;
        emit ComplianceStatusChanged(enabled, msg.sender);
    }

    // =========================================================================
    // ERC-20 HOOK OVERRIDE — THE COMPLIANCE ENFORCEMENT ENGINE
    // =========================================================================

    /**
     * @dev CORE MECHANISM: Override the internal ERC-20 balance-update hook
     *      to inject compliance checks on every single token movement.
     *
     *      OpenZeppelin ERC-20 v5 calls `_update(from, to, value)` for ALL
     *      operations that change balances:
     *
     *        ┌─────────────────┬──────────────────┬───────────────────┐
     *        │   Operation     │   `from` value   │   `to` value      │
     *        ├─────────────────┼──────────────────┼───────────────────┤
     *        │ _mint           │  address(0)      │  recipient        │
     *        │ _burn           │  token holder    │  address(0)       │
     *        │ transfer        │  sender          │  recipient        │
     *        │ transferFrom    │  token holder    │  spender's target │
     *        └─────────────────┴──────────────────┴───────────────────┘
     *
     *      By overriding this ONE function, we cover every case automatically.
     *      This is much more robust than trying to override transfer() and
     *      transferFrom() separately.
     *
     *      Logic:
     *        • Mints  (from == 0): check recipient only
     *        • Burns  (to == 0):   check sender only
     *        • Transfer:           check BOTH sender and recipient
     *
     * @param from  Sender address (address(0) for mints).
     * @param to    Recipient address (address(0) for burns).
     * @param value Amount of tokens being moved (in wei).
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        // Fast path: compliance disabled → behave like a normal ERC-20
        if (!complianceEnabled) {
            super._update(from, to, value);
            return;
        }

        bool isMint = (from == address(0));
        bool isBurn = (to   == address(0));

        // Check the SENDER's compliance (skip for mints — no real sender)
        if (!isMint && !complianceRegistry.isApproved(from)) {
            revert SenderNotCompliant(from);
        }

        // Check the RECIPIENT's compliance (skip for burns — tokens are destroyed)
        if (!isBurn && !complianceRegistry.isApproved(to)) {
            revert RecipientNotCompliant(to);
        }

        // All checks passed — delegate to ERC20's _update to actually
        // modify the balances and emit the Transfer event.
        super._update(from, to, value);
    }

    // =========================================================================
    // VIEW FUNCTIONS — Convenient read-only helpers for the frontend
    // =========================================================================

    /**
     * @notice Fetch all key token metadata in a single RPC call.
     *
     * @dev Why batch reads?
     *      Each eth_call has ~100–200ms of network overhead. Fetching 6 values
     *      separately = 6 round trips. One multicall = 1 round trip.
     *      On a dApp with many users, this matters for responsiveness.
     *
     * @return tokenName          Full token name
     * @return tokenSymbol        Ticker symbol
     * @return tokenDecimals      Decimal places (always 18 for this contract)
     * @return currentSupply      Tokens currently in circulation (in wei)
     * @return maxSupplyCap       Hard supply ceiling (in wei)
     * @return isComplianceActive Whether compliance checks are enforced right now
     */
    function getTokenInfo() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8  tokenDecimals,
        uint256 currentSupply,
        uint256 maxSupplyCap,
        bool    isComplianceActive
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_SUPPLY,
            complianceEnabled
        );
    }

    /**
     * @notice Check if an address can currently send and receive tokens.
     *
     * @dev Combines the registry lookup with compliance-enabled status so the
     *      frontend can show a single "can trade" indicator without needing to
     *      make two contract calls.
     *
     * @param  account            The wallet address to check.
     * @return allowed            True if the address can participate in transfers.
     * @return isRegistryApproved Whether they are whitelisted in the registry.
     * @return isComplianceActive Whether compliance enforcement is currently on.
     */
    function canTransact(address account) external view returns (
        bool allowed,
        bool isRegistryApproved,
        bool isComplianceActive
    ) {
        bool registryApproved = complianceRegistry.isApproved(account);
        bool complianceActive = complianceEnabled;
        bool _allowed = !complianceActive || registryApproved;

        return (_allowed, registryApproved, complianceActive);
    }
}
