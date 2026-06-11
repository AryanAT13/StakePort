import { createPublicClient, http, defineChain, type Chain } from "viem";
import { hardhat, sepolia, polygon, mainnet } from "viem/chains";
import { publicEnv } from "./env";

/**
 * One viem public client used by every server route and chart component.
 *
 * Why this exists: components were each spinning up their own
 * createPublicClient({ chain: hardhat, ... }), which (a) hard-coded hardhat,
 * (b) meant the chain couldn't be switched via env, and (c) re-allocated
 * websocket transports on every render in some cases.
 */

const knownChains: Record<number, Chain> = {
  [hardhat.id]: hardhat,
  [sepolia.id]: sepolia,
  [polygon.id]: polygon,
  [mainnet.id]: mainnet,
};

export function getChain(): Chain {
  const c = knownChains[publicEnv.chainId];
  if (c) return c;
  // Fallback: synthesise a minimal chain so the app still boots on an
  // unknown id (e.g. a forked testnet). RPC url comes from env.
  return defineChain({
    id: publicEnv.chainId,
    name: `Chain ${publicEnv.chainId}`,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [publicEnv.rpcUrl] } },
  });
}

let _client: ReturnType<typeof createPublicClient> | null = null;
export function getPublicClient() {
  if (_client) return _client;
  _client = createPublicClient({
    chain: getChain(),
    transport: http(publicEnv.rpcUrl),
  });
  return _client;
}
