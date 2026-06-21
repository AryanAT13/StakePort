'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Sparkles } from 'lucide-react';
import { LogoLockup } from '@/components/brand/Logo';

/**
 * In-app nav — Phase 8.2.
 *
 * The "List" CTA was getting roasted for looking like a stock white pill
 * in the corner. New treatment:
 *   - Gradient white pill (top-white → bottom-zinc-100) with a heavier
 *     luminous shadow and an inset top highlight.
 *   - Shimmer band slides across on hover (translateX from -100% → 100%).
 *   - Plus icon rotates 90° on hover for a tiny tactile cue.
 *   - The label is "List Asset" not "List" — full intent in the CTA copy.
 *   - A tiny sparkle adornment with a subtle pulse next to the icon —
 *     reads as "this is the main action."
 *
 * Centre nav and brand stay structurally as they were; only the right-hand
 * group changes.
 */
const NAV_LINKS: { href: string; label: string; match?: (p: string) => boolean }[] = [
  { href: '/markets', label: 'Markets', match: (p) => p === '/markets' || p.startsWith('/asset/') },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/dashboard', label: 'Dashboard' },
];

export default function Navbar() {
  const pathname = usePathname() || '';

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-black/55 border-b border-white/[0.04]">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Brand */}
        <Link href="/markets" aria-label="StakePort markets" className="flex-shrink-0">
          <LogoLockup />
        </Link>

        {/* Centre pills */}
        <div className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/[0.025] border border-white/[0.05]">
          {NAV_LINKS.map((link) => {
            const active = link.match ? link.match(pathname) : pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3.5 py-1.5 rounded-full text-[13px] font-medium transition whitespace-nowrap ${
                  active
                    ? 'text-white bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right — premium List CTA + wallet */}
        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold transition overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
              color: '#0a0a0a',
              boxShadow:
                '0 10px 30px -10px rgba(96,165,250,0.45), 0 4px 8px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.85)',
            }}
          >
            <Plus
              className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-90"
              strokeWidth={2.6}
            />
            <span>List Asset</span>
            <Sparkles
              className="w-3 h-3 text-blue-500/70 group-hover:text-blue-500 transition-colors"
              strokeWidth={2.2}
            />

            {/* Shimmer band — slides across on hover. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 -left-1/3 h-full w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:translate-x-[400%] skew-x-[-20deg]"
            />
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
