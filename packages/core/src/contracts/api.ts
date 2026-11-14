/**
 * FROZEN CONTRACT (work package 0). The shape the sim lane must export from
 * packages/core/src/api.ts. The package index checks it with `const check: CoreApi = impl`.
 * Every function is pure: the same inputs give the same output on every engine.
 */
import type { DayKey, FighterSnapshot, Look, Pick, RouteCard, RouteNode, ScrapperRecord, ScrapperSheet } from "./fighter";
import type { PerkId } from "./ids";
import type { BoutLog } from "./log";

export interface CoreApi {
  /** Trims, collapses inner spaces, then checks 3 to 14 characters of letters, digits, space, hyphen. */
  checkName(raw: string): { ok: true; name: string } | { ok: false; why: "length" | "chars" };
  /** hash(realmSalt + ":" + the lowercased, cleaned name). */
  fighterSeed(realmSalt: string, name: string): number;
  /** Shapes come from (seed, lookSalt), colours from (seed, colourSalt). */
  rollLook(seed: number, lookSalt: number, colourSalt: number): Look;
  createRecord(a: { id: string; name: string; realmSalt: string; lookSalt: number; colourSalt: number;
                    today: DayKey }): ScrapperRecord;
  sheetOf(rec: ScrapperRecord): ScrapperSheet;
  snapshotOf(rec: ScrapperRecord): FighterSnapshot;
  /** The two cards after the given picks. A pure function of its inputs: it never rerolls. */
  routeNode(seed: number, picks: readonly Pick[]): { left: RouteCard; right: RouteCard };
  /** Every level-up taken so far, oldest first. */
  route(rec: ScrapperRecord): RouteNode[];
  xpToNext(level: number): number;
  xpForBout(won: boolean, ownLevel: number, oppLevel: number): 1 | 2;
  /** 6, or 8 on the creation day, minus the bouts used today. A day key older than `today` means a full day. */
  boutsLeft(rec: ScrapperRecord, today: DayKey): number;
  afterBout(rec: ScrapperRecord, xp: 1 | 2, today: DayKey): ScrapperRecord;
  afterPick(rec: ScrapperRecord, pick: Pick): ScrapperRecord;
  rivalSnapshot(realmSalt: string, level: number, index: number): FighterSnapshot;
  /** 6 rivals at the scrapper's level. At levels 1 to 3 at least 2 of them own no weapon. */
  tonightsCard(rec: ScrapperRecord, realmSalt: string, today: DayKey): FighterSnapshot[];
  /** Every perk any of these records has owned. For the "Found N of 63" list. */
  foundPerks(records: readonly ScrapperRecord[]): PerkId[];
  boutSeed(aId: string, bId: string, lifetimeBouts: number): number;
  simulateFight(seed: number, a: FighterSnapshot, b: FighterSnapshot, rulesVersion: 1): BoutLog;
  /** Stable JSON of a log. The SHA-256 is done by the test or the tool. */
  canonical(log: BoutLog): string;
}
