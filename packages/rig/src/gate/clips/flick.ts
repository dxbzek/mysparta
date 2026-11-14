/** Flick (Pocket Knife): a short, quick stab, blade forward. The knife hand draws back to the
 *  chest with the point already coming on line while the hips turn away; then hip, shoulder and
 *  arm drive it straight out at chest height, the wrist cocked so the point leads, and it carries
 *  through before snapping back to the guard. Contact at 150 of 280. */
import { KNIFE_GRIP } from "../weapons/pocket-knife";
import { clip, BOTH_FEET, STANCE } from "./kit";

const G = KNIFE_GRIP;
export const FLICK = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [78, { root: [-4.5, 4.4], pelvis: -6, torso: -8, head: 8, F: { at: [2, -56], aim: -75, grip: G }, B: { up: -40, lo: -110, hand: 10 }, face: "grit", ease: "out" }],
  [150, { root: [6, 4.8], pelvis: 5, torso: 22, head: -16, F: { at: [40, -59], aim: -3, grip: G }, B: { up: 28, lo: -125, hand: -25 }, face: "shout", ease: "in" }],
  [195, { root: [9.5, 5.6], torso: 28, head: -12, F: { at: [44.5, -58.5], aim: 4, grip: G }, B: { up: 34, lo: -128, hand: -25 }, ease: "out" }],
  [236, { root: [3, 4.6], pelvis: 2, torso: 19, head: -10, F: { at: [24, -57], aim: -45, grip: G }, B: { up: 20, lo: -122, hand: -15 }, ease: "inOut" }],
  [280, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 32, "armB.up": 76, "armB.lo": 76, handB: 76 } });
