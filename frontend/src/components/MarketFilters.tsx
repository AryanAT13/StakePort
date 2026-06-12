'use client';

import { Search } from 'lucide-react';

/**
 * Filter / search / sort bar that sits above the markets grid.
 *
 * Controlled component — the page owns the state. Visually: a single line on
 * desktop (tabs · search · sort) that wraps to two on mobile. Pill-style
 * everywhere so it composes with the rest of the dashboard's rounded UI.
 */

export type CategoryKey = 'all' | 'LUXURY_GOODS' | 'VEHICLE' | 'REAL_ESTATE' | 'GENERAL';
export type SortKey = 'recent' | 'name-asc' | 'valuation-desc';

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'LUXURY_GOODS', label: 'Luxury' },
  { key: 'VEHICLE', label: 'Vehicles' },
  { key: 'REAL_ESTATE', label: 'Real Estate' },
  { key: 'GENERAL', label: 'Other' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Most Recent' },
  { key: 'name-asc', label: 'Name A→Z' },
  { key: 'valuation-desc', label: 'Top Valuation' },
];

type Props = {
  category: CategoryKey;
  onCategoryChange: (c: CategoryKey) => void;
  search: string;
  onSearchChange: (s: string) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  totalCount: number;
  filteredCount: number;
};

export default function MarketFilters({
  category, onCategoryChange,
  search, onSearchChange,
  sort, onSortChange,
  totalCount, filteredCount,
}: Props) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Category tabs */}
        <div className="flex gap-1 bg-zinc-950 border border-zinc-900 rounded-full p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => onCategoryChange(c.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                category === c.key
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search assets…"
            className="w-full bg-zinc-950 border border-zinc-900 rounded-full pl-10 pr-4 py-2 text-sm placeholder:text-zinc-600 focus:border-zinc-700 outline-none transition"
          />
        </div>

        {/* Sort — kept as native select for a11y + zero-bundle dropdown.
            Styled to match the rest of the bar; the chevron is browser-default. */}
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="bg-zinc-950 border border-zinc-900 rounded-full px-4 py-2 text-sm text-zinc-300 focus:border-zinc-700 outline-none cursor-pointer hover:border-zinc-800 transition"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key} className="bg-black">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Result count — quiet, supports the filter UX without dominating. */}
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600 mt-4">
        {filteredCount === totalCount
          ? `${totalCount} market${totalCount === 1 ? '' : 's'}`
          : `${filteredCount} of ${totalCount} markets`}
      </p>
    </div>
  );
}
