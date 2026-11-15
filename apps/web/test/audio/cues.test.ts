/**
 * Sound on the fight clock (brief 3.13, plan WP4 gate): every cue of a fixture bout plays at or
 * after its contact time, no two impact cues fall inside 60 ms, a seek plays no sound, and at 2x
 * and 3x (VIP) the same cues play (faster in real time, same pitch), reduced motion or not.
 */
import { describe, expect, it } from "vitest";
import { stageFor } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import type { BoutFixtureName } from "@rankzero/core/fixtures";
import { capsuleRig } from "@rankzero/rig/testing";
import { createFightClock, createFightPlayer } from "@rankzero/stage";
import type { Cue, Timeline } from "@rankzero/stage";
import { createCueDriver } from "../../src/audio/cues";
import { STAGE_TEXT } from "../../src/text/stage";
import { STAGE_FONTS } from "../../src/ui/fonts";

const IMPACT = new Set(["fist", "blunt", "blade", "block"]);
const timelineOf = (name: BoutFixtureName, reducedMotion = false): Timeline => {
  const { log, a, b } = BOUT_FIXTURES[name];
  return createFightPlayer(log, a, b, capsuleRig, { reducedMotion, cosmeticSeed: log.seed, stage: stageFor(log.seed), text: STAGE_TEXT, fonts: STAGE_FONTS }).timeline;
};

/** Plays a bout through the real clock in frames of `frameMs` real time, the way FightScreen does. */
function playThrough(tl: Timeline, speed: 1 | 2 | 3, frameMs = 1000 / 60) {
  const clock = createFightClock(tl.durationMs);
  clock.speed = speed;
  const heard: { cue: Cue; clockAt: number }[] = [];
  const driver = createCueDriver(tl.cues, { play: () => undefined });
  while (clock.t < tl.durationMs) {
    const from = clock.t;
    const to = clock.tick(frameMs);
    for (const cue of driver.advance(from, to)) heard.push({ cue, clockAt: to });
  }
  return heard;
}

describe.each(["bout-gate", "bout-all-steps", "bout-cap"] as const)("cues of %s", (name) => {
  const tl = timelineOf(name);

  it("has cues", () => {
    expect(tl.cues.length).toBeGreaterThan(5);
  });

  it("every impact cue is at or after the contact of its step", () => {
    const impacts = tl.cues.filter((c) => IMPACT.has(c.family));
    expect(impacts.length).toBeGreaterThan(0);
    for (const c of impacts) {
      const marks = tl.contacts.filter((m) => m.step === c.step);
      expect(marks.length, `cue at ${c.at} (step ${c.step})`).toBeGreaterThan(0);
      expect(c.at).toBeGreaterThanOrEqual(Math.min(...marks.map((m) => m.at)));
    }
  });

  it("no two impact cues inside 60 ms", () => {
    const at = tl.cues.filter((c) => IMPACT.has(c.family)).map((c) => c.at).sort((p, q) => p - q);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(60);
  });

  it.each([1, 2, 3] as const)("playing at %ix sounds every cue once, in order, never before its time", (speed) => {
    const heard = playThrough(tl, speed);
    expect(heard.map((h) => h.cue)).toEqual(tl.cues.filter((c) => c.at > 0 || heard.some((h) => h.cue === c)));
    for (const h of heard) expect(h.clockAt).toBeGreaterThanOrEqual(h.cue.at);
    // a frame is at most one frame late: 16.7 ms at 1x, 33.3 ms of clock time at 2x, 50 ms at 3x
    for (const h of heard) expect(h.clockAt - h.cue.at).toBeLessThanOrEqual((1000 / 60) * speed + 1e-6);
  });

  it("at 3x each cue sounds exactly once, none early, and a 3x run hears what a 1x run hears", () => {
    const at1 = playThrough(tl, 1).map((h) => h.cue);
    const heard = playThrough(tl, 3);
    const counts = new Map<Cue, number>();
    for (const h of heard) counts.set(h.cue, (counts.get(h.cue) ?? 0) + 1);
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
    expect(heard.every((h) => h.clockAt >= h.cue.at)).toBe(true);
    expect(heard.map((h) => h.cue)).toEqual(at1);
  });

  it.each([1, 2, 3] as const)("reduced motion at %ix: the same rules hold on the reduced timeline", (speed) => {
    const rtl = timelineOf(name, true);
    const heard = playThrough(rtl, speed);
    expect(heard.map((h) => h.cue)).toEqual(rtl.cues.filter((c) => c.at > 0 || heard.some((h) => h.cue === c)));
    expect(new Set(heard.map((h) => h.cue)).size).toBe(heard.length);
    for (const h of heard) expect(h.clockAt).toBeGreaterThanOrEqual(h.cue.at);
    for (const h of heard) expect(h.clockAt - h.cue.at).toBeLessThanOrEqual((1000 / 60) * speed + 1e-6);
  });
});

describe("a seek plays no sound", () => {
  const tl = timelineOf("bout-gate");

  it("seeking across every cue sounds none, and play resumes from the new place", () => {
    const clock = createFightClock(tl.durationMs);
    const played: string[] = [];
    const driver = createCueDriver(tl.cues, { play: (c) => played.push(`${c.family}${c.variant}`) });
    const mid = tl.cues[Math.floor(tl.cues.length / 2)]!.at;
    clock.seek(mid + 1);
    driver.seek(clock.t);
    expect(played).toEqual([]);
    const from = clock.t;
    const to = clock.tick(50);
    const due = driver.advance(from, to);
    expect(due.every((c) => c.at > mid + 1)).toBe(true);
    expect(played).toHaveLength(due.length);
    clock.seek(0);
    driver.seek(0);
    clock.seek(tl.durationMs);
    driver.seek(tl.durationMs);
    expect(played).toHaveLength(due.length);
  });

  it("a frame in which nothing moved (paused) sounds nothing", () => {
    const driver = createCueDriver(tl.cues, { play: () => { throw new Error("no sound when paused"); } });
    const at = tl.cues[3]!.at;
    expect(driver.advance(at, at)).toEqual([]);
  });

  it("would catch a driver that sounds on seek (planted fault)", () => {
    const leaky = { advance: (f: number, t: number) => tl.cues.filter((c) => c.at > f && c.at <= t), seek: (t: number) => tl.cues.filter((c) => c.at <= t) };
    expect(leaky.seek(tl.durationMs).length).toBeGreaterThan(0);
  });
});
