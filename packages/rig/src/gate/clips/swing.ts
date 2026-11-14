/** Swing (Pipe): a club swing from the side. The pipe goes back over the shoulder with the
 *  chest turned away, then hips, chest, arm and wrist whip it level into the target; it carries
 *  on down past the contact and comes back up to the ready. Contact at 150 of 280. */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const SWING = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [80, { root: [-5, 5.2], pelvis: -6, torso: -10, head: 8, F: { at: [-3, -71], aim: -160 }, B: { up: -45, lo: -100, hand: 10 }, face: "grit", ease: "out" }],
  [150, { root: [7, 5.6], pelvis: 5, torso: 24, head: -16, F: { at: [31, -41], aim: -26 }, B: { up: 30, lo: -120, hand: -25 }, face: "shout", ease: "in" }],
  [200, { root: [8.5, 6], torso: 30, head: -12, F: { at: [27, -33], aim: 22 }, B: { up: 36, lo: -118, hand: -25 }, ease: "out" }],
  [240, { root: [3, 4.8], pelvis: 2, torso: 23, head: -10, F: { at: [26, -46], aim: -70 }, B: { up: 18, lo: -118, hand: -10 }, ease: "inOut" }],
  [280, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 32, "armB.up": 76, "armB.lo": 76, handB: 76 } });
