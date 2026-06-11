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
 * Why a hook and not a context: most of the app doesn't care about session
 * state and we don't want to wrap the whole tree just for a navbar avatar.
 * Components that need it call this hook locally; the in-flight request is
 * deduped by the browser cache for the same URL within a tick anyway.
 */
export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const j = await res.json();
      setUser(j.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { user, loading, refetch };
}
