/**
 * The state of one bout while the sim runs it (work package 1), and the helpers every part of a
 * turn shares: writing steps, picking a target, landing damage, and the steps a hit causes.
 */
import type { ActorId, BagItem, Proc, Side, Step } from "../contracts/log";
import type { SkillId } from "../contracts/ids";
import { SKILL_IDS } from "../contracts/ids";
import { RARITY_OF } from "../contracts/content";
import type { Rarity } from "../contracts/content";
import { sk } from "../content/skills";
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

/** One random living enemy, scrapper or companion. */
export function pickEnemy(b: Bout, a: Actor): Actor | null {
  const list = enemiesUp(b, a);
  if (list.length === 0) return null;
  return list[b.r.target.int(list.length)]!;
}

const RANK: Readonly<Record<Rarity, number>> = { mythic: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
/** Rarest skill first, then the order of the skill list. */
export function sortProcs(list: Proc[]): Proc[] | undefined {
  if (list.length === 0) return undefined;
  return list.sort((x, y) => RANK[RARITY_OF[x.skill]] - RANK[RARITY_OF[y.skill]]
    || SKILL_IDS.indexOf(x.skill) - SKILL_IDS.indexOf(y.skill));
}

export function proc(by: Actor, skill: SkillId): Proc {
  return { by: by.id as ActorId, skill };
}

/** Head Start: a proc on the first step of its owner's first turn that can carry one. */
export function headStart(owner: Actor, procs: Proc[]): void {
  if (owner.headStartPending) {
    owner.headStartPending = false;
    procs.push(proc(owner, "head-start"));
  }
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

/** The door roll: one third of the attacker's Disarm on a swing that was not evaded. A slam always knocks it off. */
export function tryDoor(b: Bout, att: Actor, def: Actor, cause: "hit" | "slam"): void {
  if (!def.door) return;
  if (cause === "hit") {
    const chance = Math.floor(Math.min(valuesOf(att).disarm, CAP.disarm) / 3);
    if (!(b.r.disarm.int(100) < chance)) return;
  }
  def.door = false;
  emit(b, { t: "doorOff", turn: b.turn, actor: att.id, target: def.id, cause });
}

/** A hit frees a snared target. */
export function tryFree(b: Bout, def: Actor): void {
  if (!def.snared) return;
  def.snared = false;
  def.snareSkips = 0;
  emit(b, { t: "free", turn: b.turn, actor: def.id, cause: "hit" });
}
