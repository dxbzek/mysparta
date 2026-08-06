/**
 * Prototype persistence: localStorage stands in for the server.
 * In MVP+ the server is the source of truth and there is no client save
 * (04-technical-architecture.md §5) — this file is disposable by design.
 */

import type { BattlePlan, Champion } from "@agoge/core";
import { lookFor } from "./fighters.js";
import type { Equipped } from "./gear.js";
import { normaliseLook, type Look } from "./paperdoll.js";

export interface DailyQuests {
  day: string;
  fights: number;
  wins: number;
  crits: number;
  claimed: boolean;
}

export interface SaveV1 {
  v: 1;
  champion: Champion;
  kleos: number;
  vigor: number;
  vigorDate: string; // UTC day the ration was last granted
  wins: number;
  losses: number;
  totalFights: number;
  plan: BattlePlan;
  /** Last plan we SAW each rival use (the "last-known plan" scouting rule). */
  seenPlans: Record<string, BattlePlan>;
  boardRefresh: number;
  quests?: DailyQuests;
  /** The champion's appearance — every paper-doll part (paperdoll.ts). */
  look?: Look;
  /** Aura colour index (fighters.tsx AURAS). */
  aura?: number;
  /** How the champion is posed and framed in the Hall portrait. */
  portrait?: { arena: number; pose: string };
  /** Gear item ids collected from random level-up drops (gear.ts). */
  gear?: string[];
  /** Which owned pieces are currently worn. */
  equipped?: Equipped;
}

export function freshQuests(): DailyQuests {
  return { day: todayKey(), fights: 0, wins: 0, crits: 0, claimed: false };
}

const KEY = "agoge.save.v1";

export const VIGOR_DAILY = 6;
export const VIGOR_CAP = 12;

export function todayKey(): string {
  // The player's midnight, not UTC's. toISOString put the reset at 4am for a
  // Dubai player and split one evening session across two "days" — in a game
  // whose whole economy is "6 fights a day", the day has to be their day.
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newSave(
  champion: Champion,
  plan: BattlePlan,
  look?: Look,
  aura?: number,
): SaveV1 {
  return {
    v: 1,
    look: normaliseLook(look ?? lookFor(champion.displayName)),
    aura: aura ?? 0,
    gear: [],
    equipped: {},
    champion,
    kleos: 1500,
    vigor: VIGOR_CAP, // day-one bonus: +6 on top of the daily 6
    vigorDate: todayKey(),
    wins: 0,
    losses: 0,
    totalFights: 0,
    plan,
    seenPlans: {},
    boardRefresh: 0,
  };
}

/**
 * How long until the next ration, in the player's own timezone — the same
 * midnight `todayKey` counts from. "Tomorrow" is useless at 11pm and wrong at
 * 1am; a number of hours is neither.
 */
export function untilReset(now = new Date()): { hours: number; minutes: number; text: string } {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight.getTime() - now.getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const text = hours >= 1 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { hours, minutes, text };
}

/** Daily reset: +6 Vigor, banked to a cap of 12 (00-vision.md §5). */
export function applyDailyReset(save: SaveV1): SaveV1 {
  const today = todayKey();
  if (save.vigorDate === today) return save;
  return {
    ...save,
    vigor: Math.min(VIGOR_CAP, save.vigor + VIGOR_DAILY),
    vigorDate: today,
    boardRefresh: 0,
    quests: freshQuests(),
  };
}

export function load(): SaveV1 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveV1;
    if (parsed.v !== 1) return null;
    // Older prototype saves predate Forge customisation.
    const a = parsed.champion.appearance;
    if (a.skin == null) a.skin = a.hue % 6;
    if (a.sigil == null) a.sigil = a.hue2 % 4;
    if (a.helm == null) a.helm = a.hue % 4;
    if (a.tint == null) a.tint = 0;
    // Saves that predate the paper-doll hunters get a stable derived look,
    // and their old gear ids no longer exist.
    if (parsed.look == null) {
      parsed.look = lookFor(parsed.champion.displayName);
      parsed.gear = [];
      parsed.equipped = {};
    }
    parsed.look = normaliseLook(parsed.look);
    if (parsed.gear == null) parsed.gear = [];
    if (parsed.equipped == null) parsed.equipped = {};
    // The stance is read on every fight and drawn in the Hall, so a save from
    // before it was the player's to set must land on the neutral one.
    if (parsed.plan == null) parsed.plan = { stance: "measured", gambit: "close_the_gap" };
    if (parsed.plan.stance == null) parsed.plan.stance = "measured";
    return applyDailyReset(parsed);
  } catch {
    return null;
  }
}

export function persist(save: SaveV1): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Sandboxed embeds may deny storage — the session still plays, unsaved.
  }
}

/*
 * Rescue codes — the prototype's answer to cloud save. The whole save,
 * base64-wrapped so it survives chat apps and clipboards, restorable on any
 * device. Auto-save already writes every action; this is the copy you keep.
 */

export function encodeSave(save: SaveV1): string {
  return btoa(encodeURIComponent(JSON.stringify(save)));
}

/**
 * Returns null on anything that is not a valid v1 rescue code.
 *
 * A code is pasted text, so it is treated as hostile until proven otherwise:
 * numbers must be finite numbers, lists must be short lists of short strings,
 * and everything is clamped into sane play ranges. Without this, one crafted
 * paste could persist a save that crashes every render after it (a champion
 * with 10^9 weapons, an XP of NaN, a name a megabyte long).
 */
export function decodeSave(code: string): SaveV1 | null {
  try {
    const p = JSON.parse(decodeURIComponent(atob(code.trim()))) as SaveV1;
    if (p.v !== 1 || typeof p.champion !== "object" || !p.champion) return null;
    const c = p.champion;
    const num = (x: unknown, lo: number, hi: number, fallback: number) =>
      typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback;
    const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
    const list = (x: unknown, max: number) =>
      Array.isArray(x) ? x.filter((s): s is string => typeof s === "string").slice(0, max).map((s) => s.slice(0, 64)) : [];
    if (!str(c.name, 24) || typeof c.appearance !== "object" || !c.appearance) return null;
    // Rebuild rather than pass through: unknown fields are dropped, known
    // fields are coerced into ranges the rest of the app can trust.
    const champion: Champion = {
      ...c,
      name: str(c.name, 24),
      displayName: str(c.displayName, 24) || str(c.name, 24),
      seed: num(c.seed, 0, 2 ** 32, 1),
      omen: str(c.omen, 32),
      epithet: str(c.epithet, 48),
      level: num(c.level, 1, 50, 1),
      xp: num(c.xp, 0, 10_000, 0),
      stats: {
        might: num(c.stats?.might, 1, 99, 7),
        grace: num(c.stats?.grace, 1, 99, 7),
        tempo: num(c.stats?.tempo, 1, 99, 7),
        grit: num(c.stats?.grit, 1, 99, 7),
      },
      weapons: list(c.weapons, 12),
      skills: list(c.skills, 20),
      beasts: list(c.beasts, 6),
      favour: num(c.favour, 0, 6, 0),
      tapestry: Array.isArray(c.tapestry) ? c.tapestry.slice(0, 60) : [],
      declined: Array.isArray(c.declined) ? c.declined.slice(0, 30) : [],
      sinceWeaponOffer: num(c.sinceWeaponOffer, 0, 99, 0),
      sinceSkillOffer: num(c.sinceSkillOffer, 0, 99, 0),
    };
    return {
      ...p,
      v: 1,
      champion,
      kleos: num(p.kleos, 1000, 4000, 1500),
      vigor: num(p.vigor, 0, VIGOR_CAP, 0),
      vigorDate: str(p.vigorDate, 10) || todayKey(),
      wins: num(p.wins, 0, 1e6, 0),
      losses: num(p.losses, 0, 1e6, 0),
      totalFights: num(p.totalFights, 0, 1e6, 0),
      boardRefresh: num(p.boardRefresh, 0, 99, 0),
      gear: list(p.gear, 64),
    };
  } catch {
    return null;
  }
}

export function wipe(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
