'use client';

// Markets dashboard.
//
// Phase 4 additions:
//   - Filter bar (category tabs, search, sort) over the grid.
//   - DB-cached enriched metadata (category, fair value) joined to the
//     on-chain asset list via the new /api/markets endpoint.
//   - Batch reads (useReadContracts) for names + valuations so search and
//     valuation-sort don't need every card to call back into the parent.
//   - Empty / no-match / loading states.
//
// Auth gate is session-driven (Phase 3 bug fix): if the SIWE cookie says
// you're signed in and onboarded, we render — independent of wagmi's
// reconnect race after a hard refresh.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { formatEther } from 'viem';
import { Plus } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AssetCard from '@/components/AssetCard';
import MarketPulse from '@/components/MarketPulse';
import PortfolioValue from '@/components/PortfolioValue';
import RecentActivity from '@/components/RecentActivity';
import AddFundsModal from '@/components/AddFundsModal';
import MarketFilters, { CategoryKey, SortKey } from '@/components/MarketFilters';
import PageAtmosphere from '@/components/PageAtmosphere';
import { useSession } from '@/hooks/useSession';
import {
  MOCK_USDC_ADDRESS,
  ERC20_ABI,
  ASSET_FACTORY_ADDRESS,
  ASSET_FACTORY_ABI,
  REAL_WORLD_ASSET_ABI,
} from '@/constants/contracts';

type MarketMeta = {
  contractAddress: string;
  name: string;
  symbol?: string | null;
  fairValue?: number | null;
  fairValueCategory?: string | null;
};

export default function MarketsPage() {
  const { address, isConnected } = useAccount();
  const { user, loading: sessionLoading, resolved: sessionResolved } = useSession();
  const router = useRouter();
  const [addFundsOpen, setAddFundsOpen] = useState(false);

  // ---- Auth gate ---------------------------------------------------------
  // Phase 8.3 routing fix.
  //
  // The previous gate redirected anyone without a session straight to `/`.
  // That's wrong for the most common case — a first-time visitor who just
  // clicked "Open Terminal" has a wallet but no session yet. Sending them
  // to / makes the button look broken (they bounce back to where they
  // started).
  //
  // Correct destinations:
  //   wallet connected, no session   → /onboarding (it owns SIWE + profile)
  //   no wallet                      → /           (need to connect first)
  //   session + onboarded            → render this page
  //   session + NOT onboarded        → /onboarding
  useEffect(() => {
    if (sessionLoading || !sessionResolved) return;
    if (!user) {
      router.replace(isConnected ? '/onboarding' : '/');
      return;
    }
    if (!user.onboarded) router.replace('/onboarding');
  }, [sessionLoading, sessionResolved, user, isConnected, router]);

  // ---- KPI data ---------------------------------------------------------
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  });

  const { data: assetList } = useReadContract({
    address: ASSET_FACTORY_ADDRESS,
    abi: ASSET_FACTORY_ABI,
    functionName: 'getDeployedAssets',
  });

  const balance = balanceData ? parseFloat(formatEther(balanceData as bigint)) : 0;
  const assets = useMemo(() => (assetList as `0x${string}`[] | undefined) ?? [], [assetList]);

  // ---- Batch reads for filter/sort --------------------------------------
  // Pulled into the parent so we can sort by name / valuation without
  // round-tripping through each AssetCard. wagmi shares the cache key with
  // the cards, so this isn't an extra network call — same multicall.
  //
  // CRITICAL: the contracts arrays MUST be memoised on `[assets]`. wagmi
  // uses the contracts reference as part of its React Query key; passing
  // `assets.map(...)` inline rebuilds the array every render → wagmi
  // observes a "new" query → resubscribes → triggers re-render to expose
  // the fresh loading state → new array again → infinite render loop
  // (and the saturated RPC traffic that comes with it).
  const nameContracts = useMemo(
    () => assets.map((addr) => ({
      address: addr,
      abi: REAL_WORLD_ASSET_ABI,
      functionName: 'assetName' as const,
    })),
    [assets]
  );
  const valuationContracts = useMemo(
    () => assets.map((addr) => ({
      address: addr,
      abi: REAL_WORLD_ASSET_ABI,
      functionName: 'valuation' as const,
    })),
    [assets]
  );

  const { data: nameResults } = useReadContracts({
    contracts: nameContracts,
    query: { enabled: assets.length > 0 },
  });
  const { data: valuationResults } = useReadContracts({
    contracts: valuationContracts,
    query: { enabled: assets.length > 0 },
  });

  // ---- Enriched metadata from the DB ------------------------------------
  const [metaByAddress, setMetaByAddress] = useState<Record<string, MarketMeta>>({});
  useEffect(() => {
    let cancelled = false;
    fetch('/api/markets')
      .then((r) => r.json())
      .then((j: { items: MarketMeta[] }) => {
        if (cancelled) return;
        const map: Record<string, MarketMeta> = {};
        for (const m of j.items) map[m.contractAddress.toLowerCase()] = m;
        setMetaByAddress(map);
      })
      .catch(() => {/* DB miss is non-fatal; cards render with on-chain only */});
    return () => { cancelled = true; };
  }, []);

  // ---- Filter state -----------------------------------------------------
  const [category, setCategory] = useState<CategoryKey>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  // ---- Compose, filter, sort -------------------------------------------
  const enriched = useMemo(() => {
    return assets.map((addr, i) => {
      const name = (nameResults?.[i]?.result as string | undefined) ?? '';
      const valuation = (valuationResults?.[i]?.result as bigint | undefined) ?? 0n;
      const meta = metaByAddress[addr.toLowerCase()];
      return { addr, name, valuation, meta };
    });
  }, [assets, nameResults, valuationResults, metaByAddress]);

  const visible = useMemo(() => {
    let arr = enriched;
    if (category !== 'all') {
      arr = arr.filter((a) => a.meta?.fairValueCategory === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((a) => a.name.toLowerCase().includes(q));
    }
    // We mutate a shallow copy below, never the memoized source.
    const sorted = [...arr];
    if (sort === 'name-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'valuation-desc') {
      sorted.sort((a, b) => (b.valuation > a.valuation ? 1 : b.valuation < a.valuation ? -1 : 0));
    } else {
      // "recent" — factory pushes new assets to the end, so reverse.
      sorted.reverse();
    }
    return sorted;
  }, [enriched, category, search, sort]);

  // ---- Render gate ------------------------------------------------------
  if (sessionLoading || !sessionResolved || !user || !user.onboarded) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xs text-zinc-500 uppercase tracking-[0.22em]">Authenticating…</p>
      </main>
    );
  }

  const showSkeleton = !assetList;
  const noResults = !showSkeleton && assets.length > 0 && visible.length === 0;
  const noAssetsAtAll = !showSkeleton && assets.length === 0;

  return (
    <main className="relative min-h-screen text-white">
      <PageAtmosphere tone="cyan" />
      <Navbar />
      <MarketPulse />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10 md:py-12">
        {/* Greeting + page CTA */}
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <p className="eyebrow mb-2">
              Welcome back{user.displayName ? `, ${user.displayName}` : ''}
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em]">Markets</h1>
          </div>
          <button
            onClick={() => setAddFundsOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-800 hover:border-zinc-600 text-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Funds
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">
              Portfolio Value
            </p>
            <PortfolioValue assetList={assets} />
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">
              Cash Balance
            </p>
            <p className="text-3xl font-mono font-semibold tracking-tight">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2.5">
              Live Markets
            </p>
            <p className="text-3xl font-semibold tracking-tight">{assets.length}</p>
          </div>
        </div>

        {/* Grid + activity sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <MarketFilters
              category={category}
              onCategoryChange={setCategory}
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
              totalCount={assets.length}
              filteredCount={visible.length}
            />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {showSkeleton &&
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden animate-pulse">
                    <div className="aspect-square bg-zinc-900" />
                    <div className="p-4 space-y-2.5">
                      <div className="h-3 bg-zinc-900 rounded w-3/4" />
                      <div className="h-3 bg-zinc-900 rounded w-1/2" />
                      <div className="h-3 bg-zinc-900 rounded w-1/3 mt-3" />
                    </div>
                  </div>
                ))}

              {noAssetsAtAll && (
                <div className="col-span-full text-center py-16 border border-dashed border-zinc-900 rounded-xl">
                  <p className="text-zinc-400 mb-2">No assets listed yet.</p>
                  <p className="text-xs text-zinc-600">Be the first — list one from the top right.</p>
                </div>
              )}

              {noResults && (
                <div className="col-span-full text-center py-16 border border-dashed border-zinc-900 rounded-xl">
                  <p className="text-zinc-400 mb-1">Nothing matches.</p>
                  <p className="text-xs text-zinc-600">Try clearing your filters or search.</p>
                </div>
              )}

              {visible.map((a) => (
                <AssetCard key={a.addr} assetAddress={a.addr} meta={a.meta} />
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <RecentActivity />
          </div>
        </div>
      </div>

      <AddFundsModal
        open={addFundsOpen}
        onClose={() => setAddFundsOpen(false)}
        onMinted={() => setTimeout(() => refetchBalance(), 1500)}
      />
    </main>
  );
}
