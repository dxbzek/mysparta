/**
 * A slapped-on label, rotated 1 to 2 degrees. `slap` (0 to 1) is how far it has landed: the
 * caller hands it a value from a clock (the fight HUD's `namesIn`), so the sticker never runs
 * an animation of its own.
 */
import type { CSSProperties, ReactNode } from "react";
import css from "./Sticker.module.css";

export interface StickerProps {
  tone?: "paper" | "hazard" | "action" | "win" | "loss";
  size?: "small" | "normal" | "big";
  /** Degrees; the house look is -2 to 2. */
  tilt?: number;
  /** 0 = not there yet, 1 = landed. Undefined = landed. */
  slap?: number;
  className?: string;
  title?: string;
  children: ReactNode;
}

/** Scale and opacity for a sticker landing: it drops in big and flat, then sits. Pure. */
export function slapStyle(slap: number, tilt: number): CSSProperties {
  const u = slap < 0 ? 0 : slap > 1 ? 1 : slap;
  if (u >= 1) return { transform: `rotate(${tilt}deg)` };
  const e = 1 - (1 - u) * (1 - u);
  const scale = 1.6 - 0.6 * e;
  return { transform: `rotate(${tilt * e}deg) scale(${scale.toFixed(3)})`, opacity: u === 0 ? 0 : Math.min(1, u * 2.5) };
}

export function Sticker({ tone = "paper", size = "normal", tilt = -1.5, slap, className, title, children }: StickerProps) {
  const cls = [css.sticker, css[tone], size === "normal" ? "" : css[size], className ?? ""].filter(Boolean).join(" ");
  return (
    <span className={cls} style={slapStyle(slap ?? 1, tilt)} title={title}>
      {children}
    </span>
  );
}
