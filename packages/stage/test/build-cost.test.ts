/**
 * Building a bout stays cheap (round-2 close): measuring each whoosh on the drawn weapon head
 * (timeline.ts `forwardDrive`) at first measured the strike pose again on every sample, doubling
 * the build of a level-30 bout (303 to 631 ms). The app builds a bout on the main thread, and the
 * scripted session (`pnpm session`) caught a route guard answering late. Placing the whooshes may
 * cost at most 35% of the rest of the build, measured side by side in one process (best of 3).
 */
import { describe, expect, it } from "vitest";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);

describe("the cost of a build", () => {
  it("placing the whooshes on the drawn swing costs at most 35% more than a build without it (level 30 n 70)", () => {
    const a = rivalSnapshot(REALM_SALT, 30, 140), b = rivalSnapshot(REALM_SALT, 30, 141);
    const log = simulateFight(combineSeed("find-bout", 70), a, b, 1);
    const time = (noSwooshes: boolean): number => {
      let best = Infinity;
      for (let k = 0; k < 3; k++) {
        const t0 = performance.now();
        playerFor(log, a, b, FULL, false, noSwooshes ? { noSwooshes: true } : undefined);
        best = Math.min(best, performance.now() - t0);
      }
      return best;
    };
    time(true);
    const without = time(true);
    const withIt = time(false);
    expect(withIt / without, `${withIt.toFixed(0)} ms with the whooshes placed, ${without.toFixed(0)} ms without`).toBeLessThanOrEqual(1.35);
  }, 120_000);
});
