'use client';

import { motion } from 'framer-motion';
import { Activity, Brain, LineChart } from 'lucide-react';

/**
 * Three-pillar explainer — the spine of the marketing pitch.
 *
 * Each card is intentionally restrained: a single icon, a one-line headline,
 * a 2-3 sentence body. The interactive bit is a top-left "scanner" line that
 * sweeps the card on hover, plus a soft accent halo. We deliberately don't
 * over-animate — the hero already carries the visual weight.
 */

const PILLARS = [
  {
    icon: Activity,
    accent: 'from-blue-500/40 to-cyan-400/0',
    border: 'group-hover:border-blue-500/40',
    eyebrow: 'AMM Liquidity',
    title: 'Constant-product math, instant fills.',
    body: 'A Uniswap-style x·y=k pool prices every asset algorithmically. Traders never wait for counterparties — slippage is just a transparent curve, computed on-chain.',
  },
  {
    icon: Brain,
    accent: 'from-emerald-500/40 to-teal-400/0',
    border: 'group-hover:border-emerald-500/40',
    eyebrow: 'AI Appraiser',
    title: 'Christie’s-grade prospectus, generated on listing.',
    body: 'A multimodal LLM scans the raw imagery and seller notes, then writes a standardised investment prospectus. Sellers stop fighting copywriting; buyers get a consistent, professional briefing on every listing.',
  },
  {
    icon: LineChart,
    accent: 'from-purple-500/40 to-fuchsia-400/0',
    border: 'group-hover:border-purple-500/40',
    eyebrow: 'ML Quant Oracle',
    title: 'Isolation Forest filters the noise out of the market.',
    body: 'Python backend scrapes live retail comps from Chrono24, Zillow, autotrader, then routes them through an anomaly-detection model to drop counterfeits and outliers. The median of the surviving cluster is your real-world fair value.',
  },
];

export default function PillarsSection() {
  return (
    <section id="pillars" className="relative py-28 md:py-36 overflow-hidden">
      {/* Subtle backdrop gradient — not full-bleed, just a soft glow behind the cards. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06),transparent_70%)] pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-400 mb-4">Built on three rails</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            DeFi mechanics. Sotheby&apos;s polish. Quant-grade truth.
          </h2>
          <p className="text-zinc-400 text-base md:text-lg leading-relaxed">
            We don&apos;t bolt AI onto a DEX. The smart contract, the language model, and the
            statistical oracle each solve a problem the other two can&apos;t.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.eyebrow}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-15%' }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: 'easeOut' }}
              className={`group relative overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/50 backdrop-blur-sm p-8 transition-colors ${p.border}`}
            >
              {/* Accent halo — fades in on hover */}
              <div
                aria-hidden
                className={`absolute -top-20 -right-20 w-48 h-48 rounded-full bg-gradient-radial ${p.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                style={{ background: 'radial-gradient(circle, var(--tw-gradient-stops))' }}
              />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 mb-6">
                  <p.icon className="w-5 h-5 text-zinc-300" strokeWidth={1.5} />
                </div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-3">{p.eyebrow}</p>
                <h3 className="text-xl font-semibold text-white mb-3 leading-snug">{p.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{p.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
