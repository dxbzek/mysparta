/**
 * A perk (or fists) drawn from the rig's icon art, on a small asphalt tile so every icon reads
 * on paper and on the dark bands alike. The name is always given as the accessible label.
 */
import type { PerkId } from "@rankzero/core";
import { RARITY_OF } from "@rankzero/core";
import { rig } from "../seams/rig";
import { NAMES } from "../text/names";
import { SvgArtView } from "./SvgArt";
import css from "./PerkIcon.module.css";

export interface PerkIconProps {
  id: PerkId | "fists";
  size?: 20 | 28 | 44 | 64;
  /** Show the rarity tab (Kit, cards). Off in the bag strip, where the icon is 20 px. */
  rarity?: boolean;
  /** Uses left of a Move, shown as a small badge when above 1. */
  uses?: number;
  className?: string;
}

export function PerkIcon({ id, size = 44, rarity = false, uses, className }: PerkIconProps) {
  const name = NAMES[id];
  const art = rig.icon(id);
  const r = id === "fists" ? null : RARITY_OF[id];
  return (
    <span className={[css.tile, css[`s${size}`], className ?? ""].filter(Boolean).join(" ")} role="img" aria-label={uses && uses > 1 ? `${name}, ${uses} uses` : name} title={name}>
      <SvgArtView art={art} size={Math.round(size * 0.78)} />
      {rarity && r ? <span className={`${css.rarity} ${css[r]}`} aria-hidden="true" /> : null}
      {uses !== undefined && uses > 1 ? <span className={css.uses} aria-hidden="true">{uses}</span> : null}
    </span>
  );
}
