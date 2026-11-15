/**
 * The state of one bout while the sim runs it (work package 1), and the helpers every part of a
 * turn shares: writing steps, picking a target, landing damage, and the steps a hit causes.
 */
import type { ActorId, BagItem, Proc, Side, Step } from "../contracts/log";
import type { ProcId, ShieldId } from "../contracts/ids";
import { PERK_IDS } from "../contracts/ids";
import { RARITY_OF } from "../contracts/content";
import type { Rarity } from "../contracts/content";
import { sk } from "../content/skills";
import { shieldNumbers } from "../content/shields";
import { hasTag } from "../content/weapons";
import type { Actor } from "./combatant";
import { CAP, valuesOf } from "./combatant";
import type { Streams } from "./rng";

export interface Bout {
  r: Streams;
  actors: Actor[];
  bag: Record<Side, BagItem[]>;
  steps: Step[];
  turn: number;
  ended: boolean;
}

export function emit(b: Bout, step: Step): void {
  b.steps.push(step);
}

export function bagCopy(bag: readonly BagItem[]): BagItem[] {
  return bag.map((it) => ({ ...it }));
}

export function enemiesUp(b: Bout, a: Actor): Actor[] {
  return b.actors.filter((x) => x.side !== a.side && x.status === "up");
}

export function scrapperOfSide(b: Bout, side: Side): Actor {
  return b.actors.find((x) => x.side === side && x.scrapper)!;
}

/** The enemy scrapper counts this many times in the target pick; each companion once. */
export const SCRAPPER_TARGET_WEIGHT = 2;

/** One random standing enemy, scrapper or companion, the scrapper weighted 2 to each companion's 1.
 *  One random number. */
export function pickEnemy(b: Bout, a: Actor): Actor | null {
  const list = enemiesUp(b, a);
  if (list.length === 0) return null;
  let r = b.r.target.int(list.length - 1 + SCRAPPER_TARGET_WEIGHT);
  for (const x of list) {
    const w = x.scrapper ? SCRAPPER_TARGET_WEIGHT : 1;
    if (r < w) return x;
    r -= w;
  }
  return list[list.length - 1]!;
}

const RANK: Readonly<Record<Rarity, number>> = { mythic: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
/** Which proc a step keeps when several skills mattered on it. 0: Last Stand (the log's HP reading
 *  depends on it). 1: rule skills, which made something happen that would not have happened at all.
 *  2: chance skills, whose bonus decided a roll. 3: number skills, which changed a number. */
const TIER: Readonly<Partial<Record<ProcId, number>>> = {
  "last-stand": 0,
  "firm-grip": 1, "parry": 1, "stubborn": 1, "trick-shot": 1, "junk-collector": 1, "head-start": 1,
  "anticipation": 2, "payback": 2, "flurry": 2, "slippery": 2, "knock-loose": 2, "sharp-eye": 2, "taunt": 2,
  "sand-in-the-eyes": 2, "quick-swap": 2,
  "padding": 3, "plate-vest": 3, "sharpening-stone": 3, "bare-knuckle": 3, "pitcher": 3, "pet-lover": 3, "heavy-lifter": 3,
};
/** A shield's proc (a block made with it) is a rule proc. */
const tierOf = (id: ProcId): number => TIER[id] ?? 1;

/** At most one proc per step: the lowest tier, then the rarest skill, then the order of the perk list. */
export function sortProcs(list: Proc[]): Proc[] | undefined {
  if (list.length === 0) return undefined;
  const best = [...list].sort((x, y) => tierOf(x.skill) - tierOf(y.skill)
    || RANK[RARITY_OF[x.skill]] - RANK[RARITY_OF[y.skill]]
    || PERK_IDS.indexOf(x.skill) - PERK_IDS.indexOf(y.skill))[0]!;
  return [best];
}

export function proc(by: Actor, skill: ProcId): Proc {
  return { by: by.id as ActorId, skill };
}

/** Head Start: a proc on the first step of its owner's first turn that can carry one. */
export function headStart(owner: Actor, procs: Proc[]): void {
  if (owner.headStartPending) {
    owner.headStartPending = false;
    procs.push(proc(owner, "head-start"));
  }
}

/** The first step of a turn that can carry procs: Head Start (its owner's first action of the
 *  bout), Quick Swap (the draw it made this turn), Heavy Lifter (a turn made with a Heavy weapon,
 *  which costs 30% less time). */
export function firstAction(a: Actor, procs: Proc[]): void {
  headStart(a, procs);
  if (a.quickSwapPending) {
    a.quickSwapPending = false;
    procs.push(proc(a, "quick-swap"));
  }
  if (a.scrapper && a.held !== "fists" && hasTag(a.held, "heavy") && a.skills.has("heavy-lifter")) {
    procs.push(proc(a, "heavy-lifter"));
  }
}

/** The opening: in turns 1 to OPENING_TURNS one turn takes at most OPENING_PCT of a scrapper's max
 *  HP (OPENING_PET_PCT of a companion's), so no bout can end before turn OPENING_TURNS + 1 and a
 *  companion survives the first turn it is hit in. */
export const OPENING_TURNS = 5;
export const OPENING_PCT = 10;
export const OPENING_PET_PCT = 50;

/** What an actor can still lose in this turn of the opening (Infinity after the opening). */
export function allowance(b: Bout, def: Actor): number {
  if (b.turn > OPENING_TURNS) return Infinity;
  const pct = def.scrapper ? OPENING_PCT : OPENING_PET_PCT;
  const most = Math.max(1, Math.floor((def.maxHp * pct) / 100));
  return most - (def.lossTurn === b.turn ? def.loss : 0);
}

/** True when an actor has nothing left to lose in this turn of the opening: the swings stop. */
export function spent(b: Bout, def: Actor): boolean {
  return allowance(b, def) <= 0;
}

/** What a hit of `damage` would deal after the opening cut, without booking it. */
export function openingCut(b: Bout, def: Actor, damage: number): number {
  const left = allowance(b, def);
  return left === Infinity ? damage : Math.max(1, damage > left ? left : damage);
}

/** Cuts a hit to the opening allowance and books it. Never below 1 (a spent target is never swung at). */
export function opening(b: Bout, def: Actor, damage: number): number {
  const left = allowance(b, def);
  if (left === Infinity) return damage;
  const d = Math.max(1, damage > left ? left : damage);
  if (def.lossTurn !== b.turn) { def.lossTurn = b.turn; def.loss = 0; }
  def.loss += d;
  return d;
}

/** Takes `damage` from `def`. Last Stand leaves 1 HP once a bout. Returns hpAfter. */
export function land(def: Actor, damage: number, procs: Proc[]): number {
  const left = def.hp - damage;
  if (left > 0) { def.hp = left; return left; }
  if (def.scrapper && def.skills.has("last-stand") && !def.lastStandUsed && sk("last-stand", "saves") > 0) {
    def.lastStandUsed = true;
    def.hp = 1;
    procs.push(proc(def, "last-stand"));
    return 1;
  }
  def.hp = 0;
  return 0;
}

/** Armor takes its share: damage - floor(damage x Armor / 100), never below 1. */
export function armored(damage: number, armor: number): number {
  const a = armor < 0 ? 0 : armor > CAP.armor ? CAP.armor : armor;
  const d = damage - Math.floor((damage * a) / 100);
  return d < 1 ? 1 : d;
}

/** A knockout. A scrapper's knockout ends the bout in the same turn. */
export function knockOut(b: Bout, who: Actor, by: Actor | null): void {
  who.status = "ko";
  emit(b, { t: "ko", turn: b.turn, actor: who.id, by: by === null ? null : by.id });
  if (who.scrapper) {
    emit(b, { t: "end", turn: b.turn, winner: who.side === "a" ? "b" : "a", reason: "ko" });
    b.ended = true;
  }
}

/**
 * The disarm roll on a landed hit or a slam. Firm Grip resists 60% of the time and writes the
 * disarm with `resisted`. Knock Loose writes a proc when the roll passed only because of it.
 * `forced` is a Body Slam: it always knocks the weapon off unless Firm Grip holds on.
 */
export function tryDisarm(b: Bout, att: Actor, def: Actor, cause: "hit" | "slam"): void {
  if (def.held === "fists" || !def.scrapper) return;
  const procs: Proc[] = [];
  if (cause === "hit") {
    const chance = Math.min(valuesOf(att).disarm, CAP.disarm);
    const r = b.r.disarm.int(100);
    if (!(r < chance)) return;
    if (att.skills.has("knock-loose")) {
      const without = Math.min(valuesOf(att).disarm - sk("knock-loose", "disarm"), CAP.disarm);
      if (r >= (without < 0 ? 0 : without)) procs.push(proc(att, "knock-loose"));
    }
  }
  const weapon = def.held as Exclude<typeof def.held, "fists">;
  if (def.skills.has("firm-grip") && b.r.disarm.int(100) < sk("firm-grip", "resist")) {
    procs.push(proc(def, "firm-grip"));
    emit(b, { t: "disarm", turn: b.turn, actor: att.id, target: def.id, weapon, cause, resisted: true,
      procs: sortProcs(procs) } as Step);
    return;
  }
  def.held = "fists";
  def.heldAttacked = false;
  const step: Step = { t: "disarm", turn: b.turn, actor: att.id, target: def.id, weapon, cause };
  const sorted = sortProcs(procs);
  if (sorted !== undefined) (step as { procs?: Proc[] }).procs = sorted;
  emit(b, step);
}

/** The chance a swing that was not evaded knocks this shield off: its `knock` percent of the
 *  attacker's capped Disarm, rounded down. */
export function knockChance(att: Actor, shield: ShieldId): number {
  return Math.floor((Math.min(valuesOf(att).disarm, CAP.disarm) * shieldNumbers(shield).knock) / 100);
}

/** The shield roll on a swing that was not evaded. A slam always knocks it off. */
export function tryShield(b: Bout, att: Actor, def: Actor, cause: "hit" | "slam"): void {
  const shield = def.shield;
  if (shield === null) return;
  if (cause === "hit" && !(b.r.disarm.int(100) < knockChance(att, shield))) return;
  def.shield = null;
  emit(b, { t: "shieldOff", turn: b.turn, actor: att.id, target: def.id, shield, cause });
}

/** A hit frees a snared target. */
export function tryFree(b: Bout, def: Actor): void {
  if (!def.snared) return;
  def.snared = false;
  def.snareSkips = 0;
  emit(b, { t: "free", turn: b.turn, actor: def.id, cause: "hit" });
}
