'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReadContracts } from 'wagmi';
import { formatEther, parseAbiItem } from 'viem';
import Link from 'next/link';
import { Crown, Gem, PackageCheck, ArrowUpRight } from 'lucide-react';
import { REAL_WORLD_ASSET_ABI } from '@/constants/contracts';
import { getClientPublicClient } from '@/lib/clientChain';
import { formatCompactUsd } from '@/lib/format';

/**
 * The Vault — Phase 9, Task 5.
 *
 * Post-buyout, an asset leaves the live market but doesn't vanish — it
 * settles into the Vault. We surface every settled asset the viewer has a
 * stake in, classified by role:
 *
 *   ACQUIRER  (buyoutBuyer == you)  → "100% Acquired · Physical Ownership"
 *                                      premium gold treatment; you hold the
 *                                      real object now.
 *   FOUNDER   (owner == you, sold)  → "Sold · Liquidated" + realized profit
 *                                      (proceeds − initial USDC seed).
 *   HOLDER    (you held tokens)     → "Settled" + your payout (claimed or
 *                                      claimable).
 *
 * Realized proceeds are read from CashedOut events (so the figure survives
 * after the user claims and their on-chain balance zeroes) plus any still-
 * pending claim. The creator's cost basis is valuation/2 — the USDC they
 * seeded the pool with at launch.
 */

const PLACEHOLDER = 'https://placehold.co/600x600/0a0a0a/27272a?text=%E2%97%87';
const client = getClientPublicClient();

type Role = 'acquirer' | 'founder' | 'holder' | null;

function VaultCard({
  assetAddress,
  userAddress,
}: {
  assetAddress: `0x${string}`;
  userAddress: `0x${string}`;
}) {
  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'sold' },
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'buyoutBuyer' },
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'owner' },
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' },
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' },
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'valuation' },
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'buyoutPrice' },
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'finalCashPerToken' },
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf', args: [userAddress] },
      { address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'buyoutShare', args: [userAddress] },
    ],
  });

  const [thumb, setThumb] = useState<string>(PLACEHOLDER);
  const [claimedAmount, setClaimedAmount] = useState<number>(0);

  const sold = data?.[0]?.result as boolean | undefined;
  const buyoutBuyer = data?.[1]?.result as string | undefined;
  const owner = data?.[2]?.result as string | undefined;
  const name = data?.[3]?.result as string | undefined;
  const assetUrl = data?.[4]?.result as string | undefined;
  const valuation = data?.[5]?.result as bigint | undefined;
  const buyoutPrice = data?.[6]?.result as bigint | undefined;
  const finalCashPerToken = data?.[7]?.result as bigint | undefined;
  const tokenBalance = data?.[8]?.result as bigint | undefined;
  const buyoutShareRaw = data?.[9]?.result as bigint | undefined;

  // Determine role.
  const isAcquirer = !!buyoutBuyer && buyoutBuyer.toLowerCase() === userAddress.toLowerCase();
  const isFounder = !!owner && owner.toLowerCase() === userAddress.toLowerCase();
  const pendingClaim =
    (tokenBalance && finalCashPerToken
      ? parseFloat(formatEther(tokenBalance)) * parseFloat(formatEther(finalCashPerToken))
      : 0) + (buyoutShareRaw ? parseFloat(formatEther(buyoutShareRaw)) : 0);

  let role: Role = null;
  if (sold) {
    if (isAcquirer) role = 'acquirer';
    else if (isFounder) role = 'founder';
    else if (pendingClaim > 0 || claimedAmount > 0) role = 'holder';
  }

  // Resolve thumbnail.
  useEffect(() => {
    if (!assetUrl) return;
    const url = assetUrl;
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
        } else if (!cancelled) setThumb(url);
      } catch {/* keep placeholder */}
    })();
    return () => { cancelled = true; };
  }, [assetUrl]);

  // Pull CashedOut total for this user so realized profit survives claiming.
  useEffect(() => {
    if (!sold) return;
    let cancelled = false;
    (async () => {
      try {
        const logs = await client.getLogs({
          address: assetAddress,
          event: parseAbiItem('event CashedOut(address indexed tokenHolder, uint256 amount)'),
          args: { tokenHolder: userAddress },
          fromBlock: 'earliest',
          toBlock: 'latest',
        });
        if (cancelled) return;
        const total = logs.reduce((sum, l) => sum + parseFloat(formatEther(l.args.amount as bigint)), 0);
        setClaimedAmount(total);
      } catch {/* non-fatal */}
    })();
    return () => { cancelled = true; };
  }, [assetAddress, userAddress, sold]);

  if (isLoading) {
    return <div className="panel h-40 animate-pulse" />;
  }
  if (!role) return null;

  const valuationNum = valuation ? parseFloat(formatEther(valuation)) : 0;
  const buyoutNum = buyoutPrice ? parseFloat(formatEther(buyoutPrice)) : 0;

  // ---- ACQUIRER (premium) ----------------------------------------------
  if (role === 'acquirer') {
    return (
      <Link href={`/asset/${assetAddress}`}>
        <div className="group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] via-zinc-950 to-zinc-950 p-5 transition hover:border-amber-500/40">
          {/* gold sheen */}
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" className="w-16 h-16 rounded-xl object-cover border border-amber-500/20 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-full mb-2">
                <Crown className="w-2.5 h-2.5" /> 100% Acquired
              </span>
              <h3 className="text-sm font-semibold text-white truncate">{name}</h3>
              <p className="text-[11px] text-amber-200/70 mt-1 flex items-center gap-1">
                <Gem className="w-3 h-3" /> Physical ownership claimed
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-amber-500/50 group-hover:text-amber-300 transition flex-shrink-0" />
          </div>
          <div className="relative mt-4 pt-4 border-t border-amber-500/15 flex justify-between items-baseline">
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Acquired For</span>
            <span className="font-mono font-semibold text-amber-200 tabular-nums">{formatCompactUsd(buyoutNum)}</span>
          </div>
        </div>
      </Link>
    );
  }

  // ---- FOUNDER (sold / liquidated + realized profit) -------------------
  if (role === 'founder') {
    const initialInvestment = valuationNum / 2; // USDC seeded at launch
    const totalProceeds = claimedAmount + pendingClaim;
    const realizedProfit = totalProceeds - initialInvestment;
    const profitPositive = realizedProfit >= 0;
    return (
      <Link href={`/asset/${assetAddress}`}>
        <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-zinc-700">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" className="w-16 h-16 rounded-xl object-cover border border-zinc-800 flex-shrink-0 grayscale-[0.3]" />
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full mb-2">
                <PackageCheck className="w-2.5 h-2.5" /> Sold · Liquidated
              </span>
              <h3 className="text-sm font-semibold text-white truncate">{name}</h3>
              <p className="text-[11px] text-zinc-500 mt-1">Your asset was acquired in a buyout</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-700 group-hover:text-white transition flex-shrink-0" />
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-900 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Proceeds</p>
              <p className="font-mono font-semibold text-white tabular-nums text-sm">{formatCompactUsd(totalProceeds)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Realized Profit</p>
              <p className={`font-mono font-semibold tabular-nums text-sm ${profitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {profitPositive ? '+' : ''}{formatCompactUsd(realizedProfit)}
              </p>
            </div>
          </div>
          {pendingClaim > 0 && (
            <p className="mt-3 text-[10px] text-emerald-400/80 font-mono">
              {formatCompactUsd(pendingClaim)} still claimable — open to cash out
            </p>
          )}
        </div>
      </Link>
    );
  }

  // ---- HOLDER (settled, claim available/claimed) -----------------------
  const totalReceived = claimedAmount + pendingClaim;
  return (
    <Link href={`/asset/${assetAddress}`}>
      <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-zinc-700">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="w-16 h-16 rounded-xl object-cover border border-zinc-800 flex-shrink-0 grayscale-[0.3]" />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300 bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 rounded-full mb-2">
              Settled
            </span>
            <h3 className="text-sm font-semibold text-white truncate">{name}</h3>
            <p className="text-[11px] text-zinc-500 mt-1">Bought out — your share settled</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-zinc-700 group-hover:text-white transition flex-shrink-0" />
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-900 flex justify-between items-baseline">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            {pendingClaim > 0 ? 'Claimable' : 'Received'}
          </span>
          <span className={`font-mono font-semibold tabular-nums ${pendingClaim > 0 ? 'text-emerald-400' : 'text-zinc-200'}`}>
            {formatCompactUsd(pendingClaim > 0 ? pendingClaim : totalReceived)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function VaultSection({
  assets,
  userAddress,
}: {
  assets: `0x${string}`[];
  userAddress: `0x${string}`;
}) {
  // Cheap pre-scan: read `sold` for all assets in one multicall, only mount
  // VaultCards for the sold ones (keeps the heavy per-card reads minimal).
  // Memoised contracts array — wagmi keys on reference identity, and an
  // inline `.map` each render would thrash the query into a loop.
  const soldContracts = useMemo(
    () => assets.map((a) => ({
      address: a, abi: REAL_WORLD_ASSET_ABI, functionName: 'sold' as const,
    })),
    [assets]
  );
  const { data: soldFlags } = useReadContracts({
    contracts: soldContracts,
    query: { enabled: assets.length > 0 },
  });

  const soldAssets = assets.filter((_, i) => soldFlags?.[i]?.result === true);

  // Nothing settled on the whole platform → no Vault at all.
  if (soldAssets.length === 0) return null;

  return (
    <div className="mt-12">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="eyebrow mb-2">The Vault</p>
          <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em]">Settled &amp; acquired</h2>
        </div>
      </div>
      {/* Cards self-hide when the viewer has no stake in a settled asset, so
          this grid only fills with the user's actual vault holdings. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {soldAssets.map((a) => (
          <VaultCard key={a} assetAddress={a} userAddress={userAddress} />
        ))}
      </div>
    </div>
  );
}
