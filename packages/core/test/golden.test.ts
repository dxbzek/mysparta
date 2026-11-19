/**
 * Golden digests (work package 1): SHA-256 of the canonical log of 180 fixed bouts, 6 scenarios x
 * 30 seeds. The same digests are checked in headless Chromium and WebKit by tools/parity.
 * Only the sim owner regenerates them, in the same commit as a rules change:
 *   UPDATE_GOLDEN=1 pnpm --filter @rankzero/core exec vitest run test/golden.test.ts
 * Also here: the contract's reducer over every golden log equals the sim's own final state, and the
 * digests are tied to SIM_VERSION (golden/version.json): new digests under an old version are refused,
 * so a sim change cannot ship without a version bump (15 November review, finding 70).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonical } from "../src/canonical";
import { checkLog } from "../src/contracts/check";
import { resultOf, stateAt } from "../src/contracts/reduce";
import { simulateFight, simulateWith } from "../src/sim/simulate";
import { boutStreams } from "../src/sim/rng";
import { SIM_VERSION } from "../src/sim/version";
import { SCENARIOS, SEEDS_PER_SCENARIO, goldenBouts } from "./golden/scenarios";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "golden", "digests.json");
const VERSION_FILE = join(dirname(fileURLToPath(import.meta.url)), "golden", "version.json");
const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

const bouts = goldenBouts();

describe("golden digests", () => {
  it("are 180 bouts: 6 scenarios x 30 seeds", () => {
    expect(bouts).toHaveLength(SCENARIOS.length * SEEDS_PER_SCENARIO);
    expect(SCENARIOS).toHaveLength(6);
  });

  it("match the stored digests", () => {
    const got: Record<string, string[]> = {};
    for (const g of bouts) (got[g.scenario] ??= []).push(sha(canonical(simulateFight(g.seed, g.a, g.b, 1))));
    if (process.env.UPDATE_GOLDEN === "1") writeFileSync(FILE, JSON.stringify(got, null, 2) + "\n");
    const stored = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, string[]>;
    let compared = 0;
    for (const sc of SCENARIOS) {
      expect(stored[sc], sc).toHaveLength(SEEDS_PER_SCENARIO);
      for (let i = 0; i < SEEDS_PER_SCENARIO; i++) {
        expect(got[sc]![i], `${sc} #${i}`).toBe(stored[sc]![i]);
        compared += 1;
      }
    }
    expect(compared).toBe(180);
  });

  it("belong to the current SIM_VERSION: changed digests need a version bump", () => {
    const fingerprint = sha(readFileSync(FILE, "utf8").replace(/\r\n/g, "\n"));
    const stored = JSON.parse(readFileSync(VERSION_FILE, "utf8")) as { simVersion: number; digests: string };
    if (process.env.UPDATE_GOLDEN === "1" && stored.digests !== fingerprint) {
      if (stored.simVersion >= SIM_VERSION) throw new Error(`the golden digests changed: bump SIM_VERSION (now ${SIM_VERSION}) in src/sim/version.ts`);
      writeFileSync(VERSION_FILE, JSON.stringify({ simVersion: SIM_VERSION, digests: fingerprint }, null, 2) + "\n");
      return;
    }
    expect(stored).toEqual({ simVersion: SIM_VERSION, digests: fingerprint });
  });

  it("cover what the scenarios promise: fists only, weapons, companions and Moves", () => {
    const logs = bouts.map((g) => ({ g, log: simulateFight(g.seed, g.a, g.b, 1) }));
    const of = (sc: string) => logs.filter((x) => x.g.scenario === sc).map((x) => x.log);
    expect(of("l1-fists").every((l) => !l.steps.some((s) => s.t === "draw"))).toBe(true);
    expect(of("l1-weapon").some((l) => l.steps.some((s) => s.t === "draw"))).toBe(true);
    expect(of("companions").every((l) => l.init.actors.length >= 4)).toBe(true);
    expect(of("moves").filter((l) => l.steps.some((s) => s.t === "move")).length).toBeGreaterThan(20);
  });

  it("are well-formed logs that end once", () => {
    for (const g of bouts) {
      const log = simulateFight(g.seed, g.a, g.b, 1);
      expect(checkLog(log), `${g.scenario} #${g.i}`).toEqual([]);
    }
  });
});

describe("the reducer over every golden log", () => {
  it("equals the sim's own final state and result", () => {
    for (const g of bouts) {
      const { log, actors, bag } = simulateWith(g.seed, g.a, g.b, boutStreams(g.seed));
      const s = stateAt(log, log.steps.length);
      expect(resultOf(s)).toEqual(log.result);
      expect(s.bag, `${g.scenario} #${g.i} bag`).toEqual(bag);
      for (const x of actors) {
        const r = s.actors[x.id]!;
        expect({ hp: r.hp, status: r.status, held: r.held, snared: r.snared, shield: r.shield }, `${g.scenario} #${g.i} ${x.id}`)
          .toEqual({ hp: x.hp, status: x.status, held: x.scrapper ? x.held : "fists", snared: x.snared, shield: x.shield });
      }
    }
  });
});
