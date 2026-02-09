'use client';

import { useEffect, useState } from 'react';
import { createPublicClient, http, parseAbiItem, formatEther } from 'viem';
import { hardhat } from 'viem/chains';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Setup a client to fetch events
const publicClient = createPublicClient({
  chain: hardhat,
  transport: http()
});

export default function PriceChart({ assetAddress }: { assetAddress: string }) {
  const [data, setData] = useState<{ time: string, price: number }[]>([]);

  useEffect(() => {
    async function fetchHistory() {
      if (!assetAddress) return;

      try {
        // 1. Fetch "Traded" events from the blockchain
        const logs = await publicClient.getLogs({
            address: assetAddress as `0x${string}`,
            event: parseAbiItem('event Traded(address indexed user, string action, uint256 amountIn, uint256 amountOut, uint256 newPrice)'),
            fromBlock: 'earliest',
            toBlock: 'latest'
        });

        // 2. Format the data for the Chart
        const chartData = logs.map((log, index) => {
            return {
                time: `Trade #${index + 1}`,
                // Parse the BigInt price to a readable number
                price: parseFloat(formatEther(log.args.newPrice as bigint))
            };
        });

        if (chartData.length === 0) {
            setData([{ time: 'IPO', price: 50 }]); 
        } else {
            setData(chartData);
        }
      } catch (e) {
          console.error("Error fetching chart data:", e);
      }
    }

    fetchHistory();
  }, [assetAddress]);

  return (
    <div className="h-64 w-full bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 mt-8">
        <h3 className="text-gray-400 text-sm font-bold mb-4">Price History</h3>
        <div style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#000', borderColor: '#333' }}
                        itemStyle={{ color: '#4ade80' }}
                        // FIX: Changed 'number' to 'any' to satisfy TypeScript strict mode
                        formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, 'Price']}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#4ade80" 
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                        strokeWidth={3}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
}