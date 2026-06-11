'use client';

import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useSiweSignIn } from '@/hooks/useSiweSignIn';

/**
 * The CTA that does it all.
 *
 *   not connected   -> open RainbowKit modal
 *   connected,  no session -> trigger SIWE sign, then route to /markets
 *   connected + session    -> route to /markets directly
 *
 * Errors at any step bubble up into a local error state instead of throwing,
 * because the wallet "user rejected" path is common and shouldn't crash the
 * landing.
 */
type Props = {
  className?: string;
  label?: string;
  variant?: 'primary' | 'ghost';
};

export default function EnterTerminalButton({
  className = '',
  label = 'Enter Terminal',
  variant = 'primary',
}: Props) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { user, loading, refetch } = useSession();
  const { signIn, signing } = useSiweSignIn();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      if (!isConnected) {
        // Connect first; the user can click again once their wallet is wired.
        openConnectModal?.();
        return;
      }
      if (!user) {
        await signIn();
        await refetch();
      }
      // Phase 3 will redirect first-timers to /onboarding here. For now the
      // markets view is the landing target either way.
      router.push('/markets');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not enter terminal';
      // Wallet "user rejected request" is the common one — suppress unless
      // it's something else worth showing.
      if (!/rejected|denied/i.test(msg)) setError(msg);
    }
  }

  const busy = loading || signing;

  const base =
    variant === 'primary'
      ? 'gradient-border bg-black hover:bg-zinc-950 text-white'
      : 'border border-zinc-800 hover:border-zinc-600 bg-zinc-950/40 text-zinc-200';

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        onClick={handleClick}
        disabled={busy}
        className={`group inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${base} ${className}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        <span>{signing ? 'Sign in your wallet…' : label}</span>
        {!busy && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
