'use client';

/**
 * Per-page accent atmosphere.
 *
 * The body already paints the global aurora + grid. Each inner page gets
 * an additional fixed accent layer keyed by its "tone" — markets is cyan
 * (active trading), portfolio is emerald (positions / gains), dashboard
 * is violet (account / settings). Subtle enough that the three sections
 * read as one product, distinct enough to feel intentional.
 *
 * Rendered as a fixed sibling of the page main so it never affects
 * layout or scroll. Pointer-events off — pure decoration.
 */

type Tone = 'cyan' | 'emerald' | 'violet';

const TONES: Record<Tone, { top: string; bottom: string }> = {
  cyan: {
    top: 'rgba(34, 211, 238, 0.10)',   // top-left accent
    bottom: 'rgba(59, 130, 246, 0.07)', // bottom-right echo
  },
  emerald: {
    top: 'rgba(52, 211, 153, 0.10)',
    bottom: 'rgba(20, 184, 166, 0.06)',
  },
  violet: {
    top: 'rgba(167, 139, 250, 0.09)',
    bottom: 'rgba(124, 58, 237, 0.06)',
  },
};

export default function PageAtmosphere({ tone }: { tone: Tone }) {
  const t = TONES[tone];
  return (
    <>
      {/* Top-left soft glow + bottom-right echo. Fixed so the wash doesn't
          jitter on scroll. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 12% -10%, ${t.top}, transparent 65%),
            radial-gradient(ellipse 60% 45% at 88% 110%, ${t.bottom}, transparent 65%)
          `,
        }}
      />
      {/* Thin scan-line texture — adds a "data terminal" tactile feel.
          Masked from centre so it never crowds the foreground. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.045]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 3px)',
          maskImage:
            'radial-gradient(ellipse 85% 65% at 50% 50%, black 0%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 85% 65% at 50% 50%, black 0%, transparent 75%)',
        }}
      />
    </>
  );
}
