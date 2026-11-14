/**
 * The save store (contract `SaveStore`, brief 3.14): one document written to two slots in turn,
 * so a failed write cannot destroy the last good copy.
 *
 *   - A slot is empty, ok or corrupt. A corrupt slot is never treated as empty.
 *   - Unreadable bytes are copied to a backup key before anything replaces them. If that copy
 *     fails, the replace is refused ("backup-failed").
 *   - Backups are never overwritten: a new key each time, at most 8. Bytes already backed up are
 *     not copied twice.
 *   - `write` compares the stored rev with the rev the caller read. A tab that is behind gets
 *     "stale" and must reload; it never writes over the newer copy.
 */
import type { LoadResult, SaveDoc, SaveStore, WriteResult } from "../contracts";
import type { Kv, KvTx } from "./idb";
import { readDoc } from "./migrations";

export const SLOT_KEYS = ["rankzero.slot.0", "rankzero.slot.1"] as const;
export const BACKUP_PREFIX = "rankzero.backup.";
export const BACKUP_LIMIT = 8;

type SlotRead =
  | { state: "empty" }
  | { state: "ok"; doc: SaveDoc; warnings: string[] }
  | { state: "corrupt"; raw: unknown; why: string };

export function readSlot(raw: unknown): SlotRead {
  if (raw === undefined || raw === null) return { state: "empty" };
  if (typeof raw !== "string") return { state: "corrupt", raw, why: "not text" };
  const r = readDoc(raw);
  return r.ok ? { state: "ok", doc: r.doc, warnings: r.warnings } : { state: "corrupt", raw, why: r.why };
}

const same = (a: unknown, b: unknown): boolean => {
  if (typeof a === "string" || typeof b === "string") return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/** Copies `raw` to a fresh backup key and returns it, or the key that already holds the same
 *  bytes. Null when the copy failed or all 8 backup keys are taken. Never overwrites a key. */
export async function backupRaw(tx: KvTx, raw: unknown): Promise<string | null> {
  try {
    const keys = await tx.keys(BACKUP_PREFIX);
    for (const k of keys) if (same(await tx.get(k), raw)) return k;
    if (keys.length >= BACKUP_LIMIT) return null;
    let n = 0;
    for (const k of keys) n = Math.max(n, Number(k.slice(BACKUP_PREFIX.length)) + 1 || 0);
    const key = `${BACKUP_PREFIX}${n}`;
    if ((await tx.get(key)) !== undefined) return null;
    await tx.put(key, raw);
    return key;
  } catch (error) {
    console.warn("save: backup failed", error);
    return null;
  }
}

function best(reads: readonly SlotRead[]): { i: number; doc: SaveDoc; warnings: string[] } | null {
  let out: { i: number; doc: SaveDoc; warnings: string[] } | null = null;
  reads.forEach((r, i) => {
    if (r.state === "ok" && (out === null || r.doc.rev > out.doc.rev)) out = { i, doc: r.doc, warnings: r.warnings };
  });
  return out;
}

export function createSaveStore(kv: Kv): SaveStore {
  return {
    async load(): Promise<LoadResult> {
      return kv.atomic(async (tx) => {
        const reads = [readSlot(await tx.get(SLOT_KEYS[0])), readSlot(await tx.get(SLOT_KEYS[1]))];
        const top = best(reads);
        if (top) for (const w of top.warnings) console.warn(`save: ${w}`);
        let backupKey: string | null = null;
        let corrupt = false;
        for (const r of reads) {
          if (r.state !== "corrupt") continue;
          corrupt = true;
          console.warn(`save: a slot could not be read (${r.why}); its bytes are kept`);
          const k = await backupRaw(tx, r.raw);
          backupKey ??= k;
        }
        if (corrupt) return { state: "corrupt", backupKey, doc: top?.doc ?? null };
        if (top) return { state: "ok", doc: top.doc };
        return { state: "empty" };
      });
    },

    async write(doc: SaveDoc, expectedRev: number): Promise<WriteResult> {
      try {
        return await kv.atomic(async (tx): Promise<WriteResult> => {
          const raws = [await tx.get(SLOT_KEYS[0]), await tx.get(SLOT_KEYS[1])];
          const reads = raws.map(readSlot);
          const top = best(reads);
          const stored = top ? top.doc.rev : 0;
          if (stored !== expectedRev) return { ok: false, why: "stale" };
          const target = top ? 1 - top.i : reads[0]!.state === "corrupt" && reads[1]!.state === "empty" ? 1 : 0;
          const there = reads[target]!;
          if (there.state === "corrupt") {
            const k = await backupRaw(tx, raws[target]);
            if (k === null) return { ok: false, why: "backup-failed" };
          }
          const rev = expectedRev + 1;
          await tx.put(SLOT_KEYS[target]!, JSON.stringify({ ...doc, rev }));
          return { ok: true, rev };
        });
      } catch (error) {
        console.warn("save: write failed", error);
        return { ok: false, why: "io" };
      }
    },
  };
}

/** Asks the browser to keep the save. It needs a secure page: plain http on a LAN preview may
 *  refuse it or not offer it at all. Never throws; the answer is only logged. */
export async function requestPersist(nav: Navigator | undefined = (globalThis as { navigator?: Navigator }).navigator,
  secure: boolean = (globalThis as { isSecureContext?: boolean }).isSecureContext === true): Promise<boolean> {
  try {
    if (!secure || !nav?.storage || typeof nav.storage.persist !== "function") return false;
    if (typeof nav.storage.persisted === "function" && (await nav.storage.persisted())) return true;
    return await nav.storage.persist();
  } catch (error) {
    console.warn("save: persistent storage was not granted", error);
    return false;
  }
}
