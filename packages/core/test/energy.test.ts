/**
 * Energy (content v3, plan 13.9): in place of the daily bout cap. Max 6, a bout costs 1, one point
 * every 20 minutes, a full bar in 2 hours, a new scrapper starts full, and a clock that moves back
 * refills nothing. Every test moves the time by hand: the core never reads a clock.
 */
import { describe, expect, it } from "vitest";
import type { ScrapperRecord } from "../src/contracts/fighter";
import { REALM_SALT } from "../src/contracts/ids";
import { api } from "../src/api";
import { ENERGY_COST, ENERGY_MAX, ENERGY_REFILL_MS, afterBout, energyNextMs, energyNow } from "../src/progress/energy";

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 18, 9, 0, 0);
const fresh = (now = T0): ScrapperRecord =>
  api.createRecord({ id: "e1", name: "Volt Pike", realmSalt: REALM_SALT, lookSalt: 0, colourSalt: 0, today: "2026-11-18", nowMs: now });
/** Spends `n` bouts at time `t`. */
const spend = (r: ScrapperRecord, n: number, t: number): ScrapperRecord => {
  for (let i = 0; i < n; i++) r = afterBout(r, 1, t);
  return r;
};

describe("energy", () => {
  it("is 6 points, a bout costs 1, one comes back every 20 minutes", () => {
    expect([ENERGY_MAX, ENERGY_COST, ENERGY_REFILL_MS]).toEqual([6, 1, 20 * MIN]);
    expect(ENERGY_MAX * ENERGY_REFILL_MS).toBe(2 * 60 * MIN);
  });

  it("starts full on a new scrapper, with nothing to count down", () => {
    const r = fresh();
    expect([r.energy, r.energyAt]).toEqual([6, T0]);
    expect(energyNow(r, T0)).toBe(6);
    expect(energyNextMs(r, T0)).toBeNull();
    expect(energyNow(r, T0 + 10 * 3600_000)).toBe(6);
  });

  it("a bout takes one point, counts the bout and adds its XP; the timer starts at the first bout from full", () => {
    const t = T0 + 5 * 3600_000;
    const r = afterBout(fresh(), 2, t);
    expect([r.energy, r.energyAt, r.lifetimeBouts, r.xp]).toEqual([5, t, 1, 2]);
    expect(energyNow(r, t)).toBe(5);
    expect(energyNextMs(r, t)).toBe(20 * MIN);
    expect(energyNextMs(r, t + 7 * MIN)).toBe(13 * MIN);
  });

  it("refills one point every 20 minutes, and a full bar 2 hours after it was emptied", () => {
    const r = spend(fresh(), 6, T0);
    expect(energyNow(r, T0)).toBe(0);
    expect(energyNow(r, T0 + 20 * MIN - 1)).toBe(0);
    expect(energyNow(r, T0 + 20 * MIN)).toBe(1);
    expect(energyNow(r, T0 + 59 * MIN)).toBe(2);
    expect(energyNow(r, T0 + 100 * MIN)).toBe(5);
    expect(energyNow(r, T0 + 120 * MIN)).toBe(6);
    expect(energyNow(r, T0 + 1000 * MIN)).toBe(6);
    expect(energyNextMs(r, T0 + 120 * MIN)).toBeNull();
  });

  it("keeps the time already earned towards the next point when a bout is fought mid-refill", () => {
    let r = spend(fresh(), 3, T0);
    // 30 min later: 1 point back and 10 min towards the next one
    r = afterBout(r, 1, T0 + 30 * MIN);
    expect(energyNow(r, T0 + 30 * MIN)).toBe(3);
    expect(energyNextMs(r, T0 + 30 * MIN)).toBe(10 * MIN);
    expect(energyNow(r, T0 + 40 * MIN)).toBe(4);
  });

  it("never goes below 0 (the app refuses the bout first)", () => {
    const r = spend(fresh(), 9, T0);
    expect(r.energy).toBe(0);
    expect(r.lifetimeBouts).toBe(9);
  });

  it("a clock that moves back refills nothing, and moving it forward again makes no extra point", () => {
    const r = spend(fresh(), 6, T0);
    expect(energyNow(r, T0 - 3 * 3600_000)).toBe(0);
    expect(energyNextMs(r, T0 - 5 * MIN)).toBe(25 * MIN);
    // one point earned on the real clock, spent: empty again, and no more points from the past
    const later = T0 + 25 * MIN;
    const r2 = afterBout(r, 1, later);
    expect(energyNow(r2, later)).toBe(0);
    expect(energyNow(r2, T0 - 3 * 3600_000)).toBe(0);
    expect(energyNow(r2, T0 + 40 * MIN)).toBe(1);
    // from a full bar on a clock behind the stored time, the timer never starts before that time
    const back = afterBout(fresh(), 1, T0 - 10 * 3600_000);
    expect(back.energyAt).toBe(T0);
    expect(energyNow(back, T0 - 8 * 3600_000)).toBe(5);
    expect(energyNow(back, T0 + 19 * MIN)).toBe(5);
    expect(energyNow(back, T0 + 20 * MIN)).toBe(6);
  });

  it("is a pure function of the record and the time, and never throws on a damaged record", () => {
    const r = spend(fresh(), 4, T0);
    expect(energyNow(r, T0 + 33 * MIN)).toBe(energyNow({ ...r }, T0 + 33 * MIN));
    expect(energyNow({ ...r, energy: 99 }, T0)).toBe(6);
    expect(energyNow({ ...r, energy: -4 }, T0)).toBe(0);
    expect(energyNow({ ...r, energy: Number.NaN }, T0 + 20 * MIN)).toBe(1);
    expect(energyNow({ ...r, energyAt: Number.NaN }, T0)).toBe(6);
  });

  it("is what the API exports", () => {
    const r = spend(fresh(), 2, T0);
    expect(api.energyNow(r, T0 + 20 * MIN)).toBe(5);
    expect(api.energyNextMs(r, T0 + 21 * MIN)).toBe(19 * MIN);
    expect(api.afterBout(r, 1, T0).energy).toBe(3);
  });
});
