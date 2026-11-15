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
          keys: async (prefix) => [...new Set([...data.keys(), ...staged.keys()])].filter((k) => k.startsWith(prefix)).sort(),
        };
        const out = await fn(tx);
        for (const [k, v] of staged) data.set(k, v);       // all or nothing, like a transaction
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
 */
export const LOCAL_KEY = "rankzero.kv";
export function localKv(storage: Storage | undefined = (globalThis as { localStorage?: Storage }).localStorage): Kv {
  let init: Record<string, unknown> = {};
  try {
    const raw = storage?.getItem(LOCAL_KEY);
    if (raw) init = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    init = {};
  }
  const mem = memoryKv(init);
  return {
    atomic<T>(fn: (tx: KvTx) => Promise<T>): Promise<T> {
      return mem.atomic(fn).then((out) => {
        try {
          storage?.setItem(LOCAL_KEY, JSON.stringify(Object.fromEntries(mem.data)));
        } catch {
          /* storage full or blocked: the session still plays from memory */
        }
        return out;
      });
    },
  };
}

/**
 * Uses `primary` until one of its transactions fails, then moves to `fallback()` for the rest of
 * the session and runs the same step there. Save steps return their refusals (a stale rev, a
 * failed backup) as values and never throw, so any throw here is the storage itself.
 */
export function resilientKv(primary: Kv, fallback: () => Kv, isStorageError: (e: unknown) => boolean = () => true): Kv {
  let current: Kv = primary;
  let switched = false;
  return {
    async atomic<T>(fn: (tx: KvTx) => Promise<T>): Promise<T> {
      try {
        return await current.atomic(fn);
      } catch (error) {
        if (switched || !isStorageError(error)) throw error;
        console.warn("save: IndexedDB refused a write here; keeping the save in local storage instead", error);
        switched = true;
        current = fallback();
        return current.atomic(fn);
      }
    },
  };
}
