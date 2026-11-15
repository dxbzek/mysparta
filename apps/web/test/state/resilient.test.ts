import { describe, expect, it } from "vitest";
import { localKv, memoryKv, resilientKv, LOCAL_KEY, type Kv } from "../../src/state/idb";
import { createSaveStore } from "../../src/state/slots";

/** A store that opens but refuses every transaction, like IndexedDB in an embedded frame on iOS. */
const refusing: Kv = { atomic: () => Promise.reject(Object.assign(new Error("The transaction is inactive"), { name: "TransactionInactiveError" })) };

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

describe("a browser that refuses IndexedDB writes", () => {
  it("still saves, into local storage, and reads it back after a reload", async () => {
    const storage = fakeStorage();
    const saves = createSaveStore(resilientKv(refusing, () => localKv(storage)));
    expect(await saves.load()).toEqual({ state: "empty" });
    const doc = { schemaVersion: 1, rev: 0, updatedAt: 1, settings: {}, fighters: [], retired: [], history: [] } as never;
    expect(await saves.write(doc, 0)).toEqual({ ok: true, rev: 1 });
    expect(storage.map.has(LOCAL_KEY)).toBe(true);
    const again = createSaveStore(resilientKv(refusing, () => localKv(storage)));
    const loaded = await again.load();
    expect(loaded.state).toBe("ok");
  });

  it("control: without the fallback the same write fails", async () => {
    const saves = createSaveStore(refusing);
    const doc = { schemaVersion: 1, rev: 0, updatedAt: 1, settings: {}, fighters: [], retired: [], history: [] } as never;
    expect(await saves.write(doc, 0)).toEqual({ ok: false, why: "io" });
  });

  it("keeps playing from memory when local storage throws too", async () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    const saves = createSaveStore(resilientKv(refusing, () => localKv(broken)));
    const doc = { schemaVersion: 1, rev: 0, updatedAt: 1, settings: {}, fighters: [], retired: [], history: [] } as never;
    expect(await saves.write(doc, 0)).toEqual({ ok: true, rev: 1 });
    void memoryKv;
  });
});
