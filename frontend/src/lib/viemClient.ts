import { createPublicClient, http, defineChain, type Chain } from "viem";
import { hardhat, sepolia, polygon, mainnet } from "viem/chains";
import { publicEnv } from "./env";
import { getRpcUrl } from "./rpc";

/**
 * One viem public client used by every server route.
 *
 * Why this exists: components were each spinning up their own
 * createPublicClient({ chain: hardhat, ... }), which (a) hard-coded hardhat,
 * (b) meant the chain couldn't be switched via env, and (c) re-allocated
 * transports on every render in some cases.
 *
 * The RPC url comes from `getRpcUrl()` (sanitized + validated) so a dirty env
 * value can never produce a malformed request.
 */

const knownChains: Record<number, Chain> = {
  [hardhat.id]: hardhat,
  [sepolia.id]: sepolia,
  [polygon.id]: polygon,
  [mainnet.id]: mainnet,
};

export function getChain(): Chain {
  const rpc = getRpcUrl();
  const base = knownChains[publicEnv.chainId];
  if (base) {
    return {
      ...base,
      rpcUrls: {
        ...base.rpcUrls,
        default: { http: [rpc] },
        public: { http: [rpc] },
      },
    };
  }
  // Fallback: synthesise a minimal chain so the app still boots on an
  // unknown id (e.g. a forked testnet). RPC url comes from env.
  return defineChain({
    id: publicEnv.chainId,
    name: `Chain ${publicEnv.chainId}`,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
}

let _client: ReturnType<typeof createPublicClient> | null = null;
export function getPublicClient() {
  if (_client) return _client;
  _client = createPublicClient({
    chain: getChain(),
    transport: http(getRpcUrl()),
  });
  return _client;
}
