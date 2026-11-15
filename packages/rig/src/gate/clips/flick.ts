/** Flick (Pocket Knife): a short stab with the elbow tucked. The knife hand drops to the hip with
 *  the point already forward while the weight sinks back; then a short push of hip and shoulder
 *  drives the elbow forward along the ribs and the forearm out level at chest height, the wrist
 *  cocked so the point leads in a line, and it carries through before it comes back to the guard.
 *  Contact at 150 of 280. */
import { KNIFE_GRIP } from "../weapons/pocket-knife";
import { clip, BOTH_FEET, STANCE } from "./kit";

const G = KNIFE_GRIP;
export const FLICK = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [76, { root: [-7, 4.8], pelvis: -7, torso: -6, head: 6, F: { up: 4, lo: -104, aim: -28, grip: G }, B: { up: 4, lo: -142, hand: 0 }, face: "grit", ease: "out" }],
  [114, { root: [1, 4.8], pelvis: 2, torso: 12, head: -10, F: { up: -30, lo: -80, aim: -16, grip: G }, B: { up: -20, lo: -145, hand: 0 }, ease: "in" }],
  [150, { root: [6, 4.8], pelvis: 5, torso: 22, head: -14, F: { up: -78, lo: -44, aim: -12, grip: G }, B: { up: -22, lo: -146, hand: -5 }, face: "shout", ease: "in" }],
  [186, { root: [9.5, 5.6], pelvis: 6, torso: 27, head: -12, F: { up: -84, lo: -41, aim: -6, grip: G }, B: { up: -16, lo: -145, hand: -5 }, ease: "out" }],
  [238, { root: [2, 4.2], pelvis: 1, torso: 14, head: -8, F: { up: -40, lo: -85, aim: -30, grip: G }, B: { up: -4, lo: -142, hand: 0 } }],
  [280, { ...STANCE, ease: "out" }],
], { plant: BOTH_FEET, lag: { head: 32, "armB.up": 70, "armB.lo": 70, handB: 70 } });
