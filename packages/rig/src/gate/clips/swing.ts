/** Swing (Pipe): a one-hand club swing, the kinetic chain in order. A pipe in a fist sticks out
 *  of the thumb side, across the forearm, so it is swung like a hammer: the wind-up turns the hips
 *  and chest away and raises the elbow, the forearm up and the pipe cocked back over the shoulder,
 *  the free arm forward. Then the chest turns in ahead of the arm, the upper arm
 *  drives down and forward, the elbow opens and the wrist snaps last, so the free arm pulls back hard
 *  against it and the pipe arrives level at the contact with the arm long and pointing down at it. It carries on down past the contact and
 *  comes back up to the ready. The pipe turns at an even rate through the strike, at most about
 *  25 degrees a frame (no joint spins faster than a real arm). Contact at 150 of 280. */
import { clip, BOTH_FEET, STANCE } from "./kit";

export const SWING = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [62, { root: [-5, 5.2], pelvis: -7, torso: -8, head: 8, F: { up: -122, lo: -46, aim: -128 }, B: { up: -15, lo: -120, hand: 5 }, face: "grit" }],
  [106, { root: [1, 5.4], pelvis: 4, torso: 14, head: 2, F: { up: -100, lo: -46, aim: -86 }, B: { up: 0, lo: -118, hand: 0 } }],
  [120, { root: [3, 5.5], pelvis: 5, torso: 18, head: -6, F: { up: -90, lo: -45, aim: -68 }, B: { up: 12, lo: -116, hand: -5 } }],
  [150, { root: [7, 5.6], pelvis: 5, torso: 24, head: -14, F: { up: -70, lo: -42, aim: -32 }, B: { up: 30, lo: -115, hand: -10 }, face: "shout" }],
  [172, { root: [8, 5.8], pelvis: 6, torso: 28, head: -13, F: { up: -60, lo: -42, aim: -16 }, B: { up: 33, lo: -114, hand: -15 } }],
  [195, { root: [8.5, 6], pelvis: 6, torso: 30, head: -12, F: { up: -56, lo: -44, aim: -10 }, B: { up: 33, lo: -115, hand: -15 }, ease: "out" }],
  [225, { root: [6, 5.4], pelvis: 4, torso: 24, head: -10, F: { up: -44, lo: -70, aim: -36 }, B: { up: 24, lo: -124, hand: -8 } }],
  [255, { root: [2, 4.2], pelvis: 1, torso: 15, head: -8, F: { up: -14, lo: -100, aim: -68 }, B: { up: 12, lo: -134, hand: -3 } }],
  [280, { ...STANCE, ease: "out" }],
], { plant: BOTH_FEET, lag: { head: 45, "armB.up": 12, "armB.lo": 12, handB: 12 } });
