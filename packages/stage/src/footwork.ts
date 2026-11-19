/**
 * Footwork (movement pass 2, 16 Nov 2026). How a fighter crosses the floor with its feet on it:
 * the stage moves a fighter's place only in the ways the rig's footwork clips are drawn for
 * (rig content/clips/footwork.ts), so a foot on the floor holds its spot on the stage.
 *
 *  - The run (a swing's approach from `FOOTWORK.runFrom` away): the push-off out of the brace,
 *    where the body speeds up from rest to the run speed at an even rate while the back toe
 *    drives; whole cycles of the dash loop at the run speed; the brake's flight at the run speed
 *    (stretched or shortened to fit the distance, so the run speed never changes in the air);
 *    the front foot plants and the body slows to rest at an even rate; it rises into the guard.
 *  - The shuffle (any shorter way, forward or back, and every way home): the boxer's bounce, the
 *    body carried only while both feet are off the floor, on a small arc. One bounce covers at
 *    most `FOOTWORK.hopMax`.
 * The run speed and every distance are scaled by the fighter's drawn size (its build), since the
 * rig draws a foot's travel in figure units. Timing comes from `rig.clipInfo`; a rig without the
 * footwork clips (the gate pack alone, the test doubles) plays its idle there and the stage keeps
 * the same timing (`FOOTWORK.fallback`).
 */
import type { ActorId } from "@rankzero/core";
import type { Builder } from "./timeline";
import { basePos, clipTime, segAt } from "./track";
import { BEAT, FOOTWORK } from "./tuning";

export interface FootTiming {
  /** The push-off's length; the dash loop's clip time it ends on (and the brake starts on); the loop's length. */
  push: number; join: number; cycle: number;
  /** The brake: front foot down, at rest, its length, and the last part of its flight played at 1x. */
  land: number; stop: number; brake: number; paw: number;
  /** The shuffle: its length, feet off the floor, feet down. */
  hop: number; up: number; down: number;
}

const cache = new WeakMap<Builder, FootTiming>();
/** The footwork clips' timing, from the rig (see the header for a rig without them). */
export function footTiming(b: Builder): FootTiming {
  const hit = cache.get(b);
  if (hit !== undefined) return hit;
  const F = FOOTWORK.fallback;
  const ev = (clip: string, name: "land" | "step", n = 0): number | null => {
    const info = b.info("scrapper", clip);
    if (info.loop) return null;
    return info.events.filter((e) => e.name === name).map((e) => e.t).sort((x, y) => x - y)[n] ?? null;
  };
  const len = (clip: string, d: number): number => { const info = b.info("scrapper", clip); return info.loop ? d : info.durationMs; };
  const dash = b.info("scrapper", "dash");
  const t: FootTiming = {
    push: len("dash-push", F.push), join: F.join, cycle: dash.loop ? dash.durationMs : F.cycle,
    land: ev("brake", "land") ?? F.land, stop: ev("brake", "step") ?? F.stop, brake: len("brake", F.brake), paw: F.paw,
    hop: len("shuffle", F.hop), up: ev("shuffle", "step") ?? F.up, down: ev("shuffle", "land") ?? F.down,
  };
  cache.set(b, t);
  return t;
}

const sizeCache = new WeakMap<Builder, Map<ActorId, number>>();
/** How big the rig draws this fighter against the lean build at scale 1 (its build's scale times
 *  its dress scale), read off the rig's own head point. 1 for a companion. */
export function drawnScale(b: Builder, id: ActorId): number {
  let m = sizeCache.get(b);
  if (m === undefined) { m = new Map(); sizeCache.set(b, m); }
  const hit = m.get(id);
  if (hit !== undefined) return hit;
  const tr = b.track(id);
  let s = 1;
  if (tr.rig === "scrapper") {
    const d = b.dress(id, null);
    const base = { held: null, shield: null, scale: 1, ...(d.look !== undefined ? { look: { ...d.look, build: 0 } } : {}) };
    const y1 = b.rig.hitPoint("scrapper", { ...base, scale: d.scale > 0 ? d.scale : 1, ...(d.look !== undefined ? { look: d.look } : {}) }, "head").y;
    const y0 = b.rig.hitPoint("scrapper", base, "head").y;
    s = Math.abs(y0) > 1e-6 && Number.isFinite(y1 / y0) && y1 / y0 > 0 ? y1 / y0 : 1;
  }
  m.set(id, s);
  return s;
}

export interface Plan {
  kind: "still" | "hop" | "run";
  ms: number;
  /** A shuffle out of a raised guard first lowers it (the brace played back to its start, its toes
   *  where they are): the brace's clip time to play back from, 0 for none. Counted in `ms`. */
  unbrace: number;
  /** hop: how many bounces. run: whole cycles of the loop, and the brake's flight (ms, units). */
  n: number; flightMs: number;
  s: number;
}

/** How a scrapper covers `dx` units along the floor (and `dy` into the depth): still, bouncing,
 *  or running (see the header). The run's speed is the feet's speed along x, so a run is planned
 *  on `dx`; a way across the depth is carried while both feet are off the floor (the shuffle). */
export function planWay(b: Builder, id: ActorId, dx: number, dy: number, canRun: boolean, at?: number): Plan {
  const s = drawnScale(b, id);
  const T = footTiming(b);
  const all = Math.hypot(dx, dy);
  const dist = Math.abs(dx);
  if (all < FOOTWORK.stillUnder) return { kind: "still", ms: 0, unbrace: 0, n: 0, flightMs: 0, s };
  const v = (BEAT.dashSpeed / 1000) * s;
  const pushD = (v / 2) * T.push;
  const brakeD = (v / 2) * (T.stop - T.land);
  const rest = dist - pushD - brakeD;
  if (canRun && dist >= FOOTWORK.runFrom * s && rest >= v * FOOTWORK.minFlightMs) {
    const n = Math.max(0, Math.floor((rest - v * FOOTWORK.minFlightMs) / (v * T.cycle)));
    const flightMs = (rest - n * v * T.cycle) / v;
    return { kind: "run", ms: T.push + n * T.cycle + flightMs + (T.brake - T.land), unbrace: 0, n, flightMs, s };
  }
  const n = Math.max(1, Math.ceil(all / (FOOTWORK.hopMax * s)));
  let unbrace = 0;
  if (at !== undefined) {
    const g = segAt(b.track(id), at - 0.5);
    if (g !== null && g.clip === "brace") unbrace = Math.min(b.info("scrapper", "brace").durationMs, Math.max(0, clipTime(g, at)));
  }
  return { kind: "hop", ms: unbrace + n * T.hop, unbrace, n, flightMs: 0, s };
}

/** When a fighter is set after the footwork already laid out for it (its last move, its last
 *  shuffle or brake), or -Infinity. A new way starts no earlier. */
export function readyAt(b: Builder, id: ActorId): number {
  const tr = b.track(id);
  let t = -Infinity;
  for (const m of tr.moves) if (m.to > t) t = m.to;
  for (const g of tr.segs) if ((g.clip === "shuffle" || g.clip === "brake" || g.clip === "evade") && g.to > t) t = g.to;
  return t;
}

/** Lays out the footwork that carries a scrapper from where it stands at `start` to (x, y), as
 *  planned. Returns when it is set in its guard there. */
export function layWay(b: Builder, id: ActorId, start: number, x: number, y: number, plan: Plan): number {
  const T = footTiming(b);
  const p0 = basePos(b.track(id), start);
  const x0 = p0.x;
  const y0 = p0.floorY;
  const all = Math.hypot(x - x0, y - y0);
  if (plan.kind === "still" || all < 1e-6) return start;
  if (plan.kind === "hop") {
    const at = (d: number): [number, number] => [x0 + ((x - x0) * d) / all, y0 + ((y - y0) * d) / all];
    const len = all / plan.n;
    const arc = Math.max(FOOTWORK.hopArcMin, FOOTWORK.hopArc * len);
    let t = start;
    if (plan.unbrace > 0) {
      b.play(id, "brace", t, { c0: plan.unbrace, rate: -1, until: t + plan.unbrace });
      t += plan.unbrace;
    }
    for (let k = 0; k < plan.n; k++) {
      const [hx, hy] = at(len * (k + 1));
      b.play(id, "shuffle", t, { until: t + T.hop });
      b.move(id, t + T.up, T.down - T.up, hx, hy, arc, "linear");
      t += T.hop;
    }
    settle(b, id, t);
    return t;
  }
  // the run: distances along x (the feet's), the depth carried in step
  const dist = Math.abs(x - x0);
  const at = (d: number): [number, number] => [x0 + ((x - x0) * d) / dist, y0 + ((y - y0) * d) / dist];
  const v = (BEAT.dashSpeed / 1000) * plan.s;
  const pushD = (v / 2) * T.push;
  const brakeD = (v / 2) * (T.stop - T.land);
  let t = start;
  b.play(id, "dash-push", t, { until: t + T.push });
  const [px, py] = at(pushD);
  b.move(id, t, T.push, px, py, 0, "in");
  t += T.push;
  const cruise = plan.n * T.cycle + plan.flightMs;
  const [cx, cy] = at(dist - brakeD);
  b.move(id, t, cruise, cx, cy, 0, "linear");
  if (plan.n > 0) {
    b.play(id, "dash", t, { c0: T.join, until: t + plan.n * T.cycle });
    t += plan.n * T.cycle;
  }
  // the brake's flight: its first part fitted to the time left, the paw back onto the spot at 1x
  const fit = plan.flightMs - T.paw;
  const air = T.land - T.paw;
  b.play(id, "brake", t, { rate: fit > 0 ? air / fit : 1, until: t + Math.max(0, fit) });
  t += Math.max(0, fit);
  b.play(id, "brake", t, { c0: air, until: t + T.paw });
  t += T.paw;
  b.play(id, "brake", t, { c0: T.land, until: t + (T.brake - T.land) });
  b.move(id, t, T.stop - T.land, x, y, 0, "out");
  settle(b, id, t + (T.brake - T.land));
  return t + (T.brake - T.land);
}

/** After a way, the idle goes on from the moment of its loop that is the guard every footwork clip
 *  ends in (`FOOTWORK.idleFrom`), not from wherever the bout clock has it, so the cut into it does
 *  not shift the feet. A later clip plays over it as usual. */
function settle(b: Builder, id: ActorId, at: number): void {
  b.play(id, "idle", at, { c0: FOOTWORK.idleFrom, until: Infinity, busy: false });
}
