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
  const { data: tradingActive, refetch: refetchActive } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'tradingActive' });

  // Balances
  const { data: assetBalance } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] });
  const { data: usdcBalance } = useReadContract({ address: MOCK_USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] });

  // --- SMART APPROVAL CHECK ---
  // We check if the Asset Contract is allowed to spend your USDC
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress as `0x${string}`, assetAddress as `0x${string}`],
  });

  // Writes
  const { writeContract, isPending, data: hash } = useWriteContract();
  
  // Watch for transaction completion to auto-update UI
// ... inside AssetDetails ...

  // Watch for transaction completion
  const { isSuccess: isTxSuccess, isError: isTxError, error: txError } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isTxSuccess) {
        alert("Market Initialized Successfully! Reloading...");
        window.location.reload(); // <--- Force reload to update UI
    }
    if (isTxError) {
        console.error("Transaction Failed on Chain:", txError);
        alert("Transaction Failed! Check Console for details.");
    }
  }, [isTxSuccess, isTxError, txError]);

const handleInitialize = () => {
      console.log("Initializing with 500 tokens...");
      
      writeContract({
        address: assetAddress as `0x${string}`,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'addLiquidity',
        args: [parseEther("500")],
        // FIX: Force a high gas limit to bypass the estimation error
        gas: BigInt(5000000) 
      }, {
        onError: (err) => {
            console.error("Write Error:", err);
            // This will likely give us the REAL error message now (e.g. "ERC20: transfer amount exceeds allowance")
            alert("Error: " + (err as any).shortMessage || err.message);
        }
      });
  };


  // --- LOGIC: IS STEP 1 DONE? ---
  // We need 50% of Valuation in USDC. 
  // e.g. If Valuation is 50,000, we need 25,000 allowance.
  const requiredAllowance = valuation ? (valuation as bigint) / 2n : 0n;
  const hasApproved = allowance ? (allowance as bigint) >= requiredAllowance : false;


  // --- HANDLERS ---
  const handleApprove = () => {
    writeContract({
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [assetAddress as `0x${string}`, parseEther("100000000")] // Infinite Approve
    });
  };


  const handleTrade = () => {
    if (!amount || !userAddress) return;
    const parsedAmount = parseEther(amount);

    if (isBuyMode) {
        // For Buying, we need to approve USDC first (if not already done)
        // Ideally we check allowance here too, but for MVP we just trigger approve then buy
        writeContract({
            address: MOCK_USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [assetAddress as `0x${string}`, parsedAmount]
        }, {
            onSuccess: () => {
                // Wait for user to confirm approve, then trigger buy (Simplified)
                // Note: In production, we'd wait for receipt. Here we assume fast user.
                 writeContract({
                    address: assetAddress as `0x${string}`,
                    abi: REAL_WORLD_ASSET_ABI,
                    functionName: 'buyTokens',
                    args: [parsedAmount]
                });
            }
        });
    } else {
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
            
             {/* --- SMART ACTIVATION PANEL --- */}
            {!tradingActive && assetBalance && (assetBalance as bigint) > 0n && (
                <div className="mb-8 p-6 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                    <h3 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                        🚀 Launch Your Market
                    </h3>
                    <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                        As the creator, you must "seed" the market so others can trade. 
                        This requires two steps: <br/>
                        1. <strong>Approve</strong> the contract to access your USDC. <br/>
                        2. <strong>Initialize</strong> the pool with 50% of your tokens and matching cash.
                    </p>

                    <div className="space-y-3">
                        {/* STEP 1 BUTTON */}
                        {!hasApproved ? (
                             <button 
                                onClick={handleApprove} 
                                disabled={isPending} 
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition flex justify-center items-center gap-2"
                            >
                                {isPending ? "Processing..." : "Step 1: Approve USDC Permission"}
                            </button>
                        ) : (
                             <div className="w-full py-3 bg-green-900/50 border border-green-500/50 text-green-400 rounded-lg font-bold text-center">
                                ✅ USDC Approved
                            </div>
                        )}

                        {/* STEP 2 BUTTON (Only visible if Step 1 is done) */}
                        {hasApproved && (
                            <button 
                                onClick={handleInitialize} 
                                disabled={isPending} 
                                className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold transition animate-pulse"
                            >
                                {isPending ? "Initializing..." : "Step 2: Initialize Market"}
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

            {/* SWAP BOX */}
            <div className={`p-6 bg-zinc-900 rounded-2xl border border-zinc-800 ${!tradingActive ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-xl">Quick Swap</h3>
                    {!tradingActive && <span className="text-xs bg-yellow-600 text-black px-2 py-1 rounded font-bold">PAUSED</span>}
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
        </div>
      </div>
    </main>
  );
}