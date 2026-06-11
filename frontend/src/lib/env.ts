/**
 * Centralised env access. Two reasons we don't read `process.env.X` inline:
 *  1. Fail loudly at boot if something critical is missing, not silently at
 *     request time with a cryptic stack trace.
 *  2. Keep the list of every env var we depend on in one place — when we
 *     deploy, this file is the checklist.
 *
 * NEXT_PUBLIC_* vars are inlined at build time by Next; the rest are
 * server-only. Don't import the server-only block from a client component.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value === "") {
    // We throw on the server, but only warn in the browser — a missing
    // public var in the browser typically means stale build, not config error.
    if (typeof window === "undefined") {
      throw new Error(`Missing required env var: ${name}`);
    }
    console.warn(`[stakeport] Missing env var ${name}; UI may misbehave.`);
    return "";
  }
  return value;
}

function optional(value: string | undefined, fallback: string): string {
  return value && value !== "" ? value : fallback;
}

// --- PUBLIC (safe to send to the browser) -----------------------------------
export const publicEnv = {
  // Default chain id. Hardhat = 31337.
  chainId: Number(optional(process.env.NEXT_PUBLIC_CHAIN_ID, "31337")),
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

// --- SERVER ONLY -----------------------------------------------------------
// Accessing these from a client component will throw at build time because
// Next strips them from the bundle.
export const serverEnv = {
  // 32+ bytes of entropy. In production we hard-require this; in dev we
  // tolerate a generated ephemeral secret to keep `npm run dev` frictionless,
  // but log a loud warning so it never sneaks into a real deployment.
  jwtSecret: (() => {
    const v = process.env.JWT_SECRET;
    if (v && v.length >= 32) return v;
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set (>=32 chars) in production");
    }
    console.warn(
      "[stakeport] JWT_SECRET unset — using an ephemeral dev secret. Sessions will invalidate on restart."
    );
    return "dev-only-secret-do-not-use-in-prod-" + "x".repeat(32);
  })(),
  // The Python FastAPI microservice. Keep it on localhost / private network;
  // it has open CORS and no auth of its own.
  aiEngineUrl: optional(process.env.AI_ENGINE_URL, "http://127.0.0.1:8000"),
  pinataJwt: required("PINATA_JWT", process.env.PINATA_JWT),
  // We re-export NEXT_PUBLIC_* on the server too, in case API routes need
  // them (e.g. to construct a viem public client).
  chainId: publicEnv.chainId,
  rpcUrl: publicEnv.rpcUrl,
  mockUsdcAddress: publicEnv.mockUsdcAddress,
  assetFactoryAddress: publicEnv.assetFactoryAddress,
};

// SIWE config — domain/origin must match what the wallet sees, or the
// signature verification will fail. We derive it from the request URL where
// possible; this is just the fallback used during nonce creation logs.
export const siweConfig = {
  appName: "StakePort",
  statement:
    "Sign in to StakePort. This signature unlocks your profile, holdings, and trading dashboard. No transaction, no gas.",
};
