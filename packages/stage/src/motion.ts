/**
 * The reduced-motion table (brief 3.15). With reduced motion: no camera shake, no white flash,
 * no slow motion, no ticket tape, no crowd bounce, hit-stop capped at 60 ms, knockback halved.
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
  /** Knockback distance is multiplied by this. */
  knockback: number;
}

export const FULL_MOTION: Readonly<MotionRules> = {
  shake: true, flash: true, slowMotion: true, tape: true, crowd: true,
  hitStopCap: HIT_STOP.knockout, knockback: 1,
};

export const REDUCED_MOTION: Readonly<MotionRules> = {
  shake: false, flash: false, slowMotion: false, tape: false, crowd: false,
  hitStopCap: 60, knockback: 0.5,
};

export function motionRules(reduced: boolean): Readonly<MotionRules> {
  return reduced ? REDUCED_MOTION : FULL_MOTION;
}
