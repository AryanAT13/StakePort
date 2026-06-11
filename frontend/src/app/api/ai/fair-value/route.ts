import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { normalizeAddress, resolveAsset } from "@/lib/assetMetadata";

/**
 * ML fair-value oracle proxy.
 *
 * Unlike the prospectus, fair value is time-sensitive — Chrono24 prices move,
 * Zillow comps change — so we apply a TTL and refresh in the background when
 * the cache is older than that.
 */
const TTL_HOURS = 24;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { address?: string; force?: boolean } | null;
  const address = body?.address ? normalizeAddress(body.address) : null;
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const cacheKey = address.toLowerCase();
  const cached = await prisma.assetMetadata.findUnique({ where: { contractAddress: cacheKey } });

  const fresh =
    cached?.fairValue != null &&
    cached?.fairValueAt &&
    Date.now() - cached.fairValueAt.getTime() < TTL_HOURS * 3600_000;

  if (fresh && !body?.force) {
    return NextResponse.json({
      fairValue: cached!.fairValue,
      category: cached!.fairValueCategory,
      status: cached!.fairValueStatus,
      generatedAt: cached!.fairValueAt,
      cached: true,
    });
  }

  const asset = await resolveAsset(address);

  const aiRes = await fetch(`${serverEnv.aiEngineUrl}/api/fair-value`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: asset.name }),
  });

  if (!aiRes.ok) {
    // If we have a stale cached value, prefer it over a hard failure — the
    // UI can still render with a "data may be stale" badge.
    if (cached?.fairValue != null) {
      return NextResponse.json({
        fairValue: cached.fairValue,
        category: cached.fairValueCategory,
        status: cached.fairValueStatus,
        generatedAt: cached.fairValueAt,
        cached: true,
        stale: true,
      });
    }
    const detail = await aiRes.text().catch(() => "");
    console.error("[ai/fair-value] engine error", aiRes.status, detail);
    return NextResponse.json({ error: "Oracle unavailable" }, { status: 502 });
  }

  const data = (await aiRes.json()) as {
    predicted_price: number;
    category: string;
    status: string;
  };

  await prisma.assetMetadata.upsert({
    where: { contractAddress: cacheKey },
    create: {
      contractAddress: cacheKey,
      name: asset.name,
      symbol: asset.symbol,
      fairValue: data.predicted_price,
      fairValueCategory: data.category,
      fairValueStatus: data.status,
      fairValueRaw: JSON.stringify(data),
      fairValueAt: new Date(),
    },
    update: {
      fairValue: data.predicted_price,
      fairValueCategory: data.category,
      fairValueStatus: data.status,
      fairValueRaw: JSON.stringify(data),
      fairValueAt: new Date(),
    },
  });

  return NextResponse.json({
    fairValue: data.predicted_price,
    category: data.category,
    status: data.status,
    generatedAt: new Date(),
    cached: false,
  });
}

export const dynamic = "force-dynamic";
