/** Dash: a hard forward run, 240 ms a cycle, two steps. The weapon arm is carried high and
 *  steady; the free arm pumps against the legs. */
import { clip } from "./kit";

const BODY = { torso: 24, head: -16, pelvis: 0, held: 0, face: "grit" as const };
const A = { ...BODY, pelvis: -6, root: [2, 3] as const, legF: { at: 15, foot: -12 }, legB: { at: [-16, -7] as const, foot: 38 },
  F: { at: [16, -55] as const, aim: -60 }, B: { at: [-12, -46] as const, hand: 25 } };
const AP = { ...BODY, root: [2, 1] as const, legF: { at: 1, foot: 0 }, legB: { at: [-3, -16] as const, foot: 22 },
  F: { at: [15, -57] as const, aim: -62 }, B: { at: [0, -50] as const } };
const Bk = { ...BODY, pelvis: 6, root: [2, 3] as const, legB: { at: 15, foot: -12 }, legF: { at: [-16, -7] as const, foot: 38 },
  F: { at: [14, -54] as const, aim: -58 }, B: { at: [13, -56] as const, hand: -20 } };
const BP = { ...BODY, root: [2, 1] as const, legB: { at: 1, foot: 0 }, legF: { at: [-3, -16] as const, foot: 22 },
  F: { at: [15, -57] as const, aim: -62 }, B: { at: [2, -52] as const } };

export const DASH = clip(240, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }], [
  [0, A], [60, { ...AP, ease: "out" }], [120, { ...Bk, ease: "in" }], [180, { ...BP, ease: "out" }], [240, { ...A, ease: "in" }],
], { lag: { head: 30, "armB.up": 30, "armB.lo": 30 } });
