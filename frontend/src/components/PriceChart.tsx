'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, AreaSeries, Time } from 'lightweight-charts';
import { parseAbiItem, formatEther } from 'viem';
import { getClientPublicClient } from '@/lib/clientChain';

// Shared singleton — was previously a per-component client hard-pinned to
// hardhat, which broke as soon as we pointed the app at any other chain.
const publicClient = getClientPublicClient();

export default function PriceChart({ assetAddress }: { assetAddress: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartData, setChartData] = useState<{ time: Time, value: number }[]>([]);

  // 1. Fetch Data (Same as before)
  useEffect(() => {
    async function fetchHistory() {
      if (!assetAddress) return;
      try {
        const logs = await publicClient.getLogs({
            address: assetAddress as `0x${string}`,
            event: parseAbiItem('event Traded(address indexed user, string action, uint256 amountIn, uint256 amountOut, uint256 newPrice)'),
            fromBlock: 'earliest',
            toBlock: 'latest'
        });

        // Fetch real block timestamps for each trade
        const formattedData = await Promise.all(logs.map(async (log) => {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber as bigint });
            return {
                time: Number(block.timestamp), // Real UNIX timestamp
                value: parseFloat(formatEther(log.args.newPrice as bigint))
            };
        }));

        // Deduplicate exact same-second timestamps (required by the chart library)
        let lastTime = 0;
        const finalData = formattedData
            .sort((a, b) => a.time - b.time)
            .map(d => {
                let t = d.time;
                if (t <= lastTime) t = lastTime + 1; 
                lastTime = t;
                return { time: t as Time, value: d.value };
            });

        if (finalData.length === 0) {
            // Fix the initial $50 flatline by using the current block time
            const currentBlock = await publicClient.getBlock({ blockTag: 'latest' });
            setChartData([{ time: Number(currentBlock.timestamp) as Time, value: 50 }]);
        } else {
            setChartData(finalData);
        }
      } catch (e) { console.error(e); }
    }
    fetchHistory();
  }, [assetAddress]);

  // 2. Render Chart (Updated for v5.0)
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#D4D4D8' },
      grid: { vertLines: { color: '#27272A' }, horzLines: { color: '#27272A' } },
      width: chartContainerRef.current.clientWidth,
      height: 300,
    });

    // FIX: Use addSeries(AreaSeries, options) instead of addAreaSeries(options)
    const newSeries = chart.addSeries(AreaSeries, {
      lineColor: '#22c55e', 
      topColor: 'rgba(34, 197, 94, 0.4)',
      bottomColor: 'rgba(34, 197, 94, 0)', 
      lineWidth: 2,
    });

    newSeries.setData(chartData);
    chart.timeScale().fitContent();

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartData]);

  return <div ref={chartContainerRef} className="w-full h-[300px]" />;
}