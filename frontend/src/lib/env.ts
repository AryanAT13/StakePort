/**
 * Client + server safe env access.
 *
 * Anything that needs a server secret (JWT_SECRET, PINATA_JWT, AI_ENGINE_URL)
 * lives in `env.server.ts` — that file is guarded with `import 'server-only'`
 * so accidental client imports fail at build time. This file holds only the
 * NEXT_PUBLIC_* values that Next inlines into the browser bundle.
 */

function optional(value: string | undefined, fallback: string): string {
  return value && value !== "" ? value : fallback;
}

export const publicEnv = {
  // 31337 = Hardhat local. Default keeps `npm run dev` working with no setup.
  chainId: Number(optional(process.env.NEXT_PUBLIC_CHAIN_ID, "31337")),
  // Raw RPC value from the env. It may arrive dirty (quotes/whitespace on
  // Vercel) — do NOT hand this straight to a transport. Consume it via
  // `getRpcUrl()` in lib/rpc.ts, which sanitizes + validates it.
  rpcUrl: optional(process.env.NEXT_PUBLIC_RPC_URL, "http://127.0.0.1:8545"),
  blockExplorer: optional(process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL, ""),
  mockUsdcAddress: optional(
    process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS,
    "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  ) as `0x${string}`,
  assetFactoryAddress: optional(
    process.env.NEXT_PUBLIC_ASSET_FACTORY_ADDRESS,
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
  ) as `0x${string}`,
  walletConnectProjectId: optional(
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    "stakeport-dev"
  ),
};

export const siweConfig = {
  appName: "StakePort",
  statement:
    "Sign in to StakePort. This signature unlocks your profile, holdings, and trading dashboard. No transaction, no gas.",
};
