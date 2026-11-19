/**
 * Dash: a sprint, rotoscoped from Muybridge, "Animal Locomotion" plate 62, "running at full speed"
 * (1887, public domain; side view, 12 frames). Read off the plate, per step:
 *   touchdown (frames 2, 8)  the foot lands on its forefoot a little ahead of the hips, the knee
 *                            nearly straight; the other heel is high behind;
 *   mid-stance (3-4, 9-10)   the knee gives, the hips are at their lowest and the foot is under
 *                            them; the swing heel comes up to the seat;
 *   toe-off (5, 11)          the stance leg long behind, the heel up, pushing off the toe; the
 *                            other knee driven forward to hip height;
 *   flight (6-7, 12-1)       both feet off the floor, legs split, the front shin reaching.
 * The arms swing against the legs with the elbows bent: the hand of the forward arm comes up to
 * the chin, the other elbow goes up behind. The trunk leans forward a little more than on the
 * plate (a fighter driving in, not a man at top speed) and the head stays level.
 *
 * Timing: the contract's 240 ms loop, two steps, each 72 ms on the ground and 48 in the air (the
 * plate: about 3 of every 5 frames of a step on the ground). On the ground each foot stands on
 * its toe and is carried back at the stage's dash speed (`RUN_SPEED`, the stage's
 * `BEAT.dashSpeed` 560 units a second), so the foot does not slide (`Stride` in engine/sample.ts):
 * 40 units of toe travel a step, a stride of 134 units a cycle.
 *
 * Start and finish: at t = 0 the back foot is pushing off the floor behind with the front knee
 * coming through (the push off the back foot out of the brace). The weapon arm swings less than
 * the free arm and keeps the item up by the shoulder.
 */
import { clip, cyc, onToe, TOE } from "./kit";
import type { LegSpec, Spec } from "./kit";

/** Units per ms: the stage's dash speed (`BEAT.dashSpeed`, 560 units a second). */
export const RUN_SPEED = 0.56;
const D = 240;
/** Each foot touches down at these times and stays down 72 ms. */
export const TD = { F: 60, B: 180 } as const;
export const GROUND = 72;
/** Where the toe lands, ahead of the hip joint (units). */
export const LAND = 24;
/** The foot's world angle on the ground: forefoot landing, heel rising to the push. */
const FOOT_DOWN: readonly (readonly [number, number])[] = [[0, 12], [36, 24], [60, 44], [72, 54]];

/** One leg at `tau` ms after its own touchdown. */
function leg(tau: number): LegSpec {
  const u = ((tau % D) + D) % D;
  if (u <= GROUND) {
    let foot = FOOT_DOWN[0]![1];
    for (let i = 1; i < FOOT_DOWN.length; i++) {
      const [ta, fa] = FOOT_DOWN[i - 1]!;
      const [tb, fb] = FOOT_DOWN[i]!;
      if (u >= ta && u <= tb) foot = fa + (fb - fa) * ((u - ta) / (tb - ta));
    }
    return onToe(LAND - RUN_SPEED * u, foot);
  }
  // in the air: thigh (from the pelvis), knee and the foot's world angle, read off the plate
  const up = cyc(D, [[72, 26], [96, 16], [120, -6], [156, -46], [180, -70], [196, -68], [218, -50], [240, -36]], u);
  const lo = cyc(D, [[72, 22], [96, 96], [120, 124], [156, 118], [180, 92], [196, 72], [218, 42], [240, 28]], u);
  const foot = cyc(D, [[72, 54], [96, 40], [120, 30], [156, 20], [180, 12], [196, 8], [218, 8], [240, 12]], u);
  return { up, lo, foot };
}
/** The key at clip time `t` (the brake and the push-off start and end on these poses). */
export function runAt(t: number): Spec {
  const tF = t - TD.F;
  const tB = t - TD.B;
  // the free arm (B) forward when the near leg (F) is back; the weapon arm (F) swings less
  // (world angle of the upper arm: + behind; the trunk's lean is taken off below)
  const lean = cyc(D, [[0, 20], [36, 19], [96, 22], [156, 19], [216, 22]], t);
  const swing = cyc(D, [[12, 1], [72, 0], [132, -1], [192, 0]], t);   // +1: F arm back, B arm forward
  const fUp = -22 + 16 * swing;
  const bUp = -10 - 55 * swing;
  const fLo = -104 + 4 * swing;
  const bLo = -96 - 14 * swing;
  return {
    root: [0, cyc(D, [[0, 4], [12, 3], [36, 1.6], [60, 3.4], [96, 5.4], [132, 3], [156, 1.6], [180, 3.4], [216, 5.4]], t)],
    pelvis: -3 * swing,
    torso: lean,
    head: -lean + 8,
    held: 0,
    legF: leg(tF),
    legB: leg(tB),
    F: { up: fUp - lean, lo: fLo, hand: 28 - 8 * swing },
    B: { up: bUp - lean, lo: bLo, hand: -6 * swing },
    face: "grit",
  };
}
const TIMES = [0, 12, 24, 36, 48, 60, 78, 96, 114, 132, 144, 156, 168, 180, 198, 216, 228, 240];

export const DASH = clip(D, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }],
  TIMES.map((t) => [t, runAt(t)] as const),
  {
    lag: { head: 20 },
    stride: {
      speed: RUN_SPEED,
      contacts: [
        { foot: "footF", from: TD.F, to: TD.F + GROUND, at: TOE },
        { foot: "footB", from: TD.B, to: (TD.B + GROUND) % D, at: TOE },
      ],
    },
  });
