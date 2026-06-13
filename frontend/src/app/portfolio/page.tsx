'use client';

// Portfolio — Phase 5 design pass.
//
// Same data model as before (user's non-zero balance across every listed
// asset) but presented as a proper portfolio table: editorial header, value
// summary card, premium table styling, and an honest empty state. The page
// still defers cost-basis tracking + P&L to a later phase (we'd need to
// index every Traded event keyed by user to calculate it).

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

/** Single row in the holdings table. Self-fetches its on-chain reads and
 *  reports the position value back upward so the page can sum totals. */
function AssetRow({
  assetAddress,
  userAddress,
  onValue,
}: {
  assetAddress: `0x${string}`;
  userAddress: `0x${string}`;
  onValue: (addr: string, value: number) => void;
}) {
  const { data: name } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' });
  const { data: symbol } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol' });
  const { data: balance } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf', args: [userAddress] });
  const { data: price } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'getPrice' });
  const { data: assetUrl } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' });

  // ---- Image resolution (same heuristic as the AssetCard) --------------
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

  // Roll the total upward. Stable dep on (address, value) — we only fire
  // when the computed number changes, not on every render.
  useEffect(() => {
    onValue(assetAddress, value);
  }, [assetAddress, value, onValue]);

  if (!balance || (balance as bigint) === 0n) return null;
  if (!name) return null; // simple skeleton: don't render until name lands

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
      <td className="py-4 px-5 text-right text-sm font-mono text-zinc-200 tabular-nums">
        {userBalance.toFixed(2)}
      </td>
      <td className="py-4 px-5 text-right text-sm font-mono text-zinc-200 tabular-nums">
        ${currentPrice.toFixed(2)}
      </td>
      <td className="py-4 px-5 text-right font-mono font-semibold text-white tabular-nums">
        {formatCompactUsd(value)}
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

  // ---- Auth gate (session-driven) --------------------------------------
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

  // ---- Total value (rolled up from each AssetRow) -----------------------
  const [values, setValues] = useState<Record<string, number>>({});
  const handleValue = useMemo(
    () => (addr: string, v: number) => setValues((prev) => (prev[addr] === v ? prev : { ...prev, [addr]: v })),
    []
  );
  const totalValue = Object.values(values).reduce((a, b) => a + b, 0);
  const positionCount = Object.values(values).filter((v) => v > 0).length;

  if (sessionLoading || !user || !user.onboarded) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xs text-zinc-500 uppercase tracking-[0.22em]">Authenticating…</p>
      </main>
    );
  }

  if (!address) {
    // Session is valid but wagmi reports no wallet — let the user reconnect
    // before showing an empty holdings table.
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
        {/* Header */}
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
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">Active Positions</p>
            <p className="text-3xl font-semibold tracking-tight">{positionCount}</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">Wallet</p>
            <p className="text-sm font-mono text-zinc-300 break-all">
              {address.slice(0, 8)}…{address.slice(-6)}
            </p>
          </div>
        </div>

        {/* Holdings table */}
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_120px_120px_140px_120px] px-5 py-3 bg-black/40 border-b border-zinc-900 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            <div>Asset</div>
            <div className="text-right">Balance</div>
            <div className="text-right">Price</div>
            <div className="text-right">Value</div>
            <div className="text-right">Action</div>
          </div>

          <table className="w-full">
            <colgroup>
              <col />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[140px]" />
              <col className="w-[120px]" />
            </colgroup>
            <tbody>
              {assets.map((addr) => (
                <AssetRow key={addr} assetAddress={addr} userAddress={address} onValue={handleValue} />
              ))}
            </tbody>
          </table>

          {/* Empty state — show only when on-chain list is loaded AND nothing
              the user holds is non-zero. */}
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
      </div>
    </main>
  );
}
