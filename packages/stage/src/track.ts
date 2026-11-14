/**
 * Reading one actor's tracks at a time. Used by the timeline while it builds (to know where a
 * target will stand at a future contact) and by the frame (to draw). Pure functions of `t`.
 */
import type { HeldId } from "@rankzero/core";
import type { ActorTrack, Move, Nudge, Seg } from "./model";

export function eased(kind: "linear" | "in" | "out" | "inOut", u: number): number {
  const v = u < 0 ? 0 : u > 1 ? 1 : u;
  switch (kind) {
    case "in": return v * v;
    case "out": return 1 - (1 - v) * (1 - v);
    case "inOut": return v * v * (3 - 2 * v);
    default: return v;
  }
}

function moveAt(m: Move, t: number): { x: number; y: number; lift: number } {
  const span = m.to - m.from;
  const u = span <= 0 ? 1 : (t - m.from) / span;
  const v = eased(m.ease, u);
  const lift = m.arc === 0 ? 0 : 4 * v * (1 - v) * m.arc;
  return { x: m.x0 + (m.x1 - m.x0) * v, y: m.y0 + (m.y1 - m.y0) * v - lift, lift };
}

/** The base place of an actor (moves only, no nudges). `y` includes a jump's lift; `lift` is
 *  how far above the floor that is. `floorY` is the floor line the actor stands on. */
export function basePos(tr: ActorTrack, t: number): { x: number; y: number; lift: number; floorY: number } {
  let last: Move | null = null;
  for (const m of tr.moves) {
    if (m.from <= t) last = m;
    else break;
  }
  if (last === null) return { x: tr.start.x, y: tr.start.y, lift: 0, floorY: tr.start.y };
  if (t >= last.to) return { x: last.x1, y: last.y1, lift: 0, floorY: last.y1 };
  const p = moveAt(last, t);
  const span = last.to - last.from;
  const floorY = last.y0 + (last.y1 - last.y0) * eased(last.ease, span <= 0 ? 1 : (t - last.from) / span);
  return { ...p, floorY };
}

/** Share of a nudge applied at `t` (0 to 1), and whether it is active. */
export function nudgeShare(n: Nudge, t: number): { share: number; out: number; active: boolean } {
  const e = t - n.from;
  const total = n.outMs + n.holdMs + n.backMs;
  if (e < 0 || e >= total) return { share: 0, out: 0, active: false };
  if (e < n.outMs) {
    const u = e / n.outMs;
    return { share: eased("out", u), out: u, active: true };
  }
  if (e < n.outMs + n.holdMs) return { share: 1, out: 1, active: true };
  const u = (e - n.outMs - n.holdMs) / (n.backMs > 0 ? n.backMs : 1);
  return { share: 1 - eased("inOut", u), out: 1, active: true };
}

/** All nudges of one actor added up at `t`. `dx` is in stage units. */
export function nudgeAt(list: readonly Nudge[], t: number): { dx: number; dy: number; active: Nudge[] } {
  let dx = 0;
  let dy = 0;
  const active: Nudge[] = [];
  for (const n of list) {
    const s = nudgeShare(n, t);
    if (!s.active) continue;
    active.push(n);
    dx += n.dx * s.share;
    if (n.arc !== 0) {
      // a hop: up and down during the way out; a lift: up while out, down on the way back
      dy -= n.key === "hop" ? n.arc * Math.sin(Math.PI * s.out) : n.arc * s.share;
    }
  }
  return { dx, dy, active };
}

/** Where an actor is drawn at `t`: its base place, its nudges, a jump's lift. `floorY` is the
 *  floor line under it, for its shadow and its depth. */
export function drawPlace(tr: ActorTrack, nudges: readonly Nudge[], t: number): { x: number; y: number; floorY: number; facing: 1 | -1; nudges: Nudge[] } {
  const p = basePos(tr, t);
  const n = nudgeAt(nudges, t);
  return { x: p.x + n.dx, y: p.y + n.dy, floorY: p.floorY, facing: facingAt(tr, t), nudges: n.active };
}

export function facingAt(tr: ActorTrack, t: number): 1 | -1 {
  let f = tr.homeFacing;
  for (const c of tr.facings) {
    if (c.from <= t) f = c.facing;
    else break;
  }
  return f;
}

export function heldAt(tr: ActorTrack, t: number): HeldId {
  let h: HeldId = "fists";
  for (const c of tr.helds) {
    if (c.from <= t) h = c.held;
    else break;
  }
  return h;
}

export function doorAt(tr: ActorTrack, t: number, initial: boolean): boolean {
  let d = initial;
  for (const c of tr.doors) {
    if (c.from <= t) d = c.door;
    else break;
  }
  return d;
}

/** The segment that plays at `t`: of those that cover it, the one that started last. */
export function segAt(tr: ActorTrack, t: number): Seg | null {
  let best: Seg | null = null;
  for (const s of tr.segs) {
    if (s.from > t) continue;
    if (t >= s.to) continue;
    if (best === null || s.from >= best.from) best = s;
  }
  return best;
}

export function clipTime(s: Seg, t: number): number {
  return s.c0 + (t - s.from) * s.rate;
}
