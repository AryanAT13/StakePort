'use client';

import { Fragment } from 'react';
import { Check } from 'lucide-react';

/**
 * Horizontal step indicator for the create-asset wizard.
 *
 * Three visual states per node: done (filled chip + check), active (white
 * outline), pending (zinc-800 outline). Connector lines pick the same
 * palette so the eye sweeps through completed → active in one motion.
 *
 * Labels collapse to icon-only at <md to keep the strip thin on mobile.
 */
const STEPS = [
  { num: '01', label: 'Details' },
  { num: '02', label: 'Imagery' },
  { num: '03', label: 'AI Preview' },
  { num: '04', label: 'Launch' },
] as const;

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2.5 md:gap-3 mb-14 md:mb-16">
      {STEPS.map((s, i) => {
        const stepNum = i + 1;
        const done = current > stepNum;
        const active = current === stepNum;
        return (
          <Fragment key={s.num}>
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono transition ${
                  done
                    ? 'bg-white text-black'
                    : active
                    ? 'border border-white text-white'
                    : 'border border-zinc-800 text-zinc-600'
                }`}
              >
                {done ? <Check className="w-3 h-3" strokeWidth={2.5} /> : s.num}
              </div>
              <span
                className={`text-[11px] uppercase tracking-[0.2em] hidden md:block ${
                  active ? 'text-white' : done ? 'text-zinc-400' : 'text-zinc-600'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 max-w-[64px] ${done ? 'bg-white/40' : 'bg-zinc-900'}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
