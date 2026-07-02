import { NextRequest, NextResponse } from 'next/server';
import { parseAbi, parseAbiItem, formatEther } from 'viem';
import { prisma } from '@/lib/db';
import { serverEnv } from '@/lib/env.server';
import { getPublicClient } from '@/lib/viemClient';
import { normalizeAddress } from '@/lib/assetMetadata';

/**
 * Risk Alignment bridge.
 *
 * Gathers the quantitative feature inputs for an asset (price history from
 * Traded events, pool liquidity, valuation) plus the cached metadata
 * (category, oracle fair value), forwards them to the Python quant engine
 * (`/api/risk-alignment`), and returns the model's tier + score + the
 * LLM-written one-liner.
 *
 * The buyer's risk profile is read from their authenticated session — this
 * card is buyer-personalised, so it must never run with a spoofed profile.
 *
 * Caching: results are memoised per (asset, profile) for a few minutes. The
 * underlying price feed changes on every trade, but re-scoring + re-prompting
 * Gemini on every page render would be wasteful. A short TTL keeps the card
 * fresh without burning the LLM.
 */

const ASSET_ABI = parseAbi([
  'function valuation() view returns (uint256)',
  'function paymentToken() view returns (address)',
] as const);
const ERC20_BAL = parseAbi(['function balanceOf(address) view returns (uint256)'] as const);

type CacheEntry = { at: number; payload: unknown };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60_000;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    address?: string;
    profile?: string;
  } | null;

  const address = body?.address ? normalizeAddress(body.address) : null;
  if (!address) return NextResponse.json({ error: 'Invalid address' }, { status: 400 });

  // Profile comes from the request (the client reads it from the session
  // hook). We still validate it against the allowed set.
  const profile = ['conservative', 'moderate', 'aggressive'].includes(body?.profile ?? '')
    ? (body!.profile as string)
    : 'moderate';

  const cacheKey = `${address.toLowerCase()}:${profile}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ ...(hit.payload as object), cached: true });
  }

  try {
    const client = getPublicClient();

    // --- metadata (category, fair value, name) from the DB cache ---------
    const meta = await prisma.assetMetadata.findUnique({
      where: { contractAddress: address.toLowerCase() },
    });

    // --- on-chain: valuation + payment token + pool liquidity ------------
    const [valuationRaw, paymentToken] = await Promise.all([
      client.readContract({ address, abi: ASSET_ABI, functionName: 'valuation' }),
      client.readContract({ address, abi: ASSET_ABI, functionName: 'paymentToken' }),
    ]);
    const liquidityRaw = await client.readContract({
      address: paymentToken as `0x${string}`,
      abi: ERC20_BAL,
      functionName: 'balanceOf',
      args: [address],
    });

    // --- price history from Traded events --------------------------------
    const logs = await client.getLogs({
      address,
      event: parseAbiItem(
        'event Traded(address indexed user, string action, uint256 amountIn, uint256 amountOut, uint256 newPrice)'
      ),
      fromBlock: 'earliest',
      toBlock: 'latest',
    });
    const priceHistory = logs.map((l) => parseFloat(formatEther(l.args.newPrice as bigint)));

    const valuation = parseFloat(formatEther(valuationRaw as bigint));
    const liquidityUsdc = parseFloat(formatEther(liquidityRaw as bigint));

    // --- call the Python quant engine ------------------------------------
    const aiRes = await fetch(`${serverEnv.aiEngineUrl}/api/risk-alignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: meta?.name ?? 'this asset',
        category: meta?.fairValueCategory ?? 'GENERAL',
        valuation,
        fair_value: meta?.fairValue ?? null,
        liquidity_usdc: liquidityUsdc,
        price_history: priceHistory,
        user_profile: profile,
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => '');
      console.error('[risk-alignment] engine', aiRes.status, detail.slice(0, 200));
      return NextResponse.json({ error: 'Risk engine unavailable' }, { status: 502 });
    }

    const data = await aiRes.json();
    const payload = {
      riskScore: data.risk_score,
      riskTier: data.risk_tier,
      alignment: data.alignment, // 'high' | 'medium' | 'low'
      explanation: data.explanation,
      confidence: data.confidence,
      probabilities: data.probabilities,
      features: data.features,
      profile,
    };

    cache.set(cacheKey, { at: Date.now(), payload });
    return NextResponse.json({ ...payload, cached: false });
  } catch (e) {
    console.error('[risk-alignment]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
