/**
 * The kit of a save written before content v3 (progress/legacy.ts). golden/legacy-walk-v7.json
 * holds 124 kits that the sim-version-7 build (74fc265) walked with its own code: 24 seeds with 0,
 * 1, 4, 12 and 29 picks, and one seed walked on from a carried kit. The frozen walk must give
 * every one of them back, or an old save's scrappers would change kit on load.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { KitBase, Pick as Side2, StatBlock } from "../src/contracts/fighter";
import type { PerkId } from "../src/contracts/ids";
import { LEGACY_NEW_STAT_POINTS, legacyBase, legacyKit, sixStatsOf } from "../src/progress/legacy";
import { START_DEALT, START_EACH, STAT_KEYS, startStats } from "../src/progress/stats";
import { walk } from "../src/progress/route";

interface Case { seed: number; picks: string; base?: KitBase; perks: PerkId[]; stats: StatBlock }
const FILE = join(dirname(fileURLToPath(import.meta.url)), "golden", "legacy-walk-v7.json");
const cases = (JSON.parse(readFileSync(FILE, "utf8")) as { cases: Case[] }).cases;
const picksOf = (s: string): Side2[] => s.split("") as Side2[];

describe("the frozen sim-version-7 walk", () => {
  it("gives back every kit the old build recorded", () => {
    expect(cases).toHaveLength(124);
    for (const c of cases) {
      const k = legacyKit(c.seed, picksOf(c.picks), c.base);
      expect(k.perks, `${c.seed} ${c.picks}`).toEqual(c.perks);
      expect(k.stats, `${c.seed} ${c.picks}`).toEqual(c.stats);
    }
  });

  it("differs from the walk of today for most of the same picks (which is why saves carry it)", () => {
    let differ = 0;
    for (const c of cases) {
      const now = walk(c.seed, picksOf(c.picks), c.base);
      const same = JSON.stringify(now.perks) === JSON.stringify(c.perks)
        && (["health", "strength", "agility", "speed"] as const).every((k) => now.stats.points[k] === c.stats.points[k]);
      if (!same) differ += 1;
    }
    expect(differ).toBeGreaterThan(cases.length / 2);
  });
});

describe("old stat blocks gain Toughness and Precision", () => {
  it("gain 3 points in each, so an old level-1 kit holds the starting budget of 20", () => {
    expect(LEGACY_NEW_STAT_POINTS * 2).toBe(START_EACH * 6 + START_DEALT - 14);
    for (const c of cases.filter((x) => x.picks === "" && x.base === undefined)) {
      const six = sixStatsOf(c.stats);
      expect(Object.keys(six.points).sort()).toEqual([...STAT_KEYS].sort());
      expect([six.points.toughness, six.points.precision]).toEqual([3, 3]);
      expect([six.mult.toughness, six.mult.precision]).toEqual([100, 100]);
      for (const k of ["health", "strength", "agility", "speed"] as const) {
        expect(six.points[k]).toBe(c.stats.points[k]);
        expect(six.mult[k]).toBe(c.stats.mult[k]);
      }
    }
  });

  it("moves half of what each old stat gained after level 1 to Toughness and Precision, keeping the total", () => {
    for (const c of cases.filter((x) => x.base === undefined)) {
      const st = startStats(c.seed).points;
      // the old deal and today's deal give the four old stats the same level-1 points
      if (c.picks === "") for (const k of ["health", "strength", "agility", "speed"] as const) expect(st[k]).toBeLessThanOrEqual(c.stats.points[k]);
      const b = legacyBase(c.seed, picksOf(c.picks)).stats;
      const sum = (s: StatBlock): number => STAT_KEYS.reduce((a, k) => a + (s.points[k] ?? 0), 0);
      expect(sum(b)).toBe(sum(c.stats) + 6);
      let moved = 0;
      for (const k of ["health", "strength", "agility", "speed"] as const) {
        const gain = Math.max(0, c.stats.points[k] - st[k]);
        expect(b.points[k], `${c.seed} ${k}`).toBe(c.stats.points[k] - Math.floor(gain / 2));
        expect(b.mult[k]).toBe(c.stats.mult[k]);
        moved += Math.floor(gain / 2);
      }
      expect([b.points.toughness, b.points.precision]).toEqual([3 + Math.ceil(moved / 2), 3 + Math.floor(moved / 2)]);
    }
  });

  it("leaves a block that already has six stats as it is", () => {
    const s: StatBlock = { points: { health: 4, strength: 3, agility: 2, speed: 5, toughness: 4, precision: 2 },
      mult: { health: 100, strength: 150, agility: 100, speed: 100, toughness: 100, precision: 100 } };
    expect(sixStatsOf(s)).toEqual(s);
  });

  it("a carried kit covers all the picks, and the walk of today goes on from it", () => {
    const c = cases.find((x) => x.picks.length === 12 && x.base === undefined)!;
    const b = legacyBase(c.seed, picksOf(c.picks));
    expect(b.picks).toBe(12);
    expect(b.perks).toEqual(c.perks);
    const st = startStats(c.seed).points;
    expect(b.stats).toEqual(sixStatsOf(c.stats, { health: st.health, strength: st.strength, agility: st.agility, speed: st.speed }));
    const now = walk(c.seed, picksOf(c.picks), b);
    expect(now.perks).toEqual(c.perks);
    expect(now.stats).toEqual(b.stats);
    const next = walk(c.seed, [...picksOf(c.picks), "L"], b);
    expect(next.perks.slice(0, c.perks.length)).toEqual(c.perks);
  });
});
