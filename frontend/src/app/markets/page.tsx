'use client';

// This is the previous `/` page — the live markets dashboard. The root URL
// now serves the public landing, and signed-in users are routed here after
// they click "Enter Terminal". Phase 3 will replace the inline mint widget
// and portfolio sidebar with their proper redesigned versions; for now we
// keep the existing surface so the user-flow stays unbroken between phases.

import Navbar from '@/components/Navbar';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { MOCK_USDC_ADDRESS, ERC20_ABI, ASSET_FACTORY_ADDRESS, ASSET_FACTORY_ABI } from '@/constants/contracts';
import { parseEther, formatEther } from 'viem';
import { useState, useEffect } from 'react';
import AssetCard from '@/components/AssetCard';
import MarketPulse from '@/components/MarketPulse';
import PortfolioValue from '@/components/PortfolioValue';
import RecentActivity from '@/components/RecentActivity';

export default function MarketsPage() {
  const { address } = useAccount();
  const [balance, setBalance] = useState<string>("0");
  const [mintAmount, setMintAmount] = useState<string>("");

  const { writeContract, isPending, error: writeError } = useWriteContract();

  const { data: balanceData, refetch } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  });

  const { data: assetList } = useReadContract({
    address: ASSET_FACTORY_ADDRESS,
    abi: ASSET_FACTORY_ABI,
    functionName: 'getDeployedAssets',
  });

  useEffect(() => {
    if (balanceData) setBalance(formatEther(balanceData as bigint));
  }, [balanceData]);

  useEffect(() => {
    if (writeError) {
      console.error("Transaction Error:", writeError);
      alert("Transaction Failed: " + writeError.message);
    }
  }, [writeError]);

  const handleAddFunds = () => {
    if (!address) return alert("Please connect your wallet first!");
    if (!mintAmount || parseFloat(mintAmount) <= 0) return alert("Please enter a valid amount");

    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [address, parseEther(mintAmount)],
    }, {
      onSuccess: () => {
        setMintAmount("");
        // Faucet TX needs a block to confirm — slight delay before refetch
        // beats showing a stale 0 balance.
        setTimeout(() => refetch(), 4000);
      },
    });
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      <MarketPulse />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Markets</h1>
            <p className="text-zinc-400 text-sm mt-1">Trade fractional ownership of high-value assets.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {!assetList && <div className="text-zinc-500 text-sm">Loading markets...</div>}
              {assetList && (assetList as `0x${string}`[]).map((addr) => (
                <AssetCard key={addr} assetAddress={addr} />
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase font-bold mb-2">Your Portfolio</p>
              <PortfolioValue assetList={assetList as `0x${string}`[] || []} />
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Cash Balance</p>
                <p className="text-xl font-mono">${parseFloat(balance).toLocaleString()}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  type="number"
                  placeholder="5000"
                  className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-sm"
                  value={mintAmount}
                  onChange={e => setMintAmount(e.target.value)}
                />
                <button
                  onClick={handleAddFunds}
                  disabled={isPending}
                  className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded text-xs font-bold disabled:opacity-50"
                >+</button>
              </div>
            </div>
            <RecentActivity />
          </div>
        </div>
      </div>
    </main>
  );
}
