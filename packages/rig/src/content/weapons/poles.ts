/**
 * Two-hand weapons on a shaft (poles and heavies) and the two-handle shears. The front hand is
 * at the origin, the back hand at `grip2` on the same shaft (the engine pins it there by IK).
 * Units and sign rules as in clubs.ts.
 */
import type { WeaponArt } from "../../contracts";
import type { Pt } from "../kit";
import { band, bar, blob, ellipsePoly, fillOf, fillsOf, line, lines, ngon, quad, ringPoly, rod, roundRect, scuffs, wraps } from "../kit";
import { FOIL_GRIP } from "./clubs";
import { weapon } from "./make";

/** Broom: a long stick and a stitched straw head; held like a staff, thrust head first. */
export const BROOM: WeaponArt = weapon([
  fillOf(rod(-18.5, 37, 0.8, 0.8), "wood", 0),
  fillOf(rod(-18.6, -16.4, 0.95, 0.6), "accent", 1),
  fillOf([[36.4, -1.7], [41, -3.4], [46.5, -5.1], [50.6, -5.8], [51.4, -4.2], [50.8, -2.4], [51.6, -0.6], [50.8, 1.2], [51.6, 3.0], [50.8, 4.6], [50.6, 5.8], [46.5, 5.1], [41, 3.4], [36.4, 1.7]], "metal", 2),
  fillOf(rod(35.4, 38.2, 1.55, 0.1), "metal", 3),
  lines([[[35.9, -1.5], [35.9, 1.5]], [[37.7, -1.5], [37.7, 1.5]]], 0.25, 4, false),
  lines([[[40.4, -3.1], [40.4, 3.1]], [[43.4, -4.0], [43.4, 4.0]]], 0.3, 4, false),
  lines([[[44, -2.6], [50.4, -4.4]], [[44, -0.9], [50.6, -1.6]], [[44, 0.8], [50.6, 1.0]], [[44, 2.5], [50.4, 3.6]], [[45, -3.8], [50, -5.2]], [[45, 3.6], [50, 5.0]]], 0.18, 4),
  lines([[[-12, -0.3], [10, -0.35]], [[14, 0.3], [32, 0.3]]], 0.18, 4),
], [50.6, 0], { grip2: [-10, 0] });

/** Pitchfork: a long ash shaft, a steel ferrule and yoke, four tines; low two-hand thrust, the tines hit. */
const TINE = (y: number, bend: number): Pt[] => {
  const pts = quad([33.4, y], [41, y + bend * 0.2], [47.6, y - bend], 6);
  const out: Pt[] = [];
  const back: Pt[] = [];
  pts.forEach((p, i) => { const h = 0.48 - (0.4 * i) / (pts.length - 1); out.push([p[0], p[1] - h]); back.push([p[0], p[1] + h]); });
  return [...out, ...back.reverse()];
};
export const PITCHFORK: WeaponArt = weapon([
  fillOf(rod(-22.5, 31, 0.82, 0.8), "wood", 0),
  fillOf(bar(29.4, 33.6, [[0, 0.95], [1, 1.25]], 0.1), "metal", 1),
  fillOf(band(quad([34.6, -4.9], [32.4, 0], [34.6, 4.9], 8), 1.6), "metal", 1.2),
  fillsOf([TINE(-4.2, -0.6), TINE(-1.4, 0), TINE(1.4, 0), TINE(4.2, 0.6)], "metal", 1.4),
  lines([[[-16, -0.3], [10, -0.35]], [[14, 0.3], [28, 0.3]]], 0.18, 2),
  blob(31.4, 0, 0.35, 0.35, 2, 8),
], [47.4, -1.4], { grip2: [-10, 0] });

/** Shovel: a D-grip, a long shaft, a pointed steel blade; lifted overhead, brought down flat,
 *  the flat of the blade hits. */
export const SHOVEL: WeaponArt = weapon([
  fillOf(rod(-16.5, 29, 0.86, 0.2), "wood", 0),
  fillOf(ringPoly(-19.6, 0, 1.5, 2.6, 18, 2.3, 3.4), "metal", 1),
  fillOf(bar(26, 31.5, [[0, 1.0], [1, 1.7]], 0), "metal", 1.2),
  fillOf([[29.2, -1.7], [31, -4.6], [32.2, -5.7], [42, -5.9], [45.6, -4.1], [47.6, 0], [45.6, 4.1], [42, 5.9], [32.2, 5.7], [31, 4.6], [29.2, 1.7]], "metal", 2),
  line([[30.5, 0], [41, 0]], 0.35, 3),
  fillOf(ellipsePoly(38, -3, 1.6, 1.0, 9), "wood", 2.5), fillOf(ellipsePoly(43, 3.2, 1.2, 0.8, 9), "wood", 2.5),
  scuffs(201, 7, 33, 45, -4.6, 4.6, 3, 0.24),
  lines([[[-10, -0.3], [8, -0.35]], [[12, 0.3], [25, 0.3]]], 0.18, 3),
], [40, 0], { grip2: [-10, 0] });

/** Sledgehammer: a long hickory haft with tape at the butt and a big steel head; hands apart,
 *  a slow overhead arc, the head's lower face hits. */
export const SLEDGEHAMMER: WeaponArt = weapon([
  fillOf(bar(-14.5, 30, [[0, 1.05], [0.7, 0.88], [1, 1.15]], 0.5), "wood", 0),
  fillOf(rod(-14.5, -6.5, 1.2, 0.5), "accent", 1),
  wraps(-14.5, -6.5, 1.2, 1.4, 2),
  fillOf(roundRect(27.6, -8.2, 8.6, 16.4, 1.1), "metal", 3),
  fillOf(roundRect(27.2, -8.8, 9.4, 2.2, 0.6), "metal", 3.5),
  fillOf(roundRect(27.2, 6.6, 9.4, 2.2, 0.6), "metal", 3.5),
  lines([[[29, -3.2], [29, 3.2]], [[31.9, -1.4], [31.9, 1.4]]], 0.3, 4, false),
  fillOf(ellipsePoly(33.6, 3.6, 1.2, 0.9, 9), "wood", 4), fillOf(ellipsePoly(30, -4.6, 0.9, 0.7, 9), "wood", 4),
  scuffs(202, 6, 28.4, 35.4, -7, 7, 4, 0.24),
  line([[-4, -0.3], [24, -0.4]], 0.18, 4),
], [31.9, 8.8], { grip2: [-10, 0] });

/** Pickaxe: a haft and a curved double head, flat chisel up, point down; overhead arc point
 *  down, the pick point hits. */
const PICK: Pt[] = (() => {
  const c = quad([30.6, -11.4], [26.4, 0], [31.6, 12.6], 14);
  const top: Pt[] = [];
  const bot: Pt[] = [];
  c.forEach((p, i) => {
    const t = i / (c.length - 1);
    const w = t < 0.5 ? 1.5 + 0.6 * (t / 0.5) : 2.1 * (1 - (t - 0.5) / 0.5) + 0.05;
    top.push([p[0] + w, p[1]]);
    bot.push([p[0] - w, p[1]]);
  });
  return [...top, ...bot.reverse()];
})();
export const PICKAXE: WeaponArt = weapon([
  fillOf(bar(-16.5, 27, [[0, 1.0], [0.8, 1.05], [1, 1.3]], 0.6), "wood", 0),
  fillOf(PICK, "metal", 1),
  fillOf(roundRect(25.4, -2.8, 5.0, 5.6, 0.8), "metal", 2),
  line([[27.4, -9.6], [27.6, 8.4]], 0.24, 3),
  fillOf(ellipsePoly(28.6, 5.6, 0.9, 1.4, 9), "wood", 2.5),
  scuffs(203, 5, 27, 31, -8, 9, 3),
  lines([[[-12, -0.3], [8, -0.35]], [[12, 0.4], [24, 0.4]]], 0.18, 3),
], [31.6, 12.6], { grip2: [-10, 0] });

/** Stop Sign: a torn-off sign on its punched steel post; held by the post, an overhead chop
 *  edge first, the far edge of the sign hits. */
const SIGN_C: Pt = [37.6, 0];
const SIGN_R = 10;
/** A point on the sign's face, text frame (u to the reader's right, v up) to item units. The sign
 *  reads upright when the post points up. */
const tx = (u: number, v: number): Pt => [SIGN_C[0] + v, SIGN_C[1] + u];
const glyph = (pts: readonly (readonly [number, number])[], u0: number): Pt[] => pts.map(([u, v]) => tx(u0 + u, v));
const S_: [number, number][] = [[1.6, 1.6], [0, 1.6], [0, 0.15], [1.2, 0.15], [1.2, -0.4], [0, -0.4], [0, -1.6], [1.6, -1.6], [1.6, -0.15], [0.4, -0.15], [0.4, 0.4], [1.6, 0.4]];
const T_: [number, number][] = [[0, 1.6], [1.6, 1.6], [1.6, 1.15], [1.02, 1.15], [1.02, -1.6], [0.58, -1.6], [0.58, 1.15], [0, 1.15]];
const O_: [number, number][] = [[0, 1.6], [1.6, 1.6], [1.6, -1.6], [0, -1.6], [0, 1.45], [0.42, 1.2], [0.42, -1.2], [1.18, -1.2], [1.18, 1.2], [0.42, 1.2], [0, 1.45]];
const P_: [number, number][] = [[0, 1.6], [1.6, 1.6], [1.6, -0.1], [0.42, -0.1], [0.42, -1.6], [0, -1.6], [0, 1.45], [0.42, 1.2], [0.42, 0.3], [1.18, 0.3], [1.18, 1.2], [0.42, 1.2], [0, 1.45]];
export const STOP_SIGN: WeaponArt = weapon([
  fillOf(rod(-16.5, 31, 1.15, 0), "metal", 0),
  fillsOf(Array.from({ length: 14 }, (_, i) => roundRect(-14 + i * 3, -0.35, 1.3, 0.7, 0.3)), "ink", 1),
  fillOf(((): Pt[] => { const o = ngon(SIGN_C[0], SIGN_C[1], SIGN_R, 8, 22.5); o[1] = [o[1]![0] - 1.0, o[1]![1] - 0.4]; return o; })(), "wood", 2),
  fillOf([...ngon(SIGN_C[0], SIGN_C[1], 9.0, 8, 22.5), ngon(SIGN_C[0], SIGN_C[1], 9.0, 8, 22.5)[0]!, ...ngon(SIGN_C[0], SIGN_C[1], 8.1, 8, 22.5).concat([ngon(SIGN_C[0], SIGN_C[1], 8.1, 8, 22.5)[0]!]).reverse()], "white", 3),
  fillsOf([glyph(S_, -3.9), glyph(T_, -1.9), glyph(O_, 0.1), glyph(P_, 2.1)], "white", 3.2),
  blob(30.6, 0, 0.55, 0.55, 4, 8), blob(44.6, 0, 0.55, 0.55, 4, 8),
  scuffs(204, 9, 29, 46, -8, 8, 4, 0.26),
  lines([[[41, 6.4], [43.6, 4.6], [44.8, 6.0]]], 0.3, 4),
], [47.6, 0], { grip2: [-10, 0] });

/** Pool Cue: a dark wrapped butt with pale inlays and a long maple shaft with a chalked tip;
 *  the bridge hand in front, the back hand drives it, the cue tip hits. */
export const POOL_CUE: WeaponArt = weapon([
  fillOf(bar(-26, -3.6, [[0, 1.3], [1, 1.02]], 0.5), "hair", 0),
  fillOf(bar(-4.2, 40, [[0, 1.02], [1, 0.48]], 0.2), "white", 0.5),
  fillsOf([[[-6, -0.95], [-2.2, 0], [-6, 0.95], [-9.8, 0]], [[-12.6, -1.0], [-10.6, 0], [-12.6, 1.0], [-14.6, 0]]], "white", 1),
  wraps(-24, -16, 1.24, 1.0, 2, 0.18),
  fillOf(rod(39.7, 40.9, 0.48, 0), "white", 2),
  fillOf(rod(40.8, 41.8, 0.5, 0.3), "accent", 2.5),
  line([[-25.6, -1.0], [-25.6, 1.0]], 0.25, 3, false),
  lines([[[4, -0.3], [36, -0.15]]], 0.15, 3),
], [41.8, 0], { grip2: [-11, 0] });

/** Lawn Flamingo: a plastic garden flamingo on two thin steel legs; held by the legs, thrust
 *  beak first, the beak hits. */
const O = 9;
export const LAWN_FLAMINGO: WeaponArt = weapon([
  line([[-12, 0], [10 + O, 0.2]], 0.9, 0, false),
  line([[-12, 0.9], [9 + O, 1.6]], 0.9, 0, false),
  fillOf(ellipsePoly(17 + O, 0.6, 8.2, 4.4, 22, -6), "metal", 1),
  fillOf([[11.4 + O, -0.6], [16 + O, -2.2], [21 + O, -1.2], [17 + O, 1.0]], "metal", 1.5),
  fillOf(band([[23 + O, -1.4], [25.6 + O, -6.2], [29.6 + O, -7.4], [32.4 + O, -5.4], [33.4 + O, -2.2]], 2.0), "metal", 2),
  fillOf(ellipsePoly(34.2 + O, -1.2, 2.1, 1.9, 14), "metal", 2.2),
  fillOf([[35.4 + O, -2.2], [39.8 + O, -0.6], [40.6 + O, 0.5], [36 + O, 0.4]], "white", 2.4),
  fillOf([[38.4 + O, -1.0], [39.8 + O, -0.6], [40.6 + O, 0.5], [38.6 + O, 0.4]], "ink", 2.5),
  blob(34.2 + O, -1.8, 0.45, 0.45, 2.6, 8),
  lines([[[12.4 + O, 1.6], [19 + O, 2.4]], [[13 + O, 2.8], [18 + O, 3.6]]], 0.22, 2.6),
], [40.5 + O, 0.3], { grip2: [-9, 0.4] });

/** Folding Chair: a steel folding chair, folded flat; held by the two back legs, lifted and
 *  brought down overhead, the folded seat at the far end hits. */
export const FOLDING_CHAIR: WeaponArt = weapon([
  fillOf(rod(-4.4, 32.6, 0.75, 0.5), "metal", 0),
  fillOf(rod(-4.4, 32.6, 0.75, 0.5, 8), "metal", 0),
  fillOf(roundRect(18.6, -1.2, 13.4, 10.4, 1.4), "metal", 1),
  fillOf(roundRect(11.4, -0.9, 10.2, 9.8, 1.2), "wood", 2),
  lines([[[2, 0.4], [11, 7.6]], [[2, 7.6], [11, 0.4]]], 0.4, 3, false),
  lines([[[20.4, 1], [30.6, 1]], [[20.4, 7], [30.6, 7]]], 0.22, 3, false),
  fillsOf([roundRect(-5.4, -0.9, 1.6, 1.8, 0.5), roundRect(-5.4, 7.1, 1.6, 1.8, 0.5)], "hair", 3),
  scuffs(205, 6, 12, 31, 0, 8, 3),
], [32, 4], { grip2: [0, 8] });

/** Anvil: a small blacksmith's anvil, hugged with a hand on each side of its waist, base
 *  forward; heaved overhead and dropped forward, the flat base hits. Drawn in (u, h): u across,
 *  h height above the base; the base is at item +x. */
const AV = (u: number, h: number): Pt => [6.5 - h, u + 3.2];
const ANVIL_PROFILE: [number, number][] = [[-8, 0], [8, 0], [8, 1.6], [6, 2.6], [3.2, 5.4], [3.2, 8], [8.6, 9], [8.6, 12.6], [-4, 12.6],
  [-11.6, 11.8], [-15.4, 10.8], [-10.2, 9.6], [-4, 8.7], [-3.2, 8], [-3.2, 5.4], [-6, 2.6], [-8, 1.6]];
export const ANVIL: WeaponArt = weapon([
  fillOf(ANVIL_PROFILE.map(([u, h]) => AV(u, h)), "hair", 0),
  fillOf([AV(-4, 12.6), AV(8.6, 12.6), AV(8.6, 11.4), AV(-4, 11.4)], "metal", 1),
  fillOf([AV(-8, 0), AV(8, 0), AV(8, 1.2), AV(-8, 1.2)], "metal", 1),
  blob(...AV(5.6, 12), 0.5, 0.5, 2, 6),
  lines([[AV(-3, 8.3), AV(3, 8.3)], [AV(-5.6, 2.4), AV(5.6, 2.4)]], 0.24, 2, false),
  scuffs(206, 5, AV(0, 11)[0], AV(0, 3)[0], -3, 9, 2, 0.24),
], AV(0, 0), { grip2: [0, 6.4] });

/** Garden Shears: long-bladed hedge shears, one hand on each wooden handle, the handles running
 *  on along the forearms (`FOIL_GRIP`); lunge and snip shut, the closing blades hit. */
export const GARDEN_SHEARS: WeaponArt = weapon([
  fillOf(band([[5, 0.9], [0, 0], [-10.4, -1.4]], 2.0), "wood", 0),
  fillOf(band([[5, 2.2], [-1, 5.6], [-10, 7.8]], 2.0), "wood", 0.2),
  fillOf([[4.6, 0.1], [11, -1.4], [18, -1.8], [22.8, -0.6], [18, 0.3], [11, 1.0], [4.6, 1.8]], "metal", 1),
  fillOf([[4.6, 1.2], [11, 1.4], [18, 1.5], [22.6, 0.9], [18, 2.9], [11, 3.4], [4.6, 3.2]], "metal", 1.2),
  fillOf(ellipsePoly(5.4, 1.6, 1.2, 1.2, 10), "metal", 1.4),
  blob(5.4, 1.6, 0.42, 0.42, 2, 8),
  lines([[[8, -0.3], [20, -0.9]], [[8, 2.8], [19, 2.2]]], 0.2, 2),
  lines([[[-9.6, -1.4], [-9.6, 0.2]], [[-9.2, 7.0], [-9.2, 8.6]]], 0.3, 2, false),
], [20.6, 1.0], { grip2: [-2.8, 6.1], rot: FOIL_GRIP });

/** Bands across a rod (sledge tape, cue wrap) re-exported for the thrown file. */
export { wraps, ngon, ringPoly };
