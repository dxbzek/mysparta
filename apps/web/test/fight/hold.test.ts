/** Review r2: opening the Bout log paused nothing, and the 3x note covered the fighter cards. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFightClock } from "@rankzero/stage";
import { holdForSheet, releaseSheet } from "../../src/fight/hold";

describe("the log sheet holds the bout", () => {
  it("a playing bout stops while the sheet is open and plays again when it closes", () => {
    const clock = createFightClock(10_000);
    clock.tick(500);
    const was = holdForSheet(clock);
    expect(clock.tick(800)).toBe(500);
    releaseSheet(clock, was);
    expect(clock.tick(100)).toBe(600);
  });
  it("a bout the player had paused stays paused after the sheet closes", () => {
    const clock = createFightClock(10_000);
    clock.paused = true;
    const was = holdForSheet(clock);
    releaseSheet(clock, was);
    expect(clock.paused).toBe(true);
  });
  it("the fight screen wires the sheet to the hold and keeps the 3x note on the stage, not in the app toast", () => {
    const src = readFileSync(fileURLToPath(new URL("../../src/fight/FightScreen.tsx", import.meta.url)), "utf8");
    expect(src).toMatch(/holdForSheet\(clock\)/);
    expect(src).toMatch(/releaseSheet\(clock,/);
    expect(src).not.toMatch(/game\?\.toast\(UI\.bout\.vipSpeed\)/);
  });
});

import { stampFadeAt } from "../../src/fight/StageOverlay";
describe("one verdict at the result (review r2)", () => {
  it("the K.O. stamp is full before the result card and gone a third of the way into it", () => {
    expect(stampFadeAt(0)).toBe(1);
    expect(stampFadeAt(0.2)).toBeCloseTo(0.4);
    expect(stampFadeAt(0.34)).toBe(0);
    expect(stampFadeAt(1)).toBe(0);
  });
});

import { glow } from "../../src/fight/beats";
describe("a fired skill's tile stays lit long enough to read at 1x (review r2)", () => {
  it("is fully lit for at least 900 ms and out by 1.6 s", () => {
    expect(glow(0)).toBe(1);
    expect(glow(900)).toBe(1);
    expect(glow(1300)).toBeGreaterThan(0);
    expect(glow(1600)).toBe(0);
  });
});
