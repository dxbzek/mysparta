/** Dash: a hard forward run, 240 ms a cycle, two steps. A fighter runs in with his guard up: the
 *  weapon arm is carried high and steady, the free fist pumps a little against the legs but never
 *  leaves the guard, so the run starts from any clip and ends in any strike without the arms
 *  jumping. No leg is pulled straight (the hips ride a little low). */
import { clip } from "./kit";

const BODY = { torso: 22, head: -14, pelvis: 0, held: 0, face: "grit" as const };
const A = { ...BODY, pelvis: -6, root: [2, 4.2] as const, legF: { at: 16, foot: -14 }, legB: { at: [-18, -9] as const, foot: 45 },
  F: { at: [17, -54] as const, aim: -72 }, B: { up: -6, lo: -132, hand: 0 } };
const AP = { ...BODY, root: [2, 2.4] as const, legF: { at: 1, foot: 0 }, legB: { at: [-1, -20] as const, foot: 30 },
  F: { at: [17, -55.5] as const, aim: -74 }, B: { up: 5, lo: -134, hand: 0 } };
const Bk = { ...BODY, pelvis: 6, root: [2, 4.2] as const, legB: { at: 16, foot: -14 }, legF: { at: [-18, -9] as const, foot: 45 },
  F: { at: [16.5, -53.5] as const, aim: -70 }, B: { up: 12, lo: -130, hand: 0 } };
const BP = { ...BODY, root: [2, 2.4] as const, legB: { at: 1, foot: 0 }, legF: { at: [-1, -20] as const, foot: 30 },
  F: { at: [17, -55.5] as const, aim: -74 }, B: { up: 5, lo: -134, hand: 0 } };

export const DASH = clip(240, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }], [
  [0, A], [60, { ...AP, ease: "out" }], [120, Bk], [180, { ...BP, ease: "out" }], [240, A],
], { lag: { head: 30, "armB.up": 30, "armB.lo": 30 } });
