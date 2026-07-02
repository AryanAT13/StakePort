'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Cpu } from 'lucide-react';
import { useSession } from '@/hooks/useSession';

/**
 * Risk Alignment card — Phase 9, Task 3.
 *
 * Buyer-only. Sits directly below the price chart on the asset page. Pulls
 * the quant risk classification (gradient-boosted model, see
 * ai-engine/risk_engine.py) via /api/ai/risk-alignment, compares the asset's
 * tier to the buyer's onboarding-declared appetite, and shows a casual,
 * human one-liner written by the LLM.
 *
 * Renders nothing when:
 *   - the viewer is the asset's creator (this is a *buyer* feature), or
 *   - the user never set a risk profile (legacy / skipped onboarding).
 *
 * Layout is intentionally horizontal — verdict on the left, copy in the
 * middle, a compact tier gauge on the right — so it reads as one calm strip
 * rather than a tall stack.
 */

type Alignment = 'high' | 'medium' | 'low';
type Data = {
  riskScore: number;
  riskTier: 'conservative' | 'moderate' | 'aggressive';
  alignment: Alignment;
  explanation: string;
  confidence: number;
  profile: string;
};

const ALIGN_CONFIG: Record<
  Alignment,
  { label: string; icon: typeof ShieldCheck; ring: string; chip: string; tint: string; bar: string }
> = {
  high: {
    label: 'Risk Alignment: High',
    icon: ShieldCheck,
    ring: 'border-emerald-500/25',
    chip: 'bg-emerald-500/15 text-emerald-300',
    tint: 'text-emerald-400',
    bar: 'bg-emerald-400',
  },
  medium: {
    label: 'Risk Alignment: Medium',
    icon: ShieldAlert,
    ring: 'border-amber-500/25',
    chip: 'bg-amber-500/15 text-amber-300',
    tint: 'text-amber-400',
    bar: 'bg-amber-400',
  },
  low: {
    label: 'Risk Alignment: Low',
    icon: ShieldX,
    ring: 'border-red-500/25',
    chip: 'bg-red-500/15 text-red-300',
    tint: 'text-red-400',
    bar: 'bg-red-400',
  },
};

export default function RiskAlignmentCard({
  assetAddress,
  isCreator,
}: {
  assetAddress: `0x${string}`;
  isCreator: boolean;
}) {
  const { user, loading } = useSession();
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'hidden'>('loading');

  useEffect(() => {
    if (loading) return;
    // Buyer-only feature; also needs a declared profile to compare against.
    if (isCreator || !user?.riskProfile) {
      setState('hidden');
      return;
    }

    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const res = await fetch('/api/ai/risk-alignment', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: assetAddress, profile: user.riskProfile }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setState('hidden');
          return;
        }
        const j = (await res.json()) as Data;
        setData(j);
        setState('ready');
      } catch {
        if (!cancelled) setState('hidden');
      }
    })();
    return () => { cancelled = true; };
  }, [assetAddress, user, loading, isCreator]);

  if (state === 'hidden') return null;

  if (state === 'loading' || !data) {
    return (
      <div className="panel p-5 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-zinc-900 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 bg-zinc-900 rounded w-1/3" />
            <div className="h-3 bg-zinc-900 rounded w-3/4" />
          </div>
          <div className="hidden sm:block w-28 h-10 bg-zinc-900 rounded" />
        </div>
      </div>
    );
  }

  const cfg = ALIGN_CONFIG[data.alignment];
  const Icon = cfg.icon;
  // Marker position on the 0-100 risk track.
  const markerPct = Math.max(3, Math.min(97, data.riskScore));

  return (
    <div className={`panel ${cfg.ring} p-5`}>
      <div className="flex items-center gap-4">
        {/* Verdict icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.chip}`}>
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>

        {/* Verdict + copy */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold ${cfg.tint}`}>{cfg.label}</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-zinc-500">
              <Cpu className="w-2.5 h-2.5" /> ML scored
            </span>
          </div>
          <p className="text-sm text-zinc-300 leading-snug">{data.explanation}</p>
        </div>

        {/* Compact tier gauge */}
        <div className="hidden sm:block w-32 flex-shrink-0">
          <div className="flex justify-between text-[8px] uppercase tracking-[0.12em] text-zinc-600 mb-1.5">
            <span>Cons</span>
            <span>Mod</span>
            <span>Aggr</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-zinc-800 overflow-visible">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/40 via-amber-500/40 to-red-500/40" />
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${cfg.bar} ring-2 ring-black shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-all duration-700`}
              style={{ left: `calc(${markerPct}% - 6px)` }}
            />
          </div>
          <div className="text-center mt-1.5">
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {data.riskScore.toFixed(0)}/100 · {data.riskTier}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
