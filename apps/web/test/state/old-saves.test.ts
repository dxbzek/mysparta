/**
 * Old saves keep their scrappers' progress (round-2 close, content v3). The fixtures are save
 * documents as three earlier builds wrote them, made by those builds' own code:
 *   - aac2d64 (sim version 3, the start pass of 15 Nov) and 1681640 (sim version 4, the first
 *     round-2 pass): schema 2. Two scrappers, one of them with two level-ups taken after its last
 *     bout, and that bout's row (its log left out, as after the 50th bout). `expect` holds what that
 *     build's snapshotOf gave each scrapper.
 *   - 74fc265 (sim version 7, the round-2 close): schema 3, written through that build's own
 *     actions. Rue Tack made and levelled 4 times there; Mona Grit and the retired Kip Ladle
 *     migrated by it from the 1681640 save, with carried kits; 16 bout rows with day counts.
 *     `expect` holds that build's snapshotOf of each scrapper (four stats).
 *
 * Today's walk reads the same picks into another kit (six stats move every later draw); with the
 * migration every scrapper keeps level, picks, record, kit and pets, its four stats as they were
 * plus Toughness 3 and Precision 3, and a full energy bar.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FighterSnapshot, KitBase, PerkId, ScrapperRecord, StatBlock } from "@rankzero/core";
import { COMPANION_IDS, ENERGY_MAX, routeNode, sheetOf, snapshotOf } from "@rankzero/core";
import { readDoc } from "../../src/state/migrations";
import { memGame } from "./helpers";

type OldRecord = ScrapperRecord & { day: string; boutsUsed: number };
interface Fixture { build: string; simVersion: number; doc: { fighters: OldRecord[]; retired: OldRecord[]; schemaVersion: number } & Record<string, unknown>;
  expect: { a: FighterSnapshot; b: FighterSnapshot; bAtBout: { level: number; perks: PerkId[]; stats: StatBlock } } }
interface Fixture3 { build: string; simVersion: number; doc: { fighters: OldRecord[]; retired: OldRecord[]; history: Record<string, unknown>[];
  schemaVersion: number } & Record<string, unknown>; expect: Record<string, FighterSnapshot> }
const load = <T = Fixture>(c: string): T => JSON.parse(readFileSync(resolve(__dirname, `fixtures/save-${c}.json`), "utf8")) as T;
const pets = (perks: readonly string[]): string[] => perks.filter((p) => (COMPANION_IDS as readonly string[]).includes(p));
/** An old four-stat block as this build carries it: Toughness 3 and Precision 3 added. */
const six = (s: StatBlock): StatBlock => ({
  points: { ...s.points, toughness: 3, precision: 3 },
  mult: { ...s.mult, toughness: 100, precision: 100 },
});
const four = (s: StatBlock) => ({ health: s.points.health, strength: s.points.strength, agility: s.points.agility, speed: s.points.speed });

describe.each(["aac2d64", "1681640"])("a schema-2 save written by build %s", (c) => {
  const fx = load(c);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("is an old save whose kits today's walk would change (the test is not empty)", () => {
    expect(fx.doc.schemaVersion).toBe(2);
    const changed = fx.doc.fighters.some((r) => {
      const was = r.name === "Mona Grit" ? fx.expect.a : fx.expect.bAtBout;
      const now = snapshotOf({ ...r, picks: r.picks.slice(0, was.level - 1) });
      return JSON.stringify(now.perks) !== JSON.stringify(was.perks) || JSON.stringify(four(now.stats)) !== JSON.stringify(four(was.stats));
    });
    expect(changed).toBe(true);
  });

  it("loads as schema 4, every scrapper keeping its level, picks, record, kit, stats and pets, with a full bar", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(4);
    expect(r.doc.fighters.map((f) => f.id)).toEqual(fx.doc.fighters.map((f) => f.id));
    expect(r.doc.history).toHaveLength(2);
    for (const [k, f] of r.doc.fighters.entries()) {
      const old = fx.doc.fighters[k]!;
      expect(f.picks, f.name).toEqual(old.picks);
      expect([f.xp, f.lifetimeBouts, f.createdDay], f.name).toEqual([old.xp, old.lifetimeBouts, old.createdDay]);
      expect([f.energy, f.energyAt], f.name).toEqual([ENERGY_MAX, 0]);
      expect("day" in f || "boutsUsed" in f, f.name).toBe(false);
      expect(sheetOf(f).level, f.name).toBe(1 + old.picks.length);
    }
    // Mona fought at her level: her kit is exactly the old build's, its stats with the two new ones
    const mona = r.doc.fighters.find((f) => f.name === "Mona Grit")!;
    const ms = snapshotOf(mona);
    expect(ms.perks).toEqual(fx.expect.a.perks);
    expect(ms.stats).toEqual(six(fx.expect.a.stats));
    expect(pets(ms.perks)).toEqual(pets(fx.expect.a.perks));
    // Kip levelled twice after his last bout: everything he had then, and the two new cards on top
    const kip = r.doc.fighters.find((f) => f.name === "Kip Ladle")!;
    const ks = snapshotOf(kip);
    expect(kip.base?.picks).toBe(kip.picks.length);
    expect(ks.perks.slice(0, fx.expect.bAtBout.perks.length)).toEqual(fx.expect.bAtBout.perks);
    for (const p of pets(fx.expect.bAtBout.perks)) expect(ks.perks).toContain(p);
    expect(ks.level).toBe(1 + kip.picks.length);
    // its stored bouts keep their snapshots, with no Toughness or Precision (those fights had none)
    for (const h of r.doc.history) {
      expect([h.snapshotA.stats.points.toughness, h.snapshotA.stats.points.precision]).toEqual([0, 0]);
      expect(h.before.energy).toBe(ENERGY_MAX);
    }
  });

  it("the next level-up comes from the carried kit, the same cards every time, and a save round-trips", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    if (!r.ok) throw new Error(r.why);
    const kip = r.doc.fighters.find((f) => f.name === "Kip Ladle")!;
    const next = routeNode(kip.seed, kip.picks, kip.base);
    expect(routeNode(kip.seed, kip.picks, kip.base)).toEqual(next);
    const after = snapshotOf({ ...kip, picks: [...kip.picks, "L"] });
    expect(after.perks.slice(0, fx.expect.bAtBout.perks.length)).toEqual(fx.expect.bAtBout.perks);
    // written and read again by this build: unchanged
    const again = readDoc(JSON.stringify(r.doc));
    expect(again.ok && again.doc).toEqual(r.doc);
  });
});

describe("a schema-3 save written by build 74fc265 (sim version 7)", () => {
  const fx = load<Fixture3>("74fc265");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("is a real schema-3 save: day counts, carried kits with four stats, and kits today's walk would change", () => {
    expect([fx.doc.schemaVersion, fx.simVersion]).toEqual([3, 7]);
    const all = [...fx.doc.fighters, ...fx.doc.retired];
    expect(all.map((f) => f.name).sort()).toEqual(["Kip Ladle", "Mona Grit", "Rue Tack"]);
    expect(all.every((f) => typeof f.day === "string" && typeof f.boutsUsed === "number")).toBe(true);
    expect(all.filter((f) => f.base !== undefined).map((f) => f.name).sort()).toEqual(["Kip Ladle", "Mona Grit"]);
    expect(Object.keys(fx.doc.fighters.find((f) => f.name === "Mona Grit")!.base!.stats.points)).toHaveLength(4);
    const rue = fx.doc.fighters.find((f) => f.name === "Rue Tack")!;
    expect(rue.base).toBeUndefined();
    expect(rue.picks).toHaveLength(4);
    const now = snapshotOf(rue);
    const was = fx.expect["Rue Tack"]!;
    expect(JSON.stringify(now.perks) !== JSON.stringify(was.perks) || JSON.stringify(four(now.stats)) !== JSON.stringify(four(was.stats))).toBe(true);
  });

  it("loads as schema 4: every scrapper, active and retired, keeps its exact kit with Toughness 3 and Precision 3 added", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(4);
    expect(r.doc.retired.map((f) => f.name)).toEqual(["Kip Ladle"]);
    for (const f of [...r.doc.fighters, ...r.doc.retired]) {
      const old = [...fx.doc.fighters, ...fx.doc.retired].find((o) => o.id === f.id)!;
      const was = fx.expect[f.name]!;
      const now = snapshotOf(f);
      expect(now.level, f.name).toBe(was.level);
      expect(now.perks, f.name).toEqual(was.perks);
      expect(now.stats, f.name).toEqual(six(was.stats));
      expect(f.picks, f.name).toEqual(old.picks);
      expect([f.xp, f.lifetimeBouts, f.createdDay], f.name).toEqual([old.xp, old.lifetimeBouts, old.createdDay]);
      expect([f.energy, f.energyAt], f.name).toEqual([ENERGY_MAX, 0]);
      expect(f.base?.picks, f.name).toBe(f.picks.length);
    }
    expect(r.doc.history).toHaveLength(fx.doc.history.length);
    for (const h of r.doc.history) expect(h.before).toEqual({ xp: h.before.xp, energy: ENERGY_MAX, energyAt: 0 });
    expect(r.doc.activeId).toBe(fx.doc.activeId);
    expect(r.doc.settings).toEqual(fx.doc.settings);
  });

  it("its power stays about where it was: as many stat points as a new kit of its level", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    if (!r.ok) throw new Error(r.why);
    const rue = r.doc.fighters.find((f) => f.name === "Rue Tack")!;
    const sum = (s: StatBlock): number => Object.values(s.points).reduce((a, b) => a + b, 0);
    const was = fx.expect["Rue Tack"]!;
    // the 6 points the starting budget grew by (14 to 20), and nothing else
    expect(sum(snapshotOf(rue).stats)).toBe(sum(was.stats) + 6);
  });

  it("the next level-up walks on from the carried kit, fights, and a save round-trips", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    if (!r.ok) throw new Error(r.why);
    const rue = r.doc.fighters.find((f) => f.name === "Rue Tack")!;
    const next = routeNode(rue.seed, rue.picks, rue.base);
    expect(routeNode(rue.seed, rue.picks, rue.base)).toEqual(next);
    const after = snapshotOf({ ...rue, picks: [...rue.picks, next.left.kind === "stat" ? "L" : "R"] });
    expect(after.perks.slice(0, fx.expect["Rue Tack"]!.perks.length)).toEqual(fx.expect["Rue Tack"]!.perks);
    expect(Object.values(after.stats.points).reduce((a, b) => a + b, 0)).toBeGreaterThan(Object.values(snapshotOf(rue).stats.points).reduce((a, b) => a + b, 0));
    const again = readDoc(JSON.stringify(r.doc));
    expect(again.ok && again.doc).toEqual(r.doc);
  });
});

describe("carried kits (schema 4)", () => {
  it("a scrapper made by this build has no base, starts with 20 points over six stats, and its save round-trips", async () => {
    const g = await memGame();
    const c = await g.actions.create("Nell Spoke", 1, 2);
    if (!c.ok) throw new Error(c.error);
    expect(c.value.base).toBeUndefined();
    expect([c.value.energy, c.value.energyAt]).toEqual([ENERGY_MAX, g.clock.now()]);
    const pts = sheetOf(c.value).stats.points;
    expect(Object.keys(pts)).toHaveLength(6);
    expect(Object.values(pts).reduce((x, y) => x + y, 0)).toBe(20);
    for (const v of Object.values(pts)) expect(v >= 2 && v <= 5).toBe(true);
    const r = readDoc(JSON.stringify(g.store.doc));
    expect(r.ok && r.doc).toEqual(g.store.doc);
  });

  it("a carried kit that is not readable is dropped with a warning; unknown perk ids are left out", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fx = load("aac2d64");
    const r0 = readDoc(JSON.stringify(fx.doc));
    if (!r0.ok) throw new Error(r0.why);
    const bad = { ...r0.doc, fighters: r0.doc.fighters.map((f, i) => (i === 0 ? { ...f, base: { picks: 99 } as unknown as KitBase } : f)) };
    const r = readDoc(JSON.stringify(bad));
    expect(r.ok && r.doc.fighters[0]!.base).toBeUndefined();
    expect(r.ok && r.warnings.some((w) => w.includes("carried kit"))).toBe(true);
    const odd = { ...r0.doc, fighters: r0.doc.fighters.map((f, i) => (i === 0 ? { ...f, base: { ...f.base!, perks: [...f.base!.perks, "door"] } } : f)) };
    const r2 = readDoc(JSON.stringify(odd));
    expect(r2.ok && r2.doc.fighters[0]!.base!.perks).toEqual(r0.doc.fighters[0]!.base!.perks);
    // a carried kit with only the four old stats is not a schema-4 kit
    const short = { ...r0.doc, fighters: r0.doc.fighters.map((f, i) => (i === 0 ? { ...f, base: { ...f.base!, stats: { points: four(f.base!.stats), mult: four(f.base!.stats) } } } : f)) };
    const r3 = readDoc(JSON.stringify(short));
    expect(r3.ok && r3.doc.fighters[0]!.base).toBeUndefined();
    warn.mockRestore();
  });
});
