/**
 * Calm screen (owner, 15 Nov 2026: "I'm getting dizzy watching it"). Over every 60 fps frame of
 * the three fixture bouts, on a phone canvas and a desktop one, in full and reduced motion:
 *  - the camera holds still; outside the one knockout push-in it eases no faster than 3% zoom a
 *    second; the push-in starts at the knockout, zooms at most 25%/s, pans at most 140 px/s with
 *    at most 600 px/s2 of acceleration, and never turns back;
 *  - the screen shakes only on a crit or the knockout blow, 3 px or less, for less than 150 ms;
 *  - no actor is ever flashed white;
 *  - reduced motion: no camera motion and no shake at all.
 * The controls: the old camera's way of following a lunge (planted as a wobble on the real
 * camera) and a shake planted at three times its size must both turn the check red.
 */
import { describe, expect, it } from "vitest";
import { cameraAt } from "../src/camera";
import { CALM, calmProblems, motionStats } from "./lib/calm";
import { FIXTURE_NAMES, fixturePlayer } from "./lib/setup";

const PHONE = { w: 390, h: 470 };
const DESK = { w: 760, h: 520 };

describe("calm screen, measured on every frame", () => {
  for (const name of FIXTURE_NAMES) {
    for (const reduced of [false, true]) {
      for (const [label, view] of [["phone", PHONE], ["desktop", DESK]] as const) {
        it(`${name}, ${label}${reduced ? ", reduced motion" : ""}: camera, shake and flash inside the limits`, () => {
          const p = fixturePlayer(name, "capsule", reduced);
          const s = motionStats(p, view, reduced);
          expect(s.frames).toBeGreaterThan(400);
          expect(calmProblems(s, p.tracks.koFocus?.at ?? null, reduced)).toEqual([]);
          // one knockout reframe; none when the bout's frame already holds the fallen body (its
          // pets beside it reach as far)
          const k0 = cameraAt(p.tracks, 0, view, false).k;
          const k1 = cameraAt(p.tracks, p.timeline.durationMs, view, false).k;
          if (!reduced && p.tracks.koFocus !== null) expect(s.pushes).toBe(Math.abs(Math.log(k1 / k0)) > 0.05 ? 1 : 0);
        });
      }
    }
  }

  it("shakes on the knockout blow of the gate bout, small and short", () => {
    const p = fixturePlayer("bout-gate");
    const s = motionStats(p, PHONE, false);
    expect(s.maxShakePx).toBeGreaterThan(1);
    expect(s.maxShakePx).toBeLessThanOrEqual(CALM.shakePx);
    expect(s.longestShakeMs).toBeLessThan(CALM.shakeMs);
  });
});

describe("control: planted motion turns the check red", () => {
  it("a camera that follows the action (a lunge-sized wobble on the real camera) is caught", () => {
    const p = fixturePlayer("bout-gate");
    const follow = (t: number) => {
      const c = cameraAt(p.tracks, t, PHONE, false);
      return { ...c, x0: c.x0 + 14 * Math.sin(t / 190) };
    };
    const problems = calmProblems(motionStats(p, PHONE, false, follow), p.tracks.koFocus?.at ?? null, false);
    expect(problems.some((m) => m.includes("turns back"))).toBe(true);
    expect(problems.some((m) => m.includes("pans at"))).toBe(true);
  });

  it("a zoom that breathes in and out through the bout is caught", () => {
    const p = fixturePlayer("bout-gate");
    const breathe = (t: number) => {
      const c = cameraAt(p.tracks, t, PHONE, false);
      return { ...c, k: c.k * (1 + 0.08 * Math.sin(t / 300)) };
    };
    const problems = calmProblems(motionStats(p, PHONE, false, breathe), p.tracks.koFocus?.at ?? null, false);
    expect(problems.some((m) => m.includes("push-ins"))).toBe(true);
  });

  it("a shake planted at three times its size is caught", () => {
    const p = fixturePlayer("bout-gate", "capsule", false, { shakeScale: 3 });
    const problems = calmProblems(motionStats(p, PHONE, false), p.tracks.koFocus?.at ?? null, false);
    expect(problems.some((m) => m.includes("screen shakes"))).toBe(true);
  });
});
