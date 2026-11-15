/**
 * How things fly. A Thrown weapon flies by its `WEAPON_META.flight` (owner amendment 13.3):
 *   straight  Darts: a straight line, point first, no spin.
 *   tumble    Bricks: a lob on an arc, turning over and over.
 *   return    Boomerang: a curve, spinning flat; it comes back to the hand on its own flight.
 *   spin      Hubcap (and any thrown melee weapon): spinning on a low arc.
 *   roll      Tyre: bowled low, it drops to the floor in the first quarter of its flight and rolls
 *             in along it, turning about its own hub as a wheel does, and meets the target's shins
 *             (review finding 25: it climbed back to chest height).
 *   bounce    Rubber Ball: down to the floor, one bounce, up into the target.
 * Anything else that is thrown (a Pitcher throw of a held weapon) spins on a low arc, and a
 * weapon knocked out of a hand goes up in an arc and comes down ("pop").
 *
 * A path is plain data; `pointAt` is a pure function of the share of the flight done.
 * `rot` is in the item's own frame before mirroring, as `rig.drawProp` takes it.
 */
import type { ThrownFlight } from "@rankzero/core";
import { FLIGHT } from "./tuning";

export type FlightKind = "straight" | "tumble" | "return" | "spin" | "pop" | "roll" | "bounce";
export interface FlightPath { kind: FlightKind; x0: number; y0: number; x1: number; y1: number;
  facing: 1 | -1; ms: number;
  /** Arc height in units (up is positive). */
  arc: number;
  /** Starting angle and spin in degrees per ms (0 for a straight flight). */
  rot0: number; spin: number;
  /** For an item that turns about a point that is not its grip (a rolled Tyre's hub): that point
   *  in the item's own frame. The path then carries the hub, and `anchorAt` gives the grip to draw at. */
  hub?: { x: number; y: number } }

export function flightKindOf(meta: { flight?: ThrownFlight } | undefined): FlightKind {
  return meta?.flight ?? "spin";
}

/** The angle of a stage direction in the item's own frame for an item that faces `facing`. */
export function localAngle(dx: number, dy: number, facing: 1 | -1): number {
  return (Math.atan2(dy, dx * facing) * 180) / Math.PI;
}

/** A path from one point to another for one kind of flight. `ms` is the flight time. */
export function makePath(kind: FlightKind, x0: number, y0: number, x1: number, y1: number, facing: 1 | -1,
  ms: number, rot0 = 0, hub?: { x: number; y: number; r: number }): FlightPath {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  switch (kind) {
    case "straight":
      return { kind, x0, y0, x1, y1, facing, ms, arc: 0, rot0: localAngle(x1 - x0, y1 - y0, facing), spin: 0 };
    case "tumble":
      return { kind, x0, y0, x1, y1, facing, ms, arc: Math.max(FLIGHT.tumbleArcMin, dist * FLIGHT.tumbleArc), rot0, spin: FLIGHT.tumblePerMs };
    case "return":
      return { kind, x0, y0, x1, y1, facing, ms, arc: dist * FLIGHT.returnBow, rot0, spin: FLIGHT.spinPerMs * 1.6 };
    case "pop":
      return { kind, x0, y0, x1, y1, facing, ms, arc: 46, rot0, spin: FLIGHT.spinPerMs * 0.8 };
    case "roll": {
      // on the floor it turns as a wheel turns: its speed over its radius
      let turn = hub !== undefined && hub.r > 0 && ms > 0 ? ((Math.abs(x1 - x0) / ms) / hub.r) * (180 / Math.PI) : FLIGHT.tumblePerMs * 1.5;
      // it arrives upright (a whole number of turns from no turn), as its hub and radius were measured
      if (hub !== undefined && ms > 0) turn = (Math.max(1, Math.round((rot0 + turn * ms) / 360)) * 360 - rot0) / ms;
      const p: FlightPath = { kind, x0, y0, x1, y1, facing, ms, arc: 0, rot0, spin: turn };
      if (hub !== undefined) p.hub = { x: hub.x, y: hub.y };
      return p;
    }
    case "bounce":
      return { kind, x0, y0, x1, y1, facing, ms, arc: FLIGHT.bounceDip, rot0, spin: FLIGHT.spinPerMs * 0.5 };
    case "spin":
    default:
      return { kind: "spin", x0, y0, x1, y1, facing, ms, arc: dist * 0.08, rot0, spin: FLIGHT.spinPerMs };
  }
}

/** Where to draw an item (its grip, as `rig.drawProp` takes it) whose path carries its hub. */
export function anchorAt(p: FlightPath, q: { x: number; y: number; rot: number }): { x: number; y: number; rot: number } {
  if (p.hub === undefined) return q;
  return { x: q.x - p.facing * hubX(p.hub, q.rot), y: q.y - hubY(p.hub, q.rot), rot: q.rot };
}
/** A point of the item's own frame turned by `rot` degrees (before mirroring). */
function hubX(h: { x: number; y: number }, rot: number): number { const r = (rot * Math.PI) / 180; return h.x * Math.cos(r) - h.y * Math.sin(r); }
function hubY(h: { x: number; y: number }, rot: number): number { const r = (rot * Math.PI) / 180; return h.x * Math.sin(r) + h.y * Math.cos(r); }
/** The hub of an item held at `grip` (a stage point, the item turned `rot`, facing `facing`). */
export function hubFrom(grip: { x: number; y: number; rot: number }, hub: { x: number; y: number }, facing: 1 | -1): { x: number; y: number } {
  return { x: grip.x + facing * hubX(hub, grip.rot), y: grip.y + hubY(hub, grip.rot) };
}

/** Flight time for a distance at the throw speed. */
export function flightMs(dist: number): number {
  const ms = (dist / FLIGHT.speed) * 1000;
  return ms < FLIGHT.minMs ? FLIGHT.minMs : Math.round(ms);
}

/** Where the item is and how it is turned, `u` from 0 (leaves) to 1 (arrives). */
export function pointAt(p: FlightPath, u: number): { x: number; y: number; rot: number } {
  const v = u < 0 ? 0 : u > 1 ? 1 : u;
  const x = p.x0 + (p.x1 - p.x0) * v;
  const y = p.y0 + (p.y1 - p.y0) * v;
  const ms = v * p.ms;
  if (p.kind === "straight") return { x, y, rot: p.rot0 };
  if (p.kind === "return") {
    // A side-arm curve: it sweeps low off the straight line (the throw is flat, so the curve
    // reads as a dip toward the floor), widest a little after the middle, and ends exactly on
    // the end point. A lob (tumble) goes up instead.
    const bow = 6.75 * v * v * (1 - v) * p.arc;
    return { x, y: y + bow, rot: p.rot0 + p.spin * ms };
  }
  if (p.kind === "roll") {
    // falls (speeding up) from the hand to the floor in the first part, then rolls on the floor
    // line: `y1` is its hub's height there, at the target's shins
    const d = FLIGHT.rollDropShare;
    const fall = v < d ? p.y0 + (p.y1 - p.y0) * (v / d) * (v / d) : p.y1;
    return { x, y: fall, rot: p.rot0 + p.spin * ms };
  }
  if (p.kind === "bounce") {
    // down to the floor at 60% of the way, then straight up into the end point
    const dip = v <= 0.6 ? p.arc * (v / 0.6) * (v / 0.6) : p.arc * (1 - (v - 0.6) / 0.4);
    return { x, y: y + dip, rot: p.rot0 + p.spin * ms };
  }
  // tumble, spin and pop: a parabola, highest in the middle.
  const lift = 4 * v * (1 - v) * p.arc;
  return { x, y: y - lift, rot: p.rot0 + p.spin * ms };
}
