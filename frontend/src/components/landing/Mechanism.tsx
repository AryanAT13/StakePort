'use client';

import { motion } from 'framer-motion';

/**
 * "How we built it" — but as an editorial spread, not a card grid.
 *
 * Each rail gets a row: a numeric mark on the left, a single declarative
 * sentence in display type on the right, then a small body paragraph and a
 * subtitle tag. Border between rows is the only divider; no card borders,
 * no gradients. Restraint is the design.
 */

const RAILS = [
  {
    n: '01',
    tag: 'The AMM',
    headline: 'Every share has a price, every second.',
    body:
      'A constant-product pool quotes fractions continuously: no order books, no makers, no waiting. The first trade and the millionth clear at the same speed, on the same curve, with the same math.',
  },
  {
    n: '02',
    tag: 'The Appraiser',
    headline: 'Every listing speaks the same language.',
    body:
      'A multimodal model reads the seller\'s photos and notes, then writes a standardised investment prospectus, the kind a Sotheby\'s analyst would put on a tear sheet. Buyers get an apples-to-apples briefing on every asset. Sellers stop writing copy.',
  },
  {
    n: '03',
    tag: 'The Oracle',
    headline: 'Every price is anchored to reality.',
    body:
      'A Python service pulls live comps from Chrono24, Zillow, the auctioneers, then routes them through an isolation forest that drops counterfeits, parts listings, and noise. What survives is the cluster. The median of the cluster is the floor.',
  },
];

export default function Mechanism() {
  return (
    <section id="mechanism" className="relative py-32 md:py-44 border-t border-zinc-900/60">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-12 gap-x-8 mb-20 md:mb-28">
          <div className="col-span-12 md:col-span-3">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">The Mechanism</p>
          </div>
          <div className="col-span-12 md:col-span-9 mt-10 md:mt-0">
            <h2 className="text-[clamp(2.25rem,4.5vw,3.75rem)] font-semibold tracking-[-0.03em] leading-[1.02] text-white max-w-3xl">
              Three rails. One market.
            </h2>
            <p className="text-zinc-400 text-lg mt-6 max-w-xl leading-relaxed">
              Each one solves a problem the other two can&apos;t.
            </p>
          </div>
        </div>

        <div>
          {RAILS.map((r, i) => (
            <motion.div
              key={r.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-12 gap-x-8 py-14 md:py-20 border-t border-zinc-900"
            >
              <div className="col-span-12 md:col-span-3 flex flex-col gap-2">
                <span className="font-mono text-sm text-zinc-600 tabular-nums">{r.n}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">{r.tag}</span>
              </div>
              <div className="col-span-12 md:col-span-9 mt-6 md:mt-0">
                <h3 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-[-0.025em] leading-[1.08] text-zinc-100 max-w-3xl mb-5">
                  {r.headline}
                </h3>
                <p className="text-zinc-400 text-base md:text-lg max-w-2xl leading-[1.65]">
                  {r.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
