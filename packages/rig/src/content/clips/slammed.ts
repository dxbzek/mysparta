/**
 * Slammed (content clip, the target of a Body Slam): grabbed, it is hauled off its feet and tips
 * over backwards in the air, arms and legs flailing, lands flat on its back (land, the contact),
 * bounces once, then sits up and gets back on its feet. 1160 ms, land at 500.
 * No planted feet: a key with root y below 0 lifts the whole body that high.
 */
import { clip, STANCE } from "../../gate/clips/kit";

export const SLAMMED = clip(1160, false, [{ t: 500, name: "land" }], [
  [0, { ...STANCE, face: "dazed" }],
  [140, { root: [-1, 2], torso: -8, head: -16, F: { at: [12, -72], hand: -30 }, B: { at: [5, -74], hand: -20 }, face: "dazed", ease: "out" }],
  [310, { root: [0, -26], spin: -30, torso: -10, head: -24, legF: { up: -40, lo: 70, foot: 20 }, legB: { up: 10, lo: 40, foot: 10 },
    F: { up: -150, lo: -30, hand: 20 }, B: { up: -120, lo: -40, hand: 10 }, ease: "out" }],
  [420, { root: [0, -16], spin: -70, torso: -8, head: -26, legF: { up: -70, lo: 60, foot: 20 }, legB: { up: -40, lo: 50, foot: 15 },
    F: { up: -160, lo: -30, hand: 25 }, B: { up: -130, lo: -40, hand: 15 }, ease: "in" }],
  [500, { root: [0, 0], spin: -90, torso: -6, head: -22, legF: { up: -62, lo: 72, foot: 20 }, legB: { up: -32, lo: 54, foot: 15 },
    F: { up: -150, lo: -42, hand: 30 }, B: { up: -122, lo: -42, hand: 15 }, scale: [1.08, 0.92], ease: "in" }],
  [580, { root: [0, -3], spin: -86, torso: -2, head: -10, scale: [1, 1], ease: "out" }],
  [680, { root: [0, 0], spin: -90, torso: -4, head: -12, ease: "inOut" }],
  [790, { root: [-1, 0], spin: -82, torso: 8, head: -2, F: { up: -110, lo: -48, hand: 22 }, B: { up: -90, lo: -46, hand: 12 }, ease: "linear" }],
  [900, { root: [-2, 0], spin: -45, torso: 40, head: 10, legF: { up: -90, lo: 120, foot: 30 }, legB: { up: -70, lo: 130, foot: 30 },
    F: { up: -50, lo: -60, hand: 14 }, B: { up: -26, lo: -54, hand: 10 }, face: "grit", ease: "linear" }],
  [1010, { root: [-2, 12], spin: 0, pelvis: -2, torso: 30, head: 0, legF: { at: 10 }, legB: { at: -12 },
    F: { up: -10, lo: -100, hand: 14 }, B: { up: 10, lo: -120, hand: 0 }, ease: "linear" }],
  [1160, { ...STANCE, spin: 0, face: "grit", ease: "inOut" }],
], { lag: { head: 40, "armB.up": 50, "armB.lo": 50, handB: 50, "armF.lo": 30, handF: 30 } });
