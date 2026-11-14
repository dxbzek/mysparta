/**
 * The Pipe: a length of steel water pipe with a rusty coupling on the far end. Held in one fist
 * near one end, swung from the side like a club; the far end (the coupling) hits (brief 11).
 * Item units, +x along the pipe, the grip at the origin.
 */
import type { WeaponArt } from "../../contracts";
import { GRIP_ROT } from "../skeleton";
import { dPoly, inkLine, roundRect } from "../vocab";

const L = 33;          // grip to the coupling
const R = 1.12;        // half the pipe's thickness
export const PIPE: WeaponArt = {
  shapes: [
    { d: dPoly(roundRect(-3.4, -R, L + 3.6, 2 * R, 0.6)), slot: "metal", z: 0 },
    { d: dPoly(roundRect(L - 0.4, -R - 0.55, 4.8, 2 * R + 1.1, 0.5)), slot: "wood", z: 1 },
    { d: dPoly(inkLine([[L + 1.9, -R - 0.4], [L + 1.9, R + 0.4]], 0.32, false)), slot: "ink", z: 1.1 },
    { d: dPoly(inkLine([[8, -0.25], [15, -0.2]], 0.26)), slot: "ink", z: 0.1 },
    { d: dPoly(inkLine([[21, 0.35], [25.5, 0.3]], 0.22)), slot: "ink", z: 0.1 },
  ],
  grip: { x: 0, y: 0, rot: GRIP_ROT },
  length: L + 4.4 + 3.4,
  tip: { x: L + 4.4, y: 0 },
};
