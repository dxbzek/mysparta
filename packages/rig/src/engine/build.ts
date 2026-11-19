/**
 * A build's belly (content v3 batch 4, the heavy build): the front of the trunk pushed forward
 * round the stomach, more at its middle, none at the chest or the belt line. A uniform width scale
 * (`build.torso`) makes a deeper chest and back alike; a heavy man carries the weight in front, low.
 * The trunk's shapes (the top's torso parts, the gear worn on the torso) are warped point by point
 * in the torso bone's own frame (y up the trunk from the hip, -24.4 at the neck; x forward), so
 * every top and vest follows the same belly and a pure function of the shape it is.
 */
import type { Pt } from "../gate/vocab";
import { dPoly, parsePolys } from "../gate/vocab";

/** Where the belly is fullest on the trunk (torso-bone y), and how far up and down it fades. */
export const BELLY = { y: -4.8, up: 9.0, down: 5.0, back: 0.35 } as const;
/** How much of the belly a layer under the top (an open jacket's shirt, bare skin in a vest's
 *  armhole) takes, so the top's own edge stays outside it. */
export const INNER_BELLY = 0.8;
/** The trunk's edges are cut into pieces no longer than this before the push, so the belly is a
 *  curve, not a point. */
const STEP = 0.8;

/** How much a point at trunk height `y` is pushed out, 0 to 1 (the curve's peak). */
export function bellyAt(y: number): number {
  const s = y < BELLY.y ? BELLY.up : BELLY.down;
  const u = (y - BELLY.y) / s;
  return Math.exp(-u * u * 1.6);
}

const cache = new Map<string, string>();
/** A torso shape's path with the belly pushed out by `belly` of the trunk's front half-depth. */
export function bellyD(d: string, belly: number): string {
  if (belly <= 0) return d;
  const key = `${belly}|${d}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // the front pushed out by `belly`, the back (the flanks seen from the side) by `back` of that
  const push = ([x, y]: Pt): Pt => [x * (1 + belly * bellyAt(y) * (x > 0 ? 1 : BELLY.back)), y];
  const out = parsePolys(d).map((poly) => {
    const dense: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP));
      // only edges on the front, where the belly is, need the extra points
      const front = Math.max(bellyAt(a[1]), bellyAt(b[1]), bellyAt((a[1] + b[1]) / 2)) > 0.02;
      const k = front ? n : 1;
      for (let j = 0; j < k; j++) dense.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
    }
    return dPoly(dense.map(push));
  }).join("");
  if (cache.size > 4000) cache.clear();
  cache.set(key, out);
  return out;
}

/**
 * The hair under a hat (content v3 batch 4): a cap, a beanie or a hard hat sits over the crown, and
 * any hair that stood above it (an afro, a mohawk, a flat top, a quiff) would poke up through the
 * hat. Under a hat the hair is cut along the hat's brim, a line across the head at `HAT_BRIM` (the
 * hair bone's own frame, a little under the brim so a fringe still shows below it); what hangs below
 * (the sides, a ponytail, long hair, locks) stays. The cut is made once per shape (cached).
 */
export const HAT_BRIM = 1.4;
const cutCache = new Map<string, string>();
/** The part of a polygon path below y = `line` (y down), each polygon clipped on its own. */
export function cutAbove(d: string, line: number): string {
  const key = `${line}|${d}`;
  const hit = cutCache.get(key);
  if (hit !== undefined) return hit;
  const out: string[] = [];
  for (const poly of parsePolys(d)) {
    const kept: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const ina = a[1] >= line;
      const inb = b[1] >= line;
      if (ina) kept.push(a);
      if (ina !== inb) {
        const u = (line - a[1]) / (b[1] - a[1]);
        kept.push([a[0] + (b[0] - a[0]) * u, line]);
      }
    }
    if (kept.length >= 3) out.push(dPoly(kept));
  }
  const res = out.join("");
  if (cutCache.size > 2000) cutCache.clear();
  cutCache.set(key, res);
  return res;
}
