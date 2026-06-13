import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.server";

/**
 * Stateless fair-value preview for the create wizard. Same trade-off as
 * preview-prospectus — we deliberately skip DB caching because we have no
 * contract address yet. The first asset-detail view after creation
 * populates the long-lived cache.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  if (!body?.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const aiRes = await fetch(`${serverEnv.aiEngineUrl}/api/fair-value`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: body.name }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text().catch(() => "");
    console.error("[ai/preview-fair-value] engine error", aiRes.status, detail);
    return NextResponse.json({ error: "Oracle unavailable" }, { status: 502 });
  }

  const data = (await aiRes.json()) as {
    predicted_price: number;
    category: string;
    status: string;
  };

  return NextResponse.json({
    fairValue: data.predicted_price,
    category: data.category,
    status: data.status,
  });
}

export const dynamic = "force-dynamic";
