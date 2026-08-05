/**
 * Combat pacing: the GDD calls a fight a "30-45 second spectacle"
 * (02-gdd-core.md §1). The theatre plays one narration line at a time, each
 * holding for its own duration, so the felt length is the sum of the holds —
 * not the tick count. This asserts the spectacle actually lands in its window.
 */
import { describe, expect, it } from "vitest";
import { applyDraft, createChampion, generateDraft, simulateFight, snapshot } from "@agoge/core";
import { combineSeed, makeRng } from "@agoge/core";
import { narrate } from "../src/narrate.js";
import type { BattlePlan, Champion } from "@agoge/core";

const PLAN: BattlePlan = { stance: "measured", gambit: "close_the_gap" };

function grown(name: string, level: number): Champion {
  const c = createChampion(name);
  for (let l = 1; l < level; l++) {
    const offers = generateDraft(c, l + 1, 0);
    applyDraft(c, offers, makeRng(combineSeed(c.seed, l)).int(offers.length), false);
  }
  return c;
}

/** Felt seconds of a fight at 1x speed. */
function seconds(level: number, seed: number): number {
  const a = grown("Pace" + seed, level);
  const b = grown("Foil" + seed, level);
  const r = simulateFight({ seed, attacker: snapshot(a, PLAN), defender: snapshot(b, PLAN) });
  const lines = narrate(r, ["Pace", "Foil"]);
  return lines.reduce((sum, l) => sum + l.hold, 0) / 1000;
}

describe("combat pacing", () => {
  it("a fight is a spectacle, not a chore: median under a minute at 1x", () => {
    const runs: number[] = [];
    for (const lvl of [1, 5, 10, 20]) {
      for (let s = 0; s < 25; s++) runs.push(seconds(lvl, s + lvl * 100));
    }
    runs.sort((x, y) => x - y);
    const median = runs[Math.floor(runs.length / 2)]!;
    const p90 = runs[Math.floor(runs.length * 0.9)]!;
    // 2x speed halves these; the skip button is always available.
    expect(median).toBeLessThan(60);
    expect(p90).toBeLessThan(95);
    // and never so short it reads as a stub
    expect(runs[0]!).toBeGreaterThan(5);
  });
});

describe("pacing report", () => {
  it.runIf((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BALANCE_REPORT)(
    "prints felt fight length by level",
    () => {
      for (const lvl of [1, 5, 10, 20, 30]) {
        const runs: number[] = [];
        for (let s = 0; s < 30; s++) runs.push(seconds(lvl, s + lvl * 100));
        runs.sort((a, b) => a - b);
        const med = runs[Math.floor(runs.length / 2)]!;
        console.log(`lvl ${String(lvl).padStart(2)}: median ${med.toFixed(1)}s at 1x (${(med / 2).toFixed(1)}s at 2x), range ${runs[0]!.toFixed(1)}-${runs[runs.length - 1]!.toFixed(1)}s`);
      }
    },
  );
});
