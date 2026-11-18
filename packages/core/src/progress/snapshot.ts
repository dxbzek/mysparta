/**
 * Sheets and snapshots (work package 1). Everything a screen shows about a scrapper is recomputed
 * from its record; a bout reads only a snapshot. Since content v3 batch 2 the snapshot holds only
 * what the record's loadout takes (progress/loadout.ts), with the worn gear's stat points.
 */
import type { FighterSnapshot, Loadout, ScrapperRecord, ScrapperSheet, SnapshotSheet } from "../contracts/fighter";
import { MAX_LOADOUT_WEAPONS } from "../contracts/fighter";
import { gearSlot } from "../content/gear";
import type { GearId, PerkId, ShieldId } from "../contracts/ids";
import { PERK_IDS, isGearId, isShieldId, perkKind } from "../contracts/ids";
import { combatValues } from "../sim/combatant";
import { rollLook } from "./create";
import { loadoutPerks, resolveLoadout, statsWithGear, wornGear } from "./loadout";
import type { Kit } from "./route";
import { walk } from "./route";
import { companionCostPct, effectiveOf, maxHpOf } from "./stats";
import { statsWithTalents, talentsOf } from "./talents";
import { levelOf, levelUpWaiting, xpToNext } from "./xp";

export function snapshotSheet(s: FighterSnapshot): SnapshotSheet {
  const effective = effectiveOf(s.stats);
  const cost = companionCostPct(s.perks, s.talents);
  const skills = new Set<string>(s.perks.filter((p) => perkKind(p) === "skill"));
  return {
    maxHp: maxHpOf(effective.health, s.level, cost),
    effective,
    derived: combatValues(skills, "fists", s.perks.find((p): p is ShieldId => isShieldId(p)) ?? null, effective.toughness,
      effective.precision, s.perks.filter((p): p is GearId => isGearId(p)), s.talents),
    companionCostPct: cost,
  };
}

/** The record's kit, walked from its seed and picks (from its carried kit, and with no gear cards
 *  before `gearFrom`). */
export function kitOf(rec: ScrapperRecord): Kit {
  return walk(rec.seed, rec.picks, rec.base, rec.gearFrom ?? 0);
}

export function loadoutOf(rec: ScrapperRecord): Loadout {
  return resolveLoadout(kitOf(rec).perks, rec.loadout);
}

/** The record with this loadout stored, cleaned against what it owns. */
export function withLoadout(rec: ScrapperRecord, loadout: Loadout): ScrapperRecord {
  return { ...rec, loadout: resolveLoadout(kitOf(rec).perks, loadout) };
}

/** The bout's snapshot: the loadout's perks, the worn gear's and the stat talents' points in its
 *  stats, and the talent ranks that hold (content v3 batch 3). */
function snapshotFrom(rec: ScrapperRecord, kit: Kit, l: Loadout): FighterSnapshot {
  const { ranks } = talentsOf(rec);
  return { id: rec.id, name: rec.name, look: rollLook(rec.seed, rec.lookSalt, rec.colourSalt), level: levelOf(rec),
    stats: statsWithTalents(statsWithGear(kit.stats, wornGear(l)), ranks), perks: loadoutPerks(kit.perks, l), rulesVersion: 1,
    talents: ranks };
}

export function snapshotOf(rec: ScrapperRecord): FighterSnapshot {
  const kit = kitOf(rec);
  return snapshotFrom(rec, kit, resolveLoadout(kit.perks, rec.loadout));
}

export function sheetOf(rec: ScrapperRecord): ScrapperSheet {
  const kit = kitOf(rec);
  const loadout = resolveLoadout(kit.perks, rec.loadout);
  const snap = snapshotFrom(rec, kit, loadout);
  const ss = snapshotSheet(snap);
  return {
    level: snap.level, xp: rec.xp, xpToNext: xpToNext(snap.level), levelUpWaiting: levelUpWaiting(rec),
    look: snap.look, stats: snap.stats, effective: ss.effective, startPerk: kit.startPerk, startSkill: kit.startSkill,
    perks: kit.perks, maxHp: ss.maxHp, companionCostPct: ss.companionCostPct, derived: ss.derived, loadout,
    talents: talentsOf(rec),
  };
}

/** Every perk any of these records has owned, in the order of PERK_IDS. */
export function foundPerks(records: readonly ScrapperRecord[]): PerkId[] {
  const seen = new Set<string>();
  for (const r of records) for (const p of kitOf(r).perks) seen.add(p);
  return PERK_IDS.filter((p) => seen.has(p));
}

/** After a level-up, a new weapon, shield, pet or piece of gear joins a stored loadout when there
 *  is room: a weapon while the bag holds fewer than MAX_LOADOUT_WEAPONS, a shield when none is
 *  carried, a pet always (the pet rules already held when it was offered), gear in an empty slot.
 *  A record with no stored loadout takes the default one, which already holds it. */
export function joinLoadout(before: ScrapperRecord, after: ScrapperRecord): ScrapperRecord {
  if (after === before || after.loadout === undefined) return after;
  const had = kitOf(before).perks;
  const now = kitOf(after).perks;
  const left = [...had];
  const fresh: PerkId[] = [];
  for (const p of now) {
    const i = left.indexOf(p);
    if (i >= 0) left.splice(i, 1);
    else fresh.push(p);
  }
  if (fresh.length === 0) return after;
  const l = resolveLoadout(now, after.loadout);
  const next: Loadout = { weapons: [...l.weapons], shield: l.shield, pets: [...l.pets], gear: { ...l.gear } };
  for (const p of fresh) {
    const kind = perkKind(p);
    if (kind === "weapon" && next.weapons.length < MAX_LOADOUT_WEAPONS && !next.weapons.includes(p as never)) next.weapons.push(p as never);
    else if (kind === "shield" && next.shield === null) next.shield = p as ShieldId;
    else if (kind === "companion") next.pets.push(p as never);
    else if (kind === "gear" && isGearId(p)) { const slot = gearSlot(p); if (next.gear[slot] === undefined) next.gear[slot] = p; }
  }
  return { ...after, loadout: resolveLoadout(now, next) };
}
