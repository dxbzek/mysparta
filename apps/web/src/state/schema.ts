/**
 * The save document (contract `SaveDoc`): defaults, the validator every load runs, and the
 * history limits. A document that fails the shape check is CORRUPT, never empty. Unknown content
 * ids (a perk the game no longer has) warn and are dropped: they never throw.
 */
import { LOOK_SPACE, isPerkId } from "@rankzero/core";
import type { BoutLog, FighterSnapshot, Look, PerkId, ScrapperRecord } from "@rankzero/core";
import type { BoutRecord, SaveDoc, Settings } from "../contracts";

export const SCHEMA_VERSION = 1 as const;
/** Scrappers on one save. A fourth needs one retired first. */
export const SLOT_LIMIT = 3;
/** History: the last 50 bouts keep their logs, the last 200 are kept as summaries. */
export const HISTORY_LOGS = 50;
export const HISTORY_ROWS = 200;

export const DEFAULT_SETTINGS: Settings = { sound: true, speed: 1, reducedMotion: "system", liveLog: true };

export function emptyDoc(now: number): SaveDoc {
  return { schemaVersion: SCHEMA_VERSION, rev: 0, updatedAt: now, settings: { ...DEFAULT_SETTINGS }, activeId: null,
    fighters: [], retired: [], history: [] };
}

/** Newest first. Logs are dropped after the 50th bout, rows after the 200th. */
export function trimHistory(history: readonly BoutRecord[]): BoutRecord[] {
  return history.slice(0, HISTORY_ROWS).map((b, i) => {
    if (i < HISTORY_LOGS || b.log === undefined) return b;
    const { log: _drop, ...rest } = b;
    void _drop;
    return rest;
  });
}

// ------------------------------------------------------------------------------------------ checks

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isNat = (v: unknown): v is number => isInt(v) && v >= 0;
const isStr = (v: unknown): v is string => typeof v === "string";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: unknown): v is string => isStr(v) && DAY.test(v);

class Bad extends Error {}
const need = (ok: boolean, what: string): void => {
  if (!ok) throw new Bad(what);
};

function checkSettings(v: unknown, warn: (w: string) => void): Settings {
  if (!isObj(v)) {
    warn("settings missing: defaults used");
    return { ...DEFAULT_SETTINGS };
  }
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (typeof v.sound === "boolean") s.sound = v.sound;
  if (v.speed === 1 || v.speed === 2) s.speed = v.speed;
  if (v.reducedMotion === "system" || v.reducedMotion === "on" || v.reducedMotion === "off") s.reducedMotion = v.reducedMotion;
  if (typeof v.liveLog === "boolean") s.liveLog = v.liveLog;
  return s;
}

function checkRecord(v: unknown, where: string): ScrapperRecord {
  need(isObj(v), `${where}: not an object`);
  const r = v as Obj;
  need(isStr(r.id) && r.id.length > 0, `${where}: id`);
  need(isStr(r.name) && r.name.length > 0, `${where}: name`);
  need(isInt(r.seed), `${where}: seed`);
  need(isInt(r.lookSalt) && isInt(r.colourSalt), `${where}: salts`);
  need(Array.isArray(r.picks) && (r.picks as unknown[]).every((p) => p === "L" || p === "R"), `${where}: picks`);
  need(isNat(r.xp), `${where}: xp`);
  need(isDay(r.createdDay) && isDay(r.day), `${where}: days`);
  need(isNat(r.boutsUsed) && isNat(r.lifetimeBouts), `${where}: counts`);
  return { id: r.id as string, name: r.name as string, seed: r.seed as number, lookSalt: r.lookSalt as number,
    colourSalt: r.colourSalt as number, picks: [...(r.picks as ("L" | "R")[])], xp: r.xp as number,
    createdDay: r.createdDay as string, day: r.day as string, boutsUsed: r.boutsUsed as number,
    lifetimeBouts: r.lifetimeBouts as number };
}

function checkLook(v: unknown): Look | null {
  if (!isObj(v)) return null;
  const out: Record<string, number> = {};
  for (const k of Object.keys(LOOK_SPACE) as (keyof typeof LOOK_SPACE)[]) {
    const n = v[k];
    if (!isNat(n)) return null;
    out[k] = n % LOOK_SPACE[k];
  }
  return out as unknown as Look;
}

/** A snapshot from a stored bout. Unknown perk ids warn and are dropped. Null when unreadable. */
function checkSnapshot(v: unknown, warn: (w: string) => void): { snap: FighterSnapshot; dropped: number } | null {
  if (!isObj(v)) return null;
  const look = checkLook(v.look);
  const stats = v.stats;
  if (!isStr(v.id) || !isStr(v.name) || !isNat(v.level) || look === null || !isObj(stats)) return null;
  const pts = stats.points;
  const mult = stats.mult;
  const keys = ["health", "strength", "agility", "speed"] as const;
  if (!isObj(pts) || !isObj(mult) || !keys.every((k) => isInt(pts[k]) && isInt(mult[k]))) return null;
  const raw = Array.isArray(v.perks) ? (v.perks as unknown[]) : [];
  const perks: PerkId[] = [];
  let dropped = 0;
  for (const p of raw) {
    if (isStr(p) && isPerkId(p)) perks.push(p);
    else {
      dropped++;
      warn(`unknown perk id ${JSON.stringify(p)} in a stored bout: left out`);
    }
  }
  const points = { health: pts.health as number, strength: pts.strength as number, agility: pts.agility as number, speed: pts.speed as number };
  const mults = { health: mult.health as number, strength: mult.strength as number, agility: mult.agility as number, speed: mult.speed as number };
  return { snap: { id: v.id, name: v.name, look, level: v.level, stats: { points, mult: mults }, perks, rulesVersion: 1 }, dropped };
}

function checkBout(v: unknown, warn: (w: string) => void): BoutRecord | null {
  if (!isObj(v)) return null;
  const a = checkSnapshot(v.snapshotA, warn);
  const b = checkSnapshot(v.snapshotB, warn);
  const res = v.result;
  const before = v.before;
  if (a === null || b === null || !isStr(v.id) || !isNat(v.at) || !isInt(v.seed) || !isStr(v.fighterId)) return null;
  if (!isObj(res) || (res.winner !== "a" && res.winner !== "b") || (res.reason !== "ko" && res.reason !== "cap")) return null;
  if (!isObj(before) || !isNat(before.xp) || !isNat(before.boutsUsed)) return null;
  if (v.xp !== 1 && v.xp !== 2) return null;
  const hp = isObj(res.hpPct) ? res.hpPct : {};
  const rec: BoutRecord = {
    id: v.id, at: v.at, seed: v.seed, rulesVersion: 1, logVersion: v.logVersion === 2 ? 2 : 1, snapshotA: a.snap, snapshotB: b.snap,
    result: { winner: res.winner, reason: res.reason, turns: isNat(res.turns) ? res.turns : 0,
      hpPct: { a: isNat(hp.a) ? hp.a : 0, b: isNat(hp.b) ? hp.b : 0 } },
    role: v.role === "defender" ? "defender" : "attacker", fighterId: v.fighterId, xp: v.xp,
    lineId: isNat(v.lineId) ? v.lineId : 0, watched: v.watched === true,
    before: { xp: before.xp, boutsUsed: before.boutsUsed },
  };
  // A log that names a perk we dropped cannot be played safely: keep the row, drop the log.
  // So is a log written before content v2 (log version 1: the door, not the shields).
  const log = v.log;
  if (isObj(log) && Array.isArray(log.steps) && isObj(log.init) && isObj(log.result) && a.dropped + b.dropped === 0
    && log.logVersion === 2) {
    rec.log = log as unknown as BoutLog;
  } else if (log !== undefined) {
    warn(`bout ${v.id}: its log could not be kept`);
  }
  return rec;
}

export type CheckResult = { ok: true; doc: SaveDoc; warnings: string[] } | { ok: false; why: string };

/** Checks a parsed document of the CURRENT schema version. Run migrations first. */
export function checkDoc(raw: unknown): CheckResult {
  const warnings: string[] = [];
  const warn = (w: string): void => {
    warnings.push(w);
  };
  try {
    need(isObj(raw), "not an object");
    const d = raw as Obj;
    need(d.schemaVersion === SCHEMA_VERSION, "schema version");
    need(isNat(d.rev), "rev");
    need(isNat(d.updatedAt), "updatedAt");
    need(Array.isArray(d.fighters) && Array.isArray(d.retired) && Array.isArray(d.history), "lists");
    const fighters = (d.fighters as unknown[]).map((f, i) => checkRecord(f, `fighters[${i}]`));
    const retired = (d.retired as unknown[]).map((f, i) => checkRecord(f, `retired[${i}]`));
    const ids = new Set<string>();
    for (const f of [...fighters, ...retired]) {
      need(!ids.has(f.id), `duplicate scrapper id ${f.id}`);
      ids.add(f.id);
    }
    const history: BoutRecord[] = [];
    for (const h of d.history as unknown[]) {
      const b = checkBout(h, warn);
      if (b) history.push(b);
      else warn("an unreadable bout row was left out");
    }
    let activeId = isStr(d.activeId) && fighters.some((f) => f.id === d.activeId) ? (d.activeId as string) : null;
    if (activeId === null && fighters.length > 0) activeId = fighters[0]!.id;
    const doc: SaveDoc = { schemaVersion: SCHEMA_VERSION, rev: d.rev as number, updatedAt: d.updatedAt as number,
      settings: checkSettings(d.settings, warn), activeId, fighters, retired, history: trimHistory(history) };
    return { ok: true, doc, warnings };
  } catch (error) {
    if (error instanceof Bad) return { ok: false, why: error.message };
    return { ok: false, why: String(error) };
  }
}
