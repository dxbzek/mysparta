/** Punch (fists): a lead straight that starts in the back foot. Weight sinks onto the back leg
 *  and the fist draws in to the chin (the wind-up); then the back leg pushes, the hips turn in,
 *  the chest follows and the shoulder throws the arm, which only straightens at the end, the
 *  forearm staying on the line of the punch (a straight punch does not swing). The rear fist stays
 *  home at the chin. The fist carries a little past the contact and comes back the way it went.
 *  Contact at 150 of 280 (timing table). */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const PUNCH = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [72, { root: [-4, 4.8], pelvis: -5, torso: 3, head: 6, F: { at: [3, -59], hand: 28 }, B: { up: 4, lo: -142, hand: 0 }, face: "grit" }],
  [112, { root: [0.5, 4.8], pelvis: 2, torso: 13, head: -10, F: { at: [16, -61], hand: 16 }, B: { up: -20, lo: -145, hand: 0 }, ease: "in" }],
  [150, { root: [6, 4.8], pelvis: 5, torso: 22, head: -14, F: { at: [37.5, -61.5], hand: 0 }, B: { up: -22, lo: -146, hand: -5 }, face: "shout", ease: "in" }],
  [178, { root: [9.5, 5.6], pelvis: 6, torso: 27, head: -12, F: { at: [43, -60], hand: -4 }, B: { up: -16, lo: -145, hand: -5 }, ease: "out" }],
  [232, { root: [2, 4.2], pelvis: 1, torso: 14, head: -8, F: { at: [17, -55], hand: 22 }, B: { up: -4, lo: -142, hand: 0 } }],
  [280, STANCE],
], { plant: BOTH_FEET, lag: { head: 32, "armB.up": 70, "armB.lo": 70, handB: 70 } });
