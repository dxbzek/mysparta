/** Draws an `SvgArt` from the rig (portraits, icons) as inline SVG. */
import type { SvgArt } from "@rankzero/rig";

export function SvgArtView({ art, size, label, className }: { art: SvgArt; size: number; label?: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={art.viewBox}
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {art.parts.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          transform={p.transform}
        />
      ))}
    </svg>
  );
}
