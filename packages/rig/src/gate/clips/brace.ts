/** Brace: the target sees the dash coming and shells up (Muybridge, plate 336 frames 8 and 9, the
 *  boxer covering against a lead). The knees drop, the back heel comes up and the back foot
 *  pushes into the floor, the chin tucks behind the shoulder and both forearms come up in front
 *  of the face, the weapon fist high in the line of the blow. Held at its end until the next clip
 *  (a block starts from this pose). Both toes stay put. */
import { clip, onToe, STANCE, TOE } from "./kit";
import { TOE_B, TOE_F } from "./idle";

export const GUARD_UP = {
  root: [-3, 8] as const, pelvis: -2, torso: 13, head: 10,
  legF: onToe(TOE_F, 4), legB: onToe(TOE_B, 22),
  F: { up: -90, lo: -94, hand: 26 }, B: { up: -2, lo: -138, hand: 0 },
  face: "grit" as const,
};
export const BRACE = clip(120, false, [], [
  [0, { ...STANCE, legF: onToe(TOE_F, 0), legB: onToe(TOE_B, 0) }],
  [120, { ...GUARD_UP }],
], {
  lag: { head: 30, "armB.up": 20, "armB.lo": 20 },
  stride: { speed: 0, contacts: [{ foot: "footF", from: 0, to: 120, at: TOE }, { foot: "footB", from: 0, to: 120, at: TOE }] },
});
