/**
 * The Moves in the app's own path (owner, 16 Nov 2026: "The effects aren't there"): the seam's rig
 * after `loadFullRig`, the stage player the fight screen builds, the app's stage words. Every clip
 * a Move asks for (its action, its gesture, its target's reaction) is a real clip of that rig, not
 * the idle it falls back to, and drawing every Move on a phone canvas warns about nothing.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MoveId } from "@rankzero/core";
import { MOVE_IDS, REALM_SALT, combineSeed, rivalSnapshot, simulateFight, stageFor } from "@rankzero/core";
import { createFightPlayer } from "@rankzero/stage";
import { Path2D, createCanvas } from "@napi-rs/canvas";
import type { DrawEnv } from "@rankzero/rig";
import { loadFullRig, rig } from "../../src/seams/rig";
import { STAGE_TEXT } from "../../src/text/stage";

/** The clips each Move plays, on its user and on its target (choreo/move.ts). */
const CLIPS: Record<MoveId, readonly string[]> = {
  haymaker: ["power-up"], "energy-drink": ["drink"], tarp: ["throw", "snared"], whistle: ["power-up"],
  firecrackers: ["throw"], snatch: ["flick", "hit-light"], "air-horn": ["power-up", "ears"], "body-slam": ["slam", "slammed"],
  "sand-in-the-eyes": ["throw", "rub-eyes"], taunt: ["taunt", "angry"], "second-wind": ["power-up"], grapple: ["slam", "snared"],
};

let warns: string[] = [];
beforeAll(async () => { await loadFullRig(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("the Moves on the app's rig", () => {
  it.each([...MOVE_IDS])("%s: every clip it plays is a real clip of the full rig", (move) => {
    warns = [];
    vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => { warns.push(a.map(String).join(" ")); });
    const idle = rig.clipInfo("scrapper", "idle");
    for (const clip of CLIPS[move]) {
      const info = rig.clipInfo("scrapper", clip);
      expect(info.durationMs > 0, `${move}: ${clip}`).toBe(true);
      expect(info.durationMs === idle.durationMs && info.loop === idle.loop && info.events.length === idle.events.length, `${move}: ${clip} is idle`).toBe(false);
    }
    expect(warns.filter((w) => w.includes("no clip")), move).toEqual([]);
  });

  it("plays and draws a level-30 bout with every Move on a phone canvas without one missing clip or effect", () => {
    warns = [];
    vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => { warns.push(a.map(String).join(" ")); });
    const seen = new Set<string>();
    const cv = createCanvas(390 * 2, 260 * 2);
    const ctx = cv.getContext("2d");
    const cache = new Map<string, Path2D>();
    const env = { ctx, path(d: string) { let q = cache.get(d); if (q === undefined) { q = new Path2D(d); cache.set(d, q); } return q; } } as unknown as DrawEnv;
    for (const n of [0, 1, 2, 6, 8, 9, 10]) {
      const a = rivalSnapshot(REALM_SALT, 30, 2 * n);
      const b = rivalSnapshot(REALM_SALT, 30, 2 * n + 1);
      const log = simulateFight(combineSeed("find-bout", n), a, b, 1);
      const p = createFightPlayer(log, a, b, rig, { reducedMotion: false, cosmeticSeed: log.seed, stage: stageFor(log.seed), text: STAGE_TEXT,
        fonts: { display: "sans-serif", body: "sans-serif" } });
      log.steps.forEach((s, i) => {
        if (s.t !== "move") return;
        seen.add(s.move);
        for (let t = p.timeline.stepAt[i]!; t < p.timeline.stepEnd[i]! + 600; t += 80) p.draw(env, t, { w: 390, h: 260, dpr: 2 });
      });
    }
    expect(seen).toEqual(new Set(MOVE_IDS));
    expect(warns.filter((w) => w.includes("[rig]")), "rig warnings").toEqual([]);
  });
});
