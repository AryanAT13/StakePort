'use client';

/**
 * Asset detail page — Phase 6 trading terminal.
 *
 * Layout, top → bottom:
 *   Sticky header strip   — image thumb · name · live price · status pill
 *   Two-column main:
 *     LEFT (8/12)
 *       Image carousel        — snap-scroll with paging dots
 *       Price chart           — existing PriceChart in a premium frame
 *       Stats row             — Market Cap · Volume · Spread vs Fair
 *       AI Prospectus card    — Gemini multimodal, full prose
 *       ML Fair Value Gauge   — headline new component; visualises AMM vs
 *                                oracle floor on a discount/premium ruler
 *     RIGHT (4/12)
 *       Context-aware action stack:
 *         - Cash Out  (when sold = true)
 *         - Trade     (when tradingActive + not sold)
 *         - Launchpad (when !tradingActive + isCreator + has shares)
 *         - Buyout    (when !sold + !creator)
 *         - "Market not active" placeholder otherwise
 *
 * Data hooks largely preserved from the prior version — we redesign the
 * presentation, not the wagmi wiring. The AI endpoints stay cached server-side
 * so re-renders don't burn Gemini / SerpAPI credits.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther, parseAbiItem } from 'viem';
import { Activity, AlertTriangle, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PriceChart from '@/components/PriceChart';
import { REAL_WORLD_ASSET_ABI, ERC20_ABI, MOCK_USDC_ADDRESS } from '@/constants/contracts';
import { getClientPublicClient } from '@/lib/clientChain';
import { formatCompactUsd } from '@/lib/format';

const publicClient = getClientPublicClient();
const PLACEHOLDER = 'https://placehold.co/1200x900/0a0a0a/27272a?text=%E2%97%87';

export default function AssetDetailsPage() {
  const { address: assetAddressRaw } = useParams();
  const assetAddress = assetAddressRaw as `0x${string}`;
  const { address: userAddress } = useAccount();

  // ---- Asset reads ------------------------------------------------------
  const { data: name } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' });
  const { data: symbol } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol' });
  const { data: valuation } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'valuation' });
  const { data: assetUrl } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' });
  const { data: currentPrice } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'getPrice' });
  const { data: ownerAddress } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'owner' });
  const { data: totalSupply } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'totalSupply' });
  const { data: tradingActive, refetch: refetchActive } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'tradingActive' });
  const { data: isSold, refetch: refetchSold } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'sold' });
  const { data: assetBalance, refetch: refetchAssetBal } = useReadContract({
    address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf',
    args: [userAddress as `0x${string}`], query: { enabled: !!userAddress },
  });

  // ---- Currency reads ---------------------------------------------------
  const { data: usdcBalance, refetch: refetchUsdcBal } = useReadContract({
    address: MOCK_USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',
    args: [userAddress as `0x${string}`], query: { enabled: !!userAddress },
  });
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: MOCK_USDC_ADDRESS, abi: ERC20_ABI, functionName: 'allowance',
    args: [userAddress as `0x${string}`, assetAddress], query: { enabled: !!userAddress },
  });

  // ---- Image + metadata resolution -------------------------------------
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    if (!assetUrl) return;
    const url = assetUrl as string;
    if (!url) return;
    if (!url.startsWith('http')) {
      setImages(url.includes(',') ? url.split(',').map((s) => s.trim()).filter(Boolean) : [url]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(url);
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const j = (await r.json()) as { images?: string[] };
          if (!cancelled) setImages(j.images && j.images.length ? j.images : [PLACEHOLDER]);
        } else if (!cancelled) {
          setImages([url]);
        }
      } catch {
        if (!cancelled) setImages([PLACEHOLDER]);
      }
    })();
    return () => { cancelled = true; };
  }, [assetUrl]);

  // ---- AI Appraiser + ML Oracle ----------------------------------------
  const [prospectus, setProspectus] = useState<string>('');
  const [prospectusLoading, setProspectusLoading] = useState(true);
  const [fairValue, setFairValue] = useState<number | null>(null);
  const [fairValueCategory, setFairValueCategory] = useState<string>('');
  const [fairValueLoading, setFairValueLoading] = useState(true);

  useEffect(() => {
    if (!assetAddress) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/ai/prospectus', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: assetAddress }),
        });
        const j = await res.json();
        if (!cancelled) setProspectus(res.ok && j.prospectus ? j.prospectus : '');
      } catch {/* leave empty */}
      finally { if (!cancelled) setProspectusLoading(false); }
    })();

    (async () => {
      try {
        const res = await fetch('/api/ai/fair-value', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: assetAddress }),
        });
        const j = await res.json();
        if (!cancelled && res.ok && typeof j.fairValue === 'number') {
          setFairValue(j.fairValue);
          setFairValueCategory(j.category ?? '');
        }
      } catch {/* leave null */}
      finally { if (!cancelled) setFairValueLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [assetAddress]);

  // ---- Volume (replays Traded events) ----------------------------------
  const [totalVolume, setTotalVolume] = useState(0);
  useEffect(() => {
    if (!assetAddress) return;
    let cancelled = false;
    (async () => {
      try {
        const logs = await publicClient.getLogs({
          address: assetAddress,
          event: parseAbiItem('event Traded(address indexed user, string action, uint256 amountIn, uint256 amountOut, uint256 newPrice)'),
          fromBlock: 'earliest',
          toBlock: 'latest',
        });
        let vol = 0;
        for (const log of logs) {
          if (log.args.action === 'BUY') vol += parseFloat(formatEther(log.args.amountIn as bigint));
          else vol += parseFloat(formatEther(log.args.amountOut as bigint));
        }
        if (!cancelled) setTotalVolume(vol);
      } catch (e) {
        console.error('[volume] fetch failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [assetAddress]);

  // ---- Writes -----------------------------------------------------------
  const { writeContract, isPending, data: hash, error: writeError } = useWriteContract();
  const { isSuccess: txSuccess, isError: txError } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (txSuccess) {
      refetchActive();
      refetchAllowance();
      refetchSold();
      refetchAssetBal();
      refetchUsdcBal();
    }
  }, [txSuccess, refetchActive, refetchAllowance, refetchSold, refetchAssetBal, refetchUsdcBal]);

  // ---- Derived values ---------------------------------------------------
  const isCreator = !!userAddress && !!ownerAddress && userAddress.toLowerCase() === (ownerAddress as string).toLowerCase();
  const priceNum = currentPrice ? parseFloat(formatEther(currentPrice as bigint)) : 0;
  const supplyNum = totalSupply ? parseFloat(formatEther(totalSupply as bigint)) : 1000;
  const marketCap = priceNum * supplyNum;
  const valuationNum = valuation ? parseFloat(formatEther(valuation as bigint)) : 0;

  // Dynamic buyout price — mirrors TradeableAsset.initiateBuyout math:
  // baseValuation = max(valuation, marketCap), then +25% premium.
  const dynamicBuyoutPrice = useMemo(() => {
    if (!valuation) return 0n;
    let base = valuation as bigint;
    if (tradingActive && currentPrice && totalSupply) {
      const mc = ((currentPrice as bigint) * (totalSupply as bigint)) / parseEther('1');
      if (mc > base) base = mc;
    }
    return (base * 125n) / 100n;
  }, [valuation, tradingActive, currentPrice, totalSupply]);

  // ---- Loading state ----------------------------------------------------
  if (!name) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Loading market…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Header strip */}
      <AssetHeader
        name={name as string}
        symbol={symbol as string}
        thumb={images[0] ?? PLACEHOLDER}
        price={priceNum}
        sold={!!isSold}
        tradingActive={!!tradingActive}
      />

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-6 lg:gap-8">
        {/* LEFT 8/12 */}
        <div className="col-span-12 lg:col-span-8 space-y-6 lg:space-y-8">
          <ImageCarousel images={images.length ? images : [PLACEHOLDER]} sold={!!isSold} />

          <ChartFrame sold={!!isSold} assetAddress={assetAddress} />

          <StatsRow
            marketCap={marketCap}
            valuation={valuationNum}
            volume={totalVolume}
            fairValue={fairValue}
          />

          <AIProspectusCard prospectus={prospectus} loading={prospectusLoading} />

          <MLFairValueGauge
            fair={fairValue}
            marketCap={marketCap}
            category={fairValueCategory}
            loading={fairValueLoading}
          />
        </div>

        {/* RIGHT 4/12 — context-aware action stack */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {isSold && (
            <CashOutPanel
              assetBalance={assetBalance as bigint | undefined}
              symbol={symbol as string}
              writeContract={writeContract}
              assetAddress={assetAddress}
              isPending={isPending}
            />
          )}

          {!isSold && tradingActive && (
            <TradePanel
              assetAddress={assetAddress}
              symbol={(symbol as string) ?? ''}
              usdcBalance={usdcBalance as bigint | undefined}
              assetBalance={assetBalance as bigint | undefined}
              allowance={usdcAllowance as bigint | undefined}
              writeContract={writeContract}
              isPending={isPending}
            />
          )}

          {!isSold && !tradingActive && isCreator && assetBalance && (assetBalance as bigint) > 0n && (
            <LaunchpadPanel
              assetAddress={assetAddress}
              valuation={valuation as bigint | undefined}
              allowance={usdcAllowance as bigint | undefined}
              writeContract={writeContract}
              isPending={isPending}
            />
          )}

          {!isSold && tradingActive && !isCreator && (
            <BuyoutPanel
              assetAddress={assetAddress}
              dynamicBuyoutPrice={dynamicBuyoutPrice}
              allowance={usdcAllowance as bigint | undefined}
              writeContract={writeContract}
              isPending={isPending}
            />
          )}

          {!isSold && !tradingActive && !isCreator && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 text-center">
              <p className="eyebrow mb-3">Status</p>
              <p className="text-sm text-zinc-400">
                Market not yet initialised by the creator.
              </p>
            </div>
          )}

          {/* Tx feedback */}
          {writeError && (
            <div className="px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">
              {writeError.message.split('\n')[0]}
            </div>
          )}
          {txSuccess && (
            <div className="px-4 py-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400">
              Transaction confirmed.
            </div>
          )}
          {txError && (
            <div className="px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">
              Transaction failed. Check console.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* HEADER STRIP                                                            */
/* ══════════════════════════════════════════════════════════════════════ */

function AssetHeader({
  name, symbol, thumb, price, sold, tradingActive,
}: {
  name: string; symbol: string; thumb: string; price: number; sold: boolean; tradingActive: boolean;
}) {
  return (
    <div className="border-b border-zinc-900 bg-black/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <Link href="/markets" className="text-xs text-zinc-500 hover:text-zinc-300 transition hidden md:flex items-center gap-1">
          <ChevronLeft className="w-3.5 h-3.5" /> Markets
        </Link>

        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover border border-zinc-900 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-semibold tracking-tight truncate">{name}</h1>
            {symbol && (
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{symbol}</p>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Price</p>
            <p className="text-base font-mono font-semibold tabular-nums">
              {price > 0 ? `$${price.toFixed(2)}` : '$—'}
            </p>
          </div>
          <StatusPill sold={sold} tradingActive={tradingActive} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ sold, tradingActive }: { sold: boolean; tradingActive: boolean }) {
  if (sold) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider text-red-300 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
        Target Acquired
      </span>
    );
  }
  if (tradingActive) {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        Live
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-500/10 border border-zinc-700 px-2.5 py-1 rounded-full">
      Pending
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* IMAGE CAROUSEL                                                          */
/* ══════════════════════════════════════════════════════════════════════ */

function ImageCarousel({ images, sold }: { images: string[]; sold: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  function go(delta: number) {
    const el = scrollRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(images.length - 1, activeIdx + delta));
    const child = el.children[next] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    setActiveIdx(next);
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIdx) setActiveIdx(idx);
  }

  return (
    <div className="relative">
      <div className="relative rounded-2xl border border-zinc-900 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`View ${i + 1}`}
              className="snap-center flex-shrink-0 w-full aspect-[4/3] object-cover bg-zinc-900"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
            />
          ))}
        </div>

        {/* SOLD overlay */}
        {sold && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <span className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-white border-2 border-white px-6 py-3 rotate-[-8deg]">
              Sold
            </span>
          </div>
        )}

        {/* Arrows — only when multi-image */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              disabled={activeIdx === 0}
              className="absolute top-1/2 left-3 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur hover:bg-black/80 disabled:opacity-0 disabled:cursor-not-allowed text-white flex items-center justify-center transition"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => go(1)}
              disabled={activeIdx === images.length - 1}
              className="absolute top-1/2 right-3 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur hover:bg-black/80 disabled:opacity-0 disabled:cursor-not-allowed text-white flex items-center justify-center transition"
              aria-label="Next image"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Paging dots */}
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => { setActiveIdx(i); const child = scrollRef.current?.children[i] as HTMLElement; child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }}
              className={`h-1.5 rounded-full transition-all ${i === activeIdx ? 'w-6 bg-white' : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'}`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* CHART FRAME                                                             */
/* ══════════════════════════════════════════════════════════════════════ */

function ChartFrame({ sold, assetAddress }: { sold: boolean; assetAddress: string }) {
  return (
    <div className="relative bg-zinc-950/70 border border-zinc-900 rounded-2xl p-4 md:p-6">
      <div className="flex items-baseline justify-between mb-2">
        <p className="eyebrow">Price History</p>
        <p className="text-[11px] text-zinc-600 font-mono">on-chain · Traded events</p>
      </div>
      <div className="relative h-[300px]">
        {sold && (
          <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
            <span className="text-2xl font-black tracking-tighter uppercase text-white/90 border-2 border-white/70 px-4 py-2 rotate-[-6deg]">
              Sold
            </span>
          </div>
        )}
        <PriceChart assetAddress={assetAddress} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* STATS ROW                                                               */
/* ══════════════════════════════════════════════════════════════════════ */

function StatsRow({
  marketCap, valuation, volume, fairValue,
}: {
  marketCap: number; valuation: number; volume: number; fairValue: number | null;
}) {
  const spread = fairValue && fairValue > 0 && marketCap > 0 ? ((marketCap - fairValue) / fairValue) * 100 : null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Market Cap" value={marketCap > 0 ? formatCompactUsd(marketCap) : '—'} />
      <Stat label="Valuation" value={valuation > 0 ? formatCompactUsd(valuation) : '—'} />
      <Stat label="Volume" value={volume > 0 ? formatCompactUsd(volume) : '$0.00'} />
      <Stat
        label="Vs Fair"
        value={spread === null ? '—' : `${spread > 0 ? '+' : ''}${spread.toFixed(1)}%`}
        valueClass={spread === null ? '' : spread > 0 ? 'text-red-400' : 'text-emerald-400'}
      />
    </div>
  );
}

function Stat({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-zinc-950/70 border border-zinc-900 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2">{label}</p>
      <p className={`text-lg font-mono font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* AI PROSPECTUS CARD                                                      */
/* ══════════════════════════════════════════════════════════════════════ */

function AIProspectusCard({ prospectus, loading }: { prospectus: string; loading: boolean }) {
  return (
    <div className="bg-zinc-950/70 border border-zinc-900 rounded-2xl p-6 md:p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> AI Appraiser
          </p>
          <p className="text-xs text-zinc-600 mt-1.5 font-mono">
            Gemini multimodal · investment prospectus
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5 animate-pulse">
          <div className="h-3 bg-zinc-900 rounded w-full" />
          <div className="h-3 bg-zinc-900 rounded w-11/12" />
          <div className="h-3 bg-zinc-900 rounded w-9/12" />
          <div className="h-3 bg-zinc-900 rounded w-full mt-5" />
          <div className="h-3 bg-zinc-900 rounded w-10/12" />
          <div className="h-3 bg-zinc-900 rounded w-8/12" />
        </div>
      ) : prospectus ? (
        <p className="text-zinc-300 text-sm md:text-base leading-relaxed whitespace-pre-line">
          {prospectus}
        </p>
      ) : (
        <p className="text-zinc-600 text-sm">No prospectus available. The AI engine may be offline.</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ML FAIR VALUE GAUGE                                                     */
/* ══════════════════════════════════════════════════════════════════════ */

function MLFairValueGauge({
  fair, marketCap, category, loading,
}: {
  fair: number | null; marketCap: number; category: string; loading: boolean;
}) {
  // Position on a discount<-fair->premium ruler. We map a ±50% spread to
  // the full 0–100% width and clamp beyond that so extreme outliers don't
  // run off the bar.
  const spread = fair && fair > 0 ? ((marketCap - fair) / fair) * 100 : null;
  const position = spread !== null ? Math.max(2, Math.min(98, 50 + spread)) : 50;
  const above = (spread ?? 0) > 0;

  return (
    <div className="bg-zinc-950/70 border border-zinc-900 rounded-2xl p-6 md:p-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Activity className="w-3 h-3" /> ML Fair Value Oracle
          </p>
          <p className="text-xs text-zinc-600 mt-1.5 font-mono">
            Isolation Forest · live comps
          </p>
        </div>
        <div className="text-right">
          {loading ? (
            <div className="h-8 w-32 bg-zinc-900 animate-pulse rounded" />
          ) : fair ? (
            <>
              <p className="text-2xl md:text-3xl font-mono font-semibold tabular-nums">
                {formatCompactUsd(fair)}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mt-1">Anchor</p>
            </>
          ) : (
            <p className="text-xs text-zinc-600">Oracle offline</p>
          )}
        </div>
      </div>

      {/* Gauge ruler */}
      <div className="relative h-2 bg-zinc-900 rounded-full mb-3 overflow-visible">
        {/* Background gradient: emerald (under) ↔ red (over) */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/30 via-zinc-700/0 to-red-500/30" />
        {/* Centre marker at fair value */}
        <div className="absolute top-[-3px] left-1/2 -translate-x-1/2 w-px h-[14px] bg-zinc-700" />
        {/* Current AMM position */}
        {spread !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.45)] ring-2 ring-black transition-all duration-700"
            style={{ left: `calc(${position}% - 8px)` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] mb-7">
        <span className="text-emerald-400/70">Discount</span>
        <span className="text-zinc-400">Fair</span>
        <span className="text-red-400/70">Premium</span>
      </div>

      {/* Numbers row */}
      <div className="grid grid-cols-3 gap-4 pt-5 border-t border-zinc-900">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1.5">Market Cap</p>
          <p className="text-sm font-mono font-semibold tabular-nums">
            {marketCap > 0 ? formatCompactUsd(marketCap) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1.5">Anchor</p>
          <p className="text-sm font-mono font-semibold tabular-nums">
            {fair ? formatCompactUsd(fair) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1.5">Spread</p>
          <p className={`text-sm font-mono font-semibold tabular-nums ${spread === null ? '' : above ? 'text-red-400' : 'text-emerald-400'}`}>
            {spread === null ? '—' : `${spread > 0 ? '+' : ''}${spread.toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Warning banner — over/underpriced by a lot */}
      {spread !== null && Math.abs(spread) > 30 && (
        <div className="mt-5 flex items-start gap-2.5 text-xs">
          <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${above ? 'text-red-400' : 'text-emerald-400'}`} />
          <p className="text-zinc-400 leading-relaxed">
            {above
              ? 'AMM trades meaningfully above oracle. A 25% premium hostile buyout becomes a profitable arbitrage if a whale flips physically.'
              : 'AMM trades meaningfully below oracle. The hostile-buyout floor becomes attractive — a buyer could take the asset and exit at fair value.'}
          </p>
        </div>
      )}

      {category && (
        <p className="text-[10px] text-zinc-600 mt-4 font-mono">Category: {category}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* TRADE PANEL                                                             */
/* ══════════════════════════════════════════════════════════════════════ */

type WriteFn = ReturnType<typeof useWriteContract>['writeContract'];

function TradePanel({
  assetAddress, symbol, usdcBalance, assetBalance, allowance, writeContract, isPending,
}: {
  assetAddress: `0x${string}`; symbol: string;
  usdcBalance: bigint | undefined; assetBalance: bigint | undefined; allowance: bigint | undefined;
  writeContract: WriteFn; isPending: boolean;
}) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');

  const userBal = mode === 'buy'
    ? (usdcBalance ? parseFloat(formatEther(usdcBalance)) : 0)
    : (assetBalance ? parseFloat(formatEther(assetBalance)) : 0);

  // For buy: need USDC approval to the asset contract.
  // For sell: need ASSET token approval — we use a sub-contract approve in
  // the existing logic; for now the panel just flags it via a check.
  const parsedAmount = (() => {
    try { return parseEther(amount || '0'); } catch { return 0n; }
  })();
  const needsApprove = mode === 'buy' ? (allowance ?? 0n) < parsedAmount : false;

  function handleApprove() {
    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [assetAddress, parseEther('1000000000')], // 1B USDC — once-and-done
    });
  }
  function handleTrade() {
    if (!amount || parsedAmount === 0n) return;
    if (mode === 'buy') {
      writeContract({
        address: assetAddress,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'buyTokens',
        args: [parsedAmount],
      });
    } else {
      // For sell, the contract pulls tokens via _transfer(msg.sender →
      // address(this)) which doesn't need an ERC20 allowance because the
      // asset contract IS the ERC20 (transfers internally). Direct call.
      writeContract({
        address: assetAddress,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'sellTokens',
        args: [parsedAmount],
      });
    }
  }

  return (
    <div className="bg-zinc-950/70 border border-zinc-900 rounded-2xl p-5">
      {/* Tab toggle */}
      <div className="flex bg-black rounded-lg p-1 mb-5">
        <button
          onClick={() => setMode('buy')}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
            mode === 'buy' ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setMode('sell')}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
            mode === 'sell' ? 'bg-red-500/15 text-red-300' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Amount input */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
          <span>{mode === 'buy' ? 'You pay' : 'You sell'}</span>
          <span className="font-mono tabular-nums">
            Balance: {userBal.toFixed(2)}
          </span>
        </div>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            className="w-full bg-black border border-zinc-800 focus:border-zinc-600 outline-none py-3.5 px-4 pr-16 text-2xl font-mono rounded-lg transition placeholder:text-zinc-700"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono uppercase tracking-wider">
            {mode === 'buy' ? 'USDC' : symbol}
          </span>
        </div>
      </div>

      {/* Percent shortcuts */}
      <div className="flex gap-1.5 mb-5">
        {[25, 50, 75, 100].map((p) => (
          <button
            key={p}
            onClick={() => setAmount(((userBal * p) / 100).toFixed(2))}
            className="flex-1 text-[10px] py-1.5 rounded border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition"
          >
            {p}%
          </button>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={needsApprove ? handleApprove : handleTrade}
        disabled={isPending || !amount || parsedAmount === 0n}
        className={`w-full py-3.5 rounded-lg font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
          needsApprove
            ? 'bg-white text-black hover:bg-zinc-100'
            : mode === 'buy'
            ? 'bg-emerald-500 text-black hover:bg-emerald-400'
            : 'bg-red-500 text-white hover:bg-red-400'
        }`}
      >
        {isPending
          ? 'Confirm in wallet…'
          : needsApprove
          ? 'Unlock USDC'
          : mode === 'buy'
          ? `Buy ${symbol}`
          : `Sell ${symbol}`}
      </button>

      <p className="text-[10px] text-zinc-600 mt-3 text-center font-mono">
        AMM · x·y=k · slippage priced on-chain
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* LAUNCHPAD (creator-only, market not yet initialized)                   */
/* ══════════════════════════════════════════════════════════════════════ */

function LaunchpadPanel({
  assetAddress, valuation, allowance, writeContract, isPending,
}: {
  assetAddress: `0x${string}`; valuation: bigint | undefined;
  allowance: bigint | undefined; writeContract: WriteFn; isPending: boolean;
}) {
  const requiredUsdc = valuation ? (valuation as bigint) / 2n : 0n;
  const approved = (allowance ?? 0n) >= requiredUsdc;

  function handleApprove() {
    writeContract({
      address: MOCK_USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve',
      args: [assetAddress, parseEther('1000000000')],
    });
  }
  function handleInitialize() {
    // Mirrors the contract: addLiquidity(500 tokens) — contract auto-computes
    // matching USDC from valuation × tokens / totalSupply.
    writeContract({
      address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'addLiquidity',
      args: [parseEther('500')], gas: 5_000_000n,
    });
  }

  return (
    <div className="bg-blue-500/[0.04] border border-blue-500/20 rounded-2xl p-5">
      <p className="eyebrow text-blue-400 mb-2">Launchpad</p>
      <h3 className="text-base font-semibold mb-1.5">Initialize the market.</h3>
      <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
        Deposit 500 shares + ~{formatCompactUsd(parseFloat(formatEther(requiredUsdc)))} USDC to seed the AMM pool and open trading.
      </p>

      {!approved ? (
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="w-full py-3 rounded-lg bg-white text-black font-semibold hover:bg-zinc-100 transition disabled:opacity-40"
        >
          {isPending ? 'Confirm…' : 'Approve USDC'}
        </button>
      ) : (
        <button
          onClick={handleInitialize}
          disabled={isPending}
          className="w-full py-3 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition disabled:opacity-40"
        >
          {isPending ? 'Confirm…' : 'Initialize Market'}
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* BUYOUT (non-creator, not yet sold)                                      */
/* ══════════════════════════════════════════════════════════════════════ */

function BuyoutPanel({
  assetAddress, dynamicBuyoutPrice, allowance, writeContract, isPending,
}: {
  assetAddress: `0x${string}`; dynamicBuyoutPrice: bigint;
  allowance: bigint | undefined; writeContract: WriteFn; isPending: boolean;
}) {
  const needsApprove = (allowance ?? 0n) < dynamicBuyoutPrice;
  const buyoutUsd = parseFloat(formatEther(dynamicBuyoutPrice));

  function handleApprove() {
    writeContract({
      address: MOCK_USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve',
      args: [assetAddress, parseEther('1000000000')],
    });
  }
  function handleBuyout() {
    writeContract({
      address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'initiateBuyout',
      args: [dynamicBuyoutPrice],
    });
  }

  return (
    <div className="bg-red-500/[0.04] border border-red-500/20 rounded-2xl p-5">
      <p className="eyebrow text-red-400 mb-2">Hostile Takeover</p>
      <h3 className="text-base font-semibold mb-1.5">Acquire the asset.</h3>
      <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
        Pay 25% above the higher of valuation or market cap. Trading halts and every token holder is cashed out pro-rata.
      </p>

      <div className="bg-black/40 rounded-lg p-3 mb-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Buyout Price</span>
        <span className="text-base font-mono font-semibold tabular-nums">
          {formatCompactUsd(buyoutUsd)}
        </span>
      </div>

      {needsApprove ? (
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="w-full py-3 rounded-lg bg-zinc-800 text-zinc-200 font-semibold hover:bg-zinc-700 transition disabled:opacity-40"
        >
          {isPending ? 'Confirm…' : 'Unlock USDC'}
        </button>
      ) : (
        <button
          onClick={handleBuyout}
          disabled={isPending}
          className="w-full py-3 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-400 transition disabled:opacity-40"
        >
          {isPending ? 'Confirm…' : 'Execute Buyout'}
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* CASH OUT (sold = true)                                                  */
/* ══════════════════════════════════════════════════════════════════════ */

function CashOutPanel({
  assetBalance, symbol, writeContract, assetAddress, isPending,
}: {
  assetBalance: bigint | undefined; symbol: string;
  writeContract: WriteFn; assetAddress: `0x${string}`; isPending: boolean;
}) {
  const balanceNum = assetBalance ? parseFloat(formatEther(assetBalance)) : 0;

  function handleCashOut() {
    writeContract({
      address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'cashOut',
    });
  }

  return (
    <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl p-5">
      <p className="eyebrow text-emerald-400 mb-2">Payout Available</p>
      <h3 className="text-base font-semibold mb-1.5">Claim your share.</h3>
      <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
        The asset has been acquired. Your share of the total pot is calculated pro-rata
        from your holdings.
      </p>

      <div className="bg-black/40 rounded-lg p-3 mb-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Your tokens</span>
        <span className="text-base font-mono font-semibold tabular-nums">
          {balanceNum.toFixed(2)} {symbol}
        </span>
      </div>

      <button
        onClick={handleCashOut}
        disabled={isPending || balanceNum === 0}
        className="w-full py-3 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? 'Confirm…' : balanceNum > 0 ? 'Claim Share' : 'Nothing to claim'}
      </button>
    </div>
  );
}
