/**
 * Shared kit for pets drawn frame by frame (the rotoscope method of the stray dog, 15 Nov 2026):
 * silhouettes registered on the head joint, put on the body bone as `body@N` shapes (the engine
 * draws only the frame the "frame" bone rounds to), and clips built from beats in which the frame
 * steps and every other bone eases.
 */
import type { Clip, CompanionClip, Key, Shape } from "../../contracts";
import { PLACEHOLDER_COMPANION_CLIPS } from "../../contracts";
import type { Poly, Pt } from "../../gate/vocab";
import { dPolys } from "../../gate/vocab";
import type { Anatomy, Rot } from "./anatomy";

const P = PLACEHOLDER_COMPANION_CLIPS;

/** One drawn frame: the silhouette (one or more polygons), optional shading, and how far the
 *  traced animal was off the floor (a flight). Units: stage units about the head joint, y down. */
export interface Frame { body: readonly (readonly Pt[])[]; shade?: readonly (readonly Pt[])[]; lift: number }

export const clockwise = (poly: readonly Pt[]): Pt[] => {
  let area = 0;
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]!; area += p[0] * q[1] - q[0] * p[1]; });
  return area < 0 ? [...poly].reverse() : [...poly];
};
/** Each frame's silhouette as one shape on `bone@N`, in one outline group (z). */
export function addFrames(a: Anatomy, frames: readonly Frame[], bone = "body", z = 20, slot: Shape["slot"] = "skin"): void {
  frames.forEach((f, n) => {
    const shape: Shape = { bone: `${bone}@${n}`, d: dPolys(f.body.map((p) => a.local(bone, clockwise(p)) as Poly)), slot, z };
    if (f.shade !== undefined && f.shade.length > 0) shape.shade = dPolys(f.shade.map((p) => a.local(bone, clockwise(p)) as Poly));
    a.shapes.push(shape);
  });
}
/** A shape drawn only in some frames (a hand-drawn frame's own tail, say). */
export function addTagged(a: Anatomy, bone: string, frames: readonly number[], pts: readonly Pt[], slot: Shape["slot"], z: number): void {
  for (const n of frames) a.shapes.push({ bone: `${bone}@${n}`, d: dPolys([a.local(bone, pts) as Poly]), slot, z });
}

export interface Beat { t: number; frame: number; rot?: Rot; root?: Pt; scale?: readonly [number, number]; ease?: "lin" | "in" | "out" | "inOut" }
const easeOf = (u: number, e: Beat["ease"]): number => (e === "in" ? u * u : e === "out" ? 1 - (1 - u) * (1 - u) : e === "inOut" ? u * u * (3 - 2 * u) : u);

/**
 * A clip from beats, sampled every 10 ms: the drawn frame steps (two keys at one time, just
 * before its beat, so the "frame" bone never passes through other frames), every other bone and
 * the root ease. Root y adds each frame's own flight; `k` scales the beats' root travel.
 */
export function framesClip(frames: readonly Frame[], k: number, c: CompanionClip, beats: readonly Beat[], lag: Rot, loop = false): Clip {
  const full = beats.map((b) => ({ ...b, rot: { ...b.rot } as Rot, root: [(b.root?.[0] ?? 0) * k, -(b.root?.[1] ?? 0) * k] as const, scale: b.scale ?? [1, 1] as const }));
  const keyAt = (t: number, frame: number): Key => {
    let i = 0;
    while (i + 1 < full.length - 1 && t >= full[i + 1]!.t) i++;
    const A = full[i]!;
    const B = full[Math.min(i + 1, full.length - 1)]!;
    const u = B.t > A.t ? easeOf(Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t))), B.ease) : 0;
    const rot: Rot = { frame };
    for (const key of new Set([...Object.keys(A.rot), ...Object.keys(B.rot)])) { const va = A.rot[key] ?? 0; rot[key] = va + ((B.rot[key] ?? va) - va) * u; }
    const mix = (x: number, y: number): number => x + (y - x) * u;
    return { t, rot, root: [mix(A.root[0], B.root[0]), mix(A.root[1], B.root[1]) - frames[frame]!.lift * k], scale: [mix(A.scale[0], B.scale[0]), mix(A.scale[1], B.scale[1])] };
  };
  const keys: Key[] = [];
  const d = P[c].durationMs;
  for (let i = 0; i * 10 <= d; i++) {
    const t = i * 10;
    let j = 0;
    while (j + 1 < full.length && t >= full[j + 1]!.t) j++;
    const frame = full[j]!.frame;
    const prev = keys.length > 0 ? keys[keys.length - 1]!.rot!["frame"]! : frame;
    if (frame !== prev) keys.push(keyAt(t - 1, prev), keyAt(t - 1, frame));
    keys.push(keyAt(t, frame));
  }
  return { duration: d, loop, events: P[c].events, keys, lag };
}

/** The top edge of a silhouette sampled at n x positions in [x0, x1] (the highest crossing). */
export function topEdge(poly: readonly Pt[], x0: number, x1: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    let top = Infinity;
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length]!;
      if ((p[0] - x) * (q[0] - x) <= 0 && p[0] !== q[0]) top = Math.min(top, p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]));
    });
    if (Number.isFinite(top)) out.push([x, top]);
  }
  return out;
}
/** A band hugging the top edge: from the edge down by `depth` (a saddle, a sheen, a mane). */
export function topBand(poly: readonly Pt[], x0: number, x1: number, depth: number, lift = 0, n = 16): Pt[] {
  const top = topEdge(poly, x0, x1, n);
  return [...top.map(([x, y]) => [x, y - lift] as Pt), ...top.reverse().map(([x, y]) => [x, y + depth] as Pt)];
}

/** The part of a polygon at or below the line y (larger y), as a polygon (Sutherland-Hodgman). */
export function cutBelow(poly: readonly Pt[], y: number): Pt[] {
  const out: Pt[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    const pin = p[1] >= y;
    const qin = q[1] >= y;
    if (pin) out.push(p);
    if (pin !== qin) out.push([p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]), y]);
  });
  return out;
}
/**
 * The near legs of a drawn standing frame, laid again over its silhouette in the same outline
 * group: one silhouette's light offset is set by its thickest part (the torso), which left a thin
 * leg wholly in shadow; a leg drawn on its own takes the offset of its own width, so it keeps a lit
 * front and a thin shadow behind, as a fighter's limbs do. Cut at `cut` (inside the belly).
 */
export function addLitLegs(a: Anatomy, frames: readonly number[], legs: readonly (readonly [readonly Pt[], number])[], z = 20.01, bone = "body"): void {
  for (const [leg, cut] of legs) addTagged(a, bone, frames, cutBelow(leg, cut), "skin", z);
}
