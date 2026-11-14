/**
 * FROZEN CONTRACT (work package 0). A checker for the log rules written at the top of log.ts.
 * It walks a log with the reducer and reports every broken rule as one plain sentence.
 * The fixtures are checked with it, and the sim lane runs it over its golden logs.
 * It checks the shape and the after-values of a log. It knows no game formula.
 */
import type { ActorId, ActorState, BagItem, BoutLog, BoutState, Proc, Side, Step } from "./log";
import { COMPANION_IDS, isCompanionId, isMoveId, isSkillId, isWeaponId } from "./ids";
import { initialState, killStep, reduce, resultOf } from "./reduce";
import { isScrapper, scrapperOf, sideOf } from "./log";

const ACTOR_IDS: readonly string[] = ["a0", "a1", "a2", "a3", "b0", "b1", "b2", "b3"];

function isWhole(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

function bagKey(bag: readonly BagItem[]): string {
  return bag.map((it) => (it.k === "weapon" ? `w:${it.id}` : `m:${it.id}:${it.uses}`)).sort().join(",");
}

function bagWithout(bag: readonly BagItem[], weapon: string): BagItem[] | null {
  const at = bag.findIndex((it) => it.k === "weapon" && it.id === weapon);
  if (at < 0) return null;
  return [...bag.slice(0, at), ...bag.slice(at + 1)];
}

function bagAfterMove(bag: readonly BagItem[], move: string): BagItem[] | null {
  const at = bag.findIndex((it) => it.k === "move" && it.id === move);
  const item = bag[at];
  if (item === undefined || item.k !== "move" || item.uses < 1) return null;
  const rest = [...bag.slice(0, at), ...bag.slice(at + 1)];
  return item.uses > 1 ? [...rest, { k: "move", id: item.id, uses: item.uses - 1 }] : rest;
}

/** Every broken log rule, as plain sentences. An empty list means the log is well formed. */
export function checkLog(log: BoutLog): string[] {
  const out: string[] = [];
  const say = (i: number, step: Step | null, msg: string): void => {
    out.push(step === null ? msg : `step ${i} (${step.t}, turn ${step.turn}): ${msg}`);
  };

  if (log.logVersion !== 1) say(-1, null, "logVersion is not 1");
  if (log.rulesVersion !== 1) say(-1, null, "rulesVersion is not 1");
  if (!isWhole(log.seed)) say(-1, null, "seed is not a whole number");

  // ---- init
  const seen = new Set<string>();
  for (const a of log.init.actors) {
    if (!ACTOR_IDS.includes(a.id)) say(-1, null, `init: "${a.id}" is not an actor id`);
    if (seen.has(a.id)) say(-1, null, `init: actor ${a.id} is listed twice`);
    seen.add(a.id);
    if (isScrapper(a.id) !== (a.kind === "scrapper")) say(-1, null, `init: actor ${a.id} has the wrong kind "${a.kind}"`);
    if (a.kind !== "scrapper" && !isCompanionId(a.kind)) say(-1, null, `init: "${a.kind}" is not one of ${COMPANION_IDS.join(", ")}`);
    if (!isWhole(a.maxHp) || a.maxHp < 1) say(-1, null, `init: actor ${a.id} has a bad maxHp`);
  }
  if (!seen.has("a0") || !seen.has("b0")) say(-1, null, "init: a0 and b0 must both exist");
  for (const side of ["a", "b"] as const) {
    for (const it of log.init.bag[side]) {
      if (it.k === "weapon" && !isWeaponId(it.id)) say(-1, null, `init: bag ${side} holds an unknown weapon "${it.id}"`);
      if (it.k === "move" && (!isMoveId(it.id) || !isWhole(it.uses) || it.uses < 1)) say(-1, null, `init: bag ${side} holds a bad Move "${it.id}"`);
    }
  }
  if (out.length > 0) return out;

  // ---- steps
  let s: BoutState = initialState(log.init);
  const entered = new Set<string>();
  let ends = 0;
  let lastTurn = 0;

  for (let i = 0; i < log.steps.length; i++) {
    const step = log.steps[i]!;
    const err = (msg: string): void => say(i, step, msg);
    const get = (id: ActorId, role: string): ActorState | null => {
      const a = s.actors[id];
      if (a === undefined) { err(`${role} ${id} is not in this bout`); return null; }
      return a;
    };
    const up = (id: ActorId, role: string): ActorState | null => {
      const a = get(id, role);
      if (a !== null && a.status !== "up") { err(`${role} ${id} is ${a.status}`); return null; }
      return a;
    };
    const bagOf = (id: ActorId): BagItem[] => s.bag[sideOf(id)];
    const sameBag = (after: readonly BagItem[], want: readonly BagItem[] | null, what: string): void => {
      if (want === null) err(`${what} is not in the bag`);
      else if (bagKey(after) !== bagKey(want)) err(`bagAfter does not match the bag after ${what}`);
    };
    const procs = (list: readonly Proc[] | undefined): void => {
      if (list === undefined) return;
      for (const p of list) {
        get(p.by, "proc owner");
        if (!isSkillId(p.skill)) err(`proc names an unknown skill "${p.skill}"`);
      }
    };
    const lastStand = (list: readonly Proc[] | undefined, target: ActorId): boolean =>
      list !== undefined && list.some((p) => p.skill === "last-stand" && p.by === target);
    const damageLands = (target: ActorState, damage: number, hpAfter: number, saved: boolean): void => {
      if (!isWhole(damage) || damage < 1) err("a hit must deal 1 damage or more");
      const want = target.hp - damage > 0 ? target.hp - damage : saved ? 1 : 0;
      if (hpAfter !== want) err(`hpAfter is ${hpAfter}, but ${target.hp} HP minus ${damage} leaves ${want}`);
    };

    if (ends > 0) err("a step follows the end");
    if (!isWhole(step.turn) || step.turn < lastTurn) err("the turn number goes down or is not a whole number");
    if ((step.t === "enter") !== (step.turn === 0)) err("only enter steps are at turn 0, and every enter step is");
    lastTurn = step.turn;

    switch (step.t) {
      case "enter": {
        get(step.actor, "actor");
        if (entered.has(step.actor)) err(`${step.actor} enters twice`);
        entered.add(step.actor);
        break;
      }
      case "draw": {
        const a = up(step.actor, "actor");
        if (a === null) break;
        if (!isScrapper(a.id)) err("only a scrapper draws");
        if (a.held !== "fists") err(`draws with ${a.held} in the hand`);
        sameBag(step.bagAfter, bagWithout(bagOf(a.id), step.weapon), `drawing ${step.weapon}`);
        break;
      }
      case "swap": {
        const a = up(step.actor, "actor");
        if (a === null) break;
        if (a.held !== step.dropped) err(`drops ${step.dropped} but holds ${a.held}`);
        sameBag(step.bagAfter, bagWithout(bagOf(a.id), step.weapon), `drawing ${step.weapon}`);
        break;
      }
      case "move": {
        const a = up(step.actor, "actor");
        if (a === null) break;
        if (!isScrapper(a.id)) err("only a scrapper uses a Move");
        sameBag(step.bagAfter, bagAfterMove(bagOf(a.id), step.move), `using ${step.move}`);
        procs(step.procs);
        const t = step.target === undefined ? null : up(step.target, "target");
        if (step.taken !== undefined) {
          if (t === null) err("a taken weapon needs a target");
          else if (t.held !== step.taken) err(`takes ${step.taken} but the target holds ${t.held}`);
          if (a.held !== "fists") err("takes a weapon with a full hand");
        }
        for (const h of step.hits ?? []) {
          const ht = up(h.target, "hit target");
          if (ht !== null) damageLands(ht, h.damage, h.hpAfter, lastStand(step.procs, h.target));
        }
        break;
      }
      case "attack":
      case "intercept":
      case "riposte":
      case "throw": {
        const a = up(step.actor, "actor");
        const t = up(step.target, "target");
        procs(step.procs);
        if (a === null || t === null) break;
        if (sideOf(a.id) === sideOf(t.id)) err("actor and target are on the same side");
        if (isScrapper(a.id)) {
          if (step.weapon !== a.held) err(`swings ${String(step.weapon)} but holds ${a.held}`);
        } else if (step.weapon !== null) err("a companion swings with weapon null");
        if (step.outcome === "hit") damageLands(t, step.damage, step.hpAfter, lastStand(step.procs, t.id));
        else {
          if (step.damage !== 0 || step.crit) err(`an ${step.outcome} has damage 0 and no crit`);
          if (step.hpAfter !== t.hp) err(`an ${step.outcome} must leave HP at ${t.hp}`);
        }
        if (step.t === "attack" || step.t === "throw") {
          if (!isWhole(step.n) || step.n < 0) err("n must be 0 or more");
          if ((step.n === 0) !== (step.why === undefined)) err("swing 0 has no `why`, and every later swing has one");
        }
        if (step.t === "throw") {
          if (!isScrapper(a.id) || step.weapon === null || step.weapon === "fists") err("only a scrapper throws, and it throws a weapon");
          const bag = bagOf(a.id);
          const want: BagItem[] = step.after === "bag" && step.weapon !== null && step.weapon !== "fists"
            ? [...bag, { k: "weapon", id: step.weapon }] : bag;
          sameBag(step.bagAfter, want, "the throw");
        }
        break;
      }
      case "disarm": {
        up(step.actor, "actor");
        const t = get(step.target, "target");
        procs(step.procs);
        if (t !== null && t.held !== step.weapon) err(`knocks away ${step.weapon} but the target holds ${t.held}`);
        break;
      }
      case "doorOff": {
        up(step.actor, "actor");
        const t = get(step.target, "target");
        if (t !== null && !t.door) err("the target carries no door");
        break;
      }
      case "heal": {
        up(step.actor, "actor");
        const t = up(step.target, "target");
        if (t === null) break;
        if (!isWhole(step.amount) || step.amount < 1) err("a heal gives 1 HP or more");
        if (step.hpAfter !== t.hp + step.amount) err(`hpAfter is ${step.hpAfter}, but ${t.hp} HP plus ${step.amount} gives ${t.hp + step.amount}`);
        if (step.hpAfter > t.maxHp) err(`a heal cannot pass the max of ${t.maxHp} HP`);
        break;
      }
      case "snare": {
        up(step.actor, "actor");
        const t = up(step.target, "target");
        if (t !== null && t.snared) err("the target is already snared");
        break;
      }
      case "free": {
        const a = get(step.actor, "actor");
        if (a !== null && !a.snared) err("the actor is not snared");
        break;
      }
      case "flee": {
        const a = up(step.actor, "actor");
        if (a !== null && isScrapper(a.id)) err("a scrapper never runs off");
        break;
      }
      case "ko": {
        const a = up(step.actor, "actor");
        if (a !== null && a.hp !== 0) err(`${a.id} falls with ${a.hp} HP left`);
        if (step.by !== null) get(step.by, "by");
        break;
      }
      case "overtime": {
        const a = up(step.actor, "actor");
        if (a === null) break;
        if (!isScrapper(a.id)) err("only a scrapper loses HP in overtime");
        damageLands(a, step.damage, step.hpAfter, false);
        break;
      }
      case "end":
        ends += 1;
        break;
      default: {
        const unknown: never = step;
        err(`unknown step type ${JSON.stringify(unknown)}`);
      }
    }
    s = reduce(s, step);
  }

  // ---- the whole log
  if (ends !== 1) say(-1, null, `the log has ${ends} end steps, it needs exactly one`);
  const last = log.steps[log.steps.length - 1];
  if (last === undefined || last.t !== "end") say(-1, null, "the last step is not the end");
  for (const a of log.init.actors) {
    if (!entered.has(a.id)) say(-1, null, `actor ${a.id} never enters`);
  }
  for (const a of log.init.actors) {
    const st = s.actors[a.id];
    if (st !== undefined && st.hp === 0 && st.status === "up") say(-1, null, `actor ${a.id} is at 0 HP and has no ko step`);
    if (st !== undefined && (!isWhole(st.hp) || st.hp < 0 || st.hp > st.maxHp)) say(-1, null, `actor ${a.id} ends with HP out of range`);
  }
  if (s.ended !== null) {
    const win = s.actors[scrapperOf(s.ended.winner)];
    const loserSide: Side = s.ended.winner === "a" ? "b" : "a";
    const lose = s.actors[scrapperOf(loserSide)];
    const kill = killStep(log);
    if (win !== undefined && (win.hp < 1 || win.status !== "up")) say(-1, null, "the winner is not standing");
    if (s.ended.reason === "ko") {
      if (lose !== undefined && (lose.hp !== 0 || lose.status !== "ko")) say(-1, null, "a ko ending needs the loser at 0 HP with a ko step");
      if (kill < 0) say(-1, null, "a ko ending needs a kill step");
    } else {
      if (lose !== undefined && (lose.hp < 1 || lose.status !== "up")) say(-1, null, "a cap ending has both scrappers standing and no ko step for them");
      if (kill >= 0) say(-1, null, "a cap ending has no kill step");
    }
    const want = resultOf(s);
    if (JSON.stringify(want) !== JSON.stringify({ winner: log.result.winner, reason: log.result.reason,
      turns: log.result.turns, hpPct: { a: log.result.hpPct.a, b: log.result.hpPct.b } })) {
      say(-1, null, `result is ${JSON.stringify(log.result)} but the steps reduce to ${JSON.stringify(want)}`);
    }
  }
  return out;
}
