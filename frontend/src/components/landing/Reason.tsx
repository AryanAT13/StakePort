'use client';

import { motion } from 'framer-motion';

/**
 * "Why we exist" — the editorial beat that follows the manifesto.
 *
 * Promoted from a footer-adjacent CTA in the previous draft because, as the
 * brief noted, this line lands harder than most of the mechanic-explaining
 * copy that used to sit here. It's the strongest single sentence on the
 * page and now operates as the bridge between the manifesto and the
 * product explanation that follows.
 */
export default function Reason() {
  return (
    <section id="why" className="relative py-32 md:py-44 border-t border-zinc-900/60">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-12%' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow mb-12 md:mb-16">Why we exist</p>

          <h2 className="text-[clamp(2.75rem,6vw,5.5rem)] font-semibold tracking-[-0.04em] leading-[1.0] text-white max-w-6xl mb-16 md:mb-20">
            Real wealth deserves
            <br />
            real markets.
          </h2>

          <div className="grid grid-cols-12 gap-x-8">
            <div className="col-span-12 md:col-span-3">
              <p className="eyebrow">The case</p>
            </div>
            <div className="col-span-12 md:col-span-9 mt-6 md:mt-0 space-y-7">
              <p className="text-zinc-300 text-lg md:text-xl max-w-3xl leading-[1.6]">
                For three centuries, the rarest objects have been priced by closed
                circles — auction houses, private brokers, members-only catalogues.
                The buyer pool was thin. Discovery was opaque. Liquidity was theatrical.
              </p>
              <p className="text-zinc-300 text-lg md:text-xl max-w-3xl leading-[1.6]">
                StakePort is the market this asset class always deserved.{' '}
                <span className="text-white">Open. Continuous. Anchored to the real world.</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
