/**
 * Sheets and snapshots (work package 1). Everything a screen shows about a scrapper is recomputed
 * from its record; a bout reads only a snapshot.
 */
import type { FighterSnapshot, ScrapperRecord, ScrapperSheet, SnapshotSheet } from "../contracts/fighter";
import type { PerkId, ShieldId } from "../contracts/ids";
import { PERK_IDS, isShieldId, perkKind } from "../contracts/ids";
import { combatValues } from "../sim/combatant";
import { rollLook } from "./create";
import { walk } from "./route";
import { companionCostPct, effectiveOf, maxHpOf } from "./stats";
import { levelOf, levelUpWaiting, xpToNext } from "./xp";

export function snapshotSheet(s: FighterSnapshot): SnapshotSheet {
  const effective = effectiveOf(s.stats);
  const cost = companionCostPct(s.perks);
  const skills = new Set<string>(s.perks.filter((p) => perkKind(p) === "skill"));
  return {
    maxHp: maxHpOf(effective.health, s.level, cost),
    effective,
    derived: combatValues(skills, "fists", s.perks.find((p): p is ShieldId => isShieldId(p)) ?? null),
    companionCostPct: cost,
  };
}

export function snapshotOf(rec: ScrapperRecord): FighterSnapshot {
  const kit = walk(rec.seed, rec.picks);
  return { id: rec.id, name: rec.name, look: rollLook(rec.seed, rec.lookSalt, rec.colourSalt), level: levelOf(rec),
    stats: kit.stats, perks: kit.perks, rulesVersion: 1 };
}

export function sheetOf(rec: ScrapperRecord): ScrapperSheet {
  const kit = walk(rec.seed, rec.picks);
  const level = levelOf(rec);
  const snap: FighterSnapshot = { id: rec.id, name: rec.name, look: rollLook(rec.seed, rec.lookSalt, rec.colourSalt),
    level, stats: kit.stats, perks: kit.perks, rulesVersion: 1 };
  const ss = snapshotSheet(snap);
  return {
    level, xp: rec.xp, xpToNext: xpToNext(level), levelUpWaiting: levelUpWaiting(rec),
    look: snap.look, stats: kit.stats, effective: ss.effective, startPerk: kit.startPerk, startSkill: kit.startSkill,
    perks: kit.perks, maxHp: ss.maxHp, companionCostPct: ss.companionCostPct, derived: ss.derived,
  };
}

/** Every perk any of these records has owned, in the order of PERK_IDS. */
export function foundPerks(records: readonly ScrapperRecord[]): PerkId[] {
  const seen = new Set<string>();
  for (const r of records) for (const p of walk(r.seed, r.picks).perks) seen.add(p);
  return PERK_IDS.filter((p) => seen.has(p));
}
