import { parseAbi, isAddress, getAddress } from "viem";
import { getPublicClient } from "./viemClient";

/**
 * Server-side helpers for pulling an asset's name + IPFS metadata.
 *
 * The TradeableAsset stores ONLY a URL pointing to an IPFS JSON blob, so any
 * server feature that needs the description or image must do a two-hop fetch:
 *   chain  -> assetUrl
 *   IPFS   -> { name, description, images[] }
 *
 * Both hops are network calls; callers should cache results in the DB.
 */

const ASSET_ABI = parseAbi([
  "function assetName() view returns (string)",
  "function symbol() view returns (string)",
  "function assetUrl() view returns (string)",
] as const);

export interface ResolvedAsset {
  address: `0x${string}`;
  name: string;
  symbol: string;
  metadataUrl: string;
  description?: string;
  images: string[];
}

export function normalizeAddress(raw: string): `0x${string}` | null {
  if (!raw || !isAddress(raw)) return null;
  return getAddress(raw); // checksummed
}

/**
 * Read on-chain metadata then resolve the IPFS JSON. We tolerate the JSON
 * being shaped slightly differently across creators — older listings stored
 * a comma-joined string of image URLs directly in `assetUrl` instead of a
 * JSON pointer. The fallback handles both.
 */
export async function resolveAsset(address: `0x${string}`): Promise<ResolvedAsset> {
  const client = getPublicClient();
  const [name, symbol, metadataUrl] = await Promise.all([
    client.readContract({ address, abi: ASSET_ABI, functionName: "assetName" }),
    client.readContract({ address, abi: ASSET_ABI, functionName: "symbol" }),
    client.readContract({ address, abi: ASSET_ABI, functionName: "assetUrl" }),
  ]);

  let description: string | undefined;
  let images: string[] = [];

  // Heuristic: a proper IPFS metadata URL starts with http(s) and we get a
  // JSON back. Anything else (the legacy comma-joined format) we treat as a
  // raw image list.
  try {
    if (metadataUrl.startsWith("http")) {
      const res = await fetch(metadataUrl, { cache: "no-store" });
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("json")) {
        const j = (await res.json()) as { description?: string; images?: string[] };
        description = j.description;
        images = Array.isArray(j.images) ? j.images : [];
      } else {
        // Non-JSON gateway response — treat the URL itself as an image
        images = [metadataUrl];
      }
    } else if (metadataUrl) {
      images = metadataUrl.split(",").map((s) => s.trim()).filter(Boolean);
    }
  } catch (e) {
    // We log but don't throw — the prospectus endpoint can still try with
    // just the name if IPFS is unreachable.
    console.warn("[resolveAsset] metadata fetch failed:", e);
  }

  return { address, name, symbol, metadataUrl, description, images };
}
