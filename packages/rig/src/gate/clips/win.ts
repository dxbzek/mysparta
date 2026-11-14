/** Win: the weapon raised high, chin up, the free fist pumping; an 800 ms loop. */
import { clip, BOTH_FEET } from "./kit";

const A = { root: [-1, 2] as const, pelvis: 0, torso: -6, head: -14, held: 0, legF: { at: 11 }, legB: { at: -12 },
  F: { at: [9, -80] as const, aim: -148 }, B: { at: [-1, -52] as const, hand: 20 }, face: "grin" as const };
export const WIN = clip(800, true, [], [
  [0, A],
  [400, { root: [-1, 4], torso: -2, head: -8, F: { at: [11, -84], aim: -138 }, B: { at: [7, -66], hand: -30 }, face: "shout", ease: "inOut" }],
  [800, { ...A, ease: "inOut" }],
], { plant: BOTH_FEET, lag: { head: 70, "armB.up": 90, "armB.lo": 90, handB: 90 } });
