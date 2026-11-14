/** Hit (light): the flinch. The hips are knocked back, the chest folds back after them and the
 *  head snaps after the chest; the weapon arm is knocked up and out, the free hand flies open.
 *  Then the body comes back into the stance through a small forward overshoot. */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const HIT_LIGHT = clip(300, false, [], [
  [0, { ...STANCE, face: "dazed" }],
  [50, { root: [-6, 5], torso: -19, head: -30, pelvis: -4, F: { at: [2, -60], aim: -140 }, B: { at: [-6, -67], hand: 45 }, face: "dazed", ease: "out" }],
  [140, { root: [-4.5, 5.2], torso: -11, head: -18, pelvis: -2, F: { at: [6, -57], aim: -126 }, B: { at: [-1, -62], hand: 20 }, ease: "inOut" }],
  [230, { root: [0, 4], torso: 12, head: -4, pelvis: 0, F: { at: [12, -51], aim: -116 }, B: { at: [8, -55] }, face: "grit", ease: "inOut" }],
  [300, { ...STANCE, face: "grit", ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 45, "armB.up": 70, "armB.lo": 70, handB: 70, handF: 40 } });
