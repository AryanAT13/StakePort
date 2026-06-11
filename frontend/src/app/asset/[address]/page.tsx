'use client';

import Navbar from '../../../components/Navbar';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { REAL_WORLD_ASSET_ABI, ERC20_ABI, MOCK_USDC_ADDRESS } from '../../../constants/contracts';
import { formatEther, parseEther, parseAbiItem } from 'viem';
import { useState, useEffect } from 'react';
import PriceChart from '../../../components/PriceChart';
import { getClientPublicClient } from '@/lib/clientChain';

const publicClient = getClientPublicClient();

export default function AssetDetails() {
  const { address: assetAddress } = useParams();
  const { address: userAddress } = useAccount();

  const [aiDescription, setAiDescription] = useState<string>("Loading AI appraisal...");
  const [fairValue, setFairValue] = useState<number | null>(null);
  
  const [amount, setAmount] = useState('');
  const [isBuyMode, setIsBuyMode] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);


  const { data: name } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' });
  const { data: symbol } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol' });
  const { data: valuation } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'valuation' });
  const { data: imageUrl } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' });
  const { data: currentPrice } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'getPrice' });
  const { data: ownerAddress } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'owner' });

  const { data: totalSupply } = useReadContract({ 
      address: assetAddress as `0x${string}`, 
      abi: REAL_WORLD_ASSET_ABI, 
      functionName: 'totalSupply' 
  });
  
  const { data: tradingActive, refetch: refetchActive } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'tradingActive' });
  const { data: isSold, refetch: refetchSold } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'sold' });

  const { data: assetBalance, refetch: refetchAssetBal } = useReadContract({ address: assetAddress as `0x${string}`, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] });
  const { data: usdcBalance, refetch: refetchUsdcBal } = useReadContract({ address: MOCK_USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress as `0x${string}`, assetAddress as `0x${string}`],
  });

  // Writes
  const { writeContract, isPending, data: hash } = useWriteContract();
  const { isSuccess: isTxSuccess, isError: isTxError, error: txError } = useWaitForTransactionReceipt({ hash });

  // Owner Check
  const isCreator = userAddress === ownerAddress;

  // Auto-refresh data after transaction
  useEffect(() => {
    if (isTxSuccess) {
        refetchActive();
        refetchAllowance();
        refetchSold();
        refetchAssetBal();
        refetchUsdcBal();
    }
    if (isTxError) {
        console.error("Transaction Failed:", txError);
        alert("Transaction Failed! Check console.");
    }
  }, [isTxSuccess, isTxError, txError, refetchActive, refetchAllowance, refetchSold, refetchAssetBal, refetchUsdcBal]);

  // ---- AI APPRAISER + ML ORACLE ---------------------------------------------
  // These fire once per asset page open. The endpoints cache server-side, so
  // re-renders / refetches don't burn Gemini / SerpAPI credits. We don't
  // block render on them; the panel just shows a skeleton until they land.
  useEffect(() => {
    if (!assetAddress) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/ai/prospectus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: assetAddress }),
        });
        const j = await res.json();
        if (!cancelled) {
          if (res.ok && j.prospectus) setAiDescription(j.prospectus);
          else setAiDescription('AI appraisal unavailable for this asset.');
        }
      } catch {
        if (!cancelled) setAiDescription('AI appraisal unavailable for this asset.');
      }
    })();

    (async () => {
      try {
        const res = await fetch('/api/ai/fair-value', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: assetAddress }),
        });
        const j = await res.json();
        if (!cancelled && res.ok && typeof j.fairValue === 'number') {
          setFairValue(Math.round(j.fairValue));
        }
      } catch {
        /* fair value is optional; silent on failure */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetAddress]);

  // Calculate Total Volume dynamically
  useEffect(() => {
      async function fetchVolume() {
          if (!assetAddress) return;
          try {
              const logs = await publicClient.getLogs({
                  address: assetAddress as `0x${string}`,
                  event: parseAbiItem('event Traded(address indexed user, string action, uint256 amountIn, uint256 amountOut, uint256 newPrice)'),
                  fromBlock: 'earliest',
                  toBlock: 'latest'
              });
              
              let vol = 0;
              logs.forEach(log => {
                  if (log.args.action === 'BUY') vol += parseFloat(formatEther(log.args.amountIn as bigint));
                  else vol += parseFloat(formatEther(log.args.amountOut as bigint));
              });
              setTotalVolume(vol);
          } catch (error) {
              console.error("Failed to fetch volume logs:", error);
          }
      }
      fetchVolume();
  }, [assetAddress]);

  // Image Handling
  const images = (imageUrl as string)?.split(',') || [];
  const displayImage = images[0] || "https://placehold.co/600x400/1a1a1a/FFF?text=No+Image";

  // --- HANDLERS ---

  // 1. Enable Trading (Massive Approval)
  const handleEnableTrading = () => {
    writeContract({
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [assetAddress as `0x${string}`, parseEther("1000000000")] // 1 Billion USDC
    });
  };

  // 2. Initialize Market (Creator only)
  const handleInitialize = () => {
      if (allowance && (allowance as bigint) === 0n) {
          handleEnableTrading();
          return;
      }

      const requiredUSDC = valuation ? (valuation as bigint) / 2n : 0n;
      const currentBalance = usdcBalance ? (usdcBalance as bigint) : 0n;

      if (currentBalance < requiredUSDC) {
          alert(`Insufficient Funds! \n\nTo initialize this market, you need to provide 50% liquidity: $${parseFloat(formatEther(requiredUSDC)).toLocaleString()} USDC.\n\nPlease go to the Dashboard and 'Add Funds' first.`);
          return;
      }

      writeContract({
        address: assetAddress as `0x${string}`,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'addLiquidity',
        args: [parseEther("500")],
        gas: BigInt(5000000)
      });
  };

  // 3. Trade (Buy/Sell)
  const handleTrade = () => {
    if (!amount || !userAddress) return;
    const parsedAmount = parseEther(amount);

    if (isBuyMode) {
         writeContract({
            address: assetAddress as `0x${string}`,
            abi: REAL_WORLD_ASSET_ABI,
            functionName: 'buyTokens',
            args: [parsedAmount],
            gas: BigInt(5000000)
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

  // --- DYNAMIC BUYOUT PRICE HELPER ---
  const getDynamicBuyoutPrice = () => {
      if (!valuation) return 0n;

      let baseValue = valuation as bigint;

      if (tradingActive && currentPrice && totalSupply) {
          const marketCap = ((currentPrice as bigint) * (totalSupply as bigint)) / parseEther("1");
          if (marketCap > baseValue) {
              baseValue = marketCap;
          }
      }

      return (baseValue * 125n) / 100n;
  };

  const dynamicBuyoutPrice = getDynamicBuyoutPrice();

  // 4. Hostile Buyout
  const handleBuyout = () => {
    if (dynamicBuyoutPrice === 0n) return;
    
    if (!allowance || (allowance as bigint) < dynamicBuyoutPrice) {
        handleEnableTrading();
        return;
    }

    writeContract({
        address: assetAddress as `0x${string}`,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'initiateBuyout',
        args: [dynamicBuyoutPrice]
    });
  };

  // 5. Cash Out
  const handleCashOut = () => {
    writeContract({
        address: assetAddress as `0x${string}`,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'cashOut',
    });
  };

  if (!name) return <div className="text-white p-10">Loading Asset...</div>;

  // Logic Helpers
  const requiredAllowance = valuation ? (valuation as bigint) / 2n : 0n;
  const hasApproved = allowance ? (allowance as bigint) >= requiredAllowance : false;
  const needsApproval = isBuyMode && (!allowance || (allowance as bigint) === 0n);

  return (
    <main className="min-h-screen bg-black text-white font-sans">
      <Navbar />
      
      {/* 1. ASSET HEADER TICKER */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-zinc-800 overflow-hidden">
                    <img src={displayImage} className="w-full h-full object-cover" alt="Asset Thumbnail" />
                </div>
                <div>
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        {name as string} <span className="text-zinc-500 text-sm font-normal">/{symbol as string}</span>
                    </h1>
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-400 font-mono">
                             {currentPrice ? `$${parseFloat(formatEther(currentPrice as bigint)).toFixed(2)}` : "$-.--"}
                        </span>
                        <span className="text-zinc-500 text-xs">Current Price</span>
                    </div>
                </div>
            </div>
            
            {/* Status Pill */}
            {isSold ? (
                <div className="px-3 py-1 bg-red-900/30 text-red-500 border border-red-900 rounded text-xs font-bold uppercase">Target Acquired</div>
            ) : (
                <div className="px-3 py-1 bg-green-900/30 text-green-500 border border-green-900 rounded text-xs font-bold uppercase flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Market Open
                </div>
            )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: CHART AREA (Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* NEW: IMAGE GALLERY */}
            {images.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-2 mb-2">
                    {images.map((img, idx) => (
                        <img key={idx} src={img.trim()} className="w-24 h-24 rounded-lg object-cover border border-zinc-800" alt={`Asset ${idx+1}`} />
                    ))}
                </div>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 h-[400px] relative">
                {isSold && (
                    <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center backdrop-blur-sm rounded-xl">
                        <h2 className="text-4xl font-black text-white tracking-tighter uppercase border-4 border-white p-4 rotate-12">Sold Out</h2>
                    </div>
                )}
                <PriceChart assetAddress={assetAddress as string} />
            </div>

            {/* Description / Stats Row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs uppercase mb-1">Market Cap</p>
                    <p className="text-xl font-mono text-white">
                        ${totalSupply && currentPrice ? ((parseFloat(formatEther(currentPrice as bigint)) * parseFloat(formatEther(totalSupply as bigint))).toLocaleString()) : "-"}
                    </p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
                     <p className="text-zinc-500 text-xs uppercase mb-1">Valuation</p>
                     <p className="text-xl font-mono text-white">${parseInt(formatEther(valuation as bigint || 0n)).toLocaleString()}</p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs uppercase mb-1">Total Volume</p>
                    <p className="text-xl font-mono text-white">${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
            </div>
        </div>

        {/* AI APPRAISAL SECTION */}
<div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-6">
    <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
            ✨ AI Appraiser Report
        </h3>
        {fairValue !== null && valuation && (
            <div className={`px-3 py-1 rounded text-xs font-bold ${fairValue > parseInt(formatEther(valuation as bigint)) ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                Fair Value: ${fairValue.toLocaleString()}
            </div>
        )}
    </div>
    
    {aiDescription === "Loading AI appraisal..." ? (
        <div className="animate-pulse space-y-3">
            <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
            <div className="h-4 bg-zinc-800 rounded w-full"></div>
            <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
        </div>
    ) : (
        <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
            {aiDescription}
        </p>
    )}
</div>

        {/* RIGHT: TRADING PANEL (Span 4) */}
        <div className="lg:col-span-4 space-y-4">
            
            {/* ORDER BOOK / TRADE PANEL */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                {/* Tabs */}
                <div className="flex bg-black rounded-lg p-1 mb-4">
                    <button onClick={() => setIsBuyMode(true)} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition ${isBuyMode ? 'bg-green-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>Buy</button>
                    <button onClick={() => setIsBuyMode(false)} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition ${!isBuyMode ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>Sell</button>
                </div>

                {/* Input Area */}
                {!isSold && tradingActive ? (
                     <>
                        <div className="relative mb-4">
                            <label className="text-[10px] text-zinc-400 uppercase font-bold absolute top-2 left-3">Amount</label>
                            <input 
                                type="number" 
                                className="w-full bg-black border border-zinc-700 rounded-lg pt-6 pb-2 px-3 text-right font-mono text-xl focus:border-blue-500 outline-none text-white"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            <span className="absolute bottom-3 left-3 text-zinc-500 text-sm font-mono">
                                {isBuyMode ? 'USDC' : symbol}
                            </span>
                        </div>

                        {/* Balance Check */}
                        <div className="flex justify-between text-xs text-zinc-500 mb-4 font-mono">
                            <span>Balance:</span>
                            <span>{isBuyMode ? parseFloat(formatEther(usdcBalance as bigint || 0n)).toFixed(2) : parseFloat(formatEther(assetBalance as bigint || 0n)).toFixed(2)}</span>
                        </div>

                        {/* UX: Approval vs Trade */}
                        {needsApproval ? (
                             <button onClick={handleEnableTrading} disabled={isPending} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white transition text-sm">
                                {isPending ? "Approving..." : "Unlock Trading"}
                            </button>
                        ) : (
                            <button onClick={handleTrade} disabled={isPending} className={`w-full py-3 rounded-lg font-bold text-white transition text-sm ${isBuyMode ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}>
                                {isPending ? "Processing..." : (isBuyMode ? "Place Buy Order" : "Place Sell Order")}
                            </button>
                        )}
                     </>
                ) : (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                        {isSold ? "Trading Halted (Sold)" : "Market Not Active"}
                    </div>
                )}
            </div>

            {/* HOSTILE BUYOUT CARD (Mini) - Hidden for Creator */}
            {!isCreator && !isSold && valuation && (
                <div className="border border-red-900/30 bg-red-900/10 rounded-xl p-4">
                    <h3 className="text-red-500 font-bold text-sm mb-2">🔥 Hostile Takeover</h3>
                    <div className="flex justify-between items-center text-sm mb-3">
                         <span className="text-zinc-400">Buyout Price</span>
                         <span className="text-white font-mono font-bold">${parseFloat(formatEther(dynamicBuyoutPrice)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    {(!allowance || (allowance as bigint) < dynamicBuyoutPrice) ? (
                         <button onClick={handleEnableTrading} className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded text-zinc-300">Enable USDC</button>
                    ) : (
                        <button onClick={handleBuyout} className="w-full py-2 bg-red-600 hover:bg-red-500 text-xs font-bold rounded text-white">Execute Buyout</button>
                    )}
                </div>
            )}
             
            {/* CASH OUT (If Sold) */}
            {isSold && (
                <div className="bg-green-900/20 border border-green-900/50 rounded-xl p-4 text-center">
                    <p className="text-green-400 font-bold mb-2">Payout Available</p>
                    <button onClick={handleCashOut} className="w-full py-2 bg-green-600 text-white rounded font-bold text-sm">Claim Share</button>
                </div>
            )}

            {/* INITIALIZE (If Creator) */}
            {!tradingActive && !isSold && assetBalance && (assetBalance as bigint) > 0n && (
                <div className="bg-blue-900/20 border border-blue-900/50 rounded-xl p-4">
                     <p className="text-blue-400 font-bold mb-2 text-sm">Launchpad</p>
                     {!hasApproved ? (
                        <button onClick={handleEnableTrading} className="w-full py-2 bg-blue-600 rounded text-xs font-bold">Approve</button>
                     ) : (
                        <button onClick={handleInitialize} className="w-full py-2 bg-green-600 rounded text-xs font-bold">Initialize Market</button>
                     )}
                </div>
            )}

        </div>
      </div>
    </main>
  );
}