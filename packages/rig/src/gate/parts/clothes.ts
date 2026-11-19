/**
 * Tops (torso and both arms), bottoms (pelvis and both legs) and shoes: two complete looks.
 *  Look A: a work jacket over a dark shirt, jeans, boots.
 *  Look B: a vest top with bare arms, cargo trousers, trainers.
 */
import type { Shape } from "../../contracts";
import { K, PROPORTION } from "../skeleton";
import type { Poly, Pt } from "../vocab";
import { limb, movePoly } from "../vocab";
import type { Side } from "./kit";
import { PROF, SIDES, Z, armPart, ink, legPart, shape, trPoly } from "./kit";

export const TORSO: Poly = [[-9, 3], [-9.4, -8], [-8.4, -20], [-10.4, -34], [-11.4, -44], [-9, -51], [-3.5, -54.5], [3.5, -54.5], [8.5, -51], [11.6, -44], [12.2, -36], [10.2, -28], [9.2, -18], [9.6, -6], [9.2, 3]];
export const PELVIS: Poly = [[-10, -7], [10.2, -7], [11, 2], [7.5, 10], [-7.3, 10], [-10.8, 2]];
export const FOOT: Poly = [[-5.5, -3.5], [3.5, -4.2], [8, -1.6], [16.5, 0.4], [21.2, 2.8], [21.6, 7], [-6.4, 7], [-7, 2.5]];
export const BOOT: Poly = [[-5.8, -9.5], [4.0, -9.8], [4.6, -3.0], [8.4, -1.2], [16.8, 0.6], [21.4, 3.0], [21.8, 7], [-6.6, 7], [-7.2, 2.0]];
export const SOLE: Poly = [[-7, 5.0], [22.2, 5.0], [22.2, 7.6], [-7, 7.6]];

const up = (s: Side): string => `arm${s}.up`;
const lo = (s: Side): string => `arm${s}.lo`;
const zArm = (s: Side, part: "up" | "lo"): number => (s === "F" ? (part === "up" ? Z.armFup : Z.armFlo) : (part === "up" ? Z.armBup : Z.armBlo));
const zLeg = (s: Side, part: "up" | "lo"): number => (s === "F" ? (part === "up" ? Z.legFup : Z.legFlo) : (part === "up" ? Z.legBup : Z.legBlo));
const zFoot = (s: Side): number => (s === "F" ? Z.footF : Z.footB);
export const fk = (pts: Poly): Pt[] => pts.map(([x, y]) => [x * K, y * K] as Pt);

// ------------------------------------------------------------------------------------- tops

function jacket(): Shape[] {
  const out: Shape[] = [
    shape("torso", trPoly(TORSO), "top", Z.torso),
    shape("torso", trPoly([[3, -54], [8.5, -50.5], [10.2, -40], [9.6, -25], [9.8, -6], [4.6, -6], [5.4, -30], [4, -48]]), "accent", Z.torso + 0.1),
    shape("torso", trPoly([[-5.5, -55.5], [3.2, -56], [6.4, -50.5], [0, -49.0], [-6.2, -51]]), "top", Z.torso + 1),
    ink("torso", trPoly([[4.4, -46], [5.2, -30], [4.6, -7]]), 0.32, Z.torso + 0.2),
    ink("torso", trPoly([[-6, -40], [-4.5, -30], [-6, -20]]), 0.28, Z.torso + 0.2),
    ink("torso", trPoly([[-8.6, -6], [9.2, -6]]), 0.3, Z.torso + 0.2, false),
  ];
  for (const s of SIDES) {
    out.push(shape(up(s), armPart(s, "up", true), "top", zArm(s, "up")));
    out.push(shape(lo(s), armPart(s, "lo", true), "top", zArm(s, "lo")));
    // the cuff at the wrist and a crease at the elbow
    const L = PROPORTION.forearm;
    out.push(shape(lo(s), [[-1.9, L - 1.6], [2.0, L - 1.6], [2.0, L + 0.2], [-1.9, L + 0.2]], "accent", zArm(s, "lo") + 0.05));
    out.push(ink(up(s), [[-1.2, PROPORTION.upperArm - 2.2], [0.6, PROPORTION.upperArm - 0.8]], 0.3, zArm(s, "up") + 0.05));
  }
  return out;
}

function vest(): Shape[] {
  const out: Shape[] = [
    shape("torso", trPoly(TORSO), "top", Z.torso),
    shape("torso", trPoly([[-2.5, -56.5], [8, -56.5], [6.4, -46], [0.6, -47.5]]), "skin", Z.torso + 0.1),
    shape("torso", trPoly([[-12, -45], [-9, -52], [-4, -57], [-2.5, -51], [-6.5, -42]]), "skin", Z.torso + 0.1),
    ink("torso", trPoly([[1, -38], [7, -35], [11.5, -37.5]]), 0.32, Z.torso + 0.2),
    ink("torso", trPoly([[5, -24], [5.5, -14]]), 0.26, Z.torso + 0.2),
    ink("torso", trPoly([[-8.8, -4], [9.4, -4]]), 0.3, Z.torso + 0.2, false),
  ];
  for (const s of SIDES) {
    out.push(shape(up(s), armPart(s, "up", false), "skin", zArm(s, "up")));
    out.push(shape(lo(s), armPart(s, "lo", false), "skin", zArm(s, "lo")));
    // the forearm's muscle line
    out.push(ink(lo(s), [[0.9, 1.4], [0.4, 5.6]], 0.26, zArm(s, "lo") + 0.05));
  }
  return out;
}
export const TOPS: readonly Shape[][] = [jacket(), vest()];

// ---------------------------------------------------------------------------------- bottoms

function trousers(cargo: boolean): Shape[] {
  const out: Shape[] = [
    shape("pelvis", trPoly(PELVIS), "bottom", Z.pelvis),
    shape("pelvis", trPoly([[-10.2, -7.5], [10.4, -7.5], [10.6, -3.8], [-10.4, -3.8]]), "accent", Z.pelvis + 0.1),
    ink("pelvis", trPoly([[3.5, -3.6], [5.5, 6]]), 0.3, Z.pelvis + 0.2),
  ];
  for (const s of SIDES) {
    const th = `leg${s}.up`;
    const sh = `leg${s}.lo`;
    out.push(shape(th, legPart("up", cargo ? 0.9 : 0), "bottom", zLeg(s, "up")));
    out.push(shape(sh, legPart("lo", cargo ? 0.9 : 0.2), "bottom", zLeg(s, "lo")));
    const T = PROPORTION.thigh;
    const S = PROPORTION.shin;
    if (cargo) {
      out.push(shape(th, [[-1.2, T * 0.42], [3.6, T * 0.42], [3.4, T * 0.72], [-1.0, T * 0.72]], "bottom", zLeg(s, "up") + 1));
      out.push(ink(sh, [[2.4, S * 0.86], [-2.4, S * 0.9]], 0.3, zLeg(s, "lo") + 0.05, false));
    } else {
      out.push(ink(th, [[1.4, T * 0.15], [1.2, T * 0.8]], 0.26, zLeg(s, "up") + 0.05));
      out.push(ink(sh, [[2.6, S * 0.2], [1.6, S * 0.75]], 0.24, zLeg(s, "lo") + 0.05));
    }
  }
  return out;
}
export const BOTTOMS: readonly Shape[][] = [trousers(false), trousers(true)];

// ------------------------------------------------------------------------------------ shoes

function boots(): Shape[] {
  const out: Shape[] = [];
  for (const s of SIDES) {
    const b = `foot${s}`;
    out.push(shape(b, fk(BOOT), "shoes", zFoot(s)));
    out.push(shape(b, fk(SOLE), "accent", zFoot(s) + 0.1));
    out.push(ink(b, fk([[2, -6], [3.4, -2.6], [9, 0.2]]), 0.28, zFoot(s) + 0.2));
  }
  return out;
}
function trainers(): Shape[] {
  const out: Shape[] = [];
  for (const s of SIDES) {
    const b = `foot${s}`;
    out.push(shape(b, fk(FOOT), "shoes", zFoot(s)));
    out.push(shape(b, fk(SOLE), "white", zFoot(s) + 0.1));
    out.push(ink(b, fk([[2, -2.6], [9, 0.2]]), 0.3, zFoot(s) + 0.2));
    out.push(ink(b, fk([[6, 4.0], [12, 1.6], [17, 3.8]]), 0.26, zFoot(s) + 0.2));
  }
  return out;
}
export const SHOES: readonly Shape[][] = [boots(), trainers()];

/** The middle of the body (the "body" hit point) in the torso bone's frame. */
export const BODY_CENTRE: Pt = [1.4, -13];

export { limb, movePoly, PROF };
