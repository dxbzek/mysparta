/** Dash: a hard forward run, 240 ms a cycle, two steps. The weapon arm is carried high and
 *  steady; the free arm pumps against the legs. */
import { clip } from "./kit";

const BODY = { torso: 30, head: -20, pelvis: 0, held: 0, face: "grit" as const };
const A = { ...BODY, pelvis: -6, root: [2, 3] as const, legF: { at: 18, foot: -14 }, legB: { at: [-19, -9] as const, foot: 45 },
  F: { at: [16, -55] as const, aim: -60 }, B: { at: [-12, -46] as const, hand: 25 } };
const AP = { ...BODY, root: [2, 1] as const, legF: { at: 1, foot: 0 }, legB: { at: [-1, -21] as const, foot: 30 },
  F: { at: [15, -57] as const, aim: -62 }, B: { at: [0, -50] as const } };
const Bk = { ...BODY, pelvis: 6, root: [2, 3] as const, legB: { at: 18, foot: -14 }, legF: { at: [-19, -9] as const, foot: 45 },
  F: { at: [14, -54] as const, aim: -58 }, B: { at: [13, -56] as const, hand: -20 } };
const BP = { ...BODY, root: [2, 1] as const, legB: { at: 1, foot: 0 }, legF: { at: [-1, -21] as const, foot: 30 },
  F: { at: [15, -57] as const, aim: -62 }, B: { at: [2, -52] as const } };

export const DASH = clip(240, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }], [
  [0, A], [60, { ...AP, ease: "out" }], [120, Bk], [180, { ...BP, ease: "out" }], [240, A],
], { lag: { head: 30, "armB.up": 30, "armB.lo": 30 } });
