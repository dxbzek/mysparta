/**
 * Stats (work package 1): the starting deal, effective values, max HP, boosters and stat cards.
 * Whole-number maths only.
 */
import type { PerkId, SkillId } from "../contracts/ids";
import type { RouteCard, StatBlock, StatKey } from "../contracts/fighter";
import { combineSeed, makeRng } from "../prng";
import { COMPANIONS } from "../content/companions";
import { sk } from "../content/skills";

/** The six stats, in the order the screens and the Route use (content v3 added the last two). */
export const STAT_KEYS: readonly StatKey[] = ["health", "strength", "agility", "speed", "toughness", "precision"];
export const START_EACH = 2;
/** Points dealt on top of START_EACH: a starting budget of 20 (14 with four stats before content v3). */
export const START_DEALT = 8;
export const START_MAX = 5;
/** A multiplier block of 100 for every stat. */
export function plainMult(): Record<StatKey, number> {
  return { health: 100, strength: 100, agility: 100, speed: 100, toughness: 100, precision: 100 };
}

/** Mutable copy used while a kit is built. */
export interface StatsDraft { points: Record<StatKey, number>; mult: Record<StatKey, number> }

export function draftOf(s: StatBlock): StatsDraft {
  const points = { ...s.points } as Record<StatKey, number>;
  const mult = { ...s.mult } as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    if (typeof points[k] !== "number") points[k] = 0;
    if (typeof mult[k] !== "number") mult[k] = 100;
  }
  return { points, mult };
}
export function freeze(d: StatsDraft): StatBlock {
  return { points: { ...d.points }, mult: { ...d.mult } };
}

/** Every stat starts at 2, then 8 points go one at a time to a random stat still below 5. */
export function startStats(seed: number): StatsDraft {
  const rng = makeRng(combineSeed(seed, "stats"));
  const points: Record<StatKey, number> = { health: START_EACH, strength: START_EACH, agility: START_EACH, speed: START_EACH,
    toughness: START_EACH, precision: START_EACH };
  for (let i = 0; i < START_DEALT; i++) {
    const open = STAT_KEYS.filter((k) => points[k] < START_MAX);
    const k = open[rng.int(open.length)]!;
    points[k] += 1;
  }
  return { points, mult: plainMult() };
}

/** floor(points x multiplier / 100) per stat. A stat a block does not hold (a snapshot stored
 *  before content v3 has no Toughness or Precision) counts 0. */
export function effectiveOf(s: StatBlock | StatsDraft): Record<StatKey, number> {
  const out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    const p = s.points[k];
    const m = s.mult[k];
    out[k] = typeof p === "number" && typeof m === "number" ? Math.floor((p * m) / 100) : 0;
  }
  return out;
}

/** Sum of the companion HP costs of a perk list, in whole percent. */
export function companionCostPct(perks: readonly PerkId[]): number {
  let total = 0;
  for (const p of perks) {
    const c = (COMPANIONS as Record<string, { hpCostPct: number } | undefined>)[p];
    if (c !== undefined) total += c.hpCostPct;
  }
  return total;
}

/** Max HP = 54 + 7 x Health (HP_PER_LEVEL x level, now 0), then minus the companion cost. Never
 *  below 1. (Was 30 + 7 x Health + 3 x level, then 44 + 7 x Health + level; the pet pass of
 *  15 November 2026 moved it so weapon starts do not shorten level-1 bouts and bigger pets do not
 *  lengthen level-30 ones. docs/RULES.md section 9.) */
export const HP_BASE = 54;
export const HP_PER_LEVEL = 0;
export function maxHpOf(effectiveHealth: number, level: number, costPct: number): number {
  const base = HP_BASE + 7 * effectiveHealth + HP_PER_LEVEL * level;
  const after = Math.floor((base * (100 - costPct)) / 100);
  return after < 1 ? 1 : after;
}

/** The skills whose numbers change the stat block when they are picked. */
export const STAT_CHANGERS: readonly SkillId[] = ["big-heart", "heavy-hands", "light-feet", "fast-twitch",
  "glass-cannon", "mountain", "plate-vest"];

/** Applies a booster (or Plate Vest's Speed change) to a draft. Any other perk changes nothing. */
export function applyPerkToStats(d: StatsDraft, perk: PerkId): void {
  if (!(STAT_CHANGERS as readonly string[]).includes(perk)) return;
  const id = perk as SkillId;
  for (const k of STAT_KEYS) {
    d.points[k] += sk(id, k);
    d.mult[k] += sk(id, `${k}Mult`);
  }
}

/** Applies a stat card or a split card. A perk card is applied with applyPerkToStats. */
export function applyCardToStats(d: StatsDraft, card: RouteCard): void {
  if (card.kind === "stat") d.points[card.stat] += card.amount;
  else if (card.kind === "split") { d.points[card.stats[0]] += 1; d.points[card.stats[1]] += 1; }
}
