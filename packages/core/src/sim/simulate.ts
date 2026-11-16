/**
 * simulateFight (work package 1). Pure and seeded: the same seed and snapshots give the same log on
 * every engine. Whole-number maths only. The log's `result` is read from the reduced final state
 * with the contract's `resultOf`, so there is one definition of a result.
 */
import type { FighterSnapshot } from "../contracts/fighter";
import type { ActorInit, BoutLog, Side, Step } from "../contracts/log";
import { resultOf, stateAt } from "../contracts/reduce";
import type { Actor } from "./combatant";
import { buildSide } from "./combatant";
import type { Bout } from "./bout";
import { emit, scrapperOfSide } from "./bout";
import { nextActor, startClock } from "./clock";
import { boutStreams } from "./rng";
import type { Streams } from "./rng";
import { takeTurn } from "./turn";

export const TURN_CAP = 150;

/** The side that wins at the cap: the higher HP share; a tie goes to the challenged side (b). */
function capWinner(b: Bout): Side {
  const a = scrapperOfSide(b, "a");
  const d = scrapperOfSide(b, "b");
  return a.hp * d.maxHp > d.hp * a.maxHp ? "a" : "b";
}

/** The sim with its random streams given: tests pass scripted streams. */
export function simulateWith(seed: number, sa: FighterSnapshot, sb: FighterSnapshot, r: Streams): { log: BoutLog; actors: Actor[]; bag: Bout["bag"] } {
  const A = buildSide("a", sa);
  const B = buildSide("b", sb);
  const actors = [...A.actors, ...B.actors];
  const b: Bout = { r, actors, bag: { a: A.bag, b: B.bag }, steps: [], turn: 0, ended: false, shown: new Set(), lastTag: -99 };
  const init = {
    actors: actors.map((x): ActorInit => ({ id: x.id, kind: x.kind, maxHp: x.maxHp })),
    bag: { a: A.bag.map((it) => ({ ...it })), b: B.bag.map((it) => ({ ...it })) },
    shield: { a: A.shield, b: B.shield },
  };
  for (const x of actors) x.clock = startClock(x, r.clock);
  for (const x of actors) emit(b, { t: "enter", turn: 0, actor: x.id });

  while (!b.ended) {
    const next = nextActor(actors, r.tie);
    if (next === null) break;
    b.turn += 1;
    takeTurn(b, next);
    if (!b.ended && b.turn >= TURN_CAP) {
      emit(b, { t: "end", turn: b.turn, winner: capWinner(b), reason: "cap" });
      b.ended = true;
    }
  }
  const steps: Step[] = b.steps;
  const draft: BoutLog = { logVersion: 2, rulesVersion: 1, seed, init, steps,
    result: { winner: "b", reason: "cap", turns: 0, hpPct: { a: 0, b: 0 } } };
  const result = resultOf(stateAt(draft, steps.length));
  if (result !== null) draft.result = result;
  return { log: draft, actors, bag: b.bag };
}

export function simulateFight(seed: number, a: FighterSnapshot, b: FighterSnapshot, rulesVersion: 1): BoutLog {
  void rulesVersion;
  return simulateWith(seed, a, b, boutStreams(seed)).log;
}
