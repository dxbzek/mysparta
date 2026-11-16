/**
 * Creation, the Route, XP, the daily rules, rivals and the perk pool (work package 1).
 */
import { describe, expect, it } from "vitest";
import type { Pick as Side2, ScrapperRecord } from "../src/contracts/fighter";
import type { PerkId } from "../src/contracts/ids";
import { COMPANION_IDS, PERK_IDS, REALM_SALT, RIVALS_PER_LEVEL, SHIELD_IDS, SKILL_IDS, WEAPON_IDS, isCompanionId,
  perkKind } from "../src/contracts/ids";
import { RARITY_OF, RARITY_WEIGHT } from "../src/contracts/content";
import type { SkillDef } from "../src/contracts/content";
import { combineSeed, makeRng } from "../src/prng";
import { api } from "../src/api";
import { COMPANIONS } from "../src/content/companions";
import { FIRST_PARTS, SECOND_PARTS } from "../src/content/names";
import { SKILLS } from "../src/content/skills";
import { allowed, perkChance, rollPerk } from "../src/progress/perks";
import { startPerk } from "../src/progress/create";
import { startStats, effectiveOf, maxHpOf } from "../src/progress/stats";
import { PERK_PLUS_MAX_LEVEL, walk } from "../src/progress/route";
import { cardIndices } from "../src/progress/rivals";

const DAY = "2026-11-14";
const skillOf = (p: string): SkillDef | undefined => (SKILLS as Record<string, SkillDef | undefined>)[p];
function rec(name: string, picks: Side2[] = [], extra: Partial<ScrapperRecord> = {}): ScrapperRecord {
  return { ...api.createRecord({ id: `id-${name}`, name, realmSalt: REALM_SALT, lookSalt: 0, colourSalt: 0, today: DAY }),
    picks, ...extra };
}
function randomPicks(rng: ReturnType<typeof makeRng>, n: number): Side2[] {
  return Array.from({ length: n }, () => (rng.int(2) === 0 ? "L" : "R"));
}

describe("names", () => {
  it("cleans, then checks 3 to 14 letters, digits, spaces and hyphens", () => {
    expect(api.checkName("  Big   Lou  ")).toEqual({ ok: true, name: "Big Lou" });
    expect(api.checkName("ab")).toEqual({ ok: false, why: "length" });
    expect(api.checkName("abcdefghijklmno")).toEqual({ ok: false, why: "length" });
    expect(api.checkName("Lou!")).toEqual({ ok: false, why: "chars" });
    expect(api.checkName("Mary-Jo 2")).toEqual({ ok: true, name: "Mary-Jo 2" });
  });
  it("seeds from the lowercased, cleaned name and keeps the player's capitals", () => {
    expect(api.fighterSeed(REALM_SALT, " Big  LOU")).toBe(api.fighterSeed(REALM_SALT, "big lou"));
    expect(rec("Big  LOU").name).toBe("Big LOU");
  });
  it("has our own lists of 120 and 60 parts, every random name valid", () => {
    expect(new Set(FIRST_PARTS).size).toBe(120);
    expect(new Set(SECOND_PARTS).size).toBe(60);
    for (let n = -500; n < 5000; n++) expect(api.checkName(api.randomName(n)).ok).toBe(true);
    expect(api.randomName(7)).toBe(api.randomName(7));
  });
});

describe("creation", () => {
  it("starts every scrapper with 14 points, each stat 2 to 5", () => {
    for (let i = 0; i < 2000; i++) {
      const s = startStats(combineSeed("t", i));
      const pts = Object.values(s.points);
      expect(pts.reduce((a, b) => a + b, 0)).toBe(14);
      for (const p of pts) { expect(p).toBeGreaterThanOrEqual(2); expect(p).toBeLessThanOrEqual(5); }
    }
  });
  it("gives level-1 HP 68 to 89 before the starting perk (54 + 7 x Health since the pet pass)", () => {
    let lo = 999; let hi = 0;
    for (let i = 0; i < 2000; i++) {
      const hp = maxHpOf(effectiveOf(startStats(combineSeed("t", i))).health, 1, 0);
      lo = Math.min(lo, hp); hi = Math.max(hi, hp);
    }
    expect(lo).toBe(68);
    expect(hi).toBe(89);
  });
  it("gives the same name the same stats, starting perk, look and first offer", () => {
    for (const n of ["Marla", "Dez", "Tug", "Big Lou"]) {
      const a = rec(n); const b = { ...rec(n), id: "other" };
      expect(api.sheetOf(a).stats).toEqual(api.sheetOf(b).stats);
      expect(api.sheetOf(a).startPerk).toBe(api.sheetOf(b).startPerk);
      expect(api.rollLook(a.seed, 0, 0)).toEqual(api.rollLook(b.seed, 0, 0));
      expect(api.routeNode(a.seed, [])).toEqual(api.routeNode(b.seed, []));
    }
  });
  it("rolls shapes from the look salt and colours from the colour salt", () => {
    const seed = api.fighterSeed(REALM_SALT, "Marla");
    const a = api.rollLook(seed, 0, 0); const b = api.rollLook(seed, 1, 0); const c = api.rollLook(seed, 0, 1);
    expect([b.skin, b.hairColor, b.palette]).toEqual([a.skin, a.hairColor, a.palette]);
    expect([c.build, c.head, c.hair, c.face, c.top, c.bottom, c.shoes, c.accessory])
      .toEqual([a.build, a.head, a.hair, a.face, a.top, a.bottom, a.shoes, a.accessory]);
  });
  it("starts with a perk that is allowed on an empty kit (never a Whistle)", () => {
    for (let i = 0; i < 3000; i++) expect(startPerk(combineSeed("s", i))).not.toBe("whistle");
  });
  it("applies a booster taken on the Route to the stats (a scrapper starts with a weapon since the pet pass)", () => {
    for (let i = 0; i < 5000; i++) {
      const r = rec(api.randomName(i));
      const card = api.routeNode(r.seed, []);
      const side = card.left.kind === "perk" && card.left.perk === "big-heart" ? "L"
        : card.right.kind === "perk" && card.right.perk === "big-heart" ? "R" : null;
      if (side === null) continue;
      expect(api.sheetOf({ ...r, picks: [side], xp: 0 }).stats.mult.health).toBe(130);
      return;
    }
    throw new Error("no Big Heart card found");
  });
});

describe("xp and level-ups", () => {
  it("needs 3, 5, 6, 8, 9, 11, 12, 14, 15, 17 XP for levels 1 to 10, and 32 at 20", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(api.xpToNext)).toEqual([3, 5, 6, 8, 9, 11, 12, 14, 15, 17]);
    expect(api.xpToNext(20)).toBe(32);
  });
  it("gives 2 for a win, 1 for a loss, 1 for a win two or more levels down", () => {
    expect(api.xpForBout(true, 5, 5)).toBe(2);
    expect(api.xpForBout(false, 5, 5)).toBe(1);
    expect(api.xpForBout(true, 5, 4)).toBe(2);
    expect(api.xpForBout(true, 5, 3)).toBe(1);
    expect(api.xpForBout(false, 5, 9)).toBe(1);
  });
  it("waits for a level-up, carries extra XP and ignores a pick with nothing waiting", () => {
    let r = rec("Marla");
    expect(api.afterPick(r, "L")).toBe(r);
    r = api.afterBout(r, 2, DAY);
    r = api.afterBout(r, 2, DAY);
    expect(api.sheetOf(r).levelUpWaiting).toBe(true);
    r = api.afterPick(r, "R");
    expect(r.picks).toEqual(["R"]);
    expect(r.xp).toBe(1);
    expect(api.sheetOf(r).level).toBe(2);
  });
});

describe("bouts per day", () => {
  it("gives 8 on the creation day, 6 on later days, and resets only forward", () => {
    let r = rec("Dez");
    expect(api.boutsLeft(r, DAY)).toBe(8);
    for (let i = 0; i < 8; i++) r = api.afterBout(r, 1, DAY);
    expect(api.boutsLeft(r, DAY)).toBe(0);
    expect(api.boutsLeft(r, "2026-11-15")).toBe(6);
    expect(api.boutsLeft(r, "2026-11-13")).toBe(0);
    r = api.afterBout(r, 1, "2026-11-15");
    expect(r.day).toBe("2026-11-15");
    expect(api.boutsLeft(r, "2026-11-15")).toBe(5);
    expect(api.boutsLeft(r, DAY)).toBe(5);
    expect(r.lifetimeBouts).toBe(9);
  });
});

describe("the Route", () => {
  it("is identical when recomputed from seed and picks, for 1,000 scrappers", () => {
    const rng = makeRng(42);
    for (let i = 0; i < 1000; i++) {
      const r = rec(api.randomName(i), randomPicks(rng, rng.int(25)));
      const stored = api.route(r);
      expect(stored).toHaveLength(r.picks.length);
      const again = r.picks.map((_, k) => api.routeNode(r.seed, r.picks.slice(0, k)));
      expect(stored.map((n) => ({ left: n.left, right: n.right }))).toEqual(again);
      expect(stored.map((n) => n.taken)).toEqual(r.picks);
      expect(api.route({ ...r, id: "x" })).toEqual(stored);
    }
  });
  it("gives the same later offers for the same picks", () => {
    const s = api.fighterSeed(REALM_SALT, "Tug");
    expect(api.routeNode(s, ["L", "R", "R"])).toEqual(api.routeNode(s, ["L", "R", "R"]));
  });
  it("offers a stat card of +2 and a perk or split card, and the kit matches the picks", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 300; i++) {
      const r = rec(api.randomName(i + 9000), randomPicks(rng, 15));
      const sheet = api.sheetOf(r);
      let points = 14;
      const perks: PerkId[] = [sheet.startPerk, sheet.startSkill];
      for (const n of api.route(r)) {
        const kinds = [n.left.kind, n.right.kind].sort();
        expect(kinds[1]).toBe("stat");
        const card = n.taken === "L" ? n.left : n.right;
        if (card.kind === "stat") { expect(card.amount).toBe(2); points += 2; }
        else if (card.kind === "split") { expect(card.stats[0]).not.toBe(card.stats[1]); points += 2; }
        else {
          perks.push(card.perk);
          // Round 2: a perk card of the first three level-ups carries +1 point in a stat.
          expect(card.plus !== undefined, `level ${n.level}`).toBe(n.level <= PERK_PLUS_MAX_LEVEL);
          if (card.plus !== undefined) points += 1;
        }
      }
      expect(sheet.perks).toEqual(perks);
      const boosterPoints = perks.reduce((a, p) => a + (skillOf(p) === undefined ? 0
        : ["health", "strength", "agility", "speed"].reduce((b, k) => b + (skillOf(p)!.tiers[0][k] ?? 0), 0)), 0);
      expect(Object.values(sheet.stats.points).reduce((a, b) => a + b, 0)).toBe(points + boosterPoints);
    }
  });
  it("never offers a perk the kit cannot take", () => {
    const rng = makeRng(11);
    for (let i = 0; i < 400; i++) {
      const r = rec(api.randomName(i + 20000), randomPicks(rng, 30));
      const kit = walk(r.seed, r.picks);
      const owned: PerkId[] = [kit.startPerk, kit.startSkill];
      for (const n of kit.nodes) {
        for (const c of [n.left, n.right]) {
          if (c.kind !== "perk") continue;
          if (isCompanionId(c.perk)) {
            expect(owned.filter((p) => p === c.perk).length).toBeLessThan(COMPANIONS[c.perk].limit);
            for (const ex of COMPANIONS[c.perk].excludes) expect(owned).not.toContain(ex);
          } else expect(owned).not.toContain(c.perk);
          if (c.perk === "whistle") expect(owned.some((p) => isCompanionId(p))).toBe(true);
          if (skillOf(c.perk)?.kind === "booster") {
            expect(owned.filter((p) => skillOf(p)?.kind === "booster").length).toBeLessThan(3);
          }
        }
        const card = n.taken === "L" ? n.left : n.right;
        if (card.kind === "perk") owned.push(card.perk);
      }
    }
  });
  it("lets a booster pass 10% of the time with one owned, 3% with two, never with three", () => {
    const counts = [0, 0, 0, 0];
    const N = 100000;
    const rng = makeRng(5);
    const owned: PerkId[][] = [[], ["big-heart"], ["big-heart", "light-feet"], ["big-heart", "light-feet", "fast-twitch"]];
    for (let k = 0; k < 4; k++) for (let i = 0; i < N; i++) if (allowed("heavy-hands", owned[k]!, rng)) counts[k]! += 1;
    expect(counts[0]).toBe(N);
    expect(Math.abs(counts[1]! - N * 0.1)).toBeLessThan(4 * Math.sqrt(N * 0.1 * 0.9));
    expect(Math.abs(counts[2]! - N * 0.03)).toBeLessThan(4 * Math.sqrt(N * 0.03 * 0.97));
    expect(counts[3]).toBe(0);
  });
});

describe("rarity", () => {
  it("gives each perk exactly the chance of the rules' table, as a fraction", () => {
    // The table: category share (weapon 44, skill 46, shield 6, companion 4), then weight over the category's total.
    const total = (ids: readonly PerkId[], w: (id: PerkId) => number): number => ids.reduce((a, id) => a + w(id), 0);
    const weaponTotal = total(WEAPON_IDS, (id) => RARITY_WEIGHT[RARITY_OF[id]]);
    const skillTotal = total(SKILL_IDS, (id) => RARITY_WEIGHT[RARITY_OF[id]]);
    const shieldTotal = total(SHIELD_IDS, (id) => RARITY_WEIGHT[RARITY_OF[id]]);
    expect(weaponTotal).toBe(9 * 400 + 12 * 150 + 11 * 50 + 6 * 12 + 3 * 2);
    expect(skillTotal).toBe(7 * 400 + 16 * 150 + 12 * 50 + 3 * 12 + 1 * 2);
    expect(shieldTotal).toBe(1 * 400 + 2 * 150 + 2 * 50 + 1 * 12);
    const petW: Record<string, number> = { raccoon: 90, goose: 5, boar: 5, "stray-dog": 30, crow: 15, "alley-cat": 15 };
    const want = (id: PerkId): number => {
      const k = perkKind(id);
      if (k === "weapon") return (44 / 100) * (RARITY_WEIGHT[RARITY_OF[id]] / weaponTotal);
      if (k === "skill") return (46 / 100) * (RARITY_WEIGHT[RARITY_OF[id]] / skillTotal);
      if (k === "shield") return (6 / 100) * (RARITY_WEIGHT[RARITY_OF[id]] / shieldTotal);
      return (4 / 100) * (petW[id]! / 160);
    };
    let sum = 0;
    for (const id of PERK_IDS) {
      const c = perkChance(id);
      expect(c.num / c.den).toBeCloseTo(want(id), 15);
      sum += c.num / c.den;
    }
    expect(sum).toBeCloseTo(1, 12);
    // Spot figures of content v2 (the brief's were 4.1%, 5.0% and 3.6% with the first lists).
    expect(perkChance("padding").num / perkChance("padding").den).toBeCloseTo(0.0315, 3);
    expect(perkChance("pipe").num / perkChance("pipe").den).toBeCloseTo(0.0293, 3);
    expect(perkChance("raccoon").num / perkChance("raccoon").den).toBeCloseTo(0.0225, 4);
    expect(perkChance("bin-lid").num / perkChance("bin-lid").den).toBeCloseTo(0.0294, 3);
  });
  it("matches those chances over 1,000,000 rolls, each count within 4 standard deviations", () => {
    const N = 1_000_000;
    const counts = new Map<PerkId, number>();
    const rng = makeRng(combineSeed("rarity", 1));
    for (let i = 0; i < N; i++) { const id = rollPerk(rng); counts.set(id, (counts.get(id) ?? 0) + 1); }
    for (const id of PERK_IDS) {
      const c = perkChance(id);
      const p = c.num / c.den;
      const sd = Math.sqrt(N * p * (1 - p));
      expect(Math.abs((counts.get(id) ?? 0) - N * p)).toBeLessThanOrEqual(4 * sd);
    }
  });
  it("labels companions Uncommon, Epic, Epic, Uncommon, Rare, Rare", () => {
    expect(COMPANION_IDS.map((c) => COMPANIONS[c].rarity)).toEqual(["uncommon", "epic", "epic", "uncommon", "rare", "rare"]);
  });
});

describe("rivals", () => {
  it("at level N have exactly N - 1 picks behind them", () => {
    for (const level of [1, 2, 5, 10, 20, 30]) {
      for (let i = 0; i < 20; i++) {
        const s = api.rivalSnapshot(REALM_SALT, level, i);
        expect(s.level).toBe(level);
        const pts = Object.values(s.stats.points).reduce((a, b) => a + b, 0);
        expect(pts).toBeGreaterThanOrEqual(14);
        // Every level-up adds 2 points or one perk. A scrapper starts with two perks. A perk card
        // of the first three level-ups also carries 1 point (round 2), so up to 3 points more.
        const perks = s.perks.length - 2;
        const boosterPoints = s.perks.reduce((a, p) => a + (skillOf(p) === undefined ? 0
          : ["health", "strength", "agility", "speed"].reduce((b, k) => b + (skillOf(p)!.tiers[0][k] ?? 0), 0)), 0);
        const early = Math.min(level - 1, PERK_PLUS_MAX_LEVEL - 1);
        const cards = (pts - 14 - boosterPoints) / 2 + perks;
        expect(cards).toBeGreaterThanOrEqual(level - 1);
        expect(cards).toBeLessThanOrEqual(level - 1 + early / 2);
      }
    }
  });
  it("are the same for the same salt, level and index", () => {
    expect(api.rivalSnapshot(REALM_SALT, 7, 3)).toEqual(api.rivalSnapshot(REALM_SALT, 7, 3));
    expect(api.rivalSnapshot(REALM_SALT, 7, 3).id).not.toBe(api.rivalSnapshot(REALM_SALT, 7, 4).id);
  });
  it("Tonight's Card holds 6 different rivals at the scrapper's level and is redrawn after a bout", () => {
    let r = rec("Marla");
    const a = api.tonightsCard(r, REALM_SALT, DAY);
    expect(a).toHaveLength(6);
    expect(new Set(a.map((s) => s.id)).size).toBe(6);
    for (const s of a) expect(s.level).toBe(1);
    expect(api.tonightsCard(r, REALM_SALT, DAY)).toEqual(a);
    r = api.afterBout(r, 1, DAY);
    expect(cardIndices(r, REALM_SALT, DAY)).not.toEqual(cardIndices(rec("Marla"), REALM_SALT, DAY));
  });
  it("at levels 1 to 3 holds one easy rival, armed, in the last place; every rival owns a weapon", () => {
    for (let i = 0; i < 400; i++) {
      for (const lvl of [1, 2, 3]) {
        const r = rec(api.randomName(i), Array.from({ length: lvl - 1 }, () => "L" as Side2));
        for (const day of ["2026-11-14", "2026-11-15"]) {
          const card = api.tonightsCard(r, REALM_SALT, day);
          expect(card.every((s) => s.perks.some((p) => perkKind(p) === "weapon"))).toBe(true);
          expect(card.map((s) => s.id.includes(":easy:"))).toEqual([false, false, false, false, false, true]);
          for (const s of card) expect(Number(s.id.split(":").pop())).toBeLessThan(RIVALS_PER_LEVEL);
        }
      }
    }
  });
});

describe("found perks and sheets", () => {
  it("lists every perk any record has owned, in perk order", () => {
    const rng = makeRng(3);
    const recs = Array.from({ length: 5 }, (_, i) => rec(api.randomName(i), randomPicks(rng, 20)));
    const want = new Set(recs.flatMap((r) => api.sheetOf(r).perks));
    expect(api.foundPerks(recs)).toEqual(PERK_IDS.filter((p) => want.has(p)));
  });
  it("snapshot sheet equals the record sheet's four fields", () => {
    const rng = makeRng(4);
    for (let i = 0; i < 100; i++) {
      const r = rec(api.randomName(i), randomPicks(rng, 12));
      const s = api.sheetOf(r);
      const ss = api.snapshotSheet(api.snapshotOf(r));
      expect(ss).toEqual({ maxHp: s.maxHp, effective: s.effective, derived: s.derived, companionCostPct: s.companionCostPct });
    }
  });
  it("takes the companion cost off max HP: two Raccoons and a Boar cost 47%", () => {
    const base = 54 + 7 * 5;
    expect(maxHpOf(5, 10, 47)).toBe(Math.floor((base * 53) / 100));
    const s = api.snapshotSheet({ id: "x", name: "X", look: api.rollLook(1, 0, 0), level: 10, rulesVersion: 1,
      stats: { points: { health: 5, strength: 5, agility: 5, speed: 5 }, mult: { health: 100, strength: 100, agility: 100, speed: 100 } },
      perks: ["raccoon", "raccoon", "boar"] });
    expect(s.companionCostPct).toBe(47);
    expect(s.maxHp).toBe(Math.floor((base * 53) / 100));
  });
  it("seeds a bout from both ids and the lifetime count", () => {
    expect(api.boutSeed("a", "b", 3)).toBe(api.boutSeed("a", "b", 3));
    expect(api.boutSeed("a", "b", 3)).not.toBe(api.boutSeed("a", "b", 4));
    expect(api.boutSeed("a", "b", 3)).not.toBe(api.boutSeed("b", "a", 3));
  });
});
