/**
 * Drawn feet, measured frame by frame (movement pass 2). For every 60 fps frame of a bout, every
 * scrapper's drawn pose (the crossfaded pose `draw` paints, blend.ts) is placed on the stage and
 * the two bottom corners of each shoe's sole (the toe and the heel, rig gate/clips/kit.ts `TOE`,
 * `HEEL`) are read off it. A corner within `FLOOR_EPS` of the floor line under the fighter is in
 * contact; over each run of frames it stays in contact, how far it moves along the floor is its
 * slide. A real foot on the floor does not move: it rolls on the point it stands on.
 *
 * Footwork only (`footwork: true`, the default): the frames in which the fighter stands, steps
 * or travels: the idle, the brace, the push-off, the run, the brake, the shuffle, the backpedal,
 * both dodges and both blocks, and every crossfade between them. Not footwork, so it ends a run
 * and starts none: a frame in which he is shoved by a blow (a knockback or a block's recoil is
 * pushing him), one of any other clip (a swing, a throw, a flinch, the fall, a Move's action:
 * their feet are the clips' own business, see the movement report), and the crossfade out of one
 * (`BLEND.maxMs` after it).
 */
import type { ActorId } from "@rankzero/core";
import type { Pose, Rig } from "@rankzero/rig";
import { poseAt } from "../../src/blend";
import type { StagePlayer } from "../../src/createFightPlayer";
import type { FrameActor } from "../../src/frame";
import { BLEND } from "../../src/tuning";

/** The sole's bottom corners in the foot bone's frame (kit.ts TOE and HEEL: 22.2 and -7, 7.6, times K 0.46). */
const K = 0.46;
export const SOLE_POINTS = { toe: [22.2 * K, 7.6 * K], heel: [-7 * K, 7.6 * K] } as const;
/** A corner this close to the floor line (stage units) stands on it. */
export const FLOOR_EPS = 0.35;
export const SLIDE_LIMIT = 0.5;
export const FRAME_MS = 1000 / 60;
/** The clips of standing, stepping and travelling. */
export const FOOTWORK_CLIPS: ReadonlySet<string> = new Set(["idle", "brace", "dash-push", "dash", "brake", "shuffle", "backpedal",
  "evade", "slip", "block", "block-shield"]);

interface RigInspectLike {
  joints(pose: Pose, dress: unknown, at: unknown): [number, number][];
  rigDef(rig: string): { bones: readonly { id: string; parent: number; x: number; y: number }[] };
}
const inspectOf = (rig: Rig): RigInspectLike => {
  const i = (rig as Rig & { inspect?: RigInspectLike }).inspect;
  if (i === undefined) throw new Error("feet: not a rig made by createRig");
  return i;
};

export interface Slide {
  actor: ActorId; foot: "footF" | "footB"; point: "toe" | "heel";
  from: number; to: number; slide: number;
  /** The clips shown over the run, in order (a crossfade shows as two). */
  clips: string[];
  /** When the worst of it was reached. */
  worstAt: number;
}

/** Is this frame of this fighter footwork, given when it last showed another clip (see the header)? */
export function isFootwork(a: FrameActor, t: number, lastOther: number): boolean {
  if (!FOOTWORK_CLIPS.has(a.clip) || t - lastOther < BLEND.maxMs) return false;
  return !a.nudges.some((n) => n.key === "knockback" || n.key === "recoil");
}

/** Every contact run of every scrapper's feet in the bout, with its slide. */
export function footRuns(p: StagePlayer, rig: Rig, o: { footwork?: boolean; step?: number; only?: ReadonlySet<string> } = {}): Slide[] {
  const footwork = o.only === undefined && (o.footwork ?? true);
  const step = o.step ?? FRAME_MS;
  const ins = inspectOf(rig);
  const bones = ins.rigDef("scrapper").bones;
  const idx = (id: string): number => bones.findIndex((b) => b.id === id);
  const feet = (["footF", "footB"] as const).map((id) => ({ id, i: idx(id), knee: bones[idx(id)]!.parent }));
  const shin = Math.hypot(bones[feet[0]!.i]!.x, bones[feet[0]!.i]!.y);
  const world = (rot: readonly number[], i: number): number => {
    let a = 0;
    for (let b = i; b >= 0; b = bones[b]!.parent) a += rot[b] ?? 0;
    return a;
  };
  type Run = { actor: ActorId; foot: "footF" | "footB"; point: "toe" | "heel"; x0: number; from: number; last: number; worst: number; worstAt: number; clips: string[] };
  const open = new Map<string, Run>();
  const lastOther = new Map<ActorId, number>();
  const out: Slide[] = [];
  const close = (key: string): void => {
    const r = open.get(key);
    if (r === undefined) return;
    out.push({ actor: r.actor, foot: r.foot, point: r.point, from: r.from, to: r.last, slide: r.worst, clips: r.clips, worstAt: r.worstAt });
    open.delete(key);
  };
  for (let t = 0; t <= p.timeline.durationMs; t += step) {
    const f = p.frame(t);
    const here = new Set<string>();
    for (const a of f.actors) {
      if (a.rig !== "scrapper") continue;
      if (!FOOTWORK_CLIPS.has(a.clip)) lastOther.set(a.id, t);
      if (footwork && !isFootwork(a, t, lastOther.get(a.id) ?? -Infinity)) continue;
      if (o.only !== undefined && !o.only.has(a.clip)) continue;
      const tr = p.tracks.byId.get(a.id)!;
      const pose = poseAt(rig, tr, t);
      const j = ins.joints(pose, a.dress, a.place);
      for (const ft of feet) {
        const [ax, ay] = j[ft.i]!;
        const [kx, ky] = j[ft.knee]!;
        const s = Math.hypot(ax - kx, ay - ky) / shin;
        const r = (world(pose.rot, ft.i) * Math.PI) / 180;
        for (const point of ["toe", "heel"] as const) {
          const [px, py] = SOLE_POINTS[point];
          const x = ax + a.place.facing * s * (Math.cos(r) * px - Math.sin(r) * py);
          const y = ay + s * (Math.sin(r) * px + Math.cos(r) * py);
          if (Math.abs(y - a.floorY) > FLOOR_EPS) continue;
          const key = `${a.id}|${ft.id}|${point}`;
          here.add(key);
          const run = open.get(key);
          if (run === undefined) {
            open.set(key, { actor: a.id, foot: ft.id, point, x0: x, from: t, last: t, worst: 0, worstAt: t, clips: [a.clip] });
          } else {
            run.last = t;
            const d = Math.abs(x - run.x0);
            if (d > run.worst) { run.worst = d; run.worstAt = t; }
            if (run.clips[run.clips.length - 1] !== a.clip) run.clips.push(a.clip);
          }
        }
      }
    }
    for (const key of [...open.keys()]) if (!here.has(key)) close(key);
  }
  for (const key of [...open.keys()]) close(key);
  return out;
}

/** The runs that slide more than the limit, worst first. */
export function slides(p: StagePlayer, rig: Rig, limit = SLIDE_LIMIT, o: { footwork?: boolean; only?: ReadonlySet<string> } = {}): Slide[] {
  return footRuns(p, rig, o).filter((r) => r.slide > limit).sort((x, y) => y.slide - x.slide);
}

/** The worst slide of a bout (0 when nothing stands on the floor). */
export function worstSlide(p: StagePlayer, rig: Rig, o: { footwork?: boolean } = {}): number {
  return footRuns(p, rig, o).reduce((m, r) => Math.max(m, r.slide), 0);
}
