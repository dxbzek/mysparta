/**
 * Forward kinematics for any `RigDef` (the engine is not scrapper-shaped): bone frames from a
 * list of angles, as 2D affine transforms in "figure space" (units, facing +x, the actor's place
 * at the origin, y down, before body scale and mirroring).
 */
import type { RigDef } from "../contracts";
import { DEG } from "../gate/vocab";

/** x' = a x + c y + e;  y' = b x + d y + f */
export interface Xf { a: number; b: number; c: number; d: number; e: number; f: number }
export const IDENTITY: Xf = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function mul(m: Xf, n: Xf): Xf {
  return {
    a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f,
  };
}
export function apply(m: Xf, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}
export function applyVec(m: Xf, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y, m.b * x + m.d * y];
}
export function invVec(m: Xf, x: number, y: number): [number, number] {
  const det = m.a * m.d - m.b * m.c || 1;
  return [(m.d * x - m.c * y) / det, (-m.b * x + m.a * y) / det];
}
export function rotXf(deg: number): Xf {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { a: c, b: s, c: -s, d: c, e: 0, f: 0 };
}
export function moveXf(x: number, y: number): Xf { return { a: 1, b: 0, c: 0, d: 1, e: x, f: y }; }
export function scaleXf(x: number, y: number): Xf { return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }; }

/** A rig with its bone lookup. */
export interface Model {
  def: RigDef;
  index: ReadonlyMap<string, number>;
  /** Index of each bone's parent, -1 for the root. */
  parent: readonly number[];
}
const models = new WeakMap<RigDef, Model>();
export function modelOf(def: RigDef): Model {
  let m = models.get(def);
  if (m === undefined) {
    const index = new Map<string, number>();
    def.bones.forEach((b, i) => index.set(b.id, i));
    m = { def, index, parent: def.bones.map((b) => b.parent) };
    models.set(def, m);
  }
  return m;
}

/** World angle of every bone: the sum of the angles from the root down. */
export function worldAngles(model: Model, rot: readonly number[]): number[] {
  const out: number[] = [];
  model.def.bones.forEach((b, i) => {
    const p = b.parent >= 0 ? out[b.parent]! : 0;
    out.push(p + (rot[i] ?? 0));
  });
  return out;
}

/** Bone frames in figure space. `root` is the offset of the root bone from the place. */
export function frames(model: Model, rot: readonly number[], rootX: number, rootY: number): Xf[] {
  const out: Xf[] = [];
  model.def.bones.forEach((b, i) => {
    const r = rotXf(rot[i] ?? 0);
    if (b.parent < 0) out.push(mul(moveXf(b.x + rootX, b.y + rootY), r));
    else out.push(mul(mul(out[b.parent]!, moveXf(b.x, b.y)), r));
  });
  return out;
}

/** The joint (origin) of a bone frame. */
export function jointOf(f: Xf): [number, number] { return [f.e, f.f]; }
