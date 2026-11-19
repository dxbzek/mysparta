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
  it("the fight screen wires the drawer to the hold and puts the 3x note over the speed buttons, not among the stage's numbers or in the app toast", () => {
    const src = readFileSync(fileURLToPath(new URL("../../src/fight/FightScreen.tsx", import.meta.url)), "utf8");
    expect(src).toMatch(/holdForSheet\(clock\)/);
    expect(src).toMatch(/releaseSheet\(clock,/);
    expect(src).not.toMatch(/game\?\.toast\(UI\.bout\.vipSpeed\)/);
    // the stage holds the floating numbers and tags: the note must not be drawn there (checker r2)
    expect(src).not.toMatch(/css\.speedNote/);
    expect(src).toMatch(/className=\{speedNote \? css\.barNote : "rz-visually-hidden"\} role="status">\{speedNote \? UI\.bout\.vipSpeed : ""\}/);
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

describe("the stage only (owner, 19 Nov 2026: \"I dont want the ui below honestly\")", () => {
  const src = readFileSync(fileURLToPath(new URL("../../src/fight/FightScreen.tsx", import.meta.url)), "utf8");
  const cssText = readFileSync(fileURLToPath(new URL("../../src/fight/fight.module.css", import.meta.url)), "utf8");
  it("nothing is laid out under the stage: the log and the fighter cards are in the drawer, closed by default", () => {
    expect(src).not.toMatch(/<LogStrip|css\.lower|css\.strip/);
    expect(src).toMatch(/useState<DrawerTab \| null>\(null\)/);
    expect(src).toMatch(/<FightDrawer[\s\S]*fighters=\{[\s\S]*<FighterCard/);
  });
  it("the HUD, the controls and the result card lie over the stage", () => {
    const rule = (cls: string): string => new RegExp(`\\n\\.${cls} \\{([^}]*)\\}`).exec(cssText)?.[1] ?? "";
    for (const cls of ["hud", "bottom", "result"]) expect(rule(cls), cls).toMatch(/position: absolute/);
    expect(rule("stageArea")).toMatch(/height: 100%/);
  });
  it("the HUD band is at most 52 px (labels.TOP_BAND: the stage's numbers stay under it)", () => {
    expect(/\n\.hud \{[^}]*max-height: 52px/.test(cssText)).toBe(true);
  });
});

import { SWIPE_CLOSE_PX, swipeCloses } from "../../src/fight/FightDrawer";
describe("the drawer closes on a swipe toward its edge", () => {
  it("down for the sheet, right for the side panel, and not on a short or crosswise drag", () => {
    const o = { x: 100, y: 100 };
    expect(swipeCloses(o, { x: 100, y: 100 + SWIPE_CLOSE_PX }, false)).toBe(true);
    expect(swipeCloses(o, { x: 100, y: 100 + SWIPE_CLOSE_PX - 1 }, false)).toBe(false);
    expect(swipeCloses(o, { x: 100, y: 100 - SWIPE_CLOSE_PX * 2 }, false)).toBe(false);
    expect(swipeCloses(o, { x: 100 + SWIPE_CLOSE_PX, y: 100 }, true)).toBe(true);
    expect(swipeCloses(o, { x: 100 + SWIPE_CLOSE_PX, y: 100 + SWIPE_CLOSE_PX * 2 }, true)).toBe(false);
    expect(swipeCloses(o, { x: 100, y: 100 + SWIPE_CLOSE_PX }, true)).toBe(false);
  });
});
