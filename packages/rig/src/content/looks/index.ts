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
 *   accessories 6  + a long beard, mutton chops and moustache, a wide headband, a neckerchief
 *   skin 8, hair colours 8, palettes 12 (gate/style.ts)
 */
import type { AppearanceSet, ColourSlot, FaceId, Shape } from "../../contracts";
import { BUILDS, HAIR_PIVOT, K, PROPORTION } from "../../gate/skeleton";
import { HAIR_COLOUR, HAIR_COLOUR_MORE, PALETTES, PALETTES_MORE, SKIN, SKIN_MORE } from "../../gate/style";
import type { Poly, Pt } from "../../gate/vocab";
import { ellipsePoly, inkLine, limb } from "../../gate/vocab";
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
const HEAD_G: Poly = [[8.0, 1.4], [2.4, 1.6], [-2.4, -2.0], [-7.2, -1.6], [-10.6, -6.6], [-11.4, -13.0], [-9.8, -19.6], [-4.4, -23.6], [3.0, -23.6], [7.6, -20.8], [9.2, -17.0], [9.8, -13.9], [9.2, -12.4], [9.8, -11.0], [11.2, -8.2], [10.4, -7.0], [10.8, -5.6], [10.0, -4.6], [10.6, -3.4], [10.2, -0.6]];
const HEAD_H: Poly = [[9.4, 2.2], [2.2, 0.8], [-2.2, -3.4], [-6.0, -2.6], [-9.4, -7.8], [-10.0, -13.4], [-8.4, -19.4], [-3.4, -23.4], [3.0, -23.4], [7.2, -20.6], [8.8, -17.0], [9.4, -14.0], [8.8, -12.4], [9.6, -10.8], [11.8, -7.8], [10.2, -6.8], [10.4, -5.4], [9.8, -4.6], [10.6, -3.2], [11.2, -0.4]];
const HEAD_I: Poly = [[8.0, 0.8], [1.2, -0.4], [-2.6, -3.6], [-7.0, -2.2], [-10.2, -7.4], [-10.6, -13.2], [-9.4, -19.8], [-4.6, -22.6], [3.6, -22.6], [8.0, -20.0], [9.8, -16.8], [10.6, -14.4], [9.4, -12.6], [10.4, -11.0], [11.6, -8.6], [11.4, -7.0], [10.6, -5.6], [9.9, -4.6], [10.4, -3.4], [10.0, -1.0]];
const HEAD_J: Poly = [[7.0, 0.2], [1.6, -1.0], [-1.6, -4.2], [-5.4, -3.0], [-9.0, -8.0], [-9.8, -13.4], [-8.2, -19.6], [-3.2, -23.8], [2.8, -23.8], [7.0, -21.2], [8.6, -17.2], [9.2, -13.8], [8.6, -12.4], [9.2, -11.0], [11.0, -7.8], [9.8, -6.6], [9.8, -5.2], [9.2, -4.4], [9.6, -3.4], [9.2, -1.2]];
/** A cauliflower ear: the ear thickened and lumpy (the boxer's head). */
const EAR_THICK: Poly = [[-0.8, -13.2], [-3.8, -14.4], [-5.8, -11.4], [-5.2, -8.0], [-3.2, -6.8], [-1.0, -7.8]];
const B = "head";
const line = (pts: Poly, w = 0.42, z = 42.2): Shape => ink(B, hdPoly(pts), w, z);
export const LOOK_HEADS: readonly Shape[][] = [
  ...HEADS,
  [...head(HEAD_C, 0.95), line([[1.2, -10.4], [3.4, -8.4]], 0.32)],                    // hawk-nosed, lean: a hollow under the cheekbone
  [...head(HEAD_D, 1.3), line([[3.6, -15.4], [8.6, -15.2]], 0.36, 42.15)],              // broad: a heavy brow ridge
  [...head(HEAD_E, 0.92), line([[0.6, -9.6], [2.6, -6.2]], 0.34), line([[2.2, -1.6], [4.6, -2.2]], 0.28)],   // gaunt, long: cheek and chin creases
  [...head(HEAD_F, 1.45)],                                                               // square, thick-necked
  // content v3 batch 4
  [...head(HEAD_G, 1.5), line([[2.6, 0.6], [7.2, 0.9]], 0.34), line([[4.0, -8.8], [6.6, -7.6]], 0.3)],        // round and fleshy: a double chin, full cheeks
  [...head(HEAD_H, 1.15), line([[10.6, -1.6], [10.4, 0.8]], 0.3), line([[1.4, -9.8], [3.0, -6.8]], 0.3)],     // a lantern jaw with a cleft chin
  [...head(HEAD_I, 1.38), shape(B, hdPoly(EAR_THICK), "skin", 41.05), line([[-2.4, -12.0], [-3.8, -10.0], [-2.6, -8.8]], 0.36, 41.1),
    line([[3.6, -16.0], [9.4, -15.6]], 0.42, 42.15), line([[10.0, -10.8], [11.0, -9.6]], 0.32)],                // a boxer: flat broken nose, heavy brow, cauliflower ear
  [...head(HEAD_J, 0.86)],                                                                // narrow and young, a small turned-up nose
];

// ------------------------------------------------------------------------------------- hair
const ell = (cx: number, cy: number, rx: number, ry: number): Poly => ellipsePoly(cx, cy, rx, ry, 14);
/** Head-frame points into the hair bone's frame (the hair hangs from the crown). */
const toHair = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [x - HAIR_PIVOT[0], y - HAIR_PIVOT[1]] as Pt);
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
  // content v3 batch 4
  hair([[8.4, -18.8], [8.8, -22.6], [4.6, -25.6], [-2.6, -25.8], [-8.8, -22.6], [-11.4, -16.6], [-12.2, -8.0], [-12.0, 0.4], [-10.8, 3.6], [-7.6, 3.0], [-6.8, -1.6], [-6.6, -8.4], [-5.8, -14.6], [-2.8, -18.8], [2.6, -20.0]],
    [[[5.6, -23.4], [0.6, -24.4], [-5.6, -22.2]], [[-9.6, -14.0], [-10.2, -4.0], [-9.6, 1.6]], [[-8.0, -10.0], [-8.4, -1.0]]]),   // long, loose to the shoulders
  hair([[8.6, -17.4], [10.4, -21.6], [9.0, -26.6], [4.4, -30.4], [-2.4, -31.2], [-9.0, -28.8], [-13.6, -23.6], [-15.0, -16.4], [-14.2, -9.6], [-11.4, -5.4], [-8.0, -5.8], [-6.8, -10.4], [-6.0, -14.6], [-2.6, -18.6], [3.4, -19.6]],
    [[[5.8, -27.0], [4.4, -26.0]], [[0.4, -28.6], [-1.4, -27.8]], [[-6.0, -27.2], [-7.4, -25.6]], [[-10.8, -22.0], [-11.8, -20.0]], [[-12.4, -14.6], [-12.4, -12.4]], [[2.8, -23.6], [1.2, -23.0]], [[-4.0, -23.0], [-5.6, -21.6]], [[-9.4, -16.4], [-10.0, -14.6]], [[7.2, -22.4], [6.6, -21.0]]]),   // a big round afro
  [...hair([[8.0, -19.6], [7.4, -23.4], [2.6, -25.6], [-4.0, -25.4], [-9.2, -21.6], [-10.8, -15.6], [-9.2, -13.4], [-7.4, -16.6], [-3.4, -20.2], [3.2, -21.0]], []),
    ...([[-10.4, -15.0, 1.0, 1.9], [-8.6, -17.6, 2.6, 1.8], [-6.6, -19.2, 0.6, 1.7], [-12.0, -12.6, -1.4, 1.7], [-4.6, -20.0, -3.6, 1.6]] as const).flatMap(([x, y0, y1, w]) =>
      hair(lock(x, y0, y1, w), [[[x - 0.5, y0 + 4], [x + 0.5, y0 + 4.4]], [[x - 0.5, y0 + 9], [x + 0.5, y0 + 9.4]]]))],   // locks, hanging to the shoulders
  hair([[8.2, -18.8], [8.6, -26.6], [7.6, -29.0], [-6.4, -29.2], [-9.4, -26.4], [-10.6, -18.0], [-10.4, -11.6], [-8.8, -11.0], [-8.4, -15.6], [-6.4, -19.6], [-2.0, -21.6], [3.6, -21.6]],
    [[[6.4, -28.0], [-5.2, -28.2]], [[-8.6, -24.0], [-9.2, -18.0]]]),                                                                                   // a flat top
  hair([[8.2, -19.6], [3.2, -23.8], [-3.8, -24.0], [-9.0, -19.8], [-10.8, -13.6], [-10.2, -10.4], [-8.8, -10.8], [-8.6, -14.6], [-6.6, -18.8], [-2.4, -22.0], [3.4, -22.2], [7.4, -19.2]],
    [[[7.4, -20.4], [2.0, -23.2], [-4.4, -23.0], [-8.6, -19.2], [-9.8, -13.4]], [[7.6, -19.0], [3.0, -21.6], [-3.2, -21.6], [-7.4, -17.8], [-8.8, -12.6]]]),   // cornrows, braided back flat to the head
  hair([[11.6, -21.0], [11.0, -25.4], [6.4, -28.0], [0.0, -28.4], [-5.6, -26.6], [-8.8, -22.8], [-9.4, -19.4], [-7.6, -19.4], [-4.8, -21.8], [0.8, -22.8], [6.8, -21.6]],
    [[[8.8, -25.4], [3.0, -26.8], [-3.0, -26.4]], [[5.0, -23.6], [-1.6, -24.4], [-6.0, -22.4]]]),                                                       // an undercut, the long top swept up
  [...hair([[8.0, -20.0], [6.6, -23.8], [1.0, -25.0], [-5.4, -24.2], [-9.6, -20.0], [-10.8, -14.6], [-9.4, -12.6], [-7.6, -14.6], [-6.0, -18.6], [-2.0, -21.0], [3.2, -21.2]],
    [[[5.6, -22.8], [-1.6, -23.6], [-7.6, -20.4]]]),
  ...hair([[-9.6, -19.8], [-12.8, -18.6], [-15.2, -12.4], [-15.4, -3.6], [-13.6, 2.4], [-11.4, 1.4], [-12.0, -4.8], [-11.6, -11.6], [-9.6, -16.2]], [[[-13.2, -12.6], [-13.4, -2.0]]]),
  shape("hair", toHair(hdPoly(ell(-10.6, -18.2, 1.5, 1.7))), "accent", 44.2)],                                                                          // a ponytail with a tie
  [...hair([[-2.0, -17.4], [-6.0, -19.0], [-9.4, -16.8], [-10.8, -12.6], [-10.2, -9.0], [-8.6, -8.4], [-7.6, -11.6], [-6.6, -14.6], [-3.0, -16.0]], [[[-6.0, -17.0], [-8.6, -13.0]]]),
    ...hair([[1.8, -16.4], [2.4, -13.2], [1.4, -10.8], [0.2, -11.2], [0.2, -15.2]], [])],                                                          // bald on top, the sides kept
];

// ------------------------------------------------------------------------------------ faces
/** Stubble: a scatter of fine dots over the jaw, the chin and the upper lip (a seeded grid). */
const STUBBLE: readonly Pt[] = (() => {
  const out: Pt[] = [];
  for (let y = -7.6; y <= 0.6; y += 1.05) for (let x = -1.4; x <= 10.4; x += 1.1) {
    const j = ((Math.round(x * 10) * 7 + Math.round(y * 10) * 13) % 5) * 0.12;
    const px = x + j;
    const py = y + (Math.round(x * 3) % 2) * 0.5;
    // inside the jaw: in front of the jaw line, under the cheek, not over the mouth's corner line
    const jaw = px > -1.6 + (py + 8) * -0.35 && py > -7.8 + Math.max(0, 4 - px) * 0.45 && px < 9.6 + (py > -5 ? 0.6 : 0) && !(px > 7 && py > -5.6 && py < -3.6);
    if (jaw) out.push([px, py]);
  }
  return out;
})();
interface FaceOpts { heavy: number; eye?: number; scar?: boolean; lines?: boolean; broken?: boolean;
  /** content v3 batch 4: heavy lids and bags under the eyes; a fixed scowl; stubble on the jaw; a
   *  black eye; a stitched cut on the cheek; a smirk with one brow up */
  tired?: boolean; scowl?: boolean; stubble?: boolean; bruise?: boolean; stitches?: boolean; smirk?: boolean }
const EYE_C: Pt = [6.4, -12.3];
const eyeK = (pts: Poly, k: number): Poly => pts.map(([x, y]) => [x, EYE_C[1] + (y - EYE_C[1]) * k] as Pt);
function faceSet(o: FaceOpts): Record<FaceId, Shape[]> {
  const W = 0.42;
  const k = o.eye ?? 1;
  const extra: Shape[] = [];
  if (o.scar === true) extra.push(line([[4.2, -17.6], [5.6, -14.8], [6.2, -13.6]], 0.3, 42.7), line([[7.6, -9.6], [8.6, -7.8]], 0.26, 42.7));
  if (o.lines === true) extra.push(line([[2.6, -18.4], [7.4, -18.0]], 0.26), line([[2.8, -19.6], [6.8, -19.4]], 0.22), line([[7.6, -7.2], [7.2, -4.2]], 0.34));
  if (o.broken === true) extra.push(line([[9.6, -11.2], [10.4, -10.0], [10.0, -9.2]], 0.32));
  if (o.tired === true) extra.push(line([[4.8, -10.9], [6.6, -10.3], [8.0, -10.8]], 0.3, 42.25), line([[5.4, -9.9], [7.4, -9.6]], 0.24, 42.25));
  if (o.stubble === true) for (const [x, y] of STUBBLE) extra.push(shape(B, hdPoly(ellipsePoly(x, y, 0.32, 0.28, 6)), "ink", 42.05));
  if (o.bruise === true) extra.push(shape(B, hdPoly([[4.0, -14.2], [6.8, -14.8], [9.0, -13.8], [9.6, -11.6], [8.4, -9.6], [5.6, -9.4], [3.8, -10.8]]), "bruise", 42.1),
    line([[4.6, -10.4], [6.8, -9.8], [8.6, -10.6]], 0.3, 42.25));
  if (o.stitches === true) extra.push(line([[2.4, -9.6], [6.4, -6.2]], 0.34, 42.7),
    ...[0.2, 0.45, 0.7].map((u) => { const x = 2.4 + 4 * u; const y = -9.6 + 3.4 * u; return line([[x - 0.6, y + 0.7], [x + 0.6, y - 0.7]], 0.26, 42.72); }));
  const common = (): Shape[] => [line(F.jaw, 0.36), line(F.naso, W), line(F.nostril, W), line(F.cheekbone, 0.3), ...extra];
  const eye = (pts: Poly): Shape => shape(B, hdPoly(eyeK(pts, k)), "ink", 42.3);
  const lid = (pts: Poly, w: number): Shape => line(eyeK(pts, k), w);
  const brow = (pts: Poly): Shape => shape(B, hdPoly(pts.map(([x, y]) => [x, y - (o.heavy - 1) * 0.4] as Pt).map(([x, y]) => [x, y + (y - -14.5) * (o.heavy - 1) * 0.6] as Pt)), "ink", 42.6);
  // a fixed scowl keeps the angry brow at rest; a smirk lifts the brow at rest and tips the mouth up
  const restBrow = o.scowl === true ? F.browAngry : o.smirk === true ? F.browUp : F.browFlat;
  const restMouth: Poly = o.smirk === true ? [[7.4, -4.0], [8.8, -4.4], [10.3, -5.2]] : F.mouthLine;
  const mouth = (m: Poly, t?: Poly): Shape[] => (t === undefined ? [shape(B, hdPoly(m), "ink", 42.4)]
    : [shape(B, hdPoly(m), "ink", 42.4), shape(B, hdPoly(t), "white", 42.5)]);
  return {
    neutral: [...common(), eye(F.eyeOpen), lid(o.tired === true ? F.lidLow : F.lid, 0.5), brow(restBrow), line(restMouth, 0.55), line(F.cheek, 0.3)],
    grit: [...common(), eye(F.eyeOpen), lid(F.lid, 0.55), brow(F.browAngry), ...mouth(F.mouthSnarl, F.teethSnarl), line(F.cheek, 0.34)],
    shout: [...common(), eye(F.eyeWide), lid(F.lid, 0.5), brow(F.browUp), ...mouth(F.mouthShout, F.teethShout), line(F.cheek, 0.34)],
    dazed: [...common(), lid(F.eyeShut, 0.6), line(F.shutCrease, 0.34), brow(F.browPain), ...mouth(F.mouthPain, F.teethPain)],
    grin: [...common(), eye(F.eyeOpen), lid(F.lidLow, 0.6), brow(restBrow), ...mouth(F.mouthGrin, F.teethGrin), line(F.cheek, 0.4)],
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
  // content v3 batch 4
  faceSet({ heavy: 1.15, tired: true }),                     // tired: heavy lids, bags under the eyes
  faceSet({ heavy: 1.45, scowl: true }),                     // a fixed scowl
  faceSet({ heavy: 1.05, stubble: true }),                   // stubble on the jaw and the lip
  faceSet({ heavy: 1.2, bruise: true }),                     // a black eye
  faceSet({ heavy: 1.1, eye: 0.8, stitches: true }),         // a stitched cut on the cheek
  faceSet({ heavy: 0.9, eye: 1.08, smirk: true }),           // a smirk, one brow up
];

// ------------------------------------------------------------------------------- accessories
/** The links of the chain, round the base of the neck (torso sampler space), drawn over the neck
 *  and the collar (z in the head's outline group) and under the arms. */
const CHAIN: readonly Pt[] = [[-4.0, -55.4], [-1.6, -55.8], [0.9, -55.5], [3.3, -54.6], [5.4, -53.1], [7.1, -51.2], [8.4, -49.2]];
// Review round 2 ("look variants barely differ"): a goatee, a thin moustache and a plaster on
// the nose were a few pixels each on the phone, so four of the six accessories looked the same
// as none. Each is now a mass of colour a viewer sees at fight size: a long beard to the chest,
// mutton chops joined to a heavy moustache, a wide headband with long tails, a neckerchief.
export const LOOK_ACCESSORIES: readonly Shape[][] = [
  ...ACCESSORIES,
  [shape(B, hdPoly([[-2.8, -9.4], [0.6, -9.2], [4.4, -5.4], [8.2, -4.2], [10.4, -3.4], [10.9, -0.4], [10.0, 4.4], [7.6, 7.2], [4.6, 4.2], [0.4, -0.2], [-2.8, -4.6]]), "hair", 43),
    line([[8.4, -1.6], [8.0, 3.6]], 0.3, 43.1), line([[5.6, -2.0], [5.8, 2.4]], 0.26, 43.1)],                                       // a long beard, to the chest
  [shape(B, hdPoly([[-3.2, -12.2], [-0.4, -12.4], [1.8, -6.6], [6.6, -5.0], [10.6, -5.9], [10.9, -4.5], [7.2, -2.6], [1.0, -1.8], [-2.8, -4.8]]), "hair", 43),
    line([[0.2, -9.6], [2.4, -4.4]], 0.26, 43.1)],                                                                                // mutton chops into a heavy moustache
  [shape(B, hdPoly([[9.5, -15.2], [9.0, -19.0], [3.0, -21.0], [-4.6, -20.8], [-10.0, -17.6], [-10.8, -13.6], [-8.6, -13.4], [-3.6, -16.4], [2.8, -16.8]]), "accent", 44.5),
    shape(B, hdPoly([[-9.8, -16.4], [-15.4, -11.6], [-14.2, -9.6], [-12.2, -11.6], [-12.6, -7.6], [-10.8, -7.2], [-9.4, -13.6]]), "accent", 44.4),
    line([[6.0, -17.6], [-6.0, -17.8]], 0.22, 44.6)],                                                                              // a wide headband, long tails behind
  [shape(B, hdPoly([[-8.8, -6.0], [-4.0, -3.6], [2.0, -1.8], [7.0, 0.0], [7.8, 3.4], [4.4, 7.4], [1.6, 4.0], [-3.0, 2.6], [-8.6, -0.8]]), "accent", 43),
    line([[6.4, 1.0], [0.6, 0.4], [-6.6, -2.6]], 0.24, 43.1)],                                                                    // a neckerchief, knotted at the front
  // content v3 batch 4: caps, beanies, chains, glasses, headphones, tattoos, bandages, earrings and scars
  [shape(B, hdPoly([[9.0, -17.8], [8.6, -23.4], [4.0, -27.0], [-3.4, -27.4], [-9.4, -24.0], [-11.4, -18.4], [-10.8, -16.2], [-2.0, -17.4]]), "accent", 44.5),
    shape(B, hdPoly([[8.0, -18.8], [16.8, -19.2], [17.2, -17.6], [15.6, -16.6], [8.4, -16.6]]), "accent", 44.6),
    line([[8.4, -18.0], [-10.6, -17.2]], 0.3, 44.65), line([[3.2, -26.6], [2.4, -18.4]], 0.24, 44.62), line([[-3.4, -27.0], [-4.6, -18.0]], 0.24, 44.62),
    shape(B, hdPoly(ell(0.4, -27.4, 1.0, 0.7)), "accent", 44.63)],                                                                // a cap, the peak forward
  [shape(B, hdPoly([[9.4, -16.8], [9.0, -23.0], [4.6, -27.6], [-3.0, -28.4], [-9.4, -25.2], [-12.0, -18.6], [-11.8, -15.4]]), "top", 44.5),
    shape(B, hdPoly([[10.4, -14.4], [10.2, -18.4], [-12.2, -17.6], [-12.0, -14.0], [-2.0, -15.8]]), "top", 44.6),
    ...[6.6, 2.6, -1.4, -5.4, -9.4].map((x) => line([[x, -18.0], [x - 0.2, -15.4]], 0.3, 44.7)),
    shape(B, hdPoly(ell(-1.2, -28.6, 2.2, 1.6)), "accent", 44.45)],                                                               // a beanie with a bobble
  [...CHAIN.map(([x, y], i) => shape("torso", trPoly(ellipsePoly(x, y, 1.5, 1.05, 10, 20 + i * 9)), "metal", 40.5 + (i % 2) * 0.01)),
    shape("torso", trPoly([[8.0, -48.2], [10.8, -47.6], [10.6, -43.8], [7.8, -44.4]]), "metal", 40.52),
    ink("torso", trPoly([[8.6, -46.6], [10.0, -46.2]]), 0.24, 40.53)],                                                          // a heavy chain round the neck with a tag
  [shape(B, hdPoly([[4.0, -14.2], [9.8, -14.6], [10.4, -12.8], [9.6, -10.8], [5.2, -10.6], [3.8, -12.2]]), "visor", 42.8),
    shape(B, hdPoly([[5.0, -13.6], [6.8, -13.8], [6.2, -12.8], [5.2, -12.6]]), "white", 42.85),
    line([[4.0, -13.4], [-1.4, -12.8], [-2.4, -11.2]], 0.5, 42.82)],                                                             // dark glasses
  [line([[-2.6, -13.6], [-2.6, -20.4], [-1.6, -25.4]], 0.9, 44.6),
    shape(B, hdPoly(ell(-2.8, -10.8, 3.4, 3.8)), "rubber", 44.7), shape(B, hdPoly(ell(-2.8, -10.8, 2.0, 2.4)), "accent", 44.75)],  // headphones over the ears
  [shape(B, hdPoly([[-5.6, 4.6], [-6.2, 1.0], [-5.0, -2.6], [-3.4, -5.6], [-2.0, -3.2], [-2.6, -0.6], [-0.6, -2.2], [0.2, 0.8], [1.8, -0.8], [2.2, 2.4], [3.6, 1.6], [2.8, 4.8]]), "ink", 40.08),
    shape(B, hdPoly([[-4.2, 2.6], [-4.4, 0.4], [-3.6, -1.6], [-3.0, 0.2], [-1.4, 0.6], [-1.6, 2.8]]), "skin", 40.09),
    shape(B, hdPoly([[-6.6, -4.0], [-4.6, -7.4], [-4.0, -5.4]]), "ink", 40.08)],                                                  // a neck tattoo, flames up from the collar
  [shape(B, hdPoly([[9.8, -15.4], [9.6, -18.6], [3.0, -20.8], [-4.6, -20.6], [-10.6, -17.6], [-11.0, -14.2], [-4.0, -16.4], [3.0, -16.6]]), "white", 44.5),
    line([[8.6, -17.2], [-9.6, -16.4]], 0.24, 44.55), shape(B, hdPoly(ell(-6.0, -17.8, 1.1, 1.0)), "sign", 44.56),
    shape(B, hdPoly([[8.4, -12.6], [10.8, -12.2], [11.0, -10.4], [8.6, -10.6]]), "white", 42.8)],                                // bandaged: a wrap round the head, a plaster on the nose
  [shape(B, hdPoly(ell(-3.0, -5.4, 1.9, 2.2)), "metal", 41.2), shape(B, hdPoly(ell(-3.0, -5.2, 1.0, 1.3)), "skin", 41.25),
    shape(B, hdPoly(inkLine([[2.2, -10.4], [4.6, -7.8], [7.4, -5.4]], 0.7, false)), "white", 42.7),
    line([[2.4, -10.0], [7.2, -5.0]], 0.2, 42.72)],                                                                               // a hoop earring and a pale scar across the cheek
];

/** Accessories worn on the head: head gear (a hard hat, a helmet, goggles, a bandana) takes them
 *  off. The cap and the beanie also cut the hair at their brim. */
export const LOOK_HEADWEAR: readonly number[] = [4, 6, 7, 9, 10, 12];
export const LOOK_CROWNWEAR: readonly number[] = [6, 7];

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

// ------------------------------------------------------------- tops, content v3 batch 4
// Hoodies, vests, jackets, tank tops and work shirts (plan 13.9). Same rules as above: the torso
// on the torso bone, sleeves on the arm bones, details as ink, collars and hoods over the top.
/** A long sleeve in another slot (the shirt under a vest). */
function sleevesIn(out: Shape[], s: Side, slot: ColourSlot, cuff = true): void {
  out.push(shape(up(s), armPart(s, "up", true), slot, zArm(s, "up")));
  out.push(shape(lo(s), armPart(s, "lo", true), slot, zArm(s, "lo")));
  if (cuff) out.push(shape(lo(s), [[-1.9, FA - 1.6], [2.0, FA - 1.6], [2.0, FA + 0.2], [-1.9, FA + 0.2]], slot, zArm(s, "lo") + 0.05));
  out.push(ink(up(s), [[-1.2, UA - 2.2], [0.6, UA - 0.8]], 0.3, zArm(s, "up") + 0.06));
}
/** Sleeves rolled to the elbow: the sleeve over the upper arm ending in a thick roll, the forearm bare. */
function rolled(out: Shape[], s: Side, slot: ColourSlot): void {
  out.push(shape(up(s), armPart(s, "up", true), slot, zArm(s, "up")));
  out.push(shape(up(s), [[-2.9, UA - 3.2], [3.1, UA - 3.2], [3.0, UA + 0.4], [-2.8, UA + 0.4]], slot, zArm(s, "up") + 0.04));
  out.push(ink(up(s), [[-2.6, UA - 1.6], [2.8, UA - 1.5]], 0.26, zArm(s, "up") + 0.06, false));
  out.push(shape(lo(s), armPart(s, "lo", false), "skin", zArm(s, "lo")));
  out.push(ink(lo(s), [[0.9, 1.4], [0.4, 5.6]], 0.26, zArm(s, "lo") + 0.05));
}
const zip = (x: number, y0: number, y1: number): Shape => ink("torso", trPoly([[x, y0], [x + 0.3, (y0 + y1) / 2], [x, y1]]), 0.34, Z.torso + 0.2);
function zipHoodie(): Shape[] {
  const out = [torso(),
    shape("torso", trPoly([[3.2, -54.6], [7.8, -51.0], [9.6, -40], [9.2, -24], [9.4, -1.6], [5.4, -1.6], [5.0, -26], [4.4, -46]]), "accent", Z.torso + 0.1),   // the tee in the open front
    shape("torso", trPoly([[-10.4, -48], [-8.4, -56.5], [-2.0, -59.5], [4.0, -57.5], [2.2, -52.5], [-3.6, -50.2], [-7.4, -46]]), "top", Z.torso + 1),       // the hood down
    ink("torso", trPoly([[-6.2, -52.6], [-2.6, -55.6], [2.0, -56.0]]), 0.28, Z.torso + 1.1),
    zip(4.4, -46, -2), zip(9.4, -40, -2),
    ink("torso", trPoly([[2.6, -50], [3.0, -40]]), 0.24, Z.torso + 0.2), ink("torso", trPoly([[10.0, -44], [10.6, -36]]), 0.24, Z.torso + 0.2),   // drawstrings
    ink("torso", trPoly([[-6.4, -18], [3.6, -18], [4.0, -7]]), 0.3, Z.torso + 0.2, false),
    shape("torso", trPoly([[-9.2, -1.4], [4.6, -1.4], [4.6, 3], [-9, 3]]), "top", Z.torso + 0.15)];
  for (const s of SIDES) sleeves(out, s, { cuff: true });
  return out;
}
function pufferVest(): Shape[] {
  const out = [shape("torso", trPoly([[-10.2, 3.4], [-10.6, -8], [-9.6, -20], [-11.6, -34], [-12.8, -44], [-10.2, -51.6], [-4.6, -55.6], [4.2, -55.6], [9.4, -51.6], [12.8, -44], [13.4, -36], [11.4, -28], [10.4, -18], [10.8, -6], [10.4, 3.4]]), "top", Z.torso),
    shape("torso", trPoly([[-5.2, -58.2], [4.0, -58.6], [5.6, -53.6], [-5.6, -53.0]]), "top", Z.torso + 1),                                             // the stand collar
    zip(4.6, -54, 2.6)];
  for (const y of [-46, -38, -30, -22, -14, -6]) out.push(ink("torso", trPoly([[-11.2, y], [-3, y + 0.9], [11.6, y]]), 0.3, Z.torso + 0.2));
  // the armhole's padded edge over the shoulder
  out.push(shape("torso", trPoly([[-3.6, -50.6], [5.6, -50.8], [6.2, -43.4], [-3.4, -43.0]]), "top", Z.torso + 0.12), ink("torso", trPoly([[-3.4, -43.4], [6.0, -43.8]]), 0.28, Z.torso + 0.2, false));
  // the long-sleeved shirt under it in a dark grey, so it never reads as a bare arm
  for (const s of SIDES) sleevesIn(out, s, "rubber");
  return out;
}
function bomber(): Shape[] {
  const out = [shape("torso", trPoly([[-9.8, -3], [-10.2, -10], [-9.4, -20], [-11.4, -34], [-12.4, -44], [-9.8, -51.6], [-4, -55.6], [4, -55.6], [9.2, -51.6], [12.6, -44], [13.2, -36], [11.2, -28], [10.2, -18], [10.6, -10], [10.2, -3]]), "top", Z.torso),
    shape("torso", trPoly([[-9.6, -4.6], [10.0, -4.6], [9.8, 0.6], [-9.4, 0.6]]), "accent", Z.torso + 0.1),                                           // the ribbed waistband
    ...[-6, -2, 2, 6].map((x) => ink("torso", trPoly([[x, -4.2], [x, 0.2]]), 0.22, Z.torso + 0.2)),
    shape("torso", trPoly([[-5.0, -57.4], [4.4, -57.8], [6.4, -53.0], [-5.6, -52.6]]), "accent", Z.torso + 1),                                         // the ribbed collar
    zip(4.8, -53, -4.6),
    ink("torso", trPoly([[6.6, -28], [9.6, -18]]), 0.3, Z.torso + 0.2)];                                                                             // a slash pocket
  for (const s of SIDES) {
    out.push(shape(up(s), limb(UA, plus(PROF.UA, 1.4), K, JOINT_ENDS, 1), "top", zArm(s, "up")));
    out.push(shape(lo(s), limb(FA, plus(PROF.FA, 1.1), K, JOINT_ENDS, 1), "top", zArm(s, "lo")));
    out.push(shape(lo(s), [[-1.8, FA - 2.0], [1.9, FA - 2.0], [1.8, FA + 0.2], [-1.7, FA + 0.2]], "accent", zArm(s, "lo") + 0.05));             // ribbed cuff
    out.push(shape(up(s), [[0.6, UA * 0.2], [2.6, UA * 0.2], [2.5, UA * 0.45], [0.7, UA * 0.45]], "accent", zArm(s, "up") + 0.05));              // the sleeve pocket
    out.push(ink(up(s), [[-1.2, UA - 2.2], [0.6, UA - 0.8]], 0.3, zArm(s, "up") + 0.06));
  }
  return out;
}
function tankTop(): Shape[] {
  // a ribbed cream singlet: thin straps, deep armholes, a scoop neck; bare shoulders and arms
  const out = [shape("torso", trPoly([[-9, 3], [-9.4, -8], [-8.4, -20], [-9.6, -34], [-8.2, -42], [-6.6, -52.6], [-4.2, -52.8], [-2.6, -45.4], [2.8, -45.0], [4.8, -52.4], [7.2, -52.2], [8.6, -43], [10.4, -36], [10.2, -28], [9.2, -18], [9.6, -6], [9.2, 3]]), "white", Z.torso),
    shape("torso", trPoly([[-12, -45], [-9, -52], [-4, -57], [3.5, -57], [8.5, -52.2], [11.6, -44], [12.2, -36], [10.4, -36], [8.6, -43], [7.2, -52.2], [4.8, -52.4], [2.8, -45.0], [-2.6, -45.4], [-4.2, -52.8], [-6.6, -52.6], [-8.2, -42], [-9.6, -34], [-11.4, -40]]), "skin", Z.torso - 0.05)];
  for (const x of [-6, -3, 0, 3, 6]) out.push(ink("torso", trPoly([[x, -40], [x + 0.3, -4]]), 0.2, Z.torso + 0.2));
  out.push(ink("torso", trPoly([[-8.8, -3], [9.4, -3]]), 0.3, Z.torso + 0.2, false));
  for (const s of SIDES) sleeves(out, s, { bare: true });
  return out;
}
function workShirt(short: boolean): Shape[] {
  const out = [torso(),
    shape("torso", trPoly([[-2.2, -56.2], [6.8, -55.6], [7.6, -51.0], [3.0, -48.8], [-1.6, -51.2]]), "top", Z.torso + 1),                              // the collar
    shape("torso", trPoly([[1.8, -55.4], [5.2, -55.2], [3.6, -51.4]]), "skin", Z.torso + 0.1),
    ink("torso", trPoly([[3.6, -50], [4.0, -3]]), 0.3, Z.torso + 0.2),                                                                                 // the placket
    ...[-44, -36, -28, -20, -12].map((y) => shape("torso", trPoly(ellipsePoly(5.2, y, 0.6, 0.6, 6)), "white", Z.torso + 0.25)),                         // buttons
    shape("torso", trPoly([[5.8, -42], [10.6, -42.4], [10.4, -35.4], [6.0, -35.2]]), "top", Z.torso + 0.15),                                          // the breast pocket
    ink("torso", trPoly([[5.8, -40.6], [10.6, -41.0]]), 0.26, Z.torso + 0.2, false),
    hem(-3)];
  if (short) {
    // the short-sleeved work shirt: a two-tone yoke, a name patch, a pen in the pocket
    out.push(shape("torso", trPoly([[-11.2, -44], [-9.4, -51], [-3.5, -54.5], [3.5, -54.5], [8.5, -51], [11.6, -44], [-2, -45.6]]), "accent", Z.torso + 0.12));
    out.push(shape("torso", trPoly([[-7.6, -38], [-1.2, -38.2], [-1.0, -34.2], [-7.4, -34.0]]), "white", Z.torso + 0.2));
    out.push(ink("torso", trPoly([[-6.4, -36.2], [-2.4, -36.3]]), 0.3, Z.torso + 0.25, false));
    out.push(shape("torso", trPoly([[7.4, -45.0], [8.4, -45.0], [8.3, -40.0], [7.5, -40.0]]), "sign", Z.torso + 0.16));
    for (const s of SIDES) sleeves(out, s, { short: true });
  } else {
    out.push(shape("torso", trPoly([[-8.6, -42], [-3.8, -42.2], [-3.8, -35.4], [-8.4, -35.2]]), "top", Z.torso + 0.15), ink("torso", trPoly([[-8.6, -40.6], [-3.8, -40.8]]), 0.26, Z.torso + 0.2, false));
    for (const s of SIDES) rolled(out, s, "top");
  }
  return out;
}
function cutOffHoodie(): Shape[] {
  const out = [torso(),
    shape("torso", trPoly([[-12, -45], [-9, -52], [-6, -54.2], [-6.6, -47.4], [-8.4, -41], [-10.6, -38.6]]), "skin", Z.torso + 0.05),                  // the shoulder bared by the cut-off armhole
    shape("torso", trPoly([[-10.4, -48], [-8.4, -56.5], [-2.0, -59.5], [4.0, -57.5], [2.2, -52.5], [-3.6, -50.2], [-7.4, -46]]), "top", Z.torso + 1),
    ink("torso", trPoly([[-6.2, -52.6], [-2.6, -55.6], [2.0, -56.0]]), 0.28, Z.torso + 1.1),
    ink("torso", trPoly([[-3.6, -18], [8.6, -18], [9.2, -6]]), 0.3, Z.torso + 0.2, false),
    ink("torso", trPoly([[3.4, -51], [3.8, -42]]), 0.24, Z.torso + 0.2),
    // the frayed edge of the armhole
    ink("torso", trPoly([[-6.4, -53.4], [-7.0, -51.6], [-6.4, -50.4], [-7.6, -48.6], [-7.8, -46.2], [-9.0, -44.4], [-9.4, -42.0], [-10.6, -39.6]]), 0.3, Z.torso + 0.2, false),
    shape("torso", trPoly([[-9.2, -1.4], [9.4, -1.4], [9.2, 3], [-9, 3]]), "top", Z.torso + 0.15), hem(-1.6)];
  for (const s of SIDES) sleeves(out, s, { bare: true });
  return out;
}
function anorak(): Shape[] {
  const out = [shape("torso", trPoly([[-10.2, 4.4], [-10.6, -8], [-9.6, -20], [-11.6, -34], [-12.6, -44], [-10.0, -52], [-4.2, -55.8], [4.2, -55.8], [9.6, -52], [12.8, -44], [13.4, -36], [11.4, -28], [10.4, -18], [10.8, -6], [10.4, 4.4]]), "top", Z.torso),
    shape("torso", trPoly([[-12.2, -40], [13.0, -40], [12.6, -32], [-11.6, -32]]), "accent", Z.torso + 0.1),                                          // a colour band across the chest
    shape("torso", trPoly([[-1.0, -20], [10.2, -20.4], [10.4, -6], [-0.6, -6]]), "top", Z.torso + 0.15),                                             // the front pouch
    ink("torso", trPoly([[-1.0, -20], [10.2, -20.4]]), 0.3, Z.torso + 0.2, false),
    shape("torso", trPoly([[-5.6, -58.8], [3.6, -59.2], [5.8, -53.4], [-6.0, -52.8]]), "top", Z.torso + 1),                                           // a high collar with the hood rolled in it
    ink("torso", trPoly([[-5.0, -56.6], [3.8, -57.0]]), 0.26, Z.torso + 1.1),
    zip(4.8, -54, -40),
    shape("torso", trPoly(ellipsePoly(4.9, -40.2, 0.9, 0.7, 6)), "metal", Z.torso + 0.25)];
  for (const s of SIDES) {
    sleeves(out, s, { cuff: true });
    out.push(shape(up(s), [[-2.9, UA * 0.62], [3.2, UA * 0.62], [3.1, UA * 0.85], [-2.8, UA * 0.85]], "accent", zArm(s, "up") + 0.05));           // the band round the sleeve
  }
  return out;
}
export const LOOK_TOPS: readonly Shape[][] = [...TOPS, tee(), hoodie(), trackTop(), flannel(), leather(), coat(),
  zipHoodie(), pufferVest(), bomber(), tankTop(), workShirt(false), cutOffHoodie(), anorak(), workShirt(true)];

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

// ---------------------------------------------------------- bottoms, content v3 batch 4
function cargoShorts(): Shape[] {
  const out = [...pelvis(), ink("pelvis", trPoly([[3.5, -3.6], [5.5, 6]]), 0.3, Z.pelvis + 0.2)];
  for (const s of SIDES) {
    const th = `leg${s}.up`;
    const sh = `leg${s}.lo`;
    out.push(shape(th, legPart("up", 0), "skin", zLeg(s, "up")));
    out.push(shape(sh, legPart("lo", 0), "skin", zLeg(s, "lo")));
    out.push(ink(sh, [[2.2, SH * 0.3], [1.4, SH * 0.66]], 0.24, zLeg(s, "lo") + 0.05));
    // to the knee, wide in the leg, the hem cut straight across
    out.push(shape(th, limb(T, plus(PROF.TH, 1.8), K, JOINT_ENDS, 1).map(([x, y]) => [x, Math.min(y, T * 0.96)] as Pt), "bottom", zLeg(s, "up") + 0.03));
    out.push(ink(th, [[-3.6, T * 0.93], [3.8, T * 0.93]], 0.26, zLeg(s, "up") + 0.04, false));
    out.push(shape(th, [[-1.4, T * 0.4], [3.8, T * 0.4], [3.6, T * 0.74], [-1.2, T * 0.74]], "bottom", zLeg(s, "up") + 1));                          // the side pocket
    out.push(ink(th, [[-1.4, T * 0.47], [3.8, T * 0.47]], 0.24, zLeg(s, "up") + 1.05, false));
  }
  return out;
}
function baggyJeans(): Shape[] {
  const out = [...pelvis(), ink("pelvis", trPoly([[3.5, -3.6], [5.5, 6]]), 0.3, Z.pelvis + 0.2), ink("pelvis", trPoly([[-6.0, -3.4], [-7.4, 3.4]]), 0.26, Z.pelvis + 0.2)];
  for (const s of SIDES) {
    const th = `leg${s}.up`;
    const sh = `leg${s}.lo`;
    out.push(shape(th, legPart("up", 1.4), "bottom", zLeg(s, "up")));
    out.push(shape(sh, legPart("lo", 1.8), "bottom", zLeg(s, "lo")));
    out.push(shape(sh, [[-3.8, SH - 2.4], [3.8, SH - 2.4], [3.9, SH + 0.8], [-3.9, SH + 0.8]], "accent", zLeg(s, "lo") + 0.05));                   // the turn-up
    out.push(ink(th, [[1.4, T * 0.15], [1.0, T * 0.85]], 0.26, zLeg(s, "up") + 0.05));
    out.push(ink(sh, [[-1.0, SH * 0.3], [-1.6, SH * 0.5], [-0.8, SH * 0.66]], 0.24, zLeg(s, "lo") + 0.05));                                         // a fold at the shin
  }
  return out;
}
function camoTrousers(): Shape[] {
  const out = [...pelvis(), shape("pelvis", trPoly([[-6, 0], [-1.6, -1.4], [0.6, 3.4], [-4.4, 5.6]]), "khaki", Z.pelvis + 0.15)];
  const blot = (bone: string, cx: number, cy: number, r: number, slot: ColourSlot, z: number, a: number): Shape =>
    shape(bone, ellipsePoly(cx, cy, r, r * 0.6, 7, a), slot, z);
  for (const s of SIDES) {
    const th = `leg${s}.up`;
    const sh = `leg${s}.lo`;
    out.push(shape(th, legPart("up", 0.6), "bottom", zLeg(s, "up")));
    out.push(shape(sh, legPart("lo", 0.5), "bottom", zLeg(s, "lo")));
    out.push(blot(th, 1.2, T * 0.25, 2.0, "khaki", zLeg(s, "up") + 0.04, 30), blot(th, -1.6, T * 0.6, 1.8, "accent", zLeg(s, "up") + 0.04, -20),
      blot(th, 1.8, T * 0.85, 1.4, "khaki", zLeg(s, "up") + 0.04, 60));
    out.push(blot(sh, -0.8, SH * 0.25, 1.7, "accent", zLeg(s, "lo") + 0.04, 10), blot(sh, 1.2, SH * 0.6, 1.6, "khaki", zLeg(s, "lo") + 0.04, -40));
    out.push(shape(th, [[-1.2, T * 0.45], [3.6, T * 0.45], [3.4, T * 0.72], [-1.0, T * 0.72]], "bottom", zLeg(s, "up") + 1));
    out.push(ink(sh, [[2.4, SH * 0.86], [-2.4, SH * 0.9]], 0.3, zLeg(s, "lo") + 0.05, false));
  }
  return out;
}
function rolledChinos(): Shape[] {
  const out = [...pelvis(), ink("pelvis", trPoly([[3.5, -3.6], [5.5, 6]]), 0.3, Z.pelvis + 0.2)];
  for (const s of SIDES) {
    const th = `leg${s}.up`;
    const sh = `leg${s}.lo`;
    out.push(shape(th, legPart("up", 0.2), "bottom", zLeg(s, "up")));
    out.push(shape(sh, legPart("lo", 0), "skin", zLeg(s, "lo")));                                                                                     // the bare ankle under the roll
    out.push(shape(sh, limb(SH * 0.8, plus(PROF.SH, 0.2), K, JOINT_ENDS, 1).map(([x, y]) => [x, Math.min(y, SH * 0.8)] as Pt), "bottom", zLeg(s, "lo") + 0.03));
    out.push(shape(sh, [[-3.2, SH * 0.72], [3.3, SH * 0.72], [3.2, SH * 0.84], [-3.1, SH * 0.84]], "bottom", zLeg(s, "lo") + 0.05));               // the rolled hem
    out.push(ink(sh, [[-3.0, SH * 0.78], [3.1, SH * 0.78]], 0.24, zLeg(s, "lo") + 0.06, false));
    out.push(ink(th, [[1.4, T * 0.15], [1.2, T * 0.8]], 0.24, zLeg(s, "up") + 0.05));
  }
  return out;
}
function carpenter(): Shape[] {
  const out = [...pelvis(), ink("pelvis", trPoly([[3.5, -3.6], [5.5, 6]]), 0.3, Z.pelvis + 0.2)];
  for (const s of SIDES) {
    const th = `leg${s}.up`;
    const sh = `leg${s}.lo`;
    out.push(shape(th, legPart("up", 0.8), "bottom", zLeg(s, "up")));
    out.push(shape(sh, legPart("lo", 0.7), "bottom", zLeg(s, "lo")));
    // the double knee, the ruler pocket down the side and the hammer loop
    out.push(shape(th, [[-2.8, T * 0.78], [3.6, T * 0.78], [3.6, T + 0.4], [-2.6, T + 0.4]], "bottom", zLeg(s, "up") + 0.04));
    out.push(shape(sh, [[-2.6, -0.4], [3.6, -0.4], [3.4, SH * 0.32], [-2.4, SH * 0.32]], "bottom", zLeg(s, "lo") + 0.04));
    out.push(ink(sh, [[-2.4, SH * 0.32], [3.4, SH * 0.32]], 0.26, zLeg(s, "lo") + 0.05, false), ink(th, [[-2.6, T * 0.78], [3.5, T * 0.78]], 0.26, zLeg(s, "up") + 0.05, false));
    out.push(shape(th, [[-3.4, T * 0.3], [-1.4, T * 0.3], [-1.4, T * 0.68], [-3.4, T * 0.68]], "accent", zLeg(s, "up") + 0.05));
    out.push(ink(th, [[-1.0, T * 0.12], [-1.8, T * 0.24], [-1.0, T * 0.34]], 0.3, zLeg(s, "up") + 0.06, false));
  }
  return out;
}
export const LOOK_BOTTOMS: readonly Shape[][] = [...BOTTOMS, trackPants(), shorts(), workTrousers(),
  cargoShorts(), baggyJeans(), camoTrousers(), rolledChinos(), carpenter()];

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

// ------------------------------------------------------------ shoes, content v3 batch 4
const RUNNER: Poly = [[-5.8, -5.0], [3.6, -5.4], [8.4, -2.2], [16.6, -0.4], [21.4, 2.0], [21.8, 6.0], [-6.6, 6.0], [-7.4, 1.6]];
const RUN_SOLE: Poly = [[-7.6, 3.6], [-3.0, 4.2], [8, 4.6], [22.4, 4.0], [22.8, 8.2], [-7.4, 8.4]];
function runners(): Shape[] {
  const out: Shape[] = [];
  for (const s of SIDES) {
    const b = `foot${s}`;
    out.push(shape(b, fk(RUNNER), "shoes", zFoot(s)));
    out.push(shape(b, fk(RUN_SOLE), "white", zFoot(s) + 0.1));
    out.push(shape(b, fk([[0, -1.4], [6.0, -2.6], [12.0, 1.6], [7.0, 3.4], [2.6, 1.2]]), "accent", zFoot(s) + 0.12));                               // the side flash
    out.push(ink(b, fk([[3.6, -4.4], [6.6, -2.2]]), 0.3, zFoot(s) + 0.2), ink(b, fk([[5.6, -3.6], [8.6, -1.6]]), 0.26, zFoot(s) + 0.2));            // laces
    out.push(ink(b, fk([[-6.4, 6.4], [22.0, 6.2]]), 0.24, zFoot(s) + 0.2, false));
  }
  return out;
}
const COMBAT: Poly = [[-6.0, -10.4], [4.2, -10.8], [4.8, -3.2], [8.6, -1.2], [16.8, 0.6], [21.4, 3.0], [21.8, 7], [-6.8, 7], [-7.4, 2.0]];
/** A tall boot's shaft rides on the shin bone (the trousers tucked in), so it bends at the ankle with
 *  the leg; the foot part on the foot bone covers the seam. */
const SHAFT_FROM = 0.6;
function combatBoots(): Shape[] {
  const out: Shape[] = [];
  for (const s of SIDES) {
    const b = `foot${s}`;
    const sh = `leg${s}.lo`;
    const zs = zLeg(s, "lo") + 0.5;
    out.push(shape(sh, limb(SH, plus(PROF.SH, 1.1), K, JOINT_ENDS, 1).map(([x, y]) => [x, Math.max(y, SH * SHAFT_FROM)] as Pt), "shoes", zs));
    out.push(shape(sh, [[-3.3, SH * SHAFT_FROM - 0.4], [3.4, SH * SHAFT_FROM - 0.4], [3.4, SH * SHAFT_FROM + 1.0], [-3.3, SH * SHAFT_FROM + 1.0]], "shoes", zs + 0.02));   // the padded collar
    for (let i = 0; i < 3; i++) out.push(ink(sh, [[0.6, SH * (SHAFT_FROM + 0.1 + i * 0.1)], [2.6, SH * (SHAFT_FROM + 0.14 + i * 0.1)]], 0.26, zs + 0.04));   // the lacing up the shaft
    out.push(shape(b, fk(COMBAT), "shoes", zFoot(s)));
    out.push(shape(b, fk([[-7.6, 5.0], [22.4, 5.0], [22.4, 8.0], [-7.6, 8.0]]), "rubber", zFoot(s) + 0.1));
    out.push(ink(b, fk([[1.6, -8.0], [4.4, -6.4]]), 0.28, zFoot(s) + 0.2), ink(b, fk([[3.0, -4.4], [6.2, -2.6]]), 0.28, zFoot(s) + 0.2));
  }
  return out;
}
const SLIP: Poly = [[-5.6, -2.2], [3.0, -2.8], [8.2, -1.0], [16.4, 0.6], [21.2, 2.8], [21.6, 6.6], [-6.4, 6.6], [-7.0, 2.4]];
function slipOns(): Shape[] {
  const out: Shape[] = [];
  for (const s of SIDES) {
    const b = `foot${s}`;
    out.push(shape(b, fk(SLIP), "shoes", zFoot(s)));
    out.push(shape(b, fk([[-7, 4.8], [22.2, 4.8], [22.2, 7.6], [-7, 7.6]]), "white", zFoot(s) + 0.1));
    out.push(ink(b, fk([[-6.8, 5.8], [22.0, 5.8]]), 0.22, zFoot(s) + 0.2, false));                                                                 // the sole's stripe
    out.push(shape(b, fk([[15.0, 0.2], [17.4, 1.0], [21.2, 2.8], [21.6, 4.8], [15.0, 4.8]]), "white", zFoot(s) + 0.12));                          // the rubber toe
    out.push(ink(b, fk([[1.6, -2.4], [3.4, 0.6]]), 0.26, zFoot(s) + 0.2));                                                                         // the elastic gore
  }
  return out;
}
const CHELSEA: Poly = [[-5.4, -12.4], [3.8, -12.8], [4.4, -3.4], [8.6, -1.4], [16.8, 0.4], [21.6, 2.6], [22.2, 6.2], [-6.4, 6.2], [-7.0, 1.6]];
function chelseaBoots(): Shape[] {
  const out: Shape[] = [];
  for (const s of SIDES) {
    const b = `foot${s}`;
    out.push(shape(b, fk(CHELSEA), "shoes", zFoot(s)));
    out.push(shape(b, fk([[-1.6, -12.6], [2.6, -12.8], [1.4, -4.4], [0.2, -4.4]]), "accent", zFoot(s) + 0.1));                                    // the elastic side panel
    out.push(shape(b, fk([[-6.2, -15.2], [-3.6, -15.2], [-3.8, -12.0], [-6.0, -12.0]]), "accent", zFoot(s) + 0.11));                              // the pull tab
    out.push(shape(b, fk([[-7, 5.0], [22.6, 5.0], [22.6, 7.4], [-7, 7.4]]), "shoes", zFoot(s) + 0.12));
    out.push(ink(b, fk([[-6.6, 5.0], [22.2, 5.0]]), 0.26, zFoot(s) + 0.2, false));
  }
  return out;
}
export const LOOK_SHOES: readonly Shape[][] = [...SHOES, highTops(), workShoes(), runners(), combatBoots(), slipOns(), chelseaBoots()];

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
  headwear: LOOK_HEADWEAR,
  crownwear: LOOK_CROWNWEAR,
};
