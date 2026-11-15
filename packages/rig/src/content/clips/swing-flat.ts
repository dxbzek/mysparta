/**
 * SWING_FLAT (Frying Pan, Wok): a one-hand flat forehand, like a tennis shot (review of 15 Nov
 * 2026, item 55: both used to chop down overhead, against their use lines). 280 ms with the
 * contact at 150, the same timeline as `swing`.
 *
 * The take-back lifts the pan up and back over the head (as the old swing did), so its wide
 * head never crosses its holder's face (verifier follow-up, 15 Nov 2026: a take-back at
 * shoulder height dragged the pan across the face, and under-arm loops break the wrist and
 * turn-speed limits for a pan this long). The drive is the flat part: the front foot strides,
 * the hips and chest open, the hand comes down to chest height early and drives out level with
 * the arm long, so the pan meets the target in front of the chest travelling level instead of
 * chopping down onto it. It carries on across, then comes back to the guard. The back arm
 * balances. Arm, wrist and turn speeds stay inside the drawn gate (drawn.test).
 */
import { clip, STANCE } from "../../gate/clips/kit";

const BACK_FOOT = ["footB"] as const;

export const SWING_FLAT = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [60, { root: [-4, 4.8], pelvis: -9, torso: -4, head: 7, F: { up: -122, lo: -46, aim: -128 }, B: { dir: 55, reach: 0.6 }, face: "grit" }],
  [98, { root: [-1, 5.4], pelvis: -2, torso: 8, head: 2, legF: { at: [15, -5] }, F: { up: -96, lo: -50, aim: -92 }, B: { dir: 80, reach: 0.6 } }],
  [112, { root: [1.5, 5.6], pelvis: 1, torso: 11, head: -2, legF: { at: [16, -2] }, F: { up: -80, lo: -58, aim: -76 }, B: { dir: 95, reach: 0.6 } }],
  [124, { root: [3.5, 5.8], pelvis: 4, torso: 13, head: -5, legF: { at: 17 }, F: { dir: 34, reach: 0.8, aim: -56 }, B: { dir: 110, reach: 0.62 } }],
  [150, { root: [7, 6], pelvis: 8, torso: 16, head: -10, F: { dir: 14, reach: 0.92, aim: -32 }, B: { dir: 125, reach: 0.65 }, face: "shout" }],
  [180, { root: [8, 6], pelvis: 9, torso: 18, head: -12, F: { dir: 2, reach: 0.88, aim: -52 }, B: { dir: 112, reach: 0.62 } }],
  [228, { root: [5, 5.2], pelvis: 5, torso: 14, head: -10, legF: { at: [14, -4] }, F: { dir: 12, reach: 0.72, aim: -60 }, B: { dir: 85, reach: 0.6 }, face: "grit" }],
  [280, { ...STANCE }],
], { plant: BACK_FOOT, lag: { head: 40 } });
