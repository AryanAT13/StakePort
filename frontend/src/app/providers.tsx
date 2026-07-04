'use client';

import * as React from 'react';
import { RainbowKitProvider, connectorsForWallets, darkTheme } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, WagmiProvider } from 'wagmi';
import { hardhat, sepolia } from 'wagmi/chains';
import { http } from 'viem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { publicEnv } from '@/lib/env';

/**
 * Web3 + data providers.
 *
 * Phase 8.3 — stop initialising WalletConnect.
 *
 * The previous build used RainbowKit's `getDefaultConfig`, which always
 * registers a WalletConnect connector under the hood. With our placeholder
 * `projectId="stakeport-dev"` that triggers two failing requests on every
 * page load:
 *
 *   GET https://api.web3modal.org/appkit/v1/config?projectId=stakeport-dev
 *       → 403 Forbidden
 *   POST https://pulse.walletconnect.org/e?projectId=stakeport-dev
 *       → 400 Bad Request
 *
 * They don't crash the app, but they fire on every render and saturate
 * the network panel. Switching to `createConfig` with hand-rolled
 * connectors (MetaMask, Rabby, generic injected) skips WalletConnect
 * entirely. Mobile wallets that require WC won't work, but for dev that
 * trade-off is correct.
 *
 * We also stay on the two chains we can actually hit (hardhat + sepolia)
 * so wagmi never spins up an ENS resolver against eth.merkle.io and
 * triggers the CORS cascade that was kicking users back to `/`.
 */

const CHAINS = [hardhat, sepolia] as const;
const preferred = CHAINS.find((c) => c.id === publicEnv.chainId) ?? hardhat;
const rest = CHAINS.filter((c) => c.id !== preferred.id);

// Connectors — injected family only. No walletConnectWallet ⇒ no AppKit init.
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, rabbyWallet, injectedWallet],
    },
  ],
  {
    appName: 'StakePort',
    projectId: publicEnv.walletConnectProjectId,
  }
);

// Transport per chain. Sepolia uses NEXT_PUBLIC_RPC_URL in production (a real
// Alchemy/Infura endpoint) so we're not hammering the flaky public RPC; it
// falls back to the public node only when the env var is unset (local dev).
const sepoliaRpc =
  publicEnv.chainId === sepolia.id && publicEnv.rpcUrl
    ? publicEnv.rpcUrl
    : 'https://ethereum-sepolia-rpc.publicnode.com';

const wagmiConfig = createConfig({
  chains: [preferred, ...rest] as unknown as readonly [typeof preferred, ...typeof rest],
  connectors,
  transports: {
    [hardhat.id]: http(publicEnv.rpcUrl),
    [sepolia.id]: http(sepoliaRpc),
  },
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#3b82f6',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
        >
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: '#09090b',
                border: '1px solid #27272a',
                color: '#e4e4e7',
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
