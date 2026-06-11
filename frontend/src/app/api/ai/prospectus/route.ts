import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env.server";
import { normalizeAddress, resolveAsset } from "@/lib/assetMetadata";

/**
 * Generate (or fetch the cached) AI prospectus for an asset.
 *
 * Proxy contract:
 *   POST { address: 0x..., force?: boolean }
 *   -> { prospectus, model, generatedAt, cached }
 *
 * Caching strategy:
 *   - Prospectus is deterministic per (image + description + name) tuple, so
 *     we cache forever and only regenerate when ?force=true is passed (used
 *     by the create flow if the seller edits their listing).
 *   - The first asset-detail page view triggers generation, so existing
 *     on-chain assets get backfilled lazily.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { address?: string; force?: boolean } | null;
  const address = body?.address ? normalizeAddress(body.address) : null;
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const cacheKey = address.toLowerCase();

  if (!body?.force) {
    const cached = await prisma.assetMetadata.findUnique({ where: { contractAddress: cacheKey } });
    if (cached?.prospectus) {
      return NextResponse.json({
        prospectus: cached.prospectus,
        model: cached.prospectusModel,
        generatedAt: cached.prospectusAt,
        cached: true,
      });
    }
  }

  const asset = await resolveAsset(address);
  if (!asset.images.length && !asset.description) {
    // Gemini can technically run on name alone but the output is dreadful
    // without the image. Bail loudly so the UI can show a "metadata missing"
    // hint rather than a hallucinated prospectus.
    return NextResponse.json({ error: "Asset has no image or description to appraise" }, { status: 422 });
  }

  // Talk to the Python microservice. We forward the resolved image URL
  // directly — keeps the Python side stateless.
  const aiRes = await fetch(`${serverEnv.aiEngineUrl}/api/generate-desc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: asset.name,
      short_desc: asset.description ?? "",
      image_url: asset.images[0] ?? "",
    }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text().catch(() => "");
    console.error("[ai/prospectus] engine error", aiRes.status, detail);
    return NextResponse.json({ error: "AI engine unavailable" }, { status: 502 });
  }
  const { description } = (await aiRes.json()) as { description: string };

  await prisma.assetMetadata.upsert({
    where: { contractAddress: cacheKey },
    create: {
      contractAddress: cacheKey,
      name: asset.name,
      symbol: asset.symbol,
      prospectus: description,
      prospectusModel: "gemini-1.5-flash",
      prospectusAt: new Date(),
    },
    update: {
      name: asset.name,
      symbol: asset.symbol,
      prospectus: description,
      prospectusModel: "gemini-1.5-flash",
      prospectusAt: new Date(),
    },
  });

  return NextResponse.json({
    prospectus: description,
    model: "gemini-1.5-flash",
    generatedAt: new Date(),
    cached: false,
  });
}

export const dynamic = "force-dynamic";
