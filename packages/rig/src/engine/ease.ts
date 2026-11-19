/**
 * Easing curves of the contract's `Ease` names. Each maps 0..1 onto 0..1 (the "back" curve
 * overshoots past 1 on the way, which is the point of it). The ease of a key shapes the segment
 * that ENDS on that key.
 */
import type { Ease } from "../contracts";

export function ease(u: number, kind: Ease | undefined): number {
  const v = u < 0 ? 0 : u > 1 ? 1 : u;
  switch (kind) {
    case "in": return Math.pow(v, 1.7);                            // slow start, fast arrival: a strike
    case "out": return 1 - (1 - v) * (1 - v);                      // fast start, slow arrival: a settle
    case "inOut": return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
    case "back": { const c1 = 1.9; const c3 = c1 + 1; return 1 + c3 * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2); }
    case "snap": { const w = 1 - v; return 1 - w * w * w * w * w; }
    default: return v;
  }
}
