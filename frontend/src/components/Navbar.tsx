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

      {/* Navigation Links (We will build these pages later) */}
      <div className="hidden md:flex gap-8 text-sm font-medium text-gray-400">
        <Link href="/" className="hover:text-white transition">Dashboard</Link>
        <Link href="/market" className="hover:text-white transition">Marketplace</Link>
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