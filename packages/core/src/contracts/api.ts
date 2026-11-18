/**
 * FROZEN CONTRACT (work package 0). The shape the sim lane must export from
 * packages/core/src/api.ts. The package index checks it with `const check: CoreApi = impl`.
 * Every function is pure: the same inputs give the same output on every engine.
 */
import type { CompanionDef, GearDef, ShieldDef, SkillDef, WeaponDef } from "./content";
import type { DayKey, TimeMs, FighterSnapshot, KitBase, Loadout, Look, Pick, RouteCard, RouteNode, ScrapperRecord, ScrapperSheet,
  SnapshotSheet } from "./fighter";
import type { CompanionId, GearId, HeldId, PerkId, ShieldId, SkillId } from "./ids";
import type { BoutLog } from "./log";

/** The four number tables of the rules, as total Records. The screens read every number they
 *  print from here (card lines, the Kit screen), so no number is typed twice. Read-only. */
export interface ContentTables {
  weapons: Readonly<Record<HeldId, WeaponDef>>;
  skills: Readonly<Record<SkillId, SkillDef>>;
  companions: Readonly<Record<CompanionId, CompanionDef>>;
  shields: Readonly<Record<ShieldId, ShieldDef>>;
  /** Body equipment (CONTRACT_REV 8). */
  gear: Readonly<Record<GearId, GearDef>>;
}

export interface CoreApi {
  /** The number tables. The only way the app reaches them: it never imports a content file. */
  readonly content: ContentTables;
  /** Trims, collapses inner spaces, then checks 3 to 14 characters of letters, digits, space, hyphen. */
  checkName(raw: string): { ok: true; name: string } | { ok: false; why: "length" | "chars" };
  /** A name built from the game's own name lists, for the "Random name" link. Pure: the same `n`
   *  gives the same name, and any whole number is accepted (the app passes a random one).
   *  Every result passes `checkName`. */
  randomName(n: number): string;
  /** hash(realmSalt + ":" + the lowercased, cleaned name). */
  fighterSeed(realmSalt: string, name: string): number;
  /** Shapes come from (seed, lookSalt), colours from (seed, colourSalt). */
  rollLook(seed: number, lookSalt: number, colourSalt: number): Look;
  /** A new scrapper starts with a full energy bar, timed from `nowMs`. */
  createRecord(a: { id: string; name: string; realmSalt: string; lookSalt: number; colourSalt: number;
                    today: DayKey; nowMs: TimeMs }): ScrapperRecord;
  sheetOf(rec: ScrapperRecord): ScrapperSheet;
  /** The bout's snapshot: its perks hold every skill it owns and only the weapons, shield, pets and
   *  gear of its loadout (`loadoutOf`), and its stats hold the worn gear's stat points. */
  snapshotOf(rec: ScrapperRecord): FighterSnapshot;
  /** The loadout a record takes into a bout (CONTRACT_REV 8): its own, with anything it does not own
   *  left out, the bag cut to MAX_LOADOUT_WEAPONS and given one weapon when it would be empty while
   *  any is owned; or, with none stored, `defaultLoadout` of what it owns. */
  loadoutOf(rec: ScrapperRecord): Loadout;
  /** The record with this loadout stored, cleaned as `loadoutOf` reads it. Pure. */
  withLoadout(rec: ScrapperRecord, loadout: Loadout): ScrapperRecord;
  /** The sim's own loadout for a kit that owns `perks` (rivals, and a record with none stored). */
  defaultLoadout(perks: readonly PerkId[]): Loadout;
  /** Max HP, effective stats, derived values and companion cost of any snapshot: a rival on
   *  Tonight's Card, either side of the face-off sheet, a sandbox snapshot. It holds the HP
   *  formula and the companion cost, so no screen copies a rule. */
  snapshotSheet(s: FighterSnapshot): SnapshotSheet;
  /** The two cards after the given picks (from the record's carried kit, `base`, when it has one).
   *  A pure function of its inputs: it never rerolls. */
  routeNode(seed: number, picks: readonly Pick[], base?: KitBase, gearFrom?: number): { left: RouteCard; right: RouteCard };

  /** Every level-up taken so far, oldest first. */
  route(rec: ScrapperRecord): RouteNode[];
  xpToNext(level: number): number;
  xpForBout(won: boolean, ownLevel: number, oppLevel: number): 1 | 2;
  /** Energy now (content v3, in place of the daily bout cap): the stored points plus one per
   *  ENERGY_REFILL_MS since `energyAt`, at most ENERGY_MAX. A clock behind `energyAt` refills nothing. */
  energyNow(rec: ScrapperRecord, nowMs: TimeMs): number;
  /** Milliseconds until the next energy point, or null when the bar is full. */
  energyNextMs(rec: ScrapperRecord, nowMs: TimeMs): number | null;
  /** Spends one energy point, counts the bout and adds its XP. */
  afterBout(rec: ScrapperRecord, xp: 1 | 2, nowMs: TimeMs): ScrapperRecord;
  afterPick(rec: ScrapperRecord, pick: Pick): ScrapperRecord;
  rivalSnapshot(realmSalt: string, level: number, index: number): FighterSnapshot;
  /** 6 rivals at the scrapper's level, drawn from (seed, today, lifetime bouts). At levels 1 to 3 the last one is an easy rival: armed, 3 stat
   *  points fewer (round 2; it replaced 2 unarmed rivals, which were 96% free wins). */
  tonightsCard(rec: ScrapperRecord, realmSalt: string, today: DayKey): FighterSnapshot[];
  /** Every perk any of these records has owned. For the "Found N of 92" list. */
  foundPerks(records: readonly ScrapperRecord[]): PerkId[];
  boutSeed(aId: string, bId: string, lifetimeBouts: number): number;
  simulateFight(seed: number, a: FighterSnapshot, b: FighterSnapshot, rulesVersion: 1): BoutLog;
  /** Stable JSON of a log. The SHA-256 is done by the test or the tool. */
  canonical(log: BoutLog): string;
}
