/**
 * A companion's turn (work package 1). It makes one bare melee attack with its own numbers on a
 * random living enemy. It can combo and evade, never blocks, intercepts or ripostes; a scrapper may
 * intercept or riposte it. Its turn costs Tempo 100 at its own Speed.
 */
import type { Actor } from "./combatant";
import type { Bout } from "./bout";
import { pickEnemy } from "./bout";
import { turnCost } from "./clock";
import { meleeAttack } from "./melee";

/** Plays a companion turn and returns its time cost. */
export function companionTurn(b: Bout, a: Actor): number {
  const target = pickEnemy(b, a);
  if (target !== null) meleeAttack(b, a, target);
  return turnCost(a, "fists", b.r.clock);
}
