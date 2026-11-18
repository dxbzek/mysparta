/**
 * The clock and local days. Energy refills with the clock's time (content v3); the day key
 * ("YYYY-MM-DD", local time) still dates the History groups and draws Tonight's Card. The clock is
 * injected (contract `Clock`) so tests, and the dev entry's `?shift=` switch, can move the time.
 */
import type { DayKey } from "@rankzero/core";
import type { Clock } from "../contracts";

const pad = (n: number): string => String(n).padStart(2, "0");

export function dayKeyOf(ms: number): DayKey {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The device clock, moved by `offsetMs` (0 in the real game). */
export function deviceClock(offsetMs = 0): Clock {
  return { now: () => Date.now() + offsetMs, today: () => dayKeyOf(Date.now() + offsetMs) };
}

/** A clock a test sets by hand. */
export function fixedClock(start: number): Clock & { set(ms: number): void; add(ms: number): void } {
  let t = start;
  return { now: () => t, today: () => dayKeyOf(t), set: (ms) => { t = ms; }, add: (ms) => { t += ms; } };
}

