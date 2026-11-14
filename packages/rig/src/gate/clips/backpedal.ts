/** Backpedal: shuffling back out of range, guard up, the stance kept (front foot stays front):
 *  the back foot reaches back, then the front foot follows; the hips bob on each step. */
import { clip } from "./kit";

const BODY = { torso: 3, head: -4, pelvis: 0, held: 0, face: "neutral" as const, F: { at: [13, -55] as const, aim: -86 }, B: { at: [8, -58] as const } };
export const BACKPEDAL = clip(240, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }], [
  [0, { ...BODY, root: [1, 4], legF: { at: 12 }, legB: { at: -9 } }],
  [60, { ...BODY, root: [-2, 1.6], torso: -2, legF: { at: 9 }, legB: { at: [-20, -9], foot: 22 }, F: { at: [12, -57], aim: -90 }, ease: "out" }],
  [120, { ...BODY, root: [-5, 5.2], torso: 1, legF: { at: 8 }, legB: { at: -21 }, ease: "in" }],
  [180, { ...BODY, root: [-2, 2], torso: 5, legF: { at: [0, -10], foot: 12 }, legB: { at: -16 }, F: { at: [14, -54], aim: -82 }, B: { at: [9, -57] }, ease: "out" }],
  [240, { ...BODY, root: [1, 4], legF: { at: 12 }, legB: { at: -9 }, ease: "in" }],
], { lag: { head: 40, "armB.up": 40, "armB.lo": 40, handF: 30 } });
