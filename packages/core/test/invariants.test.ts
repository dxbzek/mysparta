/**
 * Property tests: simulate hundreds of grown champions and assert the rules
 * the rest of the app silently relies on. Each failure message carries the
 * seed, so any breakage replays deterministically.
 */
import { describe, expect, it } from "vitest";
import {
  LEVEL_CAP,
  applyDraft,
  costToNext,
  createChampion,
  generateDraft,
  simulateFight,
  snapshot,
  weapon,
} from "../src/index.js";
import { combineSeed, makeRng } from "../src/prng.js";
import type { BattlePlan, Champion } from "../src/types.js";

const PLAN: BattlePlan = { stance: "measured", gambit: "close_the_gap" };

/** A champion levelled by claiming seeded draft rolls, like the app does. */
function grown(name: string, level: number): Champion {
  const c = createChampion(name);
  for (let l = 1; l < level; l++) {
    const offers = generateDraft(c, l + 1, 0);
    applyDraft(c, offers, makeRng(combineSeed(c.seed, l)).int(offers.length), false);
  }
  return c;
}

function battles(count: number, fn: (r: ReturnType<typeof simulateFight>, snapA: ReturnType<typeof snapshot>, s: number) => void) {
  for (let s = 0; s < count; s++) {
    const a = grown("Alpha" + (s % 17), 1 + (s % 20));
    const b = grown("Beta" + (s % 13), 1 + (s % 20));
    const snapA = snapshot(a, PLAN);
    fn(simulateFight({ seed: s, attacker: snapA, defender: snapshot(b, PLAN) }), snapA, s);
  }
}

describe("fight invariants", () => {
  it("hp stays within [0, max] everywhere — result, hits, beast attacks", () => {
    const bad: string[] = [];
    battles(400, (r, _snap, s) => {
      for (const i of [0, 1] as const) {
        if (r.hp[i] < 0 || r.hp[i] > r.hpMax[i]) bad.push(`seed ${s}: hp[${i}]=${r.hp[i]}/${r.hpMax[i]}`);
      }
      if (r.reason === "ko" && r.hp[r.winner] <= 0) bad.push(`seed ${s}: winner at ${r.hp[r.winner]} hp`);
      for (const e of r.events) {
        if ((e.type === "hit" || e.type === "beastAttack" || e.type === "counter" || e.type === "riposte") && e.targetHp < 0) {
          bad.push(`seed ${s}: ${e.type} targetHp ${e.targetHp}`);
        }
        if (e.type === "hit" && e.amount < 1) bad.push(`seed ${s}: hit for ${e.amount}`);
      }
    });
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("the event log is ordered, ends exactly once, and ends last", () => {
    const bad: string[] = [];
    battles(400, (r, _snap, s) => {
      let last = -1;
      for (const e of r.events) {
        if (e.t < last) { bad.push(`seed ${s}: tick ${e.t} after ${last}`); break; }
        last = e.t;
      }
      const ends = r.events.filter((e) => e.type === "end");
      if (ends.length !== 1) bad.push(`seed ${s}: ${ends.length} end events`);
      if (r.events[r.events.length - 1]!.type !== "end") bad.push(`seed ${s}: end not last`);
    });
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("the log speaks in ids: every attack names a carried weapon id (fists aside)", () => {
    const bad: string[] = [];
    battles(300, (r, snapA, s) => {
      for (const e of r.events) {
        if (e.type !== "attack" || e.side !== 0) continue;
        if (e.weapon !== "fists" && !snapA.weapons.includes(e.weapon)) {
          bad.push(`seed ${s}: attacked with "${e.weapon}"`);
        }
      }
    });
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("thrown weapons never exceed their ammo", () => {
    const bad: string[] = [];
    battles(300, (r, _snap, s) => {
      const thrown = new Map<string, number>();
      for (const e of r.events) {
        if (e.type === "attack" && e.side === 0 && e.thrown) {
          thrown.set(e.weapon, (thrown.get(e.weapon) ?? 0) + 1);
        }
      }
      for (const [id, count] of thrown) {
        const ammo = weapon(id).ammo;
        if (ammo != null && count > ammo) bad.push(`seed ${s}: ${id} thrown ${count}x with ${ammo} ammo`);
      }
    });
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("a disarmed weapon is never swung again", () => {
    const bad: string[] = [];
    battles(300, (r, _snap, s) => {
      const lost = new Set<string>();
      for (const e of r.events) {
        if (e.type === "disarm" && e.side === 0) lost.add(e.weapon);
        else if (e.type === "attack" && e.side === 0 && lost.has(e.weapon)) {
          bad.push(`seed ${s}: swung disarmed ${e.weapon}`);
          break;
        }
      }
    });
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

describe("the XP curve rises without a cliff", () => {
  it("never costs more than 2 XP over the level before it", () => {
    // Ratio is the wrong lens at the bottom — 2 XP to 3 XP is +50% and fine.
    // The wall was absolute: 29 -> 30 jumped 31 XP to 50, a 19 XP step, which
    // at six fights a day is a day and a half appearing out of nowhere.
    for (let l = 2; l < LEVEL_CAP; l++) {
      const step = costToNext(l) - costToNext(l - 1);
      expect(step, `level ${l - 1} -> ${l}`).toBeGreaterThanOrEqual(0);
      expect(step, `level ${l - 1} -> ${l}`).toBeLessThanOrEqual(2);
    }
  });

  it("still gets harder all the way to the cap", () => {
    expect(costToNext(49)).toBeGreaterThan(costToNext(29) * 2);
    expect(costToNext(LEVEL_CAP)).toBe(Infinity);
  });
});
