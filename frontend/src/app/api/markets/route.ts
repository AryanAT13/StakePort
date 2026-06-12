import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Enriched market metadata for the dashboard grid.
 *
 * On-chain reads (price, valuation, sold) stay on the client per card —
 * they're cheap and per-asset. This endpoint serves only the data that
 * lives in our DB cache:
 *   - the AI-generated category (LUXURY_GOODS / VEHICLE / REAL_ESTATE / GENERAL)
 *   - the ML oracle's fair-value snapshot
 *   - the prospectus excerpt (handy for tooltips later)
 *
 * Coverage is partial — an asset only appears here once /api/ai/* has been
 * invoked for it (lazy population on first asset-detail visit). The
 * marketplace tolerates this gracefully: assets without a row just show
 * with limited metadata and fall under the "All" filter.
 */
export async function GET() {
  const items = await prisma.assetMetadata.findMany({
    select: {
      contractAddress: true,
      name: true,
      symbol: true,
      fairValue: true,
      fairValueCategory: true,
      fairValueStatus: true,
      fairValueAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ items });
}

export const dynamic = 'force-dynamic';
