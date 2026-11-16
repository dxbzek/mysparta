/**
 * Pets on stage (owner, 15 Nov 2026: "Animal covering all animals and model"). Over every 60 fps
 * frame of real sim bouts with three pets a side, on the capsule rig and the real art:
 *  - at rest, no pet's drawn box covers more than 20% of any fighter's box, and none touches its
 *    own owner's; no two pets share more than 15% of the narrower one's width;
 *  - at rest every pet is inside the camera's frame (on every canvas that can open that wide);
 *  - a fighter draws over a pet at its depth; a pet comes in front only during its own attack;
 *  - on its way to a bite and back, a pet never runs through its own owner: whenever their boxes
 *    meet, the pet is behind him (drawn first) unless it is in its own attack at his depth;
 *  - every pet is drawn no taller than its share of a fighter's height (layout.PET_HEIGHT), and
 *    the stage's measured tables (PET_SCALE, PET_REACH, SCRAPPER_REACH) still fit the real art.
 * The control: pets back at their owner's feet, as the fight-screen pass had them, turn it red.
 * Boxes are what the rig paints (src/bounds.ts), measured on the frame's own pose and dress.
 */
import { describe, expect, it } from "vitest";
import type { CompanionId } from "@rankzero/core";
import { COMPANION_IDS, simulateFight } from "@rankzero/core";
import { l1Pipe } from "@rankzero/core/fixtures";
import { boxArea, drawnBox, measureReach, scaleForShare } from "../src/bounds";
import { frameSpan } from "../src/camera";
import { PET_HEIGHT, PET_REACH, PET_SCALE, SCRAPPER_REACH, STAGE_W } from "../src/layout";
import { BOUTS, FRAME_MS, FULL, RIGS, boxOf, logOf, worstOf } from "./lib/pets";
import { playerFor } from "./lib/setup";

describe("pets beside their owners, measured on every frame", () => {
  it("the bouts are real sim bouts with three pets a side", () => {
    for (const b of BOUTS) {
      const log = logOf(b);
      for (const side of ["a", "b"]) {
        expect(log.init.actors.filter((a) => a.id.startsWith(side) && a.kind !== "scrapper").length, `${b.name} side ${side}`).toBe(3);
      }
      expect(log.steps.some((s) => s.t === "attack" && s.actor[1] !== "0"), `${b.name}: a pet attacks`).toBe(true);
    }
  });

  for (const b of BOUTS) {
    for (const [rigName, rig] of RIGS) {
      it(`${b.name}, ${rigName}: nothing at rest covers a fighter, pets stay apart and in frame, the draw order holds`, () => {
        const w = worstOf(b, rigName, rig);
        expect(w.frames).toBeGreaterThan(600);
        expect(w.cover, "a pet's box over a fighter's box at rest").toBeLessThanOrEqual(0.2);
        expect(w.ownerCover, "a pet's box touches its owner's at rest").toBeLessThanOrEqual(0.02);
        expect(w.petShare, "two pets' boxes overlap at rest").toBeLessThanOrEqual(0.15);
        expect(w.outOfFrame, "a pet at rest outside the camera frame (units)").toBeLessThanOrEqual(0.5);
        expect(w.order.slice(0, 5)).toEqual([]);
        expect(w.through.slice(0, 5)).toEqual([]);
      });
    }
  }

  it("every pet is drawn no taller than its share of a fighter's height (the per-rig scale)", () => {
    for (const [rigName, rig] of RIGS) {
      const fighter = measureReach(rig, "scrapper", { held: null, shield: null, scale: 1 }).up;
      for (const id of COMPANION_IDS as readonly CompanionId[]) {
        const up = measureReach(rig, id, { held: null, shield: null, scale: PET_SCALE[id] }).up;
        expect(up / fighter, `${rigName} ${id}`).toBeLessThanOrEqual(PET_HEIGHT[id] + 0.005);
      }
    }
  });

  it("the stage's reach table still covers the real art (a redraw that grows a pet turns this red)", () => {
    for (const id of COMPANION_IDS as readonly CompanionId[]) {
      const m = measureReach(FULL, id, { held: null, shield: null, scale: PET_SCALE[id] });
      const t = PET_REACH[id];
      for (const k of ["back", "front", "up", "down"] as const) expect(m[k], `${id} ${k}`).toBeLessThanOrEqual(t[k] + 1e-6);
      // and the scale is the largest the share allows, to a hundredth
      expect(scaleForShare(FULL, id, PET_HEIGHT[id]) - PET_SCALE[id], id).toBeLessThan(0.0101);
    }
    for (let build = 0; build < 3; build++) {
      const look = { ...l1Pipe.look, build };
      const m = measureReach(FULL, "scrapper", { held: null, shield: null, scale: 1, look });
      for (const k of ["back", "front", "up", "down"] as const) expect(m[k], `build ${build} ${k}`).toBeLessThanOrEqual(SCRAPPER_REACH[k] + 1e-6);
    }
  });

  it("every pet's drawn box lies on the stage at rest", () => {
    for (const b of BOUTS) {
      const p = playerFor(logOf(b), b.a, b.b, FULL);
      const f = p.frame(p.timeline.firstActionAt - 1);
      for (const a of f.actors) {
        const box = boxOf(FULL, a);
        expect(box.x0, a.id).toBeGreaterThanOrEqual(0);
        expect(box.x1, a.id).toBeLessThanOrEqual(STAGE_W);
        expect(boxArea(box)).toBeGreaterThan(0);
      }
    }
  });
});

// The verifier's bout (level 3 n 5) has no pet dodge since the sim start pass; these find-bout
// bouts do (one to three hops each).
describe("a pet's dodge hop stays in view (verifier, 15 Nov 2026: level 3 n 5, the crow hopped out of view)", () => {
  it("every pet's box stays inside the camera's bout frame while it hops", async () => {
    const { REALM_SALT, combineSeed, rivalSnapshot } = await import("@rankzero/core");
    const out: string[] = [];
    let count = 0;
    for (const [level, k] of [[3, 12], [5, 12], [6, 30], [8, 3], [8, 33]] as const) {
    const a = rivalSnapshot(REALM_SALT, level, 2 * k);
    const b = rivalSnapshot(REALM_SALT, level, 2 * k + 1);
    const log = simulateFight(combineSeed("find-bout", k), a, b, 1);
    const p = playerFor(log, a, b, FULL);
    const hops = p.tracks.nudges.filter((n) => n.key === "hop" && p.tracks.byId.get(n.actor)!.rig !== "scrapper");
    count += hops.length;
    const span = frameSpan(p.tracks);
    for (const n of hops) {
      for (let t = n.from; t <= n.from + n.outMs + n.holdMs + n.backMs; t += FRAME_MS) {
        const x = p.frame(t).actors.find((q) => q.id === n.actor);
        if (x === undefined) continue;
        const box = drawnBox(FULL, FULL.samplePose(x.rig, x.clip, x.clipT, x.aim), x.dress, x.place);
        if (box.x0 < span.x0 - 0.5 || box.x1 > span.x1 + 0.5) out.push(`L${level} n${k} ${n.actor} at ${Math.round(t)} ms: ${box.x0.toFixed(1)} to ${box.x1.toFixed(1)}`);
      }
    }
    }
    expect(count).toBeGreaterThan(4);
    expect(out.slice(0, 4)).toEqual([]);
  });
});
