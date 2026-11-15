/**
 * The stage camera (fight screen v2): a pure function of t, inside the stage, framing both
 * scrappers large on a phone, pushing in only on a crit or the knockout, still under reduced motion.
 */
import { describe, expect, it } from "vitest";
import { CAMERA, cameraAt, punchAt } from "../src/camera";
import { HOME, STAGE_H, STAGE_W } from "../src/layout";
import { FIXTURE_NAMES, fixturePlayer, times } from "./lib/setup";

const PHONE = { w: 390, h: 470 };
const DESK = { w: 760, h: 520 };

describe("camera", () => {
  it.each(FIXTURE_NAMES)("%s: the same t gives the same view, always inside the stage", (name) => {
    const p = fixturePlayer(name);
    for (const view of [PHONE, DESK]) {
      for (const t of times(0, p.timeline.durationMs, 97)) {
        const c = cameraAt(p.tracks, t, view, false);
        expect(cameraAt(p.tracks, t, view, false)).toEqual(c);
        expect(c.x0).toBeGreaterThanOrEqual(-1e-6);
        expect(c.y0).toBeGreaterThanOrEqual(-1e-6);
        expect(c.x0 + view.w / c.k).toBeLessThanOrEqual(STAGE_W + 1e-6);
        expect(c.y0 + view.h / c.k).toBeLessThanOrEqual(STAGE_H + 1e-6);
      }
    }
  });

  it("frames both scrappers at their marks, larger than the old full-stage view", () => {
    const p = fixturePlayer("bout-gate");
    const t = p.timeline.firstActionAt - 50;
    const c = cameraAt(p.tracks, t, PHONE, false);
    for (const x of [HOME.x, STAGE_W - HOME.x]) {
      const sx = (x - c.x0) * c.k;
      expect(sx).toBeGreaterThan(0);
      expect(sx).toBeLessThan(PHONE.w);
    }
    // the brief's fixed camera fitted 360 x 240 into the canvas: k = 390 / 360
    expect(c.k).toBeGreaterThan(2.4 * (PHONE.w / STAGE_W));
  });

  it("never shows less height than the floor of the zoom", () => {
    const p = fixturePlayer("bout-all-steps");
    for (const t of times(0, p.timeline.durationMs, 61)) {
      const c = cameraAt(p.tracks, t, PHONE, false);
      expect(PHONE.h / c.k).toBeGreaterThanOrEqual(CAMERA.minVisibleH / (1 + CAMERA.punchKo) - 1e-6);
    }
  });

  it("pushes in only after a crit or knockout shake, and never under reduced motion", () => {
    const p = fixturePlayer("bout-gate");
    expect(punchAt(p.tracks, 0)).toBe(0);
    const ko = p.timeline.contacts.find((c) => c.step === p.timeline.killStep)!;
    expect(punchAt(p.tracks, ko.at + CAMERA.punchInMs)).toBeGreaterThan(0.1);
    const r = fixturePlayer("bout-gate", "capsule", true);
    const still = cameraAt(r.tracks, 0, PHONE, true);
    for (const t of times(0, r.timeline.durationMs, 251)) expect(cameraAt(r.tracks, t, PHONE, true)).toEqual(still);
  });
});
