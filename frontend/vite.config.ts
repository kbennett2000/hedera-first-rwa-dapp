import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite configuration for the Hedera RWA DApp frontend.
 *
 * Vite is a modern build tool that:
 * • Serves files with native ES modules during development (no bundling needed)
 * • Uses Rollup to produce an optimised production bundle
 * • Has near-instant Hot Module Replacement (HMR) — edits reflect in < 50ms
 *
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  plugins: [
    // @vitejs/plugin-react enables:
    // • JSX transform (no need to import React in every file)
    // • Fast Refresh (preserves component state across HMR updates)
    react(),
  ],

  // Vite resolves these as global constants at build time.
  // process.env is not available in the browser by default — this shim
  // prevents crashes from libraries that reference it.
  define: {
    'process.env': {},
  },
})
