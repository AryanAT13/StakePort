'use client';

// Portfolio — Phase 8.
//
// Changes vs Phase 7:
//   - CREATOR P&L FIX. When the user is the asset's owner (i.e. they
//     minted it), we use the founder baseline as their cost-per-share:
//         avgBuy = valuation / 1000  (1000 = initial mint amount)
//     This is what the contract used to issue them their founder bag,
//     so it's the right floor to measure their unrealised P&L against.
//   - P&L SPARKLINE. The Unrealised P&L card now draws a recharts
//     mini-chart from the user's indexed trade history.
//   - TOP / BOTTOM PERFORMER chips. Surfaces extreme P&L positions so
//     traders see their winners and laggards without reading the table.
//   - ALLOCATION strip. A compact horizontal stack showing the user's
//     positions as % of total value, colour-cycled.
//
// Methodology for the sparkline:
//   running portfolio value = Σ (holdings[asset] × lastKnownPrice[asset])
//   running cost basis      = Σ buy USDC − Σ sell USDC
//   pnl                     = value − cost basis
// We can only sample at trade timestamps (no price feed between trades),
// so the curve is a piecewise-linear approximation. Good enough for a
// portfolio-level visualisation, not a tax statement.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import Link from 'next/link';
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageAtmosphere from '@/components/PageAtmosphere';
import PnLSparkline, { Point } from '@/components/PnLSparkline';
import VaultSection from '@/components/VaultSection';
import { useSession } from '@/hooks/useSession';
import {
  ASSET_FACTORY_ADDRESS,
  ASSET_FACTORY_ABI,
  REAL_WORLD_ASSET_ABI,
} from '@/constants/contracts';
import { formatCompactUsd } from '@/lib/format';

const PLACEHOLDER = 'https://placehold.co/600x600/0a0a0a/27272a?text=%E2%97%87';

// Distinct colours for the allocation bar — cycled by index.
const ALLOC_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee',
];

type Trade = {
  contractAddress: string;
  action: 'BUY' | 'SELL';
  tokenAmount: string;
  usdcAmount: string;
  priceAfter: string;
  timestamp: string;
};

type TradedPosition = {
  avgBuyPrice: number; // USDC per token, weighted by amount
  totalUsdcSpent: number;
  totalTokensBought: number;
};

type RowReport = {
  name: string;
  symbol: string;
  value: number;
  costBasis: number;
  pnl: number | null;
  pnlPct: number | null;
};

/** Single holdings row. Self-fetches on-chain data; takes a traded position
 *  prop, plus a creatorBaselinePerToken used when the user is the owner. */
function AssetRow({
  assetAddress,
  userAddress,
  tradedPosition,
  onReport,
}: {
  assetAddress: `0x${string}`;
  userAddress: `0x${string}`;
  tradedPosition?: TradedPosition;
  onReport: (addr: string, r: RowReport | null) => void;
}) {
  const { data: name } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' });
  const { data: symbol } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol' });
  const { data: balance } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf', args: [userAddress] });
  const { data: price } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'getPrice' });
  const { data: assetUrl } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' });
  const { data: owner } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'owner' });
  const { data: valuation } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'valuation' });

  // ---- Thumbnail resolution (same heuristic as the AssetCard) ----------
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

  // ---- Cost-basis resolution -------------------------------------------
  // Priority 1: indexed traded position (we've tracked their actual buys).
  // Priority 2: creator baseline — if they OWN this asset, their cost per
  // share is the founder mint price = valuation / 1000.
  const isCreator =
    !!owner && userAddress && userAddress.toLowerCase() === (owner as string).toLowerCase();
  const valuationNum = valuation ? parseFloat(formatEther(valuation as bigint)) : 0;
  const creatorBaselinePerToken = isCreator && valuationNum > 0 ? valuationNum / 1000 : 0;

  const tradedAvg = tradedPosition?.avgBuyPrice ?? 0;
  const effectiveAvgBuy = tradedAvg > 0 ? tradedAvg : creatorBaselinePerToken;

  const hasCostBasis = effectiveAvgBuy > 0;
  const costBasis = hasCostBasis ? effectiveAvgBuy * userBalance : 0;
  const pnl = hasCostBasis ? (currentPrice - effectiveAvgBuy) * userBalance : null;
  const pnlPct = hasCostBasis ? ((currentPrice - effectiveAvgBuy) / effectiveAvgBuy) * 100 : null;
  const pnlPositive = (pnl ?? 0) >= 0;

  // Report up so the parent can roll totals + find best/worst.
  useEffect(() => {
    if (!balance || (balance as bigint) === 0n || !name) {
      onReport(assetAddress, null);
      return;
    }
    onReport(assetAddress, {
      name: name as string,
      symbol: (symbol as string) ?? '',
      value,
      costBasis,
      pnl,
      pnlPct,
    });
  }, [assetAddress, balance, name, symbol, value, costBasis, pnl, pnlPct, onReport]);

  if (!balance || (balance as bigint) === 0n) return null;
  if (!name) return null;

  return (
    <tr className="border-t border-zinc-900 hover:bg-white/[0.015] transition group">
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover border border-zinc-900 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate flex items-center gap-2">
              {name as string}
              {isCreator && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25">
                  Founder
                </span>
              )}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5 font-mono uppercase tracking-wider">{symbol as string}</div>
          </div>
        </div>
      </td>

      <td className="py-4 px-5 text-right">
        <div className="text-sm font-mono text-zinc-200 tabular-nums">{userBalance.toFixed(2)}</div>
        {hasCostBasis && (
          <div className="text-[10px] text-zinc-600 mt-0.5 font-mono tabular-nums">
            avg ${effectiveAvgBuy.toFixed(2)}
          </div>
        )}
      </td>

      <td className="py-4 px-5 text-right text-sm font-mono text-zinc-200 tabular-nums">
        ${currentPrice.toFixed(2)}
      </td>

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
  const { address, isConnected } = useAccount();
  const { user, loading: sessionLoading, resolved: sessionResolved } = useSession();
  const router = useRouter();

  // Routing rules — see /markets/page.tsx for the rationale.
  useEffect(() => {
    if (sessionLoading || !sessionResolved) return;
    if (!user) {
      router.replace(isConnected ? '/onboarding' : '/');
      return;
    }
    if (!user.onboarded) router.replace('/onboarding');
  }, [sessionLoading, sessionResolved, user, isConnected, router]);

  const { data: assetList } = useReadContract({
    address: ASSET_FACTORY_ADDRESS,
    abi: ASSET_FACTORY_ABI,
    functionName: 'getDeployedAssets',
  });
  const assets = useMemo(() => (assetList as `0x${string}`[] | undefined) ?? [], [assetList]);

  // ---- Trades + traded positions ---------------------------------------
  const [trades, setTrades] = useState<Trade[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/trades', { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { trades: Trade[] }) => { if (!cancelled) setTrades(j.trades ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const tradedPositions = useMemo<Record<string, TradedPosition>>(() => {
    const map: Record<string, TradedPosition> = {};
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
    for (const k of Object.keys(map)) {
      const p = map[k];
      if (p && p.totalTokensBought > 0) {
        p.avgBuyPrice = p.totalUsdcSpent / p.totalTokensBought;
      }
    }
    return map;
  }, [trades]);

  // ---- Sparkline data from trade history --------------------------------
  // Replay every trade chronologically tracking holdings and last-known
  // price per asset; emit (timestamp, value, pnl) at each fill.
  const sparkPoints = useMemo<Point[]>(() => {
    if (trades.length === 0) return [];
    const sorted = [...trades].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const holdings: Record<string, number> = {};
    const lastPrice: Record<string, number> = {};
    let costBasis = 0;
    const out: Point[] = [];
    for (const t of sorted) {
      const k = t.contractAddress.toLowerCase();
      const tokens = parseFloat(t.tokenAmount);
      const usdc = parseFloat(t.usdcAmount);
      const price = parseFloat(t.priceAfter);
      if (t.action === 'BUY') {
        holdings[k] = (holdings[k] ?? 0) + tokens;
        costBasis += usdc;
      } else {
        holdings[k] = (holdings[k] ?? 0) - tokens;
        costBasis -= usdc;
      }
      lastPrice[k] = price;
      let value = 0;
      for (const a of Object.keys(holdings)) {
        value += (holdings[a] ?? 0) * (lastPrice[a] ?? 0);
      }
      out.push({ t: new Date(t.timestamp).getTime(), value, pnl: value - costBasis });
    }
    return out;
  }, [trades]);

  // ---- Row reports -----------------------------------------------------
  const [reports, setReports] = useState<Record<string, RowReport>>({});
  const handleReport = useMemo(
    () => (addr: string, r: RowReport | null) =>
      setReports((prev) => {
        const k = addr.toLowerCase();
        if (r === null) {
          if (!(k in prev)) return prev;
          const next = { ...prev };
          delete next[k];
          return next;
        }
        const existing = prev[k];
        if (
          existing &&
          existing.value === r.value &&
          existing.costBasis === r.costBasis &&
          existing.pnl === r.pnl &&
          existing.pnlPct === r.pnlPct
        ) return prev;
        return { ...prev, [k]: r };
      }),
    []
  );

  // ---- Roll-ups for KPIs + chips ---------------------------------------
  const reportList = Object.entries(reports);
  const totalValue = reportList.reduce((sum, [, r]) => sum + r.value, 0);
  const totalCostBasis = reportList.reduce((sum, [, r]) => sum + r.costBasis, 0);
  const totalPnl = totalCostBasis > 0 ? totalValue - totalCostBasis : null;
  const totalPnlPct = totalCostBasis > 0 && totalPnl !== null ? (totalPnl / totalCostBasis) * 100 : null;
  const positionCount = reportList.length;

  const positionsWithPnl = reportList
    .map(([, r]) => r)
    .filter((r) => r.pnlPct !== null) as Array<RowReport & { pnlPct: number; pnl: number }>;
  const topPerformer = positionsWithPnl.reduce<typeof positionsWithPnl[number] | null>(
    (best, r) => (best === null || r.pnlPct > best.pnlPct ? r : best),
    null
  );
  const bottomPerformer = positionsWithPnl.reduce<typeof positionsWithPnl[number] | null>(
    (worst, r) => (worst === null || r.pnlPct < worst.pnlPct ? r : worst),
    null
  );

  if (sessionLoading || !sessionResolved || !user || !user.onboarded) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center">
        <p className="text-xs text-zinc-500 uppercase tracking-[0.22em]">Authenticating…</p>
      </main>
    );
  }
  if (!address) {
    return (
      <main className="min-h-screen text-white">
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
    <main className="relative min-h-screen text-white">
      <PageAtmosphere tone="emerald" />
      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-14">
        <div className="mb-10">
          <p className="eyebrow mb-2">Portfolio</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em]">Your holdings</h1>
        </div>

        {/* Summary cards — KPI strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="panel p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">Total Value</p>
            <p className="text-3xl font-mono font-semibold tracking-tight">{formatCompactUsd(totalValue)}</p>
            <p className="text-[10px] text-zinc-600 mt-2 font-mono tabular-nums">
              cost basis · {formatCompactUsd(totalCostBasis)}
            </p>
          </div>

          {/* Unrealised P&L with embedded sparkline */}
          <div className="panel p-5 md:col-span-1">
            <div className="flex items-start justify-between mb-2.5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Unrealised P&amp;L</p>
              {totalPnl !== null && (
                <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${totalPnl >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                  {totalPnl >= 0 ? '+' : ''}{(totalPnlPct ?? 0).toFixed(1)}%
                </span>
              )}
            </div>
            {totalPnl !== null ? (
              <>
                <p className={`text-3xl font-mono font-semibold tracking-tight ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{formatCompactUsd(totalPnl)}
                </p>
                <div className="mt-3">
                  <PnLSparkline points={sparkPoints} height={56} />
                </div>
              </>
            ) : (
              <p className="text-3xl font-mono font-semibold tracking-tight text-zinc-600">—</p>
            )}
          </div>

          <div className="panel p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">Active Positions</p>
            <p className="text-3xl font-semibold tracking-tight">{positionCount}</p>
            <p className="text-[10px] text-zinc-600 mt-2 font-mono tabular-nums break-all">
              {address.slice(0, 6)}…{address.slice(-4)}
            </p>
          </div>
        </div>

        {/* Top / Bottom performer chips */}
        {(topPerformer || bottomPerformer) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {topPerformer && (
              <PerformerChip kind="top" report={topPerformer} />
            )}
            {bottomPerformer && bottomPerformer !== topPerformer && (
              <PerformerChip kind="bottom" report={bottomPerformer} />
            )}
          </div>
        )}

        {/* Allocation strip */}
        {positionCount > 1 && (
          <AllocationStrip reports={reportList} totalValue={totalValue} />
        )}

        {/* Holdings table */}
        <div className="panel overflow-hidden mt-2">
          <div className="hidden md:grid grid-cols-[1fr_140px_120px_160px_120px] px-5 py-3 bg-black/40 border-b border-zinc-900 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            <div>Asset</div>
            <div className="text-right">Balance</div>
            <div className="text-right">Price</div>
            <div className="text-right">Value · P&amp;L</div>
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
                  tradedPosition={tradedPositions[addr.toLowerCase()]}
                  onReport={handleReport}
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

        {/* Task 5: The Vault — settled / acquired assets. Self-hides when the
            platform has no bought-out assets the user has a stake in. */}
        <VaultSection assets={assets} userAddress={address} />
      </div>
    </main>
  );
}

/* ───────────────────────────────────────────────────────────────── */
/* Sub-components                                                    */
/* ───────────────────────────────────────────────────────────────── */

function PerformerChip({
  kind,
  report,
}: {
  kind: 'top' | 'bottom';
  report: RowReport & { pnlPct: number; pnl: number };
}) {
  const positive = kind === 'top';
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div className={`panel p-4 flex items-center gap-4 ${positive ? '' : ''}`}>
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}
      >
        <Icon className="w-4 h-4" strokeWidth={2.4} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-1">{positive ? 'Top Performer' : 'Biggest Lag'}</p>
        <p className="text-sm font-semibold truncate">{report.name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p
          className={`font-mono font-semibold text-base tabular-nums ${
            positive ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {report.pnlPct >= 0 ? '+' : ''}{report.pnlPct.toFixed(1)}%
        </p>
        <p className="text-[10px] text-zinc-600 font-mono tabular-nums mt-0.5">
          {report.pnl >= 0 ? '+' : ''}{formatCompactUsd(report.pnl)}
        </p>
      </div>
    </div>
  );
}

function AllocationStrip({
  reports,
  totalValue,
}: {
  reports: [string, RowReport][];
  totalValue: number;
}) {
  if (totalValue <= 0) return null;
  const sorted = [...reports]
    .map(([, r]) => r)
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="panel p-5 mb-6">
      <div className="flex items-end justify-between mb-3">
        <p className="eyebrow">Allocation</p>
        <p className="text-[10px] text-zinc-600 font-mono tabular-nums">{sorted.length} positions</p>
      </div>
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-zinc-900 mb-3">
        {sorted.map((r, i) => {
          const pct = (r.value / totalValue) * 100;
          return (
            <div
              key={r.symbol + i}
              style={{ width: `${pct}%`, backgroundColor: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
              title={`${r.name} · ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {sorted.slice(0, 5).map((r, i) => {
          const pct = (r.value / totalValue) * 100;
          return (
            <div key={r.symbol + i} className="flex items-center gap-2">
              <span
                className="block w-2 h-2 rounded-sm"
                style={{ backgroundColor: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
              />
              <span className="text-xs text-zinc-300 truncate max-w-[140px]">{r.name}</span>
              <span className="text-[11px] text-zinc-500 font-mono tabular-nums">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
