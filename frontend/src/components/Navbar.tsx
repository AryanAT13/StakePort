'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { LogoLockup } from '@/components/brand/Logo';

/**
 * In-app nav. The logo is the brand mark + wordmark lockup (consistent with
 * the landing); routing target is /markets, not the landing, because
 * clicking the logo on an authed surface should feel like "home" = the
 * trading view.
 */
export default function Navbar() {
  return (
    <nav className="w-full flex justify-between items-center px-6 py-4 border-b border-zinc-900 bg-black text-white">
      <Link href="/markets" aria-label="StakePort markets">
        <LogoLockup />
      </Link>

      <div className="hidden md:flex gap-8 text-sm font-medium text-zinc-400">
        <Link href="/markets" className="hover:text-white transition">Markets</Link>
        <Link href="/create" className="hover:text-white transition text-blue-400 font-semibold">+ List Asset</Link>
        <Link href="/portfolio" className="hover:text-white transition">Portfolio</Link>
      </div>

      <ConnectButton
        accountStatus={{
          smallScreen: 'avatar',
          largeScreen: 'full',
        }}
      />
    </nav>
  );
}
