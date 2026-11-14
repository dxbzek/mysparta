/**
 * Stats (work package 1): the starting deal, effective values, max HP, boosters and stat cards.
 * Whole-number maths only.
 */
import type { PerkId, SkillId } from "../contracts/ids";
import type { RouteCard, StatBlock, StatKey } from "../contracts/fighter";
import { combineSeed, makeRng } from "../prng";
import { COMPANIONS } from "../content/companions";
import { sk } from "../content/skills";

export const STAT_KEYS: readonly StatKey[] = ["health", "strength", "agility", "speed"];
export const START_EACH = 2;
export const START_DEALT = 6;
export const START_MAX = 5;

/** Mutable copy used while a kit is built. */
export interface StatsDraft { points: Record<StatKey, number>; mult: Record<StatKey, number> }

export function draftOf(s: StatBlock): StatsDraft {
  return { points: { ...s.points }, mult: { ...s.mult } };
}
export function freeze(d: StatsDraft): StatBlock {
  return { points: { ...d.points }, mult: { ...d.mult } };
}

/** Every stat starts at 2, then 6 points go one at a time to a random stat still below 5. */
export function startStats(seed: number): StatsDraft {
  const rng = makeRng(combineSeed(seed, "stats"));
  const points: Record<StatKey, number> = { health: START_EACH, strength: START_EACH, agility: START_EACH, speed: START_EACH };
  for (let i = 0; i < START_DEALT; i++) {
    const open = STAT_KEYS.filter((k) => points[k] < START_MAX);
    const k = open[rng.int(open.length)]!;
    points[k] += 1;
  }
  return { points, mult: { health: 100, strength: 100, agility: 100, speed: 100 } };
}

export function effectiveOf(s: StatBlock | StatsDraft): Record<StatKey, number> {
  const out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) out[k] = Math.floor((s.points[k] * s.mult[k]) / 100);
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

/** Max HP = 30 + 7 x Health + 3 x level, then minus the companion cost. Never below 1. */
export function maxHpOf(effectiveHealth: number, level: number, costPct: number): number {
  const base = 30 + 7 * effectiveHealth + 3 * level;
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
