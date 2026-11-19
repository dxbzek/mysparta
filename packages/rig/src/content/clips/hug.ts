/**
 * The Grapple's bear hug (review round 2, 16 Nov 2026: the Grapple held the Body Slam's grab pose
 * while its target stood flat with its hands at its face, and the two read as people standing
 * back to back). Two loops the stage asks for by name (the content pack's `variants`):
 *
 *   hug     the one who squeezes: stepped in close, upright, the head back and to the side, both
 *           arms wrapped round the other's ribs with the hands locked behind its back, heaving in
 *           and up on every squeeze (a 360 ms loop).
 *   hugged  the one in the hold: lifted off its feet (the stage lifts it; no planted feet here),
 *           bent back over the arms, head thrown back, both arms flung up and out, the legs
 *           kicking under it (a 360 ms loop).
 */
import { clip, BOTH_FEET } from "../../gate/clips/kit";
import type { Spec } from "../../gate/clips/kit";

const HUG_A: Spec = { root: [5, 5.5], pelvis: 2, torso: 13, head: -20, held: 0, legF: { at: 16 }, legB: { at: -12 },
  F: { at: [29, -47], hand: 24 }, B: { at: [27, -43], hand: 30 }, face: "grit" };
export const HUG = clip(360, true, [], [
  [0, HUG_A],
  [180, { root: [5.6, 4.4], torso: 9, head: -24, F: { at: [27.5, -49.5], hand: 26 }, B: { at: [25.5, -45.5], hand: 32 }, face: "shout", ease: "inOut" }],
  [360, { ...HUG_A, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 30 } });

const HUGGED_A: Spec = { root: [-1.5, 0], pelvis: -3, torso: -13, head: -22, held: 0,
  legF: { up: -34, lo: 52, foot: 22 }, legB: { up: 16, lo: 30, foot: 12 },
  F: { dir: -62, reach: 0.9, hand: -20 }, B: { dir: -118, reach: 0.86, hand: -30 }, face: "shout" };
export const HUGGED = clip(360, true, [], [
  [0, HUGGED_A],
  [180, { root: [-1, 0.6], torso: -9, head: -16, legF: { up: 8, lo: 30, foot: 12 }, legB: { up: -24, lo: 54, foot: 22 },
    F: { dir: -78, reach: 0.95, hand: -28 }, B: { dir: -104, reach: 0.92, hand: -22 }, face: "dazed", ease: "inOut" }],
  [360, { ...HUGGED_A, ease: "inOut" }],
], { lag: { head: 40 } });

export const HUGS = { hug: HUG, hugged: HUGGED } as const;
