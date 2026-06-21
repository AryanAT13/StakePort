'use client';

import { useEffect, useState, useCallback } from 'react';

export type SessionUser = {
  id: string;
  walletAddress: string;
  displayName: string | null;
  avatarUrl: string | null;
  ageConfirmed: boolean;
  interests: string[];
  riskProfile: string | null;
  onboarded: boolean;
};

/**
 * Read the current session from /api/auth/me.
 *
 * Phase 8 bug fix — the previous version would set `user = null` inside
 * its catch block on ANY fetch failure. That meant a transient network
 * error (e.g. dev-server hot reload, or a downstream crash from the
 * wagmi/CORS cascade) would mark the user as logged-out and the auth
 * gates would kick them to `/`. New contract:
 *
 *   `resolved` — true once we've heard a definitive answer from the
 *                server (200). Auth gates should only react after
 *                `resolved` flips.
 *   `user`     — populated on 200; never overwritten by errors.
 *   `error`    — populated on a non-OK response or fetch throw, for
 *                pages that want to surface a banner.
 *
 * The auth gates in /markets, /portfolio, /dashboard, /onboarding now
 * check `resolved` before deciding to redirect.
 */
export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        // 401 = a definitive "not authenticated" — clear the user.
        // Anything else (5xx, network blip): keep the previous user.
        if (res.status === 401) {
          setUser(null);
          setResolved(true);
        } else {
          setError(new Error(`/api/auth/me ${res.status}`));
        }
        return;
      }
      const j = await res.json();
      setUser(j.user ?? null);
      setResolved(true);
      setError(null);
    } catch (e) {
      // Network error — DO NOT change `user`. The session cookie may still
      // be valid; we just couldn't read the server's view of it right now.
      // The gates will see `resolved` is unchanged and stay put.
      setError(e instanceof Error ? e : new Error('Network error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { user, loading, resolved, error, refetch };
}
