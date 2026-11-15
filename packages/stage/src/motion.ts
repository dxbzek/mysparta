/**
 * The reduced-motion table (brief 3.15). With reduced motion: no camera shake, no white flash,
 * no slow motion, no ticket tape, no crowd bounce, hit-stop capped at 60 ms, a pet's knockback halved.
 * A scrapper's knockback is not halved (review finding 17, 15 Nov 2026; NEEDS THE OWNER'S SIGN-OFF,
 * it departs from brief 3.15): it is now his own footwork, a fixed step of 6 units for a light hit
 * and 10 for a heavy one (tuning CONTACT.knockStep, times his drawn size) that the flinch clips
 * draw with the feet, as a block's step is. Halving the move under the clip's fixed step would
 * slide both planted feet again, so reduced motion keeps it whole, like the block's step. It no
 * longer grows with the damage either (the old push ran from 4 to 20 units with damage / max HP).
 * Calm camera (owner, 15 Nov 2026, "I'm getting dizzy"): the white body flash is gone in full
 * motion too; the shake and the crowd bounce are kept for crits and the knockout only (effects.ts).
 * Scrappers still move and the bout still reads. The timeline reads this table and nothing else
 * to decide what reduced motion takes away.
 */
import { HIT_STOP } from "./tuning";

export interface MotionRules {
  shake: boolean;
  flash: boolean;
  slowMotion: boolean;
  tape: boolean;
  crowd: boolean;
  /** The longest hit-stop allowed. */
  hitStopCap: number;
  /** A pet's knockback push is multiplied by this (a scrapper's footwork step is not; see above). */
  knockback: number;
}

export const FULL_MOTION: Readonly<MotionRules> = {
  shake: true, flash: false, slowMotion: true, tape: true, crowd: true,
  hitStopCap: HIT_STOP.knockout, knockback: 1,
};

export const REDUCED_MOTION: Readonly<MotionRules> = {
  shake: false, flash: false, slowMotion: false, tape: false, crowd: false,
  hitStopCap: 60, knockback: 0.5,
};

export function motionRules(reduced: boolean): Readonly<MotionRules> {
  return reduced ? REDUCED_MOTION : FULL_MOTION;
}
