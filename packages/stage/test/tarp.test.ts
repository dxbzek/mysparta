/**
 * The Tarp (round-2 close, owner on the recorded fights find-bout level 30 n 70, level 10 n 124 and
 * level 30 n 6276): one drape for a pet and a fighter, measured on built bouts with the real art.
 *  - the landing sound is cued on the frame the drawn sheet's hem reaches the floor;
 *  - pegged down it is low (no taller than 0.4 of its width) and the body under it is hidden, so no
 *    head floats over it and nothing it holds pokes out;
 *  - in flight it passes over the standing heads of the fighters it flies by;
 *  - a pinned pet does not move while it is pinned (a knockout's fall zone used to run it out,
 *    its pegged sheet sliding along on it);
 *  - coming off it slides along the floor and fades inside the bout's frame, never off it.
 */
import { describe, expect, it } from "vitest";
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { TARP, tarpHalf as rigHalf, tarpLow, tarpSlide as rigSlide } from "../../rig/src/content/fx";
import { drawnBox } from "../src/bounds";
import { homeSpan } from "../src/camera";
import type { StagePlayer } from "../src/createFightPlayer";
import { MOVE } from "../src/tuning";
import { tarpHalf, tarpSlide } from "../src/choreo/snare";
import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);
function found(level: number, n: number): { name: string; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot } {
  const a = rivalSnapshot(REALM_SALT, level, 2 * n);
  const b = rivalSnapshot(REALM_SALT, level, 2 * n + 1);
  return { name: `level ${level} n ${n}`, log: simulateFight(combineSeed("find-bout", n), a, b, 1), a, b };
}
const BOUTS = [found(30, 70), found(10, 124), found(30, 74), found(30, 181), found(30, 50), found(30, 67)];
const players = new Map<string, StagePlayer>();
const playerOf = (b: (typeof BOUTS)[number]): StagePlayer => {
  let p = players.get(b.name);
  if (p === undefined) { p = playerFor(b.log, b.a, b.b, FULL); players.set(b.name, p); }
  return p;
};
/** Each snare under a tarp: its target, when the sheet lands and when it comes off. */
function snares(b: (typeof BOUTS)[number], p: StagePlayer): { target: string; land: number; off: number }[] {
  const out: { target: string; land: number; off: number }[] = [];
  b.log.steps.forEach((s, i) => {
    if (s.t !== "snare") return;
    const prev = b.log.steps[i - 1];
    if (prev?.t !== "move" || prev.move !== "tarp") return;
    const land = p.timeline.stepAt[i]!;
    const j = b.log.steps.findIndex((q, k) => k > i && (q.t === "free" || q.t === "flee" || q.t === "ko") && "actor" in q && q.actor === s.target);
    out.push({ target: s.target, land, off: j < 0 ? p.timeline.durationMs : p.timeline.stepAt[j]! });
  });
  return out;
}

describe("the tarp drawing and the stage agree", () => {
  it("the stage's phases and reaches are the rig's", () => {
    expect(MOVE.tarpPhases).toEqual(TARP);
    for (const w of [20, 40, 90]) {
      expect(tarpHalf(w)).toBeCloseTo(rigHalf(w), 9);
      expect(tarpSlide(w)).toBeCloseTo(rigSlide(w), 9);
    }
  });
});

describe("the tarp on built bouts (real art)", () => {
  it("there are tarps over pets and over a fighter in these bouts", () => {
    const all = BOUTS.flatMap((b) => snares(b, playerOf(b)).map((s) => s.target));
    expect(all.some((t) => t === "a0" || t === "b0")).toBe(true);
    expect(all.some((t) => t !== "a0" && t !== "b0")).toBe(true);
  }, 120_000);

  for (const b of BOUTS) {
    it(`${b.name}: the landing sound is on the touchdown, the sheet is low and the body under it hidden`, () => {
      const p = playerOf(b);
      for (const s of snares(b, p)) {
        const cue = p.timeline.cues.find((c) => c.family === "move" && c.move === "tarp" && c.beat === "effect" && Math.abs(c.at - s.land) < 1);
        expect(cue, `${b.name}: a landing cue at ${s.land}`).toBeDefined();
        // the drawn hem is still in the air one frame before the cue and on the floor at it
        const before = p.frame(s.land - 17).fx.find((e) => e.fx === "tarp" && e.progress >= TARP.fly && e.progress < TARP.land);
        expect(before, `${b.name}: the sheet falling just before ${s.land}`).toBeDefined();
        const at = p.frame(s.land + 1).fx.filter((e) => e.fx === "tarp");
        expect(at.some((e) => e.progress >= TARP.land - 1e-6 && e.progress <= TARP.slump), `${b.name}: landed at ${s.land}`).toBe(true);
        // pegged down: low, and the body hidden while it is
        for (let t = s.land + MOVE.tarpSlumpMs + 20; t < Math.min(s.off, s.land + 3000); t += 150) {
          const f = p.frame(t);
          const sheet = f.fx.find((e) => e.fx === "tarp" && e.under === s.target);
          expect(sheet, `${b.name}: a sheet over ${s.target} at ${t}`).toBeDefined();
          expect(tarpLow(sheet!.size!.w, sheet!.size!.h)).toBeLessThanOrEqual(0.4 * sheet!.size!.w + 1e-9);
          expect(f.actors.find((a) => a.id === s.target)?.covered, `${b.name}: ${s.target} hidden at ${t}`).toBe(true);
        }
      }
    }, 120_000);

    it(`${b.name}: a pinned pet stays put, and the sheet comes off inside the frame`, () => {
      const p = playerOf(b);
      const span = homeSpan(p.tracks);
      for (const s of snares(b, p)) {
        if (s.target === "a0" || s.target === "b0") continue;
        const x0 = p.frame(s.land + 1).actors.find((a) => a.id === s.target)!.place.x;
        for (let t = s.land + 1; t < s.off - 1; t += 50) {
          const a = p.frame(t).actors.find((q) => q.id === s.target);
          if (a === undefined) continue;
          expect(Math.abs(a.place.x - x0), `${b.name}: ${s.target} moved while pinned at ${t}`).toBeLessThan(0.5);
        }
      }
      // every sheet coming off: from where it lay to where it slides, all of it in the frame
      for (const e of p.tracks.fx) {
        if (e.fx !== "tarp" || e.p0 !== TARP.heave || e.size === undefined) continue;
        const end = e.x + e.facing * tarpSlide(e.size.w);
        for (const c of [e.x, end]) {
          expect(c - tarpHalf(e.size.w), `${b.name}: sheet off at ${e.from}`).toBeGreaterThanOrEqual(span.x0 - 0.5);
          expect(c + tarpHalf(e.size.w), `${b.name}: sheet off at ${e.from}`).toBeLessThanOrEqual(span.x1 + 0.5);
        }
      }
    }, 120_000);

    it(`${b.name}: in flight the sheet passes over the heads it flies by`, () => {
      const p = playerOf(b);
      for (const e of p.tracks.fx) {
        if (e.fx !== "tarp" || e.fly === undefined) continue;
        const target = e.under!;
        // (from 50 ms after the release: it leaves the hand at the height the hand throws it from)
        for (let t = e.from + 50; t < e.from + e.fly.ms; t += 10) {
          const f = p.frame(t);
          const sheet = f.fx.find((q) => q.fx === "tarp" && q.progress < TARP.fly);
          if (sheet === undefined || sheet.behind === true) continue;
          for (const a of f.actors) {
            if (a.rig !== "scrapper" || a.id === target || a.seg?.clip === "throw" || a.clip.startsWith("throw")) continue;
            if (Math.abs(a.place.x - sheet.at.x) > 22) continue;
            const head = drawnBox(FULL, FULL.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place).y0;
            expect(sheet.at.y + 6, `${b.name}: the flying tarp at ${t} over ${a.id}'s head`).toBeLessThanOrEqual(head);
          }
        }
      }
    }, 120_000);
  }
});
