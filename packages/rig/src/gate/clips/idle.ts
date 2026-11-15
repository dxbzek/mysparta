/**
 * Idle: the fighting stance, alive (movement pass; Muybridge, "Animal Locomotion" plates 336 and
 * 338, the boxers between blows, 1887, public domain). The weight is on the balls of the feet,
 * the back heel up and the front heel just off the floor; the knees stay soft and the fighter
 * bounces on them, three small bounces a loop: the hips sink 1.2 units and the heels come down
 * a little, then he rises onto the toes. Both toes stay where they stand (`Stride` with no
 * travel), so each foot rolls on its toe. Over the whole loop he breathes: the chest lifts and
 * settles and the weight drifts onto the front foot and back. The guard fist is up by the chin,
 * the free fist by the cheek; both ride the bounce a beat late.
 */
import { clip, onToe, TOE } from "./kit";
import type { Spec } from "./kit";

const D = 1200;
/** Where the toes stand (the stance's ankles, flat feet, plus the sole; the front one half a unit
 *  back so a tall build's toe stays inside the stage's reach table, `SCRAPPER_REACH` front 26). */
export const TOE_F = 10.5 + TOE[0];
export const TOE_B = -12 + TOE[0];
function at(t: number): Spec {
  const b = (1 - Math.cos((2 * Math.PI * t) / 400)) / 2;          // 0 down in the knees, 1 up on the toes
  const br = Math.sin((2 * Math.PI * t) / D);                       // breath: + in
  const w = Math.sin((2 * Math.PI * (t - 150)) / D);                // weight: + onto the front foot
  return {
    root: [-1 + 0.7 * w, 4.4 - 1.2 * b],
    pelvis: 0.8 * w,
    torso: 9 + 1.2 * br + 1.0 * w,
    head: -6 - 1.0 * br - 0.6 * w,
    held: 0,
    legF: onToe(TOE_F, 3 + 4 * b),
    legB: onToe(TOE_B, 10 + 7 * b),
    F: { at: [11.6 + 0.5 * w, -55.5 + 0.8 * br - 0.6 * b], aim: -86 + 2 * br },
    B: { up: 6 + 1.5 * br, lo: -142 + 2 * b, hand: 0 },
    face: "neutral",
  };
}
const TIMES = Array.from({ length: 25 }, (_, i) => i * 50);
export const IDLE = clip(D, true, [], TIMES.map((t) => [t, at(t)] as const), {
  lag: { head: 60, "armB.up": 60, "armB.lo": 60, handB: 60, handF: 40, "armF.lo": 30 },
  stride: { speed: 0, contacts: [{ foot: "footF", from: 0, to: D, at: TOE }, { foot: "footB", from: 0, to: D, at: TOE }] },
});
