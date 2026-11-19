/**
 * Thrusts (content clips), 280 ms with the contact at 150 (timing table).
 *
 * THRUST, the pole thrust (Broom, Pitchfork, Pool Cue, Lawn Flamingo, and the Garden Shears'
 * lunge and snip): both hands on the shaft, held at the hip with the head a little up. The shaft
 * is drawn back along its own line while the weight sinks onto the back foot, then the front foot
 * steps out in a real lunge, the hips and the chest drive in behind it and the arms push the head
 * straight forward: the striking end travels along the shaft's line, it never sweeps. The arms
 * angle down to the shaft the way real arms hold a pole level. The back hand stays on the shaft
 * (the engine pins it to `grip2`); the front foot steps back home after.
 *
 * THRUST_1H, the fencing lunge (Plunger, Umbrella, held like a foil: `FOIL_GRIP`): one hand, the
 * arm long at shoulder height and the point level, the back arm thrown up behind for balance,
 * the front foot stepping out long.
 */
import { FOIL_GRIP } from "../weapons/clubs";
import { clip, STANCE } from "../../gate/clips/kit";

const BACK_FOOT = ["footB"] as const;

export const THRUST = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [70, { root: [-4, 5.6], pelvis: -6, torso: 4, head: -6, F: { dir: 62, reach: 0.78, aim: -14 }, face: "grit" }],
  [104, { root: [-1, 5.8], pelvis: -2, torso: 9, head: -8, legF: { at: [15, -6] }, F: { dir: 55, reach: 0.84, aim: -13 }, ease: "in" }],
  [150, { root: [8, 8], pelvis: 6, torso: 21, head: -12, legF: { at: 22 }, F: { dir: 42, reach: 0.93, aim: -12 }, face: "shout", ease: "in" }],
  [180, { root: [9.5, 8.6], pelvis: 7, torso: 24, head: -12, F: { dir: 41, reach: 0.94, aim: -12 }, ease: "out" }],
  [222, { root: [4, 6.2], pelvis: 2, torso: 14, head: -9, legF: { at: [16, -5] }, F: { dir: 56, reach: 0.82, aim: -36 }, face: "grit" }],
  [252, { root: [1.5, 4.6], pelvis: 1, torso: 11, head: -7, legF: { at: [13, -3] }, F: { dir: 52, reach: 0.68, aim: -62 } }],
  [280, { ...STANCE }],
], { plant: BACK_FOOT, lag: { head: 36 } });

const G = FOIL_GRIP;
export const THRUST_1H = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [66, { root: [-4, 5], pelvis: -6, torso: 0, head: -4, F: { dir: 30, reach: 0.75, aim: -8, grip: G }, B: { up: 14, lo: -118, hand: 6 }, face: "grit", ease: "out" }],
  [106, { root: [0, 5.6], pelvis: -1, torso: 7, head: -6, legF: { at: [17, -7] }, F: { dir: 20, reach: 0.85, aim: -6, grip: G }, B: { up: 30, lo: -100, hand: 12 } }],
  [150, { root: [10, 9], pelvis: 6, torso: 16, head: -10, legF: { at: 25 }, F: { dir: 12, reach: 0.94, aim: -4, grip: G }, B: { up: 42, lo: -88, hand: 18 }, face: "shout" }],
  [182, { root: [11.5, 9.6], pelvis: 7, torso: 18, head: -10, F: { dir: 12, reach: 0.94, aim: -3, grip: G }, B: { up: 42, lo: -90, hand: 18 }, ease: "out" }],
  [230, { root: [5, 6.5], pelvis: 2, torso: 12, head: -8, legF: { at: [17, -5] }, F: { dir: 40, reach: 0.8, aim: -20, grip: G }, B: { up: 26, lo: -118, hand: 8 }, face: "grit" }],
  [255, { root: [2.5, 5], pelvis: 1, torso: 10, head: -7, F: { dir: 44, reach: 0.68, aim: -40, grip: G }, B: { up: 14, lo: -132, hand: 3 } }],
  [280, { ...STANCE }],
], { plant: BACK_FOOT, lag: { head: 36 } });
