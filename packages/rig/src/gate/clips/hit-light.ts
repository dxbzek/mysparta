/** Hit (light): the flinch, from the point of impact outwards. The head snaps back first, the
 *  chest folds back after it, then the hips are pushed back and the back foot steps back to catch
 *  the weight; the weapon arm is knocked up and the free hand flies open. Then the body comes
 *  back over the front foot into the stance, the back foot sliding home. */
import { clip, STANCE } from "./kit";

export const HIT_LIGHT = clip(300, false, [], [
  [0, { ...STANCE, face: "dazed" }],
  [36, { root: [-1.5, 3.6], torso: 2, head: -26, pelvis: 0, F: { at: [11, -54], aim: -93 }, B: { up: 4, lo: -132, hand: 10 }, face: "dazed", ease: "out" }],
  [86, { root: [-4.5, 4.4], torso: -14, head: -22, pelvis: -3, legB: { at: [-15, -4], foot: 12 }, F: { at: [6, -59], aim: -116 }, B: { up: 14, lo: -110, hand: 18 }, ease: "out" }],
  [146, { root: [-7, 5.2], torso: -9, head: -15, pelvis: -4, legB: { at: -17 }, F: { at: [7, -57], aim: -110 }, B: { up: 14, lo: -114, hand: 14 }, ease: "inOut" }],
  [230, { root: [-3, 4.6], torso: 8, head: -5, pelvis: -1, legB: { at: -14 }, F: { at: [11, -53], aim: -92 }, B: { up: 9, lo: -132, hand: 4 }, face: "grit", ease: "inOut" }],
  [300, { ...STANCE, face: "grit", ease: "inOut" }],
], { plant: ["footF"], lag: { torso: 30, "armB.up": 40, "armB.lo": 40, handB: 40, handF: 30 } });
