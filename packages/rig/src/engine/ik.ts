/**
 * Two-bone IK on the rotation list: turn an upper and a lower bone so that the joint of the end
 * bone lands on a target. Pure: it returns a new rotation list.
 *
 * A real elbow or knee bends one way only, so the solver never picks a bend side by distance:
 *  - the bend side is fixed per joint (`bend`: the sign the lower bone's angle must have). It is
 *    read from the lower bone's `limit` when not given (an elbow bends negative, a knee positive);
 *    only a joint free both ways falls back to the side nearer the current angle;
 *  - the target is held to `maxReach` of the limb's full length (default 1), so a limb is never
 *    pulled dead straight by a far target; the caller moves the body instead (see `reachOf`);
 *  - the upper bone's angle is put within 180 degrees of its current one, so from frame to frame
 *    the solution is continuous and never takes the long way round.
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

export interface IkResult {
  rot: number[];
  /** The target was within reach (and within `maxReach`). */
  reached: boolean;
  /** Distance from the upper joint to the target, as a share of the limb's full length. */
  reach: number;
}
export interface IkOptions {
  /** Sign the lower bone's angle must have: -1 (an elbow), 1 (a knee). */
  bend?: -1 | 1;
  /** Largest share of the full limb length the solver may use (0..1]. */
  maxReach?: number;
}

/** The bend side of a lower bone, from its limit: -1, 1, or 0 when it bends both ways. */
export function bendOf(limit: readonly [number, number] | undefined): -1 | 0 | 1 {
  if (limit === undefined) return 0;
  if (limit[1] <= 5 && limit[0] < -5) return -1;
  if (limit[0] >= -5 && limit[1] > 5) return 1;
  return 0;
}

/** Distance from the upper bone's joint to a target as a share of the limb's length. */
export function reachOf(model: Model, rot: readonly number[], rootX: number, rootY: number,
  upper: number, lower: number, end: number, tx: number, ty: number): number {
  const up = frames(model, rot, rootX, rootY)[upper]!;
  const bones = model.def.bones;
  const L = Math.hypot(bones[lower]!.x, bones[lower]!.y) + Math.hypot(bones[end]!.x, bones[end]!.y);
  return Math.hypot(tx - up.e, ty - up.f) / L;
}

/**
 * `upper`, `lower`, `end` are bone indices along one chain (end's parent is lower, lower's parent
 * is upper). `tx, ty` is where the END bone's joint must go, in figure space. `rootX, rootY` as in
 * `frames`.
 */
export function twoBone(model: Model, rot: readonly number[], rootX: number, rootY: number,
  upper: number, lower: number, end: number, tx: number, ty: number, opts: IkOptions = {}): IkResult {
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
  const d0 = Math.hypot(dx, dy);
  const share = opts.maxReach ?? 1;
  const dMax = Math.min(L1 + L2 - 1e-4, (L1 + L2) * share);
  const dMin = Math.abs(L1 - L2) + 1e-4;
  const reached = d0 <= dMax + 1e-6 && d0 >= dMin - 1e-6;
  const d = d0 > dMax ? dMax : d0 < dMin ? dMin : d0;
  // angle of the end offset relative to the lower offset at rest (0 for a straight limb)
  const g = Math.atan2(e.y, e.x) - Math.atan2(l.y, l.x);
  const cosA = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  const base = Math.acos(cosA < -1 ? -1 : cosA > 1 ? 1 : cosA);   // angle between the two offsets, 0..pi
  const lim = l.limit;
  const cur = rot[lower] ?? 0;
  const side = opts.bend ?? bendOf(lim);
  const options = [base - g, -base - g].map((r) => r * R2D);
  let pick: number;
  if (side !== 0) {
    // the branch on the joint's own side; the other one is a broken elbow or knee
    pick = side < 0 ? Math.min(options[0]!, options[1]!) : Math.max(options[0]!, options[1]!);
  } else {
    pick = Math.abs(options[0]! - cur) <= Math.abs(options[1]! - cur) ? options[0]! : options[1]!;
  }
  if (lim !== undefined) pick = pick < lim[0] ? lim[0] : pick > lim[1] ? lim[1] : pick;
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
  return { rot: out, reached, reach: d0 / (L1 + L2) };
}
