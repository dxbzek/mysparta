/**
 * The content pack's appearance set: the full LOOK_SPACE (owner review, 15 Nov 2026: "rivals look
 * like duplicates", only about two of each part were drawn). The gate pack's two looks come first
 * (the contract: the content set re-uses the gate parts as its first entries), then the rest, all
 * in style 13: adult proportions, angular heads with a real nose, brow and jaw, plain street and
 * work clothes under the sodium light. Nothing cute, chunky or costume-like.
 *
 *   builds 3       lean, stocky, tall (the gate's)
 *   heads 6        + hawk-nosed and lean, broad with a flat nose, gaunt and long, square and thick-necked
 *   hair 10        + bald, buzz cut, mohawk, slicked back to the collar, tied in a bun, big curls,
 *                    side part with a fringe, short twists
 *   faces 8        + squint, scarred brow, lined, wide-eyed and thin-browed, squint and scar, broken nose
 *   tops 8         + tee, hoodie, track top, flannel shirt, leather jacket, long work coat
 *   bottoms 5      + track pants, shorts, work trousers with knee patches
 *   shoes 4        + high-tops, low work shoes with a toe cap
 *   accessories 6  + goatee, moustache, headband, a plaster across the nose
 *   skin 8, hair colours 8, palettes 12 (gate/style.ts)
 */
import type { AppearanceSet, FaceId, Shape } from "../../contracts";
import { BUILDS, K, PROPORTION } from "../../gate/skeleton";
import { HAIR_COLOUR, HAIR_COLOUR_MORE, PALETTES, PALETTES_MORE, SKIN, SKIN_MORE } from "../../gate/style";
import type { Poly, Pt } from "../../gate/vocab";
import { ellipsePoly, limb } from "../../gate/vocab";
import { FOOT, PELVIS, SOLE, TORSO, fk } from "../../gate/parts/clothes";
import { BOTTOMS, SHOES, TOPS } from "../../gate/parts/clothes";
import { HANDS } from "../../gate/parts/hands";
import { ACCESSORIES, F, FACES, HAIR, HEADS, head, hair } from "../../gate/parts/head";
import type { Side } from "../../gate/parts/kit";
import { PROF, SIDES, Z, armPart, hdPoly, ink, legPart, shape, trPoly } from "../../gate/parts/kit";

type Prof = readonly (readonly [number, number, number])[];
const plus = (p: Prof, add: number): Prof => p.map(([t, a, b]) => [t, a + add, b + add] as const);
const JOINT_ENDS = 9;
const up = (s: Side): string => `arm${s}.up`;
const lo = (s: Side): string => `arm${s}.lo`;
const zArm = (s: Side, part: "up" | "lo"): number => (s === "F" ? (part === "up" ? Z.armFup : Z.armFlo) : (part === "up" ? Z.armBup : Z.armBlo));
const zLeg = (s: Side, part: "up" | "lo"): number => (s === "F" ? (part === "up" ? Z.legFup : Z.legFlo) : (part === "up" ? Z.legBup : Z.legBlo));
const zFoot = (s: Side): number => (s === "F" ? Z.footF : Z.footB);
const UA = PROPORTION.upperArm;
const FA = PROPORTION.forearm;
const T = PROPORTION.thigh;
const SH = PROPORTION.shin;

// ------------------------------------------------------------------------------------ heads
// Each outline keeps the gate head's 20 landmarks in order (chin, under-jaw, jaw angle, neck back,
// nape, back of the skull, crown, forehead, brow, nose root, bridge, tip, under the nose, lips,
// chin front), so the faces' eyes, brows and mouths sit on every head.
const HEAD_C: Poly = [[7.2, 1.2], [1.4, -0.4], [-1.8, -3.8], [-5.6, -2.4], [-9.0, -7.6], [-9.8, -13], [-8.2, -19.2], [-3.4, -23.4], [3, -23.4], [7.2, -20.6], [8.8, -16.8], [9.6, -13.8], [9.0, -12.3], [10.6, -10.4], [12.6, -7.6], [10.2, -6.6], [10.3, -5.2], [9.6, -4.4], [10.0, -3.2], [9.6, -0.8]];
const HEAD_D: Poly = [[8.4, 0.8], [1.0, 0.2], [-3.0, -3.2], [-7.4, -1.8], [-10.8, -7.0], [-11.4, -13], [-9.6, -19.4], [-4.0, -23.0], [3.2, -23.0], [7.8, -20.4], [9.6, -17.2], [10.4, -14.2], [9.2, -12.4], [9.8, -10.8], [11.4, -8.0], [11.0, -6.6], [10.6, -5.4], [9.9, -4.5], [10.6, -3.3], [10.6, -0.8]];
const HEAD_E: Poly = [[8.0, 0.4], [2.4, -0.6], [-1.4, -4.6], [-5.6, -3.0], [-9.2, -8.0], [-10.0, -13.4], [-8.6, -19.6], [-3.4, -24.0], [3.2, -24.0], [7.4, -21.0], [9.0, -17.0], [9.8, -13.8], [8.8, -12.2], [9.4, -10.8], [11.6, -7.4], [10.0, -6.6], [10.2, -5.2], [9.4, -4.4], [9.8, -3.2], [9.0, -1.2]];
const HEAD_F: Poly = [[8.6, 1.4], [1.6, 0.6], [-2.8, -2.6], [-7.6, -1.4], [-10.6, -7.0], [-10.8, -13.4], [-9.8, -19.6], [-5.0, -22.6], [3.4, -22.8], [7.8, -20.8], [9.4, -17.4], [10.2, -14.0], [9.4, -12.4], [10.0, -10.8], [11.6, -8.2], [10.6, -6.8], [10.8, -5.4], [10.1, -4.6], [10.8, -3.4], [10.8, -0.4]];
const B = "head";
const line = (pts: Poly, w = 0.42, z = 42.2): Shape => ink(B, hdPoly(pts), w, z);
export const LOOK_HEADS: readonly Shape[][] = [
  ...HEADS,
  [...head(HEAD_C, 0.95), line([[1.2, -10.4], [3.4, -8.4]], 0.32)],                    // hawk-nosed, lean: a hollow under the cheekbone
  [...head(HEAD_D, 1.3), line([[3.6, -15.4], [8.6, -15.2]], 0.36, 42.15)],              // broad: a heavy brow ridge
  [...head(HEAD_E, 0.92), line([[0.6, -9.6], [2.6, -6.2]], 0.34), line([[2.2, -1.6], [4.6, -2.2]], 0.28)],   // gaunt, long: cheek and chin creases
  [...head(HEAD_F, 1.45)],                                                               // square, thick-necked
];

// ------------------------------------------------------------------------------------- hair
const ell = (cx: number, cy: number, rx: number, ry: number): Poly => ellipsePoly(cx, cy, rx, ry, 14);
/** A hanging lock from (x, y0) to y1, `w` wide. */
const lock = (x: number, y0: number, y1: number, w: number): Poly => [[x - w / 2, y0], [x + w / 2, y0], [x + w / 2 - 0.5, y1], [x - w / 2 - 0.3, y1 + 0.4]];
export const LOOK_HAIR: readonly Shape[][] = [
  ...HAIR,
  [],                                                                                    // bald
  hair([[8.0, -19.8], [3.2, -23.6], [-3.6, -23.8], [-8.8, -19.6], [-10.6, -13.6], [-10.0, -10.6], [-8.8, -11.0], [-8.6, -14.6], [-6.6, -18.8], [-2.4, -21.9], [3.4, -22.1], [7.2, -19.2]], []),   // buzz cut
  hair([[6.4, -21.6], [5.8, -26.6], [2.6, -28.4], [-2.4, -28.2], [-6.8, -25.8], [-9.4, -21.6], [-8.0, -20.6], [-4.6, -22.6], [0.4, -23.2], [4.6, -22.4]],
    [[[3.4, -26.6], [-1.0, -26.8]], [[-3.4, -26.0], [-6.6, -23.6]]]),                   // mohawk, the sides shaved
  hair([[8.0, -20.0], [6.6, -23.8], [1.0, -25.4], [-5.4, -24.4], [-9.8, -20.0], [-11.6, -13.4], [-11.4, -6.0], [-9.8, -3.4], [-7.4, -4.6], [-7.6, -9.4], [-6.6, -14.4], [-3.4, -19.0], [2.8, -21.0]],
    [[[5.6, -22.8], [-1.6, -23.6], [-7.6, -20.4]], [[-9.0, -15.6], [-9.6, -8.0]]]),      // slicked back to the collar
  [...hair([[8.2, -19.4], [7.6, -22.8], [3.0, -24.8], [-3.6, -24.8], [-8.6, -21.4], [-10.4, -15.6], [-9.4, -12.0], [-7.6, -13.6], [-6.0, -17.4], [-2.2, -20.2], [3.4, -21.2]],
    [[[5.0, -22.6], [-2.0, -23.4], [-8.0, -20.6]]]),
  ...hair(ell(-11.0, -20.4, 2.6, 2.3), [])],                                              // tied back in a bun
  hair([[9.0, -17.0], [9.8, -22.0], [7.2, -27.0], [1.4, -29.2], [-5.4, -28.4], [-10.6, -24.6], [-12.6, -18.0], [-12.2, -11.4], [-10.0, -8.4], [-7.6, -9.6], [-6.8, -14.0], [-3.6, -18.6], [2.6, -19.8], [7.4, -18.4]],
    [[[4.0, -26.0], [2.0, -25.0]], [[-2.6, -26.6], [-4.6, -25.2]], [[-8.6, -22.0], [-9.8, -19.6]], [[-10.2, -14.6], [-10.6, -12.4]]]),   // big curls
  hair([[9.4, -16.4], [9.0, -21.6], [5.2, -24.6], [-2.0, -25.0], [-8.4, -22.0], [-10.6, -16.4], [-10.4, -11.0], [-9.0, -9.0], [-7.4, -10.2], [-6.6, -14.8], [-2.6, -18.4], [3.4, -19.0], [7.0, -17.4]],
    [[[2.6, -24.2], [6.6, -21.4], [8.8, -17.6]], [[-3.0, -23.6], [-8.2, -19.4]]]),       // side part, a fringe over the brow
  [...hair([[8.0, -19.2], [7.6, -23.0], [3.0, -25.6], [-3.6, -25.6], [-9.0, -22.0], [-10.8, -16.6], [-9.0, -15.0], [-6.6, -18.4], [-2.0, -20.6], [3.6, -21.0]], []),
  ...[-10.2, -8.4, -6.4].flatMap((x, i) => hair(lock(x, -17.5 + i * 1.2, -8.6 + i * 0.6, 1.3), []))],   // short twists
];

// ------------------------------------------------------------------------------------ faces
interface FaceOpts { heavy: number; eye?: number; scar?: boolean; lines?: boolean; broken?: boolean }
const EYE_C: Pt = [6.4, -12.3];
const eyeK = (pts: Poly, k: number): Poly => pts.map(([x, y]) => [x, EYE_C[1] + (y - EYE_C[1]) * k] as Pt);
function faceSet(o: FaceOpts): Record<FaceId, Shape[]> {
  const W = 0.42;
  const k = o.eye ?? 1;
  const extra: Shape[] = [];
  if (o.scar === true) extra.push(line([[4.2, -17.6], [5.6, -14.8], [6.2, -13.6]], 0.3, 42.7), line([[7.6, -9.6], [8.6, -7.8]], 0.26, 42.7));
  if (o.lines === true) extra.push(line([[2.6, -18.4], [7.4, -18.0]], 0.26), line([[2.8, -19.6], [6.8, -19.4]], 0.22), line([[7.6, -7.2], [7.2, -4.2]], 0.34));
  if (o.broken === true) extra.push(line([[9.6, -11.2], [10.4, -10.0], [10.0, -9.2]], 0.32));
  const common = (): Shape[] => [line(F.jaw, 0.36), line(F.naso, W), line(F.nostril, W), line(F.cheekbone, 0.3), ...extra];
  const eye = (pts: Poly): Shape => shape(B, hdPoly(eyeK(pts, k)), "ink", 42.3);
  const lid = (pts: Poly, w: number): Shape => line(eyeK(pts, k), w);
  const brow = (pts: Poly): Shape => shape(B, hdPoly(pts.map(([x, y]) => [x, y - (o.heavy - 1) * 0.4] as Pt).map(([x, y]) => [x, y + (y - -14.5) * (o.heavy - 1) * 0.6] as Pt)), "ink", 42.6);
  const mouth = (m: Poly, t?: Poly): Shape[] => (t === undefined ? [shape(B, hdPoly(m), "ink", 42.4)]
    : [shape(B, hdPoly(m), "ink", 42.4), shape(B, hdPoly(t), "white", 42.5)]);
  return {
    neutral: [...common(), eye(F.eyeOpen), lid(F.lid, 0.5), brow(F.browFlat), line(F.mouthLine, 0.55), line(F.cheek, 0.3)],
    grit: [...common(), eye(F.eyeOpen), lid(F.lid, 0.55), brow(F.browAngry), ...mouth(F.mouthSnarl, F.teethSnarl), line(F.cheek, 0.34)],
    shout: [...common(), eye(F.eyeWide), lid(F.lid, 0.5), brow(F.browUp), ...mouth(F.mouthShout, F.teethShout), line(F.cheek, 0.34)],
    dazed: [...common(), lid(F.eyeShut, 0.6), line(F.shutCrease, 0.34), brow(F.browPain), ...mouth(F.mouthPain, F.teethPain)],
    grin: [...common(), eye(F.eyeOpen), lid(F.lidLow, 0.6), brow(F.browFlat), ...mouth(F.mouthGrin, F.teethGrin), line(F.cheek, 0.4)],
  };
}
export const LOOK_FACES: readonly Record<FaceId, Shape[]>[] = [
  ...FACES,
  faceSet({ heavy: 1.25, eye: 0.62 }),                       // a squint
  faceSet({ heavy: 1, scar: true }),                         // a scar through the brow
  faceSet({ heavy: 1.3, lines: true }),                      // lined: forehead and deep smile lines
  faceSet({ heavy: 0.75, eye: 1.18 }),                       // wide-eyed, thin brows
  faceSet({ heavy: 1.6, eye: 0.62, scar: true }),            // squint and scar
  faceSet({ heavy: 1.1, broken: true, lines: true }),        // a broken nose
];

// ------------------------------------------------------------------------------- accessories
export const LOOK_ACCESSORIES: readonly Shape[][] = [
  ...ACCESSORIES,
  [shape(B, hdPoly([[10.2, -3.2], [10.1, -0.8], [8.0, 1.0], [6.4, 0.2], [7.4, -1.8], [8.6, -3.4]]), "hair", 43)],                 // goatee
  [shape(B, hdPoly([[7.2, -5.1], [10.4, -5.7], [10.7, -4.8], [9.6, -4.3], [7.6, -3.7], [6.6, -4.2]]), "hair", 43)],               // moustache
  [shape(B, hdPoly([[9.3, -15.9], [8.9, -18.2], [3.0, -20.0], [-4.4, -19.8], [-9.6, -16.8], [-10.2, -14.2], [-8.6, -14.6], [-3.6, -17.2], [2.8, -17.6]]), "accent", 44.5),
    shape(B, hdPoly([[-9.6, -16.0], [-13.0, -13.0], [-12.4, -11.8], [-9.8, -14.4]]), "accent", 44.4),
    line([[6.0, -17.4], [-6.0, -17.6]], 0.22, 44.6)],                                                                              // headband, the knot behind
  [shape(B, hdPoly([[9.6, -10.4], [11.6, -9.6], [11.2, -8.5], [9.3, -9.3]]), "white", 42.8),
    line([[10.2, -10.0], [10.6, -8.9]], 0.18, 42.9)],                                                                             // a plaster across the nose
];

// -------------------------------------------------------------------------------------- tops
function sleeves(out: Shape[], s: Side, opts: { bare?: boolean; short?: boolean; stripe?: boolean; cuff?: boolean }): void {
  if (opts.bare === true || opts.short === true) {
    out.push(shape(up(s), armPart(s, "up", false), "skin", zArm(s, "up")));
    out.push(shape(lo(s), armPart(s, "lo", false), "skin", zArm(s, "lo")));
    out.push(ink(lo(s), [[0.9, 1.4], [0.4, 5.6]], 0.26, zArm(s, "lo") + 0.05));
    if (opts.short === true) {
      // a short sleeve over the top half of the upper arm, its hem a straight cut
      const sl = limb(UA * 0.55, plus(PROF.UAbare, 0.8), K, JOINT_ENDS, 1).map(([x, y]) => [x, Math.min(y, UA * 0.55)] as Pt);
      out.push(shape(up(s), sl, "top", zArm(s, "up") + 0.03));
    }
    return;
  }
  out.push(shape(up(s), armPart(s, "up", true), "top", zArm(s, "up")));
  out.push(shape(lo(s), armPart(s, "lo", true), "top", zArm(s, "lo")));
  if (opts.cuff === true) out.push(shape(lo(s), [[-1.9, FA - 1.6], [2.0, FA - 1.6], [2.0, FA + 0.2], [-1.9, FA + 0.2]], "top", zArm(s, "lo") + 0.05));
  if (opts.stripe === true) {
    // two pale stripes down the outside of the sleeve
    out.push(shape(up(s), [[1.5, 0.6], [2.4, 0.6], [1.9, UA - 0.4], [1.1, UA - 0.4]], "accent", zArm(s, "up") + 0.05));
    out.push(shape(lo(s), [[1.4, 0.4], [2.1, 0.4], [1.5, FA - 1.8], [0.9, FA - 1.8]], "accent", zArm(s, "lo") + 0.05));
  }
  out.push(ink(up(s), [[-1.2, UA - 2.2], [0.6, UA - 0.8]], 0.3, zArm(s, "up") + 0.06));
}
const torso = (): Shape => shape("torso", trPoly(TORSO), "top", Z.torso);
const hem = (y: number): Shape => ink("torso", trPoly([[-8.8, y], [9.4, y]]), 0.3, Z.torso + 0.2, false);
function tee(): Shape[] {
  const out = [torso(), shape("torso", trPoly([[-3.4, -55.8], [6.4, -55.6], [3.6, -50.6], [-1.2, -50.8]]), "skin", Z.torso + 0.1),
    ink("torso", trPoly([[-3.8, -55.4], [-1.2, -50.6], [3.6, -50.4], [6.8, -55.2]]), 0.3, Z.torso + 0.2, false),
    ink("torso", trPoly([[-6, -36], [-4.6, -26]]), 0.26, Z.torso + 0.2), hem(-3)];
  for (const s of SIDES) sleeves(out, s, { short: true });
  return out;
}
function hoodie(): Shape[] {
  const out = [torso(),
    shape("torso", trPoly([[-10.4, -48], [-8.4, -56.5], [-2.0, -59.5], [4.0, -57.5], [2.2, -52.5], [-3.6, -50.2], [-7.4, -46]]), "top", Z.torso + 1),   // the hood, bunched at the back of the neck
    ink("torso", trPoly([[-6.2, -52.6], [-2.6, -55.6], [2.0, -56.0]]), 0.28, Z.torso + 1.1),
    ink("torso", trPoly([[-3.6, -18], [8.6, -18], [9.2, -6]]), 0.3, Z.torso + 0.2, false),                            // the pocket
    ink("torso", trPoly([[3.4, -51], [3.8, -42]]), 0.24, Z.torso + 0.2), ink("torso", trPoly([[5.6, -51], [6.2, -43]]), 0.24, Z.torso + 0.2),   // drawstrings
    shape("torso", trPoly([[-9.2, -1.4], [9.4, -1.4], [9.2, 3], [-9, 3]]), "top", Z.torso + 0.15), hem(-1.6)];
  for (const s of SIDES) sleeves(out, s, { cuff: true });
  return out;
}
function trackTop(): Shape[] {
  const out = [torso(),
    shape("torso", trPoly([[-4.6, -56.4], [5.8, -56.6], [6.2, -52.4], [-4.2, -52.0]]), "top", Z.torso + 1),            // the stand collar
    ink("torso", trPoly([[4.6, -52.4], [5.2, -30], [4.8, -3]]), 0.34, Z.torso + 0.2),                                  // the zip
    shape("torso", trPoly([[7.0, -50], [9.6, -47], [9.4, -6], [8.0, -6], [7.8, -44]]), "accent", Z.torso + 0.1), hem(-3)];
  for (const s of SIDES) sleeves(out, s, { stripe: true, cuff: true });
  return out;
}
function flannel(): Shape[] {
  const out = [torso(),
    shape("torso", trPoly([[-1.8, -55.8], [6.6, -55.4], [7.2, -51.2], [2.8, -49.6], [-1.6, -51.4]]), "top", Z.torso + 1),   // the collar
    ink("torso", trPoly([[4.0, -50], [4.4, -4]]), 0.3, Z.torso + 0.2)];
  // the check: dark bands across and down the shirt
  for (const y of [-44, -34, -24, -14]) out.push(shape("torso", trPoly([[-9.6, y], [10.6, y], [10.4, y + 1.6], [-9.6, y + 1.6]]), "accent", Z.torso + 0.1));
  for (const x of [-5, 1, 7]) out.push(shape("torso", trPoly([[x, -52], [x + 1.4, -52], [x + 1.4, -4], [x, -4]]), "accent", Z.torso + 0.1));
  out.push(hem(-3));
  for (const s of SIDES) {
    sleeves(out, s, { cuff: true });
    out.push(shape(up(s), [[-2.4, UA * 0.45], [2.8, UA * 0.45], [2.6, UA * 0.45 + 0.8], [-2.2, UA * 0.45 + 0.8]], "accent", zArm(s, "up") + 0.05));
    out.push(shape(lo(s), [[-2.0, FA * 0.4], [2.2, FA * 0.4], [2.0, FA * 0.4 + 0.7], [-1.8, FA * 0.4 + 0.7]], "accent", zArm(s, "lo") + 0.05));
  }
  return out;
}
function leather(): Shape[] {
  const out = [torso(),
    shape("torso", trPoly([[2.6, -54], [8.0, -50.5], [9.8, -40], [9.2, -25], [9.4, -6], [5.6, -6], [5.0, -30], [3.6, -48]]), "accent", Z.torso + 0.1),   // the shirt in the open front
    shape("torso", trPoly([[-6.4, -56.6], [3.0, -57.2], [7.4, -50.0], [3.4, -42.0], [1.6, -49.4], [-5.2, -51.6]]), "top", Z.torso + 1),                 // the big collar
    ink("torso", trPoly([[3.4, -42], [4.2, -24], [4.0, -6]]), 0.34, Z.torso + 0.2),
    ink("torso", trPoly([[-7.4, -30], [-2.4, -28.4]]), 0.3, Z.torso + 0.2),
    shape("torso", trPoly([[-9.2, -6.2], [9.4, -6.2], [9.4, -3.4], [-9.0, -3.4]]), "top", Z.torso + 0.15), hem(-6.2)];
  for (const s of SIDES) {
    sleeves(out, s, { cuff: true });
    out.push(ink(lo(s), [[1.8, 1.2], [1.2, FA - 3]], 0.26, zArm(s, "lo") + 0.06));   // a sleeve zip
  }
  return out;
}
function coat(): Shape[] {
  const out = [torso(),
    shape("torso", trPoly([[-9.6, -2], [9.6, -2], [11.0, 16], [-10.6, 16]]), "top", Z.torso - 0.5),                     // the skirt, to mid-thigh
    shape("torso", trPoly([[3.0, -54], [8.2, -50.5], [9.6, -38], [5.0, -36], [4.2, -48]]), "accent", Z.torso + 0.1),
    shape("torso", trPoly([[-5.8, -56.6], [3.4, -57.0], [8.0, -49.6], [5.4, -40.0], [3.0, -47.8], [-5.0, -51.2]]), "top", Z.torso + 1),   // lapel
    ink("torso", trPoly([[5.0, -36], [5.4, -2], [5.6, 15]]), 0.3, Z.torso + 0.2),
    ink("torso", trPoly([[-6.8, -14], [-2.4, -14]]), 0.3, Z.torso + 0.2, false),
    ink("torso", trPoly([[-8.8, -3.4], [9.2, -3.4]]), 0.3, Z.torso + 0.2, false)];
  for (const s of SIDES) sleeves(out, s, { cuff: true });
  return out;
}
export const LOOK_TOPS: readonly Shape[][] = [...TOPS, tee(), hoodie(), trackTop(), flannel(), leather(), coat()];

// ----------------------------------------------------------------------------------- bottoms
const pelvis = (): Shape[] => [shape("pelvis", trPoly(PELVIS), "bottom", Z.pelvis),
  shape("pelvis", trPoly([[-10.2, -7.5], [10.4, -7.5], [10.6, -3.8], [-10.4, -3.8]]), "accent", Z.pelvis + 0.1)];
function trackPants(): Shape[] {
  const out = [...pelvis(), ink("pelvis", trPoly([[-10, -4.4], [10.2, -4.4]]), 0.24, Z.pelvis + 0.2, false)];
  for (const s of SIDES) {
    const th = `leg${s}.up`;
    const sh = `leg${s}.lo`;
    out.push(shape(th, legPart("up", 0.5), "bottom", zLeg(s, "up")));
    out.push(shape(sh, legPart("lo", 0.4), "bottom", zLeg(s, "lo")));
    out.push(shape(th, [[3.0, 0.4], [4.0, 0.4], [3.3, T - 0.2], [2.4, T - 0.2]], "accent", zLeg(s, "up") + 0.05));
    out.push(shape(sh, [[2.4, 0.2], [3.2, 0.2], [2.7, SH * 0.85], [2.0, SH * 0.85]], "accent", zLeg(s, "lo") + 0.05));
    out.push(shape(sh, [[-3.0, SH * 0.88], [3.0, SH * 0.88], [3.0, SH + 0.6], [-3.0, SH + 0.6]], "bottom", zLeg(s, "lo") + 0.06));   // the elastic at the ankle
  }
  return out;
}
function shorts(): Shape[] {
  const out = [...pelvis()];
  for (const s of SIDES) {
    const th = `leg${s}.up`;
    const sh = `leg${s}.lo`;
    out.push(shape(th, legPart("up", 0), "skin", zLeg(s, "up")));
    out.push(shape(sh, legPart("lo", 0), "skin", zLeg(s, "lo")));
    out.push(ink(sh, [[2.2, SH * 0.18], [1.4, SH * 0.6]], 0.24, zLeg(s, "lo") + 0.05));   // the shin
    const leg = limb(T * 0.7, plus(PROF.TH, 1.2), K, JOINT_ENDS, 1).map(([x, y]) => [x, Math.min(y, T * 0.7)] as Pt);
    out.push(shape(th, leg, "bottom", zLeg(s, "up") + 0.03));
    out.push(ink(th, [[1.0, T * 0.1], [1.2, T * 0.6]], 0.26, zLeg(s, "up") + 0.05));
  }
  return out;
}
function workTrousers(): Shape[] {
  const out = [...pelvis(), ink("pelvis", trPoly([[-6, -3.6], [-6.6, 4]]), 0.28, Z.pelvis + 0.2)];
  for (const s of SIDES) {
    const th = `leg${s}.up`;
    const sh = `leg${s}.lo`;
    out.push(shape(th, legPart("up", 0.6), "bottom", zLeg(s, "up")));
    out.push(shape(sh, legPart("lo", 0.5), "bottom", zLeg(s, "lo")));
    out.push(shape(sh, [[-2.6, 0.6], [3.4, 0.6], [3.2, SH * 0.3], [-2.4, SH * 0.3]], "accent", zLeg(s, "lo") + 0.05));   // a knee patch
    out.push(ink(th, [[2.6, T * 0.2], [2.4, T * 0.8]], 0.28, zLeg(s, "up") + 0.05));
  }
  return out;
}
export const LOOK_BOTTOMS: readonly Shape[][] = [...BOTTOMS, trackPants(), shorts(), workTrousers()];

// ------------------------------------------------------------------------------------- shoes
const HIGH: Poly = [[-5.8, -12.0], [3.6, -12.2], [4.4, -3.4], [8.4, -1.4], [16.8, 0.4], [21.4, 2.8], [21.8, 7], [-6.6, 7], [-7.2, 2.0]];
function highTops(): Shape[] {
  const out: Shape[] = [];
  for (const s of SIDES) {
    const b = `foot${s}`;
    out.push(shape(b, fk(HIGH), "shoes", zFoot(s)));
    out.push(shape(b, fk(SOLE), "white", zFoot(s) + 0.1));
    out.push(shape(b, fk([[-6.2, -12.4], [4.0, -12.6], [4.0, -10.2], [-6.2, -10.0]]), "accent", zFoot(s) + 0.1));   // the ankle collar
    out.push(ink(b, fk([[0, -9], [2.6, -5.6], [9, 0.2]]), 0.28, zFoot(s) + 0.2));
  }
  return out;
}
function workShoes(): Shape[] {
  const out: Shape[] = [];
  for (const s of SIDES) {
    const b = `foot${s}`;
    out.push(shape(b, fk(FOOT), "shoes", zFoot(s)));
    out.push(shape(b, fk([[13.6, -0.6], [17.0, 0.6], [21.2, 2.8], [21.6, 5.4], [13.4, 5.4]]), "accent", zFoot(s) + 0.05));   // the toe cap
    out.push(shape(b, fk([[-7, 5.0], [22.2, 5.0], [22.2, 7.6], [-7, 7.6]]), "shoes", zFoot(s) + 0.1));
    out.push(ink(b, fk([[2, -2.6], [9, 0.2]]), 0.3, zFoot(s) + 0.2));
  }
  return out;
}
export const LOOK_SHOES: readonly Shape[][] = [...SHOES, highTops(), workShoes()];

/** The full set the content pack hands the engine. */
export const CONTENT_LOOKS: AppearanceSet = {
  builds: BUILDS,
  heads: LOOK_HEADS,
  hair: LOOK_HAIR,
  faces: LOOK_FACES,
  tops: LOOK_TOPS,
  bottoms: LOOK_BOTTOMS,
  shoes: LOOK_SHOES,
  accessories: LOOK_ACCESSORIES,
  hands: HANDS,
  skin: [...SKIN, ...SKIN_MORE],
  hairColor: [...HAIR_COLOUR, ...HAIR_COLOUR_MORE],
  palettes: [...PALETTES, ...PALETTES_MORE],
};
