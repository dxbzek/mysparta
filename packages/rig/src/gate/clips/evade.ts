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
import { TOE_B, TOE_F } from "./idle";
import { clip, onToe, STANCE, TOE } from "./kit";
import type { LegSpec } from "./kit";

/** When the swing passes, in clip time (the stage's `OUTCOME.evadeLead`). */
export const EVADE_CONTACT = 110;
/** The front foot leaves the floor here; the stage carries the hop from here (movement pass 2). */
export const EVADE_UP = 60;
/** The feet land here, the back one first; the stage's hop is down by the back foot's landing. */
export const EVADE_DOWN = { B: 270, F: 290 } as const;
/** A foot target raised `h` off the floor. */
const above = (l: LegSpec, h: number): LegSpec => ("at" in l && typeof l.at !== "number" ? { at: [l.at[0], l.at[1] - h], foot: l.foot ?? 0 } : l);
export const EVADE = clip(320, false, [{ t: 320, name: "land" }], [
  [0, { root: [-2, 6.5], pelvis: -1, torso: 11, head: 0, held: 0, legF: onToe(TOE_F, 4), legB: onToe(TOE_B, 22),
    F: { at: [12, -56], aim: -92 }, B: { up: 0, lo: -138, hand: 0 }, face: "grit" }],
  [50, { root: [-3, 3], pelvis: -4, torso: -6, head: 10, legF: onToe(TOE_F, 30), legB: onToe(TOE_B, 32),
    F: { at: [10, -60], hand: 22 }, B: { up: -18, lo: -132, hand: 0 }, ease: "out" }],
  // both toes leave their spots straight up as the stage starts the hop (the trunk going on back)
  [EVADE_UP, { root: [-3.2, 2.8], pelvis: -4.7, torso: -8.5, head: 10.7, legF: onToe(TOE_F, 34), legB: onToe(TOE_B, 36),
    F: { at: [9.75, -60], hand: 22.7 }, B: { up: -21.7, lo: -130.3, hand: 0 } }],
  [EVADE_UP + 10, { root: [-3.3, 2.7], pelvis: -5.3, torso: -11, head: 11.3, legF: above(onToe(TOE_F, 34), 2), legB: above(onToe(TOE_B, 36), 2),
    F: { at: [9.5, -60], hand: 23.3 }, B: { up: -25.3, lo: -128.7, hand: 0 } }],
  [110, { root: [-4, 2], pelvis: -8, torso: -21, head: 14, legF: { up: -44, lo: 72, foot: 18 }, legB: { up: -4, lo: 86, foot: 30 },
    F: { at: [8.5, -60], hand: 26 }, B: { up: -40, lo: -122, hand: 0 }, ease: "out" }],
  [220, { root: [-3, 2], pelvis: -4, torso: -8, head: 8, legF: { up: -36, lo: 56, foot: 8 }, legB: { up: 18, lo: 22, foot: 14 },
    F: { at: [10, -58], hand: 18 }, B: { up: -14, lo: -134, hand: 0 }, ease: "inOut" }],
  // each foot comes straight down onto its spot (the body still drifting back as the back one lands)
  [EVADE_DOWN.B - 8, { legB: above(onToe(TOE_B - 0.84, 16), 1.2) }],
  [EVADE_DOWN.B, { root: [-2, 4.5], pelvis: -2, torso: 3, head: 2, legF: above(onToe(TOE_F, 6), 5), legB: onToe(TOE_B, 14),
    F: { at: [11, -56], aim: -94 }, B: { up: -4, lo: -138, hand: 0 }, ease: "in" }],
  [EVADE_DOWN.F - 8, { legF: above(onToe(TOE_F, 8), 1.2) }],
  [EVADE_DOWN.F, { root: [-2, 6], torso: 6, head: 0, legF: onToe(TOE_F, 6), legB: onToe(TOE_B, 10), ease: "out" }],
  [320, { ...STANCE, legF: onToe(TOE_F, 3), legB: onToe(TOE_B, 10), root: [-1.5, 6.5], torso: 12, head: -4, face: "grit", ease: "out" }],
], {
  lag: { head: 30, "armB.up": 30, "armB.lo": 30 },
  // on the floor until the push leaves it, in the air while the stage carries the hop, then the
  // back foot lands and the front after it, each where it stands in the guard
  stride: { speed: 0, contacts: [
    { foot: "footF", from: 0, to: EVADE_UP, at: TOE }, { foot: "footB", from: 0, to: EVADE_UP, at: TOE },
    // (the landings end a hair before the clip: see the blocks in content/clips/reactions.ts)
    { foot: "footB", from: EVADE_DOWN.B, to: 319.9, at: TOE }, { foot: "footF", from: EVADE_DOWN.F, to: 319.9, at: TOE },
  ] },
});
