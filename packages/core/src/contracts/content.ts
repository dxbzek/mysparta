/**
 * FROZEN CONTRACT (work package 0). Shapes of the content tables, and the identity facts that the
 * stage, the fight screen and the rig need before the sim exists. The number tables (WEAPONS,
 * SKILLS, COMPANIONS as total Records) belong to the sim lane and spread WEAPON_META, so there is
 * one copy of every identity fact. Lookups by raw string from a save warn once and fall back.
 * They never throw.
 */
import type { CompanionId, HeldId, PerkId, SkillId } from "./ids";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "mythic";
export type WeaponTag = "light" | "heavy" | "pole" | "thrown" | "blade";
export type AttackClip = "punch" | "flick" | "swing" | "smash" | "thrust" | "throw";
export interface WeaponNumbers { tempo: number; dmg: number; reach: number | null /* null = thrown */;
  draw: number; aim: number; pierce: number; block: number; evade: number; riposte: number;
  combo: number; disarm: number; crit: number }
export interface WeaponDef { id: HeldId; rarity: Rarity | null; tags: readonly WeaponTag[];
  clip: AttackClip; tiers: readonly [WeaponNumbers] }     // array so tiers can come later
export interface SkillDef { id: SkillId; kind: "booster" | "passive" | "move"; rarity: Rarity;
  tiers: readonly [Readonly<Record<string, number>>];     // named numbers; behaviour is sim code keyed by id
  move?: { weight: number; uses: number } }
export interface CompanionDef { id: CompanionId; rarity: Rarity /* label only: uncommon / epic / epic */;
  weight: number; limit: number;
  excludes: readonly CompanionId[]; hpCostPct: number; hp: number; strength: number; agility: number;
  speed: number; dmg: number; combo: number; evade: number; aim: number; disarm: number;
  startClock: number }

/** Roll weight of one item inside its category. Common to Mythic is 200 to 1. */
export const RARITY_WEIGHT: Readonly<Record<Rarity, number>> = {
  common: 400, uncommon: 150, rare: 50, epic: 12, mythic: 2,
};

/** What must be known about a weapon before any number table exists: which swing clip, which
 *  sound family, which rarity colour, and how the object is really held and used. Identity
 *  only, never balance; Reach is the one number of the rules in it.
 *
 *  `hands` is how many hands the weapon takes. 2 means one of two things:
 *    - both hands on one shaft: the back hand is pinned to the art's `grip2`; or
 *    - `pair`: one object in each fist (bare fists count). The art is drawn in both hands, and an
 *      extra combo swing is made with the other hand (the stage sets `Dress.lead`).
 *  `use` is one plain line: how it is held and swung, then which part hits. The art lanes draw
 *  and key to it, and a reviewer checks the use strips against it. It is not player text.
 *  `flight` is how a Thrown weapon flies; only the three Thrown weapons have one.
 *  `flex` marks a weapon that bends: it is drawn as linked segments that trail the hand. */
export interface WeaponMeta { rarity: Rarity | null; tags: readonly WeaponTag[]; clip: AttackClip;
  reach: number /* 0 for fists and Thrown weapons */;
  hands: 1 | 2; pair?: true; use: string;
  flight?: "straight" | "tumble" | "return"; flex?: true }

export const WEAPON_META: Readonly<Record<HeldId, WeaponMeta>> = {
  "fists": {
    rarity: null, tags: [], clip: "punch", reach: 0, hands: 2, pair: true,
    use: "boxing guard, straight punches, the hands take turns on a combo; the knuckles hit" },
  "pipe": {
    rarity: "common", tags: [], clip: "swing", reach: 1, hands: 1,
    use: "gripped near one end, side swing like a club; the far end hits" },
  "pocket-knife": {
    rarity: "common", tags: ["light", "blade"], clip: "flick", reach: 0, hands: 1,
    use: "fist grip, blade forward, short quick stabs; the point hits" },
  "broom": {
    rarity: "common", tags: ["pole"], clip: "thrust", reach: 3, hands: 2,
    use: "held like a staff, thrust head first; the bristle head hits" },
  "machete": {
    rarity: "common", tags: ["blade"], clip: "swing", reach: 1, hands: 1,
    use: "diagonal slash from the shoulder; the blade edge hits" },
  "hand-axe": {
    rarity: "common", tags: ["heavy", "blade"], clip: "swing", reach: 1, hands: 1,
    use: "short overhead chop; the axe head hits" },
  "bat": {
    rarity: "uncommon", tags: [], clip: "swing", reach: 2, hands: 2,
    use: "both hands at the knob, full side swing from the shoulder; the barrel hits" },
  "pitchfork": {
    rarity: "uncommon", tags: ["pole"], clip: "thrust", reach: 3, hands: 2,
    use: "low thrust with both hands; the tines hit" },
  "crowbar": {
    rarity: "uncommon", tags: ["heavy"], clip: "swing", reach: 1, hands: 1,
    use: "side swing with the hook end leading; the hook hits" },
  "knuckle-dusters": {
    rarity: "uncommon", tags: ["light"], clip: "punch", reach: 0, hands: 2, pair: true,
    use: "worn on both fists, punches like bare fists; the metal knuckles hit" },
  "bin-lid": {
    rarity: "uncommon", tags: [], clip: "swing", reach: 0, hands: 1,
    use: "held by its handle in front of the body, shoved or swung flat, raised to block; the flat face or the rim hits" },
  "shovel": {
    rarity: "uncommon", tags: ["heavy", "pole"], clip: "smash", reach: 2, hands: 2,
    use: "lifted overhead, brought down flat; the flat of the blade hits" },
  "sledgehammer": {
    rarity: "uncommon", tags: ["heavy"], clip: "smash", reach: 1, hands: 2,
    use: "hands apart on the shaft, a big slow overhead arc; the hammer head hits" },
  "darts": {
    rarity: "uncommon", tags: ["thrown", "light"], clip: "throw", reach: 0, hands: 1, flight: "straight",
    use: "pinch grip at eye level, a flick of the wrist, flies straight and point first; the point hits" },
  "bike-chain": {
    rarity: "rare", tags: ["pole"], clip: "swing", reach: 4, hands: 1, flex: true,
    use: "whipped in an arc, the chain trails and bends; the last links hit" },
  "monkey-wrench": {
    rarity: "rare", tags: ["heavy"], clip: "swing", reach: 1, hands: 1,
    use: "side swing or a downward knock; the jaw end hits" },
  "pickaxe": {
    rarity: "rare", tags: ["heavy"], clip: "smash", reach: 2, hands: 2,
    use: "overhead arc, point down; the pick point hits" },
  "rebar": {
    rarity: "rare", tags: ["heavy"], clip: "swing", reach: 2, hands: 2,
    use: "heavy side swing with both hands; the far third of the bar hits" },
  "screwdrivers": {
    rarity: "rare", tags: ["light"], clip: "flick", reach: 0, hands: 2, pair: true,
    use: "one in each fist, jabs that take turns; the tips hit" },
  "garden-shears": {
    rarity: "rare", tags: ["light", "blade"], clip: "flick", reach: 1, hands: 2,
    use: "one hand on each handle, lunge and snip shut; the closing blades hit" },
  "stop-sign": {
    rarity: "rare", tags: ["pole", "heavy", "blade"], clip: "smash", reach: 3, hands: 2,
    use: "held by the post, overhead chop, edge first; the edge of the sign hits" },
  "boomerang": {
    rarity: "rare", tags: ["thrown"], clip: "throw", reach: 0, hands: 1, flight: "return",
    use: "side-arm throw, flies a curve and comes back to the hand when the log says so; the leading wing hits" },
  "anvil": {
    rarity: "epic", tags: ["heavy"], clip: "smash", reach: 1, hands: 2,
    use: "hugged, heaved overhead with bent knees, dropped forward; the flat base hits" },
  "ball-and-chain": {
    rarity: "epic", tags: ["heavy"], clip: "smash", reach: 2, hands: 2, flex: true,
    use: "handle in both hands, the ball swings overhead on its chain and lands after the hands stop; the ball hits" },
  "umbrella": {
    rarity: "epic", tags: ["light"], clip: "flick", reach: 1, hands: 1,
    use: "closed, a fencing lunge, pops open on a block or an evade; the ferrule tip hits" },
  "pool-cue": {
    rarity: "epic", tags: ["pole", "light"], clip: "thrust", reach: 3, hands: 2,
    use: "bridge hand in front, back hand drives it like a cue shot; the cue tip hits" },
  "bricks": {
    rarity: "epic", tags: ["thrown", "heavy"], clip: "throw", reach: 0, hands: 1, flight: "tumble",
    use: "overarm lob, tumbles on an arc; the brick hits" },
  "rubber-chicken": {
    rarity: "mythic", tags: ["light"], clip: "swing", reach: 1, hands: 1, flex: true,
    use: "held by the feet, a floppy slap that bends and trails; the head hits" },
  "lawn-flamingo": {
    rarity: "mythic", tags: ["pole"], clip: "thrust", reach: 4, hands: 2,
    use: "held by the steel legs, thrust beak first; the beak hits" },
};

/** The rarity word every perk card shows. For companions it is a label and a colour only: their
 *  roll uses the companion weights, not RARITY_WEIGHT. */
export const RARITY_OF: Readonly<Record<PerkId, Rarity>> = {
  // weapons (5 common, 8 uncommon, 8 rare, 5 epic, 2 mythic)
  "pipe": "common", "pocket-knife": "common", "broom": "common", "machete": "common", "hand-axe": "common",
  "bat": "uncommon", "pitchfork": "uncommon", "crowbar": "uncommon", "knuckle-dusters": "uncommon",
  "bin-lid": "uncommon", "shovel": "uncommon", "sledgehammer": "uncommon", "darts": "uncommon",
  "bike-chain": "rare", "monkey-wrench": "rare", "pickaxe": "rare", "rebar": "rare", "screwdrivers": "rare",
  "garden-shears": "rare", "stop-sign": "rare", "boomerang": "rare",
  "anvil": "epic", "ball-and-chain": "epic", "umbrella": "epic", "pool-cue": "epic", "bricks": "epic",
  "rubber-chicken": "mythic", "lawn-flamingo": "mythic",
  // boosters
  "big-heart": "common", "heavy-hands": "common", "light-feet": "common", "fast-twitch": "common",
  "glass-cannon": "epic", "mountain": "mythic",
  // passives
  "padding": "common", "anticipation": "common",
  "sharpening-stone": "uncommon", "bare-knuckle": "uncommon", "payback": "uncommon", "flurry": "uncommon",
  "car-door": "uncommon", "firm-grip": "uncommon", "head-start": "uncommon", "sharp-eye": "uncommon",
  "parry": "uncommon",
  "heavy-lifter": "rare", "pitcher": "rare", "plate-vest": "rare", "knock-loose": "rare",
  "last-stand": "rare", "stubborn": "rare",
  "slippery": "epic",
  // Moves
  "haymaker": "uncommon", "energy-drink": "uncommon", "tarp": "uncommon", "whistle": "uncommon",
  "firecrackers": "rare", "snatch": "rare", "air-horn": "rare",
  "body-slam": "epic",
  // companions (label only)
  "raccoon": "uncommon", "goose": "epic", "boar": "epic",
};

/** Sound family of a held item: fists and knuckle-dusters "fist", a Blade tag "blade", the rest
 *  "blunt". `null` is a companion's bare attack and counts as "fist". An unknown id is "blunt". */
export function impactFamily(id: HeldId | null): "fist" | "blade" | "blunt" {
  if (id === null || id === "fists" || id === "knuckle-dusters") return "fist";
  const meta: WeaponMeta | undefined = WEAPON_META[id];
  if (meta !== undefined && meta.tags.includes("blade")) return "blade";
  return "blunt";
}
