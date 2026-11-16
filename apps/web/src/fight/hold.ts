/**
 * Holding the bout while the full log sheet is open (review r2: the fight played on under the
 * sheet, so a player reading the log missed hits and could miss the knockout). Opening pauses the
 * clock and remembers whether it was already paused; closing puts that back, so a bout the player
 * had paused stays paused. Pure apart from the clock it is handed.
 */
import type { FightClock } from "@rankzero/stage";

/** Pauses the clock for the sheet; returns whether it was paused before. */
export function holdForSheet(clock: Pick<FightClock, "paused">): boolean {
  const was = clock.paused;
  clock.paused = true;
  return was;
}

/** Puts the clock back as it was when the sheet opened. */
export function releaseSheet(clock: Pick<FightClock, "paused">, wasPaused: boolean): void {
  clock.paused = wasPaused;
}

/** How long the "3x is a VIP perk" note stays under the speed buttons (ms of real time). */
export const SPEED_NOTE_MS = 2200;
