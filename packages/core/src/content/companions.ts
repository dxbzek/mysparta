/**
 * The companion table (work package 1). Companions are actors with their own HP bar and clock.
 * `rarity` is a card label only; the roll inside the companion category uses `weight`.
 * Every number that differs from the starting table is listed in docs/RULES.md.
 */
import type { CompanionId } from "../contracts/ids";
import type { CompanionDef } from "../contracts/content";
import { RARITY_OF } from "../contracts/content";

export const COMPANIONS: Readonly<Record<CompanionId, CompanionDef>> = {
  "raccoon": { id: "raccoon", rarity: RARITY_OF.raccoon, weight: 90, limit: 2, excludes: [], hpCostPct: 8,
    hp: 16, strength: 4, agility: 6, speed: 6, dmg: 3, combo: 20, evade: 10, aim: 5, disarm: 0, startClock: 10, swings: 1, flies: false },
  "goose": { id: "goose", rarity: RARITY_OF.goose, weight: 5, limit: 1, excludes: ["boar"], hpCostPct: 20,
    hp: 28, strength: 8, agility: 12, speed: 16, dmg: 3, combo: 50, evade: 25, aim: 5, disarm: 0, startClock: 40, swings: 1, flies: false },
  "boar": { id: "boar", rarity: RARITY_OF.boar, weight: 5, limit: 1, excludes: ["goose"], hpCostPct: 30,
    hp: 104, strength: 16, agility: 2, speed: 2, dmg: 6, combo: 0, evade: 0, aim: 20, disarm: 10, startClock: 250,
    swings: 1, flies: false },
  // content v2. Stray Dog: the all-rounder that grabs a weapon now and then. Crow: flies, pecks,
  // hard to hit; nobody can hit it first or hit back at it. Alley Cat: quick and slippery, every
  // attack is two scratches. The dog and the cat never share a side.
  "stray-dog": { id: "stray-dog", rarity: RARITY_OF["stray-dog"], weight: 30, limit: 1, excludes: ["alley-cat"], hpCostPct: 16,
    hp: 18, strength: 5, agility: 7, speed: 8, dmg: 3, combo: 15, evade: 10, aim: 5, disarm: 15, startClock: 30,
    swings: 1, flies: false },
  "crow": { id: "crow", rarity: RARITY_OF.crow, weight: 15, limit: 1, excludes: [], hpCostPct: 12,
    hp: 13, strength: 5, agility: 18, speed: 12, dmg: 3, combo: 30, evade: 40, aim: 15, disarm: 0, startClock: 20,
    swings: 1, flies: true },
  "alley-cat": { id: "alley-cat", rarity: RARITY_OF["alley-cat"], weight: 15, limit: 1, excludes: ["stray-dog"], hpCostPct: 14,
    hp: 19, strength: 5, agility: 16, speed: 11, dmg: 3, combo: 20, evade: 30, aim: 10, disarm: 0, startClock: 15,
    swings: 2, flies: false },
};

/** Fixed numbers every companion uses in the formulas. */
export const COMPANION_FIXED = { tempo: 80, reach: 0, crit: 5, pierce: 0, armor: 0, block: 0 } as const;

/** HP and Strength grow with the owner's level: x (100 + 3 x (level - 1)) / 100, rounded down. */
export function companionScale(value: number, ownerLevel: number): number {
  const lvl = ownerLevel < 1 ? 1 : ownerLevel;
  return Math.floor((value * (100 + 3 * (lvl - 1))) / 100);
}
