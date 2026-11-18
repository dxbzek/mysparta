/**
 * FROZEN CONTRACT (work package 0). The web app: saves, actions, and the seam between the fight
 * screen and the screens around it. Storage names use the prefix `rankzero.`.
 */
import type { BoutLog, BoutResult, DayKey, FighterSnapshot, Loadout, Pick, ScrapperRecord, TalentBlock, TalentId } from "@rankzero/core";

export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
/** CONTRACT_REV 4: `speed` 3 is a VIP perk; `isVip` says whether this save has it (false until the
 *  shop exists, plan 13.13; the Settings sheet has a temporary "VIP (test)" switch). A save that is
 *  not VIP never plays at 3x: the fight screen and the save check both drop it to 2x. */
export interface Settings { sound: boolean; speed: 1 | 2 | 3; reducedMotion: "system" | "on" | "off"; liveLog: boolean;
  isVip: boolean }
/** One stored bout. `at` is a time in ms since 1970, from the injected `Clock`. `lineId` picks
 *  the one-line result text. */
/** `logVersion` 1 is a row stored before content v2 (contract rev 2): its log is never kept. */
export interface BoutRecord { id: string; at: number; seed: number; rulesVersion: 1; logVersion: 1 | 2;
  snapshotA: FighterSnapshot; snapshotB: FighterSnapshot; result: BoutResult;
  role: "attacker" | "defender"; fighterId: string; xp: 1 | 2; lineId: number;
  watched: boolean;
  /** The XP and the energy from before the bout: the UI shows these until it is watched (schema 4:
   *  energy in place of the bouts used today). */
  before: { xp: number; energy: number; energyAt: number };
  log?: BoutLog }                                                // kept for the last 50
/** Schema version 2 (CONTRACT_REV 4): `settings.isVip` added; migration 1 to 2 sets it false.
 *  Schema version 3 (CONTRACT_REV 5): a scrapper may carry an earlier build's kit
 *  (`ScrapperRecord.base`); migration 2 to 3 pins it from the scrapper's last stored bout. */
/** Schema version 4 (CONTRACT_REV 7): energy in place of the daily bout cap, six stats; migration
 *  3 to 4 fills every bar, carries every kit with Toughness and Precision added (docs/RULES.md,
 *  "Old saves"). */
/** Schema version 5 (CONTRACT_REV 8): the loadout and body equipment; migration 4 to 5 gives every
 *  scrapper the default loadout and `gearFrom` (docs/RULES.md, "Old saves"). */
export interface SaveDoc { schemaVersion: 6; rev: number; updatedAt: number; settings: Settings;

  activeId: string | null;                                       // the scrapper shown in the Locker
  fighters: ScrapperRecord[]; retired: ScrapperRecord[]; history: BoutRecord[] }
export type LoadResult = { state: "empty" } | { state: "ok"; doc: SaveDoc }
  | { state: "corrupt"; backupKey: string | null; doc: SaveDoc | null };
export type WriteResult = { ok: true; rev: number } | { ok: false; why: "stale" | "backup-failed" | "io" };
export interface SaveStore { load(): Promise<LoadResult>; write(doc: SaveDoc, expectedRev: number): Promise<WriteResult> }
export interface OpponentSource { hand(rec: ScrapperRecord, today: DayKey): Promise<FighterSnapshot[]> }
export interface Clock { now(): number; today(): DayKey }        // injected, so tests can move the time

export interface GameActions {
  create(name: string, lookSalt: number, colourSalt: number):
    Promise<Result<ScrapperRecord, "bad-name" | "name-taken" /* by an ACTIVE scrapper only */ | "no-slot">>;
  select(id: string): Promise<void>;                             // sets SaveDoc.activeId
  startBout(id: string, opponent: FighterSnapshot):
    Promise<Result<BoutRecord, "level-up-waiting" | "no-energy" | "unwatched-bout">>;
  markWatched(boutId: string): Promise<void>;
  takeLevelUp(id: string, pick: Pick): Promise<Result<void, "nothing-waiting">>;
  /** Stores what the scrapper takes into a bout (CONTRACT_REV 8), cleaned against what it owns. */
  setLoadout(id: string, loadout: Loadout): Promise<Result<void, "no-scrapper">>;
  /** One more rank of a talent node (CONTRACT_REV 9), when the tree's rules allow it. */
  spendTalent(id: string, talent: TalentId): Promise<Result<void, "no-scrapper" | TalentBlock>>;
  /** Today's free respec: every talent point back to unspent (CONTRACT_REV 9). */
  respecTalents(id: string): Promise<Result<void, "no-scrapper" | "used-today" | "nothing-spent">>;
  retire(id: string, typedName: string): Promise<Result<void, "name-mismatch">>;
  setSettings(patch: Partial<Settings>): Promise<void>;
  exportCode(): Promise<string>;
  importCode(code: string): Promise<Result<void, "bad-code">>;
}

// The seam between the fight screen and the app.
export interface ResultCardData { won: boolean; line: string; xpBefore: number; xpAfter: number;
  xpToNext: number; levelUp: boolean;
  /** Energy left after the bout (content v3): "Next bout" shows while it is above 0. */
  energy: number }
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
