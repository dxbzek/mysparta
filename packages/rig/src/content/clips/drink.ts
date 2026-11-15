/**
 * Drink (Energy Drink, content clip): the back hand brings the can up to the mouth, the head
 * tips back and he chugs it, then the can comes down and he squares up again. The can is the
 * Move prop in the back hand; the front hand keeps its weapon in guard. 700 ms.
 */
import { clip, BOTH_FEET, STANCE } from "../../gate/clips/kit";

export const DRINK = clip(700, false, [], [
  [0, STANCE],
  [90, { root: [-1, 3.2], torso: 7, head: -4, B: { at: [8, -56], hand: -6 }, face: "neutral", ease: "inOut" }],
  [170, { root: [-1, 3], torso: 4, head: -8, B: { at: [9, -63], hand: -22 }, ease: "linear" }],
  [240, { root: [-1.5, 2.6], torso: 0, head: -18, B: { at: [6, -70], hand: -48 }, face: "grin", ease: "linear" }],
  [320, { root: [-2.5, 2.2], torso: -6, head: -32, B: { at: [3, -76], hand: -80 }, ease: "inOut" }],
  [430, { root: [-2.8, 2.2], torso: -8, head: -38, B: { at: [2, -77], hand: -90 }, ease: "inOut" }],
  [510, { root: [-2, 2.5], torso: -2, head: -24, B: { at: [5, -71], hand: -60 }, face: "grit", ease: "inOut" }],
  [600, { root: [-1.5, 2.8], torso: 3, head: -10, B: { at: [9, -61], hand: -18 }, ease: "linear" }],
  [700, { ...STANCE, ease: "out" }],
], { plant: BOTH_FEET, lag: { head: 40, "armF.up": 30, "armF.lo": 30 } });
