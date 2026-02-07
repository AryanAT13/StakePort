'use client';

import Navbar from '../../components/Navbar';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ASSET_FACTORY_ADDRESS, ASSET_FACTORY_ABI } from '../../constants/contracts';
import { parseEther } from 'viem'; // Use parseEther for simplified Valuation input
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateAsset() {
  const router = useRouter();
  
  // Form State
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [valuation, setValuation] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Write Hook
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  // Wait for Transaction Hook
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle Submit
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !symbol || !valuation || !imageUrl) {
        alert("Please fill in all fields");
        return;
    }

    console.log("Creating Asset...");

    writeContract({
      address: ASSET_FACTORY_ADDRESS,
      abi: ASSET_FACTORY_ABI,
      functionName: 'createAsset',
      args: [
        name, 
        symbol, 
        imageUrl, 
        parseEther(valuation) // Convert "50000" to "50000000000000000000" (Wei)
      ], 
    });
  };

  // Redirect on Success
  useEffect(() => {
    if (isSuccess) {
        alert("Asset Created Successfully!");
        // We will redirect to dashboard or market later
        router.push('/'); 
    }
  }, [isSuccess, router]);

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="max-w-2xl mx-auto p-8 mt-10">
        <h1 className="text-4xl font-bold mb-8 text-center">List New Asset</h1>
        
        <form onSubmit={handleCreate} className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6">
            
            {/* Name Input */}
            <div>
                <label className="block text-gray-400 mb-2 text-sm">Asset Name</label>
                <input 
                    type="text" 
                    placeholder="e.g. Rolex Daytona 2024"
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            {/* Symbol Input */}
            <div>
                <label className="block text-gray-400 mb-2 text-sm">Ticker Symbol</label>
                <input 
                    type="text" 
                    placeholder="e.g. RLX-DAYT"
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 uppercase"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                />
            </div>

            {/* Valuation Input */}
            <div>
                <label className="block text-gray-400 mb-2 text-sm">Initial Valuation (USDC)</label>
                <input 
                    type="number" 
                    placeholder="e.g. 50000"
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                    value={valuation}
                    onChange={(e) => setValuation(e.target.value)}
                />
            </div>

            {/* Image URL Input (Temporary until we add upload) */}
            <div>
                <label className="block text-gray-400 mb-2 text-sm">Image URL</label>
                <input 
                    type="text" 
                    placeholder="https://example.com/watch.jpg"
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                />
            </div>

            {/* Submit Button */}
            <button 
                type="submit"
                disabled={isPending || isConfirming}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition disabled:opacity-50"
            >
                {isPending ? "Check Wallet..." : isConfirming ? "Minting Asset..." : "🚀 Launch Asset"}
            </button>

            {/* Error Message */}
            {error && (
                <div className="text-red-500 text-sm text-center mt-2">
                    {error.message.split('\n')[0]}
                </div>
            )}
        </form>
      </div>
    </main>
  );
}