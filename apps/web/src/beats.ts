/**
 * When a blow lands, in one place.
 *
 * The stage has three clocks that must agree on the moment of contact: the CSS
 * choreography (reactions, bursts, damage numbers), the SFX delays, and the
 * hit-stop on the killing blow. They used to each carry their own literal, and
 * thrown beats were the casualty: the target recoiled on the melee clock
 * (~280ms) while the javelin was still in the air until 530ms — the effect a
 * quarter of a second before its cause.
 *
 * All times are milliseconds at 1× speed; the theatre divides by its speed and
 * the stylesheet multiplies by `--spd`.
 */

import type { Line } from "./narrate.js";

/** A melee swing reaches the foe ~42% into its lunge. */
export const MELEE_CONTACT_MS = 290;
/** The arm is coming forward: the javelin leaves the hand. */
export const MISSILE_LAUNCH_MS = 210;
/** Time in the air, hand to target. */
export const MISSILE_FLIGHT_MS = 260;
/** A thrown weapon lands when its flight ends — never before. */
export const THROWN_CONTACT_MS = MISSILE_LAUNCH_MS + MISSILE_FLIGHT_MS;
/**
 * A thrown beat holds the stage this much longer than a melee one, so the
 * reaction that now starts later still has the same room to play out.
 */
export const THROWN_HOLD_EXTRA_MS = THROWN_CONTACT_MS - MELEE_CONTACT_MS;

/** How long the stage freezes on the blow that ends the fight. */
export const HITSTOP_MS = 420;

/** The moment this beat's blow reaches its target. */
export function contactMs(line: Pick<Line, "anim"> | undefined): number {
  return line?.anim?.thrown ? THROWN_CONTACT_MS : MELEE_CONTACT_MS;
}

/**
 * The killing blow's timetable: the beat plays normally up to contact, the
 * stage freezes there, then lets go so the reaction can finish before the
 * verdict. Freezing from the first frame of the beat — as the first version
 * did — stopped the swing before it was thrown.
 */
export function koSchedule(
  line: Pick<Line, "anim" | "hold"> | undefined,
  speed: 1 | 2,
): { freezeAt: number; releaseAt: number; hold: number } {
  const freezeAt = Math.round(contactMs(line) / speed);
  const releaseAt = freezeAt + Math.round(HITSTOP_MS / speed);
  const hold = Math.round(((line?.hold ?? 600) + HITSTOP_MS) / speed);
  return { freezeAt, releaseAt, hold };
}
