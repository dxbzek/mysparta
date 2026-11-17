/**
 * Pose authoring for the scrapper clips. A key is written the way an animator thinks (where the
 * hips are, how far the body leans, where each wrist and each ankle goes, which way the held
 * item points) and turned into the contract's bone angles once, when the module loads, with the
 * same two-bone IK the engine uses. The result is a plain `Clip` of `rot` keys: the engine never
 * sees this file. Angles of one bone are unwrapped key to key, so a joint always turns the short
 * way unless a key asks for a full turn (`spin`).
 *
 * Space: figure space of the lean build at scale 1, facing +x, feet on y = 0, y down.
 */
import type { Clip, Ease, FaceId, Key } from "../../contracts";
import { twoBone, wrapNear } from "../../engine/ik";
import type { Stride, StrideClip } from "../../engine/sample";
import { frames, modelOf, worldAngles } from "../../engine/pose";
import { BONE, GRIP_ROT, K, PROPORTION, SCRAPPER_RIG, STOW } from "../skeleton";

const model = modelOf(SCRAPPER_RIG);
type P2 = readonly [number, number];

/** An arm: a wrist target (IK), or the three angles. `aim` is the world angle of the held item
 *  (0 = forward, -90 = straight up); it sets the hand, for an item whose `grip.rot` is `grip`
 *  (default `GRIP_ROT`, the Pipe's). With `release`, the hand keeps `hand` and
 *  the item turns away from it by `held` degrees: the grip lets go. */
export type ArmSpec =
  | { at: P2; aim?: number; hand?: number; grip?: number }
  | { up: number; lo: number; hand?: number; aim?: number; grip?: number }
  | { dir: number; reach: number; aim?: number; hand?: number; grip?: number };
/* `dir` and `reach` (animation pass): the wrist put along a line from the shoulder, `dir`
 * degrees from straight forward (positive down, -90 straight up, 180 straight back), `reach` of
 * the arm's length from it. An animator thinks "arm long, angled down at the target"; the kit
 * finds the wrist from wherever the shoulder is in that key, so a lean or a crouch never
 * stretches the arm by surprise. */
/** A leg: an ankle target (IK; y defaults to standing on the floor) with the foot's world angle,
 *  or the three angles. */
export type LegSpec = { at: number | P2; foot?: number } | { up: number; lo: number; foot?: number };

export interface Spec {
  /** Hip offset from standing straight: x travel, y down (a crouch). In a clip with no planted
   *  feet a negative y is a jump of that height. */
  root?: P2;
  /** Turn of the whole body around the feet (a fall). */
  spin?: number;
  pelvis?: number;
  torso?: number;
  head?: number;
  F?: ArmSpec;
  B?: ArmSpec;
  legF?: LegSpec;
  legB?: LegSpec;
  /** Turn of the held item away from the hand (a dropped weapon). */
  held?: number;
  /** World angle the held item lies at, whatever the hand does (sets `held`; a dropped weapon). */
  item?: number;
  /** The held item is put away while the hands are busy at the head (`STOW`). */
  stow?: boolean;
  face?: FaceId;
  ease?: Ease;
  scale?: P2;
}

const ANKLE = PROPORTION.ankle;

/** One key's bone angles. */
export function solve(s: Spec, prev?: readonly number[]): number[] {
  const rot = model.def.bones.map(() => 0);
  rot[BONE.root] = s.spin ?? 0;
  rot[BONE.pelvis] = s.pelvis ?? 0;
  rot[BONE.torso] = s.torso ?? 0;
  rot[BONE.head] = s.head ?? 0;
  rot[BONE.held] = s.held ?? 0;
  rot[BONE.stow] = s.stow === true ? STOW.on : 0;
  const rx = s.root?.[0] ?? 0;
  const ry = s.root?.[1] ?? 0;
  let r = rot;
  const arm = (side: "F" | "B", a: ArmSpec | undefined): void => {
    if (a === undefined) return;
    const up = side === "F" ? BONE.armFup : BONE.armBup;
    const lo = side === "F" ? BONE.armFlo : BONE.armBlo;
    const hand = side === "F" ? BONE.handF : BONE.handB;
    if ("at" in a || "dir" in a) {
      let target: P2;
      if ("at" in a) target = a.at;
      else {
        const sh = frames(model, r, rx, ry)[up]!;
        const L = Math.hypot(model.def.bones[lo]!.x, model.def.bones[lo]!.y) + Math.hypot(model.def.bones[hand]!.x, model.def.bones[hand]!.y);
        const d = (a.dir * Math.PI) / 180;
        target = [sh.e + Math.cos(d) * a.reach * L, sh.f + Math.sin(d) * a.reach * L];
      }
      r = twoBone(model, r, rx, ry, up, lo, hand, target[0], target[1]).rot;
      if (prev !== undefined) r[up] = wrapNear(r[up]!, prev[up]!);
    } else {
      r[up] = a.up;
      r[lo] = a.lo;
    }
    const wa = worldAngles(model, r);
    if (a.aim !== undefined && (a.hand === undefined)) r[hand] = a.aim - (a.grip ?? GRIP_ROT) - wa[lo]!;
    else r[hand] = a.hand ?? 0;
  };
  const leg = (side: "F" | "B", l: LegSpec | undefined): void => {
    if (l === undefined) return;
    const up = side === "F" ? BONE.legFup : BONE.legBup;
    const lo = side === "F" ? BONE.legFlo : BONE.legBlo;
    const foot = side === "F" ? BONE.footF : BONE.footB;
    if ("at" in l) {
      const [x, y] = typeof l.at === "number" ? [l.at, -ANKLE] : l.at;
      r = twoBone(model, r, rx, ry, up, lo, foot, x, y).rot;
      const wa = worldAngles(model, r);
      r[foot] = (l.foot ?? 0) - wa[lo]!;
    } else {
      r[up] = l.up;
      r[lo] = l.lo;
      r[foot] = l.foot ?? 0;
    }
  };
  // legs first (they do not depend on the arms), then arms
  leg("F", s.legF);
  leg("B", s.legB);
  arm("F", s.F);
  arm("B", s.B);
  if (s.item !== undefined) {
    const wa = worldAngles(model, r);
    r[BONE.held] = s.item - GRIP_ROT - wa[BONE.handF]!;
  }
  return r;
}

/** Builds a clip from timed specs. Each spec inherits what it leaves out from the one before. */
export function clip(duration: number, loop: boolean, events: Clip["events"], specs: readonly (readonly [number, Spec])[],
  extra: { lag?: Record<string, number>; plant?: readonly string[]; stepped?: number; stride?: Stride } = {}): StrideClip {
  const keys: Key[] = [];
  let carry: Spec = {};
  let prev: number[] | undefined;
  specs.forEach(([t, spec], i) => {
    carry = { ...carry, ...spec };
    if (spec.ease === undefined) delete carry.ease;
    let rot = solve(carry, prev);
    if (prev !== undefined) rot = rot.map((v, j) => wrapNear(v, prev![j]!));
    if (loop && i === specs.length - 1 && keys.length > 0) rot = [...(keys[0]!.rot ? Object.values(keys[0]!.rot) : rot)];
    prev = rot;
    const rec: Record<string, number> = {};
    model.def.bones.forEach((b, j) => { rec[b.id] = Math.round(rot[j]! * 1000) / 1000; });
    const key: Key = { t, rot: rec, root: [carry.root?.[0] ?? 0, carry.root?.[1] ?? 0] };
    const withScale: Key = { ...key, scale: spec.scale ?? [1, 1] };
    const withFace: Key = carry.face !== undefined ? { ...withScale, face: carry.face } : withScale;
    keys.push(spec.ease !== undefined ? { ...withFace, ease: spec.ease } : withFace);
  });
  const out: Clip = { duration, loop, events, keys };
  return { ...out, ...(extra.lag ? { lag: extra.lag } : {}), ...(extra.plant ? { plant: extra.plant } : {}), ...(extra.stepped ? { stepped: extra.stepped } : {}),
    ...(extra.stride ? { stride: extra.stride } : {}) };
}

/** Both feet stay where they stood at the clip's start. */
export const BOTH_FEET = ["footB", "footF"] as const;

/** The fighting stance every one-shot clip starts from and returns to. */
export const STANCE: Spec = {
  root: [-1, 3.4], pelvis: 0, torso: 9, head: -6, held: 0,
  legF: { at: 11 }, legB: { at: -12 },
  F: { at: [12, -52], aim: -84 }, B: { up: 7, lo: -140, hand: 0 },
  face: "neutral",
};

/** For tests: the figure-space joints of a spec. */
export function jointsOf(s: Spec): [number, number][] {
  const r = solve(s);
  return frames(model, r, s.root?.[0] ?? 0, s.root?.[1] ?? 0).map((f) => [f.e, f.f]);
}

/**
 * Standing on part of the foot (movement pass). The sole's bottom corners in the foot bone's
 * frame (`SOLE` in gate/parts/clothes.ts, both shoes): the toe a foot pushes off from and the
 * heel a backward step rolls onto. `onToe(x, foot)` and `onHeel` are the ankle target that puts
 * that corner on the floor at figure x with the foot at world angle `foot` (positive = heel up).
 */
export const TOE: P2 = [22.2 * K, 7.6 * K];
export const HEEL: P2 = [-7 * K, 7.6 * K];
function standOn(p: P2, x: number, foot: number): LegSpec {
  const r = (foot * Math.PI) / 180;
  const dx = Math.cos(r) * p[0] - Math.sin(r) * p[1];
  const dy = Math.sin(r) * p[0] + Math.cos(r) * p[1];
  return { at: [x - dx, -dy], foot };
}
export const onToe = (x: number, foot: number): LegSpec => standOn(TOE, x, foot);
export const onHeel = (x: number, foot: number): LegSpec => standOn(HEEL, x, foot);
/** A value that runs round a loop of `d` ms through `[t, v]` points, straight between them. */
export function cyc(d: number, pts: readonly (readonly [number, number])[], t: number): number {
  const u = ((t % d) + d) % d;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const tb = b[0] <= a[0] ? b[0] + d : b[0];
    const uu = u < a[0] ? u + d : u;
    if (uu >= a[0] && uu <= tb) return a[1] + (b[1] - a[1]) * ((uu - a[0]) / (tb - a[0] || 1));
  }
  return pts[0]![1];
}
