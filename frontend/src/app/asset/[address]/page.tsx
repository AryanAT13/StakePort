'use client';

import Navbar from '../../../components/Navbar'; // Note the triple ../
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { REAL_WORLD_ASSET_ABI, ERC20_ABI, MOCK_USDC_ADDRESS } from '../../../constants/contracts';
import { formatEther, parseEther } from 'viem';
import { useState } from 'react';

export default function AssetDetails() {
  const { address: assetAddress } = useParams(); // Get 0x... from URL
  const { address: userAddress } = useAccount();
  
  // State for Trading
  const [amount, setAmount] = useState('');
  const [isBuyMode, setIsBuyMode] = useState(true);

  // 1. Fetch Asset Details
  const { data: name } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' });
  const { data: symbol } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol' });
  const { data: valuation } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'valuation' });
  const { data: imageUrl } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' });
  
  // 2. Fetch User Balances
  const { data: assetBalance } = useReadContract({ 
    address: assetAddress as `0x${string}`, 
    abi: REAL_WORLD_ASSET_ABI, 
    functionName: 'balanceOf', 
    args: [userAddress as `0x${string}`] 
  });

  const { data: usdcBalance } = useReadContract({ 
    address: MOCK_USDC_ADDRESS, 
    abi: ERC20_ABI, 
    functionName: 'balanceOf', 
    args: [userAddress as `0x${string}`] 
  });

  // 3. Setup Write Hook (For Trading)
  const { writeContract, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // --- TRADING LOGIC ---
  const handleTrade = () => {
    if (!amount || !userAddress) return;
    
    // For MVP: We are using a simplified "Fixed Price" model initially 
    // (1 Token = Valuation / Total Supply)
    // To make this a real AMM, we would need a Uniswap Router. 
    // For now, let's simulate the "Buy" by just transferring tokens (if seller owns them) 
    // OR we can implement the "Buyout" logic here.
    
    // WAIT! We realized we need an AMM for true trading. 
    // For this specific step, let's implement the "BUYOUT" feature first as it's easier.
    // Trading individual tokens requires a Liquidity Pool contract which we haven't deployed yet.
    
    alert("Individual Token Trading requires Liquidity Pool (Coming in Phase 6). Try the Buyout Feature below!");
  };

  // --- BUYOUT LOGIC ---
  const handleBuyout = () => {
    if (!valuation) return;
    
    // Calculate Buyout Price (Valuation + 10%)
    const buyoutPrice = (valuation as bigint * 110n) / 100n;
    
    console.log("Approving USDC...");
    
    // Step 1: Approve USDC
    writeContract({
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [assetAddress as `0x${string}`, buyoutPrice]
    }, {
        onSuccess: () => {
            // This is tricky in one click. Usually needs 2 clicks.
            // For now, let's just do Approval. 
            alert("Approval Sent! Wait for confirmation then click 'Finalize Buyout'");
        }
    });
  };

  const handleFinalizeBuyout = () => {
     if (!valuation) return;
     const buyoutPrice = (valuation as bigint * 110n) / 100n;

     writeContract({
        address: assetAddress as `0x${string}`,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'initiateBuyout',
        args: [buyoutPrice]
     });
  };

  if (!name) return <div className="text-white p-10">Loading Asset...</div>;

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* LEFT: Image & Stats */}
        <div>
            <div className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden mb-8 border border-zinc-800">
                <img src={imageUrl as string} alt="Asset" className="w-full h-full object-cover" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                    <div className="text-gray-400 text-sm">Total Valuation</div>
                    <div className="text-2xl font-bold">${parseInt(formatEther(valuation as bigint)).toLocaleString()}</div>
                </div>
                <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                    <div className="text-gray-400 text-sm">Your Ownership</div>
                    <div className="text-2xl font-bold">
                        {assetBalance ? parseFloat(formatEther(assetBalance as bigint)).toFixed(2) : "0.00"} 
                        <span className="text-sm text-gray-500 ml-1">{symbol as string}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT: Trading Terminal */}
        <div className="space-y-8">
            <div>
                <h1 className="text-5xl font-bold mb-2">{name as string}</h1>
                <p className="text-gray-400 text-lg">{symbol as string} • Fractionalized Asset</p>
            </div>

            {/* Trading Box (Placeholder for Phase 6) */}
            <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800 opacity-50 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 backdrop-blur-sm">
                    <span className="font-bold text-xl">AMM Trading Coming Soon (Phase 6)</span>
                </div>
                <h3 className="font-bold mb-4">Quick Swap</h3>
                <div className="flex gap-2 mb-4">
                    <input className="w-full bg-black p-3 rounded-lg" placeholder="0.00" disabled />
                    <button className="bg-zinc-700 px-6 rounded-lg font-bold">USDC</button>
                </div>
                <button className="w-full py-4 bg-blue-600 rounded-lg font-bold" disabled>Swap Tokens</button>
            </div>

            {/* HOSTILE TAKEOVER SECTION */}
            <div className="p-8 bg-gradient-to-br from-red-900/20 to-black border border-red-900/50 rounded-2xl">
                <h3 className="text-2xl font-bold text-red-500 mb-2">🔥 Hostile Buyout</h3>
                <p className="text-gray-400 mb-6 text-sm">
                    Pay the full valuation + 10% premium to forcibly acquire this asset from all shareholders.
                </p>

                <div className="flex justify-between items-center mb-6 text-sm">
                    <span className="text-gray-400">Current Valuation:</span>
                    <span className="font-mono">${parseInt(formatEther(valuation as bigint)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-6 text-xl font-bold">
                    <span className="text-red-400">Buyout Price (+10%):</span>
                    <span className="font-mono text-white">
                        ${(parseInt(formatEther(valuation as bigint)) * 1.1).toLocaleString()}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={handleBuyout}
                        disabled={isPending}
                        className="py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-bold border border-zinc-700 transition"
                    >
                        1. Approve USDC
                    </button>
                    <button 
                        onClick={handleFinalizeBuyout}
                        disabled={isPending}
                        className="py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition"
                    >
                        2. Execute Takeover
                    </button>
                </div>
            </div>

        </div>
      </div>
    </main>
  );
}