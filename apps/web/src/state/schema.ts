/**
 * The save document (contract `SaveDoc`): defaults, the validator every load runs, and the
 * history limits. A document that fails the shape check is CORRUPT, never empty. Unknown content
 * ids (a perk the game no longer has) warn and are dropped: they never throw.
 */
import { GEAR_SLOTS, LOOK_SPACE, isCompanionId, isGearId, isPerkId, isShieldId, isTalentId, isWeaponId } from "@rankzero/core";
import type { StatKey, TalentId, TalentPicks, TalentRanks } from "@rankzero/core";
import type { BoutLog, CompanionId, FighterSnapshot, GearId, GearSlot, KitBase, Loadout, Look, PerkId, ScrapperRecord, StatBlock,
  WeaponId } from "@rankzero/core";
import type { BoutRecord, SaveDoc, Settings } from "../contracts";

/** 2 since CONTRACT_REV 4: `settings.isVip` (migration 1 to 2 in migrations.ts). 3 since
 *  CONTRACT_REV 5: a scrapper's carried kit, `ScrapperRecord.base` (migration 2 to 3). 4 since
 *  CONTRACT_REV 7: energy in place of the daily bout cap, six stats (migration 3 to 4). 5 since
 *  CONTRACT_REV 8: the loadout and body equipment (`ScrapperRecord.loadout`, `gearFrom`; migration
 *  4 to 5). 6 since CONTRACT_REV 9: the talent tree (`ScrapperRecord.talents`, `FighterSnapshot.talents`;
 *  migration 5 to 6). */
export const SCHEMA_VERSION = 6 as const;
/** Scrappers on one save. A fourth needs one retired first. */
export const SLOT_LIMIT = 3;
/** History: the last 50 bouts keep their logs, the last 200 are kept as summaries. */
export const HISTORY_LOGS = 50;
export const HISTORY_ROWS = 200;

export const DEFAULT_SETTINGS: Settings = { sound: true, speed: 1, reducedMotion: "system", liveLog: true, isVip: false, musicVolume: 60, sfxVolume: 100 };
/** A volume setting: a whole percent 0 to 100, or null when it is not one. */
const volumeOf = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null);

/** The speed a bout really plays at: 3x is a VIP perk, so a save that is not VIP plays 3x as 2x. */
export function playSpeed(s: Pick<Settings, "speed" | "isVip">): 1 | 2 | 3 {
  return s.speed === 3 && !s.isVip ? 2 : s.speed;
}

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

/** The six stats a stored stat block must hold (schema 4). */
const STAT_KEYS: readonly StatKey[] = ["health", "strength", "agility", "speed", "toughness", "precision"];
function checkStats(v: unknown): StatBlock | null {
  if (!isObj(v)) return null;
  const pts = v.points;
  const mult = v.mult;
  if (!isObj(pts) || !isObj(mult) || !STAT_KEYS.every((k) => isInt(pts[k]) && isInt(mult[k]))) return null;
  const points = {} as Record<StatKey, number>;
  const mults = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    points[k] = pts[k] as number;
    mults[k] = mult[k] as number;
  }
  return { points, mult: mults };
}

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
  if (typeof v.isVip === "boolean") s.isVip = v.isVip;
  if (v.speed === 1 || v.speed === 2 || v.speed === 3) s.speed = playSpeed({ speed: v.speed, isVip: s.isVip });
  if (v.reducedMotion === "system" || v.reducedMotion === "on" || v.reducedMotion === "off") s.reducedMotion = v.reducedMotion;
  if (typeof v.liveLog === "boolean") s.liveLog = v.liveLog;
  s.musicVolume = volumeOf(v.musicVolume) ?? s.musicVolume;
  s.sfxVolume = volumeOf(v.sfxVolume) ?? s.sfxVolume;
  return s;
}

/** A carried kit (`ScrapperRecord.base`), or null when it is not one. Unknown perk ids are left out. */
export function checkBase(v: unknown, picks: number, warn: (w: string) => void): KitBase | null {
  if (!isObj(v) || !isNat(v.picks) || v.picks > picks || !isNat(v.starts) || !Array.isArray(v.perks)) return null;
  const stats = checkStats(v.stats);
  if (stats === null) return null;
  const perks: PerkId[] = [];
  let starts = v.starts;
  (v.perks as unknown[]).forEach((p, i) => {
    if (isStr(p) && isPerkId(p)) perks.push(p);
    else {
      warn(`unknown perk id ${JSON.stringify(p)} in a carried kit: left out`);
      if (i < (v.starts as number)) starts -= 1;
    }
  });
  if (perks.length === 0 || starts < 1) return null;
  return { picks: v.picks, starts, perks, stats };
}

/** A stored loadout's shape (ids it does not know are left out; what it does not own is left out
 *  when it is read, `loadoutOf`), or null when it is not one. */
export function checkLoadout(v: unknown, warn: (w: string) => void): Loadout | null {
  if (!isObj(v) || !Array.isArray(v.weapons) || !Array.isArray(v.pets) || !isObj(v.gear)) return null;
  const weapons = (v.weapons as unknown[]).filter((w): w is WeaponId => isStr(w) && isWeaponId(w));
  const pets = (v.pets as unknown[]).filter((p): p is CompanionId => isStr(p) && isCompanionId(p));
  const shield = isStr(v.shield) && isShieldId(v.shield) ? v.shield : null;
  const gear: Partial<Record<GearSlot, GearId>> = {};
  for (const slot of GEAR_SLOTS) {
    const g = (v.gear as Obj)[slot];
    if (isStr(g) && isGearId(g)) gear[slot] = g;
    else if (g !== undefined) warn(`unknown gear ${JSON.stringify(g)} in a loadout: left out`);
  }
  return { weapons, shield, pets, gear };
}

/** Stored talent ranks: whole numbers of 1 or more under known ids (an unknown id warns and is
 *  left out). The tree's own rules (tiers, max ranks, points earned) are applied when it is read,
 *  by the core (`talentsOf`). */
export function checkRanks(v: unknown, warn: (w: string) => void): TalentRanks {
  const out: Partial<Record<TalentId, number>> = {};
  if (!isObj(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    if (!isTalentId(k)) { warn(`unknown talent ${JSON.stringify(k)}: left out`); continue; }
    if (isNat(n) && n >= 1) out[k] = n;
  }
  return out;
}
function checkTalents(v: unknown, warn: (w: string) => void): TalentPicks | null {
  if (!isObj(v)) return null;
  const picks: TalentPicks = { ranks: checkRanks(v.ranks, warn) };
  if (isDay(v.respecDay)) picks.respecDay = v.respecDay;
  return picks;
}

function checkRecord(v: unknown, where: string, warn: (w: string) => void = () => undefined): ScrapperRecord {
  need(isObj(v), `${where}: not an object`);
  const r = v as Obj;
  need(isStr(r.id) && r.id.length > 0, `${where}: id`);
  need(isStr(r.name) && r.name.length > 0, `${where}: name`);
  need(isInt(r.seed), `${where}: seed`);
  need(isInt(r.lookSalt) && isInt(r.colourSalt), `${where}: salts`);
  need(Array.isArray(r.picks) && (r.picks as unknown[]).every((p) => p === "L" || p === "R"), `${where}: picks`);
  need(isNat(r.xp), `${where}: xp`);
  need(isDay(r.createdDay), `${where}: days`);
  need(isNat(r.lifetimeBouts), `${where}: counts`);
  need(isNat(r.energy) && isNat(r.energyAt), `${where}: energy`);
  const rec: ScrapperRecord = { id: r.id as string, name: r.name as string, seed: r.seed as number, lookSalt: r.lookSalt as number,
    colourSalt: r.colourSalt as number, picks: [...(r.picks as ("L" | "R")[])], xp: r.xp as number,
    createdDay: r.createdDay as string, lifetimeBouts: r.lifetimeBouts as number,
    energy: r.energy as number, energyAt: r.energyAt as number };
  if (r.base !== undefined) {
    const base = checkBase(r.base, rec.picks.length, warn);
    if (base !== null) rec.base = base;
    else warn(`${where}: its carried kit could not be read: walked from its picks`);
  }
  if (r.loadout !== undefined) {
    const l = checkLoadout(r.loadout, warn);
    if (l !== null) rec.loadout = l;
    else warn(`${where}: its loadout could not be read: the default one is used`);
  }
  if (isNat(r.gearFrom) && r.gearFrom <= rec.picks.length) rec.gearFrom = r.gearFrom;
  if (r.talents !== undefined) {
    const t = checkTalents(r.talents, warn);
    if (t !== null) rec.talents = t;
    else warn(`${where}: its talents could not be read: every point is unspent`);
  }
  return rec;
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
  const stats = checkStats(v.stats);
  if (!isStr(v.id) || !isStr(v.name) || !isNat(v.level) || look === null || stats === null) return null;
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
  const snap: FighterSnapshot = { id: v.id, name: v.name, look, level: v.level, stats, perks, rulesVersion: 1 };
  // (the talent ranks the bout read, content v3 batch 3: a replay played again from its seed needs them)
  if (v.talents !== undefined) snap.talents = checkRanks(v.talents, warn);
  return { snap, dropped };
}

function checkBout(v: unknown, warn: (w: string) => void): BoutRecord | null {
  if (!isObj(v)) return null;
  const a = checkSnapshot(v.snapshotA, warn);
  const b = checkSnapshot(v.snapshotB, warn);
  const res = v.result;
  const before = v.before;
  if (a === null || b === null || !isStr(v.id) || !isNat(v.at) || !isInt(v.seed) || !isStr(v.fighterId)) return null;
  if (!isObj(res) || (res.winner !== "a" && res.winner !== "b") || (res.reason !== "ko" && res.reason !== "cap")) return null;
  if (!isObj(before) || !isNat(before.xp) || !isNat(before.energy) || !isNat(before.energyAt)) return null;
  if (v.xp !== 1 && v.xp !== 2) return null;
  const hp = isObj(res.hpPct) ? res.hpPct : {};
  const rec: BoutRecord = {
    id: v.id, at: v.at, seed: v.seed, rulesVersion: 1, logVersion: v.logVersion === 2 ? 2 : 1, snapshotA: a.snap, snapshotB: b.snap,
    result: { winner: res.winner, reason: res.reason, turns: isNat(res.turns) ? res.turns : 0,
      hpPct: { a: isNat(hp.a) ? hp.a : 0, b: isNat(hp.b) ? hp.b : 0 } },
    role: v.role === "defender" ? "defender" : "attacker", fighterId: v.fighterId, xp: v.xp,
    lineId: isNat(v.lineId) ? v.lineId : 0, watched: v.watched === true,
    before: { xp: before.xp, energy: before.energy, energyAt: before.energyAt },
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
    const fighters = (d.fighters as unknown[]).map((f, i) => checkRecord(f, `fighters[${i}]`, warn));
    const retired = (d.retired as unknown[]).map((f, i) => checkRecord(f, `retired[${i}]`, warn));

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
