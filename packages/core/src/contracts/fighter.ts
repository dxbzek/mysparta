/**
 * FROZEN CONTRACT (work package 0). Scrappers: what a save stores, what is recomputed, what a bout reads.
 */
import type { CompanionId, GearId, GearSlot, PerkId, ShieldId, TalentId, WeaponId } from "./ids";

/** Six since content v3 (CONTRACT_REV 7): Toughness (a flat cut of every hit taken, and a firmer
 *  hold on the weapon and the shield) and Precision (Aim and Crit). */
export type StatKey = "health" | "strength" | "agility" | "speed" | "toughness" | "precision";
export interface StatBlock {
  points: Readonly<Record<StatKey, number>>;
  /** Whole percent, 100 at the start. effective stat = floor(points x mult / 100). */
  mult: Readonly<Record<StatKey, number>>;
}

/**
 * How many choices each part of a look has. A Look holds one index per part, 0 to count - 1.
 * Builds are in the brief's order: 0 lean, 1 stocky, 2 tall, then (content v3 batch 4) 3 heavy,
 * 4 wiry. Accessory 0 is "none". Shapes (build, head, hair, face, top, bottom, shoes, accessory)
 * come from the look salt, colours (skin, hairColor, palette) from the colour salt.
 * Content v3 batch 4 (CONTRACT_REV 10, plan 13.9) grew every count; a part keeps its index (new
 * parts are added at the end of each list), so a look written before still draws the same.
 */
export const LOOK_SPACE = { build: 5, head: 10, hair: 18, face: 14, top: 16, bottom: 10, shoes: 8,
  accessory: 14, skin: 10, hairColor: 12, palette: 24 } as const;
/** The counts before CONTRACT_REV 10. The seeded roll of version 1 (`rollLook(..., 1)`) draws inside
 *  these, so a record from before the look editor keeps the look it was shown (save schema 7). */
export const LOOK_SPACE_V1 = { build: 3, head: 6, hair: 10, face: 8, top: 8, bottom: 5, shoes: 4,
  accessory: 6, skin: 8, hairColor: 8, palette: 12 } as const;
/** Which seeded roll: 1 draws in LOOK_SPACE_V1 (records from before CONTRACT_REV 10), 2 in LOOK_SPACE. */
export type LookRoll = 1 | 2;
/** The roll of today's content: rivals and a new scrapper's starting look. */
export const LOOK_ROLL: LookRoll = 2;
export type Look = { readonly [K in keyof typeof LOOK_SPACE]: number };
/** One level-up choice: the left or the right card. (This name hides TypeScript's own `Pick<T, K>`
 *  in any file that imports it. Import it under another name where that utility type is needed.) */
export type Pick = "L" | "R";
/** "YYYY-MM-DD" in local time. Always passed in by the caller; the core never reads a clock. */
export type DayKey = string;
/** A time in ms since 1970, from the app's injected `Clock`. The core never reads a clock. */
export type TimeMs = number;

/**
 * A kit carried over from an earlier build (CONTRACT_REV 5, save schema 3). The kit is walked from
 * the seed and the picks under today's tables, so a save written by an earlier build would walk
 * into a different kit (the round-2 sim changed the start perks, the card offers and the rerolls).
 * The save migration pins the kit that build gave the scrapper, read from its last stored bout:
 * after `picks` picks it owned `perks` (in the order they came, the start perks first, as many as
 * `starts`) and `stats`. Later picks walk on from it under today's tables. A record made by this
 * build has no base.
 */
export interface KitBase { picks: number; starts: number; perks: PerkId[]; stats: StatBlock }

/**
 * What a scrapper takes into a bout (content v3, batch 2, plan 13.12): the weapons in its bag (up to
 * MAX_LOADOUT_WEAPONS of the ones it owns, at least one when it owns any), the shield it carries or
 * none, the pets that come along (a subset of the ones it owns, the Raccoon up to twice), and the
 * gear worn, one per slot. The draw order inside a bout stays random from the bag. A record with no
 * loadout, and every rival, takes the sim's own choice (`defaultLoadout`: every weapon up to the
 * limit, the best by rarity, its shield, its pets, the rarest gear of each slot).
 */
export interface Loadout { weapons: WeaponId[]; shield: ShieldId | null; pets: CompanionId[];
  gear: Partial<Record<GearSlot, GearId>> }
/** A loadout's bag holds this many weapons at most. */
export const MAX_LOADOUT_WEAPONS = 5;

/** Ranks spent per talent node (content v3, batch 3). A node not listed has rank 0. */
export type TalentRanks = Readonly<Partial<Record<TalentId, number>>>;
/**
 * The talent tree of a scrapper (CONTRACT_REV 9, plan 13.11): the ranks the player spent, and the
 * day of the last free respec. Points are never stored: a scrapper has earned `talentPointsAt(level)`
 * (1 at level 3 and 1 every 3 levels after), and the unspent ones are those minus the ranks spent.
 * Ranks that break a rule (an unknown id, a rank over the node's max, a node whose tier is not open,
 * more ranks than earned points) are dropped when the record is read (`talentsOf`).
 */
export interface TalentPicks { ranks: TalentRanks; respecDay?: DayKey }

/** The only thing a save stores per scrapper. Level, stats, kit and Route are always recomputed
 *  (from `base` on, when an earlier build's kit was carried over). */
export interface ScrapperRecord {
  id: string;                                             // ULID, made by the app
  name: string; seed: number;
  lookSalt: number; colourSalt: number;                   // two reroll buttons: shapes and colours
  picks: Pick[];                                          // level = 1 + picks.length
  xp: number;                                             // XP inside the current level; a level-up
                                                          // is waiting while xp >= xpToNext(level)
  createdDay: DayKey; lifetimeBouts: number;
  /** Energy (CONTRACT_REV 7, in place of the daily bout cap): the points held at `energyAt`, 0 to
   *  ENERGY_MAX. One point comes back every ENERGY_REFILL_MS after `energyAt` (docs/RULES.md 4). */
  energy: number; energyAt: TimeMs;
  base?: KitBase;
  /** What it takes into a bout (CONTRACT_REV 8). Absent: the sim's own choice, `defaultLoadout`.
   *  Items it does not own are left out when the loadout is read (`loadoutOf`). */
  loadout?: Loadout;
  /** Level-ups before this pick index offer no gear card (CONTRACT_REV 8): the save migration sets
   *  it to the picks an old save had taken, so its kit walks as it did. Absent = 0. */
  gearFrom?: number;
  /** The talent tree (CONTRACT_REV 9). Absent: nothing spent, no respec used. */
  talents?: TalentPicks;
  /** The look the player picked (CONTRACT_REV 10, the look editor, plan 13.12). A record made by
   *  this build always has one; the save migration to schema 7 pins every older record's seeded
   *  look here (`rollLook(seed, lookSalt, colourSalt, 1)`). Absent: that version-1 roll (`lookOf`).
   *  Cosmetic only: the stats still come from the name (the seed). */
  look?: Look;
}

/** Whole percentages. See the derived-values table of the rules. */
export interface DerivedValues { evade: number; block: number; aim: number; pierce: number;
  intercept: number; riposte: number; combo: number; disarm: number; crit: number; armor: number;
  /** Toughness (CONTRACT_REV 7): HP taken off every hit of a swing or a throw (never below 1), and
   *  points taken off an attacker's disarm and shield knock-off chances. Aim and Crit already
   *  hold Precision. */
  soak: number; grip: number }
/** Everything the screens show about one scrapper. Never stored. */
export interface ScrapperSheet {
  level: number; xp: number; xpToNext: number; levelUpWaiting: boolean;
  look: Look; stats: StatBlock; effective: Record<StatKey, number>;
  startPerk: PerkId;                                      // for the creation reveal and the Route's "Start" row
  startSkill: PerkId;                                     // the second starting perk: a skill (round-2 review)
  perks: PerkId[]; maxHp: number; companionCostPct: number;
  derived: DerivedValues;                                 // bare-handed values, for the Stats tab
  /** What it takes into a bout (CONTRACT_REV 8), read with `loadoutOf`. `stats`, `effective`,
   *  `maxHp`, `companionCostPct` and `derived` are those of the bout's snapshot: the gear worn and
   *  the pets taken are in them; `perks` is everything owned. */
  loadout: Loadout;
  /** The talent tree (CONTRACT_REV 9): points earned at this level, spent, unspent, and the ranks
   *  that hold (cleaned as `talentsOf` reads them). The snapshot's stats hold its stat talents. */
  talents: { earned: number; spent: number; unspent: number; ranks: TalentRanks };
}
/** What a card shows about any snapshot, a rival's included: max HP after the companion cost, the
 *  effective stats behind the stat bars, and the bare-handed derived values. Never stored.
 *  For a snapshot made from a record it equals the same four fields of that record's sheet. */
export interface SnapshotSheet { maxHp: number; effective: Record<StatKey, number>;
  derived: DerivedValues; companionCostPct: number }
/** The only thing a bout reads. For a snapshot made from a record: Route picks behind it = level - 1.
 *  `stats` already holds every booster and Plate Vest change; the sim must NOT apply them again from
 *  `perks`. A sandbox snapshot (the debug route) is built by hand and is exempt from the Route
 *  invariant; the sim accepts any snapshot whose ids are known. */
export interface FighterSnapshot { id: string; name: string; look: Look; level: number;
  stats: StatBlock; perks: PerkId[]; rulesVersion: 1;
  /** The talent ranks the bout reads (CONTRACT_REV 9). Absent: none (a snapshot stored before
   *  content v3 batch 3, a sandbox snapshot). Stat talents (Gym Rat, Thick Skin) are already in
   *  `stats`; the sim must NOT add them again. */
  talents?: TalentRanks }

export type RouteCard =
  | { kind: "stat"; stat: StatKey; amount: number }
  | { kind: "split"; stats: [StatKey, StatKey] }
  /** `plus`: the perk card also gives +1 point in this stat (perk cards of the early levels, round-2
   *  review; docs/RULES.md section 3). */
  | { kind: "perk"; perk: PerkId; plus?: StatKey };
/** One level-up that was taken. `level` is the level reached. */
export interface RouteNode { level: number; left: RouteCard; right: RouteCard; taken: Pick }
