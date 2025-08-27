
import { http, createConfig } from 'wagmi'
import { avalancheFuji } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Re-export contract addresses from centralized config
export { CONTRACT_ADDRESSES } from './contracts'

export const config = createConfig({
  chains: [avalancheFuji],
  connectors: [
    injected(),
  ],
  transports: {
    [avalancheFuji.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
