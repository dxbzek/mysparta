/**
 * The rank ladder in the app (plan 13.10 item 1): who may start a boss bout, one energy per bout,
 * the rank held back until the bout is watched, the rank kept after a reload, the boss prize, the
 * guards, and the save migration 7 to 8.
 */
import { describe, expect, it } from "vitest";
import { api } from "@rankzero/core";
import type { ScrapperRecord } from "@rankzero/core";
import { guard } from "../../src/app/guards";
import { hrefOf, parseRoute } from "../../src/app/router";
import { shownRecord } from "../../src/state/actions";
import { MIGRATIONS, migrate, toLadder } from "../../src/state/migrations";
import { checkDoc, checkLadder } from "../../src/state/schema";
import { gameOn, memGame } from "./helpers";
import type { Game } from "./helpers";

async function scrapper(g: Game, name: string, picks: number): Promise<string> {
  const c = await g.actions.create(name, 0, 0);
  if (!c.ok) throw new Error(c.error);
  await g.store.commit((doc) => ({ doc: { ...doc, fighters: doc.fighters.map((f) => (f.id === c.value.id
    ? { ...f, picks: Array.from({ length: picks }, (_, i) => (i % 2 === 0 ? "L" : "R") as "L" | "R"), xp: 0 } : f)) }, value: undefined }));
  return c.value.id;
}
const recOf = (g: Game, id: string): ScrapperRecord => g.store.doc.fighters.find((f) => f.id === id)!;
const at = (g: Game, hash: string): string => hrefOf(guard(parseRoute(hash), g.store.doc, g.clock.now()));

/** Boss bouts of `rung` until one is won (each watched). Refills the bar between tries. */
async function beat(g: Game, id: string, rung: number): Promise<number> {
  for (let n = 1; n <= 30; n++) {
    await g.store.commit((doc) => ({ doc: { ...doc, fighters: doc.fighters.map((f) => (f.id === id ? { ...f, energy: 6, xp: 0 } : f)) }, value: undefined }));
    const r = await g.actions.startBoss(id, rung);
    if (!r.ok) throw new Error(r.error);
    await g.actions.markWatched(r.value.id);
    if (r.value.result.winner === "a") return n;
  }
  throw new Error("never won");
}

describe("boss bouts", () => {
  it("are refused under the gate and above the next rung, and start at the gate", async () => {
    const g = await memGame();
    const low = await scrapper(g, "Lowly", 1);
    expect(await g.actions.startBoss(low, 1)).toEqual({ ok: false, error: "level" });
    const id = await scrapper(g, "Gated", 2);
    expect(await g.actions.startBoss(id, 2)).toEqual({ ok: false, error: "rank" });
    const r = await g.actions.startBoss(id, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.boss).toBe(1);
    expect(r.value.snapshotB).toEqual(api.bossSnapshot(1));
    expect(api.energyNow(recOf(g, id), g.clock.now())).toBe(5);
    // one bout at a time, as for rivals
    expect(await g.actions.startBoss(id, 1)).toEqual({ ok: false, error: "unwatched-bout" });
  });

  it("a win moves the rank up, shown only once the bout is watched, and kept after a reload", async () => {
    const g = await memGame();
    const id = await scrapper(g, "Climber", 9);              // level 10: beats the first boss quickly
    await g.store.commit((doc) => ({ doc: { ...doc, fighters: doc.fighters.map((f) => (f.id === id ? { ...f, energy: 6 } : f)) }, value: undefined }));
    let won = false;
    for (let n = 0; n < 20 && !won; n++) {
      const r = await g.actions.startBoss(id, 1);
      if (!r.ok) throw new Error(r.error);
      won = r.value.result.winner === "a";
      if (won) {
        expect(api.ladderOf(recOf(g, id)).rank).toBe(1);
        expect(api.ladderOf(shownRecord(g.store.doc, recOf(g, id))).rank).toBe(0);
        expect(at(g, "#/prize")).toBe("#/locker");          // not before the bout is watched
      } else {
        expect(api.ladderOf(recOf(g, id)).rank).toBe(0);
      }
      await g.actions.markWatched(r.value.id);
      await g.store.commit((doc) => ({ doc: { ...doc, fighters: doc.fighters.map((f) => (f.id === id ? { ...f, energy: 6, xp: 0 } : f)) }, value: undefined }));
    }
    expect(won).toBe(true);
    expect(api.ladderOf(shownRecord(g.store.doc, recOf(g, id)))).toEqual({ rank: 1, prizeWaiting: true });
    const again = await gameOn(g.kv);
    expect(api.ladderOf(again.store.doc.fighters.find((f) => f.id === id)!)).toEqual({ rank: 1, prizeWaiting: true });
    expect(again.store.doc.history.some((b) => b.boss === 1 && b.result.winner === "a")).toBe(true);
  });

  it("a waiting prize holds the next boss back; taking it gives the item and frees the ladder", async () => {
    const g = await memGame();
    const id = await scrapper(g, "Prized", 9);
    await beat(g, id, 1);
    expect(at(g, "#/prize")).toBe("#/prize");
    await g.store.commit((doc) => ({ doc: { ...doc, fighters: doc.fighters.map((f) => (f.id === id ? { ...f, energy: 6 } : f)) }, value: undefined }));
    expect(await g.actions.startBoss(id, 2)).toEqual({ ok: false, error: "prize-waiting" });
    const offer = api.prizeOffer(recOf(g, id))!;
    expect(await g.actions.takePrize(id, "L")).toEqual({ ok: true, value: undefined });
    if (offer.left.kind === "perk") expect(api.sheetOf(recOf(g, id)).perks).toContain(offer.left.perk);
    expect(await g.actions.takePrize(id, "L")).toEqual({ ok: false, error: "nothing-waiting" });
    expect(at(g, "#/prize")).toBe("#/locker");
    const r = await g.actions.startBoss(id, 2);
    expect(r.ok).toBe(true);
  });

  it("a beaten boss is not fought again", async () => {
    const g = await memGame();
    const id = await scrapper(g, "Done", 9);
    await beat(g, id, 1);
    await g.actions.takePrize(id, "R");
    expect(await g.actions.startBoss(id, 1)).toEqual({ ok: false, error: "beaten" });
  });
});

describe("the save", () => {
  it("migration 7 to 8 starts every scrapper, active and retired, at Rank Zero", () => {
    const doc = { schemaVersion: 7, fighters: [{ id: "a", seed: 1 }], retired: [{ id: "b", seed: 2 }], history: [] };
    const out = toLadder(doc);
    expect((out.fighters as { ladder: unknown }[])[0]!.ladder).toEqual({ rank: 0, prizes: [] });
    expect((out.retired as { ladder: unknown }[])[0]!.ladder).toEqual({ rank: 0, prizes: [] });
    expect(MIGRATIONS[7]).toBeDefined();
    const m = migrate(doc);
    expect(m.ok && m.doc.schemaVersion).toBe(8);
  });

  it("reads a stored ladder inside its bounds, leaving out a prize it cannot read", () => {
    const warn: string[] = [];
    const l = checkLadder({ rank: 14, prizes: [{ at: 2, card: { kind: "perk", perk: "hard-hat" } }, { at: 3, card: { kind: "perk", perk: "no-such" } },
      { at: 4, card: { kind: "stat", stat: "health", amount: 3 } }] }, (w) => warn.push(w));
    expect(l).toEqual({ rank: 10, prizes: [{ at: 2, card: { kind: "perk", perk: "hard-hat" } }, { at: 4, card: { kind: "stat", stat: "health", amount: 3 } }] });
    expect(warn.length).toBe(1);
    expect(checkLadder({ rank: "x" }, () => undefined)).toBeNull();
  });

  it("a save with a ladder and a boss bout reads back unchanged", async () => {
    const g = await memGame();
    const id = await scrapper(g, "Keeper", 9);
    await beat(g, id, 1);
    const r = checkDoc(JSON.parse(JSON.stringify(g.store.doc)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.fighters[0]!.ladder).toEqual(recOf(g, id).ladder);
    expect(r.doc.history[0]!.boss).toBe(1);
  });
});
