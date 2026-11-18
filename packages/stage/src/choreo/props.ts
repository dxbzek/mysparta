/** Shared by the handlers that put an item on the floor: a dropped, knocked-off or thrown-away
 *  weapon or shield flies to a spot behind its owner and lies there flat (review finding 21: a
 *  knocked-off Car Door stood upright on a pet's mark with the raccoon drawn inside it). */
import type { ActorId, PropId } from "@rankzero/core";
import { isShieldId } from "@rankzero/core";
import type { Rig } from "@rankzero/rig";
import type { Box } from "../bounds";
import { propBox } from "../bounds";
import type { FlightPath } from "../flight";
import { makePath } from "../flight";
import { STAGE_W } from "../layout";
import type { Builder } from "../timeline";
import { BLEND, FLOOR, OUTCOME } from "../tuning";
import { shieldAt } from "../track";

/** Turns a path's start angle so the item ends lying flat: a weapon along the floor (a multiple
 *  of 180 degrees), a shield with its long side along the floor (the wider of its two square
 *  turns, as the rig draws it; without a rig, on its side at -90). */
export function settleFlat(p: FlightPath, item: PropId, rig?: Rig): FlightPath {
  const end = p.rot0 + p.spin * p.ms;
  let flat = Math.round(end / 180) * 180;
  if (isShieldId(item)) {
    const side = Math.round((end + 90) / 180) * 180 - 90;
    if (rig === undefined) flat = Math.round((end + 90) / 360) * 360 - 90;
    else {
      const wide = (rot: number): number => { const q = propBox(rig, item, { x: 0, y: 0, facing: 1, rot }); return (q.x1 - q.x0) / Math.max(1e-6, q.y1 - q.y0); };
      flat = wide(side) >= wide(flat) ? side : flat;
    }
  }
  return { ...p, rot0: p.rot0 + (flat - end) };
}

/** Where on the floor an item from this owner lands: behind it, on its floor line, clear of every
 *  pet standing or lying near that line (their drawn reach where they are at `at`) and of the
 *  stage edge. `box` is the item's drawn box round its anchor as it will lie (on the stage, facing
 *  its owner's way); the pets are taken where they are at `lands`. Items of the same owner do not
 *  land on the same spot. */
export function floorSpot(b: Builder, owner: ActorId, at: number, back: number, box?: Box, lands = at): { x: number; y: number; facing: 1 | -1 } {
  const p = b.place(owner, at);
  const n = b.floor.filter((f) => Math.abs(f.y - (p.y - FLOOR.lieY)) < 30).length;
  const want = p.x - p.facing * (back + (n % 3) * 9);
  const y = p.y - FLOOR.lieY + (n % 2) * 6;
  const ext = box === undefined ? { l: 8, r: 8 } : { l: -box.x0, r: box.x1 };
  const pets: [number, number][] = [];
  for (const tr of b.actors) {
    if (tr.rig === "scrapper" || lands < tr.showFrom || lands >= tr.goneAt) continue;
    const q = b.place(tr.id, lands);
    if (Math.abs(q.y - y) > FLOOR.petDepth) continue;
    const [l, r] = q.facing === 1 ? [tr.reach.back, tr.reach.front] : [tr.reach.front, tr.reach.back];
    pets.push([q.x - l - FLOOR.petClear, q.x + r + FLOOR.petClear]);
  }
  const free = (x: number): boolean => x - ext.l >= FLOOR.edge && x + ext.r <= STAGE_W - FLOOR.edge
    && pets.every(([l, r]) => x + ext.r <= l || x - ext.l >= r);
  // the nearest free spot to the one it would take, looking both ways
  for (let d = 0; d <= STAGE_W; d += 2) {
    for (const x of d === 0 ? [want] : [want - p.facing * d, want + p.facing * d]) if (free(x)) return { x, y, facing: p.facing };
  }
  const clamped = want < 14 ? 14 : want > 346 ? 346 : want;
  return { x: clamped, y, facing: p.facing };
}

/**
 * Where a weapon slung on its owner's back for a Move is drawn at `t` (draw.ts drawSlung: the same
 * spot and turn), or undefined when it is not slung then. A weapon swapped or knocked away while it
 * is on the back (the sling holds through the crossfade after the Move, frame.ts) leaves from there,
 * not from the empty hand (content v3 batch 2: at level 30 it vanished off the back in 35 of 400
 * bouts).
 */
export function slungAt(b: Builder, owner: ActorId, item: PropId, t: number): { x: number; y: number; rot: number } | undefined {
  if (!b.has(owner)) return undefined;
  const tr = b.track(owner);
  if (tr.rig !== "scrapper") return undefined;
  const on = b.slings.filter((g) => g.actor === owner && t >= g.from && t < g.to + BLEND.maxMs);
  if (!on.some((g) => g.held && g.item === item)) return undefined;
  const k = on.some((g) => g.shield) && shieldAt(tr, t) !== null ? 1 : 0;
  const p = b.place(owner, t);
  const s = tr.scale > 0 ? tr.scale : 1;
  return { x: p.x - p.facing * (6 + 3 * k) * s, y: p.y - (58 - 6 * k) * s, rot: k === 0 ? 100 : 128 };
}

/**
 * An item leaves the owner and lands on the floor. "drop": falls from the hand with one small
 * bounce (a swap). "pop": goes up in an arc (a disarm, a shield knocked off).
 * `from` overrides where it starts (a shield starts at the back arm). A shield lands on its edge
 * with its long side along the floor and falls flat (draw.ts lays it down: `FLOOR.shieldFlat`).
 */
export function dropOnFloor(b: Builder, step: number, owner: ActorId, item: PropId, at: number, ms: number,
  kind: "drop" | "pop", from?: { x: number; y: number; rot: number }): number {
  const start = from ?? b.handAt(owner, at);
  const facing = b.place(owner, at).facing;
  const shape = (x: number, y: number): FlightPath => settleFlat({ ...makePath("pop", start.x, start.y, x, y, facing, ms, start.rot),
    arc: kind === "drop" ? OUTCOME.swapBounce : OUTCOME.disarmArc }, item, b.rig);
  // how it will lie, round its anchor (the turn does not depend on where it lands)
  const probe = shape(start.x, start.y);
  const rot = probe.rot0 + probe.spin * probe.ms;
  const box = propBox(b.rig, item, { x: 0, y: 0, facing, rot });
  const spot = floorSpot(b, owner, at, kind === "drop" ? 16 : OUTCOME.disarmLand, box, at + ms);
  const shield = isShieldId(item);
  // a shield's anchor stands so that its bottom edge is on the floor line
  const y = shield ? spot.y - box.y1 : spot.y;
  const path = shape(spot.x, y);
  b.flights.push({ item, from: at, to: at + ms, path, after: "floor" });
  b.land(step, item, spot.x, y, rot, spot.facing, at + ms, shield ? { squash: FLOOR.shieldFlat, floorY: spot.y } : undefined);
  return at + ms;
}
