/**
 * The migration table. Each entry lifts a document from version N to N + 1. Version 1 is the
 * first schema of this build; version 2 (CONTRACT_REV 4) adds `settings.isVip`.
 *
 * A document from a NEWER build (a higher version than this code knows) is not understood: it is
 * reported as corrupt, so its bytes are kept, never replaced as if the save were empty.
 */
import { SCHEMA_VERSION, checkDoc } from "./schema";
import type { CheckResult } from "./schema";

export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** `MIGRATIONS[n]` turns a version-n document into a version n + 1 one. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /** 1 to 2: VIP did not exist, so nobody had it. Settings that are not an object are left for
   *  the check to replace with the defaults. */
  1: (doc) => {
    const s = doc.settings;
    if (typeof s !== "object" || s === null || Array.isArray(s)) return doc;
    return { ...doc, settings: { ...(s as Record<string, unknown>), isVip: false } };
  },
};

export function migrate(raw: unknown, table: Readonly<Record<number, Migration>> = MIGRATIONS, target: number = SCHEMA_VERSION):
  { ok: true; doc: Record<string, unknown> } | { ok: false; why: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, why: "not an object" };
  let doc = raw as Record<string, unknown>;
  let v = doc.schemaVersion;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return { ok: false, why: "no schema version" };
  if (v > target) return { ok: false, why: `schema version ${v} is newer than this build (${target})` };
  while (v < target) {
    const step = table[v];
    if (!step) return { ok: false, why: `no migration from version ${v}` };
    doc = { ...step(doc), schemaVersion: v + 1 };
    v += 1;
  }
  return { ok: true, doc };
}

/** Text from a slot to a checked document. */
export function readDoc(text: string): CheckResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, why: "not JSON" };
  }
  const m = migrate(parsed);
  if (!m.ok) return m;
  return checkDoc(m.doc);
}
