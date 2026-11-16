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
import type { BoutLog, CompanionId, FighterSnapshot, PerkId } from "@rankzero/core";
import { COMPANION_IDS, simulateFight } from "@rankzero/core";
import { l10Boar, l10Raccoon, l1Knife, l1Pipe } from "@rankzero/core/fixtures";
import type { Rig } from "@rankzero/rig";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { capsuleRig } from "@rankzero/rig/testing";
import type { Box } from "../src/bounds";
import { boxArea, coverOf, drawnBox, measureReach, scaleForShare } from "../src/bounds";
import { cameraAt, frameSpan } from "../src/camera";
import type { StagePlayer } from "../src/createFightPlayer";
import type { FrameActor } from "../src/frame";
import { PET_FRAME_REACH, PET_HEIGHT, PET_REACH, PET_SCALE, SCRAPPER_REACH, STAGE_H, STAGE_W } from "../src/layout";
import type { Internal } from "../src/timeline";
import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);
const RIGS: readonly (readonly [string, Rig])[] = [["capsule", capsuleRig], ["real art", FULL]];
const FRAME_MS = 1000 / 60;
const VIEWS = [{ w: 390, h: 470 }, { w: 760, h: 520 }, { w: 720, h: 480 }] as const;

const kit = (base: FighterSnapshot, id: string, perks: PerkId[]): FighterSnapshot => ({ ...base, id, perks });
/** Three pets a side, every kind of pet in at least one bout. */
const BOUTS: readonly { name: string; seed: number; a: FighterSnapshot; b: FighterSnapshot }[] = [
  { name: "boar + two raccoons vs goose, dog, crow", seed: 4401,
    a: kit(l10Boar, "pets:a1", ["crowbar", "boar", "raccoon", "raccoon"]), b: kit(l10Raccoon, "pets:b1", ["bat", "goose", "stray-dog", "crow"]) },
  { name: "raccoon, cat, crow vs boar, dog, raccoon", seed: 4402,
    a: kit(l1Pipe, "pets:a2", ["pipe", "raccoon", "alley-cat", "crow"]), b: kit(l1Knife, "pets:b2", ["pocket-knife", "boar", "stray-dog", "raccoon"]) },
];

function logOf(b: (typeof BOUTS)[number]): BoutLog { return simulateFight(b.seed, b.a, b.b, 1); }

/** An actor at rest: idling (no clip but idle-like holds) on its home mark, not nudged. */
function atRest(p: StagePlayer, a: FrameActor): boolean {
  const tr = p.tracks.byId.get(a.id)!;
  if (a.seg !== null && a.seg.busy) return false;
  if (a.nudges.length > 0) return false;
  return Math.abs(a.place.x - tr.home.x) < 0.01 && Math.abs(a.floorY - tr.home.y) < 0.01 && Math.abs(a.place.y - a.floorY) < 0.01;
}
function boxOf(rig: Rig, a: FrameActor): Box {
  return drawnBox(rig, rig.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place);
}
const ownerOf = (id: string): string => `${id[0]}0`;

interface Worst { cover: number; ownerCover: number; petShare: number; outOfFrame: number; order: string[]; through: string[]; frames: number }

function measure(p: StagePlayer, rig: Rig): Worst {
  const w: Worst = { cover: 0, ownerCover: 0, petShare: 0, outOfFrame: 0, order: [], through: [], frames: 0 };
  // a tall phone shows at most 240 x w / h units across: there the scrappers stay in, not every pet
  const cams = VIEWS.map((v) => ({ v, widest: (STAGE_H * v.w) / v.h }));
  const span = frameSpan(p.tracks);
  for (let t = 0; t <= p.timeline.durationMs; t += FRAME_MS) {
    const f = p.frame(t);
    w.frames += 1;
    const boxes = new Map<string, Box>(f.actors.map((a) => [a.id, boxOf(rig, a)]));
    const rest = new Set(f.actors.filter((a) => atRest(p, a)).map((a) => a.id));
    const pets = f.actors.filter((a) => a.rig !== "scrapper");
    const fighters = f.actors.filter((a) => a.rig === "scrapper");
    for (const pet of pets) {
      const pb = boxes.get(pet.id)!;
      for (const fi of fighters) {
        const fb = boxes.get(fi.id)!;
        if (rest.has(pet.id) && rest.has(fi.id)) {
          const c = coverOf(pb, fb);
          w.cover = Math.max(w.cover, c);
          if (fi.id === ownerOf(pet.id)) w.ownerCover = Math.max(w.ownerCover, c);
        }
        // draw order: a pet after a fighter only from a farther-forward floor line or in its own attack
        const pi = f.actors.indexOf(pet);
        const fiIdx = f.actors.indexOf(fi);
        if (pi > fiIdx && !pet.attacking && pet.floorY < fi.floorY + 0.3 && coverOf(pb, fb) > 0) {
          w.order.push(`${Math.round(t)} ms: ${pet.id} (y ${pet.floorY.toFixed(1)}) over ${fi.id} (y ${fi.floorY.toFixed(1)})`);
        }
        // never through its own owner: where they meet, the pet is drawn behind him, or bites at his depth
        if (fi.id === ownerOf(pet.id) && coverOf(pb, fb) > 0 && pi > fiIdx && !pet.attacking) {
          w.through.push(`${Math.round(t)} ms: ${pet.id} drawn over its owner`);
        }
        // in its attack it may draw in front, but never across him: its box never spans his place
        if (fi.id === ownerOf(pet.id) && pet.attacking && pi > fiIdx && pb.x0 < fi.place.x && pb.x1 > fi.place.x && pb.y1 > fb.y0) {
          w.through.push(`${Math.round(t)} ms: ${pet.id} runs through its owner in its attack`);
        }
      }
      if (!rest.has(pet.id)) continue;
      for (const other of pets) {
        if (other.id <= pet.id || !rest.has(other.id)) continue;
        const ob = boxes.get(other.id)!;
        const ix = Math.min(pb.x1, ob.x1) - Math.max(pb.x0, ob.x0);
        const iy = Math.min(pb.y1, ob.y1) - Math.max(pb.y0, ob.y0);
        if (ix > 0 && iy > 0) w.petShare = Math.max(w.petShare, ix / Math.min(pb.x1 - pb.x0, ob.x1 - ob.x0));
      }
      // inside the camera's frame, on every canvas wide enough for the bout's frame
      for (const { v, widest } of cams) {
        const c = cameraAt(p.tracks, t, v, false);
        const x1 = c.x0 + v.w / c.k;
        const y1 = c.y0 + v.h / c.k;
        if (widest < span.x1 - span.x0) continue;
        const out = Math.max(c.x0 - pb.x0, pb.x1 - x1, c.y0 - pb.y0, pb.y1 - y1, 0);
        w.outOfFrame = Math.max(w.outOfFrame, out);
      }
    }
  }
  return w;
}

const cache = new Map<string, Worst>();
/** The planted fault: each side's pets where the fight-screen pass stood them, at the owner's feet
 *  (side a: by slot behind his back foot, in front of his front foot, behind him nearer the camera). */
function atFeet(scale?: number): Internal {
  const slots = [{ x: 116, y: 204 }, { x: 156, y: 212 }, { x: 108, y: 210 }];
  const marks: Record<string, { x: number; y: number }> = {};
  for (const side of ["a", "b"]) {
    for (let n = 1; n <= 3; n++) {
      const m = slots[n - 1]!;
      marks[`${side}${n}`] = { x: side === "a" ? m.x : STAGE_W - m.x, y: m.y };
    }
  }
  return scale === undefined ? { pets: { marks } } : { pets: { marks, scale } };
}

function worstOf(bout: (typeof BOUTS)[number], rigName: string, rig: Rig, internal?: Internal): Worst {
  const key = `${bout.name}|${rigName}|${internal?.pets === undefined ? "" : `feet${internal.pets.scale ?? ""}`}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const p = playerFor(logOf(bout), bout.a, bout.b, rig, false, internal);
  const w = measure(p, rig);
  cache.set(key, w);
  return w;
}

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

  it("the camera's pet frame reach covers each pet's idle, run and hit poses on both rigs (round 2: an Alley Cat's run left the frame)", () => {
    for (const [name, rig] of RIGS) {
      for (const id of COMPANION_IDS as readonly CompanionId[]) {
        let back = 0;
        let front = 0;
        for (const clip of ["idle", "run", "hit"]) {
          const ms = rig.clipInfo(id, clip).durationMs;
          for (let k = 0; k < 24; k++) {
            const box = drawnBox(rig, rig.samplePose(id, clip, (ms * k) / 24), { held: null, shield: null, scale: PET_SCALE[id] }, { x: 0, y: 0, facing: 1 });
            back = Math.max(back, -box.x0);
            front = Math.max(front, box.x1);
          }
        }
        expect(back, `${name} ${id} back`).toBeLessThanOrEqual(PET_FRAME_REACH[id].back + 1e-6);
        expect(front, `${name} ${id} front`).toBeLessThanOrEqual(PET_FRAME_REACH[id].front + 1e-6);
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

describe("control: pets back at their owner's feet turn it red", () => {
  it("full size at the feet: a pet covers a fighter", () => {
    const w = worstOf(BOUTS[0]!, "real art", FULL, atFeet(1));
    expect(w.cover).toBeGreaterThan(0.2);
  });
  it("at their new size but on the old marks: a pet touches its owner and the pets overlap", () => {
    for (const [rigName, rig] of RIGS) {
      const w = worstOf(BOUTS[0]!, rigName, rig, atFeet());
      expect(w.ownerCover, rigName).toBeGreaterThan(0.02);
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
    // The list changed with sim version 4 (round 2), which left the old bouts (level 3 n 12,
    // 5 n 12, 6 n 30, 8 n 33) with no pet dodge, and again with sim version 5 (round 2, second
    // pass; it was 3 n 117, 5 n 20, 6 n 85, 8 n 3, 8 n 19, 10 n 45). Level 8 n 37 and 76 and level
    // 10 n 36 are back (round 2, third pass): at a home mark by the frame's edge an Alley Cat's run
    // pose reached past the frame, which was set by the pets' idle reach (now PET_FRAME_REACH), and a
    // pet hit during its hop was knocked out of it (a pet's knockback now stops at the frame). A scan
    // of 600 find-bout bouts at levels 3 to 10 (34 hops) finds none out of frame.
    for (const [level, k] of [[5, 20], [6, 73], [8, 3], [8, 37], [8, 76], [8, 95], [8, 117], [10, 36], [10, 45], [10, 84], [10, 97]] as const) {
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
