/**
 * The content lane's small drawing kit, on top of `gate/vocab.ts` (imported, never copied).
 *
 * Items (weapons, shields, props) are drawn in their own units, +x along the object, the grip at
 * the origin, y down. A shape is `Omit<Shape, "bone">`; its `z` orders it inside the item (the
 * painter puts every item shape in one outline group, so the outline runs round the whole object).
 *
 * Colour slots an item may use (docs/ART.md): "metal" (steel under a sodium lamp), "wood",
 * "white" (cream), "ink" (a line or a dark detail), and "accent" for grip tape and cloth wraps
 * (it follows the owner's palette, so a fighter's tape matches his kit). "hair" is used only for
 * black rubber (tyre, grips, the umbrella canopy): the darkest slot the painter has.
 */
import type { ColourSlot, Shape } from "../contracts";
import type { Poly, Pt } from "../gate/vocab";
import { dPoly, dPolys, ellipsePoly, hash01, inkLine, quad, rotPt, roundRect } from "../gate/vocab";

export type ItemShape = Omit<Shape, "bone">;
export type { Pt, Poly };

/** One filled item shape. */
export function fillOf(pts: Poly, slot: ColourSlot, z: number, shade?: Poly): ItemShape {
  const s: ItemShape = { d: dPoly(pts), slot, z };
  if (shade !== undefined) s.shade = dPoly(shade);
  return s;
}
/** Several polygons as one shape (one outline each, one fill). */
export function fillsOf(list: readonly Poly[], slot: ColourSlot, z: number): ItemShape {
  return { d: dPolys(list), slot, z };
}
/** An ink line (no outline, no shadow) along a polyline. */
export function line(pts: Poly, w: number, z: number, taper = true): ItemShape {
  return { d: dPoly(inkLine(pts, w, taper)), slot: "ink", z };
}
/** Several ink lines as one shape. */
export function lines(list: readonly Poly[], w: number, z: number, taper = true): ItemShape {
  return { d: dPolys(list.map((p) => inkLine(p, w, taper))), slot: "ink", z };
}
/** An ink blob (a hole, a rivet shadow, a dent). */
export function blob(cx: number, cy: number, rx: number, ry = rx, z = 5, n = 10, rot = 0): ItemShape {
  return { d: dPoly(ellipsePoly(cx, cy, rx, ry, n, rot)), slot: "ink", z };
}

/**
 * A straight bar along +x from `x0` to `x1`, half-width given by a profile `[t, half]` (t 0 at
 * x0, 1 at x1), ends rounded by `round` (0 square, 1 a half circle).
 */
export function bar(x0: number, x1: number, prof: readonly (readonly [number, number])[], round = 0.4, y = 0): Pt[] {
  const top: Pt[] = prof.map(([t, h]) => [x0 + (x1 - x0) * t, y - h]);
  const bot: Pt[] = prof.map(([t, h]) => [x0 + (x1 - x0) * t, y + h] as Pt).reverse();
  const cap = (cx: number, h: number, dir: 1 | -1): Pt[] => {
    if (round <= 0) return [];
    const out: Pt[] = [];
    for (let j = 1; j < 5; j++) {
      const g = -Math.PI / 2 + (Math.PI * j) / 5;
      out.push([cx + dir * Math.cos(g) * h * round, y + Math.sin(g) * h * dir]);
    }
    return out;
  };
  const h0 = prof[0]![1];
  const h1 = prof[prof.length - 1]![1];
  return [...top, ...cap(x1, h1, 1), ...bot, ...cap(x0, h0, -1)];
}
/** A plain rod of one thickness. */
export function rod(x0: number, x1: number, half: number, round = 0.4, y = 0): Pt[] {
  return bar(x0, x1, [[0, half], [1, half]], round, y);
}
/** A bar along any straight line from `a` to `b`. */
export function barAB(a: Pt, b: Pt, h0: number, h1 = h0, round = 0.4): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return bar(0, len, [[0, h0], [1, h1]], round).map((p) => {
    const r = rotPt(p, ang);
    return [a[0] + r[0], a[1] + r[1]] as Pt;
  });
}
/** A thick curved band along a polyline (a hook, a handle loop), `w` wide, flat ends. */
export function band(pts: Poly, w: number): Pt[] {
  return inkLine(pts, w, false);
}
/** Grip tape: diagonal wrap lines over a rod from x0 to x1. */
export function wraps(x0: number, x1: number, half: number, step: number, z: number, w = 0.24): ItemShape {
  const list: Pt[][] = [];
  for (let x = x0 + step * 0.5; x < x1 - step * 0.3; x += step) list.push([[x - step * 0.35, half * 0.95], [x + step * 0.35, -half * 0.95]]);
  return lines(list, w, z, false);
}
/** Grime: a few small seeded scuffs (short ink ticks) inside a box. */
export function scuffs(seed: number, n: number, x0: number, x1: number, y0: number, y1: number, z: number, w = 0.2): ItemShape {
  const list: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + hash01(seed, i * 3) * (x1 - x0);
    const y = y0 + hash01(seed, i * 3 + 1) * (y1 - y0);
    const a = hash01(seed, i * 3 + 2) * Math.PI;
    const l = 0.6 + hash01(seed, i * 5 + 7) * 1.4;
    list.push([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l * 0.6]]);
  }
  return lines(list, w, z);
}
/** A regular polygon (an octagon sign, a bolt head). */
export function ngon(cx: number, cy: number, r: number, n: number, startDeg = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((startDeg + (360 * i) / n) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
/** An arc of points (a lid rim, a hook). Angles in degrees, clockwise on screen. */
export function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}
/** A ring (annulus) approximated as one polygon with a slit, so it fills as a ring. */
export function ringPoly(cx: number, cy: number, r0: number, r1: number, n = 24, ry0 = r0, ry1 = r1): Pt[] {
  const outer = arcPts(cx, cy, r1, ry1, -89.5, 269.5, n);
  const inner = arcPts(cx, cy, r0, ry0, 269.5, -89.5, n);
  return [...outer, ...inner];
}
export { dPoly, dPolys, ellipsePoly, inkLine, quad, roundRect, rotPt };
