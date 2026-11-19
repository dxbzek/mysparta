/**
 * Body equipment (content v3, batch 2, plan 13.12): the 30 pieces drawn on the fighter, in style 13,
 * on the bones of their slot, and their 28 and 44 px icons. Drawn in the same sampler space as the
 * look parts (gate/parts: `hd` for the head, `tr` for the trunk, `fk` for the feet, limb frames for
 * arms and legs), at the z of the part each covers plus a little, so every piece turns, bends and
 * flinches with the body it sits on. Real objects' own colours (style FIXED: yellow, denim, rubber,
 * green, leather, khaki, suede, visor), one ink outline and the engine's teal shadow, like the rest.
 *
 * What each piece is: `GEAR_META[id].look` in the core. Gloves repaint the hands (`hands`), jackets
 * the sleeves (`arms`), trousers the bottom (`bottom`), so they follow every finger and crease.
 */
import type { GearId } from "@rankzero/core";
import { GEAR_IDS, RARITY_OF } from "@rankzero/core";
import type { ColourSlot, GearArt, IconArt, Shape } from "../contracts";
import { K, PROPORTION } from "../gate/skeleton";
import type { Poly, Pt } from "../gate/vocab";
import { dPoly, limb, roundRect } from "../gate/vocab";
import { fk } from "../gate/parts/clothes";
import type { Side } from "../gate/parts/kit";
import { PROF, SIDES, Z, hdPoly, ink, shape, trPoly } from "../gate/parts/kit";
import { RARITY_TONE, band, circ, fitLine, flat, inkOf, solid } from "./icons";

type IconShape = IconArt["shapes"][number];

// ------------------------------------------------------------------------------- helpers
const HZ = 44.5;                       // over the hair (44)
const head = (poly: Poly, slot: ColourSlot, z = HZ, shade?: Poly): Shape => shape("head", hdPoly(poly), slot, z, shade === undefined ? undefined : hdPoly(shade));
const headInk = (pts: Poly, w: number, z = HZ + 0.2): Shape => ink("head", hdPoly(pts), w, z);
const TZ = Z.torso + 0.6;              // over the top's own shapes (31.0 to 31.2), under the head
const torso = (poly: Poly, slot: ColourSlot, z = TZ): Shape => shape("torso", trPoly(poly), slot, z);
const torsoInk = (pts: Poly, w: number, z = TZ + 0.2): Shape => ink("torso", trPoly(pts), w, z);
const zArm = (s: Side, part: "up" | "lo"): number => (s === "F" ? (part === "up" ? Z.armFup : Z.armFlo) : (part === "up" ? Z.armBup : Z.armBlo));
const zLeg = (s: Side, part: "up" | "lo"): number => (s === "F" ? (part === "up" ? Z.legFup : Z.legFlo) : (part === "up" ? Z.legBup : Z.legBlo));
const zFoot = (s: Side): number => (s === "F" ? Z.footF : Z.footB);
const zHand = (s: Side): number => (s === "F" ? Z.handF : Z.handB);
const T = PROPORTION.thigh;
const S = PROPORTION.shin;
const FL = PROPORTION.forearm;
const UL = PROPORTION.upperArm;
/** A rectangle across a limb, `x0..x1` across (front +), `t0..t1` along (0 joint, 1 far end). */
const across = (len: number, x0: number, x1: number, t0: number, t1: number): Pt[] => [[x0, t0 * len], [x1, t0 * len], [x1, t1 * len], [x0, t1 * len]];
/** A fist point (u along the held item, v toward the wrist) in the hand frame (gate/parts/hands). */
const fist = (q: readonly [number, number]): Pt => [q[0] * K, PROPORTION.grip - q[1] * K];
const FIST: Poly = [[-4.8, -4.4], [4.6, -4.8], [5.7, -1.2], [5.2, 4.4], [3.0, 7.0], [-3.0, 7.0], [-5.4, 3.6], [-5.9, -1.0]];
/** A sleeve over a limb, a little wider than the bare arm (a jacket over a vest top). */
const sleeve = (part: "up" | "lo", extra: number): Pt[] =>
  limb(part === "up" ? UL : FL, (part === "up" ? PROF.UA : PROF.FA).map(([t, a, b]) => [t, a + extra, b + extra] as const), K, 9, 1);
/** The torso outline, pushed out by `k` (a vest or a jacket over the top). */
const TORSO_OVER: Poly = [[-9.8, 3.6], [-10.2, -8], [-9.2, -20], [-11.2, -34], [-12.2, -44], [-9.6, -51.6], [-3.8, -55.2], [3.8, -55.2], [9, -51.6], [12.4, -44], [13, -36], [11, -28], [10, -18], [10.4, -6], [10, 3.6]];
/** A vest: the torso outline open at the neck in a V. */
const VEST: Poly = [[-9.8, 0.6], [-10.2, -8], [-9.2, -20], [-11.2, -34], [-12.2, -44], [-9.8, -50.6], [-5.2, -53.6], [1.2, -42], [3.6, -54], [9.2, -51], [12.4, -44], [13, -36], [11, -28], [10, -18], [10.4, -6], [10.1, 0.6]];

/** The same shape on both sides' bones (back limbs first). */
function both(make: (s: Side) => Shape[]): Shape[] {
  return SIDES.flatMap(make);
}
function gloveCuff(s: Side, slot: ColourSlot, long: number, flare: number): Shape[] {
  // up the forearm from the wrist: `long` of the forearm, flared by `flare` at its top
  const z = zArm(s, "lo") + 0.3;
  const t0 = 1 - long;
  const poly: Pt[] = [[-2.4 - flare, t0 * FL], [2.6 + flare, t0 * FL], [2.3, FL + 0.6], [-2.1, FL + 0.6]];
  return [shape(`arm${s}.lo`, poly, slot, z), ink(`arm${s}.lo`, [[-2.2 - flare * 0.8, (t0 + 0.12) * FL], [2.4 + flare * 0.8, (t0 + 0.12) * FL]], 0.3, z + 0.05, false)];
}

// ---------------------------------------------------------------------------------- head
const HEAD_GEAR: Record<"bandana" | "beanie" | "hard-hat" | "goggles" | "welding-mask" | "motorbike-helmet", GearArt> = {
  // a red cloth band round the brow, knotted at the back with two tails
  bandana: { slot: "head", hide: ["headwear"], shapes: [
    head([[9.9, -15.2], [10.0, -18.4], [4, -20.2], [-4, -20.0], [-10.6, -17.8], [-11.2, -14.6], [-4, -16.2], [3, -16.4]], "sign"),
    head([[-10.4, -17.4], [-15.8, -13.4], [-14.8, -11.2], [-10.2, -14.6]], "sign", HZ - 1.2),
    head([[-10.6, -16.4], [-13.4, -9.4], [-11.4, -8.8], [-9.8, -14.4]], "sign", HZ - 1.1),
    head([[-12.0, -18.0], [-9.4, -18.4], [-9.0, -15.4], [-11.8, -15.0]], "sign", HZ + 0.1),
    headInk([[8.6, -17.0], [2, -18.4], [-6, -17.8]], 0.32),
    headInk([[-1.5, -19.2], [-0.6, -17.2]], 0.26), headInk([[4.6, -19.4], [5.4, -17.4]], 0.26),
  ] },
  // a green knitted cap over the crown, a ribbed cuff over the brow
  beanie: { slot: "head", hide: ["crown", "headwear"], shapes: [
    head([[9.2, -17.0], [8.8, -23.2], [4.2, -27.4], [-3.2, -27.9], [-9.4, -24.6], [-11.8, -18.4], [-11.6, -15.6]], "green"),
    head([[10.3, -14.6], [10.0, -18.6], [-12.0, -18.0], [-11.8, -14.4], [-2, -16.0]], "green", HZ + 0.1),
    headInk([[6.4, -18.2], [6.6, -15.6]], 0.3, HZ + 0.3), headInk([[2.4, -18.4], [2.4, -15.9]], 0.3, HZ + 0.3),
    headInk([[-1.6, -18.3], [-1.6, -15.9]], 0.3, HZ + 0.3), headInk([[-5.6, -18.1], [-5.8, -15.6]], 0.3, HZ + 0.3),
    headInk([[-9.4, -17.9], [-9.6, -15.2]], 0.3, HZ + 0.3),
    headInk([[4, -24.6], [-2, -25.4], [-7.4, -22.6]], 0.28),
  ] },
  // a yellow builder's hard hat: a dome with a ridge and a short brim all round
  "hard-hat": { slot: "head", hide: ["crown", "headwear"], shapes: [
    head([[9.6, -18.6], [8.4, -24.4], [3.2, -28.6], [-4.2, -28.6], [-9.8, -24.6], [-11.2, -18.6]], "yellow"),
    head([[14.6, -19.0], [14.4, -17.2], [-12.8, -17.4], [-12.6, -19.4]], "yellow", HZ + 0.2),
    head([[1.0, -28.8], [-1.8, -28.9], [-2.2, -19.0], [0.6, -19.0]], "yellow", HZ + 0.1),
    headInk([[8.2, -21.2], [-9.4, -21.0]], 0.3, HZ + 0.15),
  ] },
  // work goggles over the eyes on a dark rubber strap round the head
  goggles: { slot: "head", hide: ["headwear"], shapes: [
    head([[4.0, -15.0], [-11.2, -14.6], [-11.0, -11.8], [4.0, -12.0]], "rubber", HZ - 0.3),
    head([[2.6, -16.2], [9.8, -16.4], [11.6, -13.6], [10.8, -9.8], [2.8, -9.6], [1.8, -12.8]], "metal", HZ + 0.1),
    head([[4.2, -14.8], [9.2, -14.9], [10.0, -13.4], [9.4, -11.2], [4.4, -11.0], [3.6, -12.8]], "visor", HZ + 0.2),
    head([[5.0, -14.2], [7.4, -14.4], [6.8, -13.4], [5.2, -13.2]], "white", HZ + 0.3),
  ] },
  // a dark welding mask over the whole face with a narrow viewing slot, hinged at the temple
  "welding-mask": { slot: "head", hide: ["face", "accessory"], shapes: [
    head([[4.2, -20.2], [10.6, -19.4], [13.6, -15.8], [14.4, -9.0], [13.4, -2.4], [11.0, 1.8], [6.0, 2.0], [3.6, -2.0], [3.0, -10.0]], "paint", HZ + 0.2),
    head([[7.8, -13.6], [13.9, -13.2], [13.9, -10.6], [7.8, -10.9]], "visor", HZ + 0.3),
    head([[4.2, -19.0], [-4.4, -22.4], [-9.6, -18.8], [-9.0, -16.8], [-4.0, -19.8], [3.8, -16.6]], "paint", HZ + 0.1),
    { bone: "head", d: dPoly(hdPoly(circ(1.0, -12.4, 1.6, 12))), slot: "metal", z: HZ + 0.25 },
    headInk([[12.4, -6.4], [10.4, -1.0]], 0.3, HZ + 0.4), headInk([[9.4, -16.4], [13.0, -16.0]], 0.3, HZ + 0.4),
  ] },
  // a cream full-face motorbike helmet with a dark visor and a chin bar
  "motorbike-helmet": { slot: "head", hide: ["hair", "face", "accessory"], shapes: [
    head([[13.6, -2.6], [12.6, 1.8], [6.4, 3.4], [-3.8, 2.0], [-11.4, -4.6], [-12.8, -13.6], [-10.8, -23.0], [-4.2, -28.6], [4.2, -28.6], [10.6, -24.4], [13.4, -17.2], [14.4, -10.0]], "white", HZ + 0.4,
      [[-3.8, 2.0], [-11.4, -4.6], [-12.8, -13.6], [-10.8, -23.0], [-8, -20], [-7.6, -6]]),
    head([[5.0, -17.4], [13.6, -16.4], [14.2, -9.4], [5.2, -9.4], [3.8, -13.4]], "visor", HZ + 0.5),
    headInk([[6.4, -16.2], [9.8, -15.8]], 0.5, HZ + 0.6),
    headInk([[6.0, -6.2], [12.6, -5.2]], 0.32, HZ + 0.6), headInk([[-1.6, -26.6], [-8.6, -21.6], [-10.6, -12.4]], 0.32, HZ + 0.6),
    head([[-3.6, -18.4], [-0.6, -18.6], [-0.4, -15.2], [-3.4, -15.0]], "sign", HZ + 0.55),
  ] },
};

// --------------------------------------------------------------------------------- torso
const HI_BAND = (y: number): Poly => [[-10.4, y], [10.8, y - 0.2], [10.8, y + 2.6], [-10.4, y + 2.8]];
const quilt = (ys: readonly number[]): Shape[] => ys.map((y) => torsoInk([[-10.6, y], [-2, y + 0.8], [11.2, y]], 0.3));
const TORSO_GEAR: Record<"work-vest" | "hi-vis-vest" | "padded-jacket" | "leather-jacket" | "hockey-chest-pad" | "tyre-rubber-vest", GearArt> = {
  // a khaki canvas work vest open at the neck, two chest pockets with flaps
  "work-vest": { slot: "torso", shapes: [
    torso(VEST, "khaki"),
    torso([[3.6, -40], [10.6, -40.4], [10.4, -32.4], [3.8, -32.2]], "khaki", TZ + 0.1),
    torso([[3.4, -41.2], [10.9, -41.6], [10.7, -38.4], [3.6, -38.2]], "khaki", TZ + 0.15),
    torso([[-8.6, -36], [-1.4, -36.4], [-1.6, -29.4], [-8.4, -29.2]], "khaki", TZ + 0.1),
    torsoInk([[1.6, -41], [1.4, -2]], 0.32), torsoInk([[-9.6, -12], [10.2, -12.2]], 0.28),
  ] },
  // an orange high-visibility vest with two silver bands
  "hi-vis-vest": { slot: "torso", shapes: [
    torso(VEST, "cone"),
    torso(HI_BAND(-26), "white", TZ + 0.1), torso(HI_BAND(-14), "white", TZ + 0.1),
    torsoInk([[1.6, -41], [1.4, -2]], 0.3, TZ + 0.2),
  ] },
  // a puffy blue quilted jacket, the quilting in rows, puffed sleeves
  "padded-jacket": { slot: "torso", arms: "paint", shapes: [
    torso([[-10.6, 4], [-11.2, -8], [-10.2, -20], [-12.2, -34], [-13.2, -44], [-10.4, -52.4], [-4, -56], [4, -56], [9.8, -52.4], [13.4, -44], [14, -36], [12, -28], [11, -18], [11.4, -6], [11, 4]], "paint"),
    ...quilt([-46, -38, -30, -22, -14, -6]),
    torso([[-5.8, -57.8], [3.6, -58.4], [7.0, -52.0], [0, -50.4], [-6.6, -52.6]], "paint", TZ + 0.3),
    torsoInk([[2.4, -50], [2.2, 3]], 0.34, TZ + 0.25),
    ...both((s) => [
      shape(`arm${s}.up`, sleeve("up", 1.8), "paint", zArm(s, "up") + 0.3),
      shape(`arm${s}.lo`, sleeve("lo", 1.6), "paint", zArm(s, "lo") + 0.3),
      ink(`arm${s}.up`, [[-3.0, UL * 0.5], [3.2, UL * 0.52]], 0.3, zArm(s, "up") + 0.35, false),
      ink(`arm${s}.lo`, [[-2.6, FL * 0.45], [2.8, FL * 0.47]], 0.3, zArm(s, "lo") + 0.35, false),
    ]),
  ] },
  // a black leather jacket, open over the shirt, a collar and a steel zip
  "leather-jacket": { slot: "torso", arms: "leather", shapes: [
    torso(TORSO_OVER, "leather"),
    torso([[1.2, -48], [6.0, -48.4], [5.4, 3.4], [1.0, 3.6]], "accent", TZ + 0.1),
    torso([[-6.4, -56.6], [4.0, -57.2], [7.2, -50.0], [3.4, -42.0], [1.4, -48.6], [-6.8, -51.0]], "leather", TZ + 0.3),
    torso([[5.6, -48.6], [9.4, -51.0], [11.6, -44.0], [6.4, -40.0]], "leather", TZ + 0.25),
    torsoInk([[6.2, -40], [5.8, 3]], 0.36, TZ + 0.3),
    torso([[-9.8, 0.4], [10.0, 0.2], [10.0, 3.6], [-9.8, 3.6]], "leather", TZ + 0.15),
    { bone: "torso", d: dPoly(trPoly(roundRect(5.0, -35, 1.6, 2.4, 0.4))), slot: "metal", z: TZ + 0.35 },
    ...both((s) => [
      shape(`arm${s}.lo`, [[-2.6, FL - 1.8], [2.8, FL - 1.8], [2.8, FL + 0.2], [-2.6, FL + 0.2]], "leather", zArm(s, "lo") + 0.2),
      ink(`arm${s}.lo`, [[-2.4, FL - 1.6], [2.6, FL - 1.6]], 0.34, zArm(s, "lo") + 0.25, false),
    ]),
  ] },
  // a hard cream hockey chest protector: plates on the chest, caps on the shoulders
  "hockey-chest-pad": { slot: "torso", shapes: [
    torso([[-10.6, -20], [-12.4, -34], [-13.0, -44], [-10.2, -52.6], [-4, -55.4], [4, -55.4], [10.2, -52.6], [13.6, -44], [14.2, -34], [12.8, -20], [1, -17]], "white"),
    torsoInk([[-11.4, -32], [1, -30], [13.4, -32]], 0.36), torsoInk([[-12.2, -42], [1, -40.4], [13.6, -42]], 0.36),
    torsoInk([[1.6, -53], [1.2, -19]], 0.3),
    torso([[-10.4, -18], [12.6, -18.4], [12.0, -12.6], [-9.8, -12.4]], "white", TZ + 0.1),
    ...both((s) => [
      shape(`arm${s}.up`, [...circ(0.2, 0.6, 4.4, 14, 3.6).filter(([, y]) => y <= 1.2), [4.4, 2.6], [-4.0, 2.6]], "white", zArm(s, "up") + 0.4),
      ink(`arm${s}.up`, [[-3.4, 1.6], [3.8, 1.6]], 0.32, zArm(s, "up") + 0.45, false),
    ]),
  ] },
  // a vest cut from old tyre rubber: the tread on the outside, laced at the side
  "tyre-rubber-vest": { slot: "torso", shapes: [
    torso(VEST, "rubber"),
    ...[-44, -36, -28, -20, -12, -4].map((y): Shape => torso([[3.6, y], [10.6, y + 2.6], [10.6, y + 5.0], [3.6, y + 2.4], [-3.8, y + 5.0], [-9.8, y + 2.6], [-9.8, y + 0.2], [-3.8, y + 2.6]], "metal", TZ + 0.1)),
    torsoInk([[11.2, -30], [9.6, -27], [11.2, -24], [9.6, -21], [11.0, -18]], 0.32, TZ + 0.3),
  ] },
};

// --------------------------------------------------------------------------------- hands
const FIST_BIG: Poly = FIST.map(([u, v]) => [u * 1.34 + 0.4, v * 1.3 + 0.4] as [number, number]);
const HAND_GEAR: Record<"work-gloves" | "taped-fists" | "rubber-gloves" | "fingerless-gloves" | "oven-mitts" | "welding-gloves", GearArt> = {
  // tan work gloves with a suede cuff at the wrist
  "work-gloves": { slot: "hands", hands: "denim", shapes: both((s) => [
    ...gloveCuff(s, "suede", 0.22, 0.4),
    ink(`hand${s}`, [fist([-4.6, -2.6]), fist([5.2, -2.8])], 0.28, zHand(s) + 0.15),
  ]) },
  // white tape wound round the knuckles and the wrist
  "taped-fists": { slot: "hands", shapes: both((s) => [
    shape(`hand${s}`, [fist([-5.4, -4.6]), fist([4.9, -5.0]), fist([5.5, -2.2]), fist([-5.9, -1.8])], "white", zHand(s) + 0.5),
    shape(`hand${s}`, [fist([-5.9, 0.2]), fist([5.6, -0.2]), fist([5.4, 2.4]), fist([-5.6, 2.6])], "white", zHand(s) + 0.5),
    ink(`hand${s}`, [fist([-5.2, -3.4]), fist([5.0, -3.6])], 0.24, zHand(s) + 0.55),
    shape(`arm${s}.lo`, [[-2.3, FL - 2.6], [2.5, FL - 2.6], [2.4, FL + 0.6], [-2.2, FL + 0.6]], "white", zArm(s, "lo") + 0.3),
    ink(`arm${s}.lo`, [[-2.1, FL - 1.2], [2.3, FL - 1.0]], 0.24, zArm(s, "lo") + 0.35, false),
  ]) },
  // long yellow rubber gloves up the forearm, a rolled rim
  "rubber-gloves": { slot: "hands", hands: "yellow", shapes: both((s) => [
    ...gloveCuff(s, "yellow", 0.62, 0.7),
  ]) },
  // black fingerless gloves: the fingertips stay bare
  "fingerless-gloves": { slot: "hands", hands: "leather", shapes: both((s) => [
    shape(`hand${s}`, [fist([1.6, 3.6]), fist([5.3, 3.4]), fist([5.0, 4.6]), fist([3.0, 7.0]), fist([1.4, 7.0])], "skin", zHand(s) + 0.2),
    shape(`hand${s}:open`, [[-2.6, 6.2], [3.0, 6.0], [3.4, 9.2], [-2.8, 9.4]], "skin", zHand(s) + 0.2),
    shape(`arm${s}.lo`, [[-2.3, FL - 1.4], [2.5, FL - 1.4], [2.4, FL + 0.6], [-2.2, FL + 0.6]], "leather", zArm(s, "lo") + 0.3),
  ]) },
  // big red padded oven mitts with a checked cloth, a cream cuff
  "oven-mitts": { slot: "hands", hands: "sign", shapes: both((s) => [
    shape(`hand${s}`, FIST_BIG.map(fist), "sign", zHand(s) + 1.6),
    shape(`hand${s}`, [fist([-6.2, 1.2]), fist([3.6, -0.6]), fist([5.6, 1.8]), fist([-5.0, 4.6])], "sign", zHand(s) + 1.7),
    ink(`hand${s}`, [fist([-3.4, -5.8]), fist([-3.2, 8.4])], 0.28, zHand(s) + 1.8, false),
    ink(`hand${s}`, [fist([1.4, -6.2]), fist([1.6, 8.6])], 0.28, zHand(s) + 1.8, false),
    ink(`hand${s}`, [fist([-7.2, 3.2]), fist([7.4, 2.6])], 0.28, zHand(s) + 1.8, false),
    shape(`hand${s}:open`, [[-3.6, -1.0], [3.8, -1.0], [4.6, 7.2], [1.0, 10.4], [-3.4, 9.6], [-4.6, 4.0]], "sign", zHand(s) + 1.6),
    shape(`hand${s}:open`, [[-3.2, 1.6], [-6.8, 3.6], [-6.0, 6.0], [-2.8, 5.0]], "sign", zHand(s) + 1.7),
    shape(`arm${s}.lo`, [[-2.8, FL - 2.6], [3.0, FL - 2.6], [3.0, FL + 0.8], [-2.8, FL + 0.8]], "white", zArm(s, "lo") + 0.3),
  ]) },
  // heavy suede welding gauntlets up to the mid forearm, a leather trim
  "welding-gloves": { slot: "hands", hands: "green", shapes: both((s) => [
    ...gloveCuff(s, "green", 0.55, 1.4),
    shape(`arm${s}.lo`, [[-3.8, 0.45 * FL - 0.4], [4.0, 0.45 * FL - 0.4], [4.0, 0.45 * FL + 1.0], [-3.8, 0.45 * FL + 1.0]], "leather", zArm(s, "lo") + 0.4),
    ink(`hand${s}`, [fist([-1.0, -4.8]), fist([-1.2, 6.6])], 0.26, zHand(s) + 0.15),
  ]) },
};

// ---------------------------------------------------------------------------------- legs
const LEG_GEAR: Record<"ripped-jeans" | "cargo-pants" | "knee-pads" | "track-pants" | "magazine-shin-guards" | "overalls", GearArt> = {
  // blue jeans torn open at the knees, the skin showing through
  "ripped-jeans": { slot: "legs", bottom: "denim", shapes: both((s) => [
    shape(`leg${s}.lo`, [[1.0, -1.2], [3.6, -1.6], [4.0, 1.4], [3.2, 2.8], [1.8, 2.2], [0.6, 1.0]], "skin", zLeg(s, "lo") + 0.3),
    ink(`leg${s}.lo`, [[0.8, -1.6], [4.0, -2.0]], 0.3, zLeg(s, "lo") + 0.35, false),
    ink(`leg${s}.lo`, [[0.8, 2.6], [3.4, 3.2]], 0.3, zLeg(s, "lo") + 0.35, false),
    shape(`leg${s}.up`, across(T, 1.4, 3.6, 0.42, 0.5), "skin", zLeg(s, "up") + 0.3),
    ink(`leg${s}.up`, [[-0.4, T * 0.1], [-0.2, T * 0.9]], 0.26, zLeg(s, "up") + 0.35),
  ]) },
  // khaki cargo trousers with a big flapped pocket on each thigh
  "cargo-pants": { slot: "legs", bottom: "khaki", shapes: both((s) => [
    shape(`leg${s}.up`, [[-1.8, T * 0.4], [4.6, T * 0.4], [4.4, T * 0.76], [-1.6, T * 0.76]], "khaki", zLeg(s, "up") + 1.1),
    shape(`leg${s}.up`, [[-2.0, T * 0.36], [4.8, T * 0.36], [4.7, T * 0.47], [-1.9, T * 0.47]], "khaki", zLeg(s, "up") + 1.2),
    ink(`leg${s}.lo`, [[2.6, S * 0.88], [-2.6, S * 0.92]], 0.3, zLeg(s, "lo") + 0.2, false),
  ]) },
  // hard black knee pads strapped over the knees
  "knee-pads": { slot: "legs", shapes: both((s) => [
    shape(`leg${s}.lo`, [[-2.6, -2.8], [2.8, -3.6], [5.4, -1.2], [5.6, 2.6], [3.6, 5.0], [-2.4, 4.8]], "rubber", zLeg(s, "lo") + 0.4),
    shape(`leg${s}.lo`, [[0.6, -2.4], [4.8, -1.6], [5.2, 2.2], [3.2, 4.2], [0.4, 2.6]], "white", zLeg(s, "lo") + 0.45),
    ink(`leg${s}.lo`, [[-3.4, 4.2], [-2.6, 6.2]], 0.32, zLeg(s, "lo") + 0.5, false),
  ]) },
  // dark navy track trousers with two cream stripes down the side
  "track-pants": { slot: "legs", bottom: "visor", shapes: both((s) => [
    shape(`leg${s}.up`, across(T, -0.4, 0.6, 0.02, 1.0), "white", zLeg(s, "up") + 0.3),
    shape(`leg${s}.up`, across(T, 1.2, 2.2, 0.02, 1.0), "white", zLeg(s, "up") + 0.3),
    shape(`leg${s}.lo`, across(S, -0.5, 0.5, 0.0, 0.95), "white", zLeg(s, "lo") + 0.3),
    shape(`leg${s}.lo`, across(S, 1.1, 2.1, 0.0, 0.95), "white", zLeg(s, "lo") + 0.3),
  ]) },
  // rolled magazines taped round both shins: a red title strip, grey tape bands
  "magazine-shin-guards": { slot: "legs", shapes: both((s) => [
    shape(`leg${s}.lo`, [[-3.4, S * 0.18], [4.6, S * 0.16], [4.4, S * 0.78], [-3.2, S * 0.8]], "white", zLeg(s, "lo") + 0.4),
    shape(`leg${s}.lo`, across(S, 1.6, 4.2, 0.2, 0.74), "sign", zLeg(s, "lo") + 0.45),
    shape(`leg${s}.lo`, across(S, -3.8, 4.9, 0.26, 0.33), "metal", zLeg(s, "lo") + 0.5),
    shape(`leg${s}.lo`, across(S, -3.6, 4.7, 0.62, 0.69), "metal", zLeg(s, "lo") + 0.5),
    ink(`leg${s}.lo`, [[-0.8, S * 0.36], [-0.6, S * 0.6]], 0.26, zLeg(s, "lo") + 0.5),
  ]) },
  // denim work overalls: the bib up the chest on a strap, steel buttons
  overalls: { slot: "legs", bottom: "denim", shapes: [
    torso([[-9.2, 3.6], [-9.6, -8], [-8.8, -22], [-8.0, -38], [10.0, -38.4], [9.6, -22], [9.8, -8], [9.6, 3.6]], "denim", TZ - 0.2),
    torso([[3.2, -37.6], [7.4, -37.8], [3.6, -54.6], [-0.4, -54.2]], "denim", TZ - 0.1),
    torso([[-0.4, -30], [7.6, -30.2], [7.4, -22], [-0.2, -21.8]], "denim", TZ - 0.15),
    { bone: "torso", d: dPoly(trPoly(circ(5.4, -36.2, 1.1, 10))), slot: "metal", z: TZ },
    torsoInk([[-8.6, -36.6], [9.4, -37.0]], 0.3, TZ - 0.05),
    ...both((s) => [ink(`leg${s}.up`, [[2.6, T * 0.2], [2.4, T * 0.6]], 0.26, zLeg(s, "up") + 0.3)]),
  ] },
};

// ---------------------------------------------------------------------------------- feet
const foot = (s: Side, poly: Poly, slot: ColourSlot, dz = 0.3): Shape => shape(`foot${s}`, fk(poly), slot, zFoot(s) + dz);
const footInk = (s: Side, pts: Poly, w: number, dz = 0.5): Shape => ink(`foot${s}`, fk(pts), w, zFoot(s) + dz);
const SHOE: Poly = [[-5.8, -4.0], [3.8, -4.6], [8.4, -1.8], [16.6, 0.2], [21.6, 2.6], [22.0, 7.0], [-6.6, 7.0], [-7.2, 2.4]];
const FEET_GEAR: Record<"sneakers" | "flip-flops" | "rain-boots" | "skate-shoes" | "steel-toe-boots" | "slippers", GearArt> = {
  // white sneakers with a red side stripe, laces and a cream sole
  sneakers: { slot: "feet", hide: ["shoes"], shapes: both((s) => [
    foot(s, SHOE, "white"),
    foot(s, [[-7.2, 4.8], [22.4, 4.8], [22.4, 7.6], [-7.2, 7.6]], "khaki", 0.35),
    foot(s, [[0, 3.6], [8, -0.4], [12, 0.8], [3.4, 4.0]], "sign", 0.4),
    footInk(s, [[3.6, -3.6], [6.0, -1.0], [9.6, 0.4]], 0.3), footInk(s, [[5.2, -2.6], [6.6, -3.6]], 0.26), footInk(s, [[7.6, -1.0], [8.8, -2.2]], 0.26),
  ]) },
  // blue rubber flip-flops: the bare foot, a thin sole and a thong strap between the toes
  "flip-flops": { slot: "feet", hide: ["shoes"], shapes: both((s) => [
    foot(s, [[-5.4, -3.4], [3.6, -4.0], [8.2, -1.4], [16.4, 0.6], [20.8, 2.6], [21.2, 5.6], [-6.2, 5.6], [-6.8, 2.2]], "skin"),
    foot(s, [[-7.4, 5.4], [22.6, 5.4], [22.6, 7.6], [-7.4, 7.6]], "paint", 0.35),
    foot(s, [[15.4, 1.2], [8.6, -1.4], [4.6, 0.6], [5.6, 2.0], [8.8, 0.6], [14.6, 2.6]], "paint", 0.4),
    footInk(s, [[18.4, 1.8], [18.6, 4.4]], 0.24), footInk(s, [[16.6, 1.4], [16.6, 4.2]], 0.24),
  ]) },
  // green rubber rain boots up the calf, a dark sole and a rolled rim
  "rain-boots": { slot: "feet", hide: ["shoes"], shapes: both((s) => [
    foot(s, [[-6.6, -25.0], [5.6, -25.4], [5.4, -4.0], [9.0, -1.6], [17.0, 0.4], [21.8, 2.8], [22.2, 7.0], [-7.0, 7.0], [-7.6, 2.0]], "green"),
    foot(s, [[-7.4, 4.8], [22.6, 4.8], [22.6, 7.6], [-7.4, 7.6]], "rubber", 0.35),
    foot(s, [[-7.4, -26.6], [6.4, -27.0], [6.4, -23.4], [-7.4, -23.2]], "green", 0.4),
    footInk(s, [[3.4, -20], [3.0, -6]], 0.28),
  ]) },
  // flat chunky navy skate shoes on a thick cream sole
  "skate-shoes": { slot: "feet", hide: ["shoes"], shapes: both((s) => [
    foot(s, [[-6.6, -4.8], [4.2, -5.4], [9.4, -2.4], [17.4, -0.4], [22.8, 2.0], [23.2, 7.0], [-7.6, 7.0], [-8.0, 1.8]], "visor"),
    foot(s, [[-8.0, 3.6], [23.4, 3.6], [23.4, 7.8], [-8.0, 7.8]], "white", 0.35),
    foot(s, [[-1.0, 1.8], [10.0, -0.6], [14.0, 1.0], [2.0, 3.2]], "white", 0.4),
    footInk(s, [[3.0, -4.4], [6.4, -1.2], [10.4, 0.2]], 0.3), footInk(s, [[-8.0, 5.6], [23.4, 5.6]], 0.26, 0.45),
  ]) },
  // brown work boots laced up the ankle, a scuffed steel toe cap
  "steel-toe-boots": { slot: "feet", hide: ["shoes"], shapes: both((s) => [
    foot(s, [[-6.2, -12.4], [4.4, -12.8], [5.0, -3.4], [8.8, -1.4], [17.0, 0.4], [21.8, 2.8], [22.2, 7.0], [-7.0, 7.0], [-7.6, 2.0]], "suede"),
    foot(s, [[14.4, -0.4], [17.0, 0.4], [21.8, 2.8], [22.2, 5.6], [14.2, 5.6]], "metal", 0.4),
    foot(s, [[-7.4, 5.0], [22.6, 5.0], [22.6, 7.8], [-7.4, 7.8]], "rubber", 0.35),
    footInk(s, [[2.6, -11], [4.2, -9.4]], 0.28), footInk(s, [[2.6, -8], [4.2, -6.4]], 0.28), footInk(s, [[2.8, -5], [5.6, -2.6]], 0.28),
    footInk(s, [[-6.4, -10.8], [4.2, -11.2]], 0.3),
  ]) },
  // fluffy pink house slippers, the fur ruffled round the top
  slippers: { slot: "feet", hide: ["shoes"], shapes: both((s) => [
    foot(s, [[-6.8, -2.6], [-3.6, -4.2], [1.0, -3.4], [5.4, -5.0], [9.4, -2.6], [13.4, -3.6], [17.4, -0.6], [21.6, 0.4], [24.0, 4.0], [23.0, 7.6], [-7.0, 7.6], [-7.8, 2.2]], "pink"),
    foot(s, [[-7.4, 5.6], [23.6, 5.6], [23.6, 7.8], [-7.4, 7.8]], "white", 0.35),
    footInk(s, [[2.4, -2.2], [3.4, 0.4]], 0.3), footInk(s, [[8.2, -1.0], [9.0, 1.4]], 0.3), footInk(s, [[14.4, 0.4], [15.0, 2.8]], 0.3),
  ]) },
};

export const GEAR_ART: Record<GearId, GearArt> = { ...HEAD_GEAR, ...TORSO_GEAR, ...HAND_GEAR, ...LEG_GEAR, ...FEET_GEAR };

// --------------------------------------------------------------------------------- icons
/**
 * Gear icons: a stitched cloth tag in the rarity tone (gear's own frame, so it is told apart from
 * the skill badges, the Move stickers and the shield frame), the object in the middle as one bold
 * silhouette with its far-side teal shadow and at most a few ink details, readable at 28 px.
 */
function tagFrame(tone: ColourSlot): IconShape[] {
  const outer = roundRect(1.4, 1.4, 21.2, 21.2, 4.4, 4);
  const inner = roundRect(4.0, 4.0, 16.0, 16.0, 2.8, 4);
  const stitch: Poly[] = [];
  for (let i = 0; i < 7; i++) { const x = 5.0 + i * 2.2; stitch.push([[x, 2.7], [x + 1.0, 2.7]], [[x, 21.3], [x + 1.0, 21.3]]); }
  return [flat([outer], tone), flat([inner], "hair"), inkOf(stitch, 0.5)];
}
const ICON_PICS: Record<GearId, IconShape[]> = {
  bandana: [solid([[[5.0, 9.6], [12, 7.0], [19.6, 9.6], [19.2, 14.8], [12, 12.4], [5.4, 14.8]], [[5.6, 11.0], [3.6, 19.6], [7.0, 19.2], [8.0, 13.4]], [[6.6, 11.6], [10.4, 19.0], [12.6, 17.4], [8.8, 12.0]]], "sign"),
    flat([circ(10.0, 10.6, 0.9, 8), circ(14.4, 10.6, 0.9, 8)], "white")],
  beanie: [solid([[[5.0, 14.8], [5.6, 8.6], [9.2, 5.0], [14.8, 5.0], [18.4, 8.6], [19.0, 14.8]]], "green"), solid([roundRect(4.2, 14.0, 15.6, 5.0, 1.2)], "green"),
    inkOf([[[7.6, 14.6], [7.6, 18.4]], [[10.6, 14.6], [10.6, 18.4]], [[13.6, 14.6], [13.6, 18.4]], [[16.6, 14.6], [16.6, 18.4]]], 0.6)],
  "hard-hat": [solid([[[5.4, 15.0], [6.0, 9.4], [9.4, 5.6], [14.6, 5.6], [18.0, 9.4], [18.6, 15.0]], roundRect(2.6, 14.4, 18.8, 3.4, 1.4)], "yellow"), flat([roundRect(11.0, 5.0, 2.2, 10.0, 0.8)], "yellow"), inkOf([[[6.4, 11.4], [17.6, 11.4]]], 0.6)],
  goggles: [flat([roundRect(4.0, 10.4, 16.0, 3.2, 1.2)], "metal"), solid([roundRect(4.4, 6.6, 7.6, 10.4, 3.0), roundRect(12.0, 6.6, 7.6, 10.4, 3.0)], "metal"),
    flat([roundRect(5.8, 8.0, 4.8, 7.6, 2.0), roundRect(13.4, 8.0, 4.8, 7.6, 2.0)], "paint"), flat([roundRect(6.6, 8.8, 1.6, 2.6, 0.6), roundRect(14.2, 8.8, 1.6, 2.6, 0.6)], "white")],
  "welding-mask": [solid([[[6.4, 4.4], [16.4, 4.6], [18.6, 9.4], [18.4, 16.4], [15.0, 20.4], [9.0, 20.4], [5.6, 16.4], [5.4, 9.4]]], "paint"), flat([roundRect(7.4, 9.4, 9.2, 2.8, 0.6)], "visor"),
    flat([circ(5.0, 12.4, 1.4, 10), circ(19.0, 12.4, 1.4, 10)], "metal")],
  "motorbike-helmet": [solid([[[5.0, 16.6], [4.6, 9.6], [7.8, 5.0], [13.6, 4.2], [18.0, 6.6], [19.8, 11.4], [19.6, 17.6], [16.4, 19.8], [7.4, 19.8]]], "white"),
    flat([[[9.6, 8.6], [19.4, 9.2], [19.8, 13.6], [10.0, 13.6], [8.6, 11.0]]], "visor"), flat([roundRect(6.4, 10.0, 2.0, 3.6, 0.6)], "sign"), inkOf([[[11.4, 10.2], [14.6, 10.4]]], 0.8)],
  "work-vest": [solid([[[5.6, 6.0], [9.4, 4.4], [12, 11.0], [14.6, 4.4], [18.4, 6.0], [19.0, 20.0], [5.0, 20.0]]], "khaki"), flat([roundRect(13.4, 11.6, 4.2, 3.4, 0.4), roundRect(6.4, 11.6, 4.2, 3.4, 0.4)], "khaki"), inkOf([[[12, 11.6], [12, 19.6]]], 0.6)],
  "hi-vis-vest": [solid([[[5.6, 6.0], [9.4, 4.4], [12, 11.0], [14.6, 4.4], [18.4, 6.0], [19.0, 20.0], [5.0, 20.0]]], "cone"), flat([[[5.2, 12.0], [18.8, 12.0], [18.8, 14.0], [5.2, 14.0]], [[5.0, 16.4], [19.0, 16.4], [19.0, 18.4], [5.0, 18.4]]], "white")],
  "padded-jacket": [solid([[[4.0, 8.0], [8.6, 4.6], [15.4, 4.6], [20.0, 8.0], [20.4, 20.2], [3.6, 20.2]]], "paint"), inkOf([[[4.2, 11.4], [19.8, 11.4]], [[4.0, 14.8], [20.0, 14.8]], [[3.8, 18.0], [20.2, 18.0]], [[12, 5.4], [12, 20]]], 0.6)],
  "leather-jacket": [solid([[[4.0, 8.0], [8.4, 4.6], [10.6, 4.6], [10.6, 20.2], [3.6, 20.2]], [[20.0, 8.0], [15.6, 4.6], [13.4, 4.6], [13.4, 20.2], [20.4, 20.2]]], "leather"),
    flat([[[8.4, 4.6], [11.4, 10.4], [9.2, 11.8]], [[15.6, 4.6], [12.6, 10.4], [14.8, 11.8]]], "leather"), flat([roundRect(13.6, 13.0, 1.2, 2.4, 0.3)], "metal")],
  "hockey-chest-pad": [solid([[[4.4, 9.6], [6.4, 5.0], [17.6, 5.0], [19.6, 9.6], [18.8, 15.0], [12, 17.0], [5.2, 15.0]], roundRect(6.0, 16.4, 12.0, 3.6, 1.2)], "white"),
    inkOf([[[5.6, 10.2], [12, 11.2], [18.4, 10.2]], [[12, 5.6], [12, 16.4]]], 0.6)],
  "tyre-rubber-vest": [solid([[[5.6, 6.0], [9.4, 4.4], [12, 11.0], [14.6, 4.4], [18.4, 6.0], [19.0, 20.0], [5.0, 20.0]]], "rubber"),
    flat([[[6.0, 12.0], [12, 14.4], [18.0, 12.0], [18.0, 13.6], [12, 16.0], [6.0, 13.6]], [[5.6, 16.6], [12, 19.0], [18.4, 16.6], [18.4, 18.0], [12, 20.0], [5.6, 18.0]]], "metal")],
  "work-gloves": [solid([[[7.0, 20.0], [6.6, 11.0], [7.8, 5.6], [10.0, 5.4], [10.4, 9.6], [11.0, 4.6], [13.2, 4.6], [13.6, 9.6], [14.6, 5.4], [16.6, 5.8], [16.8, 11.4], [19.4, 9.2], [20.4, 10.8], [16.8, 16.0], [16.4, 20.0]]], "denim"),
    flat([roundRect(6.4, 16.8, 10.4, 3.6, 0.6)], "suede")],
  "taped-fists": [solid([[[6.0, 8.6], [8.4, 6.0], [16.4, 6.0], [18.6, 8.6], [18.6, 15.2], [16.4, 18.0], [8.6, 18.0], [6.0, 15.2]]], "skin"),
    flat([roundRect(5.4, 8.0, 13.8, 2.8, 0.6), roundRect(5.4, 12.0, 13.8, 2.8, 0.6), roundRect(7.6, 17.4, 9.4, 3.2, 0.6)], "white")],
  "rubber-gloves": [solid([[[8.4, 21.2], [7.6, 13.0], [6.6, 7.6], [8.4, 4.8], [10.2, 8.8], [10.6, 3.8], [12.6, 3.6], [13.2, 8.6], [14.4, 4.4], [16.4, 5.0], [16.0, 11.6], [18.8, 10.0], [19.6, 11.6], [16.4, 16.0], [16.6, 21.2]]], "yellow"),
    inkOf([[[8.0, 17.6], [16.6, 17.6]]], 0.6)],
  "fingerless-gloves": [solid([[[7.0, 20.0], [6.6, 11.4], [7.6, 8.4], [17.0, 8.4], [17.0, 12.0], [19.6, 10.0], [20.4, 11.6], [16.8, 16.0], [16.4, 20.0]]], "leather"),
    flat([roundRect(7.8, 4.8, 2.0, 4.0, 0.9), roundRect(10.6, 4.0, 2.0, 4.8, 0.9), roundRect(13.4, 4.4, 2.0, 4.4, 0.9)], "skin")],
  "oven-mitts": [solid([[[7.0, 20.4], [6.2, 11.0], [8.6, 5.0], [14.6, 4.6], [17.6, 9.0], [17.6, 13.0], [20.2, 11.6], [21.0, 14.4], [17.0, 17.6], [16.8, 20.4]]], "sign"),
    inkOf([[[10.4, 5.6], [10.0, 20.0]], [[14.2, 5.4], [13.8, 20.0]], [[6.6, 10.4], [17.6, 10.4]], [[6.8, 14.8], [17.4, 14.8]]], 0.5), flat([roundRect(6.4, 17.6, 10.8, 3.4, 0.6)], "white")],
  "welding-gloves": [solid([[[5.6, 21.2], [7.4, 12.4], [7.6, 7.0], [9.6, 6.4], [10.2, 9.8], [10.8, 5.0], [13.0, 4.8], [13.4, 9.8], [14.6, 6.0], [16.6, 6.4], [16.6, 11.6], [19.0, 10.0], [20.0, 11.8], [16.6, 16.0], [18.6, 21.2]]], "green"),
    flat([roundRect(6.4, 16.8, 11.4, 1.8, 0.4)], "leather")],
  "ripped-jeans": [solid([[[6.4, 4.4], [17.6, 4.4], [18.6, 20.4], [13.4, 20.4], [12, 9.4], [10.6, 20.4], [5.4, 20.4]]], "denim"),
    flat([[[6.6, 13.2], [9.4, 12.6], [9.0, 14.6], [6.4, 15.0]], [[14.8, 12.6], [17.6, 13.2], [17.8, 15.0], [15.0, 14.6]]], "skin")],
  "cargo-pants": [solid([[[6.4, 4.4], [17.6, 4.4], [18.6, 20.4], [13.4, 20.4], [12, 9.4], [10.6, 20.4], [5.4, 20.4]]], "khaki"),
    flat([roundRect(5.0, 10.6, 4.0, 4.6, 0.4), roundRect(15.0, 10.6, 4.0, 4.6, 0.4)], "khaki")],
  "knee-pads": [solid([[[7.0, 5.2], [16.6, 5.0], [18.4, 9.6], [18.0, 16.0], [15.4, 19.6], [8.4, 19.6], [6.0, 16.0], [5.6, 9.6]]], "rubber"), flat([[[8.8, 8.0], [15.0, 8.0], [16.2, 12.4], [12, 16.4], [7.8, 12.4]]], "metal"),
    flat([roundRect(3.0, 6.4, 18.0, 1.8, 0.6), roundRect(3.0, 16.2, 18.0, 1.8, 0.6)], "rubber")],
  "track-pants": [solid([[[6.4, 4.4], [17.6, 4.4], [18.6, 20.4], [13.4, 20.4], [12, 9.4], [10.6, 20.4], [5.4, 20.4]]], "visor"),
    flat([[[6.8, 5.2], [7.8, 5.2], [6.8, 20.0], [5.8, 20.0]], [[17.2, 5.2], [16.2, 5.2], [17.2, 20.0], [18.2, 20.0]]], "white")],
  "magazine-shin-guards": [solid([roundRect(7.2, 3.6, 9.6, 17.2, 2.4)], "white"), flat([roundRect(12.4, 4.6, 3.2, 15.2, 1.0)], "sign"),
    flat([roundRect(6.4, 6.6, 11.2, 2.4, 0.4), roundRect(6.4, 15.2, 11.2, 2.4, 0.4)], "metal")],
  overalls: [solid([[[7.6, 3.6], [9.4, 3.6], [9.6, 8.0], [14.4, 8.0], [14.6, 3.6], [16.4, 3.6], [16.6, 10.0], [18.6, 20.4], [13.4, 20.4], [12, 13.6], [10.6, 20.4], [5.4, 20.4], [7.4, 10.0]]], "denim"),
    flat([circ(9.2, 9.0, 0.9, 8), circ(14.8, 9.0, 0.9, 8)], "metal")],
  sneakers: [solid([[[3.0, 15.4], [3.6, 9.0], [9.4, 8.4], [12.6, 11.6], [19.0, 13.2], [21.4, 16.2], [21.4, 18.4], [2.8, 18.4]]], "white"), flat([roundRect(2.6, 17.0, 19.2, 2.6, 0.6)], "khaki"),
    flat([[[6.4, 15.6], [11.0, 11.6], [14.0, 12.6], [9.0, 15.8]]], "sign")],
  "flip-flops": [solid([roundRect(3.0, 15.0, 18.6, 3.4, 1.6)], "paint"), solid([[[4.2, 15.2], [5.2, 11.4], [11.0, 10.6], [17.0, 12.2], [20.0, 14.0], [20.0, 15.4]]], "skin"),
    flat([band([[16.4, 14.2], [11.6, 11.0], [8.0, 14.4]], 1.4)], "paint")],
  "rain-boots": [solid([[[5.4, 3.6], [12.6, 3.6], [12.8, 13.4], [18.6, 15.0], [20.6, 17.0], [20.6, 20.4], [4.8, 20.4]]], "green"), flat([roundRect(4.6, 18.6, 16.4, 2.2, 0.6)], "rubber"),
    flat([roundRect(4.6, 3.0, 8.8, 2.6, 0.8)], "green")],
  "skate-shoes": [solid([[[2.8, 15.0], [3.4, 8.4], [9.8, 7.8], [13.4, 11.0], [19.6, 12.4], [21.8, 15.0], [21.8, 16.4], [2.6, 16.4]]], "visor"), flat([roundRect(2.2, 15.6, 20.0, 4.4, 1.0)], "white"),
    flat([[[5.4, 14.0], [11.4, 11.0], [14.0, 12.4], [7.8, 14.6]]], "white")],
  "steel-toe-boots": [solid([[[4.6, 4.2], [11.4, 4.2], [11.8, 12.4], [18.2, 13.8], [21.0, 16.2], [21.0, 18.6], [4.0, 18.6]]], "suede"), flat([[[15.0, 13.0], [18.2, 13.8], [21.0, 16.2], [21.0, 18.0], [15.0, 18.0]]], "metal"),
    flat([roundRect(3.6, 17.8, 18.0, 2.6, 0.6)], "rubber"), inkOf([[[8.2, 6.4], [10.8, 7.6]], [[8.2, 9.2], [10.8, 10.4]]], 0.6)],
  slippers: [solid([[[3.0, 15.2], [4.2, 10.6], [7.0, 9.4], [9.4, 10.6], [12.0, 9.2], [14.6, 10.8], [17.4, 10.4], [20.4, 12.6], [21.6, 16.0], [20.6, 18.6], [3.2, 18.6]]], "pink"),
    flat([roundRect(2.8, 17.6, 19.0, 2.4, 0.8)], "white"), inkOf([[[7.0, 11.6], [7.4, 13.6]], [[12.0, 11.2], [12.4, 13.2]], [[16.6, 12.0], [17.0, 14.0]]], 0.6)],
};
export const GEAR_ICONS = Object.fromEntries(GEAR_IDS.map((id) => {
  const tone = RARITY_TONE[RARITY_OF[id]];
  // a pictogram in the frame's own tone would vanish: swap a clashing slot for cream
  return [id, { shapes: [...tagFrame(tone), ...ICON_PICS[id].map((s) => fitLine(s.slot === tone ? { ...s, slot: "white" } : s))] }];
})) as unknown as Record<GearId, IconArt>;
