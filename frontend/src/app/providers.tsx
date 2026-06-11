'use client';

import * as React from 'react';
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import { arbitrum, base, mainnet, optimism, polygon, sepolia, hardhat } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { publicEnv } from '@/lib/env';

/**
 * Web3 + data providers, in the exact order they need to nest:
 *   Wagmi (chain connection)
 *     -> ReactQuery (data fetching cache, used by wagmi + our /api hooks)
 *       -> RainbowKit (wallet UI)
 *
 * We pick chains in priority order — the first one is what new sessions
 * default to, configured via NEXT_PUBLIC_CHAIN_ID.
 */

const allChains = [hardhat, sepolia, polygon, mainnet, base, arbitrum, optimism] as const;
const preferred = allChains.find((c) => c.id === publicEnv.chainId) ?? hardhat;
const restChains = allChains.filter((c) => c.id !== preferred.id);

const wagmiConfig = getDefaultConfig({
  appName: 'StakePort',
  // WalletConnect requires a project id; we fall back to a dev sentinel that
  // disables WC but leaves injected wallets (MetaMask, Rabby) fully working.
  projectId: publicEnv.walletConnectProjectId,
  chains: [preferred, ...restChains] as unknown as readonly [typeof preferred, ...typeof restChains],
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Asset prices update on every trade event, but on-chain reads are
      // cheap enough that 10s of staleness keeps the UI snappy without
      // hammering RPC. Trade-side mutations refetch on success anyway.
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#3b82f6', // matches the "StakePort" blue
            accentColorForeground: 'white',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
