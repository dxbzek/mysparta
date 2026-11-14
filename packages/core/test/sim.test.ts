/**
 * Whole-bout properties of the sim (work package 1): invariants over 10,000 random bouts, bout
 * length, overtime, level-1 variety, and speed.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { BoutLog } from "../src/contracts/log";
import { REALM_SALT } from "../src/contracts/ids";
import { checkLog } from "../src/contracts/check";
import { combineSeed, makeRng } from "../src/prng";
import { canonical } from "../src/canonical";
import { rivalSnapshot } from "../src/progress/rivals";
import { simulateFight } from "../src/sim/simulate";
import { TURN_CAP } from "../src/sim/simulate";
import { beatsOf } from "../src/sim/beats";

const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");
const POOL = 1_000_000;

function bout(rng: ReturnType<typeof makeRng>, level: number): { seed: number; log: BoutLog; a: ReturnType<typeof rivalSnapshot>; b: ReturnType<typeof rivalSnapshot> } {
  const a = rivalSnapshot(REALM_SALT, level, rng.int(POOL));
  const b = rivalSnapshot(REALM_SALT, level, rng.int(POOL));
  const seed = rng.int(0x7fffffff);
  return { seed, a, b, log: simulateFight(seed, a, b, 1) };
}
function median(xs: number[]): number {
  const s = [...xs].sort((x, y) => x - y);
  return s[s.length >> 1]!;
}

describe("10,000 random bouts", () => {
  it("all end before turn 150 with one end, HP in range, one loser, and the same seed gives the same digest", () => {
    const rng = makeRng(combineSeed("invariants", 1));
    let maxTurns = 0;
    for (let i = 0; i < 10000; i++) {
      const level = 1 + rng.int(40);
      const { seed, a, b, log } = bout(rng, level);
      expect(checkLog(log), `bout ${i}`).toEqual([]);
      maxTurns = Math.max(maxTurns, log.result.turns);
      expect(log.result.turns).toBeLessThan(TURN_CAP);
      expect(log.steps.filter((s) => s.t === "end")).toHaveLength(1);
      expect(log.steps[log.steps.length - 1]!.t).toBe("end");
      const loser = log.result.winner === "a" ? "b" : "a";
      expect(log.result.hpPct[log.result.winner]).toBeGreaterThan(0);
      if (log.result.reason === "ko") expect(log.result.hpPct[loser]).toBe(0);
      if (i % 10 === 0) expect(sha(canonical(simulateFight(seed, a, b, 1)))).toBe(sha(canonical(log)));
    }
    expect(maxTurns).toBeLessThan(TURN_CAP);
  }, 120000);
});

describe("bout length and variety", () => {
  for (const [level, lo, hi] of [[1, 10, 20], [10, 12, 20], [30, 12, 20]] as const) {
    it(`level ${level}: median turns ${lo} to ${hi}, under 2% overtime`, () => {
      const rng = makeRng(combineSeed("length", level));
      const turns: number[] = [];
      let overtime = 0;
      const N = 3000;
      for (let i = 0; i < N; i++) {
        const { log } = bout(rng, level);
        turns.push(log.result.turns);
        if (log.steps.some((s) => s.t === "overtime")) overtime += 1;
      }
      const m = median(turns);
      expect(m).toBeGreaterThanOrEqual(lo);
      expect(m).toBeLessThanOrEqual(hi);
      expect(overtime / N).toBeLessThan(0.02);
    }, 60000);
  }

  it("level 1 over 2,000 random bouts: 85% show 3 or more beat types, 40% show 5 or more", () => {
    const rng = makeRng(combineSeed("variety", 1));
    let three = 0;
    let five = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const n = beatsOf(bout(rng, 1).log).size;
      if (n >= 3) three += 1;
      if (n >= 5) five += 1;
    }
    expect(three / N).toBeGreaterThanOrEqual(0.85);
    expect(five / N).toBeGreaterThanOrEqual(0.4);
  }, 60000);
});

describe("speed", () => {
  it("simulateFight takes a median of 3 ms or less, and 10,000 bouts take under 30 s", () => {
    const rng = makeRng(combineSeed("speed", 1));
    const pairs = Array.from({ length: 10000 }, () => {
      const level = 1 + rng.int(40);
      return { a: rivalSnapshot(REALM_SALT, level, rng.int(POOL)), b: rivalSnapshot(REALM_SALT, level, rng.int(POOL)), seed: rng.int(0x7fffffff) };
    });
    const times: number[] = [];
    const t0 = performance.now();
    for (const p of pairs) {
      const s = performance.now();
      simulateFight(p.seed, p.a, p.b, 1);
      times.push(performance.now() - s);
    }
    const total = performance.now() - t0;
    expect(median(times)).toBeLessThanOrEqual(3);
    expect(total).toBeLessThan(30000);
  }, 120000);
});
