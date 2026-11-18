/**
 * The migration table. Each entry lifts a document from version N to N + 1. Version 1 is the
 * first schema of this build; version 2 (CONTRACT_REV 4) adds `settings.isVip`; version 3
 * (CONTRACT_REV 5) carries an earlier build's kit (`ScrapperRecord.base`, see `pinKits`);
 * version 4 (CONTRACT_REV 6, content v3) has energy in place of the daily bout cap and six stats
 * (see `toEnergyAndSixStats`).
 *
 * A document from a NEWER build (a higher version than this code knows) is not understood: it is
 * reported as corrupt, so its bytes are kept, never replaced as if the save were empty.
 */
import { ENERGY_MAX, legacyBase, legacyKit, sixStatsOf } from "@rankzero/core";
import type { KitBase, ScrapperRecord, StatBlock } from "@rankzero/core";
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
  /** 3 to 4: a full energy bar for every scrapper, and every kit carried with six stats. */
  3: (doc) => toEnergyAndSixStats(doc),
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A save stores only a scrapper's seed and picks; its kit is walked again under the tables of the
 * build that reads it. The round-2 sim changed the start perks, the card offers and the rerolls,
 * so an old save's picks walked into a different kit (items gone, others come from nowhere). The
 * kit the earlier build really gave it is in its newest stored bout: that bout's snapshot of it
 * (its level, perks and stats). Each scrapper, active or retired, whose newest bout's snapshot
 * differs from what the schema-3 build's walk gives at that level gets it as its `base`; level-ups
 * taken after that bout walk on from it. A scrapper with no stored bout keeps its walk
 * (docs/RULES.md, "Old saves"). The walk compared with is the schema-3 build's own (`legacyKit`,
 * frozen in the core since content v3), so this step reads a save as that build did.
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
      let now: ReturnType<typeof legacyKit>;
      try { now = legacyKit(r.seed, (r.picks as ScrapperRecord["picks"]).slice(0, picks)); } catch { return r; }
      if (JSON.stringify(now.perks) === JSON.stringify(snap.perks) && JSON.stringify(now.stats) === JSON.stringify(snap.stats)) return r;
      // the start perks: the round-2 build's two when the snapshot opens with them, else one
      const perks = snap.perks as unknown[];
      const start = legacyKit(r.seed, []).perks;
      const starts = perks[0] === start[0] && perks[1] === start[1] ? 2 : 1;
      return { ...r, base: { picks, starts, perks: [...perks], stats: snap.stats } };
    }
    return r;
  };
  return { ...doc, fighters: Array.isArray(doc.fighters) ? doc.fighters.map(pin) : doc.fighters,
    retired: Array.isArray(doc.retired) ? doc.retired.map(pin) : doc.retired };
}


/**
 * Schema 3 to 4 (content v3). Energy takes the place of the daily bout cap: every scrapper gets a
 * full bar (`energy` ENERGY_MAX; `energyAt` 0, so the first bout starts the refill timer), and
 * `day` and `boutsUsed` go. Six stats: the schema-3 build walked a kit over four stats, and today's
 * Route draws from six, so the same picks would walk into another kit. Each scrapper, active or
 * retired, gets its whole kit as that build walked it (`legacyBase`, from its carried kit when it
 * had one) as its `base`, its four stats kept and Toughness and Precision added at 3 points each
 * (`sixStatsOf`, docs/RULES.md "Old saves"). Stored bouts keep their snapshots, with Toughness and
 * Precision at 0 (those fights had none), and their `before` holds energy in place of bouts used.
 * A record this step cannot read is left as it is, for the check to report.
 */
export function toEnergyAndSixStats(doc: Obj): Obj {
  const lift = (r: unknown): unknown => {
    if (!isObj(r) || typeof r.seed !== "number" || !Array.isArray(r.picks)) return r;
    const { day: _day, boutsUsed: _used, ...rest } = r;
    void _day;
    void _used;
    const out: Obj = { ...rest, energy: ENERGY_MAX, energyAt: 0 };
    const picks = (r.picks as unknown[]).filter((p): p is "L" | "R" => p === "L" || p === "R");
    if (picks.length !== r.picks.length) return out;
    const old = isObj(r.base) && isObj(r.base.stats) && Array.isArray(r.base.perks) && typeof r.base.picks === "number"
      && typeof r.base.starts === "number" ? (r.base as unknown as KitBase) : undefined;
    try {
      out.base = legacyBase(r.seed, picks, old);
    } catch {
      return out;
    }
    return out;
  };
  const snap = (s: unknown): unknown => {
    if (!isObj(s) || !isObj(s.stats) || !isObj(s.stats.points) || !isObj(s.stats.mult)) return s;
    const p = s.stats.points;
    const m = s.stats.mult;
    if (typeof p.toughness === "number" && typeof p.precision === "number") return s;
    // a stored bout fought before content v3 had no Toughness or Precision: 0, not the carried 3
    const six = sixStatsOf(s.stats as unknown as StatBlock);
    return { ...s, stats: { points: { ...six.points, toughness: 0, precision: 0 }, mult: { ...m, toughness: 100, precision: 100 } } };
  };
  const row = (h: unknown): unknown => {
    if (!isObj(h)) return h;
    const before = isObj(h.before) ? h.before : {};
    return { ...h, snapshotA: snap(h.snapshotA), snapshotB: snap(h.snapshotB),
      before: { xp: before.xp, energy: ENERGY_MAX, energyAt: 0 } };
  };
  return { ...doc,
    fighters: Array.isArray(doc.fighters) ? doc.fighters.map(lift) : doc.fighters,
    retired: Array.isArray(doc.retired) ? doc.retired.map(lift) : doc.retired,
    history: Array.isArray(doc.history) ? doc.history.map(row) : doc.history };
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
