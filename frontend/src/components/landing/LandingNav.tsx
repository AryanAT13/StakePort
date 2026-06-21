'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import EnterTerminalButton from './EnterTerminalButton';
import { LogoLockup } from '@/components/brand/Logo';

/**
 * Landing nav — Phase 8.3.
 *
 * Phase 8.2's green "125% Exit Cap" chip was too loud — it competed with
 * the CTA on the right and broke the line of mono nav links. Replaced
 * with a third plain text link ("Guarantee") that matches Mechanism and
 * Docs in weight. Clicking still smooth-scrolls to the Guarantee section
 * — same behaviour, calmer chrome.
 */
function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/60 backdrop-blur-xl border-b border-white/[0.05] shadow-[0_8px_30px_-12px_rgba(59,130,246,0.18)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div
        className={`absolute top-0 inset-x-0 h-px transition-opacity duration-500 ${
          scrolled ? 'opacity-100' : 'opacity-0'
        } bg-gradient-to-r from-transparent via-white/15 to-transparent`}
      />

      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <Link href="/" aria-label="StakePort home" className="flex-shrink-0">
          <LogoLockup />
        </Link>

        {/* Secondary cluster: three matched text links. */}
        <div className="hidden md:flex items-center gap-7 text-[11px] font-medium uppercase tracking-[0.18em]">
          <a
            href="#mechanism"
            onClick={(e) => { e.preventDefault(); smoothScrollTo('mechanism'); }}
            className="text-zinc-400 hover:text-white transition"
          >
            Mechanism
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 hover:text-white transition"
          >
            Docs
          </a>
          <a
            href="#guarantee"
            onClick={(e) => { e.preventDefault(); smoothScrollTo('guarantee'); }}
            className="text-zinc-400 hover:text-white transition"
          >
            Backstop
          </a>
        </div>

        <EnterTerminalButton size="sm" />
      </div>
    </nav>
  );
}
