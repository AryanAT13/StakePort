'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import EnterTerminalButton from './EnterTerminalButton';

const HeroCanvas = dynamic(() => import('./HeroCanvas'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.16),transparent_60%),linear-gradient(180deg,#000_0%,#020617_100%)]" />
  ),
});

/**
 * Hero — Phase 8.3.
 *
 * Reverts the additive copy from 8.2 per latest brief:
 *   - status row ("Open testnet · Gas-free trial · No card") deleted
 *   - "— Chapter I" caption on the stenciled watermark deleted
 *
 * Kept: the split layout, the stenciled-outline top phrase, the 40%
 * solid middle phrase, the rotated punchline with emerald accent rule,
 * and the right-edge vertical hairline.
 */
export default function Hero() {
  return (
    <section className="relative h-screen min-h-[680px] w-full overflow-hidden">
      <div className="absolute inset-0">
        <HeroCanvas />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_55%,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.55)_42%,rgba(0,0,0,0)_82%)] pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/85 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none" />

      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 grid grid-cols-12 items-center gap-6">
        {/* LEFT — editorial column */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.14, delayChildren: 0.2 } },
          }}
          className="col-span-12 lg:col-span-7 pt-20"
        >
          <motion.p
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(2.25rem,5.2vw,4.5rem)] font-semibold tracking-[-0.035em] leading-[1.02] text-zinc-50 text-balance mb-8 md:mb-10"
          >
            Wealth has always traded on a different clock.
          </motion.p>

          <motion.p
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(1rem,1.4vw,1.25rem)] font-normal tracking-[-0.005em] leading-[1.5] text-zinc-300/85 max-w-xl mb-12"
          >
            A Patek that doubles in three years sits in a safe for a decade.
            A Manhattan penthouse takes eighteen months to clear escrow.
            The world&apos;s most valuable things appreciate quietly and change hands rarely.
          </motion.p>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-5"
          >
            <EnterTerminalButton size="lg" />
            <a
              href="#why"
              className="group relative text-sm text-zinc-400 hover:text-white transition inline-flex items-center gap-2 px-1 py-2"
            >
              Why this exists
              <span aria-hidden className="text-zinc-700 group-hover:text-zinc-500 group-hover:translate-y-0.5 transition">↓</span>
              <span className="absolute inset-x-1 -bottom-0.5 h-px bg-white/0 group-hover:bg-white/40 transition" />
            </a>
          </motion.div>
        </motion.div>

        {/* RIGHT — brutalist watermark (caption removed in 8.3) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="col-span-12 lg:col-span-5 hidden lg:flex flex-col justify-center items-end text-right relative h-full"
        >
          <div className="select-none relative">
            <div className="absolute -right-5 top-4 bottom-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent pointer-events-none" />

            {/* Top phrase — STENCILED (outline only, transparent fill). */}
            <p
              className="text-[clamp(2.25rem,3.6vw,3.5rem)] font-black tracking-[-0.04em] leading-[0.92] uppercase mb-6"
              style={{
                WebkitTextStroke: '1px rgba(255,255,255,0.32)',
                color: 'transparent',
              }}
            >
              Scarcity
              <br />
              was the
              <br />
              moat.
            </p>

            {/* Middle phrase — solid 40% white, slight rotation. */}
            <p
              className="text-[clamp(1.5rem,2.4vw,2.25rem)] font-bold tracking-[-0.025em] leading-[1.0] uppercase mb-8 text-white/40"
              style={{ transform: 'rotate(-1deg) translateX(-3%)' }}
            >
              The moat
              <br />
              was the point.
            </p>

            {/* Punchline — full white, rotated, with an emerald accent rule. */}
            <div style={{ transform: 'rotate(-2.5deg)', transformOrigin: 'right center' }}>
              <p className="text-[clamp(3rem,5.2vw,5.8rem)] font-black tracking-[-0.05em] leading-[0.88] uppercase text-white">
                We&apos;re
                <br />
                filling
                <br />
                it in.
              </p>
              <div className="mt-3 ml-auto w-32 h-[2px] bg-gradient-to-r from-emerald-500/70 via-emerald-400 to-transparent" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
