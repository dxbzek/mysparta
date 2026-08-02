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

import { makeRng, type StatName } from "@agoge/core";
import { CLOTH_COLORS, TORSOS, torsosFor, type Look } from "./paperdoll.js";

export type GearSlot = "body" | "helm" | "cloak" | "trinket" | "title";
export type ParticleKind = "embers" | "petals" | "snow" | "fireflies" | "storm";

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  flavour: string;
  /** armour: the outfit it puts on (index into paperdoll TORSOS + colours) */
  torso?: number;
  torsoColor?: number;
  /** helm: which helmet is worn (paperdoll HELMS) */
  helm?: number;
  /** cloak: the cape actually hung on the fighter, plus the glow it casts */
  cape?: number;
  capeColor?: number;
  aura?: number;
  particles?: ParticleKind;
  /** What wearing it is worth — added to the champion's stats. */
  stats?: Partial<Record<StatName, number>>;
}

const armour = (
  id: string,
  name: string,
  torso: number,
  torsoColor: number,
  flavour: string,
  stats: Partial<Record<StatName, number>> = { grit: 3 },
): GearItem => ({
  id, name, slot: "body", torso, torsoColor, flavour, stats,
});

/* Torso indices: 1 plate · 2 legion · 3 overalls · 4 suspenders — the pieces
   cut for both builds, so any drop fits any hunter. */
const ARMOUR: GearItem[] = [
  armour("g_plate_iron", "Iron Plate", 1, 2, "Dented in places you don't ask about.", { grit: 4, tempo: -1 }),
  armour("g_plate_ember", "Ember-Forged Plate", 1, 5, "Quenched in rift-fire.", { grit: 4, tempo: -1 }),
  armour("g_plate_gilded", "Gilded Plate", 1, 7, "Blinds before the blade does.", { grit: 4, tempo: -1 }),
  armour("g_plate_tide", "Tidewrought Plate", 1, 11, "Cooled in the deep channels.", { grit: 4, tempo: -1 }),
  armour("g_plate_void", "Voidiron Plate", 1, 3, "Drinks the light around it.", { grit: 4, tempo: -1 }),
  armour("g_plate_verdant", "Verdant Plate", 1, 9, "The grove approves.", { grit: 4, tempo: -1 }),
  armour("g_legion_steel", "Legion Harness", 2, 1, "Standard issue, non-standard survivor.", { grit: 3 }),
  armour("g_legion_crimson", "Crimson Legion Harness", 2, 4, "Never washes out. Never needs to.", { grit: 3 }),
  armour("g_legion_storm", "Stormguard Harness", 2, 12, "Thunder answers it.", { grit: 3 }),
  armour("g_legion_bone", "Bonewhite Harness", 2, 0, "Worn once, at the last duel.", { grit: 3 }),
  armour("g_legion_plum", "Duskward Harness", 2, 14, "Cut for the hour between dog and wolf.", { grit: 3 }),
  armour("g_over_leather", "Rift-Runner's Rig", 3, 17, "Pockets full of things that shouldn't be.", { grit: 2, tempo: 1 }),
  armour("g_over_moss", "Mosswalker's Rig", 3, 8, "The forest keeps its secrets.", { grit: 2, tempo: 1 }),
  armour("g_over_ash", "Ashfall Rig", 3, 1, "Smells faintly of the last arena.", { grit: 2, tempo: 1 }),
  armour("g_over_rose", "Festival Rig", 3, 15, "Won at a spring tournament. Barely.", { grit: 2, tempo: 1 }),
  armour("g_susp_sand", "Duelist's Straps", 4, 16, "Nothing to slow the arms down.", { grit: 1, tempo: 2 }),
  armour("g_susp_ink", "Nightwork Straps", 4, 3, "For fights that don't get reported.", { grit: 1, tempo: 2 }),
  armour("g_susp_amber", "Sunward Straps", 4, 6, "Catches the light on the turn.", { grit: 1, tempo: 2 }),
];

const CLOAKS: GearItem[] = [
  { id: "g_cloak_violet", name: "Mantle of Violet Dusk", slot: "cloak", stats: { grace: 2 }, aura: 0, cape: 0, capeColor: 14, flavour: "Woven at twilight." },
  { id: "g_cloak_gold", name: "Golden Mantle", slot: "cloak", stats: { grace: 2 }, aura: 1, cape: 0, capeColor: 7, flavour: "A champion's colours." },
  { id: "g_cloak_blood", name: "Bloodsilk Mantle", slot: "cloak", stats: { grace: 2 }, aura: 2, cape: 0, capeColor: 4, flavour: "The last thing seen. Briefly." },
  { id: "g_cloak_tide", name: "Tidewater Mantle", slot: "cloak", stats: { grace: 2 }, aura: 3, cape: 0, capeColor: 11, flavour: "Calm before every storm." },
  { id: "g_cloak_verdant", name: "Verdant Mantle", slot: "cloak", stats: { grace: 2 }, aura: 4, cape: 0, capeColor: 9, flavour: "The grove approves." },
  { id: "g_cloak_rose", name: "Rosewind Mantle", slot: "cloak", stats: { grace: 2 }, aura: 5, cape: 0, capeColor: 15, flavour: "Petals follow it home." },
  { id: "g_cloak_ivory", name: "Ivory Mantle", slot: "cloak", stats: { grace: 2 }, aura: 6, cape: 0, capeColor: 0, flavour: "Worn once, at the last duel." },
  { id: "g_cloak_storm", name: "Stormcall Mantle", slot: "cloak", stats: { grace: 2 }, aura: 7, cape: 0, capeColor: 12, flavour: "Thunder answers it." },
];

/* Helms cover the head; hair reappears the moment one comes off. */
const helm = (id: string, name: string, idx: number, flavour: string): GearItem => ({
  id, name, slot: "helm", helm: idx, flavour, stats: { grit: 2, might: 1 },
});

const HELMETS: GearItem[] = [
  helm("g_helm_barbute", "Barbute", 0, "Narrow slit, narrower mercy."),
  helm("g_helm_armet", "Sealed Armet", 1, "Nobody has seen the face under it."),
  helm("g_helm_horned", "Horned Helm", 2, "Taken from something that stopped needing it."),
  helm("g_helm_spangen", "Spangenhelm", 3, "Banded iron, older than the arena."),
  helm("g_helm_kettle", "Kettle Helm", 4, "Practical. Unglamorous. Still breathing."),
];

const TRINKETS: GearItem[] = [
  { id: "g_char_ember", name: "Ember Charm", slot: "trinket", stats: { tempo: 2 }, particles: "embers", flavour: "Sparks rise where you stand." },
  { id: "g_char_petal", name: "Petalfall Charm", slot: "trinket", stats: { tempo: 2 }, particles: "petals", flavour: "Every duel is a spring festival." },
  { id: "g_char_snow", name: "Snowveil Charm", slot: "trinket", stats: { tempo: 2 }, particles: "snow", flavour: "Winter keeps its own counsel." },
  { id: "g_char_firefly", name: "Firefly Lantern", slot: "trinket", stats: { tempo: 2 }, particles: "fireflies", flavour: "Small lights, long roads." },
  { id: "g_char_storm", name: "Storm Bell", slot: "trinket", stats: { tempo: 2 }, particles: "storm", flavour: "Rings once before the lightning." },
];

const TITLES: GearItem[] = [
  { id: "g_t_patient", name: "the Patient Blade", slot: "title", stats: { might: 1 }, flavour: "Waits. Wins." },
  { id: "g_t_oni", name: "Oni-Slayer", slot: "title", stats: { might: 1 }, flavour: "The hounds remember." },
  { id: "g_t_dawn", name: "First Light of Dawn", slot: "title", stats: { might: 1 }, flavour: "The arena wakes with them." },
  { id: "g_t_unbroken", name: "the Unbroken", slot: "title", stats: { might: 1 }, flavour: "Knocked down nine times. Stood up ten." },
  { id: "g_t_rift", name: "Rift-Tested", slot: "title", stats: { might: 1 }, flavour: "Went in. Came back. Says nothing." },
  { id: "g_t_silent", name: "the Silent", slot: "title", stats: { might: 1 }, flavour: "The crowd hushes on instinct." },
  { id: "g_t_fangs", name: "Twin Fangs", slot: "title", stats: { might: 1 }, flavour: "One blade lies. The other tells the truth." },
  { id: "g_t_shadow", name: "Shadow of the Grove", slot: "title", stats: { might: 1 }, flavour: "The trees tell no one." },
  { id: "g_t_untraced", name: "the Untraceable", slot: "title", stats: { might: 1 }, flavour: "Officially, was never here." },
  { id: "g_t_night", name: "Night's Edge", slot: "title", stats: { might: 1 }, flavour: "Where the dark gets sharp." },
];

export const GEAR: GearItem[] = [...ARMOUR, ...HELMETS, ...CLOAKS, ...TRINKETS, ...TITLES];

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
  helm?: string;
  cloak?: string;
  trinket?: string;
  title?: string;
}

/** Describe a piece in one short line for the wardrobe chips. */
export function gearDetail(g: GearItem): string {
  if (g.slot === "body" && g.torso != null) {
    return `${TORSOS[g.torso]?.name ?? "Outfit"} · ${CLOTH_COLORS[g.torsoColor ?? 0]?.name ?? ""}`;
  }
  if (g.slot === "helm") return "Helmet";
  if (g.slot === "cloak") return "Cape · aura";
  if (g.slot === "trinket") return "Combat effect";
  return "Title";
}

/** The look actually rendered: the hunter's own, with worn armour over it. */
export function lookWithGear(look: Look, equipped: Equipped | undefined): Look {
  const body = equipped?.body ? gearItem(equipped.body) : undefined;
  const helmet = equipped?.helm ? gearItem(equipped.helm) : undefined;
  const cloak = equipped?.cloak ? gearItem(equipped.cloak) : undefined;
  let out = look;
  // Armour is cut for both builds, but stay safe if a piece ever isn't.
  if (body?.torso != null && torsosFor(look.build).includes(body.torso)) {
    out = { ...out, torso: body.torso, torsoColor: body.torsoColor ?? out.torsoColor };
  }
  if (helmet?.helm != null) out = { ...out, helm: helmet.helm };
  if (cloak?.cape != null) out = { ...out, cape: cloak.cape, capeColor: cloak.capeColor ?? 0 };
  return out;
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

/** What a piece is worth, in words a player can read at a glance. */
export function gearStatLine(g: GearItem): string {
  const s = g.stats;
  if (!s) return "";
  const LABEL: Record<string, string> = { might: "STR", grace: "AGI", tempo: "SPD", grit: "END" };
  return Object.entries(s)
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${LABEL[k] ?? k}`)
    .join(" · ");
}

/** Everything worn, totalled. */
export function gearStats(equipped: Equipped | undefined): Partial<Record<StatName, number>> {
  const total: Partial<Record<StatName, number>> = {};
  for (const id of Object.values(equipped ?? {})) {
    const item = id ? gearItem(id) : undefined;
    for (const [k, v] of Object.entries(item?.stats ?? {})) {
      total[k as StatName] = (total[k as StatName] ?? 0) + (v as number);
    }
  }
  return total;
}
