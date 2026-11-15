/**
 * Fighters inside a bout (work package 1): the actor record, the derived fight values a held
 * weapon and the skills give, and building the actors of both sides from two snapshots.
 */
import type { DerivedValues, FighterSnapshot } from "../contracts/fighter";
import type { CompanionId, HeldId, PerkId, ShieldId, SkillId } from "../contracts/ids";
import { isCompanionId, isPerkId, isShieldId, isSkillId, perkKind } from "../contracts/ids";
import type { ActorId, BagItem, Side } from "../contracts/log";
import type { CompanionDef } from "../contracts/content";
import { COMPANIONS, COMPANION_FIXED, COMPANION_HP_GROWTH, COMPANION_STR_GROWTH, companionScale } from "../content/companions";
import { SKILLS, sk } from "../content/skills";
import { hasTag, weaponNumbers } from "../content/weapons";
import { shieldNumbers } from "../content/shields";
import { companionCostPct, effectiveOf, maxHpOf } from "../progress/stats";

/** Base values before any weapon or skill. */
export const BASE: Readonly<DerivedValues> = { evade: 10, block: 5, aim: 5, pierce: 0, intercept: 0,
  riposte: 0, combo: 0, disarm: 3, crit: 5, armor: 0 };
/** Caps on the final chance of a roll. Aim and Pierce have none. */
export const CAP = { evade: 80, block: 75, intercept: 75, riposte: 80, combo: 80, disarm: 80, crit: 60, armor: 60 } as const;

export function clampPct(v: number, cap: number): number {
  return v < 0 ? 0 : v > cap ? cap : v;
}

/** The derived values of a scrapper holding `held`, carrying `shield` (or null). Stored values: no cap. */
export function combatValues(skills: ReadonlySet<string>, held: HeldId, shield: ShieldId | null): DerivedValues {
  const w = weaponNumbers(held);
  const sh = shieldNumbers(shield);
  const has = (id: SkillId): boolean => skills.has(id);
  const heavy = held !== "fists" && hasTag(held, "heavy");
  return {
    evade: BASE.evade + w.evade + (has("slippery") ? sk("slippery", "evade") : 0),
    block: BASE.block + w.block + (has("parry") ? sk("parry", "block") : 0) + sh.block,
    aim: BASE.aim + w.aim + (has("sharp-eye") ? sk("sharp-eye", "aim") : 0)
      + (heavy && has("heavy-lifter") ? sk("heavy-lifter", "heavyAim") : 0),
    pierce: BASE.pierce + w.pierce + (has("sharp-eye") ? sk("sharp-eye", "pierce") : 0),
    intercept: BASE.intercept + (has("anticipation") ? sk("anticipation", "intercept") : 0),
    riposte: BASE.riposte + w.riposte + (has("payback") ? sk("payback", "riposte") : 0) + sh.riposte,
    combo: BASE.combo + w.combo + (has("flurry") ? sk("flurry", "combo") : 0)
      + (held === "fists" && has("bare-knuckle") ? sk("bare-knuckle", "unarmedCombo") : 0),
    disarm: BASE.disarm + w.disarm + (has("knock-loose") ? sk("knock-loose", "disarm") : 0),
    crit: BASE.crit + w.crit,
    armor: BASE.armor + (has("padding") ? sk("padding", "armor") : 0) + (has("plate-vest") ? sk("plate-vest", "armor") : 0)
      + sh.armor,
  };
}

/** The values of a companion. It holds nothing and never blocks. */
export function companionValues(def: CompanionDef): DerivedValues {
  return { evade: def.evade, block: COMPANION_FIXED.block, aim: def.aim, pierce: COMPANION_FIXED.pierce,
    intercept: 0, riposte: 0, combo: def.combo, disarm: def.disarm, crit: COMPANION_FIXED.crit,
    armor: COMPANION_FIXED.armor };
}

/** One fighter on the timeline. */
export interface Actor {
  id: ActorId; side: Side; kind: "scrapper" | CompanionId; scrapper: boolean;
  maxHp: number; hp: number; status: "up" | "ko" | "fled";
  str: number; agi: number; spd: number;
  held: HeldId; heldAttacked: boolean; shield: ShieldId | null;
  snared: boolean; snareSkips: number;
  /** How many skipped turns the current snare lasts: a Tarp 3, a Grapple 1. */
  snareLimit: number;
  /** Aim lost to Sand in the Eyes, for the rest of the bout. */
  sand: number;
  /** Taunt: own turns left before its Riposte bonus ends (0 = off). Set to 2 by the Move, so the
   *  bonus holds through the free action that follows the Taunt and the enemy turns after it. */
  taunt: number;
  /** A weapon left the hand by a throw: the next turn draws from the bag for sure. */
  reload: boolean;
  /** A companion's extra damage percent (Pet Lover of its owner). */
  dmgPct: number;
  clock: number; priority: boolean;
  skills: ReadonlySet<string>;
  comp: CompanionDef | null; dmg: number;
  haymaker: boolean; lastStandUsed: boolean; headStartPending: boolean;
  level: number;
  /** HP lost in turn `lossTurn` of the opening (see OPENING_PCT). */
  loss: number; lossTurn: number;
  /** Quick Swap made this turn's draw: its tag goes on the turn's first swing or throw. */
  quickSwapPending: boolean;
}

const warned = new Set<string>();
function known(perks: readonly PerkId[]): PerkId[] {
  const out: PerkId[] = [];
  for (const p of perks) {
    if (isPerkId(p)) out.push(p);
    else if (!warned.has(p)) { warned.add(p); console.warn(`unknown perk id "${p}" is ignored`); }
  }
  return out;
}

/** Max HP of a snapshot (maxHpOf: 54 + 7 x Health), minus the companion cost. */
export function snapshotMaxHp(s: FighterSnapshot): number {
  const perks = known(s.perks);
  return maxHpOf(effectiveOf(s.stats).health, s.level, companionCostPct(perks));
}

export interface SideSetup { actors: Actor[]; bag: BagItem[]; shield: ShieldId | null }

/** Builds the scrapper and its companions of one side, and its bag: weapons, then Moves. */
export function buildSide(side: Side, s: FighterSnapshot): SideSetup {
  const perks = known(s.perks);
  const eff = effectiveOf(s.stats);
  const skills = new Set<string>(perks.filter((p) => perkKind(p) === "skill"));
  const shield = perks.find((p): p is ShieldId => isShieldId(p)) ?? null;
  const petHp = skills.has("pet-lover") ? sk("pet-lover", "petHp") : 0;
  const petDmg = skills.has("pet-lover") ? sk("pet-lover", "petDamage") : 0;
  const maxHp = maxHpOf(eff.health, s.level, companionCostPct(perks));
  const actors: Actor[] = [{
    id: `${side}0` as ActorId, side, kind: "scrapper", scrapper: true, maxHp, hp: maxHp, status: "up",
    str: eff.strength, agi: eff.agility, spd: eff.speed, held: "fists", heldAttacked: false, shield,
    snared: false, snareSkips: 0, snareLimit: 0, sand: 0, taunt: 0, reload: false, dmgPct: 0,
    clock: 0, priority: false, skills, comp: null, dmg: 0,
    haymaker: false, lastStandUsed: false, headStartPending: skills.has("head-start"), level: s.level,
    loss: 0, lossTurn: 0, quickSwapPending: false,
  }];
  let n = 1;
  for (const p of perks) {
    if (!isCompanionId(p) || n > 3) continue;
    const def = COMPANIONS[p];
    const scaled = companionScale(def.hp, s.level, COMPANION_HP_GROWTH);
    const hp = Math.floor((scaled * (100 + petHp)) / 100);
    actors.push({
      id: `${side}${n}` as ActorId, side, kind: p, scrapper: false, maxHp: hp, hp, status: "up",
      str: companionScale(def.strength, s.level, COMPANION_STR_GROWTH), agi: def.agility, spd: def.speed,
      held: "fists", heldAttacked: false, shield: null, snared: false, snareSkips: 0, snareLimit: 0, sand: 0,
      taunt: 0, reload: false, dmgPct: petDmg, clock: 0, priority: false,
      skills: new Set(), comp: def, dmg: def.dmg, haymaker: false, lastStandUsed: false, headStartPending: false,
      level: s.level, loss: 0, lossTurn: 0, quickSwapPending: false,
    });
    n += 1;
  }
  const bag: BagItem[] = [];
  for (const p of perks) if (perkKind(p) === "weapon") bag.push({ k: "weapon", id: p as Exclude<HeldId, "fists"> });
  for (const p of perks) {
    if (!isSkillId(p)) continue;
    const def = SKILLS[p];
    if (def.move === undefined) continue;
    const uses = p === "haymaker" ? def.move.uses + Math.floor(eff.strength / sk("haymaker", "usesPerStrength")) : def.move.uses;
    bag.push({ k: "move", id: p as Extract<BagItem, { k: "move" }>["id"], uses });
  }
  return { actors, bag, shield };
}

/** The values an actor fights with right now: its kit, then Sand in the Eyes and Taunt. */
export function valuesOf(a: Actor): DerivedValues {
  if (a.comp !== null) return companionValues(a.comp);
  const v = combatValues(a.skills, a.held, a.shield);
  if (a.sand !== 0) v.aim -= a.sand;
  if (a.taunt > 0) v.riposte += sk("taunt", "riposte");
  return v;
}
