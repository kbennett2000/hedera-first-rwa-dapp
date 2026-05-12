/**
 * App.tsx — Root layout component.
 *
 * Responsibilities:
 *   1. Show a "deploy contracts first" banner if addresses are zeros
 *   2. Show a "wrong network" banner if the wallet is on the wrong chain
 *   3. Lay out the five main components in a readable 2-column grid
 *
 * The actual logic lives in the individual components — App is just layout.
 */

import { useChainId } from 'wagmi'
import { WalletConnect }     from './components/WalletConnect'
import { TokenInfo }         from './components/TokenInfo'
import { ComplianceStatus }  from './components/ComplianceStatus'
import { MintForm }          from './components/MintForm'
import { TransferForm }      from './components/TransferForm'
import { isDeployed, CHAIN_ID, TOKEN_ADDRESS, REGISTRY_ADDRESS } from './config/contracts'
import { hederaTestnet } from './config/wagmi'

export function App() {
  const chainId = useChainId()
  const isWrongChain = chainId !== hederaTestnet.id

  return (
    <div className="app-wrapper">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <span className="header-logo">⬡</span>
            <div>
              <h1 className="header-title">Hedera RWA DApp</h1>
              <p className="header-subtitle">Real World Asset Token — Educational Demo</p>
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="app-main">

        {/* Not-deployed banner */}
        {!isDeployed && (
          <div className="banner banner-yellow">
            <strong>Contracts not deployed yet.</strong>
            <p>
              Run <code>npm run deploy</code> from the project root to deploy to Hedera Testnet,
              then refresh this page. The deploy script will automatically update{' '}
              <code>frontend/src/config/deployments.json</code>.
            </p>
          </div>
        )}

        {/* Wrong network banner (only shown when connected) */}
        {isWrongChain && isDeployed && (
          <div className="banner banner-orange">
            <strong>Wrong network.</strong>{' '}
            Please switch your wallet to{' '}
            <strong>Hedera Testnet (Chain ID {CHAIN_ID})</strong>.
            Click "Switch to Hedera Testnet" in the header.
          </div>
        )}

        {/* Contract address info bar */}
        {isDeployed && (
          <div className="address-bar">
            <span className="address-bar-item">
              <span className="address-bar-label">Token:</span>
              <code className="address-bar-value">{TOKEN_ADDRESS}</code>
            </span>
            <span className="address-bar-item">
              <span className="address-bar-label">Registry:</span>
              <code className="address-bar-value">{REGISTRY_ADDRESS}</code>
            </span>
          </div>
        )}

        {/* ── Component Grid ─────────────────────────────────────────────── */}
        <div className="grid">
          {/* Left column: read-only information panels */}
          <div className="grid-col">
            <TokenInfo />
            <ComplianceStatus />
          </div>

          {/* Right column: action forms */}
          <div className="grid-col">
            <MintForm />
            <TransferForm />
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="app-footer">
        <p>
          Educational project — built on{' '}
          <a href="https://hedera.com" target="_blank" rel="noreferrer" className="link">
            Hedera
          </a>{' '}
          with{' '}
          <a href="https://hardhat.org" target="_blank" rel="noreferrer" className="link">
            Hardhat
          </a>{' '}
          +{' '}
          <a href="https://wagmi.sh" target="_blank" rel="noreferrer" className="link">
            wagmi
          </a>{' '}
          +{' '}
          <a href="https://viem.sh" target="_blank" rel="noreferrer" className="link">
            viem
          </a>
        </p>
      </footer>
    </div>
  )
}
