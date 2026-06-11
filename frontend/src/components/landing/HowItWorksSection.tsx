'use client';

import { motion } from 'framer-motion';
import { Upload, Sparkles, Coins, TrendingUp } from 'lucide-react';

/**
 * Four-step "how it works". Renders as a numbered vertical timeline on
 * mobile and a horizontal stepper on md+, with each card animating in
 * sequentially as it enters the viewport.
 *
 * Why no images / illustrations: the icons + step numbers are enough to
 * carry the structure, and bespoke illustrations are a black hole on a
 * marketing iteration deadline. We can swap them for SVG dioramas later
 * without touching this layout.
 */

const STEPS = [
  {
    icon: Upload,
    title: 'List the Asset',
    body: 'Upload photos and a short description. Sign one transaction — the factory mints a fresh ERC-20 contract and 1,000 fractional shares straight to your wallet.',
  },
  {
    icon: Sparkles,
    title: 'AI Generates a Prospectus',
    body: 'A multimodal model reads your imagery, classifies the asset, and writes a Christie’s-grade investment briefing. Meanwhile the ML oracle scrapes live comps to anchor a fair-value floor.',
  },
  {
    icon: Coins,
    title: 'Initialize the Market',
    body: 'Approve USDC and post 50% of the valuation as the initial liquidity pool. Trading goes live — anyone can swap into shares via the constant-product AMM.',
  },
  {
    icon: TrendingUp,
    title: 'Trade or Exit via Buyout',
    body: 'Retail trades flow through the pool. If real-world value diverges, a whale can execute a 25% premium hostile buyout — the pot is distributed pro-rata to every token holder.',
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how" className="relative py-28 md:py-36">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-4">The full loop</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            From a luxury watch to a tradable ticker in four steps.
          </h2>
          <p className="text-zinc-400 text-base md:text-lg leading-relaxed">
            Every asset on the platform travels the same path. Predictable for sellers,
            transparent for traders, mathematically fair for everyone holding tokens at exit.
          </p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-px bg-zinc-900 border border-zinc-900 rounded-2xl overflow-hidden">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
              className="relative bg-black p-8 md:p-7"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs text-zinc-600">0{i + 1}</span>
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800">
                  <step.icon className="w-4 h-4 text-zinc-300" strokeWidth={1.5} />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3 leading-snug">{step.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{step.body}</p>

              {/* Connector arrow between cards on desktop. */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 z-10 text-zinc-700">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7H11M11 7L7 3M11 7L7 11" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
