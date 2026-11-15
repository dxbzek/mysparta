/**
 * A tiny key-value store on IndexedDB: one database, one object store, string keys. Every save
 * step runs inside ONE read-write transaction (`atomic`), so the rev check, the backup and the
 * write cannot interleave with another tab. Values are stored as they are given (the save text,
 * or the raw bytes of a damaged slot being backed up).
 *
 * The old build's storage is never opened: this file only names `rankzero.` databases and keys.
 */
export interface KvTx {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  /** Removes a key (used only to drop the oldest backup when all backup keys are taken). */
  del(key: string): Promise<void>;
  /** Keys that start with `prefix`, sorted. */
  keys(prefix: string): Promise<string[]>;
}
export interface Kv {
  atomic<T>(fn: (tx: KvTx) => Promise<T>): Promise<T>;
}

export const DB_NAME = "rankzero.save";
const STORE = "kv";

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });

export function openIdb(factory: IDBFactory = indexedDB, name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = factory.open(name, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB open failed"));
    r.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

export function idbKv(db: IDBDatabase): Kv {
  return {
    atomic<T>(fn: (tx: KvTx) => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        let t: IDBTransaction;
        try {
          t = db.transaction(STORE, "readwrite");
        } catch (error) {
          reject(error);
          return;
        }
        const store = t.objectStore(STORE);
        let value: T;
        let failed: unknown = null;
        const tx: KvTx = {
          get: (key) => req(store.get(key)),
          put: async (key, v) => {
            await req(store.put(v, key));
          },
          del: async (key) => {
            await req(store.delete(key));
          },
          keys: async (prefix) => {
            const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
            const all = await req(store.getAllKeys(range));
            return all.map(String).sort();
          },
        };
        t.oncomplete = () => (failed === null ? resolve(value) : reject(failed));
        t.onerror = () => reject(t.error ?? failed ?? new Error("IndexedDB transaction failed"));
        t.onabort = () => reject(t.error ?? failed ?? new Error("IndexedDB transaction aborted"));
        fn(tx).then(
          (v) => {
            value = v;
          },
          (error: unknown) => {
            failed = error;
            try {
              t.abort();
            } catch {
              reject(error);
            }
          },
        );
      });
    },
  };
}

/** An in-memory store with the same atomic shape, for tests and as a last resort when the
 *  browser refuses IndexedDB (private mode in some browsers). `failPut` plants a write fault. */
export function memoryKv(init: Record<string, unknown> = {}): Kv & { data: Map<string, unknown>; failPut: ((key: string) => boolean) | null } {
  const data = new Map<string, unknown>(Object.entries(init));
  let chain: Promise<unknown> = Promise.resolve();
  const kv = {
    data,
    failPut: null as ((key: string) => boolean) | null,
    atomic<T>(fn: (tx: KvTx) => Promise<T>): Promise<T> {
      const run = async (): Promise<T> => {
        const staged = new Map<string, unknown>();
        const tx: KvTx = {
          get: async (key) => (staged.has(key) ? staged.get(key) : data.get(key)),
          put: async (key, v) => {
            if (kv.failPut?.(key)) throw new Error(`planted write fault on ${key}`);
            staged.set(key, v);
          },
          del: async (key) => {
            staged.set(key, undefined);
          },
          keys: async (prefix) => [...new Set([...data.keys(), ...staged.keys()])]
            .filter((k) => k.startsWith(prefix) && (staged.has(k) ? staged.get(k) : data.get(k)) !== undefined).sort(),
        };
        const out = await fn(tx);
        for (const [k, v] of staged) {                     // all or nothing, like a transaction
          if (v === undefined) data.delete(k);
          else data.set(k, v);
        }
        return out;
      };
      const p = chain.then(run, run);
      chain = p.catch(() => undefined);
      return p;
    },
  };
  return kv;
}

/**
 * A memory store mirrored to localStorage under one key, for browsers that open IndexedDB but
 * refuse its writes (an embedded frame on iOS, some in-app browsers). Every access is guarded:
 * if localStorage throws too, it is a plain memory store for this session.
 *
 * `seed` is what this session already knows (the values read from or written to IndexedDB before
 * it failed). It wins over what localStorage holds, so the first write after a switch passes the
 * rev check instead of finding an empty store. Each transaction looks at localStorage first: when
 * its text differs from the text this session last read or wrote, another tab wrote it, and that
 * copy is taken, so a second tab in the same mode never writes over the first tab's newer copy
 * unseen. When a write did not reach localStorage (full or blocked), the text there is still the
 * one this session saw, so memory (newer) is kept and the session plays on from memory.
 */
export const LOCAL_KEY = "rankzero.kv";
export function localKv(storage: Storage | undefined = (globalThis as { localStorage?: Storage }).localStorage,
  seed?: ReadonlyMap<string, unknown>): Kv {
  /** The localStorage text as this session last saw it (read, or written successfully). */
  let lastRaw: string | null = null;
  const rawNow = (): string | null => {
    try {
      return storage?.getItem(LOCAL_KEY) ?? null;
    } catch {
      return null;
    }
  };
  const parse = (raw: string | null): Record<string, unknown> | null => {
    try {
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const persist = (data: Map<string, unknown>): void => {
    try {
      const text = JSON.stringify(Object.fromEntries(data));
      storage?.setItem(LOCAL_KEY, text);
      lastRaw = text;
    } catch {
      /* storage full or blocked: the session still plays from memory */
    }
  };
  lastRaw = rawNow();
  const mem = memoryKv(parse(lastRaw) ?? {});
  if (seed && seed.size > 0) {
    for (const [k, v] of seed) {
      if (v === undefined) mem.data.delete(k);
      else mem.data.set(k, v);
    }
    persist(mem.data);
  }
  return {
    atomic<T>(fn: (tx: KvTx) => Promise<T>): Promise<T> {
      return mem.atomic(async (tx) => {
        // Inside the chain, before any read: take what another tab may have written since. Text
        // this session already saw is not news (a write of ours that did not fit leaves it there).
        const raw = rawNow();
        const now = raw !== lastRaw ? parse(raw) : null;
        lastRaw = raw;
        if (now) {
          mem.data.clear();
          for (const [k, v] of Object.entries(now)) mem.data.set(k, v);
        }
        return fn(tx);
      }).then((out) => {
        persist(mem.data);
        return out;
      });
    },
  };
}

/** Thrown when the save store failed before anything was read from it and the fallback is empty:
 *  the save may still be in IndexedDB, so "empty" would be a lie. The app shows a retry screen. */
export class StorageUnsureError extends Error {
  constructor(readonly cause: unknown) {
    super("The save could not be opened, and nothing was read from it yet.");
    this.name = "StorageUnsureError";
  }
}

/**
 * Uses `primary` until one of its transactions fails. Then it reopens the primary once (`reopen`,
 * when given) and runs the step again there; if that fails too, it moves to `fallback(seed)` for
 * the rest of the session and runs the same step there. `seed` holds every value this session
 * read from or wrote to the primary, so the fallback starts from the real save, not from empty.
 * Save steps return their refusals (a stale rev, a failed backup) as values and never throw, so
 * any throw here is the storage itself.
 *
 * If the primary never completed a step and the fallback holds no save, the switching step throws
 * `StorageUnsureError` once (the screen offers a retry), and later steps use the fallback.
 */
export function resilientKv(primary: Kv, fallback: (seed: ReadonlyMap<string, unknown>) => Kv,
  isStorageError: (e: unknown) => boolean = () => true, reopen?: () => Promise<Kv>): Kv {
  let current: Kv = primary;
  let switched = false;
  let reopened = false;
  let primaryOk = false;
  const seen = new Map<string, unknown>();
  const watched = <T>(kv: Kv, fn: (tx: KvTx) => Promise<T>): Promise<T> => {
    const local = new Map<string, unknown>();
    return kv.atomic((tx) => fn({
      get: async (key) => {
        const v = await tx.get(key);
        if (!local.has(key)) local.set(key, v);
        return v;
      },
      put: async (key, v) => {
        await tx.put(key, v);
        local.set(key, v);
      },
      del: async (key) => {
        await tx.del(key);
        local.set(key, undefined);
      },
      keys: (prefix) => tx.keys(prefix),
    })).then((out) => {
      for (const [k, v] of local) seen.set(k, v);       // only a completed step counts
      primaryOk = true;
      return out;
    });
  };
  return {
    async atomic<T>(fn: (tx: KvTx) => Promise<T>): Promise<T> {
      if (switched) return current.atomic(fn);
      try {
        return await watched(current, fn);
      } catch (error) {
        if (!isStorageError(error)) throw error;
        if (reopen && !reopened) {
          reopened = true;
          try {
            current = await reopen();
            return await watched(current, fn);
          } catch (again) {
            if (!isStorageError(again)) throw again;
          }
        }
        console.warn("save: IndexedDB refused a write here; keeping the save in local storage instead", error);
        switched = true;
        current = fallback(seen);
        if (!primaryOk) {
          const has = await current.atomic((tx) => tx.keys("rankzero.slot.")).catch(() => [] as string[]);
          if (has.length === 0) throw new StorageUnsureError(error);
        }
        return current.atomic(fn);
      }
    },
  };
}
