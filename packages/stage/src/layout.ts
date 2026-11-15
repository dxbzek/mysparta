/**
 * Stage geometry (brief 3.12): the 360 x 240 stage, the floor line, the home marks, the
 * companion marks, mirroring for side b, draw order by floor y, and where an attacker stops.
 * The same in every arena, so the choreography never changes with the place.
 */
import type { ActorId, ActorInit, CompanionId, Side } from "@rankzero/core";
import { sideOf } from "@rankzero/core";
import type { Dress, Offset, Rig, RigId } from "@rankzero/rig";

export const STAGE_W = 360;
export const STAGE_H = 240;
export const FLOOR_Y = 195;

export interface Mark { x: number; y: number }

/** Marks for side a. Side b is the mirror: x becomes 360 - x.
 *  Owner amendment (fight screen v2, plan 13.7): the scrappers stand 80 units apart, not 220, so
 *  the phone camera can frame both of them large, the way the owner's style-13 sample does. Most
 *  strikes reach less than that, so the attacker lunges in; a long Pole thrust (up to about 92
 *  units) makes its user step back to its distance first, which reads as spacing. Companions
 *  stand at their owner's feet, in front of the floor line, inside the camera's idle framing. */
export const HOME: Readonly<Mark> = { x: 140, y: FLOOR_Y };
export const COMPANION_MARKS = {
  raccoon1: { x: 116, y: 204 },     // at the owner's back foot
  raccoon2: { x: 156, y: 212 },     // in front of the owner's front foot
  big: { x: 108, y: 210 },          // a Goose or a Boar: behind the owner, nearer the camera
  /** Not a rules case (a sandbox side with two big companions): kept clear of the others. */
  spare: { x: 134, y: 218 },
} as const;

export function mirror(side: Side, m: Mark): Mark {
  return side === "a" ? { x: m.x, y: m.y } : { x: STAGE_W - m.x, y: m.y };
}
/** Side a faces right, side b faces left. */
export function homeFacing(side: Side): 1 | -1 { return side === "a" ? 1 : -1; }

export function rigOf(kind: "scrapper" | CompanionId): RigId { return kind; }

/** The home mark of every actor of a bout. Companions take the marks in log order (a1, a2, a3):
 *  the first Raccoon behind, the second in front, the Goose or Boar ahead. */
export function homeMarks(actors: readonly ActorInit[]): Map<ActorId, Mark> {
  const out = new Map<ActorId, Mark>();
  for (const side of ["a", "b"] as const) {
    let raccoons = 0;
    let bigs = 0;
    const mine = actors.filter((a) => sideOf(a.id) === side).sort((p, q) => (p.id < q.id ? -1 : 1));
    for (const a of mine) {
      let m: Mark;
      if (a.kind === "scrapper") m = HOME;
      else if (a.kind === "raccoon") {
        m = raccoons === 0 ? COMPANION_MARKS.raccoon1 : raccoons === 1 ? COMPANION_MARKS.raccoon2 : COMPANION_MARKS.spare;
        raccoons += 1;
      } else {
        m = bigs === 0 ? COMPANION_MARKS.big : COMPANION_MARKS.spare;
        bigs += 1;
      }
      out.set(a.id, mirror(side, m));
    }
  }
  return out;
}

/** Draw order: farther back (smaller floor y) first, then left to right. */
export function byDepth<T extends { y: number; x: number }>(list: T[]): T[] {
  return list.sort((p, q) => (p.y !== q.y ? p.y - q.y : p.x - q.x));
}

/** Where a swing aims on its target. A companion is always hit in the body. A scrapper is hit at
 *  the body or the head, by the parity of the step index: a pure function of the log, never of
 *  the cosmetic seed, because the zone moves the stop and so the timing. */
export function aimZone(targetRig: RigId, stepIndex: number): "head" | "body" {
  if (targetRig !== "scrapper") return "body";
  return stepIndex % 2 === 0 ? "body" : "head";
}

/**
 * The floor x where an attacker must stand so that its aimed strike point lands on the target's
 * hit point, and the aim to pass to `samplePose`. Both actors stand on the same floor y (the
 * attacker walks to the target's depth). `targetX` and `targetFacing` are the target's place at
 * the contact time.
 */
export function stopFor(rig: Rig, a: { rig: RigId; dress: Dress; clip: string; facing: 1 | -1 },
  t: { rig: RigId; dress: Dress; x: number; facing: 1 | -1 }, zone: "head" | "body"): { x: number; aimY: number; strike: Offset; hit: Offset } {
  const hit = rig.hitPoint(t.rig, t.dress, zone);
  const strike = rig.strikePoint(a.rig, a.clip, a.dress, hit.y);
  const hitX = t.x + t.facing * hit.x;
  return { x: hitX - a.facing * strike.x, aimY: hit.y, strike, hit };
}
