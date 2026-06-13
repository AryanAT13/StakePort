import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.server";

/**
 * Stateless preview endpoint.
 *
 * The existing /api/ai/prospectus expects an on-chain asset address (and
 * does its own IPFS hop + DB cache write). The create wizard needs the
 * prospectus BEFORE the asset exists — there's no address to cache against
 * yet. So this endpoint takes the raw inputs and forwards them straight to
 * the Python ai-engine without writing anything to the DB.
 *
 * The first asset-detail page view after creation will re-run the cached
 * endpoint and persist the result keyed by the deployed contract address.
 * That's 2 Gemini calls per asset (preview + first view) which is the
 * acceptable price of "seller sees the prospectus before they mint".
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    imageUrl?: string;
  } | null;

  if (!body?.name || !body?.imageUrl) {
    return NextResponse.json(
      { error: "name and imageUrl are required" },
      { status: 400 }
    );
  }

  const aiRes = await fetch(`${serverEnv.aiEngineUrl}/api/generate-desc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: body.name,
      short_desc: body.description ?? "",
      image_url: body.imageUrl,
    }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text().catch(() => "");
    console.error("[ai/preview-prospectus] engine error", aiRes.status, detail);
    return NextResponse.json({ error: "AI engine unavailable" }, { status: 502 });
  }

  const { description } = (await aiRes.json()) as { description: string };
  return NextResponse.json({ prospectus: description, model: "gemini-3.5-flash" });
}

export const dynamic = "force-dynamic";
