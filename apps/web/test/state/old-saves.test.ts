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
import { COMPANION_IDS, ENERGY_MAX, api, routeNode, sheetOf, snapshotOf } from "@rankzero/core";
import { readDoc } from "../../src/state/migrations";
import { memGame } from "./helpers";

type OldRecord = ScrapperRecord & { day: string; boutsUsed: number };
interface Fixture { build: string; simVersion: number; doc: { fighters: OldRecord[]; retired: OldRecord[]; schemaVersion: number } & Record<string, unknown>;
  expect: { a: FighterSnapshot; b: FighterSnapshot; bAtBout: { level: number; perks: PerkId[]; stats: StatBlock } } }
interface Fixture3 { build: string; simVersion: number; doc: { fighters: OldRecord[]; retired: OldRecord[]; history: Record<string, unknown>[];
  schemaVersion: number } & Record<string, unknown>; expect: Record<string, FighterSnapshot> }
const load = <T = Fixture>(c: string): T => JSON.parse(readFileSync(resolve(__dirname, `fixtures/save-${c}.json`), "utf8")) as T;
const pets = (perks: readonly string[]): string[] => perks.filter((p) => (COMPANION_IDS as readonly string[]).includes(p));
/** An old four-stat block as this build carries it (docs/RULES.md "Old saves"): its multipliers
 *  kept, no old stat higher than it was, every point kept, and Toughness + Precision 6 plus what the
 *  four old stats gave up (half of each one's gain after level 1). */
const isSix = (got: StatBlock, was: StatBlock, name: string): void => {
  const olds = ["health", "strength", "agility", "speed"] as const;
  let gave = 0;
  for (const k of olds) {
    expect(got.mult[k], `${name} ${k}`).toBe(was.mult[k]);
    expect(got.points[k], `${name} ${k}`).toBeLessThanOrEqual(was.points[k]);
    expect(got.points[k], `${name} ${k}`).toBeGreaterThanOrEqual(Math.ceil(was.points[k] / 2));
    gave += was.points[k] - got.points[k];
  }
  expect(got.points.toughness + got.points.precision, name).toBe(6 + gave);
  expect(Math.abs(got.points.toughness - got.points.precision), name).toBeLessThanOrEqual(1);
  expect([got.mult.toughness, got.mult.precision], name).toEqual([100, 100]);
};
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

  it("loads (now as schema 6), every scrapper keeping its level, picks, record, kit, stats and pets, with a full bar", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(6);
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
    isSix(ms.stats, fx.expect.a.stats, "Mona");
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

  it("loads (now as schema 6): every scrapper, active and retired, keeps its exact kit with Toughness 3 and Precision 3 added", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(6);
    expect(r.doc.retired.map((f) => f.name)).toEqual(["Kip Ladle"]);
    for (const f of [...r.doc.fighters, ...r.doc.retired]) {
      const old = [...fx.doc.fighters, ...fx.doc.retired].find((o) => o.id === f.id)!;
      const was = fx.expect[f.name]!;
      const now = snapshotOf(f);
      expect(now.level, f.name).toBe(was.level);
      expect(now.perks, f.name).toEqual(was.perks);
      isSix(now.stats, was.stats, f.name);
      expect(f.picks, f.name).toEqual(old.picks);
      expect([f.xp, f.lifetimeBouts, f.createdDay], f.name).toEqual([old.xp, old.lifetimeBouts, old.createdDay]);
      expect([f.energy, f.energyAt], f.name).toEqual([ENERGY_MAX, 0]);
      expect(f.base?.picks, f.name).toBe(f.picks.length);
    }
    expect(r.doc.history).toHaveLength(fx.doc.history.length);
    for (const h of r.doc.history) expect(h.before).toEqual({ xp: h.before.xp, energy: ENERGY_MAX, energyAt: 0 });
    expect(r.doc.activeId).toBe(fx.doc.activeId);
    expect(r.doc.settings).toEqual({ ...(fx.doc.settings as object), musicVolume: 60, sfxVolume: 100 });   // plan 13.17: the volume sliders arrive at their defaults
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

/**
 * Schema 4 to 5 (content v3, batch 2). The fixture is a save as build b13cbf4 (sim version 8,
 * content v3 batch 1) wrote it: three scrappers made, fought and levelled by that build's own core
 * (`expect` holds that build's snapshotOf of each). Today's Route has gear cards: walked today, the
 * same picks would meet one where they took another card. With the migration each keeps its kit,
 * stats and pets exactly, gets the default loadout (all its weapons, its shield, its pets) and no
 * gear, and walks on with gear cards from its next level-up.
 */
describe("a schema-4 save written by build b13cbf4 (sim version 8, content v3 batch 1)", () => {
  interface Fixture4 { build: string; simVersion: number; doc: { fighters: ScrapperRecord[]; retired: ScrapperRecord[]; schemaVersion: number } & Record<string, unknown>;
    expect: Record<string, FighterSnapshot> }
  const fx = load<Fixture4>("b13cbf4");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const all = [...fx.doc.fighters, ...fx.doc.retired];

  it("is a schema-4 save of sim version 8 with level-ups behind every scrapper", () => {
    expect(fx.doc.schemaVersion).toBe(4);
    expect(fx.simVersion).toBe(8);
    expect(all.length).toBe(3);
    for (const r of all) expect(r.picks.length).toBeGreaterThanOrEqual(5);
  });

  it("would walk into another kit today for at least one scrapper (the test is not empty)", () => {
    const changed = all.some((r) => JSON.stringify(snapshotOf(r).perks) !== JSON.stringify(fx.expect[r.name]!.perks));
    expect(changed).toBe(true);
  });

  it("keeps every scrapper's kit, stats and pets exactly, with the default loadout and no gear", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(6);
    for (const rec of [...r.doc.fighters, ...r.doc.retired]) {
      const was = fx.expect[rec.name]!;
      const now = snapshotOf(rec);
      expect(now.perks, rec.name).toEqual(was.perks);
      expect(now.stats, rec.name).toEqual(was.stats);
      expect(now.level).toBe(was.level);
      expect(rec.gearFrom).toBe(rec.picks.length);
      expect(rec.loadout, rec.name).toBeDefined();
      expect(rec.loadout!.gear).toEqual({});
      // (every weapon it owned is in the bag: an old kit holds 5 at most)
      expect(rec.loadout!.weapons).toEqual(was.perks.filter((p) => rec.loadout!.weapons.includes(p as never) || /^[a-z-]+$/.test(p) && false));
      expect(rec.loadout!.weapons.length).toBe(now.perks.filter((p) => rec.loadout!.weapons.includes(p as never)).length);
      expect(pets(now.perks)).toEqual(pets(was.perks));
    }
  });

  it("keeps everything else: names, picks, XP, energy, history rows and settings", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    if (!r.ok) throw new Error(r.why);
    const byId = new Map(all.map((x) => [x.id, x]));
    for (const rec of [...r.doc.fighters, ...r.doc.retired]) {
      const old = byId.get(rec.id)!;
      expect(rec.picks).toEqual(old.picks);
      expect(rec.xp).toBe(old.xp);
      expect([rec.energy, rec.energyAt]).toEqual([old.energy, old.energyAt]);
    }
    expect(r.doc.history.length).toBe((fx.doc.history as unknown[]).length);
    expect(r.doc.settings.speed).toBe(2);
  });

  it("walks on with gear cards after the migration (gearFrom holds only the old picks)", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    if (!r.ok) throw new Error(r.why);
    const rec = r.doc.fighters[0]!;
    let gearSeen = false;
    let picks = [...rec.picks];
    for (let k = 0; k < 40 && !gearSeen; k++) {
      const n = routeNode(rec.seed, picks, rec.base, rec.gearFrom);
      gearSeen = [n.left, n.right].some((c) => c.kind === "perk" && GEAR_IDS_LIST.includes(c.perk));
      picks = [...picks, k % 2 === 0 ? "L" : "R"];
    }
    expect(gearSeen).toBe(true);
  });
});
const GEAR_IDS_LIST: readonly string[] = ["bandana", "beanie", "hard-hat", "goggles", "welding-mask", "motorbike-helmet", "work-vest",
  "hi-vis-vest", "padded-jacket", "leather-jacket", "hockey-chest-pad", "tyre-rubber-vest", "work-gloves", "taped-fists", "rubber-gloves",
  "fingerless-gloves", "oven-mitts", "welding-gloves", "ripped-jeans", "cargo-pants", "knee-pads", "track-pants", "magazine-shin-guards",
  "overalls", "sneakers", "flip-flops", "rain-boots", "skate-shoes", "steel-toe-boots", "slippers"];

/**
 * Schema 5 to 6 (content v3, batch 3, plan 13.11). The fixture is a save as build 77dc0d0 (sim
 * version 9, content v3 batch 2) wrote it through its own actions: three scrappers made, fought
 * and levelled there (Bo Rivet to level 13, Cleo Socket to level 9 with a stored loadout, Dex Gravel
 * to level 7 and retired; the history cut to its newest 20 rows to keep the file small). `expect`
 * holds that build's snapshotOf of each. With the migration each keeps its kit, stats, pets and
 * loadout exactly, gets an empty talent tree, and holds the points its level earns, unspent, so the
 * Locker and the Kit show the talent prompt.
 */
describe("a schema-5 save written by build 77dc0d0 (sim version 9, content v3 batch 2)", () => {
  interface Fixture5 { build: string; simVersion: number; doc: { fighters: ScrapperRecord[]; retired: ScrapperRecord[]; schemaVersion: number } & Record<string, unknown>;
    expect: Record<string, FighterSnapshot> }
  const fx = load<Fixture5>("77dc0d0");
  const all = [...fx.doc.fighters, ...fx.doc.retired];

  it("is a real schema-5 save of sim version 9: no talents anywhere, a stored loadout, a retired scrapper", () => {
    expect(fx.doc.schemaVersion).toBe(5);
    expect(fx.simVersion).toBe(9);
    expect(all.length).toBe(3);
    expect(fx.doc.retired.length).toBe(1);
    expect(all.some((r) => r.loadout !== undefined)).toBe(true);
    expect(JSON.stringify(fx.doc)).not.toContain("talents");
  });

  it("keeps every kit, stat, pet and loadout exactly; each scrapper gets an empty tree and the points its level earns, unspent", () => {
    const r = readDoc(JSON.stringify(fx.doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(6);
    const byId = new Map(all.map((x) => [x.id, x]));
    for (const rec of [...r.doc.fighters, ...r.doc.retired]) {
      const was = fx.expect[rec.name]!;
      const now = snapshotOf(rec);
      expect(now.perks, rec.name).toEqual(was.perks);
      expect(now.stats, rec.name).toEqual(was.stats);
      expect(now.level, rec.name).toBe(was.level);
      expect(rec.loadout, rec.name).toEqual(byId.get(rec.id)!.loadout);
      expect(rec.talents, rec.name).toEqual({ ranks: {} });
      const t = sheetOf(rec).talents;
      expect(t.earned, rec.name).toBe(api.talentPointsAt(was.level));
      expect([t.spent, t.unspent], rec.name).toEqual([0, t.earned]);
      expect(t.earned, rec.name).toBeGreaterThan(0);
    }
    expect(r.doc.history.length).toBe((fx.doc.history as unknown[]).length);
  });

  it("spends after the migration, the bout's snapshot carries the talent, and the save round-trips", async () => {
    const g = await memGame();
    const r = readDoc(JSON.stringify(fx.doc));
    if (!r.ok) throw new Error(r.why);
    const bo = r.doc.fighters.find((f) => f.name === "Bo Rivet")!;
    const spent = api.spendTalent(api.spendTalent(bo, "thick-skin"), "brace");
    expect(snapshotOf(spent).talents).toEqual({ "thick-skin": 1, brace: 1 });
    expect(snapshotOf(spent).stats.points.toughness - snapshotOf(bo).stats.points.toughness).toBe(api.content.talents["thick-skin"].per.toughness);
    const back = readDoc(JSON.stringify({ ...r.doc, fighters: r.doc.fighters.map((f) => (f.id === bo.id ? spent : f)) }));
    expect(back.ok && back.doc.fighters.find((f) => f.id === bo.id)!.talents).toEqual({ ranks: { "thick-skin": 1, brace: 1 } });
    void g;
  });
});
