'use client';

import Navbar from '../../../components/Navbar';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { REAL_WORLD_ASSET_ABI, ERC20_ABI, MOCK_USDC_ADDRESS } from '../../../constants/contracts';
import { formatEther, parseEther } from 'viem';
import { useState } from 'react';

export default function AssetDetails() {
  const { address: assetAddress } = useParams();
  const { address: userAddress } = useAccount();
  
  // State
  const [amount, setAmount] = useState('');
  const [isBuyMode, setIsBuyMode] = useState(true); // Toggle Buy vs Sell

  // Reads
  const { data: name } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' });
  const { data: symbol } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol' });
  const { data: valuation } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'valuation' });
  const { data: imageUrl } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' });
  const { data: currentPrice } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'getPrice' });
  const { data: tradingActive } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'tradingActive' });

  // Balances
  const { data: assetBalance } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] });
  const { data: usdcBalance } = useReadContract({ address: MOCK_USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] });

  // Writes
  const { writeContract, isPending } = useWriteContract();

  // --- 1. ACTIVATING TRADING (Only Creator can do this) ---
  const handleAddLiquidity = () => {
    // 1. Approve USDC first
    // 2. Call addLiquidity(500 tokens)
    // For MVP simplified flow:
    const tokenAmount = parseEther("500"); // Put 50% of supply into pool
    
    // We assume Creator has already approved USDC. In a real app, we check allowance first.
    writeContract({
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [assetAddress as `0x${string}`, parseEther("100000000")] // Infinite approve
    }, {
        onSuccess: () => {
            // Once approved, Add Liquidity
             writeContract({
                address: assetAddress as `0x${string}`,
                abi: REAL_WORLD_ASSET_ABI,
                functionName: 'addLiquidity',
                args: [tokenAmount]
            });
        }
    });
  };

  // --- 2. TRADING LOGIC ---
  const handleTrade = () => {
    if (!amount || !userAddress) return;
    const parsedAmount = parseEther(amount);

    if (isBuyMode) {
        // BUY: Approve USDC -> Buy Tokens
        writeContract({
            address: MOCK_USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [assetAddress as `0x${string}`, parsedAmount]
        }, {
            onSuccess: () => {
                writeContract({
                    address: assetAddress as `0x${string}`,
                    abi: REAL_WORLD_ASSET_ABI,
                    functionName: 'buyTokens',
                    args: [parsedAmount]
                });
            }
        });
    } else {
        // SELL: Sell Tokens -> Receive USDC
        // No approval needed for burning/selling back to contract usually, but let's check
        // Standard ERC20 sell usually requires approval of the token itself
         writeContract({
            address: assetAddress as `0x${string}`,
            abi: REAL_WORLD_ASSET_ABI,
            functionName: 'approve',
            args: [assetAddress as `0x${string}`, parsedAmount]
        }, {
            onSuccess: () => {
                writeContract({
                    address: assetAddress as `0x${string}`,
                    abi: REAL_WORLD_ASSET_ABI,
                    functionName: 'sellTokens',
                    args: [parsedAmount]
                });
            }
        });
    }
  };

  if (!name) return <div className="text-white p-10">Loading Asset...</div>;

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* LEFT: Stats */}
        <div>
            <div className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden mb-8 border border-zinc-800 relative">
                <img src={imageUrl as string} alt="Asset" className="w-full h-full object-cover" />
                 {/* Live Price Tag */}
                 <div className="absolute top-4 left-4 bg-black/80 backdrop-blur px-4 py-2 rounded-lg border border-green-500/30">
                    <span className="text-gray-400 text-xs uppercase">Current Price</span>
                    <div className="text-xl font-bold text-green-400">
                        {currentPrice ? `$${parseFloat(formatEther(currentPrice as bigint)).toFixed(2)}` : "$-.--"}
                    </div>
                </div>
            </div>
            
             {/* Activation Button (Only for Creator if not active) */}
            {!tradingActive && assetBalance && (assetBalance as bigint) > 0n && (
                <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl">
                    <h3 className="font-bold text-yellow-500 mb-2">⚠️ Market Not Active</h3>
                    <p className="text-sm text-gray-400 mb-4">You are the creator. You must add liquidity to start trading.</p>
                    <button onClick={handleAddLiquidity} disabled={isPending} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold">
                        {isPending ? "Activating..." : "Initialize Market (Add 50% Liquidity)"}
                    </button>
                </div>
            )}
        </div>

        {/* RIGHT: Trading Terminal */}
        <div className="space-y-8">
            <div>
                <h1 className="text-5xl font-bold mb-2">{name as string}</h1>
                <p className="text-gray-400 text-lg">{symbol as string} • Fractionalized Asset</p>
            </div>

            {/* SWAP BOX */}
            <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-xl">Quick Swap</h3>
                    <div className="flex bg-black rounded-lg p-1">
                        <button 
                            onClick={() => setIsBuyMode(true)}
                            className={`px-4 py-1 rounded-md text-sm font-bold transition ${isBuyMode ? 'bg-green-600 text-white' : 'text-gray-500'}`}
                        >
                            BUY
                        </button>
                        <button 
                             onClick={() => setIsBuyMode(false)}
                            className={`px-4 py-1 rounded-md text-sm font-bold transition ${!isBuyMode ? 'bg-red-600 text-white' : 'text-gray-500'}`}
                        >
                            SELL
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">
                            {isBuyMode ? "You Pay (USDC)" : `You Sell (${symbol})`}
                        </label>
                        <input 
                            type="number" 
                            className="w-full bg-black border border-zinc-700 p-3 rounded-lg text-white font-mono text-lg focus:border-blue-500 focus:outline-none"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        onClick={handleTrade}
                        disabled={isPending || !tradingActive}
                        className={`w-full py-4 rounded-lg font-bold text-lg transition disabled:opacity-50 ${isBuyMode ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        {isPending ? "Processing..." : !tradingActive ? "Trading Paused" : (isBuyMode ? "Buy Tokens" : "Sell Tokens")}
                    </button>
                </div>
                
                <div className="mt-4 text-xs text-center text-gray-500">
                    Balance: {isBuyMode 
                        ? (usdcBalance ? parseFloat(formatEther(usdcBalance as bigint)).toFixed(2) + " USDC" : "0.00") 
                        : (assetBalance ? parseFloat(formatEther(assetBalance as bigint)).toFixed(2) + " " + symbol : "0.00")}
                </div>
            </div>
            
             {/* Buyout Section (Keep existing code or minimized version) */}
             {/* ... You can leave the previous Buyout code here ... */}
        </div>
      </div>
    </main>
  );
}