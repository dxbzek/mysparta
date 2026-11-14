/**
 * Throw: an overarm throw of whatever is in the front hand (a content clip; the rig lane authors
 * it so the content lane can use it as it is: `import { THROW } from "../gate/clips/throw"`).
 * Timing table: release at 180, then an 80 ms recoil (260 in all).
 *   0-90    wind-up: weight back onto the back foot, chest turned away, the throwing arm up and
 *           cocked with the item behind the head, the free arm reaching at the target
 *   90-180  hips, then chest, then the arm whip over the top; the free arm pulls in
 *   180     release: the hand out in front at shoulder height, arm nearly straight
 *   180-260 follow-through down across the body onto the front foot, then the recoil
 */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const THROW = clip(260, false, [{ t: 180, name: "release" }], [
  [0, STANCE],
  [55, { root: [-3, 4.6], pelvis: -3, torso: -4, head: 0, F: { up: 128, lo: -138, hand: 25 }, B: { up: -50, lo: -60, hand: 0 }, face: "grit" }],
  [110, { root: [-6, 6], pelvis: -6, torso: -15, head: 4, F: { up: 158, lo: -100, hand: 25 }, B: { up: -62, lo: -30, hand: -10 }, ease: "inOut" }],
  [180, { root: [6, 5.5], pelvis: 5, torso: 22, head: -14, F: { up: 242, lo: -14, hand: 10 }, B: { up: 18, lo: -100, hand: -20 }, face: "shout", ease: "in" }],
  [225, { root: [8.5, 6.5], pelvis: 6, torso: 31, head: -10, F: { up: 290, lo: -12, hand: 0 }, B: { up: 40, lo: -110, hand: -20 }, ease: "out" }],
  [260, { root: [3, 5], pelvis: 2, torso: 16, head: -8, F: { up: 352, lo: -92, hand: 0 }, B: { up: 15, lo: -125, hand: -10 }, face: "grit" }],
], { plant: BOTH_FEET, lag: { head: 32, "armB.up": 40, "armB.lo": 40, handB: 40, handF: 20 } });
