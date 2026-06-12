'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import EnterTerminalButton from './EnterTerminalButton';

// The shader scene is heavy — keep it out of every non-landing bundle.
const HeroCanvas = dynamic(() => import('./HeroCanvas'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.16),transparent_60%),linear-gradient(180deg,#000_0%,#020617_100%)]" />
  ),
});

/**
 * Hero = the manifesto.
 *
 * The shader is the backdrop; the only thing we say up top is the editorial
 * argument. Type cascades through four tiers (statement → context → pivot →
 * climax) and the left-side radial mask keeps the WebGL noise from competing
 * with the words.
 *
 * No pill, no eyebrow gradient, no feature checklist. Restraint is the
 * design language now.
 */
export default function Hero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <HeroCanvas />
      </div>

      {/* Left-weighted darkness so the manifesto always wins on contrast. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_55%,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.55)_42%,rgba(0,0,0,0)_82%)] pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/90 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-40 pb-36 md:pt-52 md:pb-44">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.18, delayChildren: 0.15 } },
          }}
          className="max-w-4xl"
        >
          {/* Eyebrow — quiet, mono. The mark is in the nav; here we let
              the words establish the tone. */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 mb-14 md:mb-16"
          >
            <span className="block w-1 h-1 rounded-full bg-emerald-400" />
            <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-400 font-mono">
              A note from the founders
            </span>
          </motion.div>

          {/* Tier 1 — the opening statement. Largest, primary weight. */}
          <motion.p
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(2.5rem,6vw,5rem)] font-semibold tracking-[-0.035em] leading-[1.02] text-zinc-50 max-w-4xl text-balance mb-10 md:mb-12"
          >
            Wealth has always traded on a different clock.
          </motion.p>

          {/* Tier 2 — context. Medium, lighter weight, slightly muted. */}
          <motion.p
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(1.125rem,1.9vw,1.55rem)] font-normal tracking-[-0.008em] leading-[1.5] text-zinc-300/90 max-w-3xl mb-10 md:mb-14"
          >
            A Patek that doubles in three years sits in a safe for a decade. A
            Manhattan penthouse takes eighteen months to clear escrow. The
            world&apos;s most valuable things appreciate quietly and change hands rarely.
          </motion.p>

          {/* Tier 3 — pivot. Slightly larger, declarative. */}
          <motion.p
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(1.5rem,3vw,2.5rem)] font-medium tracking-[-0.022em] leading-[1.1] text-zinc-100 max-w-3xl mb-10 md:mb-12"
          >
            Scarcity was the moat.
            <br />
            The moat was the point.
          </motion.p>

          {/* Tier 4 — climax. Tightest tracking, white. */}
          <motion.p
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(2rem,5.2vw,4.25rem)] font-semibold tracking-[-0.045em] leading-[0.98] text-white mb-14 md:mb-16"
          >
            We&apos;re filling it in.
          </motion.p>

          {/* CTA row */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-6"
          >
            <EnterTerminalButton size="lg" />
            <a
              href="#why"
              className="text-sm text-zinc-500 hover:text-zinc-200 transition inline-flex items-center gap-1.5 px-1"
            >
              Why this exists
              <span aria-hidden className="text-zinc-700">↓</span>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
