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

/** What must be known about a weapon before any number table exists: which swing clip, where the
 *  dash stops, which sound family, which rarity colour. Identity columns only; Reach is the one
 *  number, because the stage needs it for the stop distance. */
export interface WeaponMeta { rarity: Rarity | null; tags: readonly WeaponTag[]; clip: AttackClip;
  reach: number /* 0 for fists and Thrown weapons */ }

export const WEAPON_META: Readonly<Record<HeldId, WeaponMeta>> = {
  "fists":           { rarity: null,       tags: [],                        clip: "punch",  reach: 0 },
  "pipe":            { rarity: "common",   tags: [],                        clip: "swing",  reach: 1 },
  "pocket-knife":    { rarity: "common",   tags: ["light", "blade"],        clip: "flick",  reach: 0 },
  "broom":           { rarity: "common",   tags: ["pole"],                  clip: "thrust", reach: 3 },
  "machete":         { rarity: "common",   tags: ["blade"],                 clip: "swing",  reach: 1 },
  "hand-axe":        { rarity: "common",   tags: ["heavy", "blade"],        clip: "swing",  reach: 1 },
  "bat":             { rarity: "uncommon", tags: [],                        clip: "swing",  reach: 2 },
  "pitchfork":       { rarity: "uncommon", tags: ["pole"],                  clip: "thrust", reach: 3 },
  "crowbar":         { rarity: "uncommon", tags: ["heavy"],                 clip: "swing",  reach: 1 },
  "knuckle-dusters": { rarity: "uncommon", tags: ["light"],                 clip: "punch",  reach: 0 },
  "bin-lid":         { rarity: "uncommon", tags: [],                        clip: "swing",  reach: 0 },
  "shovel":          { rarity: "uncommon", tags: ["heavy", "pole"],         clip: "smash",  reach: 2 },
  "sledgehammer":    { rarity: "uncommon", tags: ["heavy"],                 clip: "smash",  reach: 1 },
  "darts":           { rarity: "uncommon", tags: ["thrown", "light"],       clip: "throw",  reach: 0 },
  "bike-chain":      { rarity: "rare",     tags: ["pole"],                  clip: "swing",  reach: 4 },
  "monkey-wrench":   { rarity: "rare",     tags: ["heavy"],                 clip: "swing",  reach: 1 },
  "pickaxe":         { rarity: "rare",     tags: ["heavy"],                 clip: "smash",  reach: 2 },
  "rebar":           { rarity: "rare",     tags: ["heavy"],                 clip: "swing",  reach: 2 },
  "screwdrivers":    { rarity: "rare",     tags: ["light"],                 clip: "flick",  reach: 0 },
  "garden-shears":   { rarity: "rare",     tags: ["light", "blade"],        clip: "flick",  reach: 1 },
  "stop-sign":       { rarity: "rare",     tags: ["pole", "heavy", "blade"], clip: "smash", reach: 3 },
  "boomerang":       { rarity: "rare",     tags: ["thrown"],                clip: "throw",  reach: 0 },
  "anvil":           { rarity: "epic",     tags: ["heavy"],                 clip: "smash",  reach: 1 },
  "ball-and-chain":  { rarity: "epic",     tags: ["heavy"],                 clip: "smash",  reach: 2 },
  "umbrella":        { rarity: "epic",     tags: ["light"],                 clip: "flick",  reach: 1 },
  "pool-cue":        { rarity: "epic",     tags: ["pole", "light"],         clip: "thrust", reach: 3 },
  "bricks":          { rarity: "epic",     tags: ["thrown", "heavy"],       clip: "throw",  reach: 0 },
  "rubber-chicken":  { rarity: "mythic",   tags: ["light"],                 clip: "swing",  reach: 1 },
  "lawn-flamingo":   { rarity: "mythic",   tags: ["pole"],                  clip: "thrust", reach: 4 },
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
