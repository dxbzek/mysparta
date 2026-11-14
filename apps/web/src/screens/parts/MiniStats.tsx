/** Compact stat rows for the rival cards and the face-off sheet: icon, name in words, bar, number. */
import type { StatKey } from "@rankzero/core";
import { rig } from "../../seams/rig";
import { STAT_NAME } from "../../text/stats";
import { SvgArtView } from "../../ui/SvgArt";
import css from "./mini.module.css";

const short: Readonly<Record<StatKey, string>> = { health: "HP", strength: "STR", agility: "AGI", speed: "SPD" };

export function StatIconDot({ stat, size = 18 }: { stat: StatKey; size?: number }) {
  return <span className={`${css.dot} ${css[stat]}`} style={{ width: size, height: size }}><SvgArtView art={rig.icon(`stat:${stat}`)} size={Math.round(size * 0.7)} /></span>;
}

export function MiniStat({ stat, value, max }: { stat: StatKey; value: number; max: number }) {
  const pct = max > 0 ? Math.max(0.04, Math.min(1, value / max)) : 0;
  return (
    <div className={css.mini} role="group" aria-label={`${STAT_NAME[stat]} ${value}`}>
      <StatIconDot stat={stat} />
      <span className={css.miniName} aria-hidden="true">{short[stat]}</span>
      <span className={css.track} aria-hidden="true"><span className={`${css.fill} ${css[`f-${stat}`]}`} style={{ width: `${(pct * 100).toFixed(1)}%` }} /></span>
      <span className={css.miniValue} aria-hidden="true">{value}</span>
    </div>
  );
}

/** One stat compared: mine on the left, theirs on the right, bars growing out from the middle. */
export function CompareStat({ label, stat, mine, theirs, max }: { label: string; stat?: StatKey; mine: number; theirs: number; max: number }) {
  const w = (v: number): string => `${((max > 0 ? Math.min(1, v / max) : 0) * 100).toFixed(1)}%`;
  const lead = mine === theirs ? 0 : mine > theirs ? -1 : 1;
  return (
    <div className={css.compare} role="group" aria-label={`${label}: ${mine} against ${theirs}`}>
      <span className={`${css.cmpValue} ${lead < 0 ? css.lead : ""}`} aria-hidden="true">{mine}</span>
      <span className={`${css.cmpTrack} ${css.cmpLeft}`} aria-hidden="true"><span className={`${css.fill} ${stat ? css[`f-${stat}`] : css.fHp}`} style={{ width: w(mine) }} /></span>
      <span className={css.cmpLabel} aria-hidden="true">{stat ? <StatIconDot stat={stat} size={20} /> : null}{label}</span>
      <span className={css.cmpTrack} aria-hidden="true"><span className={`${css.fill} ${stat ? css[`f-${stat}`] : css.fHp}`} style={{ width: w(theirs) }} /></span>
      <span className={`${css.cmpValue} ${lead > 0 ? css.lead : ""}`} aria-hidden="true">{theirs}</span>
    </div>
  );
}
