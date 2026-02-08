'use client';

import Navbar from '../../../components/Navbar';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { REAL_WORLD_ASSET_ABI, ERC20_ABI, MOCK_USDC_ADDRESS } from '../../../constants/contracts';
import { formatEther, parseEther } from 'viem';
import { useState, useEffect } from 'react';

export default function AssetDetails() {
  const { address: assetAddress } = useParams();
  const { address: userAddress } = useAccount();
  
  // State
  const [amount, setAmount] = useState('');
  const [isBuyMode, setIsBuyMode] = useState(true);

  // --- READS ---
  const { data: name } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' });
  const { data: symbol } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol' });
  const { data: valuation } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'valuation' });
  const { data: imageUrl } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' });
  const { data: currentPrice } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'getPrice' });
  
  // Status Checks
  const { data: tradingActive, refetch: refetchActive } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'tradingActive' });
  // NEW: Check if asset is sold
  const { data: isSold, refetch: refetchSold } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'sold' });

  // Balances
  const { data: assetBalance, refetch: refetchAssetBal } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] });
  const { data: usdcBalance, refetch: refetchUsdcBal } = useReadContract({ address: MOCK_USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] });

  // Allowances
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress as `0x${string}`, assetAddress as `0x${string}`],
  });

  // Writes
  const { writeContract, isPending, data: hash } = useWriteContract();
  const { isSuccess: isTxSuccess, isError: isTxError, error: txError } = useWaitForTransactionReceipt({ hash });

  // Auto-refresh data after transaction
  useEffect(() => {
    if (isTxSuccess) {
        // Reload page logic or refetch all
        refetchActive();
        refetchAllowance();
        refetchSold();
        refetchAssetBal();
        refetchUsdcBal();
        alert("Transaction Confirmed!");
        // Optional: window.location.reload(); 
    }
    if (isTxError) {
        console.error("Transaction Failed:", txError);
        alert("Transaction Failed! Check console.");
    }
  }, [isTxSuccess, isTxError, txError, refetchActive, refetchAllowance, refetchSold, refetchAssetBal, refetchUsdcBal]);


  // --- HANDLERS ---
  const handleApprove = () => {
    writeContract({
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [assetAddress as `0x${string}`, parseEther("100000000")] // Infinite Approve
    });
  };

  const handleInitialize = () => {
      writeContract({
        address: assetAddress as `0x${string}`,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'addLiquidity',
        args: [parseEther("500")],
        gas: BigInt(5000000)
      });
  };

  const handleTrade = () => {
    if (!amount) return;
    const parsedAmount = parseEther(amount);
    if (isBuyMode) {
        // Simple Buy
         writeContract({
            address: assetAddress as `0x${string}`,
            abi: REAL_WORLD_ASSET_ABI,
            functionName: 'buyTokens',
            args: [parsedAmount]
        });
    } else {
        // Simple Sell (Approve first if needed, but usually just Sell for MVP)
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

  // NEW: Handle Hostile Buyout
  const handleBuyout = () => {
    if (!valuation) return;
    // Price = Valuation + 10%
    const buyoutPrice = (valuation as bigint * 110n) / 100n;
    
    // Check allowance first
    if (!allowance || (allowance as bigint) < buyoutPrice) {
        handleApprove(); // Ask for approval if not enough
        return;
    }

    writeContract({
        address: assetAddress as `0x${string}`,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'initiateBuyout',
        args: [buyoutPrice]
    });
  };

  // NEW: Handle Cash Out (Burning tokens for USDC)
  const handleCashOut = () => {
    writeContract({
        address: assetAddress as `0x${string}`,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'cashOut',
    });
  };

  if (!name) return <div className="text-white p-10">Loading Asset...</div>;

  const requiredAllowance = valuation ? (valuation as bigint) / 2n : 0n;
  const hasApproved = allowance ? (allowance as bigint) >= requiredAllowance : false;

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* LEFT: Image & Status */}
        <div>
            <div className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden mb-8 border border-zinc-800 relative">
                <img src={imageUrl as string} alt="Asset" className={`w-full h-full object-cover transition ${isSold ? 'grayscale opacity-50' : ''}`} />
                 
                 {/* Live Price Tag (Hide if sold) */}
                 {!isSold && (
                    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur px-4 py-2 rounded-lg border border-green-500/30">
                        <span className="text-gray-400 text-xs uppercase">Current Price</span>
                        <div className="text-xl font-bold text-green-400">
                            {currentPrice ? `$${parseFloat(formatEther(currentPrice as bigint)).toFixed(2)}` : "$-.--"}
                        </div>
                    </div>
                 )}

                 {/* SOLD Stamp (Show if sold) */}
                 {isSold && (
                     <div className="absolute inset-0 flex items-center justify-center">
                         <div className="bg-red-600 text-white px-8 py-2 text-4xl font-black rotate-[-12deg] border-4 border-white shadow-xl">
                             SOLD
                         </div>
                     </div>
                 )}
            </div>
            
            {/* INITIALIZATION PANEL (Only if not active & not sold & user has balance) */}
            {!tradingActive && !isSold && assetBalance && (assetBalance as bigint) > 0n && (
                <div className="mb-8 p-6 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                    <h3 className="font-bold text-blue-400 mb-2">🚀 Launch Market</h3>
                    <p className="text-sm text-gray-300 mb-4">Initialize the pool with 50% liquidity.</p>
                    <div className="space-y-3">
                        {!hasApproved ? (
                             <button onClick={handleApprove} disabled={isPending} className="w-full py-3 bg-blue-600 rounded-lg font-bold">
                                Step 1: Approve USDC
                            </button>
                        ) : (
                            <button onClick={handleInitialize} disabled={isPending} className="w-full py-3 bg-green-600 rounded-lg font-bold animate-pulse">
                                Step 2: Initialize
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* RIGHT: Trading Terminal */}
        <div className="space-y-8">
            <div>
                <h1 className="text-5xl font-bold mb-2">{name as string}</h1>
                <p className="text-gray-400 text-lg">{symbol as string} • Fractionalized Asset</p>
            </div>

            {/* SCENARIO 1: NORMAL TRADING (Show only if active & not sold) */}
            {!isSold && tradingActive && (
                <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                    <div className="flex justify-between mb-4">
                        <h3 className="font-bold text-xl">Quick Swap</h3>
                        <div className="flex bg-black rounded-lg p-1">
                            <button onClick={() => setIsBuyMode(true)} className={`px-4 py-1 rounded-md text-sm font-bold ${isBuyMode ? 'bg-green-600 text-white' : 'text-gray-500'}`}>BUY</button>
                            <button onClick={() => setIsBuyMode(false)} className={`px-4 py-1 rounded-md text-sm font-bold ${!isBuyMode ? 'bg-red-600 text-white' : 'text-gray-500'}`}>SELL</button>
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

                        <button onClick={handleTrade} disabled={isPending} className={`w-full py-4 rounded-lg font-bold text-lg ${isBuyMode ? 'bg-green-600' : 'bg-red-600'}`}>
                            {isPending ? "Processing..." : (isBuyMode ? "Buy Tokens" : "Sell Tokens")}
                        </button>
                    </div>
                    <div className="mt-4 text-xs text-center text-gray-500">
                        Balance: {isBuyMode 
                            ? (usdcBalance ? parseFloat(formatEther(usdcBalance as bigint)).toFixed(2) + " USDC" : "0.00") 
                            : (assetBalance ? parseFloat(formatEther(assetBalance as bigint)).toFixed(2) + " " + symbol : "0.00")}
                    </div>
                </div>
            )}

            {/* SCENARIO 2: ASSET IS SOLD (CASH OUT PANEL) */}
            {isSold && (
                <div className="p-8 bg-green-900/20 border border-green-500/50 rounded-2xl text-center">
                    <h3 className="text-2xl font-bold text-green-400 mb-2">💰 Asset Acquired!</h3>
                    <p className="text-gray-300 mb-6">
                        This asset has been bought out by a private collector. <br/>
                        Trading is halted. You can now claim your share of the payout.
                    </p>
                    <div className="text-xl font-bold mb-6">
                        Your Share: {assetBalance ? parseFloat(formatEther(assetBalance as bigint)).toFixed(2) : "0.00"} Tokens
                    </div>
                    <button 
                        onClick={handleCashOut}
                        disabled={isPending || !assetBalance || (assetBalance as bigint) === 0n}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-lg transition disabled:opacity-50 disabled:grayscale"
                    >
                        {isPending ? "Processing..." : (assetBalance && (assetBalance as bigint) > 0n) ? "🔥 Burn Tokens & Cash Out" : "✅ Cash Out Complete"}
                    </button>
                </div>
            )}

            {/* SCENARIO 3: HOSTILE TAKEOVER (Only show if NOT sold and valuation exists) */}
            {!isSold && valuation && (
                <div className="p-8 bg-gradient-to-br from-red-900/20 to-black border border-red-900/50 rounded-2xl opacity-80 hover:opacity-100 transition">
                    <h3 className="text-xl font-bold text-red-500 mb-2">🔥 Hostile Buyout</h3>
                    <p className="text-gray-400 mb-4 text-xs">
                        Pay full valuation + 10% premium to acquire 100% of this asset immediately.
                    </p>
                    <div className="flex justify-between items-center mb-4 font-mono text-sm">
                        <span className="text-gray-400">Buyout Price:</span>
                        <span className="text-white font-bold">${(parseInt(formatEther(valuation as bigint)) * 1.1).toLocaleString()}</span>
                    </div>
                    <button 
                        onClick={handleBuyout}
                        disabled={isPending}
                        className="w-full py-3 bg-zinc-800 hover:bg-red-900 border border-zinc-700 hover:border-red-500 rounded-lg font-bold transition text-sm text-gray-300 hover:text-white"
                    >
                        Initiate Takeover
                    </button>
                </div>
            )}

        </div>
      </div>
    </main>
  );
}