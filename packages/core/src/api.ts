/**
 * The core's one public face (work package 1). It satisfies the frozen CoreApi; the package index
 * checks that with `const check: CoreApi = impl` at integration.
 */
import type { ContentTables, CoreApi } from "./contracts/api";
import type { DayKey, FighterSnapshot, KitBase, LadderPrize, Pick as Side2, ScrapperRecord } from "./contracts/fighter";
import { afterBoss, bossBlock, bossGate, bossSnapshot, ladderOf, prizeOffer, takePrize } from "./progress/ladder";
import { GEAR } from "./content/gear";
import { TALENTS } from "./content/talents";
import { canRespec, respecTalents, rivalTalents, spendTalent, talentBlock, talentPointsAt } from "./progress/talents";
import { defaultLoadout } from "./progress/loadout";
import { combineSeed } from "./prng";
import { COMPANIONS } from "./content/companions";
import { SKILLS } from "./content/skills";
import { WEAPONS } from "./content/weapons";
import { SHIELDS } from "./content/shields";
import { checkName, cleanLook, createRecord, fighterSeed, lookOf, randomName, rollLook, withLook } from "./progress/create";
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

export const content: ContentTables = { weapons: WEAPONS, skills: SKILLS, companions: COMPANIONS, shields: SHIELDS, gear: GEAR, talents: TALENTS };

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
  lookOf,
  withLook,
  createRecord,
  sheetOf,
  snapshotOf,
  snapshotSheet,
  loadoutOf,
  withLoadout,
  defaultLoadout,
  talentPointsAt,
  talentBlock,
  spendTalent,
  canRespec,
  respecTalents,
  rivalTalents,
  routeNode: (seed: number, picks: readonly Side2[], base?: KitBase, gearFrom?: number, prizes?: readonly LadderPrize[]) =>
    routeNode(seed, picks, base, gearFrom ?? 0, prizes ?? []),
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
  ladderOf,
  bossSnapshot,
  bossGate,
  bossBlock,
  afterBoss,
  prizeOffer,
  takePrize,
};

export {
  canonical, checkName, randomName, fighterSeed, rollLook, lookOf, withLook, cleanLook, createRecord, sheetOf, snapshotOf, snapshotSheet,
  routeNode, xpToNext, xpForBout, energyNow, energyNextMs, afterBout, rivalSnapshot, tonightsCard, foundPerks,
  simulateFight, loadoutOf, withLoadout, defaultLoadout,
  talentPointsAt, talentBlock, spendTalent, canRespec, respecTalents, rivalTalents,
  ladderOf, bossSnapshot, bossGate, bossBlock, afterBoss, prizeOffer, takePrize,
};
/** The ladder's helpers for the tools and the app (plan 13.10 item 1). */
export { GATE_EVERY, GATE_FIRST, PRIZE_STAT_POINTS, ladderState } from "./progress/ladder";
export { prizesOf } from "./progress/snapshot";
export { BOSSES } from "./content/bosses";
export type { BossDef } from "./content/bosses";
/** The talent tree's helpers for the tools and the app (content v3 batch 3). */
export { TALENT_FROM, TALENT_EVERY, branchBuild, branchFit, branchOrder, cleanRanks, rankOf, statsWithTalents, talentsOf } from "./progress/talents";
export { TALENTS, tn, branchNodes } from "./content/talents";
/** For the save migration to schema 5 (apps/web state/migrations.ts) and the tools. */
export { loadoutPerks, resolveLoadout, statsWithGear, wornGear } from "./progress/loadout";
export { GEAR, gn, gearSlot } from "./content/gear";
