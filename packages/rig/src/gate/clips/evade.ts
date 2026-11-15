/**
 * Evade: a jump back out of a big swing, with the head slipped off the line first (Muybridge,
 * "Animal Locomotion" plate 336 frames 2-3 and plate 338 frame 11, the boxer swaying and ducking
 * away from a lead; plate 163, the standing jump, for the push and the landing; 1887, public
 * domain). The stage carries the hop (22 units back on a 14-unit arc, 320 ms, starting 110 ms
 * before the blow lands); the clip is the body in it:
 *   0    out of the brace, knees bent, guard up
 *   50   the front foot drives him back: the front leg straightens, the back leg already lifts to
 *        reach, the trunk tips back and the chin tucks, so the head leaves the line before the feet
 *        leave the floor
 *   110  the blow passes (contact): leaning well back in the air, knees tucked, both forearms up
 *        in front of the face, the weapon across it
 *   220  the back leg reaches down and back for the floor, the front knee lifts
 *   320  lands on the back foot, then the front, the knees taking it, back in the guard
 */
import { clip, STANCE } from "./kit";

/** When the swing passes, in clip time (the stage's `OUTCOME.evadeLead`). */
export const EVADE_CONTACT = 110;
export const EVADE = clip(320, false, [{ t: 320, name: "land" }], [
  [0, { root: [-2, 6.5], pelvis: -1, torso: 11, head: 0, held: 0, legF: { at: 12 }, legB: { at: -12, foot: 12 },
    F: { at: [12, -56], aim: -92 }, B: { up: 0, lo: -138, hand: 0 }, face: "grit" }],
  [50, { root: [-3, 3], pelvis: -4, torso: -6, head: 10, legF: { up: -22, lo: 20, foot: 30 }, legB: { up: 4, lo: 48, foot: 26 },
    F: { at: [10, -60], hand: 22 }, B: { up: -18, lo: -132, hand: 0 }, ease: "out" }],
  [110, { root: [-4, 2], pelvis: -8, torso: -21, head: 14, legF: { up: -44, lo: 72, foot: 18 }, legB: { up: -4, lo: 86, foot: 30 },
    F: { at: [8.5, -60], hand: 26 }, B: { up: -40, lo: -122, hand: 0 }, ease: "out" }],
  [220, { root: [-3, 2], pelvis: -4, torso: -8, head: 8, legF: { up: -36, lo: 56, foot: 8 }, legB: { up: 18, lo: 22, foot: 14 },
    F: { at: [10, -58], hand: 18 }, B: { up: -14, lo: -134, hand: 0 }, ease: "inOut" }],
  [280, { root: [-2, 4], pelvis: -2, torso: 2, head: 2, legF: { up: -26, lo: 30, foot: 4 }, legB: { up: 14, lo: 18, foot: 8 },
    F: { at: [11, -56], aim: -94 }, B: { up: -4, lo: -138, hand: 0 }, ease: "in" }],
  [320, { ...STANCE, root: [-1.5, 6.5], torso: 12, head: -4, face: "grit", ease: "out" }],
], { lag: { head: 30, "armB.up": 30, "armB.lo": 30 } });
