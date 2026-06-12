'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { X, Loader2, Check } from 'lucide-react';
import { MOCK_USDC_ADDRESS, ERC20_ABI } from '@/constants/contracts';

/**
 * Replaces the inline "+ $5000" widget that used to live in the markets
 * sidebar. A modal makes the faucet feel like a deliberate action rather
 * than a stray input field, and lets us add preset chips + confirmation
 * states without crowding the dashboard.
 *
 * Testnet only — `mint()` on the MockUSDC contract is unrestricted, which
 * is fine for hardhat / sepolia but the modal copy makes the testnet
 * framing explicit.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  onMinted?: () => void;
};

const PRESETS = [1000, 5000, 25000, 100000];

export default function AddFundsModal({ open, onClose, onMinted }: Props) {
  const { address } = useAccount();
  const { writeContract, isPending, data: hash, reset } = useWriteContract();
  const [amount, setAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Reset internal state when the modal is closed so a reopen starts clean.
  useEffect(() => {
    if (!open) {
      setAmount('');
      setConfirmed(false);
      reset();
    }
  }, [open, reset]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleMint() {
    if (!address || !amount || parseFloat(amount) <= 0) return;
    writeContract(
      {
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [address, parseEther(amount)],
      },
      {
        onSuccess: () => {
          setConfirmed(true);
          // Refetch from the parent after the testnet block lands (~3s).
          setTimeout(() => onMinted?.(), 3500);
          // Auto-close shortly after — keeps the modal feeling decisive.
          setTimeout(() => onClose(), 1600);
        },
      }
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center px-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-500 hover:text-white transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="eyebrow mb-4">Faucet · Testnet</p>
        <h2 className="text-2xl font-semibold tracking-[-0.015em] mb-3">Add USDC</h2>
        <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
          Mint test USDC straight to your wallet. Available on testnet only —
          replaced by Stripe / fiat onramps in production.
        </p>

        <div className="mb-6">
          <label className="block text-[11px] uppercase tracking-[0.22em] text-zinc-500 mb-3">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
              autoFocus
              className="w-full bg-black border border-zinc-800 focus:border-zinc-600 outline-none py-3.5 px-4 pr-16 text-2xl font-mono rounded-lg transition placeholder:text-zinc-700"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono uppercase tracking-wider">
              USDC
            </span>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className="text-xs px-3 py-1 rounded border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition"
              >
                ${v.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleMint}
          disabled={isPending || !amount || parseFloat(amount) <= 0 || confirmed}
          className="w-full inline-flex items-center justify-center gap-2 bg-white text-black rounded-lg py-3 font-medium transition hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {confirmed ? (
            <>
              <Check className="w-4 h-4" /> Sent — balance updates shortly
            </>
          ) : isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Confirm in wallet…
            </>
          ) : (
            'Mint USDC'
          )}
        </button>

        {hash && (
          <p className="mt-4 text-[10px] font-mono text-zinc-600 text-center">
            tx · {hash.slice(0, 10)}…{hash.slice(-8)}
          </p>
        )}
      </div>
    </div>
  );
}
