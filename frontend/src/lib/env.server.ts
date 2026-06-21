import "server-only";
import { publicEnv } from "./env";

/**
 * Server-only secrets. The `server-only` import above turns any accidental
 * client import into a build error — that's the entire point of splitting
 * this file out from env.ts.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value === "") throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(value: string | undefined, fallback: string): string {
  return value && value !== "" ? value : fallback;
}

export const serverEnv = {
  // 32+ bytes of entropy. We hard-require it in prod; in dev we tolerate an
  // ephemeral fallback so `npm run dev` works with no setup, but warn so it
  // never sneaks into a real deployment.
  jwtSecret: (() => {
    const v = process.env.JWT_SECRET;
    if (v && v.length >= 32) return v;
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set (>=32 chars) in production");
    }
    console.warn(
      "[stakeport] JWT_SECRET unset — using an ephemeral dev secret. Sessions invalidate on restart."
    );
    return "dev-only-secret-do-not-use-in-prod-" + "x".repeat(32);
  })(),
  aiEngineUrl: optional(process.env.AI_ENGINE_URL, "http://127.0.0.1:8000"),
  pinataJwt: required("PINATA_JWT", process.env.PINATA_JWT),
  // Used by the risk-match endpoint to call Gemini's REST API directly
  // (avoids a roundtrip through the Python ai-engine for this one feature).
  // Same key the ai-engine uses — copy from ai-engine/.env if migrating.
  geminiApiKey: required("GEMINI_API_KEY", process.env.GEMINI_API_KEY),
  // Convenience: re-export the chain bits so server code doesn't need two
  // imports for env access.
  chainId: publicEnv.chainId,
  rpcUrl: publicEnv.rpcUrl,
  mockUsdcAddress: publicEnv.mockUsdcAddress,
  assetFactoryAddress: publicEnv.assetFactoryAddress,
};
