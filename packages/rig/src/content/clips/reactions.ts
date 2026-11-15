/**
 * Reactions (content clips): the heavy flinch and the two blocks.
 *
 * HIT_HEAVY (300 ms, a crit or a hit of a quarter of the health or more): the blow takes him off
 * balance. The head is thrown back hard, the chest folds back after it and the hips are shoved
 * back so far that the back foot has to step back twice its length to catch him; the arms fly
 * up and open and the weapon hand is knocked high. He sags, then pulls himself back over the
 * front foot into the guard, the back foot sliding home.
 *
 * The blocks (movement pass, 16 Nov 2026; Muybridge, "Animal Locomotion" plates 336 frames 4, 8
 * and 9 and 340 frames 1-3, a forearm raised square into the line of a lead, 1887, public domain).
 * The stage plays a block FROM the moment the blow lands, after the brace has already put the
 * guard up (`GUARD_UP`), and slides the fighter back 6 units over 120 ms (eased out). So t = 0 is
 * the impact: the forearms are driven back toward the face and the trunk rocks back over the
 * back foot, which pushes into the floor; then he comes forward into the guard. The feet take a
 * real step instead of sliding with the stage: the back foot lifts at once and lands again
 * further back on the floor; the front foot keeps its place on the floor while the body is
 * pushed off it (a `move` that cancels the stage's slide) and then steps back after it.
 *
 * BLOCK (220 ms): both forearms up, the weapon fist high in front of the face (a weapon held in
 * it stands across the blow), the free forearm by the cheek, the chin tucked between them.
 *
 * BLOCK_SHIELD (220 ms): the shield on the back arm held square to the blow in front of the face:
 * the back forearm at about -124 degrees, where the shield stands upright (`content/shields.ts`,
 * the grip turn), the upper arm raised forward so its top edge is over the head; the head low
 * behind it and the weapon arm drawn in by the ribs, ready to answer. It takes the blow a little harder: the trunk rocks further back.
 */
import type { Contact } from "../../engine/sample";
import { GUARD_UP } from "../../gate/clips/brace";
import { TOE_B, TOE_F } from "../../gate/clips/idle";
import { clip, onToe, STANCE, TOE } from "../../gate/clips/kit";
import type { LegSpec, Spec } from "../../gate/clips/kit";

export const HIT_HEAVY = clip(300, false, [], [
  [0, { ...STANCE, face: "dazed" }],
  [32, { root: [-2, 3.4], pelvis: -2, torso: -4, head: -36, F: { at: [10, -56], aim: -100 }, B: { up: 10, lo: -126, hand: 10 }, face: "dazed" }],
  [82, { root: [-8, 4], pelvis: -8, torso: -22, head: -30, legB: { at: [-22, -7], foot: 18 }, F: { at: [3, -63], aim: -128 }, B: { up: 28, lo: -86, hand: 22 } }],
  [140, { root: [-12, 7], pelvis: -8, torso: -14, head: -16, legB: { at: -26 }, F: { at: [4, -60], aim: -120 }, B: { up: 30, lo: -84, hand: 20 }, ease: "inOut" }],
  [196, { root: [-8, 9], pelvis: -4, torso: 12, head: 6, legB: { at: -22 }, F: { at: [8, -52], aim: -101 }, B: { up: 14, lo: -118, hand: 6 }, face: "grit", ease: "inOut" }],
  [248, { root: [-4, 5.4], pelvis: -2, torso: 10, head: -4, legB: { at: [-16, -5], foot: 10 }, F: { at: [11, -52], aim: -88 }, B: { up: 9, lo: -134, hand: 2 }, ease: "inOut" }],
  [300, { ...STANCE, face: "grit", ease: "inOut" }],
], { plant: ["footF"], lag: { torso: 30, "armB.up": 30, "armB.lo": 30, handB: 30 } });

/** The stage's block slide (`OUTCOME.blockSlide` 6 units over `blockSlideMs` 120, eased out), as
 *  the figure-space move of a foot that holds its place on the floor while it plays. */
const SLIDE = 6;
const slid = (t: number): number => { const u = Math.min(1, t / 120); return SLIDE * (1 - (1 - u) * (1 - u)); };
/** The footwork of both blocks: the back foot steps back at once, the front foot holds, then steps. */
const FEET: Contact[] = [
  { foot: "footF", from: 0, to: 130, at: TOE, move: [0, 20, 40, 60, 80, 100, 120, 130].map((t) => [t, slid(t)] as const) },
  { foot: "footF", from: 190, to: 220, at: TOE },
  { foot: "footB", from: 0, to: 12, at: TOE },
  { foot: "footB", from: 80, to: 220, at: TOE, move: [[80, 0], [100, slid(100) - slid(80)], [120, slid(120) - slid(80)]] },
];
/** Leg keys that match the footwork (the front toe carried by the slide until it steps home). */
const BACK = slid(120) - slid(80);
const legs = (t: number, back: LegSpec, front?: LegSpec): Spec => ({ legF: front ?? onToe(TOE_F + slid(t), 4), legB: back });
const B_LIFT: LegSpec = { up: 18, lo: 44, foot: 26 };
const F_LIFT: LegSpec = { up: -30, lo: 40, foot: 8 };
const HOME: Spec = { ...STANCE, legF: onToe(TOE_F, 0), legB: onToe(TOE_B, 0), ease: "inOut" };

export const BLOCK = clip(220, false, [], [
  [0, { ...GUARD_UP }],
  [12, { ...legs(12, onToe(TOE_B, 30)) }],
  [40, { root: [-4.5, 8.5], pelvis: -4, torso: 6, head: 8, F: { up: -80, lo: -100, hand: 28 }, B: { up: -30, lo: -128, hand: -6 },
    ...legs(40, B_LIFT), ease: "out" }],
  [80, { root: [-5, 8], pelvis: -4, torso: 7, head: 7, F: { up: -82, lo: -98, hand: 28 }, B: { up: -28, lo: -130, hand: -4 },
    ...legs(80, onToe(TOE_B - BACK, 24)), ease: "inOut" }],
  [130, { root: [-3.5, 7], pelvis: -2, torso: 10, head: 2, F: { up: -50, lo: -116, hand: 24 }, B: { up: -12, lo: -134, hand: 0 },
    ...legs(130, onToe(TOE_B - BACK, 18)), ease: "inOut" }],
  [160, { root: [-2.5, 5.5], torso: 10, F: { at: [11.5, -56], aim: -112 }, B: { up: 0, lo: -138, hand: 0 }, ...legs(160, onToe(TOE_B - BACK, 14), F_LIFT) }],
  [190, { root: [-1.5, 4], F: STANCE.F!, B: STANCE.B!, ...legs(190, onToe(TOE_B - BACK, 10), onToe(TOE_F, 6)) }],
  [220, HOME],
], { lag: { head: 24, "armB.up": 16, "armB.lo": 16 }, stride: { speed: 0, contacts: FEET } });

export const BLOCK_SHIELD = clip(220, false, [], [
  [0, { ...GUARD_UP, B: { up: -73, lo: -64, hand: 0 }, F: { up: 10, lo: -130, aim: -76 } }],
  [12, { ...legs(12, onToe(TOE_B, 30)) }],
  [40, { root: [-5.5, 9], pelvis: -5, torso: 3, head: 12, B: { up: -64, lo: -68, hand: 0 }, F: { up: 12, lo: -128, aim: -74 },
    ...legs(40, B_LIFT), ease: "out" }],
  [80, { root: [-6, 8.5], pelvis: -5, torso: 4, head: 11, B: { up: -66, lo: -67, hand: 0 }, ...legs(80, onToe(TOE_B - BACK, 26)), ease: "inOut" }],
  [130, { root: [-4, 7], pelvis: -2, torso: 9, head: 6, B: { up: -45, lo: -86, hand: 0 }, F: { up: 8, lo: -130, aim: -80 },
    ...legs(130, onToe(TOE_B - BACK, 18)), ease: "inOut" }],
  [160, { root: [-2.5, 5.5], torso: 10, F: { up: 6, lo: -130, aim: -82 }, B: { up: -18, lo: -112, hand: 0 }, ...legs(160, onToe(TOE_B - BACK, 14), F_LIFT) }],
  [190, { root: [-1.5, 4], F: STANCE.F!, B: STANCE.B!, ...legs(190, onToe(TOE_B - BACK, 10), onToe(TOE_F, 6)) }],
  [220, HOME],
], { lag: { head: 24, "armF.up": 16, "armF.lo": 16 }, stride: { speed: 0, contacts: FEET } });
