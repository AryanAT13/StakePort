/**
 * Client-side public chain config — small wrapper so chart / activity
 * components can share one viem PublicClient instead of each spinning up
 * their own with hard-coded `hardhat`.
 *
 * We deliberately mirror the server's lib/viemClient but keep them separate:
 *   - server is allowed to use the private RPC url
 *   - client must use the public one (it ships in the bundle)
 * For now they happen to be identical, but separating now means we don't
 * accidentally leak a private RPC later.
 */
import { createPublicClient, http, defineChain, type Chain } from "viem";
import { hardhat, sepolia, polygon, mainnet, base, arbitrum, optimism } from "viem/chains";
import { publicEnv } from "./env";
import { getRpcUrl } from "./rpc";

const known: Record<number, Chain> = {
  [hardhat.id]: hardhat,
  [sepolia.id]: sepolia,
  [polygon.id]: polygon,
  [mainnet.id]: mainnet,
  [base.id]: base,
  [arbitrum.id]: arbitrum,
  [optimism.id]: optimism,
};

export function getClientChain(): Chain {
  // Always overlay our resolved RPC url onto the chain's rpcUrls so viem never
  // reaches for its bundled public endpoint.
  const rpc = getRpcUrl();
  const base = known[publicEnv.chainId];
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
  return defineChain({
    id: publicEnv.chainId,
    name: `Chain ${publicEnv.chainId}`,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
}

let _client: ReturnType<typeof createPublicClient> | null = null;
export function getClientPublicClient() {
  if (_client) return _client;
  _client = createPublicClient({
    chain: getClientChain(),
    // Sanitized, validated absolute URL — never a raw env string.
    transport: http(getRpcUrl()),
  });
  return _client;
}

/** Build a transaction explorer URL, or `null` if no explorer is configured. */
export function explorerTxUrl(hash: string): string | null {
  if (!publicEnv.blockExplorer) return null;
  return `${publicEnv.blockExplorer.replace(/\/$/, "")}/tx/${hash}`;
}
