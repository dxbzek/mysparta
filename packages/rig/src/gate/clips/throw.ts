/**
 * Throw: an overarm throw of whatever is in the front hand (a content clip; the rig lane authors
 * it so the content lane can use it as it is: `import { THROW } from "../gate/clips/throw"`).
 * Timing table: release at 180, then an 80 ms recoil (260 in all).
 *   0-100   wind-up: weight back onto the back foot, chest turned away; the throwing arm comes up
 *           in front and folds back so the item is cocked behind the head (the upper arm up, the
 *           elbow high; it never swings round behind the back); the free arm reaches at the target
 *   100-180 hips, then chest, then the arm: the elbow leads forward and the forearm whips over
 *           the top; the free arm pulls in
 *   180     release: the hand out in front a little above the shoulder, the arm long but not locked
 *   180-260 follow-through down in front of the body onto the front foot, then the recoil
 */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const THROW = clip(260, false, [{ t: 180, name: "release" }], [
  [0, STANCE],
  [50, { root: [-3, 4.6], pelvis: -3, torso: -3, head: 0, F: { up: -80, lo: -90, hand: 28 }, B: { up: -40, lo: -80, hand: 0 }, face: "grit" }],
  [100, { root: [-6, 6], pelvis: -6, torso: -14, head: 4, F: { up: -160, lo: -64, hand: 25 }, B: { up: -72, lo: -36, hand: -10 } }],
  [140, { root: [0, 6], pelvis: 2, torso: 4, head: -4, F: { up: -146, lo: -62, hand: 15 }, B: { up: -40, lo: -70, hand: -10 } }],
  [180, { root: [6, 5.5], pelvis: 5, torso: 22, head: -14, F: { up: -128, lo: -40, hand: 0 }, B: { up: 15, lo: -105, hand: -20 }, face: "shout" }],
  [222, { root: [8.5, 6.5], pelvis: 6, torso: 30, head: -10, F: { up: -100, lo: -60, hand: 0 }, B: { up: 20, lo: -122, hand: -14 } }],
  [260, { root: [3, 5], pelvis: 2, torso: 16, head: -8, F: { up: -14, lo: -92, hand: 4 }, B: { up: 20, lo: -134, hand: -6 }, face: "grit" }],
], { plant: BOTH_FEET, lag: { head: 32, "armB.up": 25, "armB.lo": 25, handB: 25, handF: 15 } });
