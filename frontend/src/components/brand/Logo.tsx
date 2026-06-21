import { SVGProps } from 'react';

/**
 * StakePort brand mark — v2 (Phase 8).
 *
 * The previous concentric-diamond was reading too generic-crypto. This mark
 * is three offset slabs ascending diagonally — a stylised "stake" pile
 * climbing into a port. Asymmetric on purpose (no centre symmetry) so it
 * doesn't fall into the geometric-glyph cliché. Bottom slab is lowest
 * opacity, top is full — gives the eye a clear directional read.
 *
 * Scales clean from 12px favicon to 256px brand hero on a 1.1–1.4 stroke /
 * fill spread.
 */
export function LogoMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Bottom slab — base of the stack */}
      <rect x="2" y="15.5" width="9" height="2.6" rx="0.6" fill="currentColor" opacity="0.32" />
      {/* Middle slab — offset right, slightly wider */}
      <rect x="6.5" y="10.8" width="11" height="2.6" rx="0.6" fill="currentColor" opacity="0.62" />
      {/* Top slab — fully opaque, anchors the eye */}
      <rect x="12" y="6" width="10" height="2.6" rx="0.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Mark + wordmark lockup. The default mark size lands close to the
 * cap-height of 15px body text, so it composes inside navs without
 * looking like a stickered logo.
 */
export function LogoLockup({
  className = '',
  markClassName = 'w-[20px] h-[20px] text-white',
  wordmarkClassName = 'text-[15px] font-semibold tracking-[-0.012em] text-white',
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      <span className={wordmarkClassName}>StakePort</span>
    </span>
  );
}
