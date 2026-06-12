'use client';

import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';

/**
 * Cinematic closing composition.
 *
 * Layout:
 *   [ small functional footer ]
 *   [ thin baseline of credits — sits over the bottom of the wordmark ]
 *   [ giant metallic wordmark, slight bleed below the page ]
 *
 * The wordmark + credits share a single positioned container so they read
 * as one block rather than "footer + a wordmark below". Credits float at
 * the visual baseline of the page; the wordmark is behind them with a
 * brushed-titanium gradient, slight blur for dust, and the .grain utility
 * for the industrial finish.
 */
export default function WordmarkFooter() {
  return (
    <footer className="relative border-t border-zinc-900/60 overflow-hidden bg-black">
      {/* Functional footer block */}
      <div className="relative z-20 max-w-7xl mx-auto px-6 pt-20 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <LogoMark className="w-[18px] h-[18px] text-white" />
              <span className="text-[15px] font-semibold tracking-[-0.012em] text-white">
                StakePort
              </span>
            </div>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              An exchange for physical scarcity.
            </p>
          </div>

          <div>
            <p className="eyebrow mb-4">Product</p>
            <ul className="space-y-2.5 text-sm text-zinc-300">
              <li><Link href="/markets" className="hover:text-white transition">Markets</Link></li>
              <li><Link href="/create" className="hover:text-white transition">List an Asset</Link></li>
              <li><Link href="/portfolio" className="hover:text-white transition">Portfolio</Link></li>
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-4">Resources</p>
            <ul className="space-y-2.5 text-sm text-zinc-300">
              <li><a href="#mechanism" className="hover:text-white transition">Mechanism</a></li>
              <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition">GitHub</a></li>
              <li><span className="text-zinc-600">Whitepaper · soon</span></li>
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-4">Network</p>
            <ul className="space-y-2.5 text-sm text-zinc-300">
              <li>Testnet live</li>
              <li>Open source</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Cinematic close: credits float at the baseline, wordmark behind. */}
      <div
        aria-hidden={false}
        className="relative grain"
        style={{ height: 'clamp(18rem, 32vw, 30rem)' }}
      >
        {/* Subtle top fade so the credits row above blends in. */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />

        {/* Wordmark — metallic gradient, slight blur, bleeds off the bottom */}
        <h2
          aria-hidden
          className="wordmark-metallic absolute inset-x-0 bottom-0 font-bold tracking-[-0.06em] leading-[0.82] select-none whitespace-nowrap text-center"
          style={{
            fontSize: 'clamp(7rem, 23vw, 24rem)',
            transform: 'translateY(14%)',
            filter: 'blur(0.5px)',
          }}
        >
          StakePort
        </h2>

        {/* Credits row — overlaid at the visual baseline. Sits *on* the
            wordmark so they read as one composition rather than two
            stacked blocks. */}
        <div className="absolute bottom-5 inset-x-0 px-6 z-20 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>© {new Date().getFullYear()} StakePort</span>
          <span>v0.2 · testnet</span>
        </div>
      </div>
    </footer>
  );
}
