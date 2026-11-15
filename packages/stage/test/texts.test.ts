/**
 * Words over the fight, measured on every frame (review findings 23 and 52):
 *  - the CRIT sticker never covers the crit's damage number while both show (it covered "-54");
 *  - the winner's banner, under the camera on a phone and two desktop canvases, never covers the
 *    winner's head (it sat across his face; a fist or weapon raised in the win pose may reach it).
 * Boxes: a number is `TEXT.glyph` x its size per character wide and its size tall; a sticker as
 * draw.ts paints it (its text, 0.9 of its size of padding, `STICKER_H` of its size tall). The
 * winner's head is the head joint of the frame's own pose (the rig's inspect hook) plus the head's
 * drawn radius.
 */
import { describe, expect, it } from "vitest";
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import type { Box } from "../src/bounds";
import { cameraAt } from "../src/camera";
import { BANNER_K, MARGIN, STICKER_H, TOP_BAND } from "../src/draw";
import type { FrameText } from "../src/frame";
import { TEXT } from "../src/tuning";
import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);
const FRAME_MS = 1000 / 60;
type Inspect = { joints(pose: unknown, dress: unknown, at: unknown): [number, number][]; rigDef(r: string): { bones: readonly { id: string }[] } };
const INSPECT = (FULL as unknown as { inspect: Inspect }).inspect;
const HEAD = INSPECT.rigDef("scrapper").bones.findIndex((b) => b.id === "head");
/** The head's drawn radius above its joint, generous (figure units, times the drawn size). */
const HEAD_UP = 16;

function found(level: number, n: number): { log: BoutLog; a: FighterSnapshot; b: FighterSnapshot } {
  const a = rivalSnapshot(REALM_SALT, level, 2 * n);
  const b = rivalSnapshot(REALM_SALT, level, 2 * n + 1);
  return { log: simulateFight(combineSeed("find-bout", n), a, b, 1), a, b };
}
const BOUTS = [
  ["bout-gate", BOUT_FIXTURES["bout-gate"]], ["bout-all-steps", BOUT_FIXTURES["bout-all-steps"]],
  ["find-bout level 10 n 1", found(10, 1)], ["find-bout level 30 n 2", found(30, 2)],
] as const;

function boxOfText(t: FrameText): Box {
  const w = t.kind === "number" ? TEXT.glyph * t.size * t.text.length : TEXT.glyph * t.size * t.text.length + 0.9 * t.size;
  const h = t.kind === "number" ? t.size : t.size * STICKER_H;
  return { x0: t.x - w / 2, x1: t.x + w / 2, y0: t.y - h / 2, y1: t.y + h / 2 };
}
const meet = (p: Box, q: Box): boolean => Math.min(p.x1, q.x1) > Math.max(p.x0, q.x0) && Math.min(p.y1, q.y1) > Math.max(p.y0, q.y0);

describe("words over the fight", () => {
  for (const [name, bout] of BOUTS) {
    it(`${name}: the CRIT sticker never covers its number`, () => {
      const p = playerFor(bout.log, bout.a, bout.b, FULL);
      const crits = p.tracks.tags.filter((g) => g.text === "CRIT");
      const bad: string[] = [];
      for (const g of crits) {
        const n = p.tracks.numbers.find((x) => x.from === g.from)!;
        expect(n, `a number for the CRIT at ${g.from}`).toBeDefined();
        for (let t = g.from; t < g.to; t += FRAME_MS) {
          const texts = p.frame(t).texts;
          const tag = texts.find((x) => x.kind === "tag" && x.text === "CRIT" && Math.abs(x.x - g.x) < 1e-6);
          const num = texts.find((x) => x.kind === "number" && x.text === n.text && Math.abs(x.x - n.x) < 1e-6);
          if (tag !== undefined && num !== undefined && meet(boxOfText(tag), boxOfText(num))) bad.push(`${Math.round(t)} ms ${n.text}`);
        }
      }
      if (name === "bout-gate") expect(crits.length).toBeGreaterThan(0);
      expect(bad.slice(0, 4)).toEqual([]);
    });
  }

  for (const [name, bout] of BOUTS) {
    it(`${name}: the winner's banner stays clear of the winner on a phone and on desktops`, () => {
      const p = playerFor(bout.log, bout.a, bout.b, FULL);
      const banner = p.tracks.tags.find((g) => g.kind === "banner" && g.to === Infinity)!;
      expect(banner.band).toBe("top");
      const winner = `${p.tracks.winner}0`;
      const bad: string[] = [];
      for (const view of [{ w: 390, h: 470 }, { w: 760, h: 520 }, { w: 720, h: 480 }]) {
        const bk = Math.min(view.w * BANNER_K.perWidth, BANNER_K.max);
        const bottom = TOP_BAND + MARGIN + banner.size * bk * STICKER_H;
        for (let t = banner.from; t < p.timeline.durationMs; t += 50) {
          const f = p.frame(t);
          const a = f.actors.find((x) => x.id === winner);
          if (a === undefined) continue;
          const head = INSPECT.joints(FULL.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place)[HEAD]!;
          const cam = cameraAt(p.tracks, t, view, false);
          const top = (head[1] - HEAD_UP * a.dress.scale - cam.y0) * cam.k;
          if (top < bottom) bad.push(`${view.w}x${view.h} at ${t}: winner's head from ${top.toFixed(0)} px, banner to ${bottom.toFixed(0)} px`);
        }
      }
      expect(bad.slice(0, 4)).toEqual([]);
    });
  }
});
