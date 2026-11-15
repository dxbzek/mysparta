/**
 * Smash (content clip): the heavy overhead two-hand blow of the Shovel, Sledgehammer, Pickaxe,
 * Stop Sign, Anvil, Ball and Chain and Folding Chair. 380 ms, contact at 240 (timing table).
 *
 * A heavy thing is lifted, not flicked: the weight settles back, the hands carry the head up past
 * the face and over the top until it hangs behind the head (the slowest part, so the weight
 * reads), then the hips drop and the chest folds over the front leg and drags the head down in a
 * big arc; the arms are long at the contact and the head lands level, falls on past it toward
 * the floor and the body has to come back up out of the crouch. The back hand stays on the shaft
 * all through (the engine pins it to `grip2`); these keys move the front hand and the body.
 */
import { clip, BOTH_FEET, STANCE } from "../../gate/clips/kit";

export const SMASH = clip(380, false, [{ t: 240, name: "contact" }], [
  [0, STANCE],
  [60, { root: [-3, 4.6], pelvis: -4, torso: 1, head: -4, F: { dir: -10, reach: 0.6, aim: -112 }, face: "grit" }],
  [92, { root: [-4, 4], pelvis: -5, torso: -3, head: -7, F: { dir: -55, reach: 0.72, aim: -138 } }],
  [118, { root: [-5, 3.4], pelvis: -6, torso: -6, head: -10, F: { dir: -82, reach: 0.8, aim: -152 } }],
  [132, { root: [-5.2, 3.2], pelvis: -6, torso: -6, head: -11, F: { dir: -94, reach: 0.84, aim: -160 }, ease: "out" }],
  [159, { root: [-3.5, 4.2], pelvis: -4, torso: 0, head: -10, F: { dir: -74, reach: 0.88, aim: -128 } }],
  [186, { root: [-1, 6], pelvis: -1, torso: 7, head: -8, F: { dir: -46, reach: 0.91, aim: -101 } }],
  [213, { root: [3, 8.5], pelvis: 2, torso: 14, head: -6, F: { dir: -18, reach: 0.92, aim: -73 } }],
  [240, { root: [7, 11], pelvis: 6, torso: 21, head: -4, F: { dir: 8, reach: 0.93, aim: -46 }, face: "shout", scale: [1.03, 0.97] }],
  [270, { root: [9, 12.5], pelvis: 8, torso: 32, head: -1, F: { dir: 40, reach: 0.92, aim: -16 }, scale: [1, 1] }],
  [300, { root: [9, 13], pelvis: 8, torso: 36, head: 0, F: { dir: 66, reach: 0.9, aim: 12 }, ease: "out" }],
  [335, { root: [6, 9], pelvis: 5, torso: 26, head: -6, F: { dir: 56, reach: 0.82, aim: -22 }, face: "grit" }],
  [358, { root: [2, 5.4], pelvis: 2, torso: 16, head: -6, F: { dir: 50, reach: 0.62, aim: -56 } }],
  [380, { ...STANCE }],
], { plant: BOTH_FEET, lag: { head: 40, "armB.up": 20, "armB.lo": 20 } });
