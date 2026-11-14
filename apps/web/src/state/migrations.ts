/**
 * The migration table. Each entry lifts a document from version N to N + 1. Version 1 is the
 * first schema of this build, so the table is empty today; the runner and its tests are here so
 * the next schema change is one entry, not a new mechanism.
 *
 * A document from a NEWER build (a higher version than this code knows) is not understood: it is
 * reported as corrupt, so its bytes are kept, never replaced as if the save were empty.
 */
import { SCHEMA_VERSION, checkDoc } from "./schema";
import type { CheckResult } from "./schema";

export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** `MIGRATIONS[n]` turns a version-n document into a version n + 1 one. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

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
