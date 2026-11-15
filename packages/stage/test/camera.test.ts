/**
 * The stage camera (calm camera): a pure function of t, inside the stage, ONE frame for the whole
 * bout that fits both scrappers' home marks with the fighters large on a phone, and one slow
 * push-in from the knockout on. Reduced motion: the same frame and no push-in.
 */
import { describe, expect, it } from "vitest";
import { CAMERA, cameraAt, frameSpan, outroSpan, reframeAt } from "../src/camera";
import { STAGE_H, STAGE_W } from "../src/layout";
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

  it.each(FIXTURE_NAMES)("%s: holds one frame until the knockout, with both home marks and their room in view", (name) => {
    const p = fixturePlayer(name);
    const first = cameraAt(p.tracks, 0, PHONE, false);
    const ko = p.tracks.koFocus?.at ?? p.timeline.durationMs;
    for (const t of times(0, ko, 53)) expect(cameraAt(p.tracks, t, PHONE, false)).toEqual(first);
    const span = frameSpan(p.tracks);
    for (const x of [span.x0, span.x1]) {
      const sx = (x - first.x0) * first.k;
      expect(sx).toBeGreaterThanOrEqual(-1e-6);
      expect(sx).toBeLessThanOrEqual(PHONE.w + 1e-6);
    }
    // the brief's fixed camera fitted 360 x 240 into the canvas: k = 390 / 360. Twice that at least.
    expect(first.k).toBeGreaterThan(2 * (PHONE.w / STAGE_W));
  });

  it("never shows less height than the floor of the zoom", () => {
    const p = fixturePlayer("bout-all-steps");
    for (const t of times(0, p.timeline.durationMs, 61)) {
      const c = cameraAt(p.tracks, t, PHONE, false);
      expect(PHONE.h / c.k).toBeGreaterThanOrEqual(CAMERA.minVisibleH - 1e-6);
    }
  });

  it.each(FIXTURE_NAMES)("%s: reframes once from the knockout on, to hold the body on the floor, and stays; never under reduced motion", (name) => {
    const p = fixturePlayer(name);
    const ko = p.tracks.koFocus!;
    expect(ko).not.toBeNull();
    expect(reframeAt(p.tracks, ko.at - 1)).toBe(0);
    expect(reframeAt(p.tracks, ko.at + CAMERA.koMoveMs / 2)).toBeGreaterThan(0);
    expect(reframeAt(p.tracks, ko.at + CAMERA.koMoveMs)).toBe(1);
    // at the end the fallen body (a body length behind its mark) and both home marks are in view;
    // on a wide canvas the whole outro span is
    for (const view of [PHONE, DESK, { w: 390, h: 300 }]) {
      const end = cameraAt(p.tracks, p.timeline.durationMs, view, false);
      const span = outroSpan(p.tracks);
      const inView = (x: number): boolean => (x - end.x0) * end.k >= -1e-6 && (x - end.x0) * end.k <= view.w + 1e-6;
      expect(inView(ko.x + ko.back * CAMERA.bodyLength), `${view.w}x${view.h} body`).toBe(true);
      for (const a of p.tracks.actors) if (a.rig === "scrapper") expect(inView(a.home.x), `${view.w}x${view.h} ${a.id}`).toBe(true);
      if (view.w / view.h >= 1.2) for (const x of [span.x0, span.x1]) expect(inView(x), `${view.w}x${view.h} span`).toBe(true);
    }
    let last: number | null = null;
    let dir = 0;
    for (const t of times(ko.at, p.timeline.durationMs, 17)) {
      const k = cameraAt(p.tracks, t, PHONE, false).k;
      if (last !== null && Math.abs(k - last) > 1e-9) {
        const d = Math.sign(k - last);
        if (dir !== 0) expect(d).toBe(dir);
        dir = d;
      }
      last = k;
    }
    const r = fixturePlayer(name, "capsule", true);
    const still = cameraAt(r.tracks, 0, PHONE, true);
    for (const t of times(0, r.timeline.durationMs, 251)) expect(cameraAt(r.tracks, t, PHONE, true)).toEqual(still);
  });
});
