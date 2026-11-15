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
  "pipe":            row(110,  12,  5,    0,   0,   12,    0,    5,   0,   10,   10),
  "pocket-knife":    row( 65,   6,  5,   25,   0,    0,    5,    0,  35,    0,   10),
  "broom":           row(100,   6,  4,    0,   0,   20,    5,   28,  10,   15,    5),
  "machete":         row(115,  11,  5,    5,   0,    5,    0,    5,   5,    5,   30),
  "hand-axe":        row(145,  15,  4,    0,  15,   -5,    0,    0,   0,    5,   15),
  "bat":             row(120,  12,  5,    0,  10,    5,    0,   18,   0,    5,   15),
  "pitchfork":       row(130,  14,  3,    0,   0,    5,    0,    0,   0,    5,   10),
  "crowbar":         row(140,  16,  4,  -10,  20,    5,    0,    0,   0,   25,    5),
  "knuckle-dusters": row( 70,   7,  5,   10,  10,    0,    5,    0,  28,    0,   10),
  "shovel":          row(150,  15,  3,  -10,  10,   18,   -5,    5, -10,   10,    5),
  "sledgehammer":    row(180,  34,  5,  -30,  30,  -20,  -20,  -20, -40,   10,   10),
  "darts":           row( 45,   3,  5,    0,   0,   -5,   12,    0,  30,    0,    5),
  "bike-chain":      row(140,  10,  5,   30, -10,  -15,   20,   -5,  30,   25,    0),
  "monkey-wrench":   row(130,  12,  4,    0,  10,   10,    0,    0,   0,   60,    5),
  "pickaxe":         row(160,  19,  4,  -20, 100,  -10,  -10,    0, -10,   10,   10),
  "rebar":           row(170,  22,  5,   10, -10,    5,  -15,    0,   0,   10,   10),
  "screwdrivers":    row( 65,   6,  5,   20,   0,   15,    5,    0,  35,   45,    5),
  "garden-shears":   row( 75,   8,  4,   15,   0,    5,    0,    5,  20,   10,   15),
  "stop-sign":       row(175,  23,  3,  -30,   0,   10,    0,    0,   5,   10,    5),
  "boomerang":       row( 70,   8,  4,    0,   0,   -5,   10,    0,  20,   10,   10),
  "anvil":           row(240,  48,  5,  -30,  50,  -30,  -30,  -20, -40,   15,    5),
  "ball-and-chain":  row(215,  34,  5,  -30, 100,  -40,  -25,    0,  12,  -10,    0),
  "umbrella":        row( 50,   4,  5,   40,   0,  -30,   45,   40,  40,  -20,    0),
  "pool-cue":        row( 85,   8,  4,   20,   0,   10,   10,   10,  22,   10,   10),
  "bricks":          row(100,  13,  4,  -10,   0,  -10,    0,    0,   0,   20,   15),
  "rubber-chicken":  row( 90,   5,  3,   35, 100,  -20,    0,   60,  70,    0,    0),
  "lawn-flamingo":   row(120,  13,  3,   20,   0,    0,   30,   30,  20,   30,   35),
  // content v2, melee. Roles: parry pan, quick club, long crit swing, hooking stick, blocking
  // chair, heavy hitter with a riposte, blocking heavy pan, joke disarmer.
  "frying-pan":      row(105,  11,  5,    0,   0,   22,    0,   28,  -5,    5,    5),
  "tyre-iron":       row(100,  11,  5,    5,  15,    5,    0,    0,   5,   10,   15),
  "golf-club":       row(125,  14,  4,    5,   0,    0,    0,    5,   0,    5,   30),
  "hockey-stick":    row(115,  11,  4,   10,   0,   10,    5,   10,  15,   30,    5),
  "folding-chair":   row(160,  20,  4,  -15,  15,   20,  -10,    0, -15,   15,    5),
  "cricket-bat":     row(140,  19,  4,    5,  10,   15,    0,   20,   0,   10,   15),
  "wok":             row(135,  16,  4,    0,  10,   30,    0,   20, -10,   10,   10),
  "plunger":         row( 90,   7,  3,   40,  40,    0,   10,   20,  30,   70,   10),
  // content v2, Thrown. Roles: cheap fast lobs, a bounce that slips past a block, a heavy can,
  // an aimed cone, a spinning disc that crits, a rolling tyre that bowls through a guard.
  "plastic-bottle":  row( 70,   7,  5,    5,   0,    0,   10,    0,  25,    0,    5),
  "rubber-ball":     row( 75,   7,  5,   10,  30,    0,    5,    0,  25,    0,    5),
  "paint-can":       row( 95,  15,  4,   -5,   0,   -5,    0,    0,   0,   15,   15),
  "traffic-cone":    row( 95,  12,  4,   15,   0,    0,    5,    0,  10,    5,   10),
  "hubcap":          row( 90,  14,  4,   10,  25,   -5,    5,    0,  15,    5,   20),
  "tyre":            row(120,  25,  4,    0,  40,  -10,   -5,    0,   0,   25,   10),
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

/** All 42 held items: the 41 weapons and fists. */
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
