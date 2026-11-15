/**
 * The core's one public face (work package 1). It satisfies the frozen CoreApi; the package index
 * checks that with `const check: CoreApi = impl` at integration.
 */
import type { ContentTables, CoreApi } from "./contracts/api";
import type { DayKey, FighterSnapshot, Pick as Side2, ScrapperRecord } from "./contracts/fighter";
import { combineSeed } from "./prng";
import { COMPANIONS } from "./content/companions";
import { SKILLS } from "./content/skills";
import { WEAPONS } from "./content/weapons";
import { SHIELDS } from "./content/shields";
import { checkName, createRecord, fighterSeed, randomName, rollLook } from "./progress/create";
import { afterBout, boutsLeft } from "./progress/daily";
import { routeNode, walk } from "./progress/route";
import { rivalSnapshot, tonightsCard } from "./progress/rivals";
import { foundPerks, sheetOf, snapshotOf, snapshotSheet } from "./progress/snapshot";
import { afterPick, xpForBout, xpToNext } from "./progress/xp";
import { simulateFight } from "./sim/simulate";
import { canonical } from "./canonical";

export const content: ContentTables = { weapons: WEAPONS, skills: SKILLS, companions: COMPANIONS, shields: SHIELDS };

/** Fight seed = hash(fighter id, opponent id, the fighter's lifetime bout count). */
export function boutSeed(aId: string, bId: string, lifetimeBouts: number): number {
  return combineSeed(aId, bId, lifetimeBouts);
}

export function route(rec: ScrapperRecord) {
  return walk(rec.seed, rec.picks).nodes;
}

export const api: CoreApi = {
  content,
  checkName,
  randomName,
  fighterSeed,
  rollLook,
  createRecord,
  sheetOf,
  snapshotOf,
  snapshotSheet,
  routeNode: (seed: number, picks: readonly Side2[]) => routeNode(seed, picks),
  route,
  xpToNext,
  xpForBout,
  boutsLeft,
  afterBout,
  afterPick,
  rivalSnapshot,
  tonightsCard: (rec: ScrapperRecord, realmSalt: string, today: DayKey): FighterSnapshot[] => tonightsCard(rec, realmSalt, today),
  foundPerks,
  boutSeed,
  simulateFight,
  canonical,
};

export {
  canonical, checkName, randomName, fighterSeed, rollLook, createRecord, sheetOf, snapshotOf, snapshotSheet,
  routeNode, xpToNext, xpForBout, boutsLeft, afterBout, afterPick, rivalSnapshot, tonightsCard, foundPerks,
  simulateFight,
};
