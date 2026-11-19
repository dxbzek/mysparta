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
export const BELLY = { y: -5.6, up: 9.5, down: 5.5 } as const;
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
  const push = ([x, y]: Pt): Pt => [x > 0 ? x * (1 + belly * bellyAt(y)) : x, y];
  const out = parsePolys(d).map((poly) => {
    const dense: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP));
      // only edges on the front, where the belly is, need the extra points
      const front = (a[0] > 0 || b[0] > 0) && Math.max(bellyAt(a[1]), bellyAt(b[1]), bellyAt((a[1] + b[1]) / 2)) > 0.02;
      const k = front ? n : 1;
      for (let j = 0; j < k; j++) dense.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
    }
    return dPoly(dense.map(push));
  }).join("");
  if (cache.size > 4000) cache.clear();
  cache.set(key, out);
  return out;
}
