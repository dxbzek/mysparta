/** Shared by the handlers that put an item on the floor: a dropped, knocked-off or thrown-away
 *  weapon or door flies to a spot behind its owner and lies there flat. */
import type { ActorId, PropId } from "@rankzero/core";
import type { FlightPath } from "../flight";
import { makePath } from "../flight";
import type { Builder } from "../timeline";
import { FLOOR, OUTCOME } from "../tuning";

/** Turns a path's start angle so the item ends lying flat: a weapon along the floor (a multiple
 *  of 180 degrees), a door on its side, handle up (-90, a whole turn either way). */
export function settleFlat(p: FlightPath, item: PropId): FlightPath {
  const end = p.rot0 + p.spin * p.ms;
  const flat = item === "car-door" ? Math.round((end + 90) / 360) * 360 - 90 : Math.round(end / 180) * 180;
  return { ...p, rot0: p.rot0 + (flat - end) };
}

/** Where on the floor an item from this owner lands: behind it, on its floor line. Items of the
 *  same owner do not land on the same spot. */
export function floorSpot(b: Builder, owner: ActorId, at: number, back: number): { x: number; y: number; facing: 1 | -1 } {
  const p = b.place(owner, at);
  const n = b.floor.filter((f) => Math.abs(f.y - (p.y - FLOOR.lieY)) < 30).length;
  const x = p.x - p.facing * (back + (n % 3) * 9);
  const clamped = x < 14 ? 14 : x > 346 ? 346 : x;
  return { x: clamped, y: p.y - FLOOR.lieY + (n % 2) * 6, facing: p.facing };
}

/**
 * An item leaves the owner and lands on the floor. "drop": falls from the hand with one small
 * bounce (a swap). "pop": goes up in an arc (a disarm, a door knocked off).
 * `from` overrides where it starts (a door starts at the back arm).
 */
export function dropOnFloor(b: Builder, step: number, owner: ActorId, item: PropId, at: number, ms: number,
  kind: "drop" | "pop", from?: { x: number; y: number; rot: number }): number {
  const start = from ?? b.handAt(owner, at);
  const spot = floorSpot(b, owner, at, kind === "drop" ? 16 : OUTCOME.disarmLand);
  const path = settleFlat({ ...makePath("pop", start.x, start.y, spot.x, spot.y, spot.facing, ms, start.rot),
    arc: kind === "drop" ? OUTCOME.swapBounce : OUTCOME.disarmArc }, item);
  b.flights.push({ item, from: at, to: at + ms, path, after: "floor" });
  const rot = path.rot0 + path.spin * path.ms;
  b.land(step, item, spot.x, spot.y, rot, spot.facing, at + ms);
  return at + ms;
}
