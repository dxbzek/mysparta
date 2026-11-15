/**
 * FROZEN CONTRACT (work package 0). The web app: saves, actions, and the seam between the fight
 * screen and the screens around it. Storage names use the prefix `rankzero.`.
 */
import type { BoutLog, BoutResult, DayKey, FighterSnapshot, Pick, ScrapperRecord } from "@rankzero/core";

export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
export interface Settings { sound: boolean; speed: 1 | 2; reducedMotion: "system" | "on" | "off"; liveLog: boolean }
/** One stored bout. `at` is a time in ms since 1970, from the injected `Clock`. `lineId` picks
 *  the one-line result text. */
/** `logVersion` 1 is a row stored before content v2 (contract rev 2): its log is never kept. */
export interface BoutRecord { id: string; at: number; seed: number; rulesVersion: 1; logVersion: 1 | 2;
  snapshotA: FighterSnapshot; snapshotB: FighterSnapshot; result: BoutResult;
  role: "attacker" | "defender"; fighterId: string; xp: 1 | 2; lineId: number;
  watched: boolean; before: { xp: number; boutsUsed: number };   // the UI shows these until watched
  log?: BoutLog }                                                // kept for the last 50
export interface SaveDoc { schemaVersion: 1; rev: number; updatedAt: number; settings: Settings;
  activeId: string | null;                                       // the scrapper shown in the Locker
  fighters: ScrapperRecord[]; retired: ScrapperRecord[]; history: BoutRecord[] }
export type LoadResult = { state: "empty" } | { state: "ok"; doc: SaveDoc }
  | { state: "corrupt"; backupKey: string | null; doc: SaveDoc | null };
export type WriteResult = { ok: true; rev: number } | { ok: false; why: "stale" | "backup-failed" | "io" };
export interface SaveStore { load(): Promise<LoadResult>; write(doc: SaveDoc, expectedRev: number): Promise<WriteResult> }
export interface OpponentSource { hand(rec: ScrapperRecord, today: DayKey): Promise<FighterSnapshot[]> }
export interface Clock { now(): number; today(): DayKey }        // injected, so tests can move the day

export interface GameActions {
  create(name: string, lookSalt: number, colourSalt: number):
    Promise<Result<ScrapperRecord, "bad-name" | "name-taken" /* by an ACTIVE scrapper only */ | "no-slot">>;
  select(id: string): Promise<void>;                             // sets SaveDoc.activeId
  startBout(id: string, opponent: FighterSnapshot):
    Promise<Result<BoutRecord, "level-up-waiting" | "no-bouts" | "unwatched-bout">>;
  markWatched(boutId: string): Promise<void>;
  takeLevelUp(id: string, pick: Pick): Promise<Result<void, "nothing-waiting">>;
  retire(id: string, typedName: string): Promise<Result<void, "name-mismatch">>;
  setSettings(patch: Partial<Settings>): Promise<void>;
  exportCode(): Promise<string>;
  importCode(code: string): Promise<Result<void, "bad-code">>;
}

// The seam between the fight screen and the app.
export interface ResultCardData { won: boolean; line: string; xpBefore: number; xpAfter: number;
  xpToNext: number; levelUp: boolean; boutsLeft: number }
export interface FightScreenProps { log: BoutLog; a: FighterSnapshot; b: FighterSnapshot;
  mode: "live" | "replay"; settings: Settings; onSettings(patch: Partial<Settings>): void;
  onFinished(how: "watched" | "skipped"): void;
  result: ResultCardData | null;                                 // null in replay mode
  onResultAction(action: "levelup" | "next" | "replay" | "locker"): void }
// Debug route: #/debug/bout?seed=<n>&t=<ms>&paused=1 or #/debug/bout?fixture=<name>&...
/** Set on `window.__rz` by the debug route, so a script can drive the fight clock frame by frame. */
export interface DebugHandle { ready: boolean; durationMs: number; seek(tMs: number): void }

declare global {
  interface Window { __rz?: DebugHandle }
}
