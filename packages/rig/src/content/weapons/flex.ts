/**
 * The three weapons that bend (`WEAPON_META.flex`): drawn as linked segments. Link 0 starts at
 * the grip and turns with the hand; each later link points where the hand pointed 40 ms per link
 * earlier, so the far end arrives late and trails. Each link's shapes are in its own frame, along
 * +x from its start; the handle sits on link 0 (behind the grip, at negative x).
 */
import type { WeaponArt, WeaponSegment } from "../../contracts";
import type { ItemShape, Pt } from "../kit";
import { band, bar, blob, ellipsePoly, fillOf, fillsOf, line, lines, rod, roundRect, wraps } from "../kit";
import { flexWeapon } from "./make";

/** Chain links from x0 to x1: outer side plates and inner rollers, each with its two pins. */
function chain(x0: number, x1: number, pitch = 2.5, z = 1): ItemShape[] {
  const outer: Pt[][] = [];
  const inner: Pt[][] = [];
  const pins: Pt[][] = [];
  let i = 0;
  for (let x = x0; x + pitch <= x1 + 0.01; x += pitch, i++) {
    const p = i % 2 === 0 ? outer : inner;
    const h = i % 2 === 0 ? 0.98 : 0.78;
    p.push(roundRect(x - 0.35, -h, pitch + 0.7, 2 * h, h * 0.95));
    pins.push(ellipsePoly(x + 0.25, 0, 0.36, 0.36, 6), ellipsePoly(x + pitch - 0.25, 0, 0.36, 0.36, 6));
  }
  return [fillsOf(inner, "metal", z), fillsOf(outer, "metal", z + 0.2), fillsOf(pins, "ink", z + 0.4)];
}

/** Bike Chain: a greasy bicycle chain with a taped handle end; whipped in an arc, the chain
 *  trails and bends, the last links hit. Four links, 52 long. */
const BC: WeaponSegment[] = [
  { length: 13, shapes: [fillOf(rod(-5.2, 3.6, 1.35, 0.5), "accent", 2), wraps(-5.2, 3.6, 1.35, 1.2, 2.5), ...chain(3, 13)] },
  { length: 13, shapes: chain(0, 13) },
  { length: 13, shapes: chain(0, 13) },
  { length: 13, shapes: [...chain(0, 12.5), line([[12.4, -0.6], [13.2, 0.5]], 0.3, 3)] },
];
export const BIKE_CHAIN: WeaponArt = flexWeapon(BC);

/** Ball and Chain: a wooden handle for two hands, a short heavy chain and an iron ball; the
 *  ball swings overhead on its chain and lands after the hands stop, the ball hits. */
function heavyChain(x0: number, x1: number, z = 1): ItemShape[] {
  const a: Pt[][] = [];
  const b: Pt[][] = [];
  let i = 0;
  for (let x = x0; x + 2.6 <= x1 + 0.01; x += 2.6, i++) {
    if (i % 2 === 0) a.push(ringPolyFlat(x + 1.6, 0, 1.9, 1.25));
    else b.push(roundRect(x, -0.45, 3.2, 0.9, 0.45));
  }
  return [fillsOf(b, "metal", z), fillsOf(a, "metal", z + 0.2)];
}
/** A chain link seen flat: an oval ring. */
function ringPolyFlat(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const out: Pt[] = [];
  const inn: Pt[] = [];
  for (let k = 0; k <= 16; k++) {
    const a = (-89 + (358 * k) / 16) * Math.PI / 180;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    inn.push([cx + Math.cos(a) * (rx - 0.7), cy + Math.sin(a) * (ry - 0.55)]);
  }
  return [...out, ...inn.reverse()];
}
const BALL_R = 4.6;
const BnC: WeaponSegment[] = [
  { length: 9, shapes: [fillOf(bar(-9.4, 2.4, [[0, 1.35], [1, 1.15]], 0.6), "wood", 0), fillOf(rod(1.8, 3.6, 1.4, 0.2), "metal", 0.5), ...heavyChain(3.2, 9)] },
  { length: 9, shapes: heavyChain(-0.4, 9) },
  { length: 6 + 2 * BALL_R, shapes: [...heavyChain(-0.4, 6), fillOf(ellipsePoly(6 + BALL_R, 0, BALL_R, BALL_R, 24), "hair", 3),
    fillOf(ellipsePoly(6 + BALL_R - 1.6, -1.7, 1.4, 1.0, 10), "metal", 3.2), fillOf(roundRect(5, -0.9, 2.4, 1.8, 0.4), "metal", 2.8),
    blob(6 + BALL_R + 1.8, 1.8, 0.4, 0.4, 3.4, 6), blob(6 + BALL_R - 0.6, 2.6, 0.35, 0.35, 3.4, 6)] },
];
export const BALL_AND_CHAIN: WeaponArt = flexWeapon(BnC, { grip2: [-6.2, 0] });

/** Rubber Chicken: a squeaky rubber chicken held by its feet; a floppy slap that bends and
 *  trails, the head hits. Links: feet and legs, body, neck, head. */
const RC: WeaponSegment[] = [
  { length: 6, shapes: [
    fillsOf([band([[-3.4, -1.6], [-0.6, -0.4]], 0.7), band([[-3.6, 0.2], [-0.6, 0]], 0.7), band([[-3.2, 1.8], [-0.6, 0.4]], 0.7)], "metal", 0),
    fillOf(band([[-0.4, -0.2], [6.4, -0.8]], 0.9), "metal", 0.2), fillOf(band([[-0.4, 0.4], [6.4, 0.9]], 0.9), "metal", 0.2)] },
  { length: 12, shapes: [
    fillOf([[-0.6, -1.4], [2, -3.8], [6, -4.6], [10, -3.6], [12.4, -1.4], [12.4, 1.4], [10, 3.8], [6, 4.8], [2, 4.0], [-0.6, 1.4]], "white", 1),
    fillOf([[3, -0.6], [8.6, -1.6], [7.6, 1.4], [3.6, 1.6]], "white", 1.2),
    lines([[[3.6, 0.4], [7.2, -0.6]], [[4.2, 1.2], [7.6, 0.6]]], 0.2, 1.4),
    line([[1, 3.4], [9, 3.6]], 0.2, 1.4)] },
  { length: 7, shapes: [fillOf(bar(-0.6, 7.4, [[0, 1.45], [1, 0.95]], 0.3), "white", 1.6), lines([[[1.5, -0.9], [1.5, 0.9]], [[4, -0.8], [4, 0.8]]], 0.18, 1.7, false)] },
  { length: 6, shapes: [
    fillOf([[-0.6, -2.0], [1.4, -3.2], [3.6, -4.6], [4.4, -3.4], [5.4, -4.2], [5.6, -2.6], [4.2, -2.0]], "wood", 1.8),
    fillOf(ellipsePoly(2.6, 0, 2.8, 2.3, 16), "white", 2),
    fillOf([[4.8, -1.0], [7.6, 0.2], [4.8, 1.2]], "metal", 2.2),
    fillOf([[2.6, 1.6], [3.4, 3.6], [1.8, 2.4]], "wood", 2.1),
    lines([[[1.8, -1.2], [3, 0]], [[3, -1.2], [1.8, 0]]], 0.28, 2.4, false)] },
];
export const RUBBER_CHICKEN: WeaponArt = flexWeapon(RC);
