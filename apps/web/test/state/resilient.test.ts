import { afterEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { StorageUnsureError, idbKv, localKv, memoryKv, openIdb, resilientKv, LOCAL_KEY, type Kv, type KvTx } from "../../src/state/idb";
import { SCHEMA_VERSION, emptyDoc } from "../../src/state/schema";
import { SLOT_KEYS, createSaveStore } from "../../src/state/slots";
import { NEWER_SAVE_NOTICE, SaveError, createGameStore } from "../../src/state/store";
import { createGameActions } from "../../src/state/actions";
import { fixedClock } from "../../src/state/day";
import { T0 } from "./helpers";

afterEach(() => vi.restoreAllMocks());
const quiet = (): void => void vi.spyOn(console, "warn").mockImplementation(() => undefined);

/** A store that opens but refuses every transaction, like IndexedDB in an embedded frame on iOS. */
const refusing: Kv = { atomic: () => Promise.reject(Object.assign(new Error("The transaction is inactive"), { name: "TransactionInactiveError" })) };

/** A store that works until `broken.on = true`, then refuses every step. */
function breakable(inner: Kv): Kv & { on: boolean } {
  const kv = {
    on: false,
    atomic<T>(fn: (tx: KvTx) => Promise<T>): Promise<T> {
      return kv.on ? refusing.atomic(fn) : inner.atomic(fn);
    },
  };
  return kv;
}

function fakeStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

const doc0 = { schemaVersion: 1, rev: 0, updatedAt: 1, settings: {}, fighters: [], retired: [], history: [] } as never;

describe("a browser that refuses IndexedDB writes", () => {
  it("says the save is unsure (not empty) on the first load, then saves into local storage and reads it back", async () => {
    quiet();
    const storage = fakeStorage();
    const saves = createSaveStore(resilientKv(refusing, (seed) => localKv(storage, seed)));
    // Finding 41: this used to load as { state: "empty" }, which showed the Create screen.
    await expect(saves.load()).rejects.toBeInstanceOf(StorageUnsureError);
    expect(await saves.write(doc0, 0)).toEqual({ ok: true, rev: 1 });
    expect(storage.map.has(LOCAL_KEY)).toBe(true);
    const again = createSaveStore(resilientKv(refusing, (seed) => localKv(storage, seed)));
    const loaded = await again.load();          // the fallback holds a save now: no unsure step
    expect(loaded.state).toBe("ok");
  });

  it("control: without the fallback the same write fails", async () => {
    quiet();
    const saves = createSaveStore(refusing);
    expect(await saves.write(doc0, 0)).toEqual({ ok: false, why: "io" });
  });

  it("keeps playing from memory when local storage throws too", async () => {
    quiet();
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    const saves = createSaveStore(resilientKv(refusing, (seed) => localKv(broken, seed)));
    await expect(saves.load()).rejects.toBeInstanceOf(StorageUnsureError);
    expect(await saves.write(doc0, 0)).toEqual({ ok: true, rev: 1 });
    void memoryKv;
  });

  it("the game store shows 'failed' (the retry screen), not an empty save, when IndexedDB fails at load", async () => {
    quiet();
    const store = createGameStore(createSaveStore(resilientKv(refusing, (seed) => localKv(fakeStorage(), seed))), () => T0);
    await expect(store.load()).rejects.toThrow();
    expect(store.status.kind).toBe("failed");
  });
});

describe("IndexedDB fails in the middle of a session (finding 11)", () => {
  it("the next saves keep working: the fallback starts from what was already read", async () => {
    quiet();
    const inner = memoryKv();
    const idb = breakable(inner);
    const kv = resilientKv(idb, (seed) => localKv(fakeStorage(), seed));
    const clock = fixedClock(T0);
    const store = createGameStore(createSaveStore(kv), clock.now);
    await store.load();
    const actions = createGameActions({ store, clock });
    expect((await actions.create("Marla", 0, 0)).ok).toBe(true);
    await actions.setSettings({ sound: false });
    idb.on = true;                                      // IndexedDB dies here
    await expect(actions.setSettings({ sound: true })).resolves.toBeUndefined();
    expect((await actions.create("Dez", 0, 0)).ok).toBe(true);
    expect(store.doc.fighters.map((f) => f.name)).toEqual(["Marla", "Dez"]);
    expect(store.doc.settings.sound).toBe(true);
    expect(store.notice).toBeNull();                    // no false "another tab" message
  });

  it("reopens IndexedDB once before giving up on it", async () => {
    quiet();
    const factory = new IDBFactory();
    const first = breakable(idbKv(await openIdb(factory)));
    let reopened = 0;
    const fallback = vi.fn((seed: ReadonlyMap<string, unknown>) => localKv(fakeStorage(), seed));
    const kv = resilientKv(first, fallback, undefined, async () => { reopened++; return idbKv(await openIdb(factory)); });
    const saves = createSaveStore(kv);
    expect(await saves.load()).toEqual({ state: "empty" });
    expect(await saves.write(emptyDoc(T0), 0)).toEqual({ ok: true, rev: 1 });
    first.on = true;
    expect(await saves.write(emptyDoc(T0), 1)).toEqual({ ok: true, rev: 2 });
    expect(reopened).toBe(1);
    expect(fallback).not.toHaveBeenCalled();
    const fresh = createSaveStore(idbKv(await openIdb(factory)));
    const r = await fresh.load();
    expect(r.state === "ok" && r.doc.rev).toBe(2);       // the write went to IndexedDB, not elsewhere
  });
});

describe("two tabs on the local-storage fallback (finding 71)", () => {
  it("a tab that is behind gets 'stale' instead of erasing the other tab's write", async () => {
    const storage = fakeStorage();
    const a = createSaveStore(localKv(storage));
    const b = createSaveStore(localKv(storage));
    expect(await a.load()).toEqual({ state: "empty" });
    expect(await b.load()).toEqual({ state: "empty" });
    expect(await a.write(emptyDoc(T0), 0)).toEqual({ ok: true, rev: 1 });
    expect(await b.write(emptyDoc(T0), 0)).toEqual({ ok: false, why: "stale" });
    const r = await b.load();
    expect(r.state === "ok" && r.doc.rev).toBe(1);
  });
});

describe("a slot written by a newer build (finding 72)", () => {
  it("an older tab cannot write over it", async () => {
    quiet();
    const kv = memoryKv();
    const s = createSaveStore(kv);
    expect(await s.write(emptyDoc(T0), 0)).toEqual({ ok: true, rev: 1 });
    // a newer build writes rev 2 into the other slot, in a schema this build cannot read
    const newer = JSON.stringify({ ...emptyDoc(T0), schemaVersion: SCHEMA_VERSION + 1, rev: 2 });
    kv.data.set(SLOT_KEYS[1], newer);
    expect(await s.write(emptyDoc(T0), 1)).toEqual({ ok: false, why: "stale" });
    expect(kv.data.get(SLOT_KEYS[1])).toBe(newer);
  });

  it("the game store says a newer version saved here and to reload, not 'another tab'", async () => {
    quiet();
    const kv = memoryKv({
      [SLOT_KEYS[0]]: JSON.stringify({ ...emptyDoc(T0), rev: 3 }),
      [SLOT_KEYS[1]]: JSON.stringify({ ...emptyDoc(T0), schemaVersion: SCHEMA_VERSION + 1, rev: 4 }),
    });
    const store = createGameStore(createSaveStore(kv), () => T0);
    await store.load();
    store.clearNotice();
    const touch = (d: typeof store.doc) => ({ doc: { ...d, updatedAt: d.updatedAt + 1 }, value: null });
    const err = await store.commit(touch).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SaveError);
    expect((err as SaveError).why).toBe("newer");
    expect(store.notice).toBe(NEWER_SAVE_NOTICE);
    expect(store.notice).not.toMatch(/another tab/);
  });
});

/** localStorage that is full: setItem throws once the key holds a value, getItem keeps the old text. */
function fullStorage(old: string): Storage & { map: Map<string, string> } {
  const s = fakeStorage();
  s.map.set(LOCAL_KEY, old);
  s.setItem = () => { throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
  return s;
}

describe("local storage that is full (findings 11 and 71 together)", () => {
  const oldBlob = JSON.stringify({ [SLOT_KEYS[0]]: JSON.stringify({ ...emptyDoc(T0), rev: 1 }) });

  it("writes keep working from memory instead of reloading the old copy each step", async () => {
    const s = createSaveStore(localKv(fullStorage(oldBlob)));
    const l = await s.load();
    expect(l.state === "ok" && l.doc.rev).toBe(1);
    expect(await s.write(emptyDoc(T0), 1)).toEqual({ ok: true, rev: 2 });
    expect(await s.write(emptyDoc(T0), 2)).toEqual({ ok: true, rev: 3 });
    expect(await s.write(emptyDoc(T0), 3)).toEqual({ ok: true, rev: 4 });
  });

  it("IndexedDB failing mid-session: the seeded fallback is not replaced by the old local copy", async () => {
    quiet();
    const idb = breakable(memoryKv({ [SLOT_KEYS[0]]: JSON.stringify({ ...emptyDoc(T0), rev: 5 }) }));
    const s = createSaveStore(resilientKv(idb, (seed) => localKv(fullStorage(oldBlob), seed)));
    const l = await s.load();
    expect(l.state === "ok" && l.doc.rev).toBe(5);
    idb.on = true;
    expect(await s.write(emptyDoc(T0), 5)).toEqual({ ok: true, rev: 6 });
    expect(await s.write(emptyDoc(T0), 6)).toEqual({ ok: true, rev: 7 });
  });

  it("still takes another tab's newer copy when local storage did change", async () => {
    const storage = fakeStorage();
    const a = createSaveStore(localKv(storage));
    const b = createSaveStore(localKv(storage));
    await a.load();
    await b.load();
    expect(await a.write(emptyDoc(T0), 0)).toEqual({ ok: true, rev: 1 });
    expect(await a.write(emptyDoc(T0), 1)).toEqual({ ok: true, rev: 2 });
    expect(await b.write(emptyDoc(T0), 0)).toEqual({ ok: false, why: "stale" });
    expect(await b.write(emptyDoc(T0), 2)).toEqual({ ok: true, rev: 3 });
    const r = await a.load();
    expect(r.state === "ok" && r.doc.rev).toBe(3);
  });
});
