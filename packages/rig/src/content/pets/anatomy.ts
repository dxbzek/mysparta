/**
 * Anatomy kit for the pets drawn from life (redraw of 15 Nov 2026; owner: "Animals look shit
 * and inaccurate"). Two parts:
 *
 *  1. Drawing. A pet is drawn as a picture of the animal standing at rest, in stage units
 *     (facing right, y down, floor at 0): smooth closed outlines through control points
 *     (`smooth`), each on the bone that carries it. `Anatomy.shape` turns those world points
 *     into the bone's own frame through the rest pose, so a part is drawn where it sits on the
 *     animal and not along a made-up axis. Overlapping masses (hips, loin, chest, neck, head)
 *     share one outline group (the integer part of z): the painter draws every outline of a
 *     group under all of its fills, so they read as one body with one outline.
 *
 *  2. Moving. Legs are placed, not keyed: a clip is a function of time that says where the
 *     spine is and where each foot stands (its contact point on the floor and the angle of the
 *     paw bone). `legIK` solves the two upper leg bones to reach it, with the bend each joint
 *     really has (a dog's stifle forward, its hock back; a goose's heel back). A stance foot is
 *     then exactly on the floor and still, a swing foot follows an arc. `sampleClip` samples the
 *     function every few milliseconds into ordinary keys, so the engine plays it like any clip.
 *     A key's root y is set below 0 only when no foot is on the floor (a gallop's flight), so
 *     the engine's drop-to-floor puts the animal exactly where the model has it.
 */
import type { BoneDef, Clip, ColourSlot, Key, RigDef, Shape } from "../../contracts";
import type { CompanionId } from "@rankzero/core";
import type { Poly, Pt } from "../../gate/vocab";
import { dPoly, dPolys, inkLine, parsePolys } from "../../gate/vocab";

export type Rot = Record<string, number>;
const DEG = Math.PI / 180;

// ------------------------------------------------------------------------------- curves
/** A smooth closed outline through control points (Catmull-Rom, `per` points a span). */
export function smooth(ctrl: readonly Pt[], per = 4, closed = true): Pt[] {
  const n = ctrl.length;
  const out: Pt[] = [];
  const at = (i: number): Pt => (closed ? ctrl[((i % n) + n) % n]! : ctrl[Math.max(0, Math.min(n - 1, i))]!);
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(ctrl[n - 1]!);
  return out;
}
/** A smooth open line (for ink strokes). */
export const line = (ctrl: readonly Pt[], per = 4): Pt[] => smooth(ctrl, per, false);
/** A band of half-width w0..w1 along a smooth open line, both ends rounded. */
export function band(ctrl: readonly Pt[], w0: number, w1: number, per = 4): Pt[] {
  const pts = line(ctrl, per);
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const h = w0 + ((w1 - w0) * i) / (pts.length - 1);
    const p = pts[i]!;
    L.push([p[0] - (dy / l) * h, p[1] + (dx / l) * h]);
    R.push([p[0] + (dy / l) * h, p[1] - (dx / l) * h]);
  }
  const cap = (p: Pt, q: Pt, w: number): Pt[] => {
    const a0 = Math.atan2(p[1] - q[1], p[0] - q[0]);
    const out: Pt[] = [];
    for (let k = 1; k < 6; k++) { const g = a0 + Math.PI / 2 - (Math.PI * k) / 6; out.push([p[0] + Math.cos(g) * w, p[1] + Math.sin(g) * w]); }
    return out;
  };
  const end = cap(pts[pts.length - 1]!, pts[pts.length - 2]!, w1);
  const start = cap(pts[0]!, pts[1]!, w0);
  return [...L, ...end, ...R.reverse(), ...start];
}
export const ellipse = (cx: number, cy: number, rx: number, ry: number, rotDeg = 0, n = 14): Pt[] => {
  const out: Pt[] = [];
  const c = Math.cos(rotDeg * DEG);
  const s = Math.sin(rotDeg * DEG);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
};

// ------------------------------------------------------------------------------- frames
/** x' = a x + c y + e;  y' = b x + d y + f (the engine's own affine). */
export interface Fr { a: number; b: number; c: number; d: number; e: number; f: number }
const mul = (m: Fr, n: Fr): Fr => ({
  a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b, c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f,
});
const rotFr = (deg: number): Fr => { const c = Math.cos(deg * DEG); const s = Math.sin(deg * DEG); return { a: c, b: s, c: -s, d: c, e: 0, f: 0 }; };
const moveFr = (x: number, y: number): Fr => ({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });
export const applyFr = (m: Fr, p: Pt): Pt => [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f];
const invApply = (m: Fr, p: Pt): Pt => {
  const det = m.a * m.d - m.b * m.c;
  const x = p[0] - m.e;
  const y = p[1] - m.f;
  return [(m.d * x - m.c * y) / det, (-m.b * x + m.a * y) / det];
};
/** Bone frames for angles by id (as the engine's `frames`). */
export function framesOf(bones: readonly BoneDef[], rot: Rot, rootX = 0, rootY = 0): { fr: Fr[]; world: number[] } {
  const fr: Fr[] = [];
  const world: number[] = [];
  bones.forEach((b, i) => {
    const r = rot[b.id] ?? 0;
    if (b.parent < 0) { fr.push(mul(moveFr(b.x + rootX, b.y + rootY), rotFr(r))); world.push(r); } else {
      fr.push(mul(mul(fr[b.parent]!, moveFr(b.x, b.y)), rotFr(r)));
      world.push(world[b.parent]! + r);
    }
  });
  return { fr, world };
}
/** The direction a bone hanging along +y points at a world angle (positive swings it back). */
export const down = (deg: number): Pt => [-Math.sin(deg * DEG), Math.cos(deg * DEG)];

// ------------------------------------------------------------------------------- build
/**
 * One leg: `up` and `lo` reach the joint of the third bone (`paw` or `foot`); `bend` is the sign
 * the middle joint's own angle always has (+1: the lower bone swings back, a stifle; -1: it
 * swings forward, an elbow or a heel). `contact` is the point of the third bone that meets the
 * floor (the front of the sole), in its own frame; `sole` the points of it that can touch.
 */
export interface Leg { name: string; end: "paw" | "foot"; parent: string; bend: 1 | -1; up: number; lo: number; contact: Pt; sole: readonly Pt[]; restContact: Pt }

export class Anatomy {
  bones: BoneDef[] = [{ id: "root", parent: -1, x: 0, y: 0 }];
  shapes: Shape[] = [];
  legs: Leg[] = [];
  /** World position of each bone's joint at rest, and the rest angles. */
  private restAt = new Map<string, Pt>();
  /** Applied to every world point given to the methods below (a redraw scales or stretches the
   *  picture without touching its numbers). */
  xf: (p: Pt) => Pt = (p) => p;
  constructor(readonly rest: Rot) { this.restAt.set("root", [0, 0]); }
  /** A bone whose joint is at world point `at` (rest pose). */
  bone(id: string, parent: string, at0: Pt, limit?: readonly [number, number]): this {
    const at = this.xf(at0);
    const p = this.bones.findIndex((b) => b.id === parent);
    if (p < 0) throw new Error(`no bone ${parent}`);
    const { fr } = framesOf(this.bones, this.rest);
    const local = invApply(fr[p]!, at);
    const b: BoneDef = { id, parent: p, x: local[0], y: local[1] };
    if (limit !== undefined) b.limit = limit;
    this.bones.push(b);
    this.restAt.set(id, at);
    return this;
  }
  /** The rest frame of a bone. */
  frame(id: string): Fr {
    const { fr } = framesOf(this.bones, this.rest);
    const i = this.bones.findIndex((b) => b.id === id);
    if (i < 0) throw new Error(`no bone ${id}`);
    return fr[i]!;
  }
  local(id: string, pts: readonly Pt[]): Pt[] { const f = this.frame(id); return pts.map((p) => invApply(f, this.xf(p))); }
  /** A filled part drawn in world rest coordinates. `shade` true: the whole part in its shadow colour. */
  fill(bone: string, pts: readonly Pt[], slot: ColourSlot, z: number, shade?: readonly Pt[] | true): this {
    const loc = this.local(bone, pts);
    const s: Shape = { bone, d: dPoly(loc), slot, z };
    if (shade === true) s.shade = dPoly(loc);
    else if (shade !== undefined) s.shade = dPoly(this.local(bone, shade));
    this.shapes.push(s);
    return this;
  }
  /** Ink strokes in world rest coordinates. */
  ink(bone: string, strokes: readonly (readonly Pt[])[], w: number, z: number, taper = true): this {
    this.shapes.push({ bone, d: dPolys(strokes.map((p) => inkLine(this.local(bone, p), w, taper) as Poly)), slot: "ink", z });
    return this;
  }
  inkFill(bone: string, pts: readonly Pt[], z: number): this { this.shapes.push({ bone, d: dPoly(this.local(bone, pts)), slot: "ink", z }); return this; }
  /** A leg's three bones at their rest joints (world), with limits. */
  leg(name: string, end: "paw" | "foot", parent: string, joints0: readonly [Pt, Pt, Pt], bend: 1 | -1, limits: readonly [readonly [number, number], readonly [number, number], readonly [number, number]],
    contact: Pt, sole: readonly Pt[]): this {
    const joints = joints0.map((p) => this.xf(p)) as [Pt, Pt, Pt];
    this.bone(`${name}.up`, parent, joints0[0], limits[0]);
    this.bone(`${name}.lo`, `${name}.up`, joints0[1], limits[1]);
    this.bone(`${name}.${end}`, `${name}.lo`, joints0[2], limits[2]);
    const up = Math.hypot(joints[1][0] - joints[0][0], joints[1][1] - joints[0][1]);
    const lo = Math.hypot(joints[2][0] - joints[1][0], joints[2][1] - joints[1][1]);
    const endId = `${name}.${end}`;
    this.legs.push({ name, end, parent, bend, up, lo, contact: this.local(endId, [contact])[0]!, sole: this.local(endId, sole), restContact: this.xf(contact) });
    return this;
  }
  /** After the shapes: each foot's contact becomes the front end of its drawn sole (the front-most
   *  point on the floor at rest), and every drawn point of the foot can touch the floor. */
  settleFeet(): void {
    for (const l of this.legs) {
      const id = `${l.name}.${l.end}`;
      const f = this.frame(id);
      const pts = this.shapes.filter((s) => s.bone === id && s.slot !== "ink").flatMap((s) => parsePolys(s.d).flat());
      const floor = Math.max(...pts.map((p) => applyFr(f, p)[1]));
      let best: Pt | null = null;
      for (const p of pts) { const w = applyFr(f, p); if (w[1] > floor - 0.03 && (best === null || w[0] > applyFr(f, best)[0])) best = p; }
      if (best === null) continue;
      l.contact = best;
      l.restContact = applyFr(f, best);
      l.sole = pts;
    }
  }
  rig(id: CompanionId, height: number): RigDef { return { id, height, bones: this.bones }; }
}

/** Rest angles of a leg from its world joints: each bone hangs along +y at angle 0. */
export function restLeg(rest: Rot, name: string, end: "paw" | "foot", parentWorld: number, joints: readonly [Pt, Pt, Pt], endWorld: number): void {
  const ang = (a: Pt, b: Pt): number => Math.atan2(-(b[0] - a[0]), b[1] - a[1]) / DEG;
  const up = ang(joints[0], joints[1]);
  const lo = ang(joints[1], joints[2]);
  rest[`${name}.up`] = up - parentWorld;
  rest[`${name}.lo`] = lo - up;
  rest[`${name}.${end}`] = endWorld - lo;
}

// ------------------------------------------------------------------------------- moving
/** Where a foot is: its contact point (world, model space) and its third bone's world angle. */
export interface Foot { x: number; y: number; a: number }
/** A full pose: the root offset (model), the angles of every bone that is not a leg, the feet. */
export interface Hi { x: number; y: number; rot: Rot; feet: Record<string, Foot> }

/** Two-bone solve of one leg to put its third bone's joint where the foot needs it. */
export function legIK(bones: readonly BoneDef[], legs: readonly Leg[], h: Hi): Rot {
  const rot: Rot = { ...h.rot };
  for (const l of legs) { rot[`${l.name}.up`] = 0; rot[`${l.name}.lo`] = 0; }
  const { fr, world } = framesOf(bones, rot, h.x, h.y);
  const idx = (id: string): number => bones.findIndex((b) => b.id === id);
  for (const l of legs) {
    const ft = h.feet[l.name];
    if (ft === undefined) continue;
    const iu = idx(`${l.name}.up`);
    const hip = applyFr(fr[iu]!, [0, 0]);
    const pw = world[bones[iu]!.parent]!;
    // the end joint: the contact point minus the end bone's own offset to it, turned by its angle
    const c = Math.cos(ft.a * DEG);
    const s = Math.sin(ft.a * DEG);
    const jx = ft.x - (c * l.contact[0] - s * l.contact[1]);
    const jy = ft.y - (s * l.contact[0] + c * l.contact[1]);
    let dx = jx - hip[0];
    let dy = jy - hip[1];
    let d = Math.hypot(dx, dy);
    const dMax = (l.up + l.lo) * 0.9995;
    const dMin = Math.abs(l.up - l.lo) + 1e-3;
    if (d > dMax) { dx *= dMax / d; dy *= dMax / d; d = dMax; }
    if (d < dMin) { dx *= dMin / d; dy *= dMin / d; d = dMin; }
    const alpha = Math.atan2(-dx, dy) / DEG;                       // angle of hip -> end joint
    const cosB = (l.up * l.up + d * d - l.lo * l.lo) / (2 * l.up * d);
    const beta = Math.acos(Math.max(-1, Math.min(1, cosB))) / DEG;
    // the upper bone turns away from the line by beta, to the side opposite the bend
    const upW = alpha - l.bend * beta;
    const kx = hip[0] + down(upW)[0] * l.up;
    const ky = hip[1] + down(upW)[1] * l.up;
    const loW = Math.atan2(-(hip[0] + dx - kx), hip[1] + dy - ky) / DEG;
    rot[`${l.name}.up`] = norm(upW - pw);
    rot[`${l.name}.lo`] = norm(loW - upW);
    rot[`${l.name}.${l.end}`] = norm(ft.a - loW);
  }
  return rot;
}
const norm = (a: number): number => { let v = a; while (v > 180) v -= 360; while (v < -180) v += 360; return v; };

/** The lowest point of the feet (largest y) for a solved pose. */
export function lowestFoot(bones: readonly BoneDef[], legs: readonly Leg[], rot: Rot, x: number, y: number): number {
  const { fr } = framesOf(bones, rot, x, y);
  let low = -Infinity;
  for (const l of legs) {
    const i = bones.findIndex((b) => b.id === `${l.name}.${l.end}`);
    for (const p of [...l.sole, l.contact]) low = Math.max(low, applyFr(fr[i]!, p)[1]);
  }
  return low;
}

/** Samples a pose function into a clip. `air`: lift the root by the feet's clearance (a gallop's
 *  flight); otherwise the engine drops the lowest point to the floor. */
export function sampleClip(bones: readonly BoneDef[], legs: readonly Leg[], duration: number, loop: boolean, step: number,
  at: (t: number) => Hi, rest: { events: Clip["events"]; lag?: Rot; air?: boolean }): Clip {
  const keys: Key[] = [];
  const n = Math.max(2, Math.round(duration / step));
  for (let i = 0; i <= n; i++) {
    const t = (i * duration) / n;
    const h = at(loop && i === n ? 0 : t);
    const rot = legIK(bones, legs, h);
    let ry = 0;
    if (rest.air === true) { const low = lowestFoot(bones, legs, rot, h.x, h.y); if (low < -0.02) ry = low; }
    keys.push({ t, rot, root: [h.x, ry] });
  }
  const clip: Clip = { duration, loop, events: rest.events, keys };
  if (rest.lag !== undefined) clip.lag = rest.lag;
  return clip;
}

// ------------------------------------------------------------------------------- tracks
export type EaseName = "lin" | "in" | "out" | "inOut";
const easeOf = (u: number, e: EaseName): number => {
  const v = u < 0 ? 0 : u > 1 ? 1 : u;
  switch (e) {
    case "in": return v * v;
    case "out": return 1 - (1 - v) * (1 - v);
    case "inOut": return v * v * (3 - 2 * v);
    default: return v;
  }
};
/** One key of a one-shot clip in pose space: a time, a pose, the ease of the segment that ends here. */
export type Beat = readonly [t: number, h: Hi, e?: EaseName];
export function mixHi(a: Hi, b: Hi, u: number): Hi {
  const rot: Rot = {};
  for (const k of new Set([...Object.keys(a.rot), ...Object.keys(b.rot)])) { const va = a.rot[k] ?? 0; rot[k] = va + ((b.rot[k] ?? va) - va) * u; }
  const feet: Record<string, Foot> = {};
  for (const k of Object.keys(a.feet)) {
    const fa = a.feet[k]!;
    const fb = b.feet[k] ?? fa;
    feet[k] = { x: fa.x + (fb.x - fa.x) * u, y: fa.y + (fb.y - fa.y) * u, a: fa.a + (fb.a - fa.a) * u };
  }
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, rot, feet };
}
/** A pose track through beats (pose-space interpolation, so planted feet stay planted). */
export function track(beats: readonly Beat[]): (t: number) => Hi {
  return (t) => {
    if (t <= beats[0]![0]) return beats[0]![1];
    for (let i = 0; i + 1 < beats.length; i++) {
      const [ta, ha] = beats[i]!;
      const [tb, hb, e] = beats[i + 1]!;
      if (t <= tb) return mixHi(ha, hb, easeOf((t - ta) / (tb - ta || 1), e ?? "inOut"));
    }
    return beats[beats.length - 1]![1];
  };
}
/** A pose built from another: offsets to angles and root, feet replaced or moved. */
export function poseFrom(base: Hi, o: { x?: number; y?: number; rot?: Rot; feet?: Record<string, Partial<Foot>> }): Hi {
  const rot: Rot = { ...base.rot };
  for (const [k, v] of Object.entries(o.rot ?? {})) rot[k] = (rot[k] ?? 0) + v;
  const feet: Record<string, Foot> = { ...base.feet };
  for (const [k, v] of Object.entries(o.feet ?? {})) { const f = feet[k]!; feet[k] = { x: f.x + (v.x ?? 0), y: f.y + (v.y ?? 0), a: f.a + (v.a ?? 0) }; }
  return { x: base.x + (o.x ?? 0), y: base.y + (o.y ?? 0), rot, feet };
}

// ------------------------------------------------------------------------------- gaits
/** One foot in a gait: the share of the cycle at which it touches down, how long it stays down
 *  (duty factor), half its stride (units), its lift in the swing, and the end bone's world angle
 *  over the swing (0 = lift-off, 1 = touch-down). */
export interface GaitFoot { leg: string; down: number; duty: number; half: number; lift: number; angle: (s: number) => number; stance: (s: number) => number; soft?: boolean }
export const smoothstep = (u: number): number => { const v = u < 0 ? 0 : u > 1 ? 1 : u; return v * v * (3 - 2 * v); };
/** Where a foot is at cycle share u, around its rest contact point. In stance it slides back
 *  along the floor at a steady speed (the body travels over it); in swing it arcs forward. */
export function gaitFoot(g: GaitFoot, restX: number, u: number): Foot & { inStance: boolean; s: number } {
  let p = (u - g.down) % 1;
  if (p < 0) p += 1;
  if (p < g.duty) {
    const s = p / g.duty;
    return { x: restX + g.half - 2 * g.half * s, y: 0, a: g.stance(s), inStance: true, s };
  }
  const s = (p - g.duty) / (1 - g.duty);
  const e = smoothstep(s);
  return { x: restX - g.half + 2 * g.half * e, y: -g.lift * Math.sin(Math.PI * Math.min(1, s * 1.08)), a: g.angle(s), inStance: false, s };
}
/** Like `gaitFoot`, but in the swing it is the foot's joint (wrist, hock, heel) that arcs forward
 *  and the foot hangs from it at its profile angle: a folded paw or curled toes swing under the
 *  joint as they really do, instead of dragging the joint around a far-off toe. */
export function gaitFootByJoint(g: GaitFoot, leg: Leg, restX: number, u: number): Foot & { inStance: boolean; s: number } {
  const f = gaitFoot(g, restX, u);
  if (f.inStance) return f;
  const off = (a: number): Pt => { const c = Math.cos(a * DEG); const sn = Math.sin(a * DEG); return [c * leg.contact[0] - sn * leg.contact[1], sn * leg.contact[0] + c * leg.contact[1]]; };
  const a0 = g.angle(0);
  const a1 = g.angle(1);
  const o0 = off(a0);
  const o1 = off(a1);
  const j0: Pt = [restX - g.half - o0[0], -o0[1]];
  const j1: Pt = [restX + g.half - o1[0], -o1[1]];
  const e = smoothstep(f.s);
  const jx = j0[0] + (j1[0] - j0[0]) * e;
  // snatched up quickly; `soft` sets it down slowly too (a goose's flat web)
  const arc = f.s < 0.5 || g.soft !== true ? Math.sin(Math.PI * f.s) : 0.5 * (1 + Math.cos(Math.PI * (2 * f.s - 1)));
  const jy = j0[1] + (j1[1] - j0[1]) * e - g.lift * arc;
  const o = off(f.a);
  return { x: jx + o[0], y: jy + o[1], a: f.a, inStance: false, s: f.s };
}
/** Piecewise-linear profile through (s, value) points. */
export const profile = (pts: readonly (readonly [number, number])[]) => (s: number): number => {
  if (s <= pts[0]![0]) return pts[0]![1];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [s0, v0] = pts[i]!;
    const [s1, v1] = pts[i + 1]!;
    if (s <= s1) { const u = smoothstep((s - s0) / (s1 - s0 || 1)); return v0 + (v1 - v0) * u; }
  }
  return pts[pts.length - 1]![1];
};
export const TAU = Math.PI * 2;
export const sn = (u: number, k = 1, ph = 0): number => Math.sin(TAU * (k * u + ph));
