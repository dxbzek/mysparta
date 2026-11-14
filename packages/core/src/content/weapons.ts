/**
 * The weapon table (work package 1). Identity facts (rarity, tags, clip, Reach) come from the
 * frozen WEAPON_META, so there is one copy of each. This file adds the tunable numbers.
 * Reach is null for a Thrown weapon: it counts as 0 for every rule that reads Reach.
 * Every number that differs from the starting table is listed in docs/RULES.md.
 */
import type { HeldId } from "../contracts/ids";
import type { WeaponDef, WeaponNumbers } from "../contracts/content";
import { WEAPON_META } from "../contracts/content";

type Row = Omit<WeaponNumbers, "reach">;

/** tempo, dmg, draw, aim, pierce, block, evade, riposte, combo, disarm, crit */
function row(tempo: number, dmg: number, draw: number, aim: number, pierce: number, block: number,
  evade: number, riposte: number, combo: number, disarm: number, crit: number): Row {
  return { tempo, dmg, draw, aim, pierce, block, evade, riposte, combo, disarm, crit };
}

const ROWS: Readonly<Record<HeldId, Row>> = {
  //                         tempo dmg draw  aim pierce block evade ripo combo disarm crit
  "fists":           row(100,   5,  0,    0,   0,    0,    0,    0,   0,    0,    0),
  "pipe":            row(110,  11,  5,    0,   0,   12,    0,    5,   0,   10,   10),
  "pocket-knife":    row( 65,   6,  5,   25,   0,    0,    5,    0,  35,    0,   10),
  "broom":           row(100,   6,  4,    0,   0,   20,    5,   28,  10,   15,    5),
  "machete":         row(115,  10,  5,    5,   0,    5,    0,    5,   5,    5,   30),
  "hand-axe":        row(145,  15,  4,    0,  15,   -5,    0,    0,   0,    5,   15),
  "bat":             row(120,  12,  5,    0,  10,    5,    0,   18,   0,    5,   15),
  "pitchfork":       row(130,  13,  3,    0,   0,    5,    0,    0,   0,    5,   10),
  "crowbar":         row(140,  15,  4,  -10,  20,    5,    0,    0,   0,   25,    5),
  "knuckle-dusters": row( 70,   7,  5,   10,  10,    0,    5,    0,  28,    0,   10),
  "bin-lid":         row(100,   8,  3,    0,   0,   40,    0,   35, -10,    0,    0),
  "shovel":          row(150,  15,  3,  -10,  10,   18,   -5,    5, -10,   10,    5),
  "sledgehammer":    row(180,  31,  5,  -30,  30,  -20,  -20,  -20, -40,   10,   10),
  "darts":           row( 45,   3,  5,    0,   0,   -5,   12,    0,  30,    0,    5),
  "bike-chain":      row(140,  10,  5,   30, -10,  -15,   20,   -5,  30,   25,    0),
  "monkey-wrench":   row(130,  12,  4,    0,  10,   10,    0,    0,   0,   60,    5),
  "pickaxe":         row(160,  19,  4,  -20, 100,  -10,  -10,    0, -10,   10,   10),
  "rebar":           row(170,  22,  5,   10, -10,    5,  -15,    0,   0,   10,   10),
  "screwdrivers":    row( 65,   6,  5,   20,   0,   15,    5,    0,  35,   45,    5),
  "garden-shears":   row( 75,   8,  4,   15,   0,    5,    0,    5,  20,   10,   15),
  "stop-sign":       row(175,  23,  3,  -30,   0,   10,    0,    0,   5,   10,    5),
  "boomerang":       row( 70,   8,  4,    0,   0,   -5,   10,    0,  20,   10,   10),
  "anvil":           row(240,  48,  5,  -35,  50,  -30,  -30,  -20, -40,   15,    5),
  "ball-and-chain":  row(215,  34,  5,  -30, 100,  -40,  -25,    0,  12,  -10,    0),
  "umbrella":        row( 50,   4,  5,   40,   0,  -30,   45,   40,  40,  -20,    0),
  "pool-cue":        row( 85,   8,  4,   20,   0,   10,   10,   10,  22,   10,   10),
  "bricks":          row(100,  13,  4,  -10,   0,  -10,    0,    0,   0,   20,   15),
  "rubber-chicken":  row( 90,   5,  3,   35, 100,  -20,    0,   60,  70,    0,    0),
  "lawn-flamingo":   row(120,  13,  3,   20,   0,    0,   30,   30,  20,   30,   35),
};

function build(): Record<HeldId, WeaponDef> {
  const out = {} as Record<HeldId, WeaponDef>;
  for (const id of Object.keys(ROWS) as HeldId[]) {
    const meta = WEAPON_META[id];
    const r = ROWS[id];
    const thrown = meta.tags.includes("thrown");
    out[id] = {
      id, rarity: meta.rarity, tags: meta.tags, clip: meta.clip,
      tiers: [{ ...r, reach: thrown ? null : meta.reach }],
    };
  }
  return out;
}

/** All 29 held items: the 28 weapons and fists. */
export const WEAPONS: Readonly<Record<HeldId, WeaponDef>> = build();

/** The numbers of a held item. An unknown id (a damaged save) warns once and gives fists. */
const warned = new Set<string>();
export function weaponNumbers(id: HeldId): WeaponNumbers {
  const def = WEAPONS[id];
  if (def === undefined) {
    if (!warned.has(id)) { warned.add(id); console.warn(`unknown weapon id "${id}", using fists`); }
    return WEAPONS.fists.tiers[0];
  }
  return def.tiers[0];
}

/** Reach as every rule reads it: a Thrown weapon counts as 0. */
export function reachOf(id: HeldId): number {
  const r = weaponNumbers(id).reach;
  return r === null ? 0 : r;
}

export function hasTag(id: HeldId, tag: "light" | "heavy" | "pole" | "thrown" | "blade"): boolean {
  const def = WEAPONS[id];
  return def !== undefined && def.tags.includes(tag);
}
