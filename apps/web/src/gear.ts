/**
 * Gear — equipment earned from RANDOM level-up drops (never chosen, MyBrute
 * style). Armour is real: an equipped piece swaps the outfit layer on the
 * paper-doll, so a hunter who finds plate is visibly wearing plate.
 *
 *   armour  → torso layer + colour (paperdoll TORSOS / CLOTH_COLORS)
 *   cloak   → aura colour (AURAS index) — the glow around the fighter
 *   trinket → particle effect in combat
 *   title   → epithet shown on the champion card
 */

import { makeRng } from "@agoge/core";
import { CLOTH_COLORS, TORSOS, torsosFor, type Look } from "./paperdoll.js";

export type GearSlot = "body" | "cloak" | "trinket" | "title";
export type ParticleKind = "embers" | "petals" | "snow" | "fireflies" | "storm";

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  flavour: string;
  /** armour: the outfit it puts on (index into paperdoll TORSOS + colours) */
  torso?: number;
  torsoColor?: number;
  aura?: number;
  particles?: ParticleKind;
}

const armour = (id: string, name: string, torso: number, torsoColor: number, flavour: string): GearItem => ({
  id, name, slot: "body", torso, torsoColor, flavour,
});

/* Torso indices: 1 plate · 2 legion · 3 overalls · 4 suspenders — the pieces
   cut for both builds, so any drop fits any hunter. */
const ARMOUR: GearItem[] = [
  armour("g_plate_iron", "Iron Plate", 1, 2, "Dented in places you don't ask about."),
  armour("g_plate_ember", "Ember-Forged Plate", 1, 5, "Quenched in rift-fire."),
  armour("g_plate_gilded", "Gilded Plate", 1, 7, "Blinds before the blade does."),
  armour("g_plate_tide", "Tidewrought Plate", 1, 11, "Cooled in the deep channels."),
  armour("g_plate_void", "Voidiron Plate", 1, 3, "Drinks the light around it."),
  armour("g_plate_verdant", "Verdant Plate", 1, 9, "The grove approves."),
  armour("g_legion_steel", "Legion Harness", 2, 1, "Standard issue, non-standard survivor."),
  armour("g_legion_crimson", "Crimson Legion Harness", 2, 4, "Never washes out. Never needs to."),
  armour("g_legion_storm", "Stormguard Harness", 2, 12, "Thunder answers it."),
  armour("g_legion_bone", "Bonewhite Harness", 2, 0, "Worn once, at the last duel."),
  armour("g_legion_plum", "Duskward Harness", 2, 14, "Cut for the hour between dog and wolf."),
  armour("g_over_leather", "Rift-Runner's Rig", 3, 17, "Pockets full of things that shouldn't be."),
  armour("g_over_moss", "Mosswalker's Rig", 3, 8, "The forest keeps its secrets."),
  armour("g_over_ash", "Ashfall Rig", 3, 1, "Smells faintly of the last arena."),
  armour("g_over_rose", "Festival Rig", 3, 15, "Won at a spring tournament. Barely."),
  armour("g_susp_sand", "Duelist's Straps", 4, 16, "Nothing to slow the arms down."),
  armour("g_susp_ink", "Nightwork Straps", 4, 3, "For fights that don't get reported."),
  armour("g_susp_amber", "Sunward Straps", 4, 6, "Catches the light on the turn."),
];

const CLOAKS: GearItem[] = [
  { id: "g_cloak_violet", name: "Mantle of Violet Dusk", slot: "cloak", aura: 0, flavour: "Woven at twilight." },
  { id: "g_cloak_gold", name: "Golden Mantle", slot: "cloak", aura: 1, flavour: "A champion's colours." },
  { id: "g_cloak_blood", name: "Bloodsilk Mantle", slot: "cloak", aura: 2, flavour: "The last thing seen. Briefly." },
  { id: "g_cloak_tide", name: "Tidewater Mantle", slot: "cloak", aura: 3, flavour: "Calm before every storm." },
  { id: "g_cloak_verdant", name: "Verdant Mantle", slot: "cloak", aura: 4, flavour: "The grove approves." },
  { id: "g_cloak_rose", name: "Rosewind Mantle", slot: "cloak", aura: 5, flavour: "Petals follow it home." },
  { id: "g_cloak_ivory", name: "Ivory Mantle", slot: "cloak", aura: 6, flavour: "Worn once, at the last duel." },
  { id: "g_cloak_storm", name: "Stormcall Mantle", slot: "cloak", aura: 7, flavour: "Thunder answers it." },
];

const TRINKETS: GearItem[] = [
  { id: "g_char_ember", name: "Ember Charm", slot: "trinket", particles: "embers", flavour: "Sparks rise where you stand." },
  { id: "g_char_petal", name: "Petalfall Charm", slot: "trinket", particles: "petals", flavour: "Every duel is a spring festival." },
  { id: "g_char_snow", name: "Snowveil Charm", slot: "trinket", particles: "snow", flavour: "Winter keeps its own counsel." },
  { id: "g_char_firefly", name: "Firefly Lantern", slot: "trinket", particles: "fireflies", flavour: "Small lights, long roads." },
  { id: "g_char_storm", name: "Storm Bell", slot: "trinket", particles: "storm", flavour: "Rings once before the lightning." },
];

const TITLES: GearItem[] = [
  { id: "g_t_patient", name: "the Patient Blade", slot: "title", flavour: "Waits. Wins." },
  { id: "g_t_oni", name: "Oni-Slayer", slot: "title", flavour: "The hounds remember." },
  { id: "g_t_dawn", name: "First Light of Dawn", slot: "title", flavour: "The arena wakes with them." },
  { id: "g_t_unbroken", name: "the Unbroken", slot: "title", flavour: "Knocked down nine times. Stood up ten." },
  { id: "g_t_rift", name: "Rift-Tested", slot: "title", flavour: "Went in. Came back. Says nothing." },
  { id: "g_t_silent", name: "the Silent", slot: "title", flavour: "The crowd hushes on instinct." },
  { id: "g_t_fangs", name: "Twin Fangs", slot: "title", flavour: "One blade lies. The other tells the truth." },
  { id: "g_t_shadow", name: "Shadow of the Grove", slot: "title", flavour: "The trees tell no one." },
  { id: "g_t_untraced", name: "the Untraceable", slot: "title", flavour: "Officially, was never here." },
  { id: "g_t_night", name: "Night's Edge", slot: "title", flavour: "Where the dark gets sharp." },
];

export const GEAR: GearItem[] = [...ARMOUR, ...CLOAKS, ...TRINKETS, ...TITLES];

const byId = new Map(GEAR.map((g) => [g.id, g] as const));

export function gearItem(id: string): GearItem | undefined {
  return byId.get(id);
}

/** Everything a hunter can ever find. */
export function gearPool(): GearItem[] {
  return GEAR;
}

/**
 * Roll the next random drop — always an unowned piece while any remain
 * (seeded, so the same champion at the same moment always rolls the same).
 * Returns undefined when the wardrobe is complete.
 */
export function rollGearDrop(owned: string[], seed: number): GearItem | undefined {
  const pool = GEAR.filter((g) => !owned.includes(g.id));
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

/** Describe a piece in one short line for the wardrobe chips. */
export function gearDetail(g: GearItem): string {
  if (g.slot === "body" && g.torso != null) {
    return `${TORSOS[g.torso]?.name ?? "Outfit"} · ${CLOTH_COLORS[g.torsoColor ?? 0]?.name ?? ""}`;
  }
  if (g.slot === "cloak") return "Aura";
  if (g.slot === "trinket") return "Combat effect";
  return "Title";
}

/** The look actually rendered: the hunter's own, with worn armour over it. */
export function lookWithGear(look: Look, equipped: Equipped | undefined): Look {
  const body = equipped?.body ? gearItem(equipped.body) : undefined;
  if (!body || body.torso == null) return look;
  // Armour is cut for both builds, but stay safe if a piece ever isn't.
  if (!torsosFor(look.build).includes(body.torso)) return look;
  return { ...look, torso: body.torso, torsoColor: body.torsoColor ?? look.torsoColor };
}

/** Aura, particles and title once equipped gear overrides the base picks. */
export function resolveExtras(
  baseAura: number,
  equipped: Equipped | undefined,
): { aura: number; particles?: ParticleKind; title?: string } {
  const cloak = equipped?.cloak ? gearItem(equipped.cloak) : undefined;
  const trinket = equipped?.trinket ? gearItem(equipped.trinket) : undefined;
  const title = equipped?.title ? gearItem(equipped.title) : undefined;
  return {
    aura: cloak?.aura ?? baseAura,
    particles: trinket?.particles,
    title: title?.name,
  };
}
