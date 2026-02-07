'use client';

import { useReadContract } from 'wagmi';
import { REAL_WORLD_ASSET_ABI } from '../constants/contracts';
import { formatEther } from 'viem';
import Link from 'next/link';

// This component takes an address, fetches details, and shows the card
export default function AssetCard({ assetAddress }: { assetAddress: `0x${string}` }) {

  // 1. Fetch Name
  const { data: name } = useReadContract({
    address: assetAddress,
    abi: REAL_WORLD_ASSET_ABI,
    functionName: 'assetName',
  });

  // 2. Fetch Valuation (Price)
  const { data: valuation } = useReadContract({
    address: assetAddress,
    abi: REAL_WORLD_ASSET_ABI,
    functionName: 'valuation',
  });

  // 3. Fetch Image URL
  const { data: imageUrl } = useReadContract({
    address: assetAddress,
    abi: REAL_WORLD_ASSET_ABI,
    functionName: 'assetUrl',
  });

  // 4. Check if it's sold out (Buyout Proposed)
  const { data: isSold } = useReadContract({
    address: assetAddress,
    abi: REAL_WORLD_ASSET_ABI,
    functionName: 'buyoutProposed',
  });

  // Loading State
  if (!name) return <div className="animate-pulse bg-zinc-900 h-64 rounded-xl"></div>;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-blue-500 transition group relative">
      
      {/* Asset Image */}
      <div className="h-48 w-full relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
            src={imageUrl as string || "https://placehold.co/600x400/1a1a1a/FFF?text=No+Image"} 
            alt="Asset" 
            className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
        />
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
            {isSold ? (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">SOLD</span>
            ) : (
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">LIVE</span>
            )}
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <h3 className="text-xl font-bold text-white mb-1">{name as string}</h3>
        <p className="text-gray-400 text-sm mb-4">
            Valuation: <span className="text-white font-mono">${parseInt(formatEther(valuation as bigint || 0n)).toLocaleString()}</span>
        </p>

        {/* Action Button */}
        <Link href={`/asset/${assetAddress}`}>
            <button className="w-full py-2 bg-zinc-800 hover:bg-blue-600 text-white rounded-lg font-medium transition">
                View Details
            </button>
        </Link>
      </div>
    </div>
  );
}