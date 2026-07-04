/**
 * RPC URL resolution — single source of truth for the chain endpoint.
 *
 * Why this file exists: on Vercel the `NEXT_PUBLIC_RPC_URL` value frequently
 * arrives *dirty* — wrapped in quotes (`"https://…"`), square brackets, or
 * with a trailing newline from a copy-paste. When such a string is handed to
 * viem's `http()`, `fetch` no longer sees a valid absolute URL and treats it
 * as a RELATIVE path, so the request resolves against the app origin and the
 * `//` collapses to `/`:
 *
 *     https://your-app.vercel.app/https:/eth-sepolia.g.alchemy.com/...  ❌
 *
 * We sanitize once here and every transport (wagmi config, client public
 * client, server public client) reads from `getRpcUrl()`. No component builds
 * a transport from a raw env string anymore, and there are NO hard-coded
 * third-party RPC endpoints in the codebase.
 */

import { publicEnv } from "./env";

// The only non-env default is the standard local Hardhat node. It is NOT a
// third-party RPC provider — it's the localhost dev endpoint, used solely when
// the env var is unset (i.e. local development). In production the env var is
// required; if it's missing/malformed we log loudly and fall back to localhost
// which fails fast + visibly rather than silently hitting some public node.
const LOCAL_NODE = "http://127.0.0.1:8545";

/**
 * Strip the junk that env UIs and copy-paste introduce: surrounding single or
 * double quotes, square brackets, backticks, and all whitespace/newlines at
 * either end.
 */
export function sanitizeRpcUrl(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^[[\s'"`]+/, "") // leading [ , whitespace, quotes, backtick
    .replace(/[\]\s'"`]+$/, "") // trailing ] , whitespace, quotes, backtick
    .trim();
}

/** True only for a well-formed absolute http(s) URL. */
export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The resolved, validated RPC endpoint. Guaranteed to be an absolute http(s)
 * URL — never a relative path — so `http()` / `fetch` can never mis-resolve it
 * against the page origin.
 */
export function getRpcUrl(): string {
  const cleaned = sanitizeRpcUrl(publicEnv.rpcUrl);

  if (isValidHttpUrl(cleaned)) return cleaned;

  // Invalid or empty. Surface the problem — a silent relative fetch is exactly
  // the bug this module prevents.
  if (typeof window !== "undefined") {
    console.error(
      "[stakeport] NEXT_PUBLIC_RPC_URL is missing or malformed:",
      JSON.stringify(publicEnv.rpcUrl),
      "→ falling back to the local node. In production, set a valid absolute https RPC URL."
    );
  }
  return LOCAL_NODE;
}
