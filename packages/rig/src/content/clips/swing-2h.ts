/**
 * Two-hand swings (content clips), 280 ms with the contact at 150, the same timeline as `swing`.
 * Both hands are on the grip end (the engine pins the back hand to `grip2`); these keys move the
 * front hand, which carries both, and the body. Arms angle down to a level shaft, the way real
 * arms hold one.
 *
 * SWING_2H (Bat, Cricket Bat, Rebar): a full side swing from the shoulder. The hands load up in
 * front of the back shoulder with the barrel cocked up behind the head, the front foot strides,
 * the hips open, then the chest, and the hands drive through low in front of the belly so the
 * barrel comes round flat and level into the target, arms long; it carries on across and down,
 * and the hands come back to the guard. Heavier and flatter than the one-hand club swing, which
 * chops down from over the shoulder.
 *
 * SWING_LOW (Golf Club, Hockey Stick, hanging head down from the hands: `CLUB_GRIP`): low to
 * high. From the address (head near the floor in front) the stick is taken back low behind the
 * hip with the arms long, then it sweeps forward close to the floor and rises into the target,
 * finishing up in front before it drops back to the address.
 */
import { CLUB_GRIP } from "../weapons/clubs";
import { clip, STANCE } from "../../gate/clips/kit";

const BACK_FOOT = ["footB"] as const;

export const SWING_2H = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [64, { root: [-5, 4.6], pelvis: -10, torso: -4, head: 6, F: { dir: -20, reach: 0.55, aim: -118 }, face: "grit" }],
  [92, { root: [-2, 5.2], pelvis: -3, torso: 3, head: 2, legF: { at: [15, -5] }, F: { dir: 3, reach: 0.65, aim: -90 } }],
  [121, { root: [3, 6], pelvis: 4, torso: 10, head: -5, legF: { at: 17 }, F: { dir: 28, reach: 0.78, aim: -54 } }],
  [150, { root: [7, 6.4], pelvis: 8, torso: 16, head: -12, F: { dir: 50, reach: 0.9, aim: -16 }, face: "shout" }],
  [180, { root: [8.5, 6.6], pelvis: 9, torso: 19, head: -12, F: { dir: 74, reach: 0.9, aim: 14 } }],
  [222, { root: [5, 5.6], pelvis: 5, torso: 14, head: -10, legF: { at: [14, -4] }, F: { dir: 62, reach: 0.78, aim: -30 }, face: "grit" }],
  [252, { root: [2, 4.6], pelvis: 2, torso: 11, head: -8, legF: { at: [12, -3] }, F: { dir: 54, reach: 0.66, aim: -60 } }],
  [280, { ...STANCE }],
], { plant: BACK_FOOT, lag: { head: 40 } });

const G = CLUB_GRIP;
export const SWING_LOW = clip(280, false, [{ t: 150, name: "contact" }], [
  [0, STANCE],
  [45, { root: [-2.5, 5], pelvis: -5, torso: 10, head: 4, F: { dir: 70, reach: 0.75, aim: 96, grip: G }, face: "grit" }],
  [72, { root: [-5, 6], pelvis: -12, torso: 12, head: 10, F: { dir: 84, reach: 0.9, aim: 108, grip: G } }],
  [98, { root: [-2, 7], pelvis: -4, torso: 14, head: 8, legF: { at: [14, -4] }, F: { dir: 76, reach: 0.93, aim: 80, grip: G } }],
  [124, { root: [3, 7.5], pelvis: 4, torso: 14, head: 0, legF: { at: 16 }, F: { dir: 54, reach: 0.93, aim: 48, grip: G } }],
  [150, { root: [6, 7], pelvis: 8, torso: 12, head: -8, F: { dir: 24, reach: 0.92, aim: 12, grip: G }, face: "shout" }],
  [185, { root: [6.5, 5.4], pelvis: 8, torso: 8, head: -14, F: { dir: -6, reach: 0.85, aim: -24, grip: G } }],
  [235, { root: [4, 4.6], pelvis: 4, torso: 8, head: -10, legF: { at: [13, -4] }, F: { dir: 30, reach: 0.7, aim: 30, grip: G }, face: "grit" }],
  [280, { ...STANCE }],
], { plant: BACK_FOOT, lag: { head: 40 } });
