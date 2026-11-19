/** Enter: the jump into the arena. The stage carries the actor in from the side; the clip is the
 *  height of the arc (root y), the tuck, the reach for the floor, and a deep landing at 370. */
import { clip, STANCE } from "./kit";

export const ENTER = clip(450, false, [{ t: 370, name: "land" }], [
  [0, { root: [0, -22], torso: 18, head: -10, legF: { up: -85, lo: 115, foot: 10 }, legB: { up: -35, lo: 105, foot: 25 },
    F: { up: -150, lo: -48, hand: 30 }, B: { up: -120, lo: -60 }, face: "shout" }],
  [150, { root: [0, -34], torso: 8, head: -8, legF: { up: -60, lo: 70, foot: 5 }, legB: { up: 5, lo: 85, foot: 20 },
    F: { up: -165, lo: -45, hand: 20 }, B: { up: -140, lo: -45 }, ease: "out" }],
  [300, { root: [0, -9], torso: 4, head: -6, legF: { up: -28, lo: 22, foot: 0 }, legB: { up: 14, lo: 30, foot: 15 },
    F: { up: -80, lo: -50, hand: 10 }, B: { up: -50, lo: -60 }, ease: "in" }],
  [370, { root: [0, 13], torso: 24, head: -16, legF: { at: 13 }, legB: { at: -13 },
    F: { at: [16, -44], aim: -72 }, B: { up: -20, lo: -110, hand: 0 }, face: "grit", scale: [1.08, 0.9], ease: "in" }],
  [450, { ...STANCE, face: "grit", ease: "out" }],
], { lag: { head: 40, "armB.up": 50, "armB.lo": 50 } });
