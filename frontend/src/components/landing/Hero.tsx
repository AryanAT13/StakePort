'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import EnterTerminalButton from './EnterTerminalButton';

// Code-split the WebGL hero so the rest of the page (and every other route)
// never pays for Three.js bytes. SSR is off because R3F needs a DOM canvas.
const HeroCanvas = dynamic(() => import('./HeroCanvas'), {
  ssr: false,
  loading: () => (
    // Static gradient fallback in the (~1s) window before the canvas mounts.
    // Matches the shader's overall palette so the hand-off is invisible.
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.18),transparent_60%),linear-gradient(180deg,#000_0%,#020617_100%)]" />
  ),
});

export default function Hero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* WebGL background */}
      <div className="absolute inset-0">
        <HeroCanvas />
      </div>

      {/* Top mask — gives the nav a usable contrast strip + sells the depth. */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
      {/* Bottom fade so the next section blends in. */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

      {/* Foreground content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-40 pb-32 md:pt-48 md:pb-40">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="max-w-3xl"
        >
          {/* Live pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-wider text-zinc-300 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live on chain · AI Oracle online
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.02] mb-6">
            Trade fractional ownership of{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              real world wealth.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed">
            An AMM for luxury watches, exotic cars, sneakers, and prime real estate —
            peg-protected by an ML fair-value oracle and a 25% hostile-buyout floor.
            Sotheby's-grade prospectus, generated on listing by a multimodal LLM.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <EnterTerminalButton className="text-base px-8 py-4" />
            <a
              href="#how"
              className="text-sm text-zinc-400 hover:text-white transition inline-flex items-center gap-2 px-4 py-3"
            >
              How it works
              <span aria-hidden>↓</span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
