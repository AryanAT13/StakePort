'use client';

import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';
import { useCallback, useState } from 'react';
import { siweConfig } from '@/lib/env';

/**
 * Client-side SIWE flow.
 *
 *   1. fetch /api/auth/nonce
 *   2. build a SIWE message with that nonce
 *   3. ask the wallet to sign it (no gas, no tx)
 *   4. POST {message, signature} to /api/auth/verify
 *
 * The server validates the signature, upserts the user, and drops an
 * HTTP-only JWT cookie. After this hook resolves successfully, calling
 * /api/auth/me returns the authenticated user.
 */
export function useSiweSignIn() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address || !chainId) throw new Error('Connect your wallet first');
    setSigning(true);
    setError(null);
    try {
      const nonceRes = await fetch('/api/auth/nonce', { credentials: 'include' });
      if (!nonceRes.ok) throw new Error('Could not request nonce');
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      // `prepareMessage()` produces the canonical EIP-4361 string. We sign
      // that exact string — the server reconstructs and validates it.
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: siweConfig.statement,
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
        issuedAt: new Date().toISOString(),
      }).prepareMessage();

      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || 'Signature verification failed');
      }
      return (await verifyRes.json()) as {
        user: { id: string; walletAddress: string; onboarded: boolean };
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign-in failed';
      setError(message);
      throw e;
    } finally {
      setSigning(false);
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  }, []);

  return { signIn, signOut, signing, error };
}
