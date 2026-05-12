/**
 * main.tsx — Application entry point.
 *
 * This is the first file Vite loads. It mounts the React application into
 * the <div id="root"> element in index.html.
 *
 * PROVIDER HIERARCHY:
 *
 *   React.StrictMode
 *     └── WagmiProvider         (wallet + contract interaction)
 *           └── QueryClientProvider  (data fetching & caching)
 *                 └── App        (your actual UI)
 *
 * Both providers must wrap the entire app because:
 *   • WagmiProvider makes the wagmi config available to all hooks via React context
 *   • QueryClientProvider makes the React Query cache available to wagmi
 *     (wagmi uses React Query internally for all its data fetching)
 *
 * StrictMode renders components twice in development to help catch bugs —
 * this is fine and expected behaviour.
 */

import { StrictMode }            from 'react'
import { createRoot }            from 'react-dom/client'
import { WagmiProvider }         from 'wagmi'
import { QueryClientProvider }   from '@tanstack/react-query'
import { wagmiConfig, queryClient } from './config/wagmi'
import { App }                   from './App'
import './index.css'

// document.getElementById('root')! — the `!` tells TypeScript "I know this
// element exists" (it's in index.html). We'd crash immediately if it didn't.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* wagmiConfig tells wagmi which chains and connectors are supported */}
    <WagmiProvider config={wagmiConfig}>
      {/* queryClient is the shared React Query cache */}
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
