/**
 * FROZEN CONTRACT (work package 0). Scrappers: what a save stores, what is recomputed, what a bout reads.
 */
import type { PerkId } from "./ids";

export type StatKey = "health" | "strength" | "agility" | "speed";
export interface StatBlock {
  points: Readonly<Record<StatKey, number>>;
  /** Whole percent, 100 at the start. effective stat = floor(points x mult / 100). */
  mult: Readonly<Record<StatKey, number>>;
}

/**
 * How many choices each part of a look has. A Look holds one index per part, 0 to count - 1.
 * Builds are in the brief's order: 0 lean, 1 stocky, 2 tall. Accessory 0 is "none".
 * Shapes (build, head, hair, face, top, bottom, shoes, accessory) come from the look salt,
 * colours (skin, hairColor, palette) from the colour salt.
 */
export const LOOK_SPACE = { build: 3, head: 6, hair: 10, face: 8, top: 8, bottom: 5, shoes: 4,
  accessory: 6, skin: 8, hairColor: 8, palette: 12 } as const;
export type Look = { readonly [K in keyof typeof LOOK_SPACE]: number };
/** One level-up choice: the left or the right card. (This name hides TypeScript's own `Pick<T, K>`
 *  in any file that imports it. Import it under another name where that utility type is needed.) */
export type Pick = "L" | "R";
/** "YYYY-MM-DD" in local time. Always passed in by the caller; the core never reads a clock. */
export type DayKey = string;

/** The only thing a save stores per scrapper. Level, stats, kit and Route are always recomputed. */
export interface ScrapperRecord {
  id: string;                                             // ULID, made by the app
  name: string; seed: number;
  lookSalt: number; colourSalt: number;                   // two reroll buttons: shapes and colours
  picks: Pick[];                                          // level = 1 + picks.length
  xp: number;                                             // XP inside the current level; a level-up
                                                          // is waiting while xp >= xpToNext(level)
  createdDay: DayKey; day: DayKey; boutsUsed: number; lifetimeBouts: number;
}
/** Whole percentages. See the derived-values table of the rules. */
export interface DerivedValues { evade: number; block: number; aim: number; pierce: number;
  intercept: number; riposte: number; combo: number; disarm: number; crit: number; armor: number }
/** Everything the screens show about one scrapper. Never stored. */
export interface ScrapperSheet {
  level: number; xp: number; xpToNext: number; levelUpWaiting: boolean;
  look: Look; stats: StatBlock; effective: Record<StatKey, number>;
  startPerk: PerkId;                                      // for the creation reveal and the Route's "Start" row
  perks: PerkId[]; maxHp: number; companionCostPct: number;
  derived: DerivedValues;                                 // bare-handed values, for the Stats tab
}
/** The only thing a bout reads. For a snapshot made from a record: Route picks behind it = level - 1.
 *  `stats` already holds every booster and Plate Vest change; the sim must NOT apply them again from
 *  `perks`. A sandbox snapshot (the debug route) is built by hand and is exempt from the Route
 *  invariant; the sim accepts any snapshot whose ids are known. */
export interface FighterSnapshot { id: string; name: string; look: Look; level: number;
  stats: StatBlock; perks: PerkId[]; rulesVersion: 1 }

export type RouteCard =
  | { kind: "stat"; stat: StatKey; amount: 2 }
  | { kind: "split"; stats: [StatKey, StatKey] }
  | { kind: "perk"; perk: PerkId };
/** One level-up that was taken. `level` is the level reached. */
export interface RouteNode { level: number; left: RouteCard; right: RouteCard; taken: Pick }
