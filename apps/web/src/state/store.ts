/**
 * The game store: the one in-memory copy of the save, and the only path to the save store.
 * Every change goes through `commit`, one at a time. A commit reads the current document,
 * applies a pure change, and writes it with the rev it read. If another tab wrote first
 * ("stale"), the store reloads the newer copy and applies the change once more to THAT copy,
 * so the change's own checks see the other tab's data and nothing is written over it.
 */
import type { LoadResult, SaveDoc, SaveStore } from "../contracts";
import { emptyDoc } from "./schema";

export type StoreStatus =
  | { kind: "loading" }
  | { kind: "ready" }
  /** Neither slot could be read and there is no good copy. The bytes are in `backupKey`. */
  | { kind: "unreadable"; backupKey: string | null }
  | { kind: "failed"; message: string };

export class SaveError extends Error {
  constructor(readonly why: "backup-failed" | "io" | "stale") {
    super(why === "backup-failed" ? "The damaged save could not be backed up, so nothing was written."
      : why === "stale" ? "This save changed in another tab." : "The save could not be written.");
  }
}

/** A change: give back the new document and a value, or `null` doc to write nothing. */
export type Change<T> = (doc: SaveDoc) => { doc: SaveDoc | null; value: T };

export interface GameStore {
  readonly doc: SaveDoc;
  readonly status: StoreStatus;
  /** One line for a toast: a damaged copy was kept, another tab changed the save. */
  readonly notice: string | null;
  subscribe(fn: () => void): () => void;
  load(): Promise<LoadResult>;
  commit<T>(change: Change<T>): Promise<T>;
  /** Re-reads the save (another tab wrote). */
  reload(): Promise<void>;
  clearNotice(): void;
}

export function createGameStore(saves: SaveStore, now: () => number, onWrite?: (rev: number) => void): GameStore {
  let doc: SaveDoc = emptyDoc(now());
  let status: StoreStatus = { kind: "loading" };
  let notice: string | null = null;
  const subs = new Set<() => void>();
  const emit = (): void => {
    for (const fn of subs) fn();
  };
  let queue: Promise<unknown> = Promise.resolve();

  const apply = (r: LoadResult): void => {
    if (r.state === "empty") {
      doc = emptyDoc(now());
      status = { kind: "ready" };
    } else if (r.state === "ok") {
      doc = r.doc;
      status = { kind: "ready" };
    } else if (r.doc) {
      doc = r.doc;
      status = { kind: "ready" };
      notice = "One copy of your save was damaged. The good copy is loaded and the damaged one was kept.";
    } else {
      doc = emptyDoc(now());
      status = { kind: "unreadable", backupKey: r.backupKey };
    }
  };

  const store: GameStore = {
    get doc() { return doc; },
    get status() { return status; },
    get notice() { return notice; },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    async load() {
      try {
        const r = await saves.load();
        apply(r);
        emit();
        return r;
      } catch (error) {
        status = { kind: "failed", message: String(error) };
        emit();
        throw error;
      }
    },
    async reload() {
      const r = await saves.load();
      if (r.state === "ok" || (r.state === "corrupt" && r.doc)) {
        const next = r.doc!;
        if (next.rev !== doc.rev) {
          doc = next;
          status = { kind: "ready" };
          emit();
        }
      }
    },
    clearNotice() {
      notice = null;
      emit();
    },
    commit<T>(change: Change<T>): Promise<T> {
      const run = async (): Promise<T> => {
        for (let attempt = 0; attempt < 2; attempt++) {
          const { doc: next, value } = change(doc);
          if (next === null) return value;
          const stamped: SaveDoc = { ...next, updatedAt: now() };
          const w = await saves.write(stamped, doc.rev);
          if (w.ok) {
            doc = { ...stamped, rev: w.rev };
            status = { kind: "ready" };
            emit();
            onWrite?.(w.rev);
            return value;
          }
          if (w.why !== "stale") throw new SaveError(w.why);
          // Another tab is ahead: take its copy, then try the change once more on it.
          const r = await saves.load();
          if (r.state === "ok" || (r.state === "corrupt" && r.doc)) doc = r.doc!;
          notice = "This save changed in another tab. The newer copy is loaded.";
          emit();
        }
        throw new SaveError("stale");
      };
      const p = queue.then(run, run);
      queue = p.catch(() => undefined);
      return p;
    },
  };
  return store;
}
