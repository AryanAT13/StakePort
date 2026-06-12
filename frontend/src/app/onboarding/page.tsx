'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useSiweSignIn } from '@/hooks/useSiweSignIn';
import { LogoLockup } from '@/components/brand/Logo';

/**
 * Profile setup. This is the *only* place where SIWE happens — the landing's
 * "Open Terminal" button just connects the wallet and routes here, so the
 * signature prompt is colocated with the moment it authorises something
 * (writing the user's profile).
 *
 * Flow on submit:
 *   1. validate form
 *   2. if not connected, open the wallet modal and bail (user clicks again)
 *   3. if not signed in, SIWE-sign
 *   4. PATCH /api/auth/profile with the form
 *   5. route to /markets
 *
 * If the user lands here already onboarded (e.g. via direct URL), we bounce
 * straight to /markets — no point re-prompting.
 */
const INTERESTS = [
  'Watches', 'Cars', 'Art', 'Real Estate', 'Sneakers', 'Wines', 'Spirits', 'Collectibles',
] as const;

const RISK_PROFILES = [
  { value: 'conservative', label: 'Conservative', desc: 'Capital preservation. Long holds.' },
  { value: 'moderate', label: 'Moderate', desc: 'Balanced exposure across asset types.' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Active trading. Higher vol tolerance.' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { user, loading, refetch } = useSession();
  const { signIn } = useSiweSignIn();

  const [displayName, setDisplayName] = useState('');
  const [ageOk, setAgeOk] = useState(false);
  const [risk, setRisk] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already onboarded? Bounce. (Session is the source of truth — see the
  // note on /markets for why we no longer gate on wallet state.)
  useEffect(() => {
    if (!loading && user?.onboarded) router.replace('/markets');
  }, [loading, user, router]);

  function toggleInterest(i: string) {
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) return setError('A display name is required.');
    if (!ageOk) return setError('Please confirm you are 18 or older.');
    if (!risk) return setError('Pick a risk profile.');

    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    setSubmitting(true);
    try {
      // SIWE once — only if we don't already have a session for this wallet.
      if (!user) await signIn();

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          ageConfirmed: ageOk,
          riskProfile: risk,
          interests,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Could not save profile.');
      }
      await refetch();
      router.push('/markets');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      // Wallet rejection is normal — don't show a scary error message.
      if (!/rejected|denied|user rejected/i.test(msg)) setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white relative">
      {/* Minimal top bar — just the lockup. We don't show "Open Terminal"
          here because /onboarding IS the path to the terminal. */}
      <header className="absolute top-0 inset-x-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <Link href="/" aria-label="StakePort home">
            <LogoLockup />
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 pt-32 md:pt-40 pb-24">
        <p className="eyebrow mb-8">Onboarding</p>

        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold tracking-[-0.035em] leading-[1.05] mb-6">
          Welcome.
          <br />
          Tell us who&apos;s trading.
        </h1>

        <p className="text-zinc-400 text-lg mb-14 max-w-xl leading-relaxed">
          Used once to set up your profile. You can change any of this later.
          One signature, no gas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-14">
          {/* Display name — underline-only input for the editorial feel. */}
          <div>
            <label className="block eyebrow mb-3">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we call you?"
              maxLength={40}
              className="w-full bg-transparent border-b border-zinc-800 focus:border-white outline-none py-3 text-xl placeholder:text-zinc-700 transition"
            />
          </div>

          {/* Risk profile */}
          <div>
            <label className="block eyebrow mb-5">Risk Profile</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {RISK_PROFILES.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setRisk(r.value)}
                  className={`text-left p-5 rounded-xl border transition ${
                    risk === r.value
                      ? 'border-white/40 bg-white/[0.03]'
                      : 'border-zinc-900 hover:border-zinc-800'
                  }`}
                >
                  <p className="text-sm font-semibold mb-1.5">{r.label}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="block eyebrow mb-5">Interests · optional</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => toggleInterest(i)}
                  className={`px-4 py-2 rounded-full text-sm border transition ${
                    interests.includes(i)
                      ? 'border-white/40 bg-white/[0.05] text-white'
                      : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Age check */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ageOk}
                onChange={(e) => setAgeOk(e.target.checked)}
                className="w-4 h-4 accent-white rounded"
              />
              <span className="text-sm text-zinc-400">I am 18 or older.</span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="pt-4 flex flex-wrap items-center gap-5">
            <button
              type="submit"
              disabled={submitting}
              className="group inline-flex items-center gap-2 rounded-full bg-white text-black font-medium transition hover:bg-zinc-100 hover:shadow-[0_14px_40px_-10px_rgba(255,255,255,0.45)] shadow-[0_6px_24px_-10px_rgba(255,255,255,0.25)] text-base px-7 py-3.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{submitting ? 'Setting up…' : 'Enter terminal'}</span>
              {!submitting && (
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
              )}
            </button>
            <span className="text-xs text-zinc-600 font-mono">One signature · no gas</span>
          </div>
        </form>
      </div>
    </main>
  );
}
