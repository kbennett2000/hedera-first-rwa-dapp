/**
 * WalletConnect — handles wallet connection state and display.
 *
 * This component shows one of three states:
 *   1. No wallet detected    → link to MetaMask download
 *   2. Disconnected          → "Connect Wallet" button
 *   3. Connected, wrong chain → address + "Switch to Hedera" button
 *   4. Connected, right chain → address + disconnect button
 *
 * WAGMI HOOKS USED:
 *   • useAccount()     — connected address, connection status
 *   • useConnect()     — connect to a wallet connector
 *   • useDisconnect()  — disconnect the wallet
 *   • useChainId()     — currently selected chain
 *   • useSwitchChain() — request a chain switch in MetaMask
 */

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { hederaTestnet } from '../config/wagmi'

/** Shorten 0x1234...abcd format for display */
function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function WalletConnect() {
  // useAccount: the core hook for wallet state
  // `status` can be: 'connecting' | 'reconnecting' | 'connected' | 'disconnected'
  const { address, status } = useAccount()

  // useConnect: provides the `connect` function and the list of connectors
  // A "connector" is an abstraction over a wallet (MetaMask, WalletConnect, etc.)
  const { connect, connectors, error: connectError } = useConnect()

  // useDisconnect: clears the wagmi wallet state
  const { disconnect } = useDisconnect()

  // useChainId: returns the chain ID the user's wallet is currently on
  const chainId = useChainId()

  // useSwitchChain: asks MetaMask to switch to a different network
  // MetaMask will add the network if the user hasn't seen it before
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const isConnected     = status === 'connected'
  const isOnRightChain  = chainId === hederaTestnet.id
  const isConnecting    = status === 'connecting' || status === 'reconnecting'

  // ── Not connected ────────────────────────────────────────────────────────
  if (!isConnected) {
    // connectors[0] is the `injected` connector (MetaMask) we configured
    const injectedConnector = connectors[0]
    const hasWallet = typeof window !== 'undefined' && !!window.ethereum

    return (
      <div className="wallet-section">
        {!hasWallet ? (
          <div className="wallet-no-provider">
            <span className="status-dot status-red" />
            <span>No wallet detected. </span>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              Install MetaMask →
            </a>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => connect({ connector: injectedConnector })}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        )}
        {connectError && (
          <p className="error-text">{connectError.message}</p>
        )}
      </div>
    )
  }

  // ── Connected but wrong network ───────────────────────────────────────────
  if (!isOnRightChain) {
    return (
      <div className="wallet-section wallet-row">
        <span className="address-badge">
          <span className="status-dot status-yellow" />
          {shortAddress(address!)}
        </span>
        <button
          className="btn btn-warning"
          onClick={() => switchChain({ chainId: hederaTestnet.id })}
          disabled={isSwitching}
          title="Your wallet is on a different network. Click to switch to Hedera Testnet."
        >
          {isSwitching ? 'Switching…' : 'Switch to Hedera Testnet'}
        </button>
      </div>
    )
  }

  // ── Connected and on the right network ───────────────────────────────────
  return (
    <div className="wallet-section wallet-row">
      <span className="address-badge">
        <span className="status-dot status-green" />
        {shortAddress(address!)}
      </span>
      <span className="chain-badge">Hedera Testnet</span>
      <button
        className="btn btn-ghost"
        onClick={() => disconnect()}
      >
        Disconnect
      </button>
    </div>
  )
}
