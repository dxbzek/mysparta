/**
 * The pets-on-stage measure, shared by test/pets.test.ts and test/pets-control.test.ts: the bouts
 * (three pets a side), the per-frame measure on a rig, and the planted fault (pets back at their
 * owner's feet). Two files, so each runs in its own worker: as one file it took over 60 s on a
 * loaded machine, past vitest's limit for a worker's report (the run failed with every test green).
 */
import type { BoutLog, FighterSnapshot, PerkId } from "@rankzero/core";
import { simulateFight } from "@rankzero/core";
import { l10Boar, l10Raccoon, l1Knife, l1Pipe } from "@rankzero/core/fixtures";
import type { Rig } from "@rankzero/rig";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { capsuleRig } from "@rankzero/rig/testing";
import type { Box } from "../../src/bounds";
import { coverOf, drawnBox } from "../../src/bounds";
import { cameraAt, frameSpan } from "../../src/camera";
import type { StagePlayer } from "../../src/createFightPlayer";
import type { FrameActor } from "../../src/frame";
import { STAGE_H, STAGE_W } from "../../src/layout";
import type { Internal } from "../../src/timeline";
import { playerFor } from "./setup";

export const FULL = createRig(gatePack, contentPack);
export const RIGS: readonly (readonly [string, Rig])[] = [["capsule", capsuleRig], ["real art", FULL]];
export const FRAME_MS = 1000 / 60;
export const VIEWS = [{ w: 390, h: 470 }, { w: 760, h: 520 }, { w: 720, h: 480 }] as const;

const kit = (base: FighterSnapshot, id: string, perks: PerkId[]): FighterSnapshot => ({ ...base, id, perks });
/** Three pets a side, every kind of pet in at least one bout. */
export const BOUTS: readonly { name: string; seed: number; a: FighterSnapshot; b: FighterSnapshot }[] = [
  { name: "boar + two raccoons vs goose, dog, crow", seed: 4401,
    a: kit(l10Boar, "pets:a1", ["crowbar", "boar", "raccoon", "raccoon"]), b: kit(l10Raccoon, "pets:b1", ["bat", "goose", "stray-dog", "crow"]) },
  { name: "raccoon, cat, crow vs boar, dog, raccoon", seed: 4402,
    a: kit(l1Pipe, "pets:a2", ["pipe", "raccoon", "alley-cat", "crow"]), b: kit(l1Knife, "pets:b2", ["pocket-knife", "boar", "stray-dog", "raccoon"]) },
];

export function logOf(b: (typeof BOUTS)[number]): BoutLog { return simulateFight(b.seed, b.a, b.b, 1); }

/** An actor at rest: idling (no clip but idle-like holds) on its home mark, not nudged. */
function atRest(p: StagePlayer, a: FrameActor): boolean {
  const tr = p.tracks.byId.get(a.id)!;
  if (a.seg !== null && a.seg.busy) return false;
  if (a.nudges.length > 0) return false;
  return Math.abs(a.place.x - tr.home.x) < 0.01 && Math.abs(a.floorY - tr.home.y) < 0.01 && Math.abs(a.place.y - a.floorY) < 0.01;
}
export function boxOf(rig: Rig, a: FrameActor): Box {
  return drawnBox(rig, rig.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place);
}
const ownerOf = (id: string): string => `${id[0]}0`;

export interface Worst { cover: number; ownerCover: number; petShare: number; outOfFrame: number; order: string[]; through: string[]; frames: number }

export function measure(p: StagePlayer, rig: Rig): Worst {
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
export function atFeet(scale?: number): Internal {
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

export function worstOf(bout: (typeof BOUTS)[number], rigName: string, rig: Rig, internal?: Internal): Worst {
  const key = `${bout.name}|${rigName}|${internal?.pets === undefined ? "" : `feet${internal.pets.scale ?? ""}`}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const p = playerFor(logOf(bout), bout.a, bout.b, rig, false, internal);
  const w = measure(p, rig);
  cache.set(key, w);
  return w;
}
