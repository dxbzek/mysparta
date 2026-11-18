/**
 * The body equipment table (content v3, batch 2, plan 13.12). Identity facts (slot, rarity, what the
 * object is) come from the frozen GEAR_META; this file adds the tunable numbers. What each number
 * does is written on `GearNumbers` in the contract, and every row is in docs/RULES.md 6c. One small
 * bonus each, sometimes a small cost.
 */
import type { GearId, GearSlot } from "../contracts/ids";
import { GEAR_IDS } from "../contracts/ids";
import type { GearDef, GearKey, GearNumbers } from "../contracts/content";
import { GEAR_META } from "../contracts/content";

const ROWS: Readonly<Record<GearId, GearNumbers>> = {
  // head
  "bandana":          { precision: 2 },                 // sweat out of the eyes
  "beanie":           { health: 2 },                    // warm and a little padded
  "hard-hat":         { armor: 10 },                     // a shell over the skull
  "goggles":          { aim: 6, sandProof: 1 },         // eyes covered: the aim stays, and sand bounces off
  "welding-mask":     { critCut: 30, aim: -3 },         // a clean blow to the face lands softer; a narrow slot to see through
  "motorbike-helmet": { headTough: 9, speed: -1 },      // Toughness against blows to the head; heavy
  // torso
  "work-vest":        { toughness: 2 },
  "hi-vis-vest":      { petEvade: 15 },                 // the pets see it coming
  "padded-jacket":    { soak: 1, agility: -1 },
  "leather-jacket":   { riposte: 12 },
  "hockey-chest-pad": { block: 10 },
  "tyre-rubber-vest": { armor: 15, speed: -1 },
  // hands
  "work-gloves":      { grip: 10 },
  "taped-fists":      { fistDmg: 60 },
  "rubber-gloves":    { snatchResist: 75 },             // slippery to take a weapon from
  "fingerless-gloves":{ combo: 9 },
  "oven-mitts":       { thrownBlock: 20, combo: -4 },   // catch what is thrown; clumsy fingers
  "welding-gloves":   { strength: 3, precision: -1 },
  // legs
  "ripped-jeans":     { agility: 2 },
  "cargo-pants":      { drawEase: 3 },                  // the next weapon is close to hand
  "knee-pads":        { moveSoak: 8 },                  // a slam or a hold to the floor hurts less
  "track-pants":      { speed: 2 },
  "magazine-shin-guards": { petSoak: 4 },               // pets bite at the shins
  "overalls":         { toughness: 4 },
  // feet
  "sneakers":         { evade: 7 },
  "flip-flops":       { speed: 3, evade: -6 },
  "rain-boots":       { snareCut: 2 },                  // the tarp slides off sooner
  "skate-shoes":      { intercept: 12 },
  "steel-toe-boots":  { disarm: 12 },                    // a stamp on the foot loosens the grip
  "slippers":         { startClock: -100 },              // quiet feet: in first
};

function build(): Record<GearId, GearDef> {
  const out = {} as Record<GearId, GearDef>;
  for (const id of GEAR_IDS) out[id] = { id, slot: GEAR_META[id].slot, rarity: GEAR_META[id].rarity, tiers: [ROWS[id]] };
  return out;
}

/** All 30 pieces of gear. */
export const GEAR: Readonly<Record<GearId, GearDef>> = build();

/** One number of a piece of gear (0 when it has none, or the id is unknown). */
export function gn(id: GearId, key: GearKey): number {
  const def = (GEAR as Record<string, GearDef | undefined>)[id];
  const v = def === undefined ? undefined : def.tiers[0][key];
  return v === undefined ? 0 : v;
}

/** The slot a piece of gear is worn in. */
export function gearSlot(id: GearId): GearSlot {
  return GEAR_META[id].slot;
}

/** The six stat keys of a gear row (added to the snapshot's points, not by the sim). */
export const GEAR_STAT_KEYS = ["health", "strength", "agility", "speed", "toughness", "precision"] as const;

/** The sum of one number over several worn pieces. */
export function gearSum(worn: readonly GearId[], key: GearKey): number {
  let s = 0;
  for (const g of worn) s += gn(g, key);
  return s;
}
