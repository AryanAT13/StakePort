'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="w-full flex justify-between items-center p-6 border-b border-gray-800 bg-black text-white">
      {/* Logo */}
      <div className="text-2xl font-bold tracking-tighter">
        <Link href="/">
          Stake<span className="text-blue-500">Port</span>
        </Link>
      </div>

      {/* Nav links. `/market` was a dead route — Marketplace lives at `/` for now;
          when we split it (Phase 4) we can re-add the link. */}
      <div className="hidden md:flex gap-8 text-sm font-medium text-gray-400">
        <Link href="/" className="hover:text-white transition">Markets</Link>
        <Link href="/create" className="hover:text-white transition font-bold text-blue-500">+ List Asset</Link>
        <Link href="/portfolio" className="hover:text-white transition">My Assets</Link>
      </div>

      {/* The Wallet Button */}
      <div>
        <ConnectButton 
          accountStatus={{
            smallScreen: 'avatar',
            largeScreen: 'full',
          }}
        />
      </div>
    </nav>
  );
}