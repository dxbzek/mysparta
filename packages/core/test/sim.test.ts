import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN,
  applyDraft,
  arenaBoard,
  combineSeed,
  costToNext,
  createChampion,
  cumulativeXp,
  generateDraft,
  makeRival,
  maxHp,
  simulateFight,
  snapshot,
  TICK_CAP,
} from "../src/index.js";
import type { BattlePlan, FateOffer } from "../src/index.js";

const PLAN_A: BattlePlan = { stance: "aggressive", gambit: "close_the_gap" };
const PLAN_G: BattlePlan = { stance: "guarded", gambit: "hold_ground" };

describe("determinism", () => {
  it("identical inputs produce identical fights", () => {
    const a = makeRival("Kassandra", 12, 1).snapshot;
    const b = makeRival("Leonidas", 12, 2).snapshot;
    const r1 = simulateFight({ seed: 123456, attacker: a, defender: b });
    const r2 = simulateFight({ seed: 123456, attacker: a, defender: b });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("different seeds diverge somewhere across a batch", () => {
    const a = makeRival("Kassandra", 10, 1).snapshot;
    const b = makeRival("Leonidas", 10, 2).snapshot;
    const logs = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      logs.add(JSON.stringify(simulateFight({ seed, attacker: a, defender: b }).events));
    }
    expect(logs.size).toBeGreaterThan(1);
  });

  it("name-seeded creation is deterministic and case/space-insensitive", () => {
    const a = createChampion("  Kassia  ");
    const b = createChampion("kassia");
    expect(a.seed).toBe(b.seed);
    expect(a.omen).toBe(b.omen);
    expect(a.stats).toEqual(b.stats);
  });
});

describe("fight invariants", () => {
  it("200 random matchups terminate with a valid winner within the tick cap", () => {
    for (let i = 0; i < 200; i++) {
      const la = 1 + (i % 20);
      const lb = Math.max(1, la + ((i * 7) % 5) - 2);
      const a = makeRival(`TesterA${i}`, la, i).snapshot;
      const b = makeRival(`TesterB${i}`, lb, i + 999).snapshot;
      const r = simulateFight({ seed: combineSeed("inv", i), attacker: a, defender: b });
      expect(r.winner === 0 || r.winner === 1).toBe(true);
      expect(r.ticks).toBeLessThanOrEqual(TICK_CAP);
      expect(r.events.at(-1)?.type).toBe("end");
      const loser = r.winner === 0 ? 1 : 0;
      if (r.reason === "ko") expect(r.hp[loser]).toBe(0);
    }
  });

  it("HP formula matches canon: 50 + 6×Grit + 2×level", () => {
    expect(maxHp(1, 9, [], false)).toBe(50 + 54 + 2);
    expect(maxHp(30, 20, [], false)).toBe(50 + 120 + 60);
    // Nemean Cub taxes 6 Grit.
    expect(maxHp(10, 12, ["nemean_cub"], false)).toBe(50 + 36 + 20);
    // Beast Bond reduces each tax by 1.
    expect(maxHp(10, 12, ["nemean_cub"], true)).toBe(50 + 42 + 20);
  });
});

describe("XP curve (02-gdd-core.md §6.2)", () => {
  it("hits the canonical anchors", () => {
    expect(cumulativeXp(10)).toBe(54);
    expect(cumulativeXp(30)).toBe(484);
    expect(cumulativeXp(50)).toBe(1674);
    expect(costToNext(2)).toBe(3);
    expect(costToNext(10)).toBe(12);
    expect(costToNext(30)).toBe(50);
  });
});

describe("Threads of Fate draft rules (02-gdd-core.md §6.3)", () => {
  it("first draft is fixed: stat+3, stat+2/+1, weapon", () => {
    const c = createChampion("Prodromos");
    const offers = generateDraft(c, 2, 0);
    expect(offers.map((o) => o.kind).sort()).toEqual(["stat21", "stat3", "weapon"]);
  });

  it("every draft has ≥1 stat offer, 3 distinct offers, unowned pools only", () => {
    const c = createChampion("Dokimastes");
    for (let level = 2; level <= 40; level++) {
      const offers = generateDraft(c, level, 0);
      expect(offers).toHaveLength(3);
      const keys = offers.map((o) => JSON.stringify(o));
      expect(new Set(keys).size).toBe(3);
      expect(offers.some((o) => o.kind === "stat3" || o.kind === "stat21")).toBe(true);
      for (const o of offers) {
        if (o.kind === "weapon") expect(c.weapons).not.toContain(o.weapon);
        if (o.kind === "skill") expect(c.skills).not.toContain(o.skill);
      }
      const pick = pickFirstStat(offers);
      applyDraft(c, offers, pick, false);
    }
  });

  it("milestone guarantees: weapon at 5, skill at 10", () => {
    const c = createChampion("Horistes");
    for (let level = 2; level <= 10; level++) {
      const offers = generateDraft(c, level, 0);
      if (level === 5) expect(offers.some((o) => o.kind === "weapon")).toBe(true);
      if (level === 10) expect(offers.some((o) => o.kind === "skill")).toBe(true);
      applyDraft(c, offers, pickFirstStat(offers), false);
    }
  });

  it("milestone levels grant Favour, capped at 6", () => {
    const c = createChampion("Eunoia");
    for (let level = 2; level <= 40; level++) {
      const offers = generateDraft(c, level, 0);
      applyDraft(c, offers, pickFirstStat(offers), false);
    }
    expect(c.level).toBe(40);
    expect(c.favour).toBe(6); // 5,10,15,20,25,30,35,40 → capped at 6
    expect(c.tapestry).toHaveLength(39);
  });

  it("rerolls redraw deterministically per nonce", () => {
    const c = createChampion("Metastrofi");
    const base = generateDraft(c, 2, 0);
    const reroll = generateDraft(c, 2, 1);
    expect(JSON.stringify(generateDraft(c, 2, 1))).toBe(JSON.stringify(reroll));
    expect(JSON.stringify(base)).not.toBe(JSON.stringify(reroll));
  });
});

describe("arena board", () => {
  it("is deterministic per day and refresh, 6 distinct rivals", () => {
    const c = createChampion("Kassia");
    const b1 = arenaBoard(c, "2026-08-01", 0);
    const b2 = arenaBoard(c, "2026-08-01", 0);
    expect(b1.map((r) => r.snapshot.name)).toEqual(b2.map((r) => r.snapshot.name));
    expect(new Set(b1.map((r) => r.snapshot.name)).size).toBe(6);
    const b3 = arenaBoard(c, "2026-08-02", 0);
    expect(JSON.stringify(b1.map((r) => r.snapshot.name))).not.toBe(
      JSON.stringify(b3.map((r) => r.snapshot.name)),
    );
  });

  it("rivals carry usable snapshots (fightable end to end)", () => {
    const c = createChampion("Kassia");
    for (let l = 2; l <= 6; l++) {
      const offers = generateDraft(c, l, 0);
      applyDraft(c, offers, 0, false);
    }
    const board = arenaBoard(c, "2026-08-01", 0);
    const me = snapshot(c, PLAN_A);
    for (const rival of board) {
      const r = simulateFight({ seed: combineSeed(c.seed, rival.snapshot.name), attacker: me, defender: rival.snapshot });
      expect(r.events.length).toBeGreaterThan(3);
    }
  });
});

describe("battle plans matter", () => {
  it("stance changes fight outcomes across a seed batch", () => {
    const a = makeRival("Machetes", 15, 5);
    const b = makeRival("Amyntor", 15, 6);
    let diff = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const agg = simulateFight({
        seed,
        attacker: { ...a.snapshot, plan: PLAN_A },
        defender: b.snapshot,
      });
      const grd = simulateFight({
        seed,
        attacker: { ...a.snapshot, plan: PLAN_G },
        defender: b.snapshot,
      });
      if (JSON.stringify(agg.events) !== JSON.stringify(grd.events)) diff++;
    }
    expect(diff).toBeGreaterThan(30);
  });
});

function pickFirstStat(offers: FateOffer[]): number {
  const i = offers.findIndex((o) => o.kind === "stat3" || o.kind === "stat21");
  return i >= 0 ? i : 0;
}
