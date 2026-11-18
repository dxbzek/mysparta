/**
 * The loadout (content v3, batch 2, plan 13.12): what a scrapper takes into a bout from what it
 * owns. A bout's snapshot holds every skill it owns but only the weapons, the shield, the pets and
 * the gear of its loadout; the worn gear's stat points are added to the snapshot's stats here (the
 * sim never adds them again). docs/RULES.md 3b.
 */
import type { Loadout, StatBlock } from "../contracts/fighter";
import { MAX_LOADOUT_WEAPONS } from "../contracts/fighter";
import type { CompanionId, GearId, GearSlot, PerkId, ShieldId, WeaponId } from "../contracts/ids";
import { GEAR_SLOTS, isCompanionId, isGearId, isShieldId, isWeaponId } from "../contracts/ids";
import { RARITY_OF } from "../contracts/content";
import type { Rarity } from "../contracts/content";
import { GEAR_STAT_KEYS, gearSlot, gn } from "../content/gear";
import { draftOf, freeze } from "./stats";

const RANK: Readonly<Record<Rarity, number>> = { common: 0, uncommon: 1, rare: 2, epic: 3, mythic: 4 };

/** Rarest first; on a tie the one owned first. */
function byRarity<T extends PerkId>(ids: readonly T[]): T[] {
  return ids.map((id, i) => ({ id, i })).sort((p, q) => RANK[RARITY_OF[q.id]] - RANK[RARITY_OF[p.id]] || p.i - q.i).map((x) => x.id);
}

/**
 * The sim's own loadout for a kit that owns `perks` (every rival; a record with none stored; an old
 * save after the migration): every weapon owned, the rarest first when there are more than
 * MAX_LOADOUT_WEAPONS (in the order owned), the shield owned, every pet owned, and in each slot the
 * rarest piece of gear owned (the first owned on a tie).
 */
export function defaultLoadout(perks: readonly PerkId[]): Loadout {
  const owned = perks.filter((p): p is WeaponId => isWeaponId(p));
  const weapons = owned.length <= MAX_LOADOUT_WEAPONS ? [...owned]
    : (() => { const keep = new Set(byRarity(owned).slice(0, MAX_LOADOUT_WEAPONS)); return owned.filter((w) => keep.has(w)); })();
  const shield = perks.find((p): p is ShieldId => isShieldId(p)) ?? null;
  const pets = perks.filter((p): p is CompanionId => isCompanionId(p));
  const gear: Partial<Record<GearSlot, GearId>> = {};
  for (const g of byRarity(perks.filter((p): p is GearId => isGearId(p)))) {
    const slot = gearSlot(g);
    if (gear[slot] === undefined) gear[slot] = g;
  }
  return { weapons, shield, pets, gear };
}

/**
 * A stored loadout read against what is owned: weapons owned (each once, in the order given), at
 * most MAX_LOADOUT_WEAPONS; an empty bag gets the first weapon of the default loadout when any is
 * owned; a shield or a piece of gear not owned (or in the wrong slot) is dropped; pets up to the
 * number of each owned. With none stored, the default loadout.
 */
export function resolveLoadout(perks: readonly PerkId[], stored: Loadout | undefined): Loadout {
  if (stored === undefined) return defaultLoadout(perks);
  const weapons: WeaponId[] = [];
  for (const w of Array.isArray(stored.weapons) ? stored.weapons : []) {
    if (typeof w === "string" && isWeaponId(w) && perks.includes(w) && !weapons.includes(w) && weapons.length < MAX_LOADOUT_WEAPONS) weapons.push(w);
  }
  if (weapons.length === 0) {
    const first = defaultLoadout(perks).weapons[0];
    if (first !== undefined) weapons.push(first);
  }
  const shield = typeof stored.shield === "string" && isShieldId(stored.shield) && perks.includes(stored.shield) ? stored.shield : null;
  const pets: CompanionId[] = [];
  for (const p of Array.isArray(stored.pets) ? stored.pets : []) {
    if (typeof p !== "string" || !isCompanionId(p)) continue;
    if (pets.filter((x) => x === p).length < perks.filter((x) => x === p).length) pets.push(p);
  }
  const gear: Partial<Record<GearSlot, GearId>> = {};
  const raw = stored.gear !== null && typeof stored.gear === "object" ? stored.gear : {};
  for (const slot of GEAR_SLOTS) {
    const g = (raw as Record<string, unknown>)[slot];
    if (typeof g === "string" && isGearId(g) && perks.includes(g) && gearSlot(g) === slot) gear[slot] = g;
  }
  return { weapons, shield, pets, gear };
}

/** The gear of a loadout, in slot order. */
export function wornGear(l: Loadout): GearId[] {
  const out: GearId[] = [];
  for (const slot of GEAR_SLOTS) { const g = l.gear[slot]; if (g !== undefined) out.push(g); }
  return out;
}

/** The perks a bout's snapshot holds for this loadout: the kit's own order, every skill, and of the
 *  rest only what the loadout takes (a pet as many times as the loadout names it). */
export function loadoutPerks(perks: readonly PerkId[], l: Loadout): PerkId[] {
  const petsLeft = new Map<string, number>();
  for (const p of l.pets) petsLeft.set(p, (petsLeft.get(p) ?? 0) + 1);
  const worn = new Set<string>(wornGear(l));
  const out: PerkId[] = [];
  for (const p of perks) {
    if (isWeaponId(p)) { if (l.weapons.includes(p)) out.push(p); continue; }
    if (isShieldId(p)) { if (l.shield === p) out.push(p); continue; }
    if (isCompanionId(p)) {
      const left = petsLeft.get(p) ?? 0;
      if (left > 0) { out.push(p); petsLeft.set(p, left - 1); }
      continue;
    }
    if (isGearId(p)) { if (worn.has(p)) { out.push(p); worn.delete(p); } continue; }
    out.push(p);
  }
  return out;
}

/** The stats with the stat points of the worn gear added (never below 0). */
export function statsWithGear(stats: StatBlock, worn: readonly GearId[]): StatBlock {
  if (worn.length === 0) return stats;
  const d = draftOf(stats);
  for (const g of worn) for (const k of GEAR_STAT_KEYS) d.points[k] = Math.max(0, d.points[k] + gn(g, k));
  return freeze(d);
}
