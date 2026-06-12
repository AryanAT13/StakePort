'use client';

import { motion } from 'framer-motion';

/**
 * The "Contract" section — replaces the meaningless stats row with one bold,
 * specific, mathematically true claim. It's our credibility lever: anyone
 * can verify it by reading TradeableAsset.initiateBuyout.
 */
export default function Guarantee() {
  return (
    <section className="relative py-32 md:py-44 border-t border-zinc-900/60">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-12%' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 mb-12">The Contract</p>

          <h2 className="text-[clamp(2.5rem,5.5vw,5.25rem)] font-semibold tracking-[-0.035em] leading-[1.02] text-white max-w-6xl mb-16">
            Every asset can be exited at{' '}
            <span className="text-emerald-300">125% of market cap.</span>
          </h2>

          <div className="grid grid-cols-12 gap-x-8">
            <div className="col-span-12 md:col-span-3">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Why it holds</p>
            </div>
            <div className="col-span-12 md:col-span-9 mt-6 md:mt-0">
              <p className="text-zinc-300 text-lg md:text-xl max-w-3xl leading-[1.6]">
                It isn&apos;t a slogan — it&apos;s a clause. If on-chain trading drifts below
                the asset&apos;s real-world value, any whale can pay a 25% hostile-buyout
                premium, take the physical object, and clear the pool. Every token holder
                gets cashed out at the higher of the two prices, pro-rata. Math, not marketing.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
