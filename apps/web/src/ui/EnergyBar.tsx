/**
 * The energy bar (content v3, plan 13.9): one cell per point, filled cells in hazard yellow with
 * the ink outline and hard shadow of the house style, a drawn bolt (never an emoji), "4 / 6" in
 * words and numbers, and the countdown to the next point. Props only: the screen that shows it
 * reads the record and the clock and hands in the numbers, so the debug sheet can show any state.
 */
import css from "./EnergyBar.module.css";

export interface EnergyBarProps {
  value: number;
  max: number;
  /** Milliseconds to the next point, or null when the bar is full. */
  nextMs: number | null;
  /** "dark" on the asphalt bands (the Tonight's Card header), "paper" on a light panel. */
  tone?: "paper" | "dark";
  compact?: boolean;
  label?: string;
  /** Words: "Full", "+1 in 12:04". */
  text?: { full: string; next(clock: string): string };
}

const pad = (n: number): string => String(n).padStart(2, "0");
/** "19:59", "1:00:00": minutes and seconds, rounded up, so it never says 0:00 before the point comes. */
export function clockOf(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export const ENERGY_TEXT = { full: "Full", next: (c: string) => `+1 in ${c}` };

export function EnergyBar({ value, max, nextMs, tone = "paper", compact = false, label = "Energy", text = ENERGY_TEXT }: EnergyBarProps) {
  const cells = Array.from({ length: max }, (_, i) => i < value);
  const status = nextMs === null ? text.full : text.next(clockOf(nextMs));
  return (
    <div className={`${css.bar} ${css[tone]} ${compact ? css.compact : ""}`} role="group" aria-label={`${label}: ${value} of ${max}. ${status}`}
      data-energy={value}>
      <span className={css.bolt} aria-hidden="true"><BoltGlyph /></span>
      <span className={css.name} aria-hidden="true">{label}</span>
      <span className={css.cells} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        {cells.map((on, i) => <span key={i} className={`${css.cell} ${on ? css.on : ""}`} />)}
      </span>
      <span className={css.count} aria-hidden="true">{value} / {max}</span>
      <span className={`${css.next} ${nextMs === null ? css.full : ""}`} aria-hidden="true">{status}</span>
    </div>
  );
}

/** A jagged bolt in the house's flat-with-ink look; currentColor fill. */
export function BoltGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M14.6 1.8 4.6 13.6h6.2L8.6 22.2l10.6-12.6h-6.4l1.8-7.8Z" fill="currentColor" stroke="var(--c-ink)" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
