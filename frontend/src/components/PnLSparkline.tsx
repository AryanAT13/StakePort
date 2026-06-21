'use client';

import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { formatCompactUsd } from '@/lib/format';

/**
 * P&L sparkline — fed by the trades the user has indexed via /api/trades.
 *
 * Each data point is taken at the moment of a trade (we don't have a
 * server-side price feed to interpolate between events). The line draws
 * the running portfolio value computed at each trade — holdings × the most
 * recent priceAfter for each asset, summed.
 *
 * Stroke / fill flip colour based on the sign of the journey (start → end).
 * Tooltip is dense but minimal: timestamp + value, no axis ticks.
 */

export type Point = { t: number; value: number; pnl: number };

export default function PnLSparkline({
  points,
  height = 96,
}: {
  points: Point[];
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div className="h-24 flex items-center justify-center text-[10px] text-zinc-600 uppercase tracking-[0.18em]">
        Trade a few times to populate
      </div>
    );
  }

  const startPnl = points[0]!.pnl;
  const endPnl = points[points.length - 1]!.pnl;
  const positive = endPnl >= startPnl;
  const stroke = positive ? '#34d399' : '#f87171';
  const fillId = positive ? 'pnl-spark-gain' : 'pnl-spark-loss';

  return (
    <div className="-mx-1" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="pnl-spark-gain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pnl-spark-loss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            contentStyle={{
              background: '#0a0a0a',
              border: '1px solid #27272a',
              borderRadius: 8,
              fontSize: 11,
              padding: '6px 8px',
            }}
            labelStyle={{ display: 'none' }}
            formatter={(value) => [
              typeof value === 'number' ? formatCompactUsd(value) : '—',
              'P&L',
            ]}
            cursor={{ stroke: '#27272a', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke={stroke}
            strokeWidth={1.6}
            fill={`url(#${fillId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
