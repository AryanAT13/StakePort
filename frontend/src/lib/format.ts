/**
 * Tiny formatting helpers shared by the dashboard / market cards.
 * Pulled out so the same money string is rendered the same everywhere.
 */

/** $52,431.12 → "$52.4k", 1,200,000 → "$1.2M". Useful inside tight chips. */
export function formatCompactUsd(n: number, opts: { withSign?: boolean } = {}): string {
  const sign = opts.withSign && n > 0 ? '+' : '';
  const abs = Math.abs(n);
  let body: string;
  if (abs >= 1_000_000_000) body = `${(n / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) body = `${(n / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) body = `${(n / 1_000).toFixed(2)}k`;
  else body = n.toFixed(2);
  return `${sign}$${body}`;
}

/** Maps the AI engine's category enum to a human label. */
export function categoryLabel(category: string | null | undefined): string {
  switch (category) {
    case 'LUXURY_GOODS': return 'Luxury Goods';
    case 'VEHICLE': return 'Vehicle';
    case 'REAL_ESTATE': return 'Real Estate';
    case 'GENERAL': return 'Other';
    default: return '';
  }
}
