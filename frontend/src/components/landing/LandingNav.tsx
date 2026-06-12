'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import EnterTerminalButton from './EnterTerminalButton';
import { LogoLockup } from '@/components/brand/Logo';

/**
 * Lean landing nav: brand lockup on the left, the one CTA on the right.
 * Transparent on hero, gains a frosted strip after ~80px of scroll so the
 * mark always has contrast against the section behind it.
 */
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
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-black/65 backdrop-blur-xl border-b border-zinc-900/80' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" aria-label="StakePort home">
          <LogoLockup />
        </Link>
        <EnterTerminalButton size="sm" />
      </div>
    </nav>
  );
}
