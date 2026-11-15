/**
 * Contract tests of the stage package (work package 0). This one file in the stage lane's test
 * folder belongs to the Lead; the stage lane writes every other test here.
 * It is also the reason `pnpm test` cannot pass with no test in this package.
 */
import { describe, expect, it } from "vitest";
import { STAGE_IDS, stageFor } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import * as stage from "../src/index";
import { SFX_VARIANTS } from "../src/index";
import type { CreateFightClock, CreateFightPlayer, FightClock, PlayerOpts, SfxFamily, StageText } from "../src/index";

describe("the stage package index", () => {
  it("exports the contract, the player, the clock and the cue helper", () => {
    expect(Object.keys(stage).sort()).toEqual(["SFX_VARIANTS", "createFightClock", "createFightPlayer", "cuesBetween"]);
  });
});

describe("sound families", () => {
  it("have the variation counts of the sound spec: 38 sounds in 15 families (rev 3 adds swing x3)", () => {
    expect(SFX_VARIANTS).toEqual({
      fist: 3, blunt: 4, blade: 4, block: 3, whoosh: 3, dash: 2, landing: 2, throw: 1,
      drop: 2, crowd: 2, companion: 3, move: 4, win: 1, loss: 1, swing: 3,
    });
    const counts = Object.values(SFX_VARIANTS);
    expect(counts.length).toBe(15);
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(38);
    for (const n of counts) expect(Number.isInteger(n) && n >= 1).toBe(true);
  });

  it("list exactly the families of the SfxFamily type (compile-time)", () => {
    const allNamed: keyof typeof SFX_VARIANTS extends SfxFamily ? (SfxFamily extends keyof typeof SFX_VARIANTS ? true : false) : false = true;
    expect(allNamed).toBe(true);
  });
});

describe("player options", () => {
  const text: StageText = { fight: "FIGHT", wins: (name) => `${name} WINS`, block: "BLOCK", miss: "MISS", crit: "CRIT",
    overtime: "OVERTIME", moveName: (id) => id, skillName: (id) => id };

  it("carry the arena, which the host takes from the bout seed", () => {
    for (const fixture of Object.values(BOUT_FIXTURES)) {
      const opts: PlayerOpts = { reducedMotion: false, cosmeticSeed: 1, stage: stageFor(fixture.log.seed), text,
        fonts: { display: "sans-serif", body: "sans-serif" } };
      expect(STAGE_IDS).toContain(opts.stage);
    }
    expect(stageFor(BOUT_FIXTURES["bout-gate"].log.seed)).toBe("yard");
    // @ts-expect-error  an options object with no arena does not compile
    const noArena: PlayerOpts = { reducedMotion: false, cosmeticSeed: 1, text, fonts: { display: "a", body: "b" } };
    expect(noArena.stage).toBeUndefined();
  });
});

describe("the two factories the stage lane must export (compile-time)", () => {
  it("make a player from a log, two snapshots, a rig and options, and a clock from a length", () => {
    const clockOut: ReturnType<CreateFightClock> extends FightClock ? true : false = true;
    const clockIn: Parameters<CreateFightClock> extends [durationMs: number] ? true : false = true;
    const playerIn: Parameters<CreateFightPlayer>["length"] extends 5 ? true : false = true;
    const playerOpts: Parameters<CreateFightPlayer>[4] extends PlayerOpts ? true : false = true;
    expect([clockOut, clockIn, playerIn, playerOpts]).toEqual([true, true, true, true]);
  });
});
