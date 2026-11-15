/**
 * The shield table (work package 1). Identity facts (rarity, how it is carried) come from the
 * frozen SHIELD_META; this file adds the tunable numbers. What each number does is written on
 * `ShieldNumbers` in the contract. Every number is listed in docs/RULES.md.
 */
import type { ShieldId } from "../contracts/ids";
import type { ShieldDef, ShieldNumbers } from "../contracts/content";
import { SHIELD_META } from "../contracts/content";

/** block, thrownBlock, armor, riposte, damage, tempo, knock */
function row(block: number, thrownBlock: number, armor: number, riposte: number, damage: number, tempo: number,
  knock: number): ShieldNumbers {
  return { block, thrownBlock, armor, riposte, damage, tempo, knock };
}

const ROWS: Readonly<Record<ShieldId, ShieldNumbers>> = {
  //                       block thrown armor ripo  dmg tempo knock
  "car-door":       row(  32,    0,    0,    0, -20,    0,   33),   // the first shield: big block, hits softer
  "bin-lid":        row(  16,    0,    0,   15,  -5,    0,   45),   // light and cheap, a little riposte
  "wooden-pallet":  row(  30,    0,    6,    0,   0,   15,   25),   // a wall: block and armor, slow, hard to knock off
  "ironing-board":  row(  14,   30,    0,    0, -10,    0,   40),   // long: the best cover against a throw
  "skateboard":     row(  10,    0,    0,   30,   0,    0,   50),   // small block, then the answer
  "riot-shield":    row(  38,   10,    5,    0, -15,   10,   30),   // the biggest cover there is
};

function build(): Record<ShieldId, ShieldDef> {
  const out = {} as Record<ShieldId, ShieldDef>;
  for (const id of Object.keys(ROWS) as ShieldId[]) out[id] = { id, rarity: SHIELD_META[id].rarity, tiers: [ROWS[id]] };
  return out;
}

/** All six shields. */
export const SHIELDS: Readonly<Record<ShieldId, ShieldDef>> = build();

const NONE: ShieldNumbers = row(0, 0, 0, 0, 0, 0, 0);
/** The numbers of a carried shield; null (no shield) gives all zeros. */
export function shieldNumbers(id: ShieldId | null): ShieldNumbers {
  if (id === null) return NONE;
  const def = SHIELDS[id];
  return def === undefined ? NONE : def.tiers[0];
}
