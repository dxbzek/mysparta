/**
 * The old build's storage is never read, changed or deleted (brief 3.14, acceptance 27). This is
 * the one test file allowed to name the old prefix (tools/banned-terms.allow).
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { idbKv, openIdb } from "../../src/state/idb";
import { gameOn, rival } from "./helpers";

const OLD = "agoge";

function trackedStorage(init: Record<string, string>) {
  const data = new Map(Object.entries(init));
  const calls: string[] = [];
  const s = {
    getItem: (k: string) => { calls.push(`get ${k}`); return data.get(k) ?? null; },
    setItem: (k: string, v: string) => { calls.push(`set ${k}`); data.set(k, v); },
    removeItem: (k: string) => { calls.push(`remove ${k}`); data.delete(k); },
    clear: () => { calls.push("clear"); data.clear(); },
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
  return { s, data, calls };
}

describe("the old build's keys", () => {
  it("are untouched by a full session: create, bouts, a level-up, export and a reload", async () => {
    const init = { [`${OLD}.save`]: "{\"old\":true}", [`${OLD}.settings`]: "x" };
    const ls = trackedStorage(init);
    const g0 = globalThis as { localStorage?: unknown; sessionStorage?: unknown };
    const prev = [g0.localStorage, g0.sessionStorage];
    g0.localStorage = ls.s;
    g0.sessionStorage = ls.s;
    const factory = new IDBFactory();
    // an old IndexedDB database with the old prefix
    const oldDb = await openIdb(factory, `${OLD}.db`);
    await idbKv(oldDb).atomic((tx) => tx.put(`${OLD}.fighter`, "old"));
    oldDb.close();
    try {
      const g = await gameOn(idbKv(await openIdb(factory)));
      const c = await g.actions.create("Marla", 0, 0);
      if (!c.ok) throw new Error(c.error);
      for (let i = 0; i < 4; i++) {
        const r = await g.actions.startBout(c.value.id, await rival(g, c.value.id, i));
        if (!r.ok) break;
        await g.actions.markWatched(r.value.id);
      }
      await g.actions.exportCode();
      await gameOn(g.kv);
      expect(ls.calls).toEqual([]);
      expect(Object.fromEntries(ls.data)).toEqual(init);
      const again = await openIdb(factory, `${OLD}.db`);
      expect(await idbKv(again).atomic((tx) => tx.keys(""))).toEqual([`${OLD}.fighter`]);
      again.close();
    } finally {
      g0.localStorage = prev[0];
      g0.sessionStorage = prev[1];
    }
  });

  it("no file of the app's state names browser storage other than IndexedDB, or the old prefix", () => {
    // One exception: idb.ts mirrors the save to localStorage under its own `rankzero.` key when
    // a browser refuses IndexedDB writes (an embedded frame on iOS). It never reads other keys.
    const dir = fileURLToPath(new URL("../../src/state/", import.meta.url));
    for (const f of readdirSync(dir)) {
      const text = readFileSync(join(dir, f), "utf8");
      if (f === "idb.ts") {
        expect(text).not.toMatch(/sessionStorage|document\.cookie/);
        expect(text).toContain('LOCAL_KEY = "rankzero.kv"');
        expect(text.match(/\.(getItem|setItem)\(([^)]*)\)/g)?.every((c) => c.includes("LOCAL_KEY"))).toBe(true);
      } else {
        expect(text, f).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
      }
      expect(text.toLowerCase(), f).not.toContain(OLD);
    }
  });
});
