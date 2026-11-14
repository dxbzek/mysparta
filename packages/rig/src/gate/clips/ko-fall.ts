/**
 * KO fall: a full fall with every joint in it (owner, 15 Nov 2026: "Even when going down KO").
 *   0    from the stance the blow lands
 *   70   the head is thrown back, the arms fly up
 *   180  the knees buckle and the body drops; the grip goes slack and the weapon tips out
 *   320  he tips over backwards, arms thrown up; the weapon leaves the open hand
 *   450  the back hits the floor (land), the body squashes, the head knocks back
 *   520  one small bounce
 *   600  settles flat: knees up a little, arms out, the weapon lying on the floor by his hand
 * The body falls around its feet (`spin`); the engine keeps its lowest point on the floor.
 */
import { clip, STANCE } from "./kit";

export const KO_FALL = clip(600, false, [{ t: 450, name: "land" }], [
  [0, { ...STANCE, face: "dazed" }],
  [70, { root: [-3, 3], torso: -20, head: -30, held: 0, legF: { at: 11 }, legB: { at: -12 },
    F: { at: [1, -63], aim: -140 }, B: { up: -80, lo: -120, hand: 30 }, face: "dazed" }],
  [180, { root: [-3, 15], torso: 8, head: 26, legF: { at: 9, foot: 0 }, legB: { at: -9, foot: 20 },
    F: { at: [5, -32] }, B: { at: [-5, -33] }, held: 35, ease: "inOut" }],
  [320, { root: [0, 0], spin: -50, torso: -14, head: -26, legF: { up: -78, lo: 105, foot: 25 }, legB: { up: -45, lo: 115, foot: 15 },
    F: { up: -150, lo: -30, hand: 25 }, B: { up: -172, lo: -22, hand: 10 }, item: 150, ease: "in" }],
  [450, { spin: -88, torso: -6, head: -20, legF: { up: -62, lo: 72, foot: 20 }, legB: { up: -32, lo: 54, foot: 15 },
    F: { up: -162, lo: -18, hand: 30 }, B: { up: -125, lo: -30, hand: 15 }, item: 186, scale: [1.08, 0.92], ease: "in" }],
  [520, { root: [0, -3.5], spin: -84, torso: -2, head: -9, legF: { up: -48, lo: 58, foot: 25 }, legB: { up: -22, lo: 38, foot: 15 },
    F: { up: -152, lo: -26, hand: 34 }, B: { up: -116, lo: -36, hand: 18 }, item: 178, ease: "out" }],
  [600, { root: [0, 0], spin: -90, torso: -4, head: -14, legF: { up: -34, lo: 42, foot: 30 }, legB: { up: -12, lo: 22, foot: 20 },
    F: { up: -166, lo: -14, hand: 40 }, B: { up: -110, lo: -40, hand: 20 }, item: 181, ease: "inOut" }],
], { lag: { head: 50, "armB.up": 60, "armB.lo": 60, handB: 60 } });
