/**
 * The gate (brief 3.5, acceptance 12): while a level-up waits, typing the arena or a bout URL
 * goes back to the Locker. Also the other guards and the hash parser.
 */
import { describe, expect, it } from "vitest";
import { guard } from "../../src/app/guards";
import { hrefOf, parseRoute } from "../../src/app/router";
import type { Route } from "../../src/app/router";
import { memGame, playUntilLevelUp, rival } from "../state/helpers";

const at = (hash: string, doc: Parameters<typeof guard>[1], now: number): string => hrefOf(guard(parseRoute(hash), doc, now));

describe("router", () => {
  it("parses and prints every route", () => {
    const routes: Route[] = [{ name: "home" }, { name: "create" }, { name: "locker" }, { name: "settings" }, { name: "card" },
      { name: "bout", id: "01ABC" }, { name: "levelup" }, { name: "kit", tab: "kit" }, { name: "kit", tab: "route" },
      { name: "kit", tab: "stats" }, { name: "bouts" }, { name: "replay", id: "01XYZ" }, { name: "sandbox" }, { name: "inventory" }];
    for (const r of routes) expect(parseRoute(hrefOf(r))).toEqual(r);
    expect(parseRoute("")).toEqual({ name: "home" });
    expect(parseRoute("#/nowhere").name).toBe("unknown");
    expect(parseRoute("#/bout").name).toBe("unknown");
  });
});

describe("guards", () => {
  it("an empty save only shows Create", async () => {
    const g = await memGame();
    const today = g.clock.now();
    for (const h of ["#/", "#/locker", "#/card", "#/bout/x", "#/levelup", "#/kit", "#/bouts", "#/inventory"]) expect(at(h, g.store.doc, today)).toBe("#/create");
    expect(at("#/settings", g.store.doc, today)).toBe("#/settings");
    expect(at("#/sandbox", g.store.doc, today)).toBe("#/sandbox");
  });

  it("with a level-up waiting, #/card and #/bout/x return to the Locker", async () => {
    const g = await memGame();
    const c = await g.actions.create("Tug", 0, 0);
    if (!c.ok) throw new Error(c.error);
    await playUntilLevelUp(g, c.value.id);
    const today = g.clock.now();
    const doc = g.store.doc;
    expect(at("#/card", doc, today)).toBe("#/locker");
    expect(at("#/bout/x", doc, today)).toBe("#/locker");
    expect(at(`#/bout/${doc.history[0]!.id}`, doc, today)).toBe("#/locker");
    expect(at("#/levelup", doc, today)).toBe("#/levelup");
    expect(at("#/kit/route", doc, today)).toBe("#/kit/route");
    // the Inventory tab is a place to look, not a bout: it stays open while a level-up waits
    expect(at("#/inventory", doc, today)).toBe("#/inventory");
    await g.actions.takeLevelUp(c.value.id, "L");
    expect(at("#/levelup", g.store.doc, today)).toBe("#/locker");
  });

  it("would let the arena through without the level-up check (planted fault)", async () => {
    const g = await memGame();
    const c = await g.actions.create("Tug", 0, 0);
    if (!c.ok) throw new Error(c.error);
    await playUntilLevelUp(g, c.value.id);
    const noGate = (r: Route): Route => (r.name === "card" ? r : guard(r, g.store.doc, g.clock.now()));
    expect(hrefOf(noGate({ name: "card" }))).toBe("#/card");
    expect(at("#/card", g.store.doc, g.clock.now())).not.toBe("#/card");
  });

  it("the unwatched bout can be watched; the Card waits until it is", async () => {
    const g = await memGame();
    const c = await g.actions.create("Marla", 0, 0);
    if (!c.ok) throw new Error(c.error);
    const r = await g.actions.startBout(c.value.id, await rival(g, c.value.id));
    if (!r.ok) throw new Error(r.error);
    const today = g.clock.now();
    expect(at(`#/bout/${r.value.id}`, g.store.doc, today)).toBe(`#/bout/${r.value.id}`);
    expect(at("#/card", g.store.doc, today)).toBe("#/locker");
    expect(at("#/levelup", g.store.doc, today)).toBe("#/locker");
    await g.actions.markWatched(r.value.id);
    expect(at(`#/bout/${r.value.id}`, g.store.doc, today)).toBe(`#/replay/${r.value.id}`);
    expect(at("#/card", g.store.doc, today)).toBe("#/card");
    expect(at("#/replay/nope", g.store.doc, today)).toBe("#/bouts");
  });

  it("with no bouts left the Card returns to the Locker; three scrappers close Create", async () => {
    const g = await memGame();
    const c = await g.actions.create("Dez", 0, 0);
    if (!c.ok) throw new Error(c.error);
    for (let i = 0; i < 20; i++) {
      const rec = g.store.doc.fighters[0]!;
      if ((await import("@rankzero/core")).api.sheetOf(rec).levelUpWaiting) { await g.actions.takeLevelUp(rec.id, "R"); continue; }
      const r = await g.actions.startBout(rec.id, await rival(g, rec.id, i));
      if (!r.ok) break;
      await g.actions.markWatched(r.value.id);
    }
    expect(at("#/card", g.store.doc, g.clock.now())).toBe("#/locker");
    await g.actions.create("Marla", 0, 0);
    expect(at("#/create", g.store.doc, g.clock.now())).toBe("#/create");
    await g.actions.create("Tug", 0, 0);
    expect(at("#/create", g.store.doc, g.clock.now())).toBe("#/locker");
    expect(at("#/", g.store.doc, g.clock.now())).toBe("#/locker");
  });
});
