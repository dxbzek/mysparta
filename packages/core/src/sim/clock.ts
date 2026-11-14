/**
 * The timeline (work package 1). Every actor has a clock in beats; the lowest clock acts next.
 * A fists turn at Speed 10 costs 100 beats.
 */
import { hasTag, weaponNumbers } from "../content/weapons";
import { COMPANION_FIXED } from "../content/companions";
import { sk } from "../content/skills";
import type { HeldId } from "../contracts/ids";
import type { Actor } from "./combatant";
import type { Stream } from "./rng";
import { roll } from "./rng";

/** 40 + floor(1200 / (10 + Speed)). */
export function bodyTempo(speed: number): number {
  const s = speed < 0 ? 0 : speed;
  return 40 + Math.floor(1200 / (10 + s));
}

/** The weapon Tempo an actor pays for a turn made with `used`. Heavy Lifter cuts Heavy turns by 30%. */
export function weaponTempo(a: Actor, used: HeldId): number {
  if (!a.scrapper) return COMPANION_FIXED.tempo;
  const t = weaponNumbers(used).tempo;
  if (used !== "fists" && hasTag(used, "heavy") && a.skills.has("heavy-lifter")) {
    return Math.floor((t * (100 + sk("heavy-lifter", "heavyTime"))) / 100);
  }
  return t;
}

/** One normal turn of time without its random part: floor(weaponTempo x bodyTempo / 100). */
export function turnBase(a: Actor, used: HeldId): number {
  return Math.floor((weaponTempo(a, used) * bodyTempo(a.spd)) / 100);
}

/** A normal turn: the base plus roll(0..10). */
export function turnCost(a: Actor, used: HeldId, clock: Stream): number {
  return turnBase(a, used) + roll(clock, 0, 10);
}

/** Start clock offset from skills: Head Start and Mountain. */
export function startOffset(a: Actor): number {
  let off = 0;
  if (a.skills.has("head-start")) off += sk("head-start", "startClock");
  if (a.skills.has("mountain")) off += sk("mountain", "startClock");
  return off;
}

/** Scrapper: roll(0..20) - 2 x Speed + offsets. Companion: its table value + roll(0..10). */
export function startClock(a: Actor, clock: Stream): number {
  if (a.comp !== null) return a.comp.startClock + roll(clock, 0, 10);
  return roll(clock, 0, 20) - 2 * a.spd + startOffset(a);
}

/**
 * The next actor: the lowest clock among those standing. On a tie an actor whose last Move cost
 * nothing (or that a Whistle called) goes first, then a seeded roll, then the actor id.
 */
export function nextActor(actors: readonly Actor[], tie: Stream): Actor | null {
  let best: Actor[] = [];
  for (const a of actors) {
    if (a.status !== "up") continue;
    const head = best[0];
    if (head === undefined || a.clock < head.clock) best = [a];
    else if (a.clock === head.clock) best.push(a);
  }
  if (best.length <= 1) return best[0] ?? null;
  const first = best.filter((a) => a.priority);
  const pool = first.length > 0 ? first : best;
  if (pool.length === 1) return pool[0]!;
  pool.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return pool[tie.int(pool.length)]!;
}
