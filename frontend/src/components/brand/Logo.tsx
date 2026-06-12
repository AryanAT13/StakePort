import { SVGProps } from 'react';

/**
 * StakePort brand mark.
 *
 * Concept: three concentric rotated squares (diamonds). The outermost stroke
 * is the market — diffuse, thin. The middle stroke is the listing — defined.
 * The solid core is the asset itself. Together they read as "layered value"
 * or "vault" — financial seal energy without the cliché crypto coin or
 * stylized blockchain hexagon.
 *
 * The mark scales cleanly from 12px (favicon) up to 256px (brand hero) on
 * 1.1–1.4 stroke widths.
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
      {/* Outer ring — the market */}
      <path
        d="M12 1.5 L22.5 12 L12 22.5 L1.5 12 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
        opacity="0.34"
      />
      {/* Middle ring — the listing */}
      <path
        d="M12 5.4 L18.6 12 L12 18.6 L5.4 12 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.68"
      />
      {/* Core — the asset */}
      <path d="M12 9 L15 12 L12 15 L9 12 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Mark + wordmark lockup. The default size lands close to the 14–16px
 * cap-height of body text, so it composes cleanly inside navs.
 */
export function LogoLockup({
  className = '',
  markClassName = 'w-[18px] h-[18px] text-white',
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
