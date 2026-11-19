/**
 * The six shields (content v2). A shield is carried on the back forearm: the engine puts its
 * `grip` (the inner handle or strap) on the back wrist, turned with the forearm, and draws it
 * behind the body (outline group 23). Seen face on, it spans from a little behind the wrist
 * forward and up over the forearm, as the contract's stand-in slabs do (x from about -4 to
 * w - 4, y from 6 - h to 6). `tip` is the middle of the face that takes a blow.
 */
import type { ShieldId } from "@rankzero/core";
import type { WeaponArt } from "../contracts";
import type { ItemShape, Pt } from "./kit";
import { band, blob, dPolys, ellipsePoly, fillOf, fillsOf, line, lines, ringPoly, rod, roundRect, scuffs } from "./kit";
import { parsePolys } from "../gate/vocab";

/**
 * The grip turn. In the guard (idle, brace) the back forearm points up and forward at about -124
 * degrees, so a shield turned +124 stands upright in front of the chest there, as a raised
 * shield does; it turns with the forearm everywhere else. The drawings below are made upright
 * (y up the face is -y) and then moved so the wrist sits a little below the middle of the face
 * and one hand-width in from its inner edge.
 */
const ROT = 124;
function shield(shapes: readonly ItemShape[], x0: number, x1: number, tip: Pt): WeaponArt {
  // drawn on the stand-in frame (face from y 6 - h up to 6, inner edge near x -4): re-centre
  const ys = shapes.flatMap((s) => parsePolys(s.d).flat().map((p) => p[1]));
  const top = Math.min(...ys);
  const bot = Math.max(...ys);
  const h = bot - top;
  const dx = -3 - x0;
  const dy = -0.58 * h - top;
  const move = (d: string): string => dPolys(parsePolys(d).map((p) => p.map(([x, y]) => [x + dx, y + dy] as Pt)));
  const moved = shapes.map((s) => (s.shade === undefined ? { ...s, d: move(s.d) } : { ...s, d: move(s.d), shade: move(s.shade) }));
  return { shapes: moved, grip: { x: 0, y: 0, rot: ROT }, length: Math.round((x1 - x0) * 100) / 100, tip: { x: tip[0] + dx, y: tip[1] + dy } };
}

/** Car Door: a dented, rust-red car door seen from outside, window up, chrome handle and trim. */
const CAR_DOOR = shield([
  fillOf([[-4.6, 6.6], [19.6, 6.6], [21.2, 4.6], [21.6, -12], [20.4, -14.6], [16.8, -27.2], [12.6, -28.6], [-3.4, -28.6], [-4.6, -26.6]], "wood", 0),
  fillOf([[-2.6, -14.6], [18.6, -14.6], [15.4, -26.4], [12.2, -27.0], [-2.6, -27.0]], "ink", 1),
  fillsOf([[[1, -16.4], [4.4, -25.2], [5.6, -25.2], [2.2, -16.4]], [[6.4, -16.4], [9.4, -24], [10.2, -24], [7.2, -16.4]]], "white", 1.2),
  fillOf(roundRect(-4.6, -14.8, 26.2, 1.4, 0.5), "metal", 1.4),
  fillOf(roundRect(13.4, -10.2, 5.2, 1.8, 0.8), "metal", 2),
  lines([[[-3.8, -1.6], [20.8, -1.6]], [[7.4, -13.4], [7.8, 6.2]]], 0.3, 2.2, false),
  fillsOf([ellipsePoly(4, 1.6, 3.2, 2.0, 12), ellipsePoly(16, -6, 2.0, 1.4, 10)], "ink", 2.3),
  fillsOf([ellipsePoly(1.2, -6.2, 1.6, 1.1, 9), ellipsePoly(18.2, 3.4, 1.4, 1.0, 9), ellipsePoly(10.4, 4.2, 1.2, 0.8, 9)], "metal", 2.4),
  scuffs(401, 10, -3, 20, -13, 5, 2.5, 0.28),
], -4.6, 21.6, [8.4, -4]);

/** Bin Lid: a round galvanised dustbin lid with pressed rings, seen from outside. */
const BIN_LID = shield([
  fillOf(ellipsePoly(5.6, -4.4, 10.6, 10.6, 32), "metal", 0),
  fillOf(ringPoly(5.6, -4.4, 8.4, 9.2, 30), "ink", 1),
  fillOf(ringPoly(5.6, -4.4, 4.8, 5.4, 26), "ink", 1),
  fillOf(roundRect(2.6, -5.6, 6, 2.4, 1.1), "metal", 1.5),
  fillsOf([ellipsePoly(9.6, 0.4, 1.6, 1.0, 10), ellipsePoly(0.6, -9.6, 1.2, 0.8, 9)], "ink", 1.6),
  scuffs(402, 9, -3, 14, -13, 4, 2, 0.26),
], -5, 16.2, [5.6, -4.4]);

/** Wooden Pallet: a shipping pallet hugged to the arm: five top boards over three stringers. */
const PALLET = shield([
  fillsOf([roundRect(-4.6, -25.6, 3.4, 32.2, 0.4), roundRect(7.4, -25.6, 3.4, 32.2, 0.4), roundRect(19.4, -25.6, 3.4, 32.2, 0.4)], "wood", 0),
  fillsOf([0, 1, 2, 3, 4].map((i) => roundRect(-5.8, -25 + i * 6.6, 29.8, 4.4, 0.3)), "wood", 1),
  lines([0, 1, 2, 3, 4].flatMap((i) => [[[-4.4, -23.4 + i * 6.6], [6, -23.6 + i * 6.6], [22.6, -23.2 + i * 6.6]], [[-2, -22.0 + i * 6.6], [12, -22.2 + i * 6.6]]] as Pt[][]), 0.16, 2),
  fillsOf([0, 1, 2, 3, 4].flatMap((i) => [ellipsePoly(-3, -22.8 + i * 6.6, 0.32, 0.32, 6), ellipsePoly(9.1, -22.8 + i * 6.6, 0.32, 0.32, 6), ellipsePoly(21.1, -22.8 + i * 6.6, 0.32, 0.32, 6)]), "ink", 2.2),
  line([[20, 6.2], [22.4, 3.6], [23.6, 4.6]], 0.3, 2.4),
], -5.8, 24, [9.1, -9.4]);

/** Ironing Board: a long board with a patterned cover, held upright; the cover faces out. */
const IRONING = shield([
  fillsOf([roundRect(-1.4, -18, 1.2, 25, 0.5), roundRect(6.6, -18, 1.2, 25, 0.5)], "metal", 0),
  fillOf([[-3.6, 7.6], [9.6, 7.6], [10.2, -30], [8.6, -37.4], [3.2, -41.6], [-2.2, -37.4], [-3.6, -30]], "white", 0.5),
  fillsOf(Array.from({ length: 8 }, (_, i) => ellipsePoly(1.6 + (i % 2) * 4.4, -33 + i * 5.2, 1.0, 1.0, 8)), "wood", 1),
  fillsOf(Array.from({ length: 7 }, (_, i) => ellipsePoly(4.0 - (i % 2) * 4.0 + 2, -30.4 + i * 5.2, 0.6, 0.6, 6)), "ink", 1.1),
  fillOf(band([[-2.4, -38.6], [3.2, -42.8], [8.6, -38.6]], 1.0), "accent", 1.2),
], -3.6, 10.2, [3.2, -15]);

/** Skateboard: a deck seen from below, two trucks and four wheels; held by a truck. */
const SKATEBOARD = shield([
  fillOf([[-3.4, 6.4], [-2.8, 9.0], [0.6, 10.4], [4.4, 9.0], [5.0, 6.4], [5.0, -21.6], [4.4, -24.2], [0.6, -25.6], [-2.8, -24.2], [-3.4, -21.6]], "wood", 0),
  fillsOf([roundRect(-1.4, -21, 4.2, 1.6, 0.4), roundRect(-1.4, 4.0, 4.2, 1.6, 0.4)], "metal", 1),
  fillsOf([ellipsePoly(-2.2, -20.2, 1.1, 1.5, 10), ellipsePoly(3.4, -20.2, 1.1, 1.5, 10), ellipsePoly(-2.2, 4.8, 1.1, 1.5, 10), ellipsePoly(3.4, 4.8, 1.1, 1.5, 10)], "white", 2),
  fillsOf([[[-2.6, -14], [4.2, -10], [4.2, -6.4], [-2.6, -10.4]], [[-2.6, -4], [4.2, 0], [4.2, 1.8], [-2.6, -2.2]]], "accent", 1.5),
  lines([[[-2.6, -16.4], [4.2, -16.4]]], 0.24, 2, false),
  scuffs(403, 7, -2.6, 4.2, -22, 8, 2.2, 0.24),
], -3.4, 5, [0.8, -7.6]);

/** Plastic Riot Shield: a tall clear polycarbonate shield with a view band and rubber edging. */
const RIOT = shield([
  fillOf(roundRect(-5.2, -38.6, 26.8, 46, 3.2), "hair", 0),
  fillOf(roundRect(-4.0, -37.4, 24.4, 43.6, 2.6), "white", 1),
  fillOf(roundRect(-1.6, -32.6, 19.6, 8.4, 1.4), "metal", 2),
  lines([[[0, -20], [8, -34]], [[3, -12], [14, -32]], [[10, 2], [18, -12]], [[-2, 0], [2, -8]]], 0.32, 3),
  fillsOf([ellipsePoly(-2.8, -36, 0.5, 0.5, 6), ellipsePoly(19.2, -36, 0.5, 0.5, 6), ellipsePoly(-2.8, 4.2, 0.5, 0.5, 6), ellipsePoly(19.2, 4.2, 0.5, 0.5, 6)], "ink", 3.2),
  scuffs(404, 8, -2, 18, -22, 4, 3.4, 0.24),
], -5.2, 21.6, [8.2, -15.6]);

export const SHIELD_ART: Record<ShieldId, WeaponArt> = {
  "car-door": CAR_DOOR, "bin-lid": BIN_LID, "wooden-pallet": PALLET, "ironing-board": IRONING, skateboard: SKATEBOARD, "riot-shield": RIOT,
};
export { rod, blob };
