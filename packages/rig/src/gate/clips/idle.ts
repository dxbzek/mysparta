/** Idle: a 1.2 s breathing loop in the fighting stance, with a weight shift: the hips drift onto
 *  the front foot and back while the chest breathes against them, the head and the guard hand
 *  trailing the chest, so the breath rolls through the body instead of moving it as one block. */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const IDLE = clip(1200, true, [], [
  [0, STANCE],
  [300, { root: [0.6, 4.4], torso: 11.5, head: -9, pelvis: 1.5, F: { at: [13, -50.6], aim: -80 }, B: { up: 8.5, lo: -141.5, hand: 0 }, ease: "inOut" }],
  [600, { root: [-0.4, 4.0], torso: 10.5, head: -7, pelvis: 0, F: { at: [12.4, -51.2], aim: -82 }, B: { up: 7.5, lo: -140.5, hand: 0 }, ease: "inOut" }],
  [900, { root: [-1.8, 3.0], torso: 7.5, head: -4, pelvis: -1.5, F: { at: [11.4, -52.8], aim: -87 }, B: { up: 5.5, lo: -138.5, hand: 0 }, ease: "inOut" }],
  [1200, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 110, "armB.up": 80, "armB.lo": 80, handB: 80, handF: 60, "armF.lo": 30 } });
