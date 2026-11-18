/**
 * Old saves keep their scrappers' progress (round-2 close). The fixtures are save documents as two
 * earlier builds wrote them, made by those builds' own core (git archive of aac2d64, sim version 3,
 * the start pass of 15 Nov; and 1681640, sim version 4, the first round-2 pass): two scrappers, one
 * of them with two level-ups taken after its last bout, and that bout's row (its log left out, as
 * after the 50th bout). `expect` holds what that build's snapshotOf gave each scrapper.
 *
 * Without the migration this build reads the same picks under its own tables and the kit changes
 * (items lost, others from nowhere); with it, level, picks, kit, stats, pets and record are kept.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FighterSnapshot, KitBase, PerkId, ScrapperRecord, StatBlock } from "@rankzero/core";
import { COMPANION_IDS, routeNode, sheetOf, snapshotOf } from "@rankzero/core";
import { readDoc } from "../../src/state/migrations";

interface Fixture { build: string; simVersion: number; doc: { fighters: ScrapperRecord[] } & Record<string, unknown>;
  expect: { a: FighterSnapshot; b: FighterSnapshot; bAtBout: { level: number; perks: PerkId[]; stats: StatBlock } } }
const load = (c: string): Fixture => JSON.parse(readFileSync(resolve(__dirname, `fixtures/save-${c}.json`), "utf8")) as Fixture;
const pets = (perks: readonly string[]): string[] => perks.filter((p) => (COMPANION_IDS as readonly string[]).includes(p));

describe.each(["aac2d64", "1681640"])("a save written by build %s", (c) => {
  const fx = load(c);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("is an old save whose kits today's walk would change (the test is not empty)", () => {
    expect(fx.doc.schemaVersion).toBe(2);
    const changed = fx.doc.fighters.some((r) => {
      const was = r.name === "Mona Grit" ? fx.expect.a : fx.expect.bAtBout;
      const now = snapshotOf({ ...r, picks: r.picks.slice(0, was.level - 1) });
      return JSON.stringify(now.perks) !== JSON.stringify(was.perks);
    });
    expect(changed).toBe(true);
  });

  it("loads as schema 3, every scrapper keeping its level, picks, record, kit, stats and pets", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(3);
    expect(r.doc.fighters.map((f) => f.id)).toEqual(fx.doc.fighters.map((f) => f.id));
    expect(r.doc.history).toHaveLength(2);
    for (const [k, f] of r.doc.fighters.entries()) {
      const old = fx.doc.fighters[k]!;
      expect(f.picks, f.name).toEqual(old.picks);
      expect([f.xp, f.lifetimeBouts, f.boutsUsed, f.day, f.createdDay], f.name).toEqual([old.xp, old.lifetimeBouts, old.boutsUsed, old.day, old.createdDay]);
      expect(sheetOf(f).level, f.name).toBe(1 + old.picks.length);
    }
    // Mona fought at her level: her kit is exactly the old build's
    const mona = r.doc.fighters.find((f) => f.name === "Mona Grit")!;
    const ms = snapshotOf(mona);
    expect(ms.perks).toEqual(fx.expect.a.perks);
    expect(ms.stats).toEqual(fx.expect.a.stats);
    expect(pets(ms.perks)).toEqual(pets(fx.expect.a.perks));
    // Kip levelled twice after his last bout: everything he had then, and the two new cards on top
    const kip = r.doc.fighters.find((f) => f.name === "Kip Ladle")!;
    const ks = snapshotOf(kip);
    expect(kip.base?.picks).toBe(fx.expect.bAtBout.level - 1);
    expect(ks.perks.slice(0, fx.expect.bAtBout.perks.length)).toEqual(fx.expect.bAtBout.perks);
    for (const p of pets(fx.expect.bAtBout.perks)) expect(ks.perks).toContain(p);
    expect(ks.level).toBe(1 + kip.picks.length);
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

describe("carried kits (schema 3)", () => {
  it("a save of this build gets no base: its kit already is today's walk", () => {
    const fx = load("1681640");
    const r0 = readDoc(JSON.stringify(fx.doc));
    if (!r0.ok) throw new Error(r0.why);
    // the same scrappers with history rows rewritten by this build's own walk
    const doc = JSON.parse(JSON.stringify(fx.doc)) as Record<string, unknown> & { fighters: ScrapperRecord[]; history: Record<string, unknown>[] };
    for (const h of doc.history) {
      const rec = doc.fighters.find((f) => f.id === h.fighterId)!;
      const lvl = (h.snapshotA as FighterSnapshot).level;
      h.snapshotA = snapshotOf({ ...rec, picks: rec.picks.slice(0, lvl - 1) });
    }
    const r = readDoc(JSON.stringify(doc));
    expect(r.ok).toBe(true);
    if (r.ok) for (const f of r.doc.fighters) expect(f.base, f.name).toBeUndefined();
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
    warn.mockRestore();
  });
});
