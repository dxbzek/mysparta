/**
 * Snared (content clip, a 700 ms loop): stuck and struggling. Both hands up at the face (under a
 * tarp, in a Grapple hold, rubbing sand out of the eyes), the head ducking and shaking, the chest
 * twisting against what holds it. The front wrist twists only a little: with a two-hand item the
 * back hand rides its shaft, and a wide twist swung the back forearm faster than a real one; the
 * item is tipped well back, so a tyre's or a chair's far handle never sweeps past the back shoulder.
 * It keys the stow channel (`STOW`): the held item is put away while the hands are at the face.
 */
import { clip, BOTH_FEET } from "../../gate/clips/kit";
import type { Spec } from "../../gate/clips/kit";

const A: Spec = { stow: true, root: [-1.5, 6], pelvis: -2, torso: 18, head: 14, held: 0, legF: { at: 10 }, legB: { at: -12 },
  F: { at: [9, -66], hand: -65 }, B: { at: [7, -69], hand: -40 }, face: "dazed" };

export const SNARED = clip(700, true, [], [
  [0, A],
  [180, { root: [0, 5], torso: 8, head: -8, F: { at: [11, -70], hand: -57 }, B: { at: [4, -72], hand: -60 }, face: "grit", ease: "inOut" }],
  [350, { root: [-2.5, 6.5], torso: 22, head: 18, F: { at: [8, -64], hand: -67 }, B: { at: [8, -66], hand: -30 }, face: "dazed", ease: "inOut" }],
  [530, { root: [-0.5, 5], torso: 10, head: -4, F: { at: [12, -68], hand: -59 }, B: { at: [5, -71], hand: -50 }, face: "grit", ease: "inOut" }],
  [700, { ...A, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 60, "armB.up": 40, "armB.lo": 40 } });
