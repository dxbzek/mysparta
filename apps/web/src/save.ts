/**
 * Prototype persistence: localStorage stands in for the server.
 * In MVP+ the server is the source of truth and there is no client save
 * (04-technical-architecture.md §5) — this file is disposable by design.
 */

import type { BattlePlan, Champion } from "@agoge/core";

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
}

const KEY = "agoge.save.v1";

export const VIGOR_DAILY = 6;
export const VIGOR_CAP = 12;

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newSave(champion: Champion, plan: BattlePlan): SaveV1 {
  return {
    v: 1,
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

/** Daily reset: +6 Vigor, banked to a cap of 12 (00-vision.md §5). */
export function applyDailyReset(save: SaveV1): SaveV1 {
  const today = todayKey();
  if (save.vigorDate === today) return save;
  return {
    ...save,
    vigor: Math.min(VIGOR_CAP, save.vigor + VIGOR_DAILY),
    vigorDate: today,
    boardRefresh: 0,
  };
}

export function load(): SaveV1 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveV1;
    if (parsed.v !== 1) return null;
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

export function wipe(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
