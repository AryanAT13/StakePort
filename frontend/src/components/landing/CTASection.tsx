'use client';

import { motion } from 'framer-motion';
import EnterTerminalButton from './EnterTerminalButton';

/**
 * Final-fold CTA. The hero already has a button; this one's job is to catch
 * users who scrolled the whole page evaluating the product. We restate the
 * single most concrete value prop, then drop the same button.
 */
export default function CTASection() {
  return (
    <section className="relative py-28 md:py-36 overflow-hidden">
      {/* Spotlight backdrop — strong enough to break the rhythm of the
          preceding alternating sections. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.10),transparent_60%),radial-gradient(ellipse_at_top,rgba(59,130,246,0.10),transparent_60%)] pointer-events-none"
      />
      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-[1.05]">
            Liquidity for the things that{' '}
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              never had any.
            </span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-10">
            Connect your wallet, mint a testnet USDC balance, and start trading
            fractional ownership of real-world wealth in under sixty seconds.
          </p>
          <div className="flex justify-center">
            <EnterTerminalButton className="text-base px-8 py-4" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
