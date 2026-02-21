'use client';

import { useReadContract } from 'wagmi';
import { REAL_WORLD_ASSET_ABI } from '../constants/contracts';
import { formatEther } from 'viem';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

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
    <Link href={`/asset/${assetAddress}`}>
        <div className="group bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 rounded-lg p-3 cursor-pointer transition-all hover:bg-zinc-900 relative">
            
            {/* Header: Icon & Live Status */}
            <div className="flex justify-between items-start mb-3">
                <div className="relative w-12 h-12 rounded-md overflow-hidden bg-zinc-800">
                    <img src={imageUrl as string} alt="Icon" className="object-cover w-full h-full" />
                </div>
                {isSold ? (
                     <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-1 rounded">Sold</span>
                ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-500 bg-green-500/10 px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Live
                    </span>
                )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-bold text-white mb-1 line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
                {name as string}
            </h3>

            {/* Metric Row */}
            <div className="flex justify-between items-end mt-4">
                <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Valuation</p>
                    <p className="text-white font-mono font-medium">
                        ${parseInt(formatEther(valuation as bigint || 0n)).toLocaleString()}
                    </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
            </div>
        </div>
    </Link>
  );
}