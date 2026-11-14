/**
 * FROZEN CONTRACT (work package 0). Only the Lead changes this file, and every change adds 1
 * to CONTRACT_REV. Ids are plain strings. Player-facing names live in the web app's text files.
 */

export const RULES_VERSION = 1 as const;
export const LOG_VERSION = 1 as const;
export const CONTRACT_REV = 1;
export const REALM_SALT = "yard-1";
/** Rivals in the pool at each level, index 0 to 239. */
export const RIVALS_PER_LEVEL = 240;

export const WEAPON_IDS = ["pipe","pocket-knife","broom","machete","hand-axe","bat","pitchfork",
  "crowbar","knuckle-dusters","bin-lid","shovel","sledgehammer","darts","bike-chain",
  "monkey-wrench","pickaxe","rebar","screwdrivers","garden-shears","stop-sign","boomerang",
  "anvil","ball-and-chain","umbrella","pool-cue","bricks","rubber-chicken","lawn-flamingo"] as const;
export const SKILL_IDS = ["big-heart","heavy-hands","light-feet","fast-twitch","glass-cannon",
  "mountain","padding","anticipation","sharpening-stone","bare-knuckle","payback","flurry",
  "car-door","firm-grip","head-start","sharp-eye","parry","heavy-lifter","pitcher","plate-vest",
  "knock-loose","last-stand","stubborn","slippery","haymaker","energy-drink","tarp","whistle",
  "firecrackers","snatch","air-horn","body-slam"] as const;
/** The eight active skills. A subset of SKILL_IDS (checked below by the compiler, and by a test). */
export const MOVE_IDS = ["haymaker","energy-drink","tarp","whistle","firecrackers","snatch",
  "air-horn","body-slam"] as const;
export const COMPANION_IDS = ["raccoon","goose","boar"] as const;

export type WeaponId = (typeof WEAPON_IDS)[number];
/** What a hand holds. "fists" is the stat block used when nothing is held. */
export type HeldId = WeaponId | "fists";
export type SkillId = (typeof SKILL_IDS)[number];
export type MoveId = (typeof MOVE_IDS)[number];
export type CompanionId = (typeof COMPANION_IDS)[number];
/** Things that can lie on the floor. */
export type PropId = WeaponId | "car-door";
/** Flat union. A contract test asserts that no id is in two lists. Raccoon may be owned twice. */
export type PerkId = WeaponId | SkillId | CompanionId;
export type PerkKind = "weapon" | "skill" | "companion";

/** Compile-time proof that every Move is a skill. */
const MOVES_ARE_SKILLS: readonly SkillId[] = MOVE_IDS;
void MOVES_ARE_SKILLS;

/** All 63 perk ids: 28 weapons, then 32 skills, then 3 companions. */
export const PERK_IDS: readonly PerkId[] = [...WEAPON_IDS, ...SKILL_IDS, ...COMPANION_IDS];

const WEAPON_SET: ReadonlySet<string> = new Set(WEAPON_IDS);
const SKILL_SET: ReadonlySet<string> = new Set(SKILL_IDS);
const MOVE_SET: ReadonlySet<string> = new Set(MOVE_IDS);
const COMPANION_SET: ReadonlySet<string> = new Set(COMPANION_IDS);

/** Guards for raw strings, for example ids read from a save. They never throw. */
export function isWeaponId(id: string): id is WeaponId { return WEAPON_SET.has(id); }
export function isSkillId(id: string): id is SkillId { return SKILL_SET.has(id); }
export function isMoveId(id: string): id is MoveId { return MOVE_SET.has(id); }
export function isCompanionId(id: string): id is CompanionId { return COMPANION_SET.has(id); }
export function isPerkId(id: string): id is PerkId {
  return WEAPON_SET.has(id) || SKILL_SET.has(id) || COMPANION_SET.has(id);
}

/** The list a perk id belongs to. An unknown string (a damaged save) is reported as "skill"; it never throws. */
export function perkKind(id: PerkId): PerkKind {
  if (WEAPON_SET.has(id)) return "weapon";
  if (COMPANION_SET.has(id)) return "companion";
  return "skill";
}
