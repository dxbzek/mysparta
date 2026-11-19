/**
 * The stage camera (calm camera): a pure function of t, inside the stage on each axis the canvas
 * is shorter than the stage on (the whole stage and the night past it on a longer axis), ONE frame for the whole
 * bout that fits both scrappers' home marks with the fighters large on a phone, and the pets
 * beside them wherever the canvas can open that wide, and one slow
 * push-in from the knockout on. Reduced motion: the same frame and no push-in.
 */
import { describe, expect, it } from "vitest";
import { CAMERA, cameraAt, frameSpan, outroSpan, reframeAt } from "../src/camera";
import { FLOOR_Y, STAGE_H, STAGE_W } from "../src/layout";
import { CANVASES, PHONE_TALL, isTall, label } from "./lib/canvases";
import { FIXTURE_NAMES, fixturePlayer, times } from "./lib/setup";

/** The full-screen stage (owner, 19 Nov 2026): a phone upright. */
const PHONE = PHONE_TALL;
/** pnpm render-bout's 720 x 480 stage. */
const RENDER = { w: 720, h: 480 };

describe("camera", () => {
  it.each(FIXTURE_NAMES)("%s: the same t gives the same view; inside the stage, or the whole stage on a longer axis", (name) => {
    const p = fixturePlayer(name);
    const axis = (lo: number, len: number, size: number, tag: string, past = false): void => {
      if (len <= size + 1e-6) {
        expect(lo, tag).toBeGreaterThanOrEqual(-1e-6);
        // (the floor may go on past the stage's bottom edge)
        if (!past) expect(lo + len, tag).toBeLessThanOrEqual(size + 1e-6);
      } else {
        expect(lo, tag).toBeLessThanOrEqual(1e-6);
        expect(lo + len, tag).toBeGreaterThanOrEqual(size - 1e-6);
      }
    };
    // (on the knockout reframe's way the view is not clamped: only its two ends are)
    const moving = (t: number): boolean => p.tracks.koFocus !== null && t > p.tracks.koFocus.at && t < p.tracks.koFocus.at + CAMERA.koMoveMs;
    for (const view of CANVASES) {
      for (const t of times(0, p.timeline.durationMs, 97)) {
        const c = cameraAt(p.tracks, t, view, false);
        expect(cameraAt(p.tracks, t, view, false)).toEqual(c);
        if (moving(t)) continue;
        axis(c.x0, view.w / c.k, STAGE_W, `${label(view)} x at ${t}`);
        axis(c.y0, view.h / c.k, STAGE_H, `${label(view)} y at ${t}`, true);
      }
    }
  });

  it.each(FIXTURE_NAMES)("%s: the HUD over the canvas never covers a standing head, and in the outro the result card never covers the feet", (name) => {
    const p = fixturePlayer(name);
    const end = p.timeline.durationMs;
    const head = FLOOR_Y - CAMERA.headTop;
    for (const view of CANVASES) {
      const c = cameraAt(p.tracks, 0, view, false);
      expect((head - c.y0) * c.k, `${label(view)} heads`).toBeGreaterThanOrEqual(CAMERA.hudRoomPx - 1e-6);
      expect((FLOOR_Y - c.y0) * c.k, `${label(view)} feet`).toBeLessThanOrEqual(view.h - CAMERA.lowRoomPx + 1e-6);
      if (p.tracks.koFocus === null) continue;
      const e = cameraAt(p.tracks, end, view, false);
      const room = isTall(view) ? CAMERA.resultRoomPx.tall : CAMERA.resultRoomPx.wide;
      expect((head - e.y0) * e.k, `${label(view)} outro heads under the banner`).toBeGreaterThanOrEqual(CAMERA.bannerRoomPx - 1e-6);
      expect((FLOOR_Y - e.y0) * e.k, `${label(view)} outro feet over the card`).toBeLessThanOrEqual(view.h - room + 1e-6);
    }
  });

  it.each(FIXTURE_NAMES)("%s: holds one frame until the knockout, with both home marks and their room in view", (name) => {
    const p = fixturePlayer(name);
    const first = cameraAt(p.tracks, 0, PHONE, false);
    const ko = p.tracks.koFocus?.at ?? p.timeline.durationMs;
    for (const t of times(0, ko, 53)) expect(cameraAt(p.tracks, t, PHONE, false)).toEqual(first);
    const span = frameSpan(p.tracks);
    const inView = (c: { x0: number; k: number }, w: number, x: number): boolean => (x - c.x0) * c.k >= -1e-6 && (x - c.x0) * c.k <= w + 1e-6;
    // the scrappers' marks and room are in view on every canvas; the whole span (the pets too)
    // on a wide canvas, and on a tall one when it is no wider than `tallViewW`
    for (const view of [...CANVASES, RENDER]) {
      const c = cameraAt(p.tracks, 0, view, false);
      for (const x of [span.must!.x0, span.must!.x1]) expect(inView(c, view.w, x), `${label(view)} scrappers`).toBe(true);
      if (!isTall(view) || span.x1 - span.x0 <= CAMERA.tallViewW) for (const x of [span.x0, span.x1]) expect(inView(c, view.w, x), `${label(view)} pets`).toBe(true);
    }
    // the brief's fixed camera fitted 360 x 240 into the canvas: k = 390 / 360. Twice that at
    // least when only the scrappers are framed; with pets beside them, as large as fits them all
    // up to `tallViewW` across (the tall phone's height never binds)
    if (p.tracks.actors.every((a) => a.rig === "scrapper")) expect(first.k).toBeGreaterThan(2 * (PHONE.w / STAGE_W));
    else expect(first.k).toBeCloseTo(PHONE.w / Math.max(span.must!.x1 - span.must!.x0, Math.min(span.x1 - span.x0, CAMERA.tallViewW)), 9);
  });

  it("never shows less height than the floor of the zoom", () => {
    const p = fixturePlayer("bout-all-steps");
    for (const view of CANVASES) {
      for (const t of times(0, p.timeline.durationMs, 61)) {
        const c = cameraAt(p.tracks, t, view, false);
        expect(view.h / c.k, label(view)).toBeGreaterThanOrEqual(CAMERA.minVisibleH - 1e-6);
      }
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
    for (const view of [...CANVASES, { w: 390, h: 300 }]) {
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
