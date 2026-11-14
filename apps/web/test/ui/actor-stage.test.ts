/**
 * ActorStage draws the capsule rig idling and playing one named clip (plan, WP4 gate, critic).
 * Drawn in Node on a real canvas; the frames are compared by pixels, and a spy on the rig shows
 * which clip each frame sampled.
 */
import { createCanvas, Path2D } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { l1Pipe } from "@rankzero/core/fixtures";
import type { Ctx2D, DrawEnv, Rig } from "@rankzero/rig";
import { capsuleRig } from "@rankzero/rig/testing";
import { clipTimeAt, companionPlaces, drawActorStage } from "../../src/ui/ActorStage";

function surface(w: number, h: number) {
  const canvas = createCanvas(w, h);
  const raw = canvas.getContext("2d");
  const cache = new Map<string, Path2D>();
  const env: DrawEnv = {
    ctx: raw as unknown as Ctx2D,
    path: (d) => {
      let p = cache.get(d);
      if (!p) { p = new Path2D(d); cache.set(d, p); }
      return p;
    },
  };
  return { canvas, raw, env };
}

function spyRig(): { rig: Rig; clips: string[] } {
  const clips: string[] = [];
  const rig: Rig = { ...capsuleRig, samplePose: (r, clip, t, aim) => { if (r === "scrapper") clips.push(clip); return capsuleRig.samplePose(r, clip, t, aim); } };
  return { rig, clips };
}

const pixels = (s: ReturnType<typeof surface>): Uint8ClampedArray => s.raw.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
  return n;
};

describe("ActorStage", () => {
  const view = { w: 195, h: 130, dpr: 2 };

  it("draws the capsule scrapper idling, and the idle loop moves", () => {
    const { rig, clips } = spyRig();
    const a = surface(390, 260);
    drawActorStage(a.env, rig, { look: l1Pipe.look, held: "pipe" }, 0, view);
    const b = surface(390, 260);
    drawActorStage(b.env, rig, { look: l1Pipe.look, held: "pipe" }, 600, view);
    expect(clips).toEqual(["idle", "idle"]);
    const empty = surface(390, 260);
    capsuleRig.drawStage(empty.env, "yard", "back", 0);
    expect(diff(pixels(a), pixels(empty))).toBeGreaterThan(500);   // something besides a blank canvas
    expect(diff(pixels(a), pixels(b))).toBeGreaterThan(20);        // breathing changes the picture
  });

  it("plays one named clip, then rests on idle, then plays it again", () => {
    const { rig, clips } = spyRig();
    const swing = capsuleRig.clipInfo("scrapper", "swing").durationMs;
    const frames: Uint8ClampedArray[] = [];
    for (const t of [150, swing + 100, swing + 900 + 150]) {
      const s = surface(390, 260);
      drawActorStage(s.env, rig, { look: l1Pipe.look, held: "pipe", clip: "swing", restMs: 900 }, t, view);
      frames.push(pixels(s));
    }
    expect(clips).toEqual(["swing", "idle", "swing"]);
    expect(diff(frames[0]!, frames[2]!)).toBe(0);                   // the same pose one cycle later
    const idle = surface(390, 260);
    drawActorStage(idle.env, capsuleRig, { look: l1Pipe.look, held: "pipe" }, 150, view);
    expect(diff(frames[0]!, pixels(idle))).toBeGreaterThan(200);   // the swing is not the idle pose
  });

  it("times clips with the rig's own lengths", () => {
    expect(clipTimeAt(capsuleRig, "idle", 5000, 900)).toEqual({ clip: "idle", t: 5000 });
    const d = capsuleRig.clipInfo("scrapper", "win").durationMs;
    expect(clipTimeAt(capsuleRig, "win", d + 10, 900).clip).toBe(capsuleRig.clipInfo("scrapper", "win").loop ? "win" : "idle");
  });

  it("puts companions on their own marks, none on the owner", () => {
    const places = companionPlaces(["raccoon", "raccoon", "boar"], 1);
    const spots = new Set(places.map((p) => `${p.at.x},${p.at.y}`));
    expect(spots.size).toBe(3);
    for (const p of places) expect(`${p.at.x},${p.at.y}`).not.toBe("180,195");
    expect(companionPlaces(["goose"], -1)[0]!.at.x).toBeLessThan(180);
  });
});
