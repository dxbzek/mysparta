/**
 * Throw variants (content clips). Each has the throw's timeline: 260 ms, the item leaves the hand
 * at the `release` at 180 (timing table), then the recoil. The overarm lob (`throw`, the rig
 * lane's clip) stays for the Bricks, the Paint Can, the Bottle, the Cone, the Rubber Ball and a
 * one-hand melee weapon thrown away.
 *
 * THROW_SIDE (Boomerang, Hubcap): a backhand side-arm, like a flying disc. The chest turns away
 * and the throwing hand is drawn in to the chest at shoulder height, elbow up and out in front,
 * the item tucked back along the forearm; then hips, chest and arm unwind and the forearm
 * unfolds level at shoulder height, the wrist snapping the item flat; it lets go with the arm
 * long in front of the shoulder, and the arm carries on across (owner: "Wrongful animation
 * throwing"; the old key swung it down by the knees).
 *
 * THROW_ROLL (Tyre): bowled underhand with both hands. A deep bend at the knees and the waist,
 * the tyre swung back low under the chest beside the knees (its furthest back just before the
 * step), then forward close to the floor on a long front step; it leaves the hands at knee
 * height in front, and the body rises after it.
 *
 * THROW_FLICK (Darts, pinched along the hand: `DART_GRIP`): at eye level. The forearm cocks up
 * so the dart sits by the ear pointing at the target, the elbow up in front, and the forearm
 * flicks straight out, the wrist snapping down after the release. The body barely moves.
 *
 * THROW_HEAVE (any two-hand melee weapon thrown away): both hands take it back over the head
 * and heave it forward, like a throw-in, the chest whipping over the front leg.
 */
import { DART_GRIP } from "../weapons/thrown";
import { clip, BOTH_FEET, STANCE } from "../../gate/clips/kit";

const BACK_FOOT = ["footB"] as const;
const LAG = { head: 32, "armB.up": 25, "armB.lo": 25, handB: 25 };
const RELEASE = [{ t: 180, name: "release" as const }];

export const THROW_SIDE = clip(260, false, RELEASE, [
  [0, STANCE],
  [76, { root: [-4, 5.4], pelvis: -4, torso: 3, head: -9, F: { up: -30, lo: -150, hand: 30 }, B: { up: -56, lo: -60, hand: -8 }, face: "grit" }],
  [112, { root: [-1, 5.6], pelvis: 0, torso: 6, head: -10, F: { up: -42, lo: -128, hand: 22 }, B: { up: -40, lo: -70, hand: -8 } }],
  [146, { root: [2.5, 5.8], pelvis: 3, torso: 10, head: -10, legF: { at: [15, -5] }, F: { up: -62, lo: -72, hand: 4 }, B: { up: -5, lo: -105, hand: -5 } }],
  [180, { root: [6, 6], pelvis: 7, torso: 12, head: -10, legF: { at: 17 }, F: { dir: 6, reach: 0.93, hand: -2 }, B: { up: 18, lo: -115, hand: -10 }, face: "shout" }],
  [215, { root: [8, 6.4], pelvis: 9, torso: 16, head: -10, F: { dir: 16, reach: 0.9, hand: -22 }, B: { up: 22, lo: -120, hand: -12 } }],
  [260, { root: [4, 5.2], pelvis: 4, torso: 13, head: -8, legF: { at: [14, -4] }, F: { dir: 45, reach: 0.78, hand: -12 }, B: { up: 12, lo: -132, hand: -4 }, face: "grit" }],
], { plant: BACK_FOOT, lag: LAG });

export const THROW_ROLL = clip(260, false, RELEASE, [
  [0, STANCE],
  [70, { root: [-3, 12], pelvis: -4, torso: 28, head: -24, F: { dir: 80, reach: 0.85, aim: -30 }, face: "grit" }],
  [120, { root: [-6, 16], pelvis: -8, torso: 40, head: -32, F: { dir: 80, reach: 0.9, aim: 30 } }],
  [152, { root: [1, 17], pelvis: 1, torso: 42, head: -34, legF: { at: [17, -5] }, F: { dir: 92, reach: 0.92, aim: 14 } }],
  [180, { root: [8, 17], pelvis: 8, torso: 42, head: -34, legF: { at: 22 }, F: { dir: 62, reach: 0.93, aim: -6 }, face: "shout" }],
  [220, { root: [9, 13], pelvis: 8, torso: 32, head: -26, F: { dir: 30, reach: 0.9, aim: -34 }, B: { up: -12, lo: -100, hand: 0 } }],
  [260, { root: [4, 7], pelvis: 4, torso: 16, head: -12, legF: { at: [15, -4] }, F: { dir: 40, reach: 0.8, aim: -70 }, B: { up: 0, lo: -120, hand: 0 }, face: "grit" }],
], { plant: BACK_FOOT, lag: LAG });

const D = DART_GRIP;
export const THROW_FLICK = clip(260, false, RELEASE, [
  [0, STANCE],
  [45, { root: [-1, 4], pelvis: -1, torso: 6, head: -6, F: { dir: 0, reach: 0.5, aim: -30, grip: D }, B: { up: -14, lo: -124, hand: 0 }, face: "grit" }],
  [90, { root: [-2, 4], pelvis: -3, torso: 4, head: -6, F: { dir: -58, reach: 0.5, aim: -62, grip: D }, B: { up: -26, lo: -110, hand: 0 } }],
  [130, { root: [-3, 4.2], pelvis: -4, torso: 2, head: -6, F: { dir: -62, reach: 0.48, aim: -68, grip: D } }],
  [180, { root: [2, 4.6], pelvis: 2, torso: 10, head: -10, F: { dir: -26, reach: 0.8, aim: -18, grip: D }, B: { up: -10, lo: -130, hand: 0 }, face: "shout" }],
  [215, { root: [3, 4.8], pelvis: 3, torso: 12, head: -10, F: { dir: 0, reach: 0.92, aim: 20, grip: D } }],
  [260, { root: [1, 4], pelvis: 1, torso: 10, head: -8, F: { dir: 40, reach: 0.7, aim: -10, grip: D }, B: { up: 0, lo: -136, hand: 0 }, face: "grit" }],
], { plant: BOTH_FEET, lag: { head: 32, "armB.up": 30, "armB.lo": 30 } });

export const THROW_HEAVE = clip(260, false, RELEASE, [
  [0, STANCE],
  [70, { root: [-3, 4], pelvis: -4, torso: -2, head: -6, F: { dir: -30, reach: 0.6, aim: -120 }, face: "grit" }],
  [118, { root: [-6, 3.4], pelvis: -8, torso: -12, head: -12, F: { dir: -92, reach: 0.8, aim: -162 } }],
  [150, { root: [-1, 5.5], pelvis: -1, torso: 4, head: -8, legF: { at: [15, -5] }, F: { dir: -62, reach: 0.86, aim: -125 } }],
  [180, { root: [7, 8], pelvis: 6, torso: 18, head: -8, legF: { at: 19 }, F: { dir: -30, reach: 0.9, aim: -88 }, face: "shout" }],
  [215, { root: [9, 9], pelvis: 8, torso: 24, head: -6, F: { dir: 4, reach: 0.9, aim: -50 } }],
  [260, { root: [4, 6], pelvis: 4, torso: 16, head: -8, legF: { at: [15, -4] }, F: { dir: 40, reach: 0.8, aim: -50 }, face: "grit" }],
], { plant: BACK_FOOT, lag: LAG });
