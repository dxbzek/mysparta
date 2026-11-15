/**
 * Pose crossfade (fight screen v2). Clips are laid out as segments that cut from one to the next;
 * drawn raw, a forearm or a hand can jump 60 to 70 degrees in one frame at a cut, legs jump from
 * a run stride to a planted stance, and a second hit-light restarts the flinch at frame 0.
 *
 * `poseAt` is the pose the stage draws: the raw pose of the segment at `t`, blended for a short
 * time after the cut (the segment began, a segment over it ended, or the last one ended into idle)
 * from the pose that was on screen just before the cut. The crossfade lasts 60 to 170 ms, longer
 * for a bigger gap between the two poses. That earlier pose is itself `poseAt` of the moment before,
 * so a cut inside a crossfade (a hit landing mid-flinch) continues from what was really shown.
 * The blend is an offset that fades: at the cut the drawn pose IS the pose that was on screen,
 * and the difference (bone angles by the shortest arc, the root and the lift linearly) shrinks
 * to nothing while the incoming clip plays its own motion underneath, so a fast swing keeps its
 * snap and no joint jumps. A pure function of `t`.
 */
import type { Pose, Rig } from "@rankzero/rig";
import type { ActorTrack, Seg } from "./model";
import { clipTime, segAt } from "./track";
import { BLEND } from "./tuning";

const smooth = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** The shortest signed turn from `a` to `b`, in degrees (-180 to 180). */
export function arc(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

/** `p` blended toward `q` by `w` (0 = p, 1 = q). The face, trail and rig are q's. */
export function mixPose(p: Pose, q: Pose, w: number): Pose {
  if (w >= 1 || p.rig !== q.rig || p.rot.length !== q.rot.length) return q;
  const rot = q.rot.map((b, i) => p.rot[i]! + arc(p.rot[i]!, b) * w);
  const lerp = (x: number, y: number): number => x + (y - x) * w;
  const out: Pose = { rig: q.rig, rot, face: q.face, lift: lerp(p.lift, q.lift),
    root: { x: lerp(p.root.x, q.root.x), y: lerp(p.root.y, q.root.y), sx: lerp(p.root.sx, q.root.sx), sy: lerp(p.root.sy, q.root.sy) } };
  if (q.trail !== undefined) out.trail = q.trail;
  return out;
}

function rawPose(rig: Rig, tr: ActorTrack, seg: Seg | null, t: number): Pose {
  return seg === null ? rig.samplePose(tr.rig, "idle", t + tr.phase) : rig.samplePose(tr.rig, seg.clip, clipTime(seg, t), seg.aim);
}

/** The segment a segment carries on from: the same clip, ending where it starts, at the clip time
 *  it starts on (the brake's flight fitted, then played at 1x). That is no cut. */
function carriedFrom(tr: ActorTrack, seg: Seg): Seg | null {
  const prev = segAt(tr, seg.from - 0.5);
  return prev !== null && prev !== seg && prev.clip === seg.clip && prev.to === seg.from
    && Math.abs(clipTime(prev, seg.from) - seg.c0) < 0.5 ? prev : null;
}

/** When the clip on screen at `t` began to show: the start of its segment (or of the segments it
 *  carries on from), or the end of a later segment that played over it, or (in idle) the end of
 *  the last segment. */
function cutAt(tr: ActorTrack, seg0: Seg | null, t: number): number | null {
  const chain = new Set<Seg>();
  let seg = seg0;
  while (seg !== null) {
    chain.add(seg);
    const prev = carriedFrom(tr, seg);
    if (prev === null || chain.has(prev)) break;
    seg = prev;
  }
  let cut: number | null = seg === null ? null : seg.from;
  for (const s of tr.segs) {
    if (chain.has(s) || s.to > t || s.to === Infinity) continue;
    if (seg !== null && s.from < seg.from) continue;
    if (cut === null || s.to > cut) cut = s.to;
  }
  return cut;
}

function gap(p: Pose, q: Pose): number {
  let g = 0;
  if (p.rig !== q.rig) return 0;
  for (let i = 0; i < q.rot.length; i++) g = Math.max(g, Math.abs(arc(p.rot[i]!, q.rot[i]!)));
  return g;
}

/** `now` with the gap between `from` and `to` (two poses at the cut) added, faded by `w` (1 = all of it). */
export function offsetPose(now: Pose, from: Pose, to: Pose, w: number): Pose {
  if (w <= 0 || from.rig !== now.rig || to.rig !== now.rig) return now;
  const rot = now.rot.map((r, i) => r + arc(to.rot[i]!, from.rot[i]!) * w);
  const add = (n: number, a: number, b: number): number => n + (a - b) * w;
  const out: Pose = { rig: now.rig, rot, face: now.face, lift: add(now.lift, from.lift, to.lift),
    root: { x: add(now.root.x, from.root.x, to.root.x), y: add(now.root.y, from.root.y, to.root.y),
      sx: add(now.root.sx, from.root.sx, to.root.sx), sy: add(now.root.sy, from.root.sy, to.root.sy) } };
  if (now.trail !== undefined) out.trail = now.trail;
  return out;
}

/** The pose drawn for one actor at `t`. `blend` false turns the crossfade off (a planted fault). */
export function poseAt(rig: Rig, tr: ActorTrack, t: number, blend = true, depth = 0): Pose {
  const seg = segAt(tr, t);
  const now = rawPose(rig, tr, seg, t);
  if (!blend || depth >= BLEND.maxDepth) return now;
  const cut = cutAt(tr, seg, t);
  if (cut === null || t < cut || t - cut >= BLEND.maxMs || cut <= tr.showFrom) return now;
  const before = poseAt(rig, tr, cut - 0.5, blend, depth + 1);
  const atCut = rawPose(rig, tr, segAt(tr, cut), cut);
  const ms = Math.min(BLEND.maxMs, Math.max(BLEND.minMs, gap(before, atCut) * BLEND.msPerDeg));
  if (t - cut >= ms) return now;
  return offsetPose(now, before, atCut, 1 - smooth((t - cut) / ms));
}
