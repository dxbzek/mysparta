/**
 * Thrown weapons (each has a `flight` in WEAPON_META) and the two worn or paired hand weapons.
 * A thrown item is held in the front hand until the throw's `release`; its `tip` is the side that
 * meets the target in flight. Units and sign rules as in clubs.ts.
 */
import type { WeaponArt } from "../../contracts";
import { KNUCKLES } from "../../gate/parts";
import { GRIP_ROT, K, PROPORTION } from "../../gate/skeleton";
import { DEG } from "../../gate/vocab";
import type { Pt } from "../kit";
import { band, bar, blob, ellipsePoly, fillOf, fillsOf, line, lines, ngon, ringPoly, rod, roundRect, scuffs } from "../kit";
import { weapon } from "./make";

/** Darts: one steel dart, knurled barrel, cloth flights; pinch grip, flies straight point first. */
/** Darts are pinched between the fingers, pointing on along the hand, not across the fist
 *  (animation pass): with the forearm up by the ear the point faces the target. */
export const DART_GRIP = 80;
export const DARTS: WeaponArt = weapon([
  fillOf([[-5.2, 0], [-7.6, -2.7], [-10.4, -2.9], [-9.6, 0], [-10.4, 2.9], [-7.6, 2.7]], "accent", 0),
  line([[-10, 0], [-5.4, 0]], 0.3, 0.5, false),
  fillOf(rod(-6, -1.8, 0.32, 0.3), "hair", 1),
  fillOf(bar(-2.2, 4.8, [[0, 0.6], [0.5, 0.88], [1, 0.62]], 0.3), "metal", 2),
  lines(Array.from({ length: 6 }, (_, i) => [[-1 + i, -0.8], [-1 + i, 0.8]] as Pt[]), 0.16, 3, false),
  fillOf(bar(4.6, 9.6, [[0, 0.32], [1, 0.05]], 0), "metal", 2.5),
], [9.6, 0], { rot: DART_GRIP });

/** Bricks: a red house brick, chipped; overarm lob, tumbles on an arc, the brick hits. */
export const BRICKS: WeaponArt = weapon([
  fillOf([[-4.6, -3.1], [6.6, -3.1], [7.2, -2.4], [7.2, 3.1], [-4.6, 3.1], [-5.0, 0.4], [-4.4, -0.6]], "wood", 0),
  fillOf([[-4.6, -3.1], [6.6, -3.1], [7.2, -2.4], [-3.8, -2.3]], "white", 0.5),
  fillsOf([ellipsePoly(0.4, 0.6, 0.45, 0.35, 6), ellipsePoly(3.6, -0.6, 0.35, 0.3, 6), ellipsePoly(5.2, 1.8, 0.4, 0.3, 6), ellipsePoly(-2.4, 1.6, 0.3, 0.3, 6)], "ink", 1),
  scuffs(301, 6, -3.5, 6.5, -1.6, 2.6, 1, 0.24),
  line([[6.2, 1.4], [7.0, 2.6]], 0.3, 1),
], [7.2, 0]);

/** Boomerang: a hardwood boomerang with painted bands; side-arm throw, it flies a curve and
 *  comes back, the leading wing hits. */
const BOOM: Pt[] = [[-1.6, 0.9], [2.6, -2.8], [8, -5.6], [13.2, -3.4], [18.6, 0.6]];
export const BOOMERANG: WeaponArt = weapon([
  fillOf(band(BOOM, 3.4), "wood", 0),
  fillsOf([band([[5.4, -4.6], [6.4, -5.1]], 3.6), band([[10.0, -5.1], [11.0, -4.6]], 3.6), band([[15.6, -2.0], [16.4, -1.2]], 3.6)], "white", 1),
  line([[0, -0.4], [7.6, -4.8], [14, -2.6], [17.4, 0]], 0.2, 2),
], [18.2, 0.4]);

/** Plastic Bottle: a plastic water bottle (never glass) with a label and a cap; lobbed overarm,
 *  tumbles, the bottle hits. */
export const PLASTIC_BOTTLE: WeaponArt = weapon([
  fillOf(bar(-5.6, 10.2, [[0, 2.5], [0.62, 2.6], [0.78, 2.2], [0.9, 1.15], [1, 1.1]], 0.5), "white", 0),
  fillOf(rod(-1.4, 4.4, 2.65, 0), "wood", 1),
  fillOf(rod(10, 11.8, 1.3, 0.2), "accent", 2),
  lines([[[-4.2, -2.2], [-4.2, 2.2]], [[-3, -2.3], [-3, 2.3]], [[6, -2.3], [6.6, 2.1]]], 0.2, 3, false),
  lines([[[0, -1.2], [3, -1.3]], [[0.4, 0.4], [3.2, 0.3]]], 0.25, 3),
  line([[-5, -1.6], [8.4, -2.0]], 0.2, 3),
], [11.8, 0]);

/** Rubber Ball: a hard red rubber ball with a pale seam; thrown at the floor, bounces up into
 *  the target, the ball hits. */
export const RUBBER_BALL: WeaponArt = weapon([
  fillOf(ellipsePoly(1.8, 0, 4.4, 4.4, 22), "sign", 0),
  fillOf(band([[0.2, -4.0], [2.6, -1.4], [2.6, 1.4], [0.2, 4.0]], 1.0), "white", 1),
  scuffs(302, 4, 0, 5, -3, 3, 2, 0.24),
], [6.2, 0]);

/** Paint Can: a closed tin of paint swung by its wire handle; let go, it tumbles on a low arc,
 *  the can hits. */
export const PAINT_CAN: WeaponArt = weapon([
  fillOf(band([[3.6, -4.8], [0.8, -2.8], [0, 0], [0.8, 2.8], [3.6, 4.8]], 0.55), "metal", 0),
  fillOf(roundRect(3, -5.2, 9.8, 10.4, 0.6), "metal", 1),
  fillOf(roundRect(5.4, -5.2, 5.6, 10.4, 0.2), "paint", 2),
  fillsOf([[[3, -5.2], [4.6, -5.2], [4.6, -3.2], [4.0, -2.0], [3.6, -3.4], [3, -3.0]], [[3, 1.8], [4.4, 2.4], [4.4, 5.2], [3, 5.2]]], "accent", 2.5),
  lines([[[3.9, -5.2], [3.9, 5.2]], [[12, -5.2], [12, 5.2]]], 0.24, 3, false),
  fillOf(ellipsePoly(8.2, 0, 1.8, 1.8, 12), "white", 3),
  scuffs(303, 5, 6, 11, -4.5, 4.5, 4, 0.22),
  blob(3.6, -4.8, 0.35, 0.35, 4, 6), blob(3.6, 4.8, 0.35, 0.35, 4, 6),
], [12.8, 0]);

/** Traffic Cone: a scuffed road cone with two reflective bands and a rubber base; held by its
 *  narrow top, flung base first, the wide base hits. */
export const TRAFFIC_CONE: WeaponArt = weapon([
  fillOf([[-2.4, -0.7], [-1.8, -1.1], [15, -5.4], [15, 5.4], [-1.8, 1.1], [-2.4, 0.7]], "cone", 0),
  fillOf([[4, -2.6], [6.6, -3.3], [6.6, 3.3], [4, 2.6]], "white", 1),
  fillOf([[9.2, -3.9], [11.4, -4.5], [11.4, 4.5], [9.2, 3.9]], "white", 1),
  fillOf(roundRect(14.6, -7.4, 2.4, 14.8, 0.4), "hair", 2),
  scuffs(304, 6, 1, 14, -3, 3, 3, 0.24),
], [17, 0]);

/** Hubcap: a chromed wheel cover, gripped at the rim; a side-arm throw like a flying disc, it
 *  spins flat, the rim hits. */
export const HUBCAP: WeaponArt = weapon([
  fillOf(ellipsePoly(7.4, 0, 7.6, 7.6, 30), "metal", 0),
  fillOf(ringPoly(7.4, 0, 5.4, 6.0, 28), "ink", 1),
  lines(Array.from({ length: 6 }, (_, i) => { const a = (i * 60 + 15) * DEG; return [[7.4 + Math.cos(a) * 1.9, Math.sin(a) * 1.9], [7.4 + Math.cos(a) * 5.2, Math.sin(a) * 5.2]] as Pt[]; }), 0.42, 1.5, false),
  fillOf(ngon(7.4, 0, 1.7, 6), "hair", 2),
  scuffs(305, 6, 2, 13, -5, 5, 3, 0.24),
  line([[3.2, -5.8], [5.2, -6.8]], 0.3, 3),
], [15, 0]);

/** Tyre: a bald car tyre, lifted in both hands at the left of the ring; bowled low, it rolls
 *  into the shins, the tread hits. */
const TC: Pt = [10.4, 3.6];
export const TYRE: WeaponArt = weapon([
  fillOf(ringPoly(TC[0], TC[1], 6.4, 11.2, 36), "hair", 0),
  fillOf(ringPoly(TC[0], TC[1], 8.6, 9.0, 32), "metal", 1),
  lines(Array.from({ length: 18 }, (_, i) => { const a = (i * 20) * DEG; return [[TC[0] + Math.cos(a) * 9.8, TC[1] + Math.sin(a) * 9.8], [TC[0] + Math.cos(a + 0.12) * 11.0, TC[1] + Math.sin(a + 0.12) * 11.0]] as Pt[]; }), 0.32, 2, false),
  scuffs(306, 5, 2, 19, -6, 13, 2, 0.24),
], [TC[0] + 11.2, TC[1]], { grip2: [2.2, 9.6] });

// ------------------------------------------------------------------ worn and paired weapons

/** A point of the closed fist (hand frame) in the item frame, as the gate's Fists art does. */
const handToItem = (x: number, y: number): Pt => {
  const a = -GRIP_ROT * DEG;
  const py = y - PROPORTION.grip;
  return [x * Math.cos(a) - py * Math.sin(a), x * Math.sin(a) + py * Math.cos(a)];
};
const G = PROPORTION.grip;
const H = (x: number, y: number): Pt => handToItem(x * K, G + y * K);
/** Knuckle Dusters: a brass plate with four rings across the knuckles of each fist (a pair);
 *  punches like bare fists, the metal knuckles hit. The fist is drawn over it, so only the plate
 *  standing out past the knuckles shows, as it does on a real hand. */
const knuckle = KNUCKLES;
export const KNUCKLE_DUSTERS: WeaponArt = weapon([
  // the brass plate: a bar across the palm, four rings that stand well out past the knuckles
  // (review of 15 Nov 2026, item 54: the first plate barely cleared the fist and was a speck
  // on the floor)
  fillOf([H(-8.4, 2.8), H(8.4, 2.8), H(9.0, 7.2), H(8.2, 11.2), H(6.4, 12.4), H(4.6, 11.4), H(3.2, 12.6), H(1.2, 12.6), H(-0.2, 11.5),
    H(-1.6, 12.6), H(-3.6, 12.6), H(-5.0, 11.4), H(-6.6, 12.4), H(-8.4, 11.2), H(-9.2, 7.2)], "metal", 0,
  // the far edge of the rings in shadow: the brass reads apart from the skin of the fist
  [H(9.0, 9.6), H(8.2, 11.2), H(6.4, 12.4), H(4.6, 11.4), H(3.2, 12.6), H(1.2, 12.6), H(-0.2, 11.5), H(-1.6, 12.6), H(-3.6, 12.6),
    H(-5.0, 11.4), H(-6.6, 12.4), H(-8.4, 11.2), H(-9.0, 9.6)]),
  // the finger holes, dark where the fist does not cover them
  fillsOf([[-6.8, 7.8], [-3.0, 8.2], [0.6, 8.2], [4.4, 7.8]].map(([x, y]) => ellipsePoly(...H(x! + 1.4, y!), 1.2 * K, 1.9 * K, 12)), "ink", 1),
  lines([[H(-5.0, 11.0), H(-5.0, 12.2)], [H(-0.2, 11.1), H(-0.2, 12.3)], [H(4.6, 11.0), H(4.6, 12.2)]], 0.26, 1, false),
  line([H(-8.0, 3.8), H(8.0, 3.8)], 0.26, 1),
], handToItem(knuckle[0], knuckle[1] + 0.9), { offhand: true });

/** Screwdrivers: one flat screwdriver in each fist, fluted handles; jabs that take turns, the
 *  tips hit. Held like the knife, the shaft out of the thumb side along the forearm. */
export const SCREWDRIVERS: WeaponArt = weapon([
  fillOf(bar(-4.8, 4.2, [[0, 1.45], [0.25, 1.62], [1, 1.25]], 0.7), "accent", 0),
  lines([[[-3.2, -0.7], [3, -0.6]], [[-3.2, 0.7], [3, 0.6]]], 0.22, 1, false),
  fillOf(rod(4, 5.4, 0.7, 0), "metal", 1.5),
  fillOf(rod(5.2, 15, 0.42, 0), "metal", 2),
  fillOf(bar(14.8, 16.4, [[0, 0.62], [1, 0.22]], 0), "metal", 2.5),
  line([[6, -0.15], [14, -0.15]], 0.14, 3),
], [16.4, 0], { rot: 40, offhand: true });

export { rod };
