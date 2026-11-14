/**
 * Two-bone IK on the rotation list: turn an upper and a lower bone so that the joint of the end
 * bone lands on a target. The bend side is the one inside the lower bone's `limit` (a knee bends
 * back, an elbow forward); when both are allowed, the one nearer the current angle wins.
 * Pure: it returns a new rotation list.
 */
import { DEG } from "../gate/vocab";
import type { Model } from "./pose";
import { frames, worldAngles } from "./pose";

const R2D = 180 / Math.PI;

/** Puts `angle` within 180 degrees of `near`. */
export function wrapNear(angle: number, near: number): number {
  let a = angle;
  while (a - near > 180) a -= 360;
  while (a - near < -180) a += 360;
  return a;
}

export interface IkResult { rot: number[]; reached: boolean }

/**
 * `upper`, `lower`, `end` are bone indices along one chain (end's parent is lower, lower's parent
 * is upper). `tx, ty` is where the END bone's joint must go, in figure space. `rootX, rootY` as in
 * `frames`.
 */
export function twoBone(model: Model, rot: readonly number[], rootX: number, rootY: number,
  upper: number, lower: number, end: number, tx: number, ty: number): IkResult {
  const out = [...rot];
  const bones = model.def.bones;
  const fr = frames(model, rot, rootX, rootY);
  const up = fr[upper]!;
  const p0x = up.e;
  const p0y = up.f;
  const l = bones[lower]!;
  const e = bones[end]!;
  const L1 = Math.hypot(l.x, l.y);
  const L2 = Math.hypot(e.x, e.y);
  const dx = tx - p0x;
  const dy = ty - p0y;
  let d = Math.hypot(dx, dy);
  const dMax = L1 + L2 - 1e-4;
  const dMin = Math.abs(L1 - L2) + 1e-4;
  const reached = d <= dMax + 1e-6 && d >= dMin - 1e-6;
  d = d > dMax ? dMax : d < dMin ? dMin : d;
  // angle of the end offset relative to the lower offset at rest (0 for a straight limb)
  const g = Math.atan2(e.y, e.x) - Math.atan2(l.y, l.x);
  const cosA = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const base = Math.acos(cosA < -1 ? -1 : cosA > 1 ? 1 : cosA);   // angle between the two offsets
  const lim = l.limit;
  const cur = rot[lower] ?? 0;
  const options = [base - g, -base - g].map((r) => r * R2D);
  const inside = (v: number): boolean => lim === undefined || (v >= lim[0] - 1e-6 && v <= lim[1] + 1e-6);
  let pick = options[0]!;
  const ok = options.filter(inside);
  if (ok.length === 1) pick = ok[0]!;
  else if (ok.length === 2) pick = Math.abs(ok[0]! - cur) <= Math.abs(ok[1]! - cur) ? ok[0]! : ok[1]!;
  else if (lim !== undefined) {
    // neither inside: clamp the nearer one into the limit
    const c = (v: number): number => (v < lim[0] ? lim[0] : v > lim[1] ? lim[1] : v);
    pick = Math.abs(c(options[0]!) - options[0]!) <= Math.abs(c(options[1]!) - options[1]!) ? c(options[0]!) : c(options[1]!);
  }
  out[lower] = pick;
  // the end joint in the upper bone's own frame, with the lower bone turned by `pick`
  const pr = pick * DEG;
  const ex = l.x + Math.cos(pr) * e.x - Math.sin(pr) * e.y;
  const ey = l.y + Math.sin(pr) * e.x + Math.cos(pr) * e.y;
  const want = Math.atan2(dy, dx);
  const have = Math.atan2(ey, ex);
  const wa = worldAngles(model, rot);
  const parentWorld = model.def.bones[upper]!.parent >= 0 ? wa[model.def.bones[upper]!.parent]! : 0;
  const upperWorld = (want - have) * R2D;
  out[upper] = wrapNear(upperWorld - parentWorld, rot[upper] ?? 0);
  return { rot: out, reached };
}
