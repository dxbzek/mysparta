/**
 * Fists: no object. The hands themselves strike, so nothing is drawn in the hand; this art is
 * the fist for the inventory icon and the use strip. Its `tip` is the knuckles, in the item
 * frame of a closed fist (the engine strikes with the hand's knuckle point, which is the same).
 */
import type { WeaponArt } from "../../contracts";
import { KNUCKLES } from "../parts";
import { GRIP_ROT, K, PROPORTION } from "../skeleton";
import { DEG, dPoly, inkLine } from "../vocab";

// the fist in the item frame: the hand frame turned by -GRIP_ROT around the grip
const toItem = (x: number, y: number): [number, number] => {
  const a = -GRIP_ROT * DEG;
  const px = x;
  const py = y - PROPORTION.grip;
  return [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)];
};
const FIST = [[-4.8, -4.4], [4.6, -4.8], [5.7, -1.2], [5.2, 4.4], [3.0, 7.0], [-3.0, 7.0], [-5.4, 3.6], [-5.9, -1.0]] as const;
const fist = (q: readonly [number, number]): [number, number] => toItem(q[0] * K, PROPORTION.grip - q[1] * K);
const tip = toItem(KNUCKLES[0], KNUCKLES[1]);

export const FISTS: WeaponArt = {
  shapes: [
    { d: dPoly(FIST.map(fist)), slot: "skin", z: 0 },
    { d: dPoly(inkLine([fist([-2.5, -4.6]), fist([-2.4, -0.8])], 0.28)), slot: "ink", z: 0.1 },
    { d: dPoly(inkLine([fist([0, -4.8]), fist([0, -0.9])], 0.28)), slot: "ink", z: 0.1 },
    { d: dPoly(inkLine([fist([2.4, -4.8]), fist([2.5, -1.0])], 0.28)), slot: "ink", z: 0.1 },
    { d: dPoly([[-4.6, 1.0], [3.8, -0.4], [4.9, 1.3], [-3.8, 3.3]].map((q) => fist(q as [number, number]))), slot: "skin", z: 1 },
  ],
  grip: { x: 0, y: 0, rot: GRIP_ROT },
  length: 0,
  tip: { x: tip[0], y: tip[1] },
  offhand: true,
};
