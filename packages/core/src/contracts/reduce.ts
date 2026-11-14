/**
 * FROZEN CONTRACT (work package 0). The reducer: a bout log played forward with no rules.
 * Every step carries the values after it, so this file needs no formula and no random number.
 * It is used for skip, seek, the HUD and tests. It never changes its inputs.
 *
 * What each step does to the state:
 *   enter      nothing (every actor is in the state from the start)
 *   draw       the actor holds the weapon; its side's bag becomes bagAfter
 *   swap       the dropped weapon lands on the floor; the actor holds the new one; bag
 *   move       the bag; a Snatch with `taken` moves the weapon from the target to the actor;
 *              every entry of `hits` sets that target's HP
 *   attack, intercept, riposte      the target's HP becomes hpAfter
 *   throw      the target's HP; the bag; unless `after` is "held" the thrower's hand is empty;
 *              on "gone" the weapon lands on the floor
 *   disarm     unless `resisted`: the target's hand is empty and the weapon lands on the floor
 *   doorOff    the target's door is off and lands on the floor
 *   heal       the target's HP becomes hpAfter
 *   snare / free    the snared flag of the target / of the actor
 *   flee       the actor's status becomes "fled"
 *   ko         the actor's status becomes "ko"
 *   overtime   the actor's HP becomes hpAfter
 *   end        `ended` is set. Statuses do not change: on a cap ending the loser is still "up".
 */
import type { ActorId, ActorState, BagItem, BoutInit, BoutLog, BoutResult, BoutState, Side, Step } from "./log";
import type { HeldId, PropId } from "./ids";
import { isScrapper, sideOf } from "./log";

function copyBag(bag: readonly BagItem[]): BagItem[] {
  return bag.map((item) => ({ ...item }));
}

/** The state before the first step: everyone up at full HP with empty hands, bags full. */
export function initialState(init: BoutInit): BoutState {
  const actors: Partial<Record<ActorId, ActorState>> = {};
  for (const a of init.actors) {
    actors[a.id] = {
      id: a.id, kind: a.kind, hp: a.maxHp, maxHp: a.maxHp, status: "up", held: "fists",
      snared: false, door: a.kind === "scrapper" ? init.door[sideOf(a.id)] : false,
    };
  }
  return {
    i: 0, turn: 0, actors,
    bag: { a: copyBag(init.bag.a), b: copyBag(init.bag.b) },
    floor: [], ended: null,
  };
}

type Patch = Partial<Pick<ActorState, "hp" | "status" | "held" | "snared" | "door">>;

/** One step forward. Pure and instant. An id that is not in the state is ignored, never thrown on. */
export function reduce(s: BoutState, step: Step): BoutState {
  let actors = s.actors;
  let bag = s.bag;
  let floor = s.floor;
  let ended = s.ended;

  const patch = (id: ActorId, p: Patch): void => {
    const cur = actors[id];
    if (cur === undefined) return;
    actors = { ...actors, [id]: { ...cur, ...p } };
  };
  const setBag = (id: ActorId, next: readonly BagItem[]): void => {
    const side: Side = sideOf(id);
    bag = side === "a" ? { a: copyBag(next), b: bag.b } : { a: bag.a, b: copyBag(next) };
  };
  const drop = (item: PropId, from: ActorId): void => {
    floor = [...floor, { item, from, i: s.i }];
  };
  const empty: HeldId = "fists";

  switch (step.t) {
    case "enter":
      break;
    case "draw":
      patch(step.actor, { held: step.weapon });
      setBag(step.actor, step.bagAfter);
      break;
    case "swap":
      drop(step.dropped, step.actor);
      patch(step.actor, { held: step.weapon });
      setBag(step.actor, step.bagAfter);
      break;
    case "move":
      setBag(step.actor, step.bagAfter);
      if (step.taken !== undefined && step.target !== undefined) {
        patch(step.target, { held: empty });
        patch(step.actor, { held: step.taken });
      }
      if (step.hits !== undefined) {
        for (const h of step.hits) patch(h.target, { hp: h.hpAfter });
      }
      break;
    case "attack":
    case "intercept":
    case "riposte":
      patch(step.target, { hp: step.hpAfter });
      break;
    case "throw":
      patch(step.target, { hp: step.hpAfter });
      setBag(step.actor, step.bagAfter);
      if (step.after !== "held") patch(step.actor, { held: empty });
      if (step.after === "gone" && step.weapon !== null && step.weapon !== "fists") drop(step.weapon, step.actor);
      break;
    case "disarm":
      if (step.resisted !== true) {
        patch(step.target, { held: empty });
        drop(step.weapon, step.target);
      }
      break;
    case "doorOff":
      patch(step.target, { door: false });
      drop("car-door", step.target);
      break;
    case "heal":
      patch(step.target, { hp: step.hpAfter });
      break;
    case "snare":
      patch(step.target, { snared: true });
      break;
    case "free":
      patch(step.actor, { snared: false });
      break;
    case "flee":
      patch(step.actor, { status: "fled" });
      break;
    case "ko":
      patch(step.actor, { status: "ko" });
      break;
    case "overtime":
      patch(step.actor, { hp: step.hpAfter });
      break;
    case "end":
      ended = { winner: step.winner, reason: step.reason };
      break;
    default: {
      const unknown: never = step;
      void unknown;
    }
  }
  return { i: s.i + 1, turn: step.turn, actors, bag, floor, ended };
}

/** The state after the first `steps` steps. 0 gives the initial state; a number past the end gives the final state. */
export function stateAt(log: BoutLog, steps: number): BoutState {
  let s = initialState(log.init);
  const n = steps < 0 ? 0 : steps > log.steps.length ? log.steps.length : Math.floor(steps);
  for (let i = 0; i < n; i++) s = reduce(s, log.steps[i]!);
  return s;
}

/** Index of the first step that leaves a scrapper at 0 HP, or -1 on a cap ending. */
export function killStep(log: BoutLog): number {
  for (let i = 0; i < log.steps.length; i++) {
    const step = log.steps[i]!;
    switch (step.t) {
      case "attack":
      case "intercept":
      case "riposte":
      case "throw":
        if (step.hpAfter === 0 && isScrapper(step.target)) return i;
        break;
      case "move":
        if (step.hits !== undefined) {
          for (const h of step.hits) if (h.hpAfter === 0 && isScrapper(h.target)) return i;
        }
        break;
      case "overtime":
        if (step.hpAfter === 0 && isScrapper(step.actor)) return i;
        break;
      default:
        break;
    }
  }
  return -1;
}

/** HP as a whole percent of the max, rounded up, so it is 0 only at 0 HP. */
export function hpPercent(hp: number, maxHp: number): number {
  if (maxHp <= 0 || hp <= 0) return 0;
  return Math.floor((hp * 100 + maxHp - 1) / maxHp);
}

/** The result of a finished bout, read from its final state. `null` while the bout has not ended.
 *  The sim writes `log.result` with this function, so there is one definition. */
export function resultOf(s: BoutState): BoutResult | null {
  if (s.ended === null) return null;
  const a = s.actors.a0;
  const b = s.actors.b0;
  return {
    winner: s.ended.winner,
    reason: s.ended.reason,
    turns: s.turn,
    hpPct: {
      a: a === undefined ? 0 : hpPercent(a.hp, a.maxHp),
      b: b === undefined ? 0 : hpPercent(b.hp, b.maxHp),
    },
  };
}
