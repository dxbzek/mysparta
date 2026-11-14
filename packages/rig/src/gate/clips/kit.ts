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
import { frames, modelOf, worldAngles } from "../../engine/pose";
import { BONE, GRIP_ROT, PROPORTION, SCRAPPER_RIG } from "../skeleton";

const model = modelOf(SCRAPPER_RIG);
type P2 = readonly [number, number];

/** An arm: a wrist target (IK), or the three angles. `aim` is the world angle of the held item
 *  (0 = forward, -90 = straight up); it sets the hand, for an item whose `grip.rot` is `grip`
 *  (default `GRIP_ROT`, the Pipe's). With `release`, the hand keeps `hand` and
 *  the item turns away from it by `held` degrees: the grip lets go. */
export type ArmSpec =
  | { at: P2; aim?: number; hand?: number; grip?: number }
  | { up: number; lo: number; hand?: number; aim?: number; grip?: number };
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
  const rx = s.root?.[0] ?? 0;
  const ry = s.root?.[1] ?? 0;
  let r = rot;
  const arm = (side: "F" | "B", a: ArmSpec | undefined): void => {
    if (a === undefined) return;
    const up = side === "F" ? BONE.armFup : BONE.armBup;
    const lo = side === "F" ? BONE.armFlo : BONE.armBlo;
    const hand = side === "F" ? BONE.handF : BONE.handB;
    if ("at" in a) {
      r = twoBone(model, r, rx, ry, up, lo, hand, a.at[0], a.at[1]).rot;
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
  extra: { lag?: Record<string, number>; plant?: readonly string[]; stepped?: number } = {}): Clip {
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
  return { ...out, ...(extra.lag ? { lag: extra.lag } : {}), ...(extra.plant ? { plant: extra.plant } : {}), ...(extra.stepped ? { stepped: extra.stepped } : {}) };
}

/** Both feet stay where they stood at the clip's start. */
export const BOTH_FEET = ["footB", "footF"] as const;

/** The fighting stance every one-shot clip starts from and returns to. */
export const STANCE: Spec = {
  root: [-1, 3.4], pelvis: 0, torso: 9, head: -6, held: 0,
  legF: { at: 11 }, legB: { at: -12 },
  F: { at: [12, -52], aim: -84 }, B: { at: [7.5, -56.5] },
  face: "neutral",
};

/** For tests: the figure-space joints of a spec. */
export function jointsOf(s: Spec): [number, number][] {
  const r = solve(s);
  return frames(model, r, s.root?.[0] ?? 0, s.root?.[1] ?? 0).map((f) => [f.e, f.f]);
}
