/**
 * Local days. The bout cap resets at local midnight on the device, and the day key is
 * "YYYY-MM-DD" in local time. The clock is injected (contract `Clock`) so tests, and the dev
 * entry's `?shift=` switch, can move the day.
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

/** Milliseconds from `ms` to the next local midnight. */
export function msToMidnight(ms: number): number {
  const d = new Date(ms);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next.getTime() - ms);
}

/** "5 h 12 min", "12 min", "1 min". Rounded up, so it never says 0 while bouts are still locked. */
export function countdown(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
