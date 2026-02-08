'use client';

import Navbar from '../../components/Navbar';
import { useAccount, useReadContract } from 'wagmi';
import { ASSET_FACTORY_ADDRESS, ASSET_FACTORY_ABI, REAL_WORLD_ASSET_ABI } from '../../constants/contracts';
import { formatEther } from 'viem';
import Link from 'next/link';

// Helper Component for a Single Row
function AssetRow({ assetAddress, userAddress }: { assetAddress: `0x${string}`, userAddress: `0x${string}` }) {
  // Read Data
  const { data: name } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetName' });
  const { data: symbol } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'symbol' });
  const { data: balance } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'balanceOf', args: [userAddress] });
  const { data: price } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'getPrice' });
  const { data: imageUrl } = useReadContract({ address: assetAddress, abi: REAL_WORLD_ASSET_ABI, functionName: 'assetUrl' });

  // If user has 0 balance, return null (Hide this row)
  if (!balance || (balance as bigint) === 0n) return null;

  const userBalance = parseFloat(formatEther(balance as bigint));
  const currentPrice = price ? parseFloat(formatEther(price as bigint)) : 0;
  const value = userBalance * currentPrice;

  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-900/50 transition">
        <td className="py-4 px-4 flex items-center gap-4">
            <img src={imageUrl as string} alt="Asset" className="w-10 h-10 rounded-lg object-cover" />
            <div>
                <div className="font-bold">{name as string}</div>
                <div className="text-xs text-gray-500">{symbol as string}</div>
            </div>
        </td>
        <td className="py-4 px-4 text-right">{userBalance.toFixed(2)} {symbol as string}</td>
        <td className="py-4 px-4 text-right text-green-400">${currentPrice.toFixed(2)}</td>
        <td className="py-4 px-4 text-right font-bold">${value.toLocaleString()}</td>
        <td className="py-4 px-4 text-right">
            <Link href={`/asset/${assetAddress}`}>
                <button className="text-xs bg-zinc-800 hover:bg-blue-600 px-3 py-1 rounded transition">Trade</button>
            </Link>
        </td>
    </tr>
  );
}

export default function Portfolio() {
  const { address } = useAccount();

  // Get List of All Assets
  const { data: assetList } = useReadContract({
    address: ASSET_FACTORY_ADDRESS,
    abi: ASSET_FACTORY_ABI,
    functionName: 'getDeployedAssets',
  });

  if (!address) return <div className="text-white p-10">Please connect wallet</div>;

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">My Portfolio</h1>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-zinc-900 text-gray-400 text-xs uppercase tracking-wider">
                    <tr>
                        <th className="py-4 px-4">Asset</th>
                        <th className="py-4 px-4 text-right">Balance</th>
                        <th className="py-4 px-4 text-right">Price</th>
                        <th className="py-4 px-4 text-right">Value (USDC)</th>
                        <th className="py-4 px-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                    {assetList && (assetList as `0x${string}`[]).map((assetAddr) => (
                        <AssetRow key={assetAddr} assetAddress={assetAddr} userAddress={address} />
                    ))}
                </tbody>
            </table>
            
            {/* Empty State Message (Only show if list is loaded but empty - hard to detect in map, so keeping simple for now) */}
            {assetList && (assetList as []).length === 0 && (
                <div className="p-8 text-center text-gray-500">No assets found.</div>
            )}
        </div>
      </div>
    </main>
  );
}