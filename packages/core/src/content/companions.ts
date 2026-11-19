/**
 * The companion table (work package 1). Companions are actors with their own HP bar and clock.
 * `rarity` is a card label only; the roll inside the companion category uses `weight`.
 * Every number that differs from the starting table is listed in docs/RULES.md.
 */
import type { CompanionId } from "../contracts/ids";
import type { CompanionDef } from "../contracts/content";
import { RARITY_OF } from "../contracts/content";

export const COMPANIONS: Readonly<Record<CompanionId, CompanionDef>> = {
  // Pet pass (15 November 2026): pets start small and grow fast with their owner (COMPANION_HP_GROWTH,
  // COMPANION_STR_GROWTH), so a pet is worth about the same at level 3 and at level 30. HP and
  // Strength here are the level-1 values.
  "raccoon": { id: "raccoon", rarity: RARITY_OF.raccoon, weight: 90, limit: 2, excludes: [], hpCostPct: 11,
    hp: 3, strength: 1, agility: 6, speed: 6, dmg: 1, combo: 20, evade: 10, aim: 5, disarm: 0, startClock: 10, swings: 1, flies: false },
  "goose": { id: "goose", rarity: RARITY_OF.goose, weight: 5, limit: 1, excludes: ["boar"], hpCostPct: 20,
    hp: 6, strength: 1, agility: 12, speed: 16, dmg: 1, combo: 30, evade: 25, aim: 5, disarm: 0, startClock: 40, swings: 1, flies: false },
  "boar": { id: "boar", rarity: RARITY_OF.boar, weight: 5, limit: 1, excludes: ["goose"], hpCostPct: 22,
    hp: 7, strength: 2, agility: 2, speed: 4, dmg: 2, combo: 0, evade: 0, aim: 20, disarm: 10, startClock: 150,
    swings: 1, flies: false },
  // content v2. Stray Dog: the all-rounder that grabs a weapon now and then. Crow: flies, pecks,
  // hard to hit; nobody can hit it first or hit back at it. Alley Cat: quick and slippery, every
  // attack is two scratches. The dog and the cat never share a side.
  "stray-dog": { id: "stray-dog", rarity: RARITY_OF["stray-dog"], weight: 30, limit: 1, excludes: ["alley-cat"], hpCostPct: 17,
    hp: 4, strength: 1, agility: 7, speed: 8, dmg: 1, combo: 15, evade: 10, aim: 5, disarm: 8, startClock: 30,
    swings: 1, flies: false },
  "crow": { id: "crow", rarity: RARITY_OF.crow, weight: 15, limit: 1, excludes: [], hpCostPct: 26,
    hp: 3, strength: 1, agility: 18, speed: 12, dmg: 1, combo: 30, evade: 25, aim: 15, disarm: 0, startClock: 20,
    swings: 1, flies: true },
  "alley-cat": { id: "alley-cat", rarity: RARITY_OF["alley-cat"], weight: 15, limit: 1, excludes: ["stray-dog"], hpCostPct: 25,
    hp: 4, strength: 1, agility: 16, speed: 11, dmg: 1, combo: 20, evade: 25, aim: 10, disarm: 0, startClock: 15,
    swings: 2, flies: false },
};

/** Fixed numbers every companion uses in the formulas. */
export const COMPANION_FIXED = { tempo: 80, reach: 0, crit: 5, pierce: 0, armor: 0, block: 0 } as const;

/** How fast a pet's HP and its Strength grow per owner level, in percent of the level-1 value.
 *  (Was 3 for both: pets were worth far more at low levels, 85-93% with-and-without at level 3.
 *  Strength grows faster than HP so a high-level pet hits harder rather than soaking longer, which
 *  keeps level-30 bouts inside the turn target.) */
export const COMPANION_HP_GROWTH = 15;
export const COMPANION_STR_GROWTH = 60;

/** A level-1 value grown to the owner's level: x (100 + growth x (level - 1)) / 100, rounded down. */
export function companionScale(value: number, ownerLevel: number, growth: number): number {
  const lvl = ownerLevel < 1 ? 1 : ownerLevel;
  return Math.floor((value * (100 + growth * (lvl - 1))) / 100);
}
