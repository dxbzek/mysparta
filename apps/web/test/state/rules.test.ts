/**
 * The loop rules (brief 3.4, 3.5, 3.10, 3.14) through the real actions and the real sim.
 */
import { describe, expect, it } from "vitest";
import { PERK_IDS, api } from "@rankzero/core";
import { shownRecord, unwatchedOf } from "../../src/state/actions";
import { countdown, dayKeyOf, msToMidnight } from "../../src/state/day";
import { DAY_MS, T0, memGame, playUntilLevelUp, rival } from "./helpers";

const left = (g: Awaited<ReturnType<typeof memGame>>, id: string): number =>
  api.boutsLeft(g.store.doc.fighters.find((f) => f.id === id)!, g.clock.today());

async function spendDay(g: Awaited<ReturnType<typeof memGame>>, id: string): Promise<number> {
  let n = 0;
  for (;;) {
    const rec = g.store.doc.fighters.find((f) => f.id === id)!;
    if (api.sheetOf(rec).levelUpWaiting) {
      const r = await g.actions.takeLevelUp(id, n % 2 === 0 ? "L" : "R");
      expect(r.ok).toBe(true);
      continue;
    }
    const r = await g.actions.startBout(id, await rival(g, id, n));
    if (!r.ok) {
      expect(r.error).toBe("no-bouts");
      return n;
    }
    await g.actions.markWatched(r.value.id);
    n++;
  }
}

describe("bouts per day", () => {
  it("8 on the creation day, 6 after the day rolls over, none carried over", async () => {
    const g = await memGame();
    const c = await g.actions.create("Marla", 0, 0);
    if (!c.ok) throw new Error(c.error);
    expect(left(g, c.value.id)).toBe(8);
    expect(await spendDay(g, c.value.id)).toBe(8);
    expect(left(g, c.value.id)).toBe(0);
    g.clock.add(DAY_MS);
    expect(left(g, c.value.id)).toBe(6);
    expect(await spendDay(g, c.value.id)).toBe(6);
    g.clock.add(DAY_MS);
    expect(left(g, c.value.id)).toBe(6);
  });

  it("a clock that moves back resets nothing", async () => {
    const g = await memGame();
    const c = await g.actions.create("Dez", 0, 0);
    if (!c.ok) throw new Error(c.error);
    await spendDay(g, c.value.id);
    g.clock.add(-3 * DAY_MS);
    expect(left(g, c.value.id)).toBe(0);
    const r = await g.actions.startBout(c.value.id, await rival(g, c.value.id));
    expect(r).toEqual({ ok: false, error: "no-bouts" });
  });

  it("the countdown runs to local midnight", () => {
    const at = new Date(2026, 10, 15, 18, 48, 0).getTime();
    expect(countdown(msToMidnight(at))).toBe("5 h 12 min");
    expect(dayKeyOf(at)).toBe("2026-11-15");
    expect(dayKeyOf(at + msToMidnight(at))).toBe("2026-11-16");
    expect(countdown(30_000)).toBe("1 min");
  });
});

describe("the gates", () => {
  it("startBout is refused while a level-up waits, and takeLevelUp opens it again", async () => {
    const g = await memGame();
    const c = await g.actions.create("Tug", 0, 0);
    if (!c.ok) throw new Error(c.error);
    await playUntilLevelUp(g, c.value.id);
    const opp = await rival(g, c.value.id);
    expect(await g.actions.startBout(c.value.id, opp)).toEqual({ ok: false, error: "level-up-waiting" });
    expect((await g.actions.takeLevelUp(c.value.id, "L")).ok).toBe(true);
    const rec = g.store.doc.fighters[0]!;
    expect(rec.picks).toEqual(["L"]);
    if (!api.sheetOf(rec).levelUpWaiting) expect((await g.actions.startBout(c.value.id, opp)).ok).toBe(true);
    expect(await g.actions.takeLevelUp("nobody", "L")).toEqual({ ok: false, error: "nothing-waiting" });
  });

  it("startBout is refused while any bout is unwatched, for every scrapper", async () => {
    const g = await memGame();
    const a = await g.actions.create("Marla", 0, 0);
    const b = await g.actions.create("Dez", 0, 0);
    if (!a.ok || !b.ok) throw new Error("create");
    const r = await g.actions.startBout(a.value.id, await rival(g, a.value.id));
    if (!r.ok) throw new Error(r.error);
    expect(await g.actions.startBout(a.value.id, await rival(g, a.value.id, 1))).toEqual({ ok: false, error: "unwatched-bout" });
    expect(await g.actions.startBout(b.value.id, await rival(g, b.value.id))).toEqual({ ok: false, error: "unwatched-bout" });
    await g.actions.markWatched(r.value.id);
    expect((await g.actions.startBout(b.value.id, await rival(g, b.value.id))).ok).toBe(true);
  });

  it("the before values are shown until markWatched", async () => {
    const g = await memGame();
    const c = await g.actions.create("Marla", 0, 0);
    if (!c.ok) throw new Error(c.error);
    const r = await g.actions.startBout(c.value.id, await rival(g, c.value.id));
    if (!r.ok) throw new Error(r.error);
    const stored = g.store.doc.fighters[0]!;
    expect(stored.xp).toBe(r.value.xp);                       // the save already holds the result
    expect(stored.boutsUsed).toBe(1);
    const shown = shownRecord(g.store.doc, stored);
    expect(shown.xp).toBe(0);
    expect(api.boutsLeft(shown, g.clock.today())).toBe(8);
    expect(unwatchedOf(g.store.doc)?.id).toBe(r.value.id);
    await g.actions.markWatched(r.value.id);
    const after = shownRecord(g.store.doc, g.store.doc.fighters[0]!);
    expect(after.xp).toBe(r.value.xp);
    expect(api.boutsLeft(after, g.clock.today())).toBe(7);
    expect(unwatchedOf(g.store.doc)).toBeUndefined();
  });

  it("the stored bout replays to the same result from its seed and snapshots", async () => {
    const g = await memGame();
    const c = await g.actions.create("Tug", 0, 0);
    if (!c.ok) throw new Error(c.error);
    const r = await g.actions.startBout(c.value.id, await rival(g, c.value.id));
    if (!r.ok) throw new Error(r.error);
    const again = api.simulateFight(r.value.seed, r.value.snapshotA, r.value.snapshotB, 1);
    expect(api.canonical(again)).toBe(api.canonical(r.value.log!));
    expect(r.value.seed).toBe(api.boutSeed(c.value.id, r.value.snapshotB.id, 0));
  });
});

describe("slots and names", () => {
  it("three scrappers, a fourth is refused, a retired one stays in the save", async () => {
    const g = await memGame();
    for (const n of ["Marla", "Dez", "Tug"]) expect((await g.actions.create(n, 0, 0)).ok).toBe(true);
    expect(await g.actions.create("Nettle", 0, 0)).toEqual({ ok: false, error: "no-slot" });
    const tug = g.store.doc.fighters[2]!;
    expect(await g.actions.retire(tug.id, "tugg")).toEqual({ ok: false, error: "name-mismatch" });
    expect(await g.actions.retire(tug.id, " tug ")).toEqual({ ok: true, value: undefined });
    expect(g.store.doc.fighters.map((f) => f.name)).toEqual(["Marla", "Dez"]);
    expect(g.store.doc.retired.map((f) => f.id)).toEqual([tug.id]);
    expect((await g.actions.create("Nettle", 0, 0)).ok).toBe(true);
  });

  it("an active name is refused; a retired name makes a new level-1 scrapper with the same seed", async () => {
    const g = await memGame();
    const a = await g.actions.create("Marla", 0, 0);
    if (!a.ok) throw new Error(a.error);
    expect(await g.actions.create("  marla ", 1, 1)).toEqual({ ok: false, error: "name-taken" });
    expect(await g.actions.create("x", 0, 0)).toEqual({ ok: false, error: "bad-name" });
    await playUntilLevelUp(g, a.value.id);
    await g.actions.takeLevelUp(a.value.id, "R");
    await g.actions.retire(a.value.id, "Marla");
    const b = await g.actions.create("MARLA", 2, 2);
    if (!b.ok) throw new Error(b.error);
    expect(b.value.id).not.toBe(a.value.id);
    expect(b.value.seed).toBe(a.value.seed);
    expect(api.sheetOf(b.value).level).toBe(1);
    expect(api.routeNode(b.value.seed, [])).toEqual(api.routeNode(a.value.seed, []));
    expect(g.store.doc.retired[0]!.picks).toEqual(["R"]);
  });

  it("Found N of 92 counts every perk owned by active and retired scrappers", async () => {
    const g = await memGame();
    const names = ["Marla", "Dez", "Tug", "Nettle"];
    for (const n of names.slice(0, 3)) await g.actions.create(n, 0, 0);
    await g.actions.retire(g.store.doc.fighters[0]!.id, "Marla");
    await g.actions.create("Nettle", 0, 0);
    const doc = g.store.doc;
    const all = [...doc.fighters, ...doc.retired];
    const expected = new Set(all.flatMap((r) => api.sheetOf(r).perks));
    const found = api.foundPerks(all);
    expect(new Set(found)).toEqual(expected);
    expect(found.every((p) => PERK_IDS.includes(p))).toBe(true);
    // the retired scrapper's perks count
    for (const p of api.sheetOf(doc.retired[0]!).perks) expect(found).toContain(p);
  });

  it("select changes the scrapper shown in the Locker", async () => {
    const g = await memGame();
    const a = await g.actions.create("Marla", 0, 0);
    const b = await g.actions.create("Dez", 0, 0);
    if (!a.ok || !b.ok) throw new Error("create");
    expect(g.store.doc.activeId).toBe(b.value.id);
    await g.actions.select(a.value.id);
    expect(g.store.doc.activeId).toBe(a.value.id);
  });
});

describe("the day key", () => {
  it("is local time", () => {
    expect(dayKeyOf(T0)).toBe("2026-11-15");
    expect(dayKeyOf(new Date(2026, 10, 15, 23, 59, 59).getTime())).toBe("2026-11-15");
    expect(dayKeyOf(new Date(2026, 10, 16, 0, 0, 1).getTime())).toBe("2026-11-16");
  });
});
