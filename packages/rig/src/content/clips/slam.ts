/**
 * Slam (content clip, Body Slam and Grapple, empty hands): he steps in and wraps both arms round
 * the enemy (the grab, held by a Grapple as its squeeze), hauls it up over his head leaning back,
 * then drives it down into the floor in front of him with his whole weight (contact at the floor
 * hit), and stands back up. 920 ms, contact at 600; the `step` event marks the grab pose.
 */
import { clip, BOTH_FEET, STANCE } from "../../gate/clips/kit";
import type { Spec } from "../../gate/clips/kit";

/** The clip time of the grab pose (the Grapple's squeeze holds it). */
const SLAM_GRAB_MS = 140;

const GRAB: Spec = { root: [5, 6.5], pelvis: 4, torso: 26, head: -6, legF: { at: 15 }, legB: { at: -12 },
  F: { at: [25, -60], hand: 10 }, B: { at: [22, -57], hand: 10 }, face: "grit" };

export const SLAM = clip(920, false, [{ t: SLAM_GRAB_MS, name: "step" }, { t: 600, name: "contact" }], [
  [0, STANCE],
  [SLAM_GRAB_MS, { ...GRAB, ease: "out" }],
  [320, { root: [-1, 3], pelvis: -2, torso: -16, head: -20, legF: { at: 13 }, legB: { at: -14 },
    F: { at: [7, -94], hand: -10 }, B: { at: [3, -95], hand: -10 }, face: "shout", ease: "inOut" }],
  [400, { root: [0.5, 3.6], pelvis: -1, torso: -6, head: -16, F: { at: [14, -92], hand: -6 }, B: { at: [10, -93], hand: -6 }, ease: "in" }],
  [470, { root: [2.5, 5.5], pelvis: 1, torso: 10, head: -12, F: { up: -150, lo: -8, hand: 0 }, B: { up: -146, lo: -12, hand: 0 }, ease: "linear" }],
  [540, { root: [5, 8.5], pelvis: 3, torso: 26, head: -6, F: { up: -98, lo: -26, hand: 6 }, B: { up: -94, lo: -30, hand: 6 }, ease: "linear" }],
  [600, { root: [6.5, 10], pelvis: 5, torso: 40, head: 2, legF: { at: 17 }, legB: { at: -15 },
    F: { up: -44, lo: -36, hand: 12 }, B: { up: -40, lo: -40, hand: 12 }, scale: [1.05, 0.95], face: "shout", ease: "linear" }],
  [700, { root: [5.5, 9.5], pelvis: 4, torso: 38, head: 0, F: { up: -40, lo: -44, hand: 12 }, B: { up: -36, lo: -46, hand: 12 }, scale: [1, 1], ease: "out" }],
  [920, { ...STANCE, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 30, "armB.up": 20, "armB.lo": 20 } });
