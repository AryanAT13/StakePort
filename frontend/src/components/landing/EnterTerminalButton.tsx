'use client';

import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * The one button that enters the app.
 *
 * Flow:
 *   not connected -> open the wallet modal, mark "user intends to enter"
 *   wallet finishes connecting -> auto-route to /markets (one click total)
 *   already connected -> route straight to /markets
 *
 * We deliberately do NOT prompt SIWE here. SIWE is a write-authorization
 * primitive — it belongs at the moment the user creates a profile or
 * touches /create. Asking for a signature just to browse markets is the
 * exact friction the redesign brief called out. The session, when it
 * exists, is set later by /onboarding (Phase 3).
 */
type Props = {
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = {
  sm: 'text-xs px-4 py-2',
  md: 'text-sm px-6 py-3',
  lg: 'text-base px-7 py-3.5',
} as const;

export default function EnterTerminalButton({
  className = '',
  label = 'Open Terminal',
  size = 'md',
}: Props) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();

  // Only auto-redirect if the user clicked our button *during this mount*.
  // Auto-reconnecting wallets shouldn't hijack the landing scroll from a
  // visitor who arrived deliberately.
  const pendingEntry = useRef(false);

  useEffect(() => {
    if (pendingEntry.current && isConnected) {
      pendingEntry.current = false;
      router.push('/markets');
    }
  }, [isConnected, router]);

  function handleClick() {
    if (!isConnected) {
      pendingEntry.current = true;
      openConnectModal?.();
      return;
    }
    router.push('/markets');
  }

  return (
    <button
      onClick={handleClick}
      className={`group inline-flex items-center gap-2 rounded-full bg-white text-black font-medium transition hover:bg-zinc-100 hover:shadow-[0_14px_40px_-10px_rgba(255,255,255,0.45)] shadow-[0_6px_24px_-10px_rgba(255,255,255,0.25)] ${SIZES[size]} ${className}`}
    >
      <span>{label}</span>
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
    </button>
  );
}
