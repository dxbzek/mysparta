/** Punch (fists): a straight from the guard. The fist cocks back and down while the hips turn
 *  away, then the hip, the shoulder and the arm go in that order; the fist passes the contact
 *  pose and comes back to the guard. Contact at 150 of 280 (timing table). */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const PUNCH = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [78, { root: [-4.5, 4.4], pelvis: -6, torso: -8, head: 8, F: { at: [2, -56], hand: 25 }, B: { up: -40, lo: -110, hand: 10 }, face: "grit", ease: "out" }],
  [150, { root: [6, 4.8], pelvis: 5, torso: 22, head: -16, F: { at: [37.5, -61.5], hand: 0 }, B: { up: 28, lo: -125, hand: -25 }, face: "shout", ease: "in" }],
  [195, { root: [9.5, 5.6], torso: 28, head: -12, F: { at: [43, -60], hand: -5 }, B: { up: 34, lo: -128, hand: -25 }, ease: "out" }],
  [236, { root: [3, 4.6], pelvis: 2, torso: 19, head: -10, F: { at: [24, -57], hand: -10 }, B: { up: 20, lo: -122, hand: -15 }, ease: "inOut" }],
  [280, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 32, "armB.up": 76, "armB.lo": 76, handB: 76 } });
