/**
 * FROZEN CONTRACT (work package 0). Only the Lead changes this file, and every change adds 1
 * to CONTRACT_REV. Ids are plain strings. Player-facing names live in the web app's text files.
 */

export const RULES_VERSION = 1 as const;
/** 2 since content v2: the door became a shield (`BoutInit.shield`, the `shieldOff` step). */
export const LOG_VERSION = 2 as const;
/** 2: content v2 (owner amendment 13.8): more weapons, Thrown weapons, skills, pets, and shields. */
/** 3: sound cues name what made them (stage `Cue.item`, `Cue.on`) and a `swing` family (owner, 15 Nov 2026). */
/** 4: fight speed 3x (owner, 15 Nov 2026: "Add x1, x2 and x3 for VIP"): `Settings.speed` and
 *  `FightClock.speed` are 1 | 2 | 3, `Settings.isVip` gates 3x, and the save is schema version 2. */
/** 5: old saves keep their kit (round-2 close): `ScrapperRecord.base` (a `KitBase`), `routeNode`
 *  takes it, and the save is schema version 3. */
/** 6: content v3, batch 1 (plan 13.9, 13.15): energy in place of the daily bout cap
 *  (`ScrapperRecord.energy`/`energyAt`, `CoreApi.energyNow`/`energyNextMs`, `afterBout` and
 *  `createRecord` take ms), six stats (`StatKey` adds toughness and precision, `DerivedValues`
 *  adds soak and grip), and the save is schema version 4. */
export const CONTRACT_REV = 6;

export const REALM_SALT = "yard-1";
/** Rivals in the pool at each level, index 0 to 239. */
export const RIVALS_PER_LEVEL = 240;

/** The five arenas. Cosmetic only: the sim never reads one and the log never holds one.
 *  All five share the stage geometry, the home marks and the floor line. */
export const STAGE_IDS = ["yard","yard-night","rooftop","backyard","gym"] as const;
export type StageId = (typeof STAGE_IDS)[number];
/** The arena of a bout. A pure function of the bout seed in whole-number maths, so a replay
 *  shows the same place on every engine. A seed that is not a whole number is cut to 32 bits
 *  first; it never throws. The host passes the result to the fight player. */
export function stageFor(boutSeed: number): StageId {
  return STAGE_IDS[(boutSeed >>> 0) % STAGE_IDS.length] ?? "yard";
}

/** 41 weapons: the first 27 of the first set (the Bin Lid became a shield), then 8 melee and
 *  6 Thrown weapons of content v2. */
export const WEAPON_IDS = ["pipe","pocket-knife","broom","machete","hand-axe","bat","pitchfork",
  "crowbar","knuckle-dusters","shovel","sledgehammer","darts","bike-chain",
  "monkey-wrench","pickaxe","rebar","screwdrivers","garden-shears","stop-sign","boomerang",
  "anvil","ball-and-chain","umbrella","pool-cue","bricks","rubber-chicken","lawn-flamingo",
  "frying-pan","tyre-iron","golf-club","hockey-stick","folding-chair","cricket-bat","wok","plunger",
  "plastic-bottle","rubber-ball","paint-can","traffic-cone","hubcap","tyre"] as const;
/** 39 skills: boosters, then passives, then the twelve Moves last. The Car Door became a shield;
 *  content v2 adds four passives (from quick-swap) and four Moves (from sand-in-the-eyes). */
export const SKILL_IDS = ["big-heart","heavy-hands","light-feet","fast-twitch","glass-cannon",
  "mountain","padding","anticipation","sharpening-stone","bare-knuckle","payback","flurry",
  "firm-grip","head-start","sharp-eye","parry","heavy-lifter","pitcher","plate-vest",
  "knock-loose","last-stand","stubborn","slippery","quick-swap","pet-lover","junk-collector","trick-shot",
  "haymaker","energy-drink","tarp","whistle","firecrackers","snatch","air-horn","body-slam",
  "sand-in-the-eyes","taunt","second-wind","grapple"] as const;
/** The twelve active skills. A subset of SKILL_IDS (checked below by the compiler, and by a test). */
export const MOVE_IDS = ["haymaker","energy-drink","tarp","whistle","firecrackers","snatch",
  "air-horn","body-slam","sand-in-the-eyes","taunt","second-wind","grapple"] as const;
export const COMPANION_IDS = ["raccoon","goose","boar","stray-dog","crow","alley-cat"] as const;
/** Shields: perks of their own kind, carried on the back arm while the front hand keeps its
 *  weapon. At most one per scrapper. */
export const SHIELD_IDS = ["car-door","bin-lid","wooden-pallet","ironing-board","skateboard","riot-shield"] as const;

export type WeaponId = (typeof WEAPON_IDS)[number];
/** What a hand holds. "fists" is the stat block used when nothing is held. */
export type HeldId = WeaponId | "fists";
export type SkillId = (typeof SKILL_IDS)[number];
export type MoveId = (typeof MOVE_IDS)[number];
export type CompanionId = (typeof COMPANION_IDS)[number];
export type ShieldId = (typeof SHIELD_IDS)[number];
/** Things that can lie on the floor: a weapon or a shield. */
export type PropId = WeaponId | ShieldId;
/** Flat union. A contract test asserts that no id is in two lists. Raccoon may be owned twice. */
export type PerkId = WeaponId | SkillId | CompanionId | ShieldId;
export type PerkKind = "weapon" | "skill" | "companion" | "shield";
/** What a proc names: a skill, or the shield that made a block. */
export type ProcId = SkillId | ShieldId;

/** Compile-time proof that every Move is a skill. */
const MOVES_ARE_SKILLS: readonly SkillId[] = MOVE_IDS;
void MOVES_ARE_SKILLS;

/** All 92 perk ids: 41 weapons, then 39 skills, then 6 companions, then 6 shields. */
export const PERK_IDS: readonly PerkId[] = [...WEAPON_IDS, ...SKILL_IDS, ...COMPANION_IDS, ...SHIELD_IDS];

const WEAPON_SET: ReadonlySet<string> = new Set(WEAPON_IDS);
const SKILL_SET: ReadonlySet<string> = new Set(SKILL_IDS);
const MOVE_SET: ReadonlySet<string> = new Set(MOVE_IDS);
const COMPANION_SET: ReadonlySet<string> = new Set(COMPANION_IDS);
const SHIELD_SET: ReadonlySet<string> = new Set(SHIELD_IDS);
const STAGE_SET: ReadonlySet<string> = new Set(STAGE_IDS);

/** Guards for raw strings, for example ids read from a save. They never throw. */
export function isWeaponId(id: string): id is WeaponId { return WEAPON_SET.has(id); }
export function isSkillId(id: string): id is SkillId { return SKILL_SET.has(id); }
export function isMoveId(id: string): id is MoveId { return MOVE_SET.has(id); }
export function isCompanionId(id: string): id is CompanionId { return COMPANION_SET.has(id); }
export function isShieldId(id: string): id is ShieldId { return SHIELD_SET.has(id); }
export function isStageId(id: string): id is StageId { return STAGE_SET.has(id); }
export function isPerkId(id: string): id is PerkId {
  return WEAPON_SET.has(id) || SKILL_SET.has(id) || COMPANION_SET.has(id) || SHIELD_SET.has(id);
}
/** A skill or a shield: the two things a proc may name. */
export function isProcId(id: string): id is ProcId { return SKILL_SET.has(id) || SHIELD_SET.has(id); }

/** The list a perk id belongs to. An unknown string (a damaged save) is reported as "skill"; it never throws. */
export function perkKind(id: PerkId): PerkKind {
  if (WEAPON_SET.has(id)) return "weapon";
  if (COMPANION_SET.has(id)) return "companion";
  if (SHIELD_SET.has(id)) return "shield";
  return "skill";
}
