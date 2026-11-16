/**
 * The stat chip row above the level-up cards. Before a pick the chips show the scrapper as it
 * stands; while a stat card is lifted they preview what it would change; once a card is taken
 * they read the live record, so the numbers always agree with the stamped card (review r2).
 */
import type { CoreApi, FighterSnapshot, RouteCard, StatKey } from "@rankzero/core";
import { STAT_KEYS } from "../../text/stats";

export interface ChipSource { maxHp: number; effective: Record<StatKey, number> }
export interface Chip { key: "maxHp" | StatKey; from: number; to: number; changed: boolean }

/** The scrapper one level up with the card's stat points added; null for a perk card. */
export function previewSheet(core: CoreApi, snap: FighterSnapshot, card: RouteCard | null): ChipSource | null {
  if (!card || card.kind === "perk") return null;
  const points = { ...snap.stats.points };
  if (card.kind === "stat") points[card.stat] += card.amount;
  else for (const k of card.stats) points[k] += 1;
  return core.snapshotSheet({ ...snap, level: snap.level + 1, stats: { points, mult: snap.stats.mult } });
}

/** Max HP first, then the stats, each with its value before and after (after = before when nothing moves). */
export function chipRow(before: ChipSource, after: ChipSource | null): Chip[] {
  const to = after ?? before;
  const row: Chip[] = [{ key: "maxHp", from: before.maxHp, to: to.maxHp, changed: to.maxHp !== before.maxHp }];
  for (const k of STAT_KEYS) row.push({ key: k, from: before.effective[k], to: to.effective[k], changed: to.effective[k] !== before.effective[k] });
  return row;
}
