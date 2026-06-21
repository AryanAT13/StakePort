'use client';

import { useEffect, useState } from 'react';
import { Check, AlertTriangle, X, Shield } from 'lucide-react';
import { useSession } from '@/hooks/useSession';

/**
 * Risk-match badge — Phase 8.
 *
 * Surfaces the LLM's verdict on whether THIS asset fits the user's stated
 * appetite. Sits in the asset detail right rail, between the action panel
 * and the ML Oracle. Renders nothing if the user has no `riskProfile` on
 * file (e.g. legacy account before onboarding existed).
 *
 * Three states map to three visual treatments:
 *   good     → emerald tick — "Aligned with your appetite"
 *   caution  → amber triangle — "Outside your usual range"
 *   mismatch → red cross — "Not your appetite"
 *
 * The endpoint is /api/ai/risk-match; we don't cache the result client-side
 * because each {asset, profile} pair is cheap to recompute and stays fresh.
 */

type Match = { match: 'good' | 'caution' | 'mismatch'; reason: string; profile: string };

const CONFIG = {
  good: {
    icon: Check,
    label: 'Aligned with your appetite',
    bg: 'bg-emerald-500/[0.06]',
    border: 'border-emerald-500/25',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
  },
  caution: {
    icon: AlertTriangle,
    label: 'Outside your usual range',
    bg: 'bg-amber-500/[0.06]',
    border: 'border-amber-500/25',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
  },
  mismatch: {
    icon: X,
    label: 'Not your appetite',
    bg: 'bg-red-500/[0.06]',
    border: 'border-red-500/25',
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/15',
  },
} as const;

export default function AssetRiskBadge({ assetAddress }: { assetAddress: `0x${string}` }) {
  const { user, loading } = useSession();
  const [data, setData] = useState<Match | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty'>('loading');

  useEffect(() => {
    if (loading) return;
    if (!user?.riskProfile) {
      setState('empty');
      return;
    }

    let cancelled = false;
    setState('loading');

    // The prospectus has to land before the risk endpoint will answer; we
    // retry a couple of times with backoff to cover that race. The asset
    // page kicks off the prospectus fetch on mount in parallel.
    let attempt = 0;
    const maxAttempts = 4;
    const tryFetch = async () => {
      attempt++;
      try {
        const res = await fetch('/api/ai/risk-match', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: assetAddress, riskProfile: user.riskProfile }),
        });
        if (cancelled) return;
        if (res.status === 425 && attempt < maxAttempts) {
          // Prospectus not ready yet — back off and retry.
          setTimeout(tryFetch, 1500 * attempt);
          return;
        }
        if (!res.ok) {
          setState('empty');
          return;
        }
        const j = (await res.json()) as Match;
        setData(j);
        setState('ready');
      } catch {
        if (!cancelled) setState('empty');
      }
    };
    tryFetch();

    return () => { cancelled = true; };
  }, [assetAddress, user, loading]);

  if (loading || state === 'empty') return null;

  if (state === 'loading' || !data) {
    return (
      <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="h-2.5 bg-zinc-900 rounded w-1/2" />
            <div className="h-3 bg-zinc-900 rounded w-3/4" />
            <div className="h-2.5 bg-zinc-900 rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  const cfg = CONFIG[data.match];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-5 backdrop-blur-sm`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.iconBg} ${cfg.iconColor} flex-shrink-0`}>
          <Icon className="w-4 h-4" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3 h-3" />
            Risk Match · {data.profile}
          </p>
          <p className="text-sm font-semibold text-white mb-1.5 leading-snug">{cfg.label}</p>
          <p className="text-xs text-zinc-400 leading-relaxed">{data.reason}</p>
        </div>
      </div>
    </div>
  );
}
