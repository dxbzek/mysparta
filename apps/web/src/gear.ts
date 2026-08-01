/**
 * Gear — cosmetic equipment earned from RANDOM level-up drops (never chosen,
 * MyBrute style). Every item is themed to its fighter: the Ronin collects
 * samurai lacquer and haori, the Shinobi collects shozoku and kage mantles.
 *
 * Visuals ride the systems the animated sprites support cleanly:
 *   body    → palette grade (STYLES index)  — "armor" recolours the outfit
 *   cloak   → aura colour (AURAS index)     — the glow around the fighter
 *   trinket → particle effect in combat
 *   title   → epithet shown on the champion card
 */

import { makeRng } from "@agoge/core";

export type GearSlot = "body" | "cloak" | "trinket" | "title";
export type ParticleKind = "embers" | "petals" | "snow" | "fireflies" | "storm";

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  /** fighter index this piece belongs to (0 Ronin, 1 Shinobi) */
  fighter: number;
  flavour: string;
  /** exactly one of these is set, per slot */
  style?: number;
  aura?: number;
  particles?: ParticleKind;
}

const ronin: GearItem[] = [
  // body — lacquered dō (STYLES 1-4)
  { id: "r_do_ember", name: "Ember-Lacquered Dō", slot: "body", fighter: 0, style: 1, flavour: "Armor quenched in rift-fire." },
  { id: "r_do_frost", name: "Frost-Tempered Dō", slot: "body", fighter: 0, style: 2, flavour: "Cooled in the Frozen Grove." },
  { id: "r_do_void", name: "Void-Iron Dō", slot: "body", fighter: 0, style: 3, flavour: "Drinks the light around it." },
  { id: "r_do_sun", name: "Sun-Polished Dō", slot: "body", fighter: 0, style: 4, flavour: "Blinds before the blade does." },
  // cloak — haori (AURAS 0-7)
  { id: "r_haori_violet", name: "Haori of Violet Dusk", slot: "cloak", fighter: 0, aura: 0, flavour: "Woven at twilight." },
  { id: "r_haori_gold", name: "Golden Haori", slot: "cloak", fighter: 0, aura: 1, flavour: "A champion's colours." },
  { id: "r_haori_blood", name: "Bloodsilk Haori", slot: "cloak", fighter: 0, aura: 2, flavour: "Never washes out. Never needs to." },
  { id: "r_haori_tide", name: "Tidewater Haori", slot: "cloak", fighter: 0, aura: 3, flavour: "Calm before every storm." },
  { id: "r_haori_verdant", name: "Verdant Haori", slot: "cloak", fighter: 0, aura: 4, flavour: "The grove approves." },
  { id: "r_haori_rose", name: "Rosewind Haori", slot: "cloak", fighter: 0, aura: 5, flavour: "Petals follow it home." },
  { id: "r_haori_ivory", name: "Ivory Haori", slot: "cloak", fighter: 0, aura: 6, flavour: "Worn once, at the last duel." },
  { id: "r_haori_storm", name: "Stormcall Haori", slot: "cloak", fighter: 0, aura: 7, flavour: "Thunder answers it." },
  // trinket — charms
  { id: "r_charm_ember", name: "Ember Charm", slot: "trinket", fighter: 0, particles: "embers", flavour: "Sparks rise where the Ronin stands." },
  { id: "r_charm_petal", name: "Petalfall Charm", slot: "trinket", fighter: 0, particles: "petals", flavour: "Every duel is a spring festival." },
  { id: "r_charm_snow", name: "Snowveil Charm", slot: "trinket", fighter: 0, particles: "snow", flavour: "Winter keeps its own counsel." },
  { id: "r_charm_firefly", name: "Firefly Lantern", slot: "trinket", fighter: 0, particles: "fireflies", flavour: "Small lights, long roads." },
  { id: "r_charm_storm", name: "Storm Bell", slot: "trinket", fighter: 0, particles: "storm", flavour: "Rings once before the lightning." },
  // titles
  { id: "r_title_patient", name: "the Patient Blade", slot: "title", fighter: 0, flavour: "Waits. Wins." },
  { id: "r_title_oni", name: "Oni-Slayer", slot: "title", fighter: 0, flavour: "The hounds remember." },
  { id: "r_title_dawn", name: "First Light of Dawn", slot: "title", fighter: 0, flavour: "The arena wakes with them." },
  { id: "r_title_unbroken", name: "the Unbroken", slot: "title", fighter: 0, flavour: "Knocked down nine times. Stood up ten." },
  { id: "r_title_rift", name: "Rift-Tested", slot: "title", fighter: 0, flavour: "Went in. Came back. Says nothing." },
];

const shinobi: GearItem[] = [
  // body — shozoku
  { id: "s_shz_ember", name: "Emberweave Shozoku", slot: "body", fighter: 1, style: 1, flavour: "Smoke that chose a shape." },
  { id: "s_shz_frost", name: "Frostrun Shozoku", slot: "body", fighter: 1, style: 2, flavour: "Leaves no prints in snow." },
  { id: "s_shz_void", name: "Voidcloth Shozoku", slot: "body", fighter: 1, style: 3, flavour: "Darker than the night around it." },
  { id: "s_shz_sun", name: "Dawnsilk Shozoku", slot: "body", fighter: 1, style: 4, flavour: "Vanishes into morning light." },
  // cloak — kage mantles
  { id: "s_kage_violet", name: "Kage Mantle of Dusk", slot: "cloak", fighter: 1, aura: 0, flavour: "Cut from the hour between dog and wolf." },
  { id: "s_kage_gold", name: "Gilded Kage Mantle", slot: "cloak", fighter: 1, aura: 1, flavour: "Stolen from a shogun's vault." },
  { id: "s_kage_blood", name: "Crimson Kage Mantle", slot: "cloak", fighter: 1, aura: 2, flavour: "The last thing seen. Briefly." },
  { id: "s_kage_tide", name: "Rivermist Kage Mantle", slot: "cloak", fighter: 1, aura: 3, flavour: "Flows around every guard." },
  { id: "s_kage_verdant", name: "Mosswalk Kage Mantle", slot: "cloak", fighter: 1, aura: 4, flavour: "The forest keeps its secrets." },
  { id: "s_kage_rose", name: "Petalshade Kage Mantle", slot: "cloak", fighter: 1, aura: 5, flavour: "Beauty is excellent cover." },
  { id: "s_kage_ivory", name: "Ghostweave Kage Mantle", slot: "cloak", fighter: 1, aura: 6, flavour: "Seen only by the defeated." },
  { id: "s_kage_storm", name: "Thunderhide Kage Mantle", slot: "cloak", fighter: 1, aura: 7, flavour: "Moves between the lightning." },
  // trinket — vials & tags
  { id: "s_vial_ember", name: "Ashfire Vial", slot: "trinket", fighter: 1, particles: "embers", flavour: "Breaks into burning sparks." },
  { id: "s_vial_petal", name: "Sakura Smoke Vial", slot: "trinket", fighter: 1, particles: "petals", flavour: "A distraction with style." },
  { id: "s_vial_snow", name: "Hoarfrost Vial", slot: "trinket", fighter: 1, particles: "snow", flavour: "The cold travels with you." },
  { id: "s_vial_firefly", name: "Spirit-Moth Cage", slot: "trinket", fighter: 1, particles: "fireflies", flavour: "They only follow the quiet ones." },
  { id: "s_vial_storm", name: "Raijin Tag", slot: "trinket", fighter: 1, particles: "storm", flavour: "Borrowed thunder, never returned." },
  // titles
  { id: "s_title_silent", name: "the Silent", slot: "title", fighter: 1, flavour: "The crowd hushes on instinct." },
  { id: "s_title_fangs", name: "Twin Fangs", slot: "title", fighter: 1, flavour: "One blade lies. The other tells the truth." },
  { id: "s_title_shadow", name: "Shadow of the Grove", slot: "title", fighter: 1, flavour: "The trees tell no one." },
  { id: "s_title_untraced", name: "the Untraceable", slot: "title", fighter: 1, flavour: "Officially, was never here." },
  { id: "s_title_night", name: "Night's Edge", slot: "title", fighter: 1, flavour: "Where the dark gets sharp." },
];

export const GEAR: GearItem[] = [...ronin, ...shinobi];

const byId = new Map(GEAR.map((g) => [g.id, g] as const));

export function gearItem(id: string): GearItem | undefined {
  return byId.get(id);
}

/** All items a given fighter can ever drop. */
export function gearPoolFor(fighter: number): GearItem[] {
  return GEAR.filter((g) => g.fighter === fighter % 2);
}

/**
 * Roll the next random drop — always an unowned piece while any remain
 * (seeded, so the same champion at the same moment always rolls the same).
 * Returns undefined when the wardrobe is complete.
 */
export function rollGearDrop(fighter: number, owned: string[], seed: number): GearItem | undefined {
  const pool = gearPoolFor(fighter).filter((g) => !owned.includes(g.id));
  if (pool.length === 0) return undefined;
  const rng = makeRng(seed);
  return pool[rng.int(pool.length)];
}

export interface Equipped {
  body?: string;
  cloak?: string;
  trinket?: string;
  title?: string;
}

/** The final look once equipped gear overrides the forge picks. */
export function resolveLook(
  base: { style: number; aura: number },
  equipped: Equipped | undefined,
): { style: number; aura: number; particles?: ParticleKind; title?: string } {
  const body = equipped?.body ? gearItem(equipped.body) : undefined;
  const cloak = equipped?.cloak ? gearItem(equipped.cloak) : undefined;
  const trinket = equipped?.trinket ? gearItem(equipped.trinket) : undefined;
  const title = equipped?.title ? gearItem(equipped.title) : undefined;
  return {
    style: body?.style ?? base.style,
    aura: cloak?.aura ?? base.aura,
    particles: trinket?.particles,
    title: title?.name,
  };
}
