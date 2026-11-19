/**
 * Shared part makers for the scrapper looks. Source drawings are in the style sampler's 182-unit
 * space and are mapped into each bone's own frame here (`K`). A limb shape is made once and
 * given to both sides (front and back bones).
 */
import type { ColourSlot, Shape } from "../../contracts";
import { K, PROPORTION } from "../skeleton";
import type { Poly, Pt } from "../vocab";
import { dPoly, inkLine, limb, scalePoly } from "../vocab";

export type Side = "F" | "B";
export const SIDES: readonly Side[] = ["B", "F"];

/** z of each bone's outline group (integer part) and order inside it (fraction). Back limbs are
 *  under the body, front limbs over it; a hand is over its forearm and over the held item. */
export const Z = {
  legBup: 10, legBlo: 10.1, footB: 11, armBup: 20, armBlo: 20.1, handB: 22, heldB: 21,
  pelvis: 30, torso: 31, head: 40,
  legFup: 50, legFlo: 50.1, footF: 51, armFup: 60, armFlo: 60.1, heldF: 61, handF: 62,
} as const;

export function shape(bone: string, poly: Poly, slot: ColourSlot, z: number, shade?: Poly): Shape {
  return shade === undefined ? { bone, d: dPoly(poly), slot, z } : { bone, d: dPoly(poly), slot, z, shade: dPoly(shade) };
}
/** An ink detail (a seam, a brow, a knuckle line): filled, no outline, no shadow. */
export function ink(bone: string, pts: Poly, w: number, z: number, taper = true): Shape {
  return { bone, d: dPoly(inkLine(pts, w, taper)), slot: "ink", z };
}

/** Sampler point to head-bone frame. The head bone starts at the neck base; the neck is 3.68 long. */
export const NECK_LEN = 8 * K;
const PIV: Pt = [-2.5, -1.5];
export const hd = (q: Pt): Pt => [(q[0] - PIV[0]) * K, -NECK_LEN + (q[1] - PIV[1]) * K];
export const hdPoly = (pts: Poly): Pt[] => pts.map(hd);
/** Sampler point (hip origin) to torso / pelvis frame. */
export const tr = (q: Pt): Pt => [q[0] * K, q[1] * K];
export const trPoly = (pts: Poly): Pt[] => pts.map(tr);

/** Sampler width profiles `[t, front, back]` (half-widths, sampler units). */
export const PROF = {
  UA: [[0, 6.2, 6.0], [0.22, 6.1, 5.6], [0.5, 5.3, 4.6], [0.82, 4.1, 3.8], [1, 3.7, 3.5]],
  FA: [[0, 4.0, 3.7], [0.22, 4.9, 4.2], [0.55, 3.8, 3.3], [0.88, 2.8, 2.5], [1, 2.6, 2.4]],
  UAbare: [[0, 6.6, 6.2], [0.2, 6.9, 5.9], [0.45, 6.0, 4.8], [0.8, 4.3, 3.8], [1, 3.8, 3.5]],
  FAbare: [[0, 4.1, 3.8], [0.2, 5.4, 4.4], [0.5, 4.2, 3.5], [0.88, 2.9, 2.5], [1, 2.6, 2.4]],
  TH: [[0, 9.4, 9.8], [0.35, 9.2, 9.0], [0.8, 7.8, 7.6], [1, 7.2, 7.0]],
  SH: [[0, 7.0, 7.0], [0.25, 6.6, 7.6], [0.55, 5.8, 6.4], [0.9, 5.4, 5.2], [1, 5.8, 5.6]],
} as const satisfies Record<string, readonly (readonly [number, number, number])[]>;

type Prof = readonly (readonly [number, number, number])[];
const plus = (p: Prof, add: number): Prof => p.map(([t, a, b]) => [t, a + add, b + add] as const);

/** Limb pieces end in full round caps (half circles of the piece's width at that end, not
 *  flattened), so where two pieces meet at a joint each covers a whole disc round the pin and
 *  no bend opens a notch between them (owner, 16 Nov 2026: "Dislocation of arms"). */
const JOINT_ENDS = 9;
/** An upper arm (`up`) or forearm (`lo`) shape: a sleeve (`top`) or bare (`skin`). */
export function armPart(side: Side, part: "up" | "lo", sleeve: boolean): Pt[] {
  const len = part === "up" ? PROPORTION.upperArm : PROPORTION.forearm;
  const prof = sleeve ? plus(part === "up" ? PROF.UA : PROF.FA, 0.9) : part === "up" ? PROF.UAbare : PROF.FAbare;
  void side;
  return limb(len, prof, K, JOINT_ENDS, 1);
}
export function legPart(part: "up" | "lo", extra = 0): Pt[] {
  const len = part === "up" ? PROPORTION.thigh : PROPORTION.shin;
  return limb(len, plus(part === "up" ? PROF.TH : PROF.SH, extra), K, JOINT_ENDS, 1);
}

/** Points along a limb's own length: x across (front +), t along (0 joint, 1 far end). */
export function along(len: number, pts: readonly (readonly [number, number])[]): Pt[] {
  return pts.map(([x, t]) => [x, t * len] as Pt);
}

export { scalePoly };
