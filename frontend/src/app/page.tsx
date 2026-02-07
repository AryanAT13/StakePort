'use client';

import Navbar from '../components/Navbar';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { MOCK_USDC_ADDRESS, ERC20_ABI } from '../constants/contracts';
import { parseEther, formatEther } from 'viem';
import { useState, useEffect } from 'react';

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

      <div className="max-w-6xl mx-auto p-8">
        <header className="mb-12">
          <h1 className="text-5xl font-extrabold mb-4">
            Welcome, <span className="text-blue-500">Boss.</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Your decentralized gateway to high-value real world assets.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Balance */}
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Available Liquidity</h3>
            <div className="text-3xl font-bold text-white">
              ${parseFloat(balance).toLocaleString()} <span className="text-sm text-gray-500">USDC</span>
            </div>
          </div>

          {/* Card 2: Portfolio (Static for now) */}
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Portfolio Value</h3>
            <div className="text-3xl font-bold text-white">$0.00</div>
          </div>

          {/* Card 3: Action (Dynamic Input) */}
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Add Funds (Stripe Test)</h3>
            
            {isConnected ? (
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Amount (e.g. 5000)"
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                />
                <button 
                  onClick={handleAddFunds}
                  disabled={isPending}
                  className="whitespace-nowrap py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {isPending ? "..." : "Add"}
                </button>
              </div>
            ) : (
              <div className="text-sm text-yellow-500">Connect Wallet to trade</div>
            )}
          </div>
        </div>

        <section>
          <h2 className="text-2xl font-bold mb-6">Trending Assets</h2>
          <div className="p-12 border border-dashed border-zinc-800 rounded-2xl text-center text-gray-500">
            No assets listed yet. Go to Admin Panel to list.
          </div>
        </section>
      </div>
    </main>
  );
}