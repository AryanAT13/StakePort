'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { LogoLockup } from '@/components/brand/Logo';

/**
 * In-app navigation.
 *
 * Three zones:
 *   left   — brand lockup (clicks home to /markets)
 *   centre — primary destinations with an active-route indicator
 *   right  — list-asset CTA + RainbowKit account widget
 *
 * The active-route style is intentionally restrained: a slightly brighter
 * text colour and a 1px underbar. We deliberately avoid filled chips, which
 * read as buttons and compete with the "+ List Asset" CTA on the right.
 */
const NAV_LINKS: { href: string; label: string; match?: (p: string) => boolean }[] = [
  { href: '/markets', label: 'Markets', match: (p) => p === '/markets' || p.startsWith('/asset/') },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/settings', label: 'Settings' },
];

export default function Navbar() {
  const pathname = usePathname() || '';

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-black/75 border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Left — brand */}
        <Link href="/markets" aria-label="StakePort markets" className="flex-shrink-0">
          <LogoLockup />
        </Link>

        {/* Centre — primary nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = link.match ? link.match(pathname) : pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative text-sm font-medium px-3 py-2 transition ${
                  active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[1px] h-px bg-white" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right — CTA + wallet */}
        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-zinc-100 transition shadow-[0_4px_18px_-8px_rgba(255,255,255,0.4)]"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            List
          </Link>
          <ConnectButton
            chainStatus={{ smallScreen: 'icon', largeScreen: 'icon' }}
            accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
            showBalance={false}
          />
        </div>
      </div>
    </nav>
  );
}
