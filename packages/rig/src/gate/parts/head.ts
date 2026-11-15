/**
 * Heads, hair, faces and accessories: two complete looks. An angular adult head with a real
 * nose, brow, jaw and ear (style 13). All on the `head` bone; the neck is part of the head piece
 * and the head turns on the neck base.
 */
import type { FaceId, Shape } from "../../contracts";
import type { Poly, Pt } from "../vocab";
import { limb } from "../vocab";
import { HAIR_PIVOT } from "../skeleton";
import { NECK_LEN, hd, hdPoly, ink, shape } from "./kit";

export const HEAD_A: Poly = [[7.5, 0.6], [1.5, -0.9], [-2, -4.0], [-6, -2.6], [-9.5, -7.5], [-10.2, -13], [-8.5, -19], [-3.5, -23], [3, -23], [7.3, -20.2], [9, -16.6], [9.6, -13.7], [8.9, -12.3], [9.6, -10.9], [12.0, -7.5], [10.2, -6.5], [10.4, -5.2], [9.7, -4.4], [10.2, -3.3], [9.8, -1.4]];
// a heavier, squarer jaw and a flatter brow ridge
const HEAD_B: Poly = [[8.2, 1.2], [1.4, 0.2], [-2.6, -3.0], [-7.0, -2.0], [-10.2, -7.2], [-10.8, -13], [-9.0, -19.2], [-3.6, -23.2], [3.2, -23.2], [7.6, -20.6], [9.4, -17.2], [10.2, -14.2], [9.6, -12.6], [10.2, -11.2], [12.4, -7.8], [10.6, -6.8], [10.8, -5.4], [10.1, -4.6], [10.8, -3.4], [10.6, -0.6]];

const HAIR_A: Poly = [[8.4, -18.6], [8.6, -22.4], [4.5, -25.4], [-2.5, -25.6], [-8.6, -22.4], [-10.9, -16.5], [-10.8, -10.8], [-9.6, -8.4], [-7.2, -9.6], [-6.4, -14.6], [-3.4, -18.4], [2.5, -19.6]];
const HAIR_B: Poly = [[7.8, -20.0], [3.4, -23.8], [-3.8, -24.0], [-9.0, -19.6], [-10.6, -13.2], [-8.8, -12.2], [-7.6, -16.8], [-2.4, -20.8], [4.6, -21.4]];
const BEARD: Poly = [[10.4, -3.6], [10.3, -1.0], [7.8, 1.4], [1.6, -0.2], [-2.4, -3.8], [-2.9, -9.0], [-0.8, -8.6], [1.4, -4.8], [5.0, -3.6], [7.4, -5.6], [9.2, -5.8]];

export const F = {
  eyeOpen: [[5.0, -12.2], [6.4, -12.9], [7.9, -12.3], [6.5, -11.6]] as Poly,
  eyeWide: [[4.8, -12.3], [6.4, -13.4], [8.0, -12.4], [6.5, -11.3]] as Poly,
  lid: [[4.6, -12.3], [6.4, -13.3], [8.2, -12.5]] as Poly,
  lidLow: [[4.6, -12.0], [6.4, -12.5], [8.2, -12.0]] as Poly,
  eyeShut: [[4.8, -11.9], [6.5, -12.6], [8.1, -11.8]] as Poly,
  shutCrease: [[5.2, -11.0], [7.8, -10.9]] as Poly,
  browAngry: [[3.4, -15.2], [6.5, -14.8], [9.6, -13.2], [9.4, -12.4], [6.2, -13.7], [3.6, -14.2]] as Poly,
  browUp: [[3.4, -16.0], [6.5, -16.0], [9.6, -14.4], [9.4, -13.6], [6.2, -14.9], [3.6, -15.0]] as Poly,
  browFlat: [[3.4, -14.9], [6.6, -15.0], [9.5, -14.0], [9.4, -13.3], [6.4, -14.1], [3.6, -14.0]] as Poly,
  browPain: [[3.6, -14.0], [6.8, -15.4], [9.4, -14.8], [9.3, -14.0], [6.6, -14.4], [3.8, -13.2]] as Poly,
  nostril: [[8.8, -7.4], [10.0, -6.8]] as Poly,
  cheek: [[5.0, -9.8], [7.8, -8.4]] as Poly,
  naso: [[8.3, -7.4], [8.1, -4.9]] as Poly,
  mouthLine: [[7.4, -4.3], [8.8, -4.6], [10.2, -4.4]] as Poly,
  mouthSnarl: [[7.5, -5.4], [10.5, -5.6], [10.1, -2.9], [7.9, -3.4]] as Poly,
  teethSnarl: [[7.8, -5.2], [10.4, -5.3], [10.3, -4.5], [7.9, -4.5]] as Poly,
  mouthShout: [[7.2, -5.6], [10.7, -6.0], [10.6, -1.6], [8.0, -1.4], [7.0, -3.2]] as Poly,
  teethShout: [[7.5, -5.5], [10.5, -5.8], [10.5, -5.0], [7.6, -4.8]] as Poly,
  mouthPain: [[7.2, -5.0], [10.5, -5.9], [10.4, -3.4], [7.5, -4.0]] as Poly,
  teethPain: [[7.5, -4.9], [10.4, -5.7], [10.4, -5.0], [7.6, -4.4]] as Poly,
  mouthGrin: [[7.0, -5.2], [8.8, -4.6], [10.6, -5.6], [10.2, -3.6], [8.4, -3.0], [7.2, -4.0]] as Poly,
  teethGrin: [[7.3, -5.0], [8.8, -4.4], [10.4, -5.4], [10.3, -4.6], [8.7, -3.9], [7.4, -4.4]] as Poly,
  ear: [[-1.2, -12.8], [-3.6, -13.5], [-5.0, -10.6], [-3.9, -7.6], [-1.5, -8.3]] as Poly,
  earIn: [[-2.0, -11.8], [-3.6, -11.2], [-3.1, -9.2]] as Poly,
  jaw: [[1.4, -1.2], [-1.6, -4.2], [-2.0, -7.2]] as Poly,
  cheekbone: [[1.0, -10.6], [3.0, -9.0]] as Poly,
};

const B = "head";
const W = 0.42;     // a fine ink line inside the face, in units
const poly = (pts: Poly): Pt[] => hdPoly(pts);
const line = (pts: Poly, w = W, z = 42.2): Shape => ink(B, hdPoly(pts), w, z);

function neck(wide: number): Pt[] {
  // the neck goes up from the neck base: a limb turned upside down, sunk into the head a little
  const n = limb(NECK_LEN + 1.2, [[0, 1.9 * wide, 2.0 * wide], [1, 1.5 * wide, 1.55 * wide]], 1, 3);
  return n.map(([x, y]) => [x + 0.15, -y] as Pt);
}

export function head(outline: Poly, wide: number): Shape[] {
  const jawShade: Poly = [[1.5, -0.9], [-2, -4.0], [-6, -2.6], [-6.4, -5.2], [-2.0, -6.8], [1.6, -3.2]];
  return [
    shape(B, neck(wide), "skin", 40),
    shape(B, poly(outline), "skin", 40.05, poly(jawShade)),
    shape(B, poly(F.ear), "skin", 41),
    line(F.earIn, 0.34, 41.1),
  ];
}
export const HEADS: readonly Shape[][] = [head(HEAD_A, 1), head(HEAD_B, 1.32)];

/** Hair hangs on its own bone from the crown (secondary motion): head-frame points moved into it. */
const toHair = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [x - HAIR_PIVOT[0], y - HAIR_PIVOT[1]] as Pt);
export function hair(outline: Poly, strands: readonly Poly[]): Shape[] {
  return [shape("hair", toHair(poly(outline)), "hair", 44),
    ...strands.map((s) => ({ ...ink("hair", toHair(hdPoly(s)), 0.3, 44.1) }))];
}
export const HAIR: readonly Shape[][] = [
  hair(HAIR_A, [[[6.0, -22.4], [1.0, -23.6], [-4.4, -22.2]], [[-6.6, -20.4], [-8.6, -15.6]]]),
  hair(HAIR_B, [[[4.4, -22.2], [-1.6, -22.6]]]),
];

export function faceSet(heavy: number): Record<FaceId, Shape[]> {
  const common = (): Shape[] => [line(F.jaw, 0.36), line(F.naso, W), line(F.nostril, W), line(F.cheekbone, 0.3)];
  const eye = (pts: Poly): Shape => shape(B, poly(pts), "ink", 42.3);
  const brow = (pts: Poly): Shape => shape(B, poly(pts.map(([x, y]) => [x, y - (heavy - 1) * 0.4] as Pt)), "ink", 42.6);
  const mouth = (m: Poly, t?: Poly): Shape[] => (t === undefined ? [shape(B, poly(m), "ink", 42.4)]
    : [shape(B, poly(m), "ink", 42.4), shape(B, poly(t), "white", 42.5)]);
  return {
    neutral: [...common(), eye(F.eyeOpen), line(F.lid, 0.5), brow(F.browFlat), line(F.mouthLine, 0.55), line(F.cheek, 0.3)],
    grit: [...common(), eye(F.eyeOpen), line(F.lid, 0.55), brow(F.browAngry), ...mouth(F.mouthSnarl, F.teethSnarl), line(F.cheek, 0.34)],
    shout: [...common(), eye(F.eyeWide), line(F.lid, 0.5), brow(F.browUp), ...mouth(F.mouthShout, F.teethShout), line(F.cheek, 0.34)],
    dazed: [...common(), line(F.eyeShut, 0.6), line(F.shutCrease, 0.34), brow(F.browPain), ...mouth(F.mouthPain, F.teethPain)],
    grin: [...common(), eye(F.eyeOpen), line(F.lidLow, 0.6), brow(F.browFlat), ...mouth(F.mouthGrin, F.teethGrin), line(F.cheek, 0.4)],
  };
}
export const FACES: readonly Record<FaceId, Shape[]>[] = [faceSet(1), faceSet(1.6)];

/** Accessories: none, and a full beard. */
export const ACCESSORIES: readonly Shape[][] = [[], [shape(B, poly(BEARD), "hair", 43), line([[9.6, -2.6], [7.8, -1.6]], 0.3, 43.1)]];

/** The head's point used as the "head" hit point, in the head bone's frame. */
export const HEAD_CENTRE: Pt = hd([1.2, -11.5]);
