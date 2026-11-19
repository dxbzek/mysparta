/**
 * Energy (work package 1; content v3, plan 13.9, in place of the daily bout cap). A bar of
 * ENERGY_MAX points; a bout costs ENERGY_COST; one point comes back every ENERGY_REFILL_MS (a full
 * bar in 2 hours). A new scrapper starts full. No paid refills. The time is the app's injected
 * Clock, passed in as ms; the core never reads a clock.
 *
 * A record holds `energy`, the points at time `energyAt`. Points come back at energyAt + k x
 * ENERGY_REFILL_MS. A clock that reads earlier than `energyAt` (moved back) refills nothing, and
 * `energyAt` never moves back, so moving the clock back and forth again cannot make points.
 */
import type { ScrapperRecord, TimeMs } from "../contracts/fighter";

export const ENERGY_MAX = 6;
export const ENERGY_COST = 1;
export const ENERGY_REFILL_MS = 20 * 60 * 1000;

const whole = (n: number): number => (Number.isFinite(n) ? Math.floor(n) : 0);
const clampEnergy = (n: number): number => (n < 0 ? 0 : n > ENERGY_MAX ? ENERGY_MAX : n);

/** Points refilled since `energyAt`, and the time the last of them came back. */
function refill(rec: ScrapperRecord, nowMs: TimeMs): { energy: number; at: TimeMs } {
  const stored = clampEnergy(whole(rec.energy));
  const at = whole(rec.energyAt);
  const now = whole(nowMs);
  if (stored >= ENERGY_MAX || now <= at) return { energy: stored, at };
  const steps = Math.floor((now - at) / ENERGY_REFILL_MS);
  const energy = clampEnergy(stored + steps);
  return { energy, at: at + steps * ENERGY_REFILL_MS };
}

export function energyNow(rec: ScrapperRecord, nowMs: TimeMs): number {
  return refill(rec, nowMs).energy;
}

/** Milliseconds until the next point, or null when the bar is full. Never 0 or less. */
export function energyNextMs(rec: ScrapperRecord, nowMs: TimeMs): number | null {
  const r = refill(rec, nowMs);
  if (r.energy >= ENERGY_MAX) return null;
  const now = whole(nowMs);
  // A clock behind `energyAt` waits for it, then a whole refill.
  if (now < r.at) return r.at - now + ENERGY_REFILL_MS;
  const left = r.at + ENERGY_REFILL_MS - now;
  return left > 0 ? left : ENERGY_REFILL_MS;
}

/** Spends ENERGY_COST, counts one bout and adds its XP. From a full bar the refill timer starts
 *  now (never earlier than the stored `energyAt`); otherwise the time already earned towards the
 *  next point is kept. With no energy the bar stays at 0 (the app refuses the bout before this). */
export function afterBout(rec: ScrapperRecord, xp: 1 | 2, nowMs: TimeMs): ScrapperRecord {
  const r = refill(rec, nowMs);
  const now = whole(nowMs);
  const at = r.energy >= ENERGY_MAX ? Math.max(r.at, now) : r.at;
  return {
    ...rec,
    energy: clampEnergy(r.energy - ENERGY_COST),
    energyAt: at,
    lifetimeBouts: rec.lifetimeBouts + 1,
    xp: rec.xp + xp,
  };
}
