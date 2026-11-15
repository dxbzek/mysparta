/**
 * The fight rules the first draft left open (brief 3.7), one test each, plus the core formulas.
 * Rolls are chosen with scripted streams so each rule is seen deciding the outcome.
 */
import { describe, expect, it } from "vitest";
import { sk } from "../src/content/skills";
import { COMPANIONS } from "../src/content/companions";
import { companionValues, CAP } from "../src/sim/combatant";
import { bodyTempo, nextActor, turnBase } from "../src/sim/clock";
import { damageOf, interceptChance, meleeAttack, rawDamage } from "../src/sim/melee";
import { playMove } from "../src/sim/moves";
import { simulateWith } from "../src/sim/simulate";
import { takeTurn } from "../src/sim/turn";
import { checkLog } from "../src/contracts/check";
import type { Step } from "../src/contracts/log";
import { fn, queue, scripted, setup, snap } from "./helpers";

const whys = (steps: Step[]): (string | undefined)[] =>
  steps.flatMap((s) => (s.t === "attack" ? [s.why] : []));

describe("formulas", () => {
  it("bodyTempo is 160, 132, 120, 100, 80, 70, 60 at Speed 0, 3, 5, 10, 20, 30, 50", () => {
    expect([0, 3, 5, 10, 20, 30, 50].map(bodyTempo)).toEqual([160, 132, 120, 100, 80, 70, 60]);
  });
  it("gives the worked damage example at Strength 3: fists 7, knife 8, pipe 13, axe 19, sledge 36 before the tune", () => {
    const t = setup(snap([], { points: { strength: 3 } }), snap([]));
    const raw = (dmg: number): number => dmg + Math.floor((3 * (dmg + 4)) / 12);
    expect(raw(5)).toBe(7); expect(raw(6)).toBe(8); expect(raw(10)).toBe(13); expect(raw(15)).toBe(19); expect(raw(28)).toBe(36);
    t.A.held = "fists";
    expect(rawDamage(t.A, false)).toBe(7);
  });
  it("orders the whole-number maths: variance, multiplier, crit, then Armor, never below 1", () => {
    expect(damageOf(13, 115, 100, false, 0)).toBe(14);
    expect(damageOf(13, 115, 100, true, 0)).toBe(21);
    // floor(13 x 115 / 100) = 14; x 200 / 100 = 28; crit 42; Armor 10 takes 4.
    expect(damageOf(13, 115, 200, true, 10)).toBe(38);
    expect(damageOf(1, 85, 100, false, 60)).toBe(1);
  });
});

describe("rules the first draft left open", () => {
  it("a turn is any actor taking its place; a skipped snared turn writes no step, so turn numbers jump", () => {
    // Moves fire when ready (move rolls 0), every swing is evaded (hit rolls 0), every target is the
    // enemy scrapper (target rolls 0). A's Tarp covers B's Raccoon, which nobody hits, so its snare times out.
    const out = simulateWith(9, snap(["tarp"], { id: "a" }), snap(["raccoon"], { id: "b" }),
      scripted({ move: fn(() => 0), hit: fn(() => 0), target: fn(() => 0) }));
    const log = out.log;
    expect(checkLog(log)).toEqual([]);
    const snare = log.steps.findIndex((s) => s.t === "snare");
    expect(snare).toBeGreaterThan(0);
    const free = log.steps.find((s) => s.t === "free" && s.cause === "timeout");
    expect(free).toBeDefined();
    const used = new Set(log.steps.map((s) => s.turn));
    const missing = [...Array(log.result.turns).keys()].map((i) => i + 1).filter((t) => !used.has(t));
    expect(missing.length).toBeGreaterThanOrEqual(2);
  });

  it("a skipped snared turn costs one normal turn of time", () => {
    const t = setup(snap([]), snap([]), scripted({ clock: fn(() => 4) }));
    t.B.snared = true;
    const before = t.B.clock;
    takeTurn(t.bout, t.B);
    expect(t.B.clock - before).toBe(turnBase(t.B, "fists") + 4);
    expect(t.bout.steps).toEqual([]);
  });

  it("companions use Tempo 80, Reach 0, Crit 5, Pierce 0, Armor 0 and their own Evade, Aim, Combo, Disarm", () => {
    for (const id of ["raccoon", "goose", "boar"] as const) {
      const v = companionValues(COMPANIONS[id]);
      expect(v).toMatchObject({ crit: 5, pierce: 0, armor: 0, block: 0, evade: COMPANIONS[id].evade,
        aim: COMPANIONS[id].aim, combo: COMPANIONS[id].combo, disarm: COMPANIONS[id].disarm });
    }
    const t = setup(snap(["boar"]), snap([]));
    const boar = t.bout.actors.find((x) => x.id === "a1")!;
    expect(turnBase(boar, "fists")).toBe(Math.floor((80 * bodyTempo(boar.spd)) / 100));
    t.B.held = "broom";
    expect(interceptChance(boar, t.B, 0)).toBe(8 * 3);
  });

  it("a scrapper may intercept or riposte a companion's attack", () => {
    const t = setup(snap([]), snap(["broom"]), scripted({ hit: queue([0]) }));
    t.B.held = "broom";
    const raccoon = setup(snap(["raccoon"]), snap([])).bout.actors.find((x) => x.id === "a1")!;
    raccoon.side = "a";
    t.bout.actors.push(raccoon);
    meleeAttack(t.bout, raccoon, t.B);
    expect(t.bout.steps[0]!.t).toBe("intercept");
    const r = setup(snap(["raccoon"]), snap(["payback"]), scripted({ hit: queue([99, 99, 99, 99, 99, 0]) }));
    const pet = r.bout.actors.find((x) => x.id === "a1")!;
    meleeAttack(r.bout, pet, r.B);
    expect(r.bout.steps.some((s) => s.t === "riposte")).toBe(true);
  });

  it("the holder of a Thrown weapon has Reach 0 when it defends", () => {
    const t = setup(snap(["pipe"]), snap(["darts"]));
    t.A.held = "pipe";
    t.B.held = "darts";
    expect(interceptChance(t.A, t.B, 0)).toBe(0);
  });

  it("a landed throw can crit and can disarm with the normal chances", () => {
    const t = setup(snap(["darts"]), snap(["pipe"]), scripted({ hit: queue([99, 99, 0]), disarm: queue([0]) }));
    t.A.held = "darts"; t.bout.bag.a = [];
    t.B.held = "pipe";
    takeTurn(t.bout, t.A);
    const th = t.bout.steps.find((s) => s.t === "throw");
    expect(th !== undefined && th.t === "throw" && th.crit).toBe(true);
    expect(t.bout.steps.some((s) => s.t === "disarm")).toBe(true);
  });

  it("combo: the cap of 80 first, then each success halves it: 80, 40, 20, at most three extra swings", () => {
    const strong = (): ReturnType<typeof setup> => setup(snap(["flurry"], { points: { agility: 90 } }), snap([], { points: { agility: 90 } }));
    // Per swing: evade, block, crit; then the combo roll. Intercept first, riposte last.
    const swing = [99, 99, 99];
    const run = (combos: number[]): (string | undefined)[] => {
      const t = strong();
      const q: number[] = [99];
      for (const c of combos) q.push(...swing, c);
      q.push(...swing, 99, 99, 99, 99);
      t.bout.r = scripted({ hit: queue(q) });
      meleeAttack(t.bout, t.A, t.B);
      return whys(t.bout.steps);
    };
    expect(CAP.combo).toBe(80);
    expect(run([79, 39, 19])).toEqual([undefined, "combo", "combo", "combo"]);
    expect(run([79, 40])).toEqual([undefined, "combo"]);
    expect(run([80])).toEqual([undefined]);
  });

  it("Stubborn rolls before the combo roll, and its extra swing can start a combo", () => {
    const t = setup(snap(["stubborn"], { points: { agility: 90 } }), snap([], { points: { agility: 90 } }),
      // intercept 99; swing 0 evaded (0); stubborn 0; swing 1 lands (99, 99, crit 99); combo 0; swing 2 lands; combo 99; riposte 99
      scripted({ hit: queue([99, 0, 0, 99, 99, 99, 0, 99, 99, 99, 99, 99]) }));
    meleeAttack(t.bout, t.A, t.B);
    expect(whys(t.bout.steps)).toEqual([undefined, "stubborn", "combo"]);
  });

  it("Last Stand saves from a hit or a Move, but not from overtime", () => {
    const m = setup(snap(["firecrackers"]), snap(["last-stand"]), scripted({ damage: queue([8]) }));
    m.B.hp = 5;
    playMove(m.bout, m.A, "firecrackers");
    expect(m.B.hp).toBe(1);
    const o = setup(snap([]), snap(["last-stand"]), scripted({ move: fn((n) => n - 1) }));
    o.bout.turn = 60;
    o.B.hp = 1;
    o.B.snared = true;
    takeTurn(o.bout, o.B);
    expect(o.B.hp).toBe(0);
    expect(o.bout.steps.map((s) => s.t)).toEqual(["overtime", "ko", "end"]);
  });

  it("Firecrackers and Body Slam count as a hit for ending a snare", () => {
    for (const move of ["firecrackers", "body-slam"] as const) {
      const t = setup(snap([move]), snap([]));
      t.B.snared = true;
      playMove(t.bout, t.A, move);
      expect(t.bout.steps.some((s) => s.t === "free" && s.cause === "hit" && s.actor === "b0")).toBe(true);
      expect(t.B.snared).toBe(false);
    }
  });

  it("when Firecrackers drop a companion and the scrapper together, every one gets its ko before the end", () => {
    const t = setup(snap(["firecrackers"]), snap(["raccoon"]), scripted({ damage: queue([0]) }));
    const pet = t.bout.actors.find((x) => x.id === "b1")!;
    t.B.hp = 3;
    pet.hp = 1;
    playMove(t.bout, t.A, "firecrackers");
    expect(t.bout.steps.map((s) => (s.t === "ko" ? `ko ${s.actor}` : s.t))).toEqual(["move", "ko b1", "ko b0", "end"]);
  });

  it("the intercepting swing can crit and disarm, and the attacker still pays the full time cost", () => {
    const t = setup(snap(["pipe"]), snap(["broom"]),
      scripted({ hit: queue([0, 99, 99, 0]), disarm: queue([0]), throw: fn(() => 99), clock: fn(() => 3) }));
    t.A.held = "pipe"; t.A.heldAttacked = false; t.bout.bag.a = [];
    t.B.held = "broom";
    const clock = t.A.clock;
    takeTurn(t.bout, t.A);
    const ic = t.bout.steps[0]!;
    expect(ic.t).toBe("intercept");
    expect(ic.t === "intercept" && ic.crit).toBe(true);
    expect(t.bout.steps[1]!.t).toBe("disarm");
    expect(t.bout.steps.some((s) => s.t === "attack")).toBe(false);
    expect(t.A.clock - clock).toBe(turnBase(t.A, "pipe") + 3);
  });

  it("an actor whose Move cost nothing wins a tie on the clock and acts again at once", () => {
    const t = setup(snap(["haymaker"]), snap([]), scripted({ move: fn(() => 0) }));
    t.A.clock = 100; t.B.clock = 100;
    takeTurn(t.bout, t.A);
    expect(t.bout.steps[0]!.t).toBe("move");
    expect(t.A.clock).toBe(100);
    expect(nextActor(t.bout.actors, fn((n) => n - 1))!.id).toBe("a0");
  });

  it("intercept is not possible against a snared defender or by a companion", () => {
    const t = setup(snap([]), snap(["broom"]), scripted({ hit: fn(() => 0) }));
    t.B.held = "broom"; t.B.snared = true;
    meleeAttack(t.bout, t.A, t.B);
    expect(t.bout.steps.some((s) => s.t === "intercept")).toBe(false);
    const c = setup(snap([]), snap(["boar"]), scripted({ hit: fn(() => 0) }));
    const boar = c.bout.actors.find((x) => x.id === "b1")!;
    meleeAttack(c.bout, c.A, boar);
    expect(c.bout.steps.some((s) => s.t === "intercept" || s.t === "riposte")).toBe(false);
  });

  it("a snared actor neither evades nor blocks, and companions never block", () => {
    // Rolls of 0 would evade and block any free defender. The snared one takes the hit (and is freed by it).
    const t = setup(snap([]), snap(["wok", "slippery", "riot-shield"]), scripted({ hit: queue([0, 0, 99, 99, 99]) }));
    t.B.held = "wok"; t.B.snared = true;
    meleeAttack(t.bout, t.A, t.B);
    const first = t.bout.steps[0]!;
    expect(first.t === "attack" && first.outcome).toBe("hit");
    expect(t.bout.steps[1]!.t).toBe("free");
    const c = setup(snap([]), snap(["boar"]), scripted({ hit: queue([99, 99, 0]) }));
    meleeAttack(c.bout, c.A, c.bout.actors.find((x) => x.id === "b1")!);
    const a = c.bout.steps[0]!;
    expect(a.t === "attack" && a.outcome).toBe("hit");
  });

  it("from turn 50 a scrapper loses 8% of max HP after each of its own turns", () => {
    const t = setup(snap([]), snap([]));
    t.bout.turn = 50;
    const hp = t.A.hp;
    t.B.snared = true;
    takeTurn(t.bout, t.B);
    const ot = t.bout.steps.find((s) => s.t === "overtime")!;
    expect(ot.t === "overtime" && ot.damage).toBe(Math.floor((t.B.maxHp * 8) / 100));
    expect(t.A.hp).toBe(hp);
  });

  it("the Tarp covers a companion first, and Air Horn pushes the enemy scrapper's clock", () => {
    const t = setup(snap(["tarp"]), snap(["raccoon"]));
    playMove(t.bout, t.A, "tarp");
    const sn = t.bout.steps.find((s) => s.t === "snare")!;
    expect(sn.t === "snare" && sn.target).toBe("b1");
    expect(sk("air-horn", "clockPush")).toBe(40);
  });
});
