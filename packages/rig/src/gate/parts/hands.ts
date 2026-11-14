/**
 * Hands with real fingers. A closed fist (knuckle lines and a thumb across) and an open hand
 * (palm, four fingers, a thumb). Both are on the hand bone: wrist at the origin, the hand along
 * +y. The open hand's shapes name the bone with an ":open" ending ("handF:open"); the engine
 * draws the open hand when that hand holds nothing and the pose is dazed or lets go (`held`
 * bone turned past 30 degrees), and the fist otherwise.
 */
import type { Shape } from "../../contracts";
import { K, PROPORTION } from "../skeleton";
import type { Poly, Pt } from "../vocab";
import { limb } from "../vocab";
import type { Side } from "./kit";
import { SIDES, Z, ink, shape } from "./kit";

const FIST: Poly = [[-4.8, -4.4], [4.6, -4.8], [5.7, -1.2], [5.2, 4.4], [3.0, 7.0], [-3.0, 7.0], [-5.4, 3.6], [-5.9, -1.0]];
const THUMB: Poly = [[-4.6, 1.0], [3.8, -0.4], [4.9, 1.3], [-3.8, 3.3]];
const PALM: Poly = [[0, -3.2], [7.4, -3.9], [9.2, -1.2], [8.8, 3.8], [1.2, 3.6]];

const G = PROPORTION.grip;
/** A sampler fist point (u along the held item, v toward the wrist) to the hand frame. */
const fist = (q: readonly [number, number]): Pt => [q[0] * K, G - q[1] * K];
/** A sampler open-hand point (u along the forearm, v across) to the hand frame. */
const open = (q: readonly [number, number]): Pt => [-q[1] * K, q[0] * K];

function fistShapes(s: Side): Shape[] {
  const b = `hand${s}`;
  const z = s === "F" ? Z.handF : Z.handB;
  return [
    shape(b, FIST.map(fist), "skin", z),
    ink(b, [fist([-2.5, -4.6]), fist([-2.4, -0.8])], 0.28, z + 0.1),
    ink(b, [fist([0, -4.8]), fist([0, -0.9])], 0.28, z + 0.1),
    ink(b, [fist([2.4, -4.8]), fist([2.5, -1.0])], 0.28, z + 0.1),
    shape(b, THUMB.map(fist), "skin", z + 1),
  ];
}

function finger(base: Pt, angDeg: number, len: number, w: number): Pt[] {
  const seg = limb(len, [[0, w, w], [1, w * 0.74, w * 0.74]], 1, 4);
  const a = angDeg * Math.PI / 180;
  // a finger hangs along +y and is turned by `ang` (positive turns it toward -x)
  return seg.map(([x, y]) => [base[0] + x * Math.cos(a) - y * Math.sin(a), base[1] + x * Math.sin(a) + y * Math.cos(a)] as Pt);
}
function openShapes(s: Side): Shape[] {
  const b = `hand${s}:open`;
  const z = s === "F" ? Z.handF : Z.handB;
  const out: Shape[] = [];
  const fingers: [number, number, number][] = [[-3.0, -16, 7.6], [-1.0, -5, 8.6], [1.1, 5, 8.2], [3.0, 15, 6.6]];
  for (const [y, ang, l] of fingers) out.push(shape(b, finger(open([8.2, y]), ang, l * K, 1.15 * K), "skin", z));
  out.push(shape(b, PALM.map(open), "skin", z + 0.1));
  out.push(shape(b, finger(open([2.6, -3.2]), -58, 6.5 * K, 1.6 * K), "skin", z + 1));
  return out;
}

export const HANDS: readonly Shape[] = SIDES.flatMap((s) => [...fistShapes(s), ...openShapes(s)]);
/** The knuckles of a closed fist in the hand frame: what bare hands strike with. */
export const KNUCKLES: Pt = fist([0.4, -4.4]);
