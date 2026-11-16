/**
 * Round 2, second pass (16 November 2026), after the checker's findings on the first one: a tag
 * that waits is really not lost, Quick Swap and Bare Knuckle do something a watcher can see, the
 * last weapon is held harder, the stat card is not the losing card, and the starting weapon does
 * not decide level 1 for Rare starts either.
 */
import { describe, expect, it } from "vitest";
import type { PerkId } from "../src/contracts/ids";
import { REALM_SALT, perkKind } from "../src/contracts/ids";
import type { Proc, Step } from "../src/contracts/log";
import { sk } from "../src/content/skills";
import { combineSeed, makeRng } from "../src/prng";
import { fighterSeed } from "../src/progress/create";
import { STAT_CARD_MORE, statCardAmount, walk, walkWith } from "../src/progress/route";
import { rivalSnapshot } from "../src/progress/rivals";
import { LAST_WEAPON_DISARM_PCT, TAG_GAP_TURNS, due, pickProc, proc, tryDisarm } from "../src/sim/bout";
import { buildSide } from "../src/sim/combatant";
import { meleeAttack } from "../src/sim/melee";
import { simulateFight } from "../src/sim/simulate";
import { drawSlack, swapChance, takeTurn } from "../src/sim/turn";
import { fn, queue, scripted, setup, snap } from "./helpers";

const procsOf = (s: Step): readonly Proc[] => ("procs" in s && s.procs !== undefined ? s.procs : []);

/** Share of its owner's bouts in which each skill or shield shows (a tag or its Move), over random
 *  pool bouts of one level. */
function shownShare(level: number, n: number): Map<string, number> {
  const rng = makeRng(combineSeed("round2b", "shown", level));
  const own = new Map<string, { n: number; shown: number }>();
  for (let i = 0; i < n; i++) {
    const a = rivalSnapshot(REALM_SALT, level, rng.int(1_000_000));
    const b = rivalSnapshot(REALM_SALT, level, rng.int(1_000_000));
    const log = simulateFight(rng.int(2 ** 31), a, b, 1);
    const seen = new Set<string>();
    for (const s of log.steps) {
      for (const p of procsOf(s)) seen.add(`${p.by[0]}|${p.skill}`);
      if (s.t === "move") seen.add(`${s.actor[0]}|${s.move}`);
    }
    for (const [side, kit] of [["a", a], ["b", b]] as const) {
      for (const p of kit.perks) {
        if (perkKind(p) !== "skill" && perkKind(p) !== "shield") continue;
        const e = own.get(p) ?? { n: 0, shown: 0 };
        e.n += 1;
        if (seen.has(`${side}|${p}`)) e.shown += 1;
        own.set(p, e);
      }
    }
  }
  const out = new Map<string, number>();
  for (const [id, e] of own) if (e.n >= 100) out.set(id, e.shown / e.n);
  return out;
}

describe("a once-a-bout tag is spaced, not hidden", () => {
  it("a tag of a rare moment never waits; a tag of a frequent one waits 2 turns after a Move or a tag of its kind", () => {
    const t = setup(snap(["flurry", "padding", "plate-vest"]), snap([]));
    t.bout.turn = 10;
    t.bout.lastOften = 10;
    expect(pickProc(t.bout, [proc(t.A, "padding")])).toBeUndefined();
    expect(pickProc(t.bout, [proc(t.A, "flurry")])).toEqual([{ by: "a0", skill: "flurry" }]);
    // The rare tag does not start a wait.
    t.bout.turn = 10 + TAG_GAP_TURNS;
    expect(pickProc(t.bout, [proc(t.A, "padding")])).toEqual([{ by: "a0", skill: "padding" }]);
    // The frequent one does, and each shows once.
    t.bout.turn += 1;
    expect(pickProc(t.bout, [proc(t.A, "plate-vest")])).toBeUndefined();
    expect(pickProc(t.bout, [proc(t.A, "flurry")])).toBeUndefined();
    t.bout.turn += 1;
    expect(pickProc(t.bout, [proc(t.A, "padding"), proc(t.A, "plate-vest")])).toEqual([{ by: "a0", skill: "plate-vest" }]);
  });

  it("a rare tag that loses its step to a rule tag is owed, and shows on the next step of its kind", () => {
    const t = setup(snap([]), snap(["payback", "parry", "broom"]));
    expect(pickProc(t.bout, [proc(t.B, "parry"), proc(t.B, "payback")])).toEqual([{ by: "b0", skill: "parry" }]);
    expect(due(t.bout, t.B, "payback", false)).toBe(true);
    // The next riposte: Broom 28 + Payback 25. A roll of 10 passes without Payback, so only the
    // owed tag puts PAYBACK on it. Rolls: no intercept, no evade, no block, no crit, no combo,
    // the riposte, then the riposte's own swing.
    t.B.held = "broom";
    t.bout.r = scripted({ hit: queue([99, 99, 99, 99, 99, 10, 99, 99, 99]) });
    meleeAttack(t.bout, t.A, t.B);
    expect(t.bout.steps.find((s) => s.t === "riposte")).toMatchObject({ procs: [{ by: "b0", skill: "payback" }] });
    expect(due(t.bout, t.B, "payback", false)).toBe(false);

    const plain = setup(snap([]), snap(["payback", "broom"]), scripted({ hit: queue([99, 99, 99, 99, 99, 10, 99, 99, 99]) }));
    plain.B.held = "broom";
    meleeAttack(plain.bout, plain.A, plain.B);
    const r = plain.bout.steps.find((s) => s.t === "riposte")!;
    expect(r).toBeDefined();
    expect(procsOf(r)).toEqual([]);
  });

  it("at level 30 no chance passive is hidden (Flurry, Payback and Knock Loose showed in 6 to 8% of their owner's bouts)", () => {
    const share = shownShare(30, 2500);
    for (const id of ["flurry", "payback", "knock-loose", "sharp-eye", "anticipation", "slippery"]) {
      expect(share.get(id), id).toBeGreaterThan(0.3);
    }
    expect(share.get("head-start")).toBeGreaterThan(0.97);
    expect(share.get("quick-swap")).toBeGreaterThan(0.6);
    // The frequent tags share what is left of 19 turns: none under a fifth.
    for (const id of ["padding", "pitcher", "heavy-lifter", "plate-vest", "big-heart", "heavy-hands", "fast-twitch"]) {
      expect(share.get(id), id).toBeGreaterThan(0.2);
    }
  });

  it("at level 10 the same skills show in 40% or more of their owner's bouts, Quick Swap in 80%", () => {
    const share = shownShare(10, 2500);
    for (const id of ["flurry", "payback", "knock-loose", "sharp-eye", "anticipation", "padding", "pitcher", "heavy-lifter"]) {
      // A skill with under 100 owner bouts in the sample is not measured.
      if (share.has(id)) expect(share.get(id), id).toBeGreaterThan(0.4);
    }
    expect(share.size).toBeGreaterThan(25);
    expect(share.get("quick-swap")).toBeGreaterThan(0.8);
  });
});

describe("Quick Swap is a fast hand (it showed in 0 to 15% of its owner's bouts and changed no result)", () => {
  it("swaps a used weapon 50% of the time and draws with slack 2", () => {
    const t = setup(snap(["quick-swap", "pipe"]), snap([]));
    expect(swapChance(t.A)).toBe(50);
    expect(drawSlack(t.A)).toBe(2);
    expect(swapChance(setup(snap(["quick-swap", "firm-grip", "pipe"]), snap([])).A)).toBe(50);
  });

  it("a turn with a draw or a swap costs 30% less time and carries the tag; a turn without does not", () => {
    const cost = (perks: PerkId[], held: "fists" | "pipe"): { cost: number; steps: Step[] } => {
      const t = setup(snap(perks), snap([]), scripted({ draw: fn(() => 0), clock: fn(() => 0) }));
      t.A.held = held;
      t.A.heldAttacked = held !== "fists";
      if (held !== "fists") t.bout.bag.a.splice(t.bout.bag.a.findIndex((it) => it.k === "weapon" && it.id === held), 1);
      const before = t.A.clock;
      takeTurn(t.bout, t.A);
      return { cost: t.A.clock - before, steps: t.bout.steps };
    };
    const cut = (c: number): number => Math.floor((c * (100 + sk("quick-swap", "swapTime"))) / 100);
    expect(sk("quick-swap", "swapTime")).toBe(-30);
    // A draw with empty hands.
    const drawQ = cost(["quick-swap", "pipe"], "fists");
    const draw = cost(["pipe"], "fists");
    expect(drawQ.steps.map((s) => s.t)).toEqual(["draw", "attack"]);
    expect(drawQ.cost).toBe(cut(draw.cost));
    expect(drawQ.steps[1]).toMatchObject({ procs: [{ by: "a0", skill: "quick-swap" }] });
    // A swap of a weapon that has attacked (the draw stream answers 0: the swap roll passes).
    const swapQ = cost(["quick-swap", "pipe", "bat"], "pipe");
    const swap = cost(["pipe", "bat"], "pipe");
    expect(swapQ.steps.map((s) => s.t)).toEqual(["swap", "attack"]);
    expect(swap.steps.map((s) => s.t)).toEqual(["swap", "attack"]);
    expect(swapQ.cost).toBe(cut(swap.cost));
    expect(swapQ.steps[1]).toMatchObject({ procs: [{ by: "a0", skill: "quick-swap" }] });
    // No draw and no swap: the full cost, no tag.
    const stay = setup(snap(["quick-swap", "pipe"]), snap([]), scripted({ clock: fn(() => 0) }));
    const stayPlain = setup(snap(["pipe"]), snap([]), scripted({ clock: fn(() => 0) }));
    for (const t of [stay, stayPlain]) {
      t.A.held = "pipe";
      t.bout.bag.a.length = 0;
      takeTurn(t.bout, t.A);
    }
    expect(stay.A.clock).toBe(stayPlain.A.clock);
    expect(procsOf(stay.bout.steps[0]!)).toEqual([]);
  });
});

describe("Bare Knuckle opens with fists (it showed in 2% of its owner's level-30 bouts)", () => {
  it("has no sure first draw, draws with slack 12 and hits 150% harder with fists", () => {
    expect(buildSide("a", snap(["bare-knuckle", "pipe"])).actors[0]!.startDraw).toBe(false);
    expect(buildSide("a", snap(["pipe"])).actors[0]!.startDraw).toBe(true);
    expect(drawSlack(setup(snap(["bare-knuckle", "pipe"]), snap([])).A)).toBe(12);
    expect(sk("bare-knuckle", "fistDamage")).toBe(150);
  });
});

describe("the last weapon is held harder", () => {
  it("a hit's disarm chance is 40% of the usual one when the target's bag holds no weapon", () => {
    expect(LAST_WEAPON_DISARM_PCT).toBe(40);
    // Fists 3 + Monkey Wrench 60 = 63: a roll of 62 disarms a scrapper with a weapon in the bag;
    // with none the chance is floor(63 x 40 / 100) = 25.
    for (const [bag, roll, off] of [[["pipe", "bat"], 62, true], [["pipe"], 62, false], [["pipe"], 25, false], [["pipe"], 24, true]] as const) {
      const t = setup(snap(["monkey-wrench"]), snap([...bag]), scripted({ disarm: queue([roll]) }));
      t.A.held = "monkey-wrench";
      t.B.held = "pipe";
      t.bout.bag.b.splice(t.bout.bag.b.findIndex((it) => it.k === "weapon" && it.id === "pipe"), 1);
      tryDisarm(t.bout, t.A, t.B, "hit");
      expect(t.B.held, `${bag.join("+")} roll ${roll}`).toBe(off ? "fists" : "pipe");
    }
  });

  it("a Body Slam still knocks the last weapon off", () => {
    const t = setup(snap([]), snap(["pipe"]));
    t.B.held = "pipe";
    t.bout.bag.b.length = 0;
    tryDisarm(t.bout, t.A, t.B, "slam");
    expect(t.B.held).toBe("fists");
  });
});

describe("the stat card is not the losing card either", () => {
  it("gives 2 points, 3 from the 7th stat card taken and 4 from the 21st", () => {
    expect(STAT_CARD_MORE).toEqual([6, 20]);
    expect([0, 5, 6, 19, 20, 28].map(statCardAmount)).toEqual([2, 2, 3, 3, 4, 4]);
    for (let i = 0; i < 100; i++) {
      const seed = fighterSeed(REALM_SALT, `stat-${i}`);
      const picks = walkWith(seed, 29, (c) => (c.left.kind === "stat" ? "L" : "R"));
      const kit = walk(seed, picks);
      expect(kit.statCards).toBe(29);
      expect(kit.nodes.map((n) => { const c = n.taken === "L" ? n.left : n.right; return c.kind === "stat" ? c.amount : 0; }))
        .toEqual([...Array<number>(6).fill(2), ...Array<number>(14).fill(3), ...Array<number>(9).fill(4)]);
      // 14 starting points, then 6 x 2 + 14 x 3 + 9 x 4 (a starting skill is never a booster).
      expect(Object.values(kit.stats.points).reduce((a, b) => a + b, 0)).toBe(14 + 12 + 42 + 36);
    }
  });

  it("the card a rival sees does not depend on cards it did not take", () => {
    const seed = fighterSeed(REALM_SALT, "stat-mixed");
    const picks = walkWith(seed, 20, (c) => (c.left.kind === "stat" ? "R" : "L"));
    for (const n of walk(seed, picks).nodes) {
      const stat = n.left.kind === "stat" ? n.left : n.right;
      expect(stat.kind === "stat" && stat.amount).toBe(2);
    }
  });
});

describe("the starting weapon does not decide level 1, Rare starts included (it spread 26 points)", () => {
  it("every start with 500 bouts or more (Rare and up to Common) wins 42 to 63%, and they spread 20 points at most", () => {
    const rng = makeRng(combineSeed("round2b", "start-table"));
    const by = new Map<string, { w: number; n: number }>();
    for (let i = 0; i < 40_000; i++) {
      const a = rivalSnapshot(REALM_SALT, 1, rng.int(1_000_000));
      const b = rivalSnapshot(REALM_SALT, 1, rng.int(1_000_000));
      const log = simulateFight(rng.int(2 ** 31), a, b, 1);
      for (const [s, side] of [[a, "a"], [b, "b"]] as const) {
        const e = by.get(s.perks[0]!) ?? { w: 0, n: 0 };
        e.n += 1;
        if (log.result.winner === side) e.w += 1;
        by.set(s.perks[0]!, e);
      }
    }
    const rates = [...by.entries()].filter(([, e]) => e.n >= 500).map(([id, e]) => [id, (100 * e.w) / e.n] as const);
    expect(rates.length).toBeGreaterThanOrEqual(30);
    for (const [id, r] of rates) {
      expect(r, id).toBeGreaterThanOrEqual(42);
      expect(r, id).toBeLessThanOrEqual(63);
    }
    const all = rates.map(([, r]) => r);
    expect(Math.max(...all) - Math.min(...all)).toBeLessThanOrEqual(20);
  });
});
