/**
 * Power-up (content clip): the special-move wind-up, in three parts the stage plays apart (the
 * pose crossfade carries him from one part to another). Its three `step` events mark where the
 * charge starts, where it ends and where the blow starts, so the stage reads the parts from
 * `clipInfo` and holds no clip time of its own:
 *   0-280     breath: a deep breath in, he straightens, the chest fills, the chin comes up, the
 *             arms drop loose (Second Wind holds here, and every Move starts with it);
 *   280-800   charge: he coils into a wide crouch, the front fist cocked high behind the head (the
 *             elbow up in front, as a real arm cocks: it never swings round behind the back) and
 *             the back hand out in front as a guard, a shout, a small tremble (the Haymaker);
 *   1100-1400 blow: he leans in with the back hand up at the face, the whistle or the air horn in it
 *             pointed at the enemy, and the chest pushing the air out (800-1100 only carries him from
 *             the charge to the blow; the stage never plays it).
 */
import { clip, BOTH_FEET, STANCE } from "../../gate/clips/kit";
import type { Spec } from "../../gate/clips/kit";

const BREATH: Spec = { root: [-1, 0.6], pelvis: 0, torso: -3, head: -16, F: { at: [9, -47], hand: 10 }, B: { at: [-3, -47], hand: 0 },
  face: "neutral", scale: [1.01, 1.02] };
const CHARGE: Spec = { root: [-4, 6.5], pelvis: -4, torso: 2, head: -2, legF: { at: 14 }, legB: { at: -15 },
  F: { up: -138, lo: -112, hand: 26 }, B: { at: [15, -60], hand: -6 }, face: "shout", scale: [1, 1] };
const BLOW: Spec = { root: [1, 3.6], pelvis: 2, torso: 14, head: -2, legF: { at: 12 }, legB: { at: -13 },
  F: { at: [10, -46], hand: 10 }, B: { at: [8.5, -71], hand: -68 }, face: "shout", scale: [1.01, 1] };

export const POWER_UP = clip(1400, false, [{ t: 280, name: "step" }, { t: 800, name: "step" }, { t: 1100, name: "step" }], [
  [0, STANCE],
  [280, { ...BREATH, ease: "inOut" }],
  [520, { ...CHARGE, ease: "linear" }],
  [660, { ...CHARGE, root: [-4.4, 7], F: { up: -141, lo: -114, hand: 28 } }],
  [800, { ...CHARGE, ease: "inOut" }],
  [950, { root: [-1.5, 5], pelvis: -1, torso: 8, head: -2, legF: { at: 13 }, legB: { at: -14 },
    B: { at: [13, -64], hand: -64 }, face: "grit", scale: [1.01, 1], ease: "linear" }],
  // (the cocked fist then comes down in front of the body to the blow: never on over the top)
  [1100, { ...BLOW, ease: "linear" }],
  [1250, { ...BLOW, root: [2, 3.8], torso: 17, scale: [1, 0.98] }],
  [1400, { ...BLOW, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 40, "armB.up": 30, "armB.lo": 30 } });
