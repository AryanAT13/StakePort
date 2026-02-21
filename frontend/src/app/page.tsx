'use client';

import Navbar from '../components/Navbar';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { MOCK_USDC_ADDRESS, ERC20_ABI } from '../constants/contracts';
import { parseEther, formatEther } from 'viem';
import { useState, useEffect } from 'react';
import { ASSET_FACTORY_ADDRESS, ASSET_FACTORY_ABI } from '../constants/contracts';
import AssetCard from '../components/AssetCard';
import MarketPulse from '../components/MarketPulse';
import PortfolioValue from '../components/PortfolioValue';
import RecentActivity from '../components/RecentActivity';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [balance, setBalance] = useState<string>("0");
  const [mintAmount, setMintAmount] = useState<string>(""); // State for the input box

  // Setup writing to the blockchain
  const { writeContract, isPending, error: writeError } = useWriteContract();

  // Read user's Fake USDC Balance
// Read user's Fake USDC Balance
  const { data: balanceData, refetch } = useReadContract({
    address: MOCK_USDC_ADDRESS, // <--- No more "as..." needed!
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`], // <--- We cast this one because 'address' from wallet can be undefined
    query: {
      enabled: !!address,
    }
  });

  // Fetch the list of all deployed assets
const { data: assetList } = useReadContract({
    address: ASSET_FACTORY_ADDRESS,
    abi: ASSET_FACTORY_ABI,
    functionName: 'getDeployedAssets',
});

  // Update UI when data comes back
  useEffect(() => {
    if (balanceData) {
      console.log("Balance Data Received:", balanceData);
      setBalance(formatEther(balanceData as bigint));
    }
  }, [balanceData]);

  // Log errors if the transaction fails
  useEffect(() => {
    if (writeError) {
      console.error("Transaction Error:", writeError);
      alert("Transaction Failed: " + writeError.message);
    }
  }, [writeError]);

  // Function to handle "Add Funds"
  const handleAddFunds = () => {
    console.log("Button Clicked!"); // Debug 1

    if (!address) {
      alert("Please connect your wallet first!");
      return;
    }

    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    console.log(`Minting ${mintAmount} USDC to ${address}...`); // Debug 2

    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [address, parseEther(mintAmount)], 
    }, {
      onSuccess: (hash) => {
        console.log("Transaction Sent! Hash:", hash);
        alert(`Request sent! Waiting for confirmation...`);
        // Clear input
        setMintAmount("");
        // Refresh balance after a short delay
        setTimeout(() => refetch(), 4000); 
      },
      onError: (err) => {
        console.error("Minting Failed:", err);
      }
    });
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      <MarketPulse />

      <div className="max-w-7xl mx-auto p-6">
        
        {/* Simple Header */}
        <div className="flex justify-between items-end mb-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Markets</h1>
                <p className="text-zinc-400 text-sm mt-1">Trade fractional ownership of high-value assets.</p>
            </div>
            {/* Optional Filter Tabs could go here */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* MAIN ASSET GRID (Span 3) */}
          <div className="lg:col-span-3">
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Loading/Empty States */}
                {!assetList && <div className="text-zinc-500 text-sm">Loading markets...</div>}
                
                {/* Render Cards */}
                {assetList && (assetList as `0x${string}`[]).map((address) => (
                    <AssetCard key={address} assetAddress={address} />
                ))}
             </div>
          </div>

          {/* RIGHT SIDEBAR (Stats & Activity) */}
          <div className="lg:col-span-1 space-y-6">
             
             {/* Mini Portfolio */}
             <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                 <p className="text-xs text-zinc-500 uppercase font-bold mb-2">Your Portfolio</p>
                 <PortfolioValue assetList={assetList as `0x${string}`[] || []} />
                 <div className="mt-4 pt-4 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Cash Balance</p>
                    <p className="text-xl font-mono">${parseFloat(balance).toLocaleString()}</p>
                 </div>
                 {/* Mini Add Funds */}
                 <div className="mt-4 flex gap-2">
                    <input type="number" placeholder="5000" className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-sm" value={mintAmount} onChange={e => setMintAmount(e.target.value)} />
                    <button onClick={handleAddFunds} className="bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded text-xs font-bold">+</button>
                 </div>
             </div>

             {/* Activity Feed */}
             <RecentActivity />
          </div>

        </div>
      </div>
    </main>
  );
}