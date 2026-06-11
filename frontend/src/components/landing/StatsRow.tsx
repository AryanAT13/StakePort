'use client';

import { useReadContract } from 'wagmi';
import { ASSET_FACTORY_ADDRESS, ASSET_FACTORY_ABI } from '@/constants/contracts';
import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { publicEnv } from '@/lib/env';

/**
 * Live, on-chain headline numbers. Animates the count-up on scroll into view
 * (one-shot per page load) — that's the bit that makes the section feel
 * "alive" rather than another static brag block.
 *
 * We intentionally keep this lightweight: one RPC call for the asset count,
 * everything else is composed/static. Deep per-asset stats live in /markets.
 */

function useCountUp(to: number, duration = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // ease-out-cubic — fast then settle, matches the "kicker" feel.
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return v;
}

function Stat({
  label,
  value,
  suffix = '',
  prefix = '',
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });
  const displayed = useCountUp(inView ? value : 0);
  return (
    <div ref={ref} className="text-center">
      <div className="text-5xl md:text-6xl font-bold tracking-tighter font-mono">
        {prefix}
        {displayed.toLocaleString()}
        {suffix}
      </div>
      <div className="mt-3 text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</div>
    </div>
  );
}

const CHAIN_NAMES: Record<number, string> = {
  31337: 'Hardhat',
  11155111: 'Sepolia',
  137: 'Polygon',
  1: 'Mainnet',
  8453: 'Base',
};

export default function StatsRow() {
  const { data: assetList } = useReadContract({
    address: ASSET_FACTORY_ADDRESS,
    abi: ASSET_FACTORY_ABI,
    functionName: 'getDeployedAssets',
  });

  const assetsListed = assetList ? (assetList as `0x${string}`[]).length : 0;
  const chainName = CHAIN_NAMES[publicEnv.chainId] ?? `Chain ${publicEnv.chainId}`;

  return (
    <section id="stats" className="relative py-20 border-y border-zinc-900">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6"
        >
          <Stat label="Assets Listed" value={assetsListed} suffix="+" />
          <Stat label="Premium Required" value={25} suffix="%" />
          <Stat label="Live Markets" value={24} suffix="/7" />
          <div className="text-center">
            <div className="text-5xl md:text-6xl font-bold tracking-tighter font-mono">{chainName}</div>
            <div className="mt-3 text-xs uppercase tracking-[0.2em] text-zinc-500">Network</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
