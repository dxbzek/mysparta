/**
 * The migration table. Each entry lifts a document from version N to N + 1. Version 1 is the
 * first schema of this build; version 2 (CONTRACT_REV 4) adds `settings.isVip`; version 3
 * (CONTRACT_REV 5) carries an earlier build's kit (`ScrapperRecord.base`, see `pinKits`).
 *
 * A document from a NEWER build (a higher version than this code knows) is not understood: it is
 * reported as corrupt, so its bytes are kept, never replaced as if the save were empty.
 */
import { snapshotOf, sheetOf } from "@rankzero/core";
import type { ScrapperRecord } from "@rankzero/core";
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
  /** 2 to 3: every scrapper keeps the kit the build that wrote the save gave it (`pinKits`). */
  2: (doc) => pinKits(doc),
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A save stores only a scrapper's seed and picks; its kit is walked again under the tables of the
 * build that reads it. The round-2 sim changed the start perks, the card offers and the rerolls,
 * so an old save's picks walked into a different kit (items gone, others come from nowhere). The
 * kit the earlier build really gave it is in its newest stored bout: that bout's snapshot of it
 * (its level, perks and stats). Each scrapper, active or retired, whose newest bout's snapshot
 * differs from what today's walk gives at that level gets it as its `base`; level-ups taken after
 * that bout walk on from it under today's tables. A scrapper with no stored bout keeps today's walk
 * (docs/RULES.md, "Old saves").
 */
export function pinKits(doc: Obj): Obj {
  const history = Array.isArray(doc.history) ? (doc.history as unknown[]).filter(isObj) : [];
  const pin = (r: unknown): unknown => {
    if (!isObj(r) || r.base !== undefined || typeof r.id !== "string" || !Array.isArray(r.picks) || typeof r.seed !== "number") return r;
    const mine = history.filter((h) => h.fighterId === r.id && typeof h.at === "number")
      .sort((p, q) => (q.at as number) - (p.at as number));
    for (const h of mine) {
      const snap = h.role === "defender" ? h.snapshotB : h.snapshotA;
      if (!isObj(snap) || snap.id !== r.id || typeof snap.level !== "number" || !Array.isArray(snap.perks) || !isObj(snap.stats)) continue;
      const picks = snap.level - 1;
      if (!Number.isInteger(picks) || picks < 0 || picks > r.picks.length) continue;
      const rec = { ...(r as unknown as ScrapperRecord), picks: (r.picks as ScrapperRecord["picks"]).slice(0, picks) };
      let now: ReturnType<typeof snapshotOf>;
      try { now = snapshotOf(rec); } catch { return r; }
      if (JSON.stringify(now.perks) === JSON.stringify(snap.perks) && JSON.stringify(now.stats) === JSON.stringify(snap.stats)) return r;
      // the start perks: today's two when the snapshot opens with them (a round-2 build), else one
      const perks = snap.perks as unknown[];
      const sheet = sheetOf(rec);
      const starts = perks[0] === sheet.startPerk && perks[1] === sheet.startSkill ? 2 : 1;
      return { ...r, base: { picks, starts, perks: [...perks], stats: snap.stats } };
    }
    return r;
  };
  return { ...doc, fighters: Array.isArray(doc.fighters) ? doc.fighters.map(pin) : doc.fighters,
    retired: Array.isArray(doc.retired) ? doc.retired.map(pin) : doc.retired };
}


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
