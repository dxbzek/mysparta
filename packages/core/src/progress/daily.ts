/**
 * Bouts per day (work package 1). 6 a day, 8 on the creation day. The day key is passed in; the
 * core never reads a clock. A stored day older than today means a full day; a clock that moved
 * back resets nothing.
 */
import type { DayKey, ScrapperRecord } from "../contracts/fighter";

export const BOUTS_PER_DAY = 6;
export const BOUTS_ON_CREATION_DAY = 8;

function capOf(rec: ScrapperRecord, day: DayKey): number {
  return day === rec.createdDay ? BOUTS_ON_CREATION_DAY : BOUTS_PER_DAY;
}

/** True when `today` is a later day than the stored one. Day keys are "YYYY-MM-DD". */
export function isNewDay(rec: ScrapperRecord, today: DayKey): boolean {
  return rec.day < today;
}

/** Bouts used on the current day as the game reads it. */
export function boutsUsedToday(rec: ScrapperRecord, today: DayKey): number {
  return isNewDay(rec, today) ? 0 : rec.boutsUsed;
}

export function boutsLeft(rec: ScrapperRecord, today: DayKey): number {
  const day = isNewDay(rec, today) ? today : rec.day;
  const left = capOf(rec, day) - boutsUsedToday(rec, today);
  return left < 0 ? 0 : left;
}

/** Counts one bout and adds its XP. Rolls the day over first when today is later. */
export function afterBout(rec: ScrapperRecord, xp: 1 | 2, today: DayKey): ScrapperRecord {
  const fresh = isNewDay(rec, today);
  return {
    ...rec,
    day: fresh ? today : rec.day,
    boutsUsed: (fresh ? 0 : rec.boutsUsed) + 1,
    lifetimeBouts: rec.lifetimeBouts + 1,
    xp: rec.xp + xp,
  };
}
