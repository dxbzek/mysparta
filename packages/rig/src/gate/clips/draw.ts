/** Draw: the hand goes to the back hip for the next weapon, the chest turns and the eyes follow
 *  it; then it is pulled up and flipped over into the ready, overshooting a little. A strong,
 *  quick beat: with throws in most bouts it is seen nearly every bout (owner amendment 13.8). */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const DRAW = clip(200, false, [], [
  [0, STANCE],
  [70, { root: [-3, 6], torso: 20, head: 18, pelvis: -4, F: { at: [-5, -44], hand: 50 }, B: { at: [10, -52] }, face: "grit", ease: "out" }],
  [120, { root: [-1, 4.5], torso: 10, head: 2, pelvis: 0, F: { at: [8, -54], hand: 62 }, B: { at: [8, -56] }, ease: "inOut" }],
  [160, { root: [0, 3], torso: 5, head: -9, F: { at: [14, -57], hand: -12 }, B: { at: [7, -57] } }],
  [200, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 30, "armB.up": 40, "armB.lo": 40 } });
