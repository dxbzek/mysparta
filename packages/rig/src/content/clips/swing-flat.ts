/**
 * SWING_FLAT (Frying Pan, Wok): a one-hand flat forehand, like a tennis shot (review of 15 Nov
 * 2026, item 55: both used to chop down overhead, against their use lines). 280 ms with the
 * contact at 150, the same timeline as `swing`.
 *
 * Seen from the side, a swing round at shoulder height: the hand is taken back behind the
 * shoulder (the arm short, as it reaches back across), the front foot strides, the hips and
 * chest open, the hand comes round past the chest close to the body and drives out level to
 * meet the target in front of the chest with the arm long, so the pan's head travels level at
 * head-to-chest height instead of chopping down from above. It carries on across, then comes
 * back to the guard. The back arm balances. The pan's own turn stays inside the 25 degrees a
 * frame the wrist may turn (drawn.test).
 */
import { clip, STANCE } from "../../gate/clips/kit";

const BACK_FOOT = ["footB"] as const;

export const SWING_FLAT = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [36, { root: [-2.5, 4.4], pelvis: -8, torso: 4, head: 4, F: { up: 5, lo: -95, aim: -100 }, B: { dir: 50, reach: 0.6 } }],
  [72, { root: [-4, 4.8], pelvis: -12, torso: 2, head: 6, F: { up: 40, lo: -105, aim: -122 }, B: { dir: 55, reach: 0.6 }, face: "grit" }],
  [102, { root: [-1, 5.4], pelvis: -4, torso: 8, head: 2, legF: { at: [15, -5] }, F: { up: -10, lo: -100, aim: -96 }, B: { dir: 80, reach: 0.6 } }],
  [128, { root: [3.5, 5.8], pelvis: 4, torso: 13, head: -5, legF: { at: 17 }, F: { dir: 48, reach: 0.72, aim: -62 }, B: { dir: 110, reach: 0.62 } }],
  [150, { root: [7, 6], pelvis: 8, torso: 16, head: -10, F: { dir: 14, reach: 0.92, aim: -32 }, B: { dir: 125, reach: 0.65 }, face: "shout" }],
  [180, { root: [8, 6], pelvis: 9, torso: 18, head: -12, F: { dir: 2, reach: 0.88, aim: -52 }, B: { dir: 112, reach: 0.62 } }],
  [228, { root: [5, 5.2], pelvis: 5, torso: 14, head: -10, legF: { at: [14, -4] }, F: { dir: 12, reach: 0.72, aim: -60 }, B: { dir: 85, reach: 0.6 }, face: "grit" }],
  [280, { ...STANCE }],
], { plant: BACK_FOOT, lag: { head: 40 } });
