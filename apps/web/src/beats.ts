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

/**
 * An axe's impact sounds this long after contact on an ordinary blow — slow
 * mass arriving. It lived in the theatre as a bare `360`, outside this file,
 * so on a killing blow the chop landed 70ms into the frozen frame, after the
 * thud it is meant to sit under.
 */
export const AXE_IMPACT_LAG_MS = 70;

/** The moment this beat's blow reaches its target. */
export function contactMs(line: Pick<Line, "anim"> | undefined): number {
  return line?.anim?.thrown ? THROWN_CONTACT_MS : MELEE_CONTACT_MS;
}

/**
 * When the weapon's own impact is heard. The axe keeps its late, heavy chop on
 * every blow but the last: the killing blow is heard at contact, with the
 * freeze and the thud, whatever is swinging.
 */
export function impactSoundMs(
  line: Pick<Line, "anim"> | undefined,
  opts: { axe?: boolean; kills?: boolean } = {},
): number {
  const lag = opts.axe && !opts.kills && !line?.anim?.thrown ? AXE_IMPACT_LAG_MS : 0;
  return contactMs(line) + lag;
}

/**
 * How long what a blow DOES is held back from the first frame of its beat.
 *
 * The recoil, burst, number and sound of a thrown beat wait for the javelin;
 * the HP bar and the struck pose did not, so the bar had drained (and on a
 * thrown KO read 0) while the spear was still in the hand. A thrown beat that
 * someone answers holds its consequences until the flight ends. A melee beat
 * keeps the timing it has always had.
 */
export function effectDelayMs(line: Pick<Line, "anim"> | undefined): number {
  return line?.anim?.thrown && line.anim.reaction ? THROWN_CONTACT_MS : 0;
}

/**
 * Which line is the killing blow: its index in `lines`, or -1 when the fight
 * was not a knockout.
 *
 * The theatre used to take "the line before the end". The core goes on
 * talking after the blow that ends it — the thrower draws a fresh weapon, a
 * critical's Hamstring or Staggered rider is announced — so on those fights
 * the freeze, the thud and the lurch all landed on a caption where nobody
 * swung, and the blow itself passed like any other. The kill is the line that
 * takes health off the loser and leaves them with none.
 */
export function killBeat(
  lines: readonly Pick<Line, "fx" | "hp" | "kind">[],
  result: { reason: string; winner: 0 | 1 },
): number {
  if (result.reason !== "ko") return -1;
  const loser = result.winner === 0 ? 1 : 0;
  // The first beat their health reads zero on — nothing brings it back.
  const i = lines.findIndex((l) => l.hp?.[loser] === 0);
  const fx = lines[i]?.fx;
  if (fx && !fx.heal && fx.target === loser) return i;
  // A knockout nothing on the stage accounts for: fall back to the last beat
  // before the verdict rather than ending the fight with no weight at all.
  const end = lines.findIndex((l) => l.kind === "end");
  return end > 0 ? end - 1 : -1;
}

/** How long a beat holds the stage at 1× — the killing one adds the freeze. */
export function beatHoldMs(line: Pick<Line, "hold"> | undefined, kills = false): number {
  return (line?.hold ?? 600) + (kills ? HITSTOP_MS : 0);
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
  const hold = Math.round(beatHoldMs(line, true) / speed);
  return { freezeAt, releaseAt, hold };
}
