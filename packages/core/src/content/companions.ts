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
    hp: 14, strength: 4, agility: 6, speed: 6, dmg: 3, combo: 20, evade: 10, aim: 5, disarm: 0, startClock: 10 },
  "goose": { id: "goose", rarity: RARITY_OF.goose, weight: 5, limit: 1, excludes: ["boar"], hpCostPct: 20,
    hp: 22, strength: 8, agility: 12, speed: 16, dmg: 3, combo: 50, evade: 25, aim: 5, disarm: 0, startClock: 40 },
  "boar": { id: "boar", rarity: RARITY_OF.boar, weight: 5, limit: 1, excludes: ["goose"], hpCostPct: 30,
    hp: 80, strength: 16, agility: 2, speed: 2, dmg: 6, combo: 0, evade: 0, aim: 20, disarm: 10, startClock: 250 },
};

/** Fixed numbers every companion uses in the formulas. */
export const COMPANION_FIXED = { tempo: 100, reach: 0, crit: 5, pierce: 0, armor: 0, block: 0 } as const;

/** HP and Strength grow with the owner's level: x (100 + 4 x (level - 1)) / 100, rounded down. */
export function companionScale(value: number, ownerLevel: number): number {
  const lvl = ownerLevel < 1 ? 1 : ownerLevel;
  return Math.floor((value * (100 + 4 * (lvl - 1))) / 100);
}
