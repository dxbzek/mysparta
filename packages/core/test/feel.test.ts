/**
 * Fight feel (sim-feel pass, 15 November 2026): the opening, the target weight, Move firing rates,
 * pet presence, and the visible moment of every passive that changes a fight number.
 */
import { describe, expect, it } from "vitest";
import type { FighterSnapshot } from "../src/contracts/fighter";
import type { MoveId, PerkId, ProcId } from "../src/contracts/ids";
import { MOVE_IDS, REALM_SALT, isCompanionId } from "../src/contracts/ids";
import type { BoutLog, BoutState, Proc, Step } from "../src/contracts/log";
import { stateAt } from "../src/contracts/reduce";
import { sk } from "../src/content/skills";
import { checkLog } from "../src/contracts/check";
import { combineSeed, makeRng } from "../src/prng";
import { rivalSnapshot } from "../src/progress/rivals";
import { simulateFight } from "../src/sim/simulate";
import { OPENING_PCT, OPENING_PET_PCT, OPENING_TURNS, SCRAPPER_TARGET_WEIGHT, pickEnemy, sortProcs } from "../src/sim/bout";
import { meleeAttack } from "../src/sim/melee";
import { UNARMED_MOVES, playMove } from "../src/sim/moves";
import { throwAttack } from "../src/sim/thrown";
import { takeTurn } from "../src/sim/turn";
import { fn, queue, scripted, setup, snap } from "./helpers";

const procsOf = (s: Step): readonly Proc[] => ("procs" in s && s.procs !== undefined ? s.procs : []);
const skillsOf = (steps: readonly Step[]): ProcId[] => steps.flatMap((s) => procsOf(s).map((p) => p.skill));

function randomBouts(n: number, tag: string, levels: readonly number[]): { a: FighterSnapshot; b: FighterSnapshot; log: ReturnType<typeof simulateFight> }[] {
  const rng = makeRng(combineSeed("feel", tag));
  const out = [];
  for (let i = 0; i < n; i++) {
    const level = levels[i % levels.length]!;
    const a = rivalSnapshot(REALM_SALT, level, rng.int(240));
    const b = rivalSnapshot(REALM_SALT, level, rng.int(240));
    out.push({ a, b, log: simulateFight(rng.int(2 ** 31), a, b, 1) });
  }
  return out;
}

describe("the opening", () => {
  it("one turn of the opening takes at most 10% of a scrapper's max HP, and the swings stop there", () => {
    // Hit rolls: no intercept, no evade, no block, no crit; a combo roll of 0 would pass if it came.
    const t = setup(snap(["sledgehammer"], { points: { strength: 40, agility: 90 } }), snap([]),
      scripted({ hit: queue([99, 99, 99, 99, 0, 99, 99, 99]) }));
    t.bout.turn = 1;
    t.A.held = "sledgehammer";
    meleeAttack(t.bout, t.A, t.B);
    const swings = t.bout.steps.filter((s) => s.t === "attack");
    const most = Math.floor((t.B.maxHp * OPENING_PCT) / 100);
    expect(swings[0]).toMatchObject({ outcome: "hit", damage: most });
    // The allowance is spent, so the combo that passed does not swing again.
    expect(swings).toHaveLength(1);
    expect(t.B.hp).toBe(t.B.maxHp - most);
  });

  it("is over after turn 5: the same hit then lands in full", () => {
    const t = setup(snap(["sledgehammer"], { points: { strength: 40 } }), snap([]), scripted({ hit: queue([99, 99, 99, 99]) }));
    t.bout.turn = OPENING_TURNS + 1;
    t.A.held = "sledgehammer";
    meleeAttack(t.bout, t.A, t.B);
    const sw = t.bout.steps.find((s) => s.t === "attack")!;
    expect(sw.t === "attack" && sw.damage).toBeGreaterThan(Math.floor((t.B.maxHp * OPENING_PCT) / 100));
  });

  it("a companion loses at most half its max HP in one turn of the opening", () => {
    const t = setup(snap(["anvil"], { points: { strength: 40 } }), snap(["raccoon"]), scripted({ hit: queue([99, 99, 99, 99]) }));
    t.bout.turn = 2;
    t.A.held = "anvil";
    const pet = t.bout.actors.find((x) => x.id === "b1")!;
    meleeAttack(t.bout, t.A, pet);
    expect(pet.hp).toBe(pet.maxHp - Math.floor((pet.maxHp * OPENING_PET_PCT) / 100));
    expect(pet.status).toBe("up");
  });

  it("no bout ends before turn 6 in 3,000 random bouts at levels 1 to 30, and every log is well formed", () => {
    const rng = makeRng(combineSeed("feel", "opening"));
    for (let i = 0; i < 3000; i++) {
      const level = 1 + rng.int(30);
      const log = simulateFight(rng.int(2 ** 31), rivalSnapshot(REALM_SALT, level, rng.int(240)),
        rivalSnapshot(REALM_SALT, level, rng.int(240)), 1);
      expect(log.result.turns).toBeGreaterThan(OPENING_TURNS);
      if (i % 10 === 0) expect(checkLog(log)).toEqual([]);
    }
  });
});

describe("targets", () => {
  it("the enemy scrapper counts twice in the target pick, each companion once", () => {
    expect(SCRAPPER_TARGET_WEIGHT).toBe(2);
    const seen: number[] = [];
    const t = setup(snap([]), snap(["raccoon", "goose"]), scripted({ target: fn((n, i) => { seen.push(n); return i; }) }));
    // b0 (weight 2), b1, b2: four slots, read in id order.
    const picks = [0, 1, 2, 3].map(() => pickEnemy(t.bout, t.A)!.id);
    expect(seen).toEqual([4, 4, 4, 4]);
    expect(picks).toEqual(["b0", "b0", "b1", "b2"]);
  });
});

/** Whether a Move's condition held at the start of a turn of side `side`'s scrapper, read from the
 *  reduced state of the log (a Haymaker, Firecrackers, Taunt and Sand are always counted ready). */
function readyAt(st: BoutState, side: "a" | "b", move: MoveId): boolean {
  const me = st.actors[`${side}0`]!;
  const foe = st.actors[side === "a" ? "b0" : "a0"]!;
  const mine = Object.values(st.actors).filter((x) => x !== undefined && x.id[0] === side && x.kind !== "scrapper" && x.status === "up");
  const theirs = Object.values(st.actors).filter((x) => x !== undefined && x.id[0] !== side && x.kind !== "scrapper" && x.status === "up");
  switch (move) {
    case "energy-drink": return me.hp * 100 < me.maxHp * sk("energy-drink", "belowHpPct");
    case "second-wind": return me.hp * 100 < me.maxHp * sk("second-wind", "belowHpPct");
    case "whistle": return mine.some((c) => c!.hp * 100 < c!.maxHp * sk("whistle", "belowHpPct"));
    case "snatch": return me.held === "fists" && foe.held !== "fists";
    case "air-horn": return theirs.length > 0;
    case "body-slam": return me.held === "fists";
    case "grapple": return me.held === "fists" && !foe.snared;
    case "tarp": return !foe.snared || theirs.some((c) => !c!.snared);
    default: return true;
  }
}

/** True when the Move's condition held at the start of at least one turn its owner took. */
function couldFire(log: BoutLog, side: "a" | "b", move: MoveId): boolean {
  let last = -1;
  for (let i = 0; i < log.steps.length; i++) {
    const s = log.steps[i]!;
    if (s.turn === last || s.turn === 0) continue;
    last = s.turn;
    const actor = "actor" in s ? s.actor : null;
    const own = actor === `${side}0` || (s.t === "intercept" && s.target === `${side}0`);
    // Round 2: only the unarmed Moves are ready in the opening (moves.ts).
    if (s.turn <= OPENING_TURNS && !UNARMED_MOVES.has(move)) continue;
    if (own && readyAt(stateAt(log, i), side, move)) return true;
  }
  return false;
}

describe("Moves fire in most bouts their owner can use them", () => {
  // A level-10 rival with the Move added; the Whistle owner also gets a Raccoon. Counted over the
  // bouts where the Move's condition held at the start of one of its owner's turns. 200 such bouts
  // each, sides swapped.
  const level = 10;
  for (const move of MOVE_IDS) {
    it(`${move} fires in 60% or more`, () => {
      const rng = makeRng(combineSeed("feel", "moves", move));
      let fired = 0;
      let n = 0;
      while (n < 200) {
        const base = rivalSnapshot(REALM_SALT, level, rng.int(240));
        const foe = rivalSnapshot(REALM_SALT, level, rng.int(240));
        if (base.perks.includes(move)) continue;
        const add: PerkId[] = move === "whistle" && !base.perks.some(isCompanionId) ? [move, "raccoon"] : [move];
        const own: FighterSnapshot = { ...base, id: `${base.id}+${move}`, perks: [...base.perks, ...add] };
        const swap = n % 2 === 1;
        const log = simulateFight(rng.int(2 ** 31), swap ? foe : own, swap ? own : foe, 1);
        const side = swap ? "b" : "a";
        if (!couldFire(log, side, move)) continue;
        if (log.steps.some((s) => s.t === "move" && s.move === (move as MoveId) && s.actor === `${side}0`)) fired += 1;
        n += 1;
      }
      expect(fired / n).toBeGreaterThanOrEqual(0.6);
    });
  }
});

describe("pets", () => {
  it("a pet acts 3 or more times in a typical bout it is in (median over 600 bouts, levels 1 to 30)", () => {
    const acts: number[] = [];
    for (const { log } of randomBouts(3000, "pets", [1, 5, 10, 20, 30])) {
      for (const side of ["a", "b"] as const) {
        const pets = log.init.actors.filter((x) => x.id[0] === side && x.kind !== "scrapper").map((x) => x.id);
        if (pets.length === 0) continue;
        acts.push(log.steps.filter((s) => (s.t === "attack" && s.n === 0 && pets.includes(s.actor))
          || (s.t === "intercept" && pets.includes(s.target))).length);
      }
    }
    expect(acts.length).toBeGreaterThan(600);
    const sorted = [...acts].sort((x, y) => x - y);
    expect(sorted[sorted.length >> 1]).toBeGreaterThanOrEqual(3);
  });
});

describe("skill tags", () => {
  it("a step carries at most one proc: Last Stand first, then rule, chance and number skills", () => {
    const p = (skill: ProcId): Proc => ({ by: "a0", skill });
    expect(sortProcs([p("padding"), p("last-stand"), p("slippery")])).toEqual([p("last-stand")]);
    expect(sortProcs([p("padding"), p("stubborn"), p("sharp-eye")])).toEqual([p("stubborn")]);
    expect(sortProcs([p("plate-vest"), p("sharp-eye")])).toEqual([p("sharp-eye")]);
    expect(sortProcs([p("padding"), p("plate-vest")])).toEqual([p("plate-vest")]);
    expect(sortProcs([p("bin-lid"), p("knock-loose")])).toEqual([p("bin-lid")]);
    expect(sortProcs([])).toBeUndefined();
    for (const { log } of randomBouts(300, "one-proc", [1, 10, 30])) {
      for (const s of log.steps) expect(procsOf(s).length).toBeLessThanOrEqual(1);
    }
  });

  it("Padding and Plate Vest show on a hit their Armor made smaller", () => {
    for (const id of ["padding", "plate-vest"] as const) {
      const t = setup(snap(["sledgehammer"]), snap([id]), scripted({ hit: queue([99, 99, 99, 99, 99]) }));
      t.A.held = "sledgehammer";
      meleeAttack(t.bout, t.A, t.B);
      expect(t.bout.steps[0]).toMatchObject({ t: "attack", outcome: "hit", procs: [{ by: "b0", skill: id }] });
    }
    // A hit too small for 10 Armor to remove a point shows nothing.
    const t = setup(snap([], { points: { strength: 0 } }), snap(["padding"]), scripted({ hit: queue([99, 99, 99, 99, 99]) }));
    meleeAttack(t.bout, t.A, t.B);
    expect(procsOf(t.bout.steps[0]!)).toEqual([]);
  });

  it("Sharpening Stone, Bare Knuckle, Pitcher and Pet Lover show on the hit they made bigger", () => {
    const blade = setup(snap(["machete", "sharpening-stone"]), snap([]), scripted({ hit: queue([99, 99, 99, 99, 99]) }));
    blade.A.held = "machete";
    meleeAttack(blade.bout, blade.A, blade.B);
    expect(blade.bout.steps[0]).toMatchObject({ outcome: "hit", procs: [{ by: "a0", skill: "sharpening-stone" }] });

    const fists = setup(snap(["bare-knuckle"]), snap([]), scripted({ hit: queue([99, 99, 99, 99, 99]) }));
    meleeAttack(fists.bout, fists.A, fists.B);
    expect(fists.bout.steps[0]).toMatchObject({ outcome: "hit", procs: [{ by: "a0", skill: "bare-knuckle" }] });

    const pitch = setup(snap(["darts", "pitcher"]), snap([]), scripted({ hit: queue([99, 99, 99, 99]) }));
    pitch.A.held = "darts";
    throwAttack(pitch.bout, pitch.A, pitch.B);
    expect(pitch.bout.steps[0]).toMatchObject({ t: "throw", outcome: "hit", procs: [{ by: "a0", skill: "pitcher" }] });

    const pets = setup(snap(["raccoon", "pet-lover"]), snap([]), scripted({ hit: queue([99, 99, 99, 99, 99]) }));
    const raccoon = pets.bout.actors.find((x) => x.id === "a1")!;
    meleeAttack(pets.bout, raccoon, pets.B);
    expect(pets.bout.steps[0]).toMatchObject({ actor: "a1", outcome: "hit", procs: [{ by: "a0", skill: "pet-lover" }] });
  });

  it("Pitcher shows on a melee weapon it sends back to the bag", () => {
    const t = setup(snap(["pipe", "pitcher"]), snap([]), scripted({ hit: queue([0]) }));
    t.A.held = "pipe";
    throwAttack(t.bout, t.A, t.B);
    expect(t.bout.steps[0]).toMatchObject({ t: "throw", outcome: "evade", after: "bag", procs: [{ by: "a0", skill: "pitcher" }] });
  });

  it("Quick Swap shows on the first swing after the draw it made; Heavy Lifter on a Heavy weapon's turn", () => {
    const q = setup(snap(["pipe", "quick-swap"]), snap([]), scripted({ draw: fn(() => 0) }));
    takeTurn(q.bout, q.A);
    expect(q.bout.steps.map((s) => s.t)).toEqual(["draw", "attack"]);
    expect(q.bout.steps[1]).toMatchObject({ n: 0, procs: [{ by: "a0", skill: "quick-swap" }] });

    const h = setup(snap(["sledgehammer", "heavy-lifter"]), snap([]));
    h.A.held = "sledgehammer";
    meleeAttack(h.bout, h.A, h.B);
    expect(h.bout.steps[0]).toMatchObject({ n: 0, procs: [{ by: "a0", skill: "heavy-lifter" }] });
  });

  it("Sand in the Eyes shows on a swing that missed only because of the sand, named for the thrower", () => {
    const t = setup(snap(["sand-in-the-eyes"]), snap([]));
    playMove(t.bout, t.A, "sand-in-the-eyes");
    // Evade 10, Aim 5 - 25 sand: chance 30 with the sand, 5 without. A roll of 20 is evaded only with it.
    t.bout.r = scripted({ hit: queue([99, 20]) });
    meleeAttack(t.bout, t.B, t.A);
    const sw = t.bout.steps.find((s) => s.t === "attack")!;
    expect(sw).toMatchObject({ actor: "b0", outcome: "evade", procs: [{ by: "a0", skill: "sand-in-the-eyes" }] });
  });

  it("Sharp Eye shows on a hit its Pierce got through a block", () => {
    // Block 5 + Wok 30 = 35; Pierce 16 leaves 19. A block roll of 25 is a hit only with Sharp Eye.
    const t = setup(snap(["sharp-eye"]), snap(["wok"]), scripted({ hit: queue([99, 99, 25, 99]) }));
    t.B.held = "wok";
    meleeAttack(t.bout, t.A, t.B);
    expect(t.bout.steps[0]).toMatchObject({ t: "attack", outcome: "hit", procs: [{ by: "a0", skill: "sharp-eye" }] });
  });

  it("every passive that changes a fight number shows in 1,500 random bouts", () => {
    const seen = new Set(skillsOf(randomBouts(1500, "procs", [1, 5, 10, 20, 30]).flatMap((x) => x.log.steps)));
    for (const id of ["padding", "plate-vest", "sharpening-stone", "bare-knuckle", "heavy-lifter", "pitcher", "pet-lover",
      "quick-swap", "sand-in-the-eyes", "sharp-eye", "anticipation", "payback", "flurry", "slippery", "knock-loose",
      "firm-grip", "parry", "stubborn", "last-stand", "head-start", "junk-collector", "trick-shot", "taunt"] as const) {
      expect(seen.has(id), id).toBe(true);
    }
  });
});
