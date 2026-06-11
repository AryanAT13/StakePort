'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import EnterTerminalButton from './EnterTerminalButton';

/**
 * Landing-specific nav. Transparent over the hero, gains a frosted background
 * as the user scrolls past ~80px so it stays legible on lighter sections.
 * Intentionally minimal — no nav links — because the only job of this surface
 * is to keep the "Enter Terminal" CTA always reachable.
 */
export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/70 backdrop-blur-xl border-b border-zinc-900'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tighter">
          Stake<span className="text-blue-500">Port</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#how" className="hover:text-white transition">How it works</a>
          <a href="#pillars" className="hover:text-white transition">Tech</a>
          <a href="#stats" className="hover:text-white transition">Stats</a>
        </div>

        <EnterTerminalButton label="Launch App" />
      </div>
    </nav>
  );
}
