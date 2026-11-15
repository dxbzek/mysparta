/**
 * Backpedal: backing away in guard, the legs stepping one behind the other, short quick steps.
 * Reference: Muybridge, "Animal Locomotion" (1887, public domain), the walking man of plate 8 (side
 * view) read backwards (a backward walk is close to a forward walk run in reverse: the toe lands first, the
 * heel comes down, the foot rolls back onto the heel and the toe leaves last) and the boxer giving
 * ground in plate 338 frames 1 to 4 (guard up, knees soft, trunk upright, the weight carried over
 * the front foot while the back foot reaches).
 *
 * Each foot is on the floor 132 of the 240 ms, so there is a moment on both feet at each step,
 * and while down it is carried forward in figure space at the stage's back speed
 * (`BACK_SPEED`, `BEAT.dashBackSpeed` 250 units a second): first on its toe, then (foot flat)
 * on its heel. 33 units of foot travel a step. The hips drop a little as each foot takes the
 * weight; the guard stays at the chin and the free fist counters the legs a little.
 */
import { clip, cyc, HEEL, onToe, TOE } from "./kit";
import type { LegSpec, Spec } from "./kit";

/** Units per ms, against the facing: the stage's `BEAT.dashBackSpeed` (250 units a second). */
export const BACK_SPEED = 0.25;
const D = 240;
const TD = { B: 48, F: 168 } as const;
const TOE_MS = 40;
const GROUND = 132;
/** Where the toe lands behind the hip joint. */
const LAND = -9;

function leg(tau: number): LegSpec {
  const u = ((tau % D) + D) % D;
  if (u <= TOE_MS) {
    const foot = 20 * (1 - u / TOE_MS);
    return onToe(LAND + BACK_SPEED * u, foot);
  }
  if (u <= GROUND) {
    // on the heel: the heel's spot is the toe's at the flat foot, less the length of the sole
    const heelX = LAND + BACK_SPEED * u - (TOE[0] - HEEL[0]);
    const foot = cyc(D, [[TOE_MS, 0], [100, -4], [GROUND, -16]], u);
    const r = (foot * Math.PI) / 180;
    const dx = Math.cos(r) * HEEL[0] - Math.sin(r) * HEEL[1];
    const dy = Math.sin(r) * HEEL[0] + Math.cos(r) * HEEL[1];
    return { at: [heelX - dx, -dy], foot };
  }
  const up = cyc(D, [[GROUND, -18], [160, -2], [200, 18], [240, 14]], u);
  const lo = cyc(D, [[GROUND, 30], [160, 52], [200, 44], [240, 26]], u);
  const foot = cyc(D, [[GROUND, -16], [160, 6], [200, 22], [240, 20]], u);
  return { up, lo, foot };
}
function at(t: number): Spec {
  const sway = cyc(D, [[48, 1], [108, 0], [168, -1], [228, 0]], t);   // +1: the weight going onto the back foot
  return {
    root: [0, cyc(D, [[0, 4.2], [48, 3.8], [90, 5.0], [168, 3.8], [210, 5.0]], t)],
    pelvis: 2 * sway,
    torso: 6 - 2 * sway,
    head: -4 + sway,
    held: 0,
    legF: leg(t - TD.F),
    legB: leg(t - TD.B),
    F: { at: [13 - sway, -55 + 0.6 * sway], aim: -86 },
    B: { up: 7 + 6 * sway, lo: -140 + 4 * sway, hand: 0 },
    face: "neutral",
  };
}
const TIMES = [0, 24, 48, 60, 68, 88, 108, 132, 156, 168, 180, 188, 208, 228, 240];

export const BACKPEDAL = clip(D, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }],
  TIMES.map((t) => [t, at(t)] as const),
  {
    lag: { head: 30, "armB.up": 30, "armB.lo": 30 },
    stride: {
      speed: -BACK_SPEED,
      contacts: [
        { foot: "footB", from: TD.B, to: TD.B + TOE_MS, at: TOE },
        { foot: "footB", from: TD.B + TOE_MS, to: TD.B + GROUND, at: HEEL },
        { foot: "footF", from: TD.F, to: (TD.F + TOE_MS) % D, at: TOE },
        { foot: "footF", from: (TD.F + TOE_MS) % D, to: (TD.F + GROUND) % D, at: HEEL },
      ],
    },
  });
