/**
 * Reactions (content clips): the heavy flinch and the two blocks.
 *
 * HIT_HEAVY (300 ms, a crit or a hit of a quarter of the health or more): the blow takes him off
 * balance. The head is thrown back hard, the chest folds back after it and the hips are shoved
 * back so far that the back foot has to step back twice its length to catch him; the arms fly
 * up and open and the weapon hand is knocked high. He sags, then pulls himself back over the
 * front foot into the guard, the back foot sliding home.
 *
 * BLOCK (220 ms): forearm up. Both forearms come up in front of the face, the weapon held
 * across them, the chin tucked behind and the knees bent; the blow pushes him back a little
 * (the stage slides him), and he comes back to the guard.
 *
 * BLOCK_SHIELD (220 ms): the shield on the back arm is punched up and forward to meet the blow,
 * the shoulder behind it and the head tucked behind its top edge; the weapon arm stays cocked
 * back, ready to answer. The shield turns with the back forearm (`content/shields.ts`), so the
 * forearm stands upright for the shield to face the blow.
 */
import { clip, BOTH_FEET, STANCE } from "../../gate/clips/kit";

export const HIT_HEAVY = clip(300, false, [], [
  [0, { ...STANCE, face: "dazed" }],
  [32, { root: [-2, 3.4], pelvis: -2, torso: -4, head: -36, F: { at: [10, -56], aim: -100 }, B: { up: 10, lo: -126, hand: 10 }, face: "dazed" }],
  [82, { root: [-8, 4], pelvis: -8, torso: -22, head: -30, legB: { at: [-22, -7], foot: 18 }, F: { at: [3, -63], aim: -128 }, B: { up: 28, lo: -86, hand: 22 } }],
  [140, { root: [-12, 7], pelvis: -8, torso: -14, head: -16, legB: { at: -26 }, F: { at: [4, -60], aim: -120 }, B: { up: 30, lo: -84, hand: 20 }, ease: "inOut" }],
  [196, { root: [-8, 9], pelvis: -4, torso: 12, head: 6, legB: { at: -22 }, F: { at: [8, -52], aim: -101 }, B: { up: 14, lo: -118, hand: 6 }, face: "grit", ease: "inOut" }],
  [248, { root: [-4, 5.4], pelvis: -2, torso: 10, head: -4, legB: { at: [-16, -5], foot: 10 }, F: { at: [11, -52], aim: -88 }, B: { up: 9, lo: -134, hand: 2 }, ease: "inOut" }],
  [300, { ...STANCE, face: "grit", ease: "inOut" }],
], { plant: ["footF"], lag: { torso: 30, "armB.up": 30, "armB.lo": 30, handB: 30 } });

export const BLOCK = clip(220, false, [], [
  [0, STANCE],
  [55, { root: [-3, 8], pelvis: -3, torso: 12, head: 18, F: { dir: -10, reach: 0.6, aim: -100 }, B: { dir: 5, reach: 0.55, hand: -10 }, face: "grit" }],
  [100, { root: [-5, 9], pelvis: -5, torso: 6, head: 14, F: { dir: -12, reach: 0.6, aim: -104 }, B: { dir: 2, reach: 0.55, hand: -14 }, ease: "out" }],
  [160, { root: [-3, 6.5], pelvis: -2, torso: 9, head: 4, F: { dir: 15, reach: 0.58, aim: -92 }, B: { dir: 30, reach: 0.55, hand: -6 }, ease: "inOut" }],
  [220, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 24, "armB.up": 16, "armB.lo": 16 } });

export const BLOCK_SHIELD = clip(220, false, [], [
  [0, STANCE],
  [45, { root: [-2, 7.5], pelvis: -2, torso: 14, head: 16, F: { dir: 58, reach: 0.66, aim: -96 }, B: { up: -62, lo: -88, hand: 0 }, face: "grit", ease: "out" }],
  [100, { root: [-5, 8.5], pelvis: -4, torso: 8, head: 12, F: { dir: 60, reach: 0.66, aim: -98 }, B: { up: -56, lo: -92, hand: 0 }, ease: "out" }],
  [160, { root: [-3, 6], pelvis: -2, torso: 10, head: 2, F: { dir: 52, reach: 0.62, aim: -90 }, B: { up: -22, lo: -120, hand: 0 }, ease: "inOut" }],
  [220, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 24, "armF.up": 16, "armF.lo": 16 } });
