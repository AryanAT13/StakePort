'use client';

import { motion } from 'framer-motion';
import EnterTerminalButton from './EnterTerminalButton';

/**
 * Final close.
 *
 * The "Real wealth deserves real markets" line has been promoted to a
 * mid-page beat (see Reason.tsx), so the closing CTA gets a quieter,
 * action-oriented framing instead. One short instruction, one button.
 */
export default function CTASection() {
  return (
    <section className="relative py-32 md:py-48 border-t border-zinc-900/60">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow mb-12">Begin</p>

          <h2 className="text-[clamp(3rem,8vw,7rem)] font-semibold tracking-[-0.045em] leading-[0.95] text-white max-w-5xl mb-12">
            Open the terminal.
          </h2>

          <p className="text-zinc-400 text-lg md:text-xl max-w-xl mb-12 leading-[1.55]">
            Mint a testnet USDC balance. Trade your first fractional share.
            Sixty seconds — and you&apos;re in.
          </p>

          <EnterTerminalButton size="lg" />
        </motion.div>
      </div>
    </section>
  );
}
