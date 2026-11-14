/**
 * One stat as icon + name + bar + number. Colour is never the only signal (brief 3.15): every
 * row has its icon and its name in words.
 */
import type { StatKey } from "@rankzero/core";
import { rig } from "../seams/rig";
import { SvgArtView } from "./SvgArt";
import css from "./StatBar.module.css";

export const STAT_LABEL: Readonly<Record<StatKey, string>> = {
  health: "Health",
  strength: "Strength",
  agility: "Agility",
  speed: "Speed",
};

export interface StatBarProps {
  stat: StatKey;
  value: number;
  /** The value that fills the bar. */
  max: number;
  label?: string;
}

export function StatBar({ stat, value, max, label }: StatBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const name = label ?? STAT_LABEL[stat];
  return (
    <div className={css.row} role="group" aria-label={`${name} ${value}`}>
      <span className={css.icon}>
        <SvgArtView art={rig.icon(`stat:${stat}`)} size={18} />
      </span>
      <span className={css.name}>{name}</span>
      <span className={css.track} aria-hidden="true">
        <span className={`${css.fill} ${css[stat]}`} style={{ width: `${(pct * 100).toFixed(1)}%` }} />
      </span>
      <span className={css.value}>{value}</span>
    </div>
  );
}
