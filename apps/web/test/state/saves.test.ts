/**
 * The save rules of brief 3.14, on IndexedDB (fake-indexeddb) and on the in-memory store.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@rankzero/core";
import type { SaveDoc } from "../../src/contracts";
import { memoryKv } from "../../src/state/idb";
import { decodeSave, encodeSave } from "../../src/state/saveCode";
import { HISTORY_LOGS, HISTORY_ROWS, emptyDoc, trimHistory } from "../../src/state/schema";
import { BACKUP_LIMIT, BACKUP_PREFIX, SLOT_KEYS, createSaveStore, requestPersist } from "../../src/state/slots";
import { gameOn, idbGame, memGame, rival, T0 } from "./helpers";

afterEach(() => vi.restoreAllMocks());

const docText = (over: Partial<SaveDoc> = {}): string => JSON.stringify({ ...emptyDoc(T0), rev: 3, ...over });

describe("slots", () => {
  it("an empty save loads as empty, and the first write goes to slot 0 with rev 1", async () => {
    const kv = memoryKv();
    const s = createSaveStore(kv);
    expect(await s.load()).toEqual({ state: "empty" });
    expect(await s.write(emptyDoc(T0), 0)).toEqual({ ok: true, rev: 1 });
    expect(kv.data.has(SLOT_KEYS[0])).toBe(true);
    expect(await s.write(emptyDoc(T0), 1)).toEqual({ ok: true, rev: 2 });
    expect(kv.data.has(SLOT_KEYS[1])).toBe(true);
  });

  it("writes alternate, so the last good copy survives a failed write", async () => {
    const kv = memoryKv();
    const s = createSaveStore(kv);
    await s.write(emptyDoc(T0), 0);
    await s.write(emptyDoc(T0), 1);
    kv.failPut = () => true;
    expect(await s.write(emptyDoc(T0), 2)).toEqual({ ok: false, why: "io" });
    kv.failPut = null;
    const r = await s.load();
    expect(r.state).toBe("ok");
    if (r.state === "ok") expect(r.doc.rev).toBe(2);
  });

  it("a corrupt slot is backed up and never treated as empty", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const kv = memoryKv({ [SLOT_KEYS[0]]: "{not json at all" });
    const s = createSaveStore(kv);
    const r = await s.load();
    expect(r.state).toBe("corrupt");
    if (r.state !== "corrupt") return;
    expect(r.doc).toBeNull();
    expect(r.backupKey).toBe(`${BACKUP_PREFIX}0`);
    expect(kv.data.get(`${BACKUP_PREFIX}0`)).toBe("{not json at all");
    // the bytes are still there too, until a write replaces them
    expect(kv.data.get(SLOT_KEYS[0])).toBe("{not json at all");
  });

  it("with one slot corrupt and one good, the good copy loads and the bad bytes are kept", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const kv = memoryKv({ [SLOT_KEYS[0]]: docText({ rev: 4 }), [SLOT_KEYS[1]]: "garbage" });
    const r = await createSaveStore(kv).load();
    expect(r.state).toBe("corrupt");
    if (r.state === "corrupt") expect(r.doc?.rev).toBe(4);
    expect(kv.data.get(`${BACKUP_PREFIX}0`)).toBe("garbage");
  });

  it("a failed backup refuses the replace", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const kv = memoryKv({ [SLOT_KEYS[0]]: docText({ rev: 4 }), [SLOT_KEYS[1]]: "garbage" });
    const s = createSaveStore(kv);
    kv.failPut = (key) => key.startsWith(BACKUP_PREFIX);
    expect(await s.write(emptyDoc(T0), 4)).toEqual({ ok: false, why: "backup-failed" });
    expect(kv.data.get(SLOT_KEYS[1])).toBe("garbage");
    kv.failPut = null;
    expect(await s.write(emptyDoc(T0), 4)).toEqual({ ok: true, rev: 5 });
    expect(kv.data.get(`${BACKUP_PREFIX}0`)).toBe("garbage");
  });

  it("backups are never overwritten, the same bytes are not copied twice, and there are at most 8", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const kv = memoryKv();
    const s = createSaveStore(kv);
    for (let i = 0; i < BACKUP_LIMIT; i++) {
      kv.data.set(SLOT_KEYS[0], `bad bytes ${i}`);
      kv.data.delete(SLOT_KEYS[1]);
      await s.load();
      await s.load();                                  // same bytes: no second copy
    }
    const keys = [...kv.data.keys()].filter((k) => k.startsWith(BACKUP_PREFIX)).sort();
    expect(keys).toHaveLength(BACKUP_LIMIT);
    for (let i = 0; i < BACKUP_LIMIT; i++) expect(kv.data.get(`${BACKUP_PREFIX}${i}`)).toBe(`bad bytes ${i}`);
    // a ninth damaged copy cannot be backed up, so it is not replaced
    kv.data.set(SLOT_KEYS[0], "bad bytes 8");
    const r = await s.load();
    expect(r.state === "corrupt" && r.backupKey).toBe(null);
    expect(await s.write(emptyDoc(T0), 0)).toEqual({ ok: true, rev: 1 });   // goes to the empty slot 1
    expect(await s.write(emptyDoc(T0), 1)).toEqual({ ok: false, why: "backup-failed" });
    expect(kv.data.get(SLOT_KEYS[0])).toBe("bad bytes 8");
    for (let i = 0; i < BACKUP_LIMIT; i++) expect(kv.data.get(`${BACKUP_PREFIX}${i}`)).toBe(`bad bytes ${i}`);
  });

  it("a write with a stale rev is refused, and the store reloads instead of writing over the other tab", async () => {
    const kv = memoryKv();
    const a = await gameOn(kv);
    const b = await gameOn(kv);
    expect((await a.actions.create("Marla", 0, 0)).ok).toBe(true);
    expect(await createSaveStore(kv).write(emptyDoc(T0), 0)).toEqual({ ok: false, why: "stale" });
    // tab b is behind: its create must not wipe Marla
    const r = await b.actions.create("Dez", 0, 0);
    expect(r.ok).toBe(true);
    expect(b.store.notice).toMatch(/another tab/);
    const names = b.store.doc.fighters.map((f) => f.name);
    expect(names).toEqual(["Marla", "Dez"]);
    await a.store.reload();
    expect(a.store.doc.fighters.map((f) => f.name)).toEqual(["Marla", "Dez"]);
  });

  it("the stale check holds on IndexedDB too", async () => {
    const one = await idbGame();
    const two = await gameOn(one.kv);
    await one.actions.create("Marla", 0, 0);
    await two.actions.create("Tug", 0, 0);
    const fresh = await gameOn(one.kv);
    expect(fresh.store.doc.fighters.map((f) => f.name)).toEqual(["Marla", "Tug"]);
    expect(fresh.store.doc.rev).toBe(2);
  });

  it("an unknown perk id in a stored bout warns and does not throw", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const g = await memGame();
    const c = await g.actions.create("Marla", 0, 0);
    if (!c.ok) throw new Error(c.error);
    const r = await g.actions.startBout(c.value.id, await rival(g, c.value.id));
    if (!r.ok) throw new Error(r.error);
    const key = g.kv.data.has(SLOT_KEYS[1]) ? SLOT_KEYS[1] : SLOT_KEYS[0];
    const doc = JSON.parse(g.kv.data.get(key) as string) as SaveDoc;
    doc.history[0]!.snapshotB.perks.push("laser-sword" as never);
    g.kv.data.set(key, JSON.stringify(doc));
    const again = await gameOn(g.kv);
    expect(again.store.status.kind).toBe("ready");
    const row = again.store.doc.history[0]!;
    expect(row.snapshotB.perks).not.toContain("laser-sword");
    expect(row.log).toBeUndefined();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("laser-sword"))).toBe(true);
  });

  it("export then import gives back the same document", async () => {
    const g = await memGame();
    const c = await g.actions.create("Tug", 3, 5);
    if (!c.ok) throw new Error(c.error);
    for (let i = 0; i < 3; i++) {
      const r = await g.actions.startBout(c.value.id, await rival(g, c.value.id, i));
      if (!r.ok) break;
      await g.actions.markWatched(r.value.id);
    }
    const before = g.store.doc;
    const code = await g.actions.exportCode();
    expect(code.startsWith("RZ1.")).toBe(true);
    const back = await decodeSave(code);
    expect(back.ok && back.doc).toEqual(before);
    // into a clean browser
    const other = await memGame();
    expect(await other.actions.importCode(code)).toEqual({ ok: true, value: undefined });
    const { rev: _r1, updatedAt: _u1, ...x } = other.store.doc;
    const { rev: _r2, updatedAt: _u2, ...y } = before;
    expect(x).toEqual(y);
    expect(await other.actions.importCode("RZ1.not-a-save")).toEqual({ ok: false, error: "bad-code" });
    expect(await encodeSave(other.store.doc)).toMatch(/^RZ1\./);
  });

  it("history keeps 50 logs and 200 rows", () => {
    const g = { ...emptyDoc(T0) };
    const row = (i: number) => ({ id: `b${i}`, log: api.simulateFight(1, snapA, snapB, 1) });
    const snapA = api.snapshotOf(api.createRecord({ id: "a", name: "Marla", realmSalt: "yard-1", lookSalt: 0, colourSalt: 0, today: "2026-11-15" }));
    const snapB = api.rivalSnapshot("yard-1", 1, 0);
    const rows = Array.from({ length: 230 }, (_, i) => row(i)) as unknown as SaveDoc["history"];
    const out = trimHistory(rows);
    expect(out).toHaveLength(HISTORY_ROWS);
    expect(out.filter((b) => b.log !== undefined)).toHaveLength(HISTORY_LOGS);
    expect(out[49]!.log).toBeDefined();
    expect(out[50]!.log).toBeUndefined();
    expect(out[0]!.id).toBe("b0");
    void g;
  });

  it("persistent storage is asked for only on a secure page, and a refusal never throws", async () => {
    const persist = vi.fn(async () => true);
    const nav = { storage: { persist, persisted: async () => false } } as unknown as Navigator;
    expect(await requestPersist(nav, false)).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(await requestPersist(nav, true)).toBe(true);
    const throwing = { storage: { persist: () => Promise.reject(new Error("denied")) } } as unknown as Navigator;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await requestPersist(throwing, true)).toBe(false);
    expect(await requestPersist({} as Navigator, true)).toBe(false);
    expect(await requestPersist(undefined, true)).toBe(false);
  });
});

describe("create never writes over a scrapper", () => {
  it("an id that is already taken is replaced by a fresh one", async () => {
    const g = await memGame();
    const ids = ["SAME", "SAME", "OTHER"];
    const { createGameActions } = await import("../../src/state/actions");
    const actions = createGameActions({ store: g.store, clock: g.clock, newId: () => ids.shift() ?? "LAST" });
    const a = await actions.create("Marla", 0, 0);
    const b = await actions.create("Dez", 0, 0);
    expect(a.ok && a.value.id).toBe("SAME");
    expect(b.ok && b.value.id).toBe("OTHER");
    expect(g.store.doc.fighters.map((f) => [f.id, f.name])).toEqual([["SAME", "Marla"], ["OTHER", "Dez"]]);
  });
});
