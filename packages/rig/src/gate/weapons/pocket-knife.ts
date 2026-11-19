/**
 * The Pocket Knife: a short folding knife, open. Held in a fist with the blade coming out of
 * the thumb side, used in short quick stabs; the point hits (brief 11).
 */
import type { WeaponArt } from "../../contracts";
export const KNIFE_GRIP = 40;
import { dPoly, inkLine, roundRect } from "../vocab";

export const POCKET_KNIFE: WeaponArt = {
  shapes: [
    { d: dPoly(roundRect(-3.3, -1.0, 6.9, 2.0, 0.8)), slot: "wood", z: 0 },
    { d: dPoly([[3.0, -0.85], [6.4, -0.95], [9.0, -0.55], [10.6, 0.25], [6.6, 0.75], [3.0, 0.7]]), slot: "metal", z: 1 },
    { d: dPoly(inkLine([[3.6, 0.15], [8.6, 0.1]], 0.2)), slot: "ink", z: 1.1 },
    { d: dPoly(roundRect(-2.6, -0.3, 1.2, 0.6, 0.25)), slot: "ink", z: 0.1 },
  ],
  // a forward fist grip: the blade leaves the thumb side angled along the forearm, so a cocked
  // wrist puts the point on line with a straight arm
  grip: { x: 0, y: 0, rot: KNIFE_GRIP },
  length: 13.9,
  tip: { x: 10.6, y: 0.25 },
};
