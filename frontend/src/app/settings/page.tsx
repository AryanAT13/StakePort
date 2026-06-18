'use client';

/**
 * Settings — Phase 7.
 *
 * Three sections:
 *   Profile  — editable display name, risk profile, interests.
 *   Wallet   — readonly address with copy-button affordance.
 *   Session  — sign out (clears the SIWE cookie, routes to landing).
 *
 * Auth gate: session-driven (consistent with /markets and /portfolio).
 * Wagmi may briefly report no wallet on a hard refresh; we don't kick
 * users out — the wallet bit is just an information panel here.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2, LogOut } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useSession } from '@/hooks/useSession';

const INTERESTS = [
  'Watches', 'Cars', 'Art', 'Real Estate', 'Sneakers', 'Wines', 'Spirits', 'Collectibles',
] as const;

const RISK_PROFILES = [
  { value: 'conservative', label: 'Conservative', desc: 'Capital preservation. Long holds.' },
  { value: 'moderate', label: 'Moderate', desc: 'Balanced exposure across asset types.' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Active trading. Higher vol tolerance.' },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading, refetch } = useSession();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  // ---- Auth gate ---------------------------------------------------------
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/');
    else if (!user.onboarded) router.replace('/onboarding');
  }, [sessionLoading, user, router]);

  // ---- Form state — hydrate from session, save on submit ----------------
  const [displayName, setDisplayName] = useState('');
  const [risk, setRisk] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
      setRisk(user.riskProfile ?? null);
      setInterests(user.interests ?? []);
    }
  }, [user]);

  function toggleInterest(i: string) {
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          riskProfile: risk,
          interests,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Could not save profile.');
      }
      toast.success('Settings saved.');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      // Also disconnect the wallet — most users expect "Sign Out" to clear
      // every trace of the session, not just the JWT cookie.
      try { disconnect(); } catch {/* harmless if already disconnected */}
      toast.success('Signed out.');
      router.replace('/');
    } catch {
      toast.error('Could not sign out. Try again.');
      setSigningOut(false);
    }
  }

  async function handleCopyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied.');
    } catch {/* ignore clipboard failure */}
  }

  if (sessionLoading || !user || !user.onboarded) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xs text-zinc-500 uppercase tracking-[0.22em]">Authenticating…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="max-w-2xl mx-auto px-6 py-12 md:py-14">
        <Link href="/markets" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to markets
        </Link>

        <p className="eyebrow mb-3">Settings</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.025em] mb-12">
          Your account.
        </h1>

        {/* ── Profile ─────────────────────────────────────────────────── */}
        <form onSubmit={handleSave} className="space-y-12">
          <section>
            <h2 className="text-sm font-semibold mb-6 pb-3 border-b border-zinc-900">Profile</h2>

            <div className="space-y-10">
              <div>
                <label className="block eyebrow mb-3">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  className="w-full bg-transparent border-b border-zinc-800 focus:border-white outline-none py-3 text-xl placeholder:text-zinc-700 transition"
                />
              </div>

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

              <div>
                <label className="block eyebrow mb-5">Interests</label>
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
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium hover:bg-zinc-100 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </section>
        </form>

        {/* ── Wallet ──────────────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-sm font-semibold mb-6 pb-3 border-b border-zinc-900">Wallet</h2>
          <div className="bg-zinc-950/70 border border-zinc-900 rounded-xl p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2">Connected Address</p>
            {address ? (
              <button
                type="button"
                onClick={handleCopyAddress}
                className="font-mono text-sm text-zinc-200 hover:text-white transition break-all text-left"
                aria-label="Copy wallet address"
              >
                {address}
              </button>
            ) : (
              <p className="text-sm text-zinc-500">No wallet connected.</p>
            )}
          </div>
        </section>

        {/* ── Session ─────────────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-sm font-semibold mb-6 pb-3 border-b border-zinc-900">Session</h2>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-zinc-500 mt-1">Clears your session cookie and disconnects the wallet.</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/15 hover:text-red-200 text-sm font-medium transition disabled:opacity-50"
            >
              {signingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
