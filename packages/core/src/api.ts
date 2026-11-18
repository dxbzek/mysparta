/**
 * The core's one public face (work package 1). It satisfies the frozen CoreApi; the package index
 * checks that with `const check: CoreApi = impl` at integration.
 */
import type { ContentTables, CoreApi } from "./contracts/api";
import type { DayKey, FighterSnapshot, KitBase, Pick as Side2, ScrapperRecord } from "./contracts/fighter";
import { GEAR } from "./content/gear";
import { defaultLoadout } from "./progress/loadout";
import { combineSeed } from "./prng";
import { COMPANIONS } from "./content/companions";
import { SKILLS } from "./content/skills";
import { WEAPONS } from "./content/weapons";
import { SHIELDS } from "./content/shields";
import { checkName, createRecord, fighterSeed, randomName, rollLook } from "./progress/create";
import { afterBout, energyNextMs, energyNow } from "./progress/energy";
import { routeNode } from "./progress/route";
import { rivalSnapshot, tonightsCard } from "./progress/rivals";
import { foundPerks, joinLoadout, kitOf, loadoutOf, sheetOf, snapshotOf, snapshotSheet, withLoadout } from "./progress/snapshot";
import { afterPick as xpAfterPick, xpForBout, xpToNext } from "./progress/xp";
import { simulateFight } from "./sim/simulate";
export { SIM_VERSION } from "./sim/version";
export { ENERGY_COST, ENERGY_MAX, ENERGY_REFILL_MS } from "./progress/energy";
/** For the save migration to schema 4 (apps/web state/migrations.ts): the kit an old save holds. */
export { LEGACY_NEW_STAT_POINTS, legacyBase, legacyKit, sixStatsOf } from "./progress/legacy";
export type { LegacyKit } from "./progress/legacy";
import { canonical } from "./canonical";

export const content: ContentTables = { weapons: WEAPONS, skills: SKILLS, companions: COMPANIONS, shields: SHIELDS, gear: GEAR };

/** Takes the waiting level-up; a new item joins a stored loadout when there is room (joinLoadout). */
export function afterPick(rec: ScrapperRecord, pick: Side2): ScrapperRecord {
  return joinLoadout(rec, xpAfterPick(rec, pick));
}

/** Fight seed = hash(fighter id, opponent id, the fighter's lifetime bout count). */
export function boutSeed(aId: string, bId: string, lifetimeBouts: number): number {
  return combineSeed(aId, bId, lifetimeBouts);
}

export function route(rec: ScrapperRecord) {
  return kitOf(rec).nodes;
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
  loadoutOf,
  withLoadout,
  defaultLoadout,
  routeNode: (seed: number, picks: readonly Side2[], base?: KitBase, gearFrom?: number) => routeNode(seed, picks, base, gearFrom ?? 0),
  route,
  xpToNext,
  xpForBout,
  energyNow,
  energyNextMs,
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
  routeNode, xpToNext, xpForBout, energyNow, energyNextMs, afterBout, rivalSnapshot, tonightsCard, foundPerks,
  simulateFight, loadoutOf, withLoadout, defaultLoadout,
};
/** For the save migration to schema 5 (apps/web state/migrations.ts) and the tools. */
export { loadoutPerks, resolveLoadout, statsWithGear, wornGear } from "./progress/loadout";
export { GEAR, gn, gearSlot } from "./content/gear";
