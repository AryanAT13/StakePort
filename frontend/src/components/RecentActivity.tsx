'use client';

import { useEffect, useState } from 'react';
import { createPublicClient, http, parseAbiItem, formatEther } from 'viem';
import { hardhat } from 'viem/chains';
import { ASSET_FACTORY_ADDRESS, ASSET_FACTORY_ABI, REAL_WORLD_ASSET_ABI } from '../constants/contracts';

const publicClient = createPublicClient({
  chain: hardhat,
  transport: http()
});

type Activity = {
    hash: string;
    action: string;
    amount: string;
    price: string;
    assetName: string;
    time: string;
};

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    async function fetchGlobalActivity() {
      try {
        const assets = await publicClient.readContract({
            address: ASSET_FACTORY_ADDRESS,
            abi: ASSET_FACTORY_ABI,
            functionName: 'getDeployedAssets',
        }) as `0x${string}`[];

        const allLogs: Activity[] = [];

        for (const asset of assets) {
            const name = await publicClient.readContract({
                address: asset,
                abi: REAL_WORLD_ASSET_ABI,
                functionName: 'assetName',
            }) as string;

            const logs = await publicClient.getLogs({
                address: asset,
                event: parseAbiItem('event Traded(address indexed user, string action, uint256 amountIn, uint256 amountOut, uint256 newPrice)'),
                fromBlock: 'earliest', 
                toBlock: 'latest'
            });

            logs.forEach(log => {
                const action = log.args.action as string;
                const tokenAmount = action === 'BUY' ? log.args.amountOut : log.args.amountIn;

                allLogs.push({
                    hash: log.transactionHash,
                    action: action,
                    amount: parseFloat(formatEther(tokenAmount as bigint)).toFixed(2),
                    price: parseFloat(formatEther(log.args.newPrice as bigint)).toFixed(2),
                    assetName: name,
                    time: "Just now"
                });
            });
        }

        setActivities(allLogs.reverse().slice(0, 5)); 

      } catch (e) {
        console.error("Activity fetch error:", e);
      }
    }

    fetchGlobalActivity();
    
    const interval = setInterval(fetchGlobalActivity, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-full">
        <h3 className="text-gray-400 text-sm font-bold mb-4 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live Platform Trades
        </h3>
        
        <div className="space-y-4">
            {activities.length === 0 ? (
                <div className="text-gray-600 text-sm text-center py-4">No recent activity</div>
            ) : (
                activities.map((act) => (
                    <div key={act.hash} className="flex justify-between items-center border-b border-zinc-800 pb-3 last:border-0">
                        <div>
                            <div className="text-sm font-bold text-white">
                                {act.action === "BUY" ? (
                                    <span className="text-green-400">Bought</span>
                                ) : (
                                    <span className="text-red-400">Sold</span>
                                )} 
                                <span className="mx-1">{act.amount}</span>
                                <span className="text-gray-400">{act.assetName}</span>
                            </div>
                            <div className="text-xs text-zinc-500">Price: ${act.price}</div>
                        </div>
                        <a 
                            href={`https://etherscan.io/tx/${act.hash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:text-blue-400"
                        >
                            View ↗
                        </a>
                    </div>
                ))
            )}
        </div>
    </div>
  );
}