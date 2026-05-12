/**
 * wagmi configuration — sets up the wallet connection layer.
 *
 * wagmi is a React hooks library for Ethereum/EVM interactions.
 * It sits on top of viem (low-level EVM client) and React Query (caching).
 *
 * THREE LAYERS:
 *
 *   1. viem (transport layer)
 *      Handles raw JSON-RPC calls to the node:
 *        eth_call, eth_sendTransaction, eth_getTransactionReceipt, ...
 *
 *   2. wagmi (React integration layer)
 *      Wraps viem in React hooks with automatic re-fetching, caching,
 *      and wallet state management:
 *        useReadContract, useWriteContract, useAccount, useBalance, ...
 *
 *   3. @tanstack/react-query (caching layer)
 *      Powers wagmi's data fetching. Results are cached and shared across
 *      components — multiple components reading the same data = one RPC call.
 *
 * This file defines:
 *   • The Hedera Testnet chain definition
 *   • The wagmi config (which chains and connectors to support)
 *   • A React Query client for wagmi to use
 */

import { createConfig, http } from 'wagmi'
import { injected }           from 'wagmi/connectors'
import { defineChain }        from 'viem'
import { QueryClient }        from '@tanstack/react-query'

// ── Hedera Testnet chain definition ──────────────────────────────────────────
//
// Hedera isn't in viem's built-in chain list yet, so we define it ourselves.
// `defineChain` is viem's helper for creating a strongly-typed chain object.
export const hederaTestnet = defineChain({
  id: 296,                    // Hedera Testnet chain ID
  name: 'Hedera Testnet',
  nativeCurrency: {
    name: 'HBAR',
    symbol: 'HBAR',
    decimals: 18,              // Hedera uses 18 decimals for HBAR in EVM context
  },
  rpcUrls: {
    default: {
      // HashIO is Hedera's official public JSON-RPC relay
      // For production apps, consider running your own relay or using a provider
      http: ['https://testnet.hashio.io/api'],
    },
  },
  blockExplorers: {
    default: {
      name: 'HashScan',
      url: 'https://hashscan.io/testnet',
      // The API URL is used for contract verification (optional)
      apiUrl: 'https://api.hashscan.io/api',
    },
  },
  testnet: true,               // Marks this as a test network in MetaMask
})

// ── wagmi config ─────────────────────────────────────────────────────────────
//
// `createConfig` is the central configuration object.
// It tells wagmi:
//   • Which chains to support
//   • How to connect to each chain (via RPC transport)
//   • Which wallet connectors to enable
export const wagmiConfig = createConfig({
  chains: [hederaTestnet],

  // Connectors define how users connect their wallets.
  // `injected()` supports MetaMask, Rabby, Brave Wallet, and any other
  // wallet that injects window.ethereum into the browser.
  connectors: [
    injected({
      // Show a helpful message if no wallet is detected
      shimDisconnect: true,
    }),
  ],

  // Transports map each chain ID to an RPC transport.
  // `http()` creates a JSON-RPC transport (plain HTTP requests).
  // You can also pass a custom URL: http('https://my-rpc.example.com')
  transports: {
    [hederaTestnet.id]: http(),
  },
})

// ── React Query client ────────────────────────────────────────────────────────
//
// wagmi uses React Query under the hood for all data fetching.
// We create a shared QueryClient and pass it to both:
//   • QueryClientProvider  (React Query setup)
//   • WagmiProvider        (wagmi setup)
//
// `staleTime` of 10 seconds: contract reads are re-fetched when the cached
// data is older than 10 seconds. Lower = more up-to-date but more RPC calls.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000, // 10 seconds
    },
  },
})
