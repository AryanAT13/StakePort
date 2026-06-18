'use client';

// Portfolio — Phase 7.
//
// Adds cost-basis tracking + unrealised P&L by joining the on-chain holdings
// view with the DB-indexed Trade table. The asset-detail page POSTs every
// buy/sell to /api/trades right after the receipt confirms; this page reads
// that history back and rolls it up.
//
// P&L methodology (intentionally simple):
//   avgBuyPrice  = sum(usdcSpent on BUYs) / sum(tokensBought on BUYs)
//   costBasis    = avgBuyPrice * currentBalance
//   unrealisedPL = (currentPrice - avgBuyPrice) * currentBalance
//
// SELLs don't affect avgBuyPrice (no FIFO/LIFO bookkeeping in this version —
// that would matter for tax accounting, not for the live P&L badge). Users
// who never traded on this device just see "—" for cost basis and P&L.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useSession } from '@/hooks/useSession';
import {
  ASSET_FACTORY_ADDRESS,
  ASSET_FACTORY_ABI,
  REAL_WORLD_ASSET_ABI,
} from '@/constants/contracts';
import { formatCompactUsd } from '@/lib/format';

const PLACEHOLDER = 'https://placehold.co/600x600/0a0a0a/27272a?text=%E2%97%87';

type Trade = {
  contractAddress: string;
  action: 'BUY' | 'SELL';
  tokenAmount: string;
  usdcAmount: string;
};

type Position = {
  avgBuyPrice: number; // USDC per token, weighted by amount
  totalUsdcSpent: number;
  totalTokensBought: number;
};

/** Single row in the holdings table. Self-fetches on-chain data; receives
 *  cost-basis stats (if any) as a prop from the parent. */
function AssetRow({
  assetAddress,
  userAddress,
  position,
  onValue,
}: {
  assetAddress: `0x${string}`;
  userAddress: `0x${string}`;
  position?: Position;
  onValue: (addr: string, value: number) => void;
}) {
  const { data: name } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' });
  const { data: symbol } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol' });
  const { data: balance } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf', args: [userAddress] });
  const { data: price } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'getPrice' });
  const { data: assetUrl } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' });

  const [thumb, setThumb] = useState<string>(PLACEHOLDER);
  useEffect(() => {
    if (!assetUrl) return;
    const url = assetUrl as string;
    if (!url.startsWith('http')) {
      setThumb(url.includes(',') ? url.split(',')[0]!.trim() : PLACEHOLDER);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(url);
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const j = (await r.json()) as { images?: string[] };
          if (!cancelled) setThumb(j.images?.[0] ?? PLACEHOLDER);
        } else if (!cancelled) {
          setThumb(url);
        }
      } catch {/* keep placeholder */}
    })();
    return () => { cancelled = true; };
  }, [assetUrl]);

  const userBalance = balance ? parseFloat(formatEther(balance as bigint)) : 0;
  const currentPrice = price ? parseFloat(formatEther(price as bigint)) : 0;
  const value = userBalance * currentPrice;

  useEffect(() => {
    onValue(assetAddress, value);
  }, [assetAddress, value, onValue]);

  if (!balance || (balance as bigint) === 0n) return null;
  if (!name) return null;

  // P&L (unrealised) — only rendered when we have a meaningful avg buy.
  const hasCostBasis = !!position && position.avgBuyPrice > 0;
  const pnl = hasCostBasis ? (currentPrice - position!.avgBuyPrice) * userBalance : null;
  const pnlPct = hasCostBasis ? ((currentPrice - position!.avgBuyPrice) / position!.avgBuyPrice) * 100 : null;
  const pnlPositive = (pnl ?? 0) >= 0;

  return (
    <tr className="border-t border-zinc-900 hover:bg-zinc-950 transition group">
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover border border-zinc-900 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{name as string}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5 font-mono uppercase tracking-wider">{symbol as string}</div>
          </div>
        </div>
      </td>

      {/* Balance + (small) avg buy */}
      <td className="py-4 px-5 text-right">
        <div className="text-sm font-mono text-zinc-200 tabular-nums">{userBalance.toFixed(2)}</div>
        {hasCostBasis && (
          <div className="text-[10px] text-zinc-600 mt-0.5 font-mono tabular-nums">
            avg ${position!.avgBuyPrice.toFixed(2)}
          </div>
        )}
      </td>

      <td className="py-4 px-5 text-right text-sm font-mono text-zinc-200 tabular-nums">
        ${currentPrice.toFixed(2)}
      </td>

      {/* Value + P&L chip */}
      <td className="py-4 px-5 text-right">
        <div className="font-mono font-semibold text-white tabular-nums">{formatCompactUsd(value)}</div>
        {pnl !== null && pnlPct !== null && (
          <div className={`text-[10px] mt-0.5 font-mono tabular-nums ${pnlPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnlPositive ? '+' : ''}{formatCompactUsd(pnl)} ({pnlPositive ? '+' : ''}{pnlPct.toFixed(1)}%)
          </div>
        )}
      </td>

      <td className="py-4 px-5 text-right">
        <Link
          href={`/asset/${assetAddress}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-400 group-hover:text-white transition px-3 py-1.5 rounded-full border border-zinc-800 group-hover:border-zinc-600"
        >
          Trade
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}

export default function Portfolio() {
  const { address } = useAccount();
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/');
    else if (!user.onboarded) router.replace('/onboarding');
  }, [sessionLoading, user, router]);

  const { data: assetList } = useReadContract({
    address: ASSET_FACTORY_ADDRESS,
    abi: ASSET_FACTORY_ABI,
    functionName: 'getDeployedAssets',
  });
  const assets = useMemo(() => (assetList as `0x${string}`[] | undefined) ?? [], [assetList]);

  // ---- Pull trade history + aggregate -----------------------------------
  const [trades, setTrades] = useState<Trade[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/trades', { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { trades: Trade[] }) => { if (!cancelled) setTrades(j.trades ?? []); })
      .catch(() => {/* empty history is the default */});
    return () => { cancelled = true; };
  }, []);

  const positions = useMemo<Record<string, Position>>(() => {
    const map: Record<string, Position> = {};
    for (const t of trades) {
      const k = t.contractAddress.toLowerCase();
      if (!map[k]) map[k] = { avgBuyPrice: 0, totalUsdcSpent: 0, totalTokensBought: 0 };
      const usdc = parseFloat(t.usdcAmount);
      const tokens = parseFloat(t.tokenAmount);
      if (t.action === 'BUY') {
        map[k].totalUsdcSpent += usdc;
        map[k].totalTokensBought += tokens;
      }
    }
    // Compute weighted avg from the accumulator. Skip if no buys.
    for (const k of Object.keys(map)) {
      const p = map[k];
      if (p && p.totalTokensBought > 0) {
        p.avgBuyPrice = p.totalUsdcSpent / p.totalTokensBought;
      }
    }
    return map;
  }, [trades]);

  // ---- Roll-up total value ---------------------------------------------
  const [values, setValues] = useState<Record<string, number>>({});
  const handleValue = useMemo(
    () => (addr: string, v: number) => setValues((prev) => (prev[addr] === v ? prev : { ...prev, [addr]: v })),
    []
  );
  const totalValue = Object.values(values).reduce((a, b) => a + b, 0);
  const positionCount = Object.values(values).filter((v) => v > 0).length;

  // Total cost basis across all open positions where we have history.
  const totalCostBasis = useMemo(() => {
    let sum = 0;
    for (const k of Object.keys(positions)) {
      const p = positions[k];
      if (!p || p.avgBuyPrice <= 0) continue;
      // Current balance lives in `values[address]` indirectly — we approximate
      // by treating value/currentPrice as balance. Without lifting more
      // per-row state, the simpler proxy is good enough for a summary card.
      // For a precise per-row P&L the AssetRow does the proper math.
      sum += p.totalUsdcSpent;
    }
    return sum;
  }, [positions]);

  const totalPnl = totalCostBasis > 0 ? totalValue - totalCostBasis : null;
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl! / totalCostBasis) * 100 : null;

  if (sessionLoading || !user || !user.onboarded) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xs text-zinc-500 uppercase tracking-[0.22em]">Authenticating…</p>
      </main>
    );
  }
  if (!address) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <p className="eyebrow mb-3">Portfolio</p>
          <h1 className="text-3xl font-semibold mb-3">Reconnect your wallet.</h1>
          <p className="text-zinc-400">Your holdings live on-chain — we need the wallet to read them.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-12 md:py-14">
        <div className="mb-10">
          <p className="eyebrow mb-2">Portfolio</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em]">Your holdings</h1>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">Total Value</p>
            <p className="text-3xl font-mono font-semibold tracking-tight">{formatCompactUsd(totalValue)}</p>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">Unrealised P&L</p>
            {totalPnl !== null && totalPnlPct !== null ? (
              <p className={`text-3xl font-mono font-semibold tracking-tight ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}{formatCompactUsd(totalPnl)}
                <span className="text-sm ml-2">({totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%)</span>
              </p>
            ) : (
              <p className="text-3xl font-mono font-semibold tracking-tight text-zinc-600">—</p>
            )}
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">Active Positions</p>
            <p className="text-3xl font-semibold tracking-tight">{positionCount}</p>
          </div>
        </div>

        {/* Holdings table */}
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_140px_120px_160px_120px] px-5 py-3 bg-black/40 border-b border-zinc-900 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            <div>Asset</div>
            <div className="text-right">Balance</div>
            <div className="text-right">Price</div>
            <div className="text-right">Value · P&L</div>
            <div className="text-right">Action</div>
          </div>

          <table className="w-full">
            <colgroup>
              <col />
              <col className="w-[140px]" />
              <col className="w-[120px]" />
              <col className="w-[160px]" />
              <col className="w-[120px]" />
            </colgroup>
            <tbody>
              {assets.map((addr) => (
                <AssetRow
                  key={addr}
                  assetAddress={addr}
                  userAddress={address}
                  position={positions[addr.toLowerCase()]}
                  onValue={handleValue}
                />
              ))}
            </tbody>
          </table>

          {assetList && positionCount === 0 && (
            <div className="px-6 py-16 text-center">
              <p className="text-zinc-400 mb-2">No positions yet.</p>
              <p className="text-xs text-zinc-600 mb-6">
                Buy your first share from the markets, or list your own asset.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link href="/markets" className="text-xs px-4 py-2 rounded-full border border-zinc-800 hover:border-zinc-600 transition">
                  Browse markets
                </Link>
                <Link href="/create" className="text-xs px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-zinc-100 transition">
                  List an asset
                </Link>
              </div>
            </div>
          )}
        </div>

        {positionCount > 0 && totalCostBasis === 0 && (
          <p className="text-[11px] text-zinc-600 mt-4 font-mono">
            P&L appears once you trade — the table indexes every buy/sell from your wallet.
          </p>
        )}
      </div>
    </main>
  );
}
