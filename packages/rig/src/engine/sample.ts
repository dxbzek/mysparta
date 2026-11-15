/**
 * Sampling a clip into a pose, for any rig. Pure: the same inputs always give the same pose.
 *
 *  1. Keys are mixed per bone with the ease of the key a segment ends on. A bone with `lag`
 *     reads the clip that many ms late (follow-through). In a clip that does not loop the lag
 *     fades out over the last `lag` ms, so the clip still ends on its own last pose.
 *     `stepped: n` holds each pose for 1000 / n ms.
 *  2. An aim bends the bones of the rig's bend list (see `Bend`), full at the contact.
 *  3. Feet. A clip with `plant` pins those feet by two-bone IK where they stood at t = 0 (on the
 *     floor) and lifts any other foot that would sink under the floor. A clip without `plant`
 *     is dropped so its lowest point touches the floor; a key with root y < 0 lifts it that high
 *     (a jump). Root x is travel; parts only ever rotate.
 */
import type { Clip, FaceId, Pose, RigId } from "../contracts";
import { TRAIL_LEN, TRAIL_STEP_MS } from "../contracts";
import { ease } from "./ease";
import { twoBone } from "./ik";
import type { Model } from "./pose";
import { apply, frames, worldAngles } from "./pose";

/** Everything the sampler knows about one rig besides its bones. */
export interface Body {
  rig: RigId;
  model: Model;
  /** Points of each bone (bone frame) that can touch the floor. */
  hull: readonly (readonly (readonly [number, number])[])[];
  /** A pet drawn frame by frame: the index of its "frame" bone and the hull of each drawn frame
   *  (see `hullAt`). */
  frames?: { bone: number; hulls: readonly (readonly (readonly (readonly [number, number])[])[])[] };
  /** Foot bones: kept above the floor in a planted clip. */
  feet: readonly number[];
  /** How an aimed swing bends: bone index and share of the bend angle; `crouch` units of hip
   *  drop per degree of a downward bend (planted clips only). */
  bend: { bones: readonly (readonly [number, number])[]; crouch: number };
  /** The bone whose world angle `Pose.trail` remembers (the front hand), or -1. */
  trailBone: number;
  /** Secondary bones (no keys): turned by their parent's recent motion (see skeleton.ts). */
  secondary?: readonly { bone: number; gain: number; drag: number; ms: number }[];
}

export interface Raw { rot: number[]; rootX: number; rootY: number; sx: number; sy: number; face: FaceId }

export function clipTime(c: Clip, tMs: number): number {
  const d = c.duration;
  let t = Number.isFinite(tMs) ? tMs : 0;
  if (c.loop) { t %= d; if (t < 0) t += d; } else t = t < 0 ? 0 : t > d ? d : t;
  return t;
}

function segment(c: Clip, t: number): { i: number; u: number } {
  const keys = c.keys;
  if (keys.length === 1 || t <= keys[0]!.t) return { i: 0, u: 0 };
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (t <= b.t) {
      const span = b.t - a.t;
      return { i, u: span <= 0 ? 1 : ease((t - a.t) / span, b.ease) };
    }
  }
  return { i: keys.length - 1, u: 0 };
}
function channel(c: Clip, id: string, t: number): number {
  const { i, u } = segment(c, t);
  const a = c.keys[i]!;
  const b = c.keys[Math.min(i + 1, c.keys.length - 1)]!;
  const va = a.rot?.[id] ?? 0;
  const vb = b.rot?.[id] ?? va;
  return va + (vb - va) * u;
}

/** The keyed pose of a clip at a time inside it (no aim, no feet). */
export function sampleRaw(model: Model, c: Clip, tIn: number): Raw {
  let t = clipTime(c, tIn);
  if (c.stepped !== undefined && c.stepped > 0) {
    const step = 1000 / c.stepped;
    t = Math.min(c.duration, Math.floor(t / step + 1e-9) * step);
  }
  const d = c.duration;
  const rot = model.def.bones.map((b) => {
    const lag = c.lag?.[b.id] ?? 0;
    if (lag <= 0) return channel(c, b.id, t);
    let tb: number;
    if (c.loop) { tb = t - lag; tb %= d; if (tb < 0) tb += d; } else {
      const fade = Math.min(1, Math.max(0, (d - t) / lag));
      tb = Math.max(0, t - lag * fade);
    }
    return channel(c, b.id, tb);
  });
  const { i, u } = segment(c, t);
  const a = c.keys[i]!;
  const b = c.keys[Math.min(i + 1, c.keys.length - 1)]!;
  const ra = a.root ?? [0, 0];
  const rb = b.root ?? ra;
  const sa = a.scale ?? [1, 1];
  const sb = b.scale ?? sa;
  const mix = (x: number, y: number): number => x + (y - x) * u;
  const face = (u < 0.5 || i + 1 >= c.keys.length ? a.face : b.face) ?? a.face ?? "neutral";
  return { rot, rootX: mix(ra[0], rb[0]), rootY: mix(ra[1], rb[1]), sx: mix(sa[0], sb[0]), sy: mix(sa[1], sb[1]), face };
}

/** 1 at the contact, easing to 0 at the clip's start and end; 0 for a clip with no contact. */
export function bendWeight(c: Clip, t: number): number {
  const tc = c.events.find((e) => e.name === "contact")?.t;
  if (tc === undefined) return 0;
  const d = c.duration;
  let u = t <= tc ? (tc > 0 ? t / tc : 1) : (d > tc ? (d - t) / (d - tc) : 1);
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return u * u * (3 - 2 * u);
}

export interface BendAmount { theta: number; lift: number }
export function applyBend(body: Body, c: Clip, raw: Raw, bend: BendAmount, w: number): Raw {
  if (w === 0 || (bend.theta === 0 && bend.lift === 0)) return raw;
  const rot = [...raw.rot];
  for (const [i, share] of body.bend.bones) rot[i] = (rot[i] ?? 0) + bend.theta * share * w;
  const planted = (c.plant?.length ?? 0) > 0;
  const crouch = planted && bend.theta > 0 ? body.bend.crouch * bend.theta * w : 0;
  return { ...raw, rot, rootY: raw.rootY + crouch + bend.lift * w };
}

/** The drawn frame of a pose: the angle of its "frame" bone, rounded (0 without one). */
export const frameAt = (body: Body, rot: readonly number[]): number => (body.frames === undefined ? 0 : Math.round(rot[body.frames.bone] ?? 0));
/** The hull of the shapes drawn in this pose (a frame-by-frame pet shows one frame at a time). */
export const hullAt = (body: Body, rot: readonly number[]): Body["hull"] => body.frames?.hulls[frameAt(body, rot)] ?? body.hull;

/** The lowest point (largest y) of some bones' hulls, in figure space. */
function lowest(body: Body, rot: readonly number[], rootX: number, rootY: number, only?: readonly number[]): number {
  const fr = frames(body.model, rot, rootX, rootY);
  let low = -Infinity;
  const hull = hullAt(body, rot);
  const list = only ?? hull.map((_, i) => i);
  for (const i of list) {
    const f = fr[i]!;
    for (const p of hull[i] ?? []) {
      const y = apply(f, p[0], p[1])[1];
      if (y > low) low = y;
    }
  }
  return low === -Infinity ? 0 : low;
}

interface Plant { bone: number; x: number; y: number; angle: number }
const plantCache = new WeakMap<Clip, Map<Body, Plant[]>>();
/** Where each planted foot stands: its joint at t = 0, put down on the floor, and its angle. */
function plantsOf(body: Body, c: Clip): Plant[] {
  let byBody = plantCache.get(c);
  if (byBody === undefined) { byBody = new Map(); plantCache.set(c, byBody); }
  const hit = byBody.get(body);
  if (hit !== undefined) return hit;
  const raw = sampleRaw(body.model, c, 0);
  const fr = frames(body.model, raw.rot, raw.rootX, raw.rootY);
  const wa = worldAngles(body.model, raw.rot);
  const out: Plant[] = [];
  for (const id of c.plant ?? []) {
    const i = body.model.index.get(id);
    if (i === undefined) continue;
    const f = fr[i]!;
    let low = -Infinity;
    for (const p of body.hull[i] ?? []) { const y = apply(f, p[0], p[1])[1]; if (y > low) low = y; }
    out.push({ bone: i, x: f.e, y: f.f - (low === -Infinity ? 0 : low), angle: wa[i]! });
  }
  byBody.set(body, out);
  return out;
}

/** Share of a planted leg's full length the hips may pull it to (see `solveFeet`). */
export const PLANT_REACH = 0.985;

export interface Solved { rot: number[]; rootX: number; rootY: number; lift: number }

/** Feet: plant, floor clamp, or drop to the floor (see the header). */
export function solveFeet(body: Body, c: Clip, raw: Raw, hop = 0): Solved {
  const m = body.model;
  const plants = plantsOf(body, c);
  if (plants.length === 0) {
    const want = raw.rootY < 0 ? raw.rootY : 0;
    const low = lowest(body, raw.rot, raw.rootX, 0);
    const rootY = want - low;
    return { rot: [...raw.rot], rootX: raw.rootX, rootY, lift: -want };
  }
  let rot = [...raw.rot];
  // a planted leg is never pulled straight: when the hips travel further than the leg reaches,
  // the hips sink (the body moves, not the joint). An aim's hop (`hop`, added to root y) is left
  // out of that: a hop is meant to lift the feet.
  let rootY = raw.rootY - hop;
  for (const p of plants) {
    const lower = m.parent[p.bone]!;
    const upper = lower >= 0 ? m.parent[lower]! : -1;
    if (upper < 0) continue;
    const hip = frames(m, rot, raw.rootX, rootY)[upper]!;
    const b = m.def.bones;
    const L = (Math.hypot(b[lower]!.x, b[lower]!.y) + Math.hypot(b[p.bone]!.x, b[p.bone]!.y)) * PLANT_REACH;
    const dx = p.x - hip.e;
    const dy = p.y - hip.f;
    if (Math.hypot(dx, dy) > L && Math.abs(dx) < L && dy > 0) rootY += dy - Math.sqrt(L * L - dx * dx);
  }
  rootY += hop;
  for (const p of plants) {
    const lower = m.parent[p.bone]!;
    const upper = lower >= 0 ? m.parent[lower]! : -1;
    if (upper < 0) continue;
    rot = twoBone(m, rot, raw.rootX, rootY, upper, lower, p.bone, p.x, p.y).rot;
    const wa = worldAngles(m, rot);
    rot[p.bone] = p.angle - (wa[lower] ?? 0);
  }
  for (const f of body.feet) {
    if (plants.some((p) => p.bone === f)) continue;
    const low = lowest(body, rot, raw.rootX, rootY, [f]);
    if (low <= 0) continue;
    const lower = m.parent[f]!;
    const upper = lower >= 0 ? m.parent[lower]! : -1;
    if (upper < 0) continue;
    const fr = frames(m, rot, raw.rootX, rootY);
    const keep = worldAngles(m, rot)[f]!;
    rot = twoBone(m, rot, raw.rootX, rootY, upper, lower, f, fr[f]!.e, fr[f]!.f - low).rot;
    rot[f] = keep - (worldAngles(m, rot)[lower] ?? 0);      // the foot keeps its angle as it lifts
  }
  const lowAll = lowest(body, rot, raw.rootX, rootY, body.feet.length > 0 ? body.feet : undefined);
  return { rot, rootX: raw.rootX, rootY, lift: lowAll < 0 ? -lowAll : 0 };
}

/** The whole pose of a clip at a time, with an optional bend. */
export function poseAt(body: Body, c: Clip, tMs: number, bend: BendAmount | null): Pose {
  const t = clipTime(c, tMs);
  const w = bend === null ? 0 : bendWeight(c, t);
  let raw = bend === null ? sampleRaw(body.model, c, t) : applyBend(body, c, sampleRaw(body.model, c, t), bend, w);
  if (body.secondary !== undefined && body.secondary.length > 0) raw = secondary(body, c, raw, Number.isFinite(tMs) ? tMs : 0, bend, w);
  const s = solveFeet(body, c, raw, bend === null ? 0 : bend.lift * w);
  const pose: Pose = { rig: body.rig, rot: s.rot, root: { x: s.rootX, y: s.rootY, sx: raw.sx, sy: raw.sy }, face: raw.face, lift: s.lift };
  if (body.trailBone < 0) return pose;
  // where the front hand pointed 40..160 ms ago (read from the time asked for, bent by NOW's weight)
  const now = Number.isFinite(tMs) ? tMs : 0;
  const trail: number[] = [];
  for (let n = 1; n <= TRAIL_LEN; n++) {
    const tp = clipTime(c, now - n * TRAIL_STEP_MS);
    const r = bend === null ? sampleRaw(body.model, c, tp) : applyBend(body, c, sampleRaw(body.model, c, tp), bend, w);
    trail.push(worldAngles(body.model, r.rot)[body.trailBone]!);
  }
  return { ...pose, trail };
}

/** Secondary motion (hair): the parent's turn over the last `ms`, and the forward travel, turn the
 *  bone the other way, as if it trailed. Read from the time asked for, so it settles after a
 *  one-shot clip ends. */
function secondary(body: Body, c: Clip, raw: Raw, now: number, bend: BendAmount | null, w: number): Raw {
  const rot = [...raw.rot];
  const waNow = worldAngles(body.model, raw.rot);
  for (const s of body.secondary ?? []) {
    const parent = body.model.parent[s.bone] ?? -1;
    if (parent < 0) continue;
    const pastT = clipTime(c, now - s.ms);
    const past = bend === null ? sampleRaw(body.model, c, pastT) : applyBend(body, c, sampleRaw(body.model, c, pastT), bend, w);
    const waPast = worldAngles(body.model, past.rot);
    const turn = waNow[parent]! - waPast[parent]!;
    const travel = raw.rootX - past.rootX;
    let a = (rot[s.bone] ?? 0) - s.gain * turn - s.drag * travel;
    const lim = body.model.def.bones[s.bone]!.limit;
    if (lim !== undefined) a = a < lim[0] ? lim[0] : a > lim[1] ? lim[1] : a;
    rot[s.bone] = a;
  }
  return { ...raw, rot };
}
