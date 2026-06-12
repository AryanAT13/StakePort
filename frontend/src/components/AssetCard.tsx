'use client';

import { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { REAL_WORLD_ASSET_ABI } from '@/constants/contracts';
import { formatEther } from 'viem';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { formatCompactUsd, categoryLabel } from '@/lib/format';

/**
 * Phase 4 asset card.
 *
 * Reads the dynamic stuff on-chain (price, valuation, sold status, image url)
 * and accepts the slow-changing enriched bits (category, fair value) as a
 * prop from the parent — that way the grid can filter/sort without each
 * card making its own /api/markets call.
 *
 * Visual order, top → bottom:
 *   [image]    live/sold pill (top-right)
 *              category pill (bottom-left, if known)
 *   [name + ticker]
 *   [current price]
 *   [market cap]
 *   [fair value chip — only if the oracle has a number for this asset]
 *
 * Cache strategy on image: the on-chain `assetUrl` points to an IPFS JSON
 * blob with the real image array. We fetch it once and stash the first
 * image in component state. Failure falls back to a clean placeholder.
 */

type Meta = {
  fairValue?: number | null;
  fairValueCategory?: string | null;
};

type Props = {
  assetAddress: `0x${string}`;
  meta?: Meta;
};

const PLACEHOLDER = 'https://placehold.co/600x600/0a0a0a/27272a?text=%E2%97%87';

export default function AssetCard({ assetAddress, meta }: Props) {
  const { data: name } = useReadContract({
    address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName',
  });
  const { data: symbol } = useReadContract({
    address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol',
  });
  const { data: valuation } = useReadContract({
    address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'valuation',
  });
  const { data: assetUrl } = useReadContract({
    address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl',
  });
  const { data: price } = useReadContract({
    address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'getPrice',
  });
  const { data: totalSupply } = useReadContract({
    address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'totalSupply',
  });
  const { data: sold } = useReadContract({
    address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'sold',
  });

  // ---- Image resolution -------------------------------------------------
  // `assetUrl` is one of three shapes in the wild:
  //   1. IPFS JSON metadata: { name, description, images: [...] }   (new)
  //   2. comma-joined list of image gateway URLs                    (legacy)
  //   3. a single direct image URL                                   (legacy)
  // We tolerate all three and degrade gracefully to a placeholder.
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!assetUrl) return;
    const url = assetUrl as string;
    if (!url) return setThumb(null);
    if (!url.startsWith('http')) {
      setThumb(url.includes(',') ? url.split(',')[0]!.trim() : url);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const j = (await res.json()) as { images?: string[] };
          if (!cancelled) setThumb(j.images?.[0] ?? PLACEHOLDER);
        } else {
          if (!cancelled) setThumb(url);
        }
      } catch {
        if (!cancelled) setThumb(PLACEHOLDER);
      }
    })();
    return () => { cancelled = true; };
  }, [assetUrl]);

  if (!name) {
    return (
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden animate-pulse">
        <div className="aspect-square bg-zinc-900" />
        <div className="p-4 space-y-2.5">
          <div className="h-3 bg-zinc-900 rounded w-3/4" />
          <div className="h-3 bg-zinc-900 rounded w-1/2" />
          <div className="h-3 bg-zinc-900 rounded w-1/3 mt-3" />
        </div>
      </div>
    );
  }

  const priceNum = price ? parseFloat(formatEther(price as bigint)) : 0;
  const supplyNum = totalSupply ? parseFloat(formatEther(totalSupply as bigint)) : 1000;
  const valuationNum = valuation ? parseFloat(formatEther(valuation as bigint)) : 0;
  const marketCap = priceNum * supplyNum;
  const fair = meta?.fairValue ?? null;
  const catLabel = categoryLabel(meta?.fairValueCategory ?? '');

  return (
    <Link href={`/asset/${assetAddress}`}>
      <div className="group bg-zinc-950/60 border border-zinc-900 hover:border-zinc-700 rounded-xl overflow-hidden transition-all">
        <div className="relative aspect-square bg-zinc-900 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb ?? PLACEHOLDER}
            alt={name as string}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
          />
          {/* Live / sold pill */}
          <div className="absolute top-2.5 right-2.5">
            {sold ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-black/70 backdrop-blur px-2 py-1 rounded">
                Sold
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-black/70 backdrop-blur px-2 py-1 rounded">
                <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                Live
              </span>
            )}
          </div>
          {/* Category pill */}
          {catLabel && (
            <div className="absolute bottom-2.5 left-2.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-200 bg-black/70 backdrop-blur px-2 py-1 rounded">
                {catLabel}
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-blue-300 transition">
                {name as string}
              </h3>
              {symbol ? (
                <p className="text-[10px] text-zinc-500 mt-0.5 font-mono uppercase tracking-wider">
                  {symbol as string}
                </p>
              ) : null}
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-white transition flex-shrink-0 mt-0.5" />
          </div>

          <div className="space-y-1.5">
            <Row label="Price" value={priceNum > 0 ? `$${priceNum.toFixed(2)}` : '—'} primary />
            <Row label="MCap" value={marketCap > 0 ? formatCompactUsd(marketCap) : formatCompactUsd(valuationNum)} />
          </div>

          {/* Fair-value spread chip — the headline ML-oracle reveal.
              Trades over fair value: red, trades under: green (gain). */}
          {fair != null && fair > 0 && marketCap > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-900 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Fair Value</span>
              <FairValueChip fair={fair} mcap={marketCap} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function Row({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`font-mono ${primary ? 'text-base font-semibold text-white' : 'text-xs text-zinc-300'}`}>
        {value}
      </span>
    </div>
  );
}

function FairValueChip({ fair, mcap }: { fair: number; mcap: number }) {
  // Positive pct = trading ABOVE fair value (potentially overvalued).
  // Negative pct = trading BELOW fair value (potentially a discount).
  const pct = ((mcap - fair) / fair) * 100;
  const above = pct > 0;
  const color = above ? 'text-red-400' : 'text-emerald-400';
  return (
    <span className="font-mono text-xs flex items-baseline gap-1.5">
      <span className="text-zinc-200">{formatCompactUsd(fair)}</span>
      <span className={color}>
        {above ? '+' : ''}{pct.toFixed(1)}%
      </span>
    </span>
  );
}
