import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * Trade indexing.
 *
 *   POST  — record a single fill. Called by the asset detail page right
 *           after a successful buy/sell tx; idempotent on txHash so
 *           StrictMode-double-effects or a retry-on-error don't duplicate.
 *
 *   GET   — return every trade for the signed-in wallet, most recent first.
 *           Powers the portfolio's P&L calculation (avg buy + unrealized).
 *
 * We deliberately do NOT scan the chain server-side to populate this table —
 * the source of truth is the on-chain Traded event, and the client already
 * has the tx receipt when it confirms. Writing from the client side avoids a
 * background indexer for now; if we ever need cross-device sync (e.g. you
 * trade from one device and see history on another), we'll layer a poller
 * on top of this same table.
 */

type TradeBody = {
  contractAddress?: string;
  txHash?: string;
  action?: string;
  tokenAmount?: string;
  usdcAmount?: string;
  priceAfter?: string;
  blockNumber?: number;
  timestamp?: string; // ISO
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as TradeBody | null;
  if (!body?.contractAddress || !body?.txHash || !body?.action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (body.action !== 'BUY' && body.action !== 'SELL') {
    return NextResponse.json({ error: 'action must be BUY or SELL' }, { status: 400 });
  }

  const trade = await prisma.trade.upsert({
    where: { txHash: body.txHash },
    create: {
      userId: session.sub,
      walletAddress: session.addr,
      contractAddress: body.contractAddress.toLowerCase(),
      txHash: body.txHash,
      action: body.action,
      tokenAmount: body.tokenAmount ?? '0',
      usdcAmount: body.usdcAmount ?? '0',
      priceAfter: body.priceAfter ?? '0',
      blockNumber: body.blockNumber ?? 0,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    },
    // Upsert update is a no-op — the canonical record is the first write
    // (Traded events are immutable once mined).
    update: {},
  });

  return NextResponse.json({ trade });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ trades: [] });

  const trades = await prisma.trade.findMany({
    where: { walletAddress: session.addr },
    orderBy: { timestamp: 'desc' },
    take: 500, // cap so a power user with thousands of trades doesn't OOM
  });

  return NextResponse.json({ trades });
}

export const dynamic = 'force-dynamic';
