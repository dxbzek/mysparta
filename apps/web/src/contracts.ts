/**
 * FROZEN CONTRACT (work package 0). The web app: saves, actions, and the seam between the fight
 * screen and the screens around it. Storage names use the prefix `rankzero.`.
 */
import type { BossBlock, BoutLog, BoutResult, DayKey, FighterSnapshot, Loadout, Look, Pick, ScrapperRecord, TalentBlock, TalentId } from "@rankzero/core";

export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
/** CONTRACT_REV 4: `speed` 3 is a VIP perk; `isVip` says whether this save has it (false until the
 *  shop exists, plan 13.13; the Settings sheet has a temporary "VIP (test)" switch). A save that is
 *  not VIP never plays at 3x: the fight screen and the save check both drop it to 2x. */
export interface Settings { sound: boolean; speed: 1 | 2 | 3; reducedMotion: "system" | "on" | "off"; liveLog: boolean;
  isVip: boolean;
  /** Plan 13.17: the Music and Effects sliders, whole percent 0 to 100. A save written before them
   *  loads with the defaults (the check fills them; no schema step). */
  musicVolume: number; sfxVolume: number }
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
  /** A boss bout (CONTRACT_REV 11): the rung of the boss fought, 1 to LADDER_RUNGS. A won boss bout
   *  moved the scrapper up one rank when it started; the screens show the rank from before it
   *  until it is watched. Absent: a bout with a rival. */
  boss?: number;
  log?: BoutLog }                                                // kept for the last 50
/** Schema version 2 (CONTRACT_REV 4): `settings.isVip` added; migration 1 to 2 sets it false.
 *  Schema version 3 (CONTRACT_REV 5): a scrapper may carry an earlier build's kit
 *  (`ScrapperRecord.base`); migration 2 to 3 pins it from the scrapper's last stored bout. */
/** Schema version 4 (CONTRACT_REV 7): energy in place of the daily bout cap, six stats; migration
 *  3 to 4 fills every bar, carries every kit with Toughness and Precision added (docs/RULES.md,
 *  "Old saves"). */
/** Schema version 5 (CONTRACT_REV 8): the loadout and body equipment; migration 4 to 5 gives every
 *  scrapper the default loadout and `gearFrom` (docs/RULES.md, "Old saves"). */
/** Schema version 6 (CONTRACT_REV 9): the talent tree. Schema version 7 (CONTRACT_REV 10, the look
 *  editor): every scrapper stores its look (`ScrapperRecord.look`); migration 6 to 7 pins the seeded
 *  look each one was shown (the version-1 roll), so nobody's look changes. */
/** Schema version 8 (CONTRACT_REV 11, the rank ladder): `ScrapperRecord.ladder` and
 *  `BoutRecord.boss`; migration 7 to 8 starts every scrapper at Rank Zero with no prize. */
export interface SaveDoc { schemaVersion: 8; rev: number; updatedAt: number; settings: Settings;

  activeId: string | null;                                       // the scrapper shown in the Locker
  fighters: ScrapperRecord[]; retired: ScrapperRecord[]; history: BoutRecord[] }
export type LoadResult = { state: "empty" } | { state: "ok"; doc: SaveDoc }
  | { state: "corrupt"; backupKey: string | null; doc: SaveDoc | null };
export type WriteResult = { ok: true; rev: number } | { ok: false; why: "stale" | "backup-failed" | "io" };
export interface SaveStore { load(): Promise<LoadResult>; write(doc: SaveDoc, expectedRev: number): Promise<WriteResult> }
export interface OpponentSource { hand(rec: ScrapperRecord, today: DayKey): Promise<FighterSnapshot[]> }
export interface Clock { now(): number; today(): DayKey }        // injected, so tests can move the time

export interface GameActions {
  /** `look` (CONTRACT_REV 10): the look picked in the editor; without it, today's roll of the name. */
  create(name: string, lookSalt: number, colourSalt: number, look?: Look):
    Promise<Result<ScrapperRecord, "bad-name" | "name-taken" /* by an ACTIVE scrapper only */ | "no-slot">>;
  /** Stores the look picked in the editor (CONTRACT_REV 10). Cosmetic: stats stay as they are. */
  setLook(id: string, look: Look): Promise<Result<void, "no-scrapper">>;
  select(id: string): Promise<void>;                             // sets SaveDoc.activeId
  startBout(id: string, opponent: FighterSnapshot):
    Promise<Result<BoutRecord, "level-up-waiting" | "no-energy" | "unwatched-bout">>;
  /** A boss bout (CONTRACT_REV 11): one energy like a bout, refused while a level-up or a boss
   *  prize waits, while a bout is unwatched, or when the core's `bossBlock` says no. */
  startBoss(id: string, rung: number):
    Promise<Result<BoutRecord, "level-up-waiting" | "no-energy" | "unwatched-bout" | "prize-waiting" | BossBlock>>;
  /** Takes the waiting boss prize, the left or the right card (CONTRACT_REV 11). */
  takePrize(id: string, pick: Pick): Promise<Result<void, "nothing-waiting">>;
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
  energy: number;
  /** A boss bout (CONTRACT_REV 11): the card offers the Ladder in place of "Next bout". */
  boss?: boolean;
  /** A won boss bout: the rank reached ("Rank 10") and its name, shown on the card, with "Claim
   *  prize" when no level-up waits first. */
  rankUp?: { rank: string; title: string } }
/** The result card's ways out. "prize" and "ladder" since CONTRACT_REV 11. */
export type ResultAction = "levelup" | "next" | "replay" | "locker" | "prize" | "ladder";
/** The boss banner over the start of a boss bout (CONTRACT_REV 11): its name, its rank's name and
 *  its taunt. */
export interface BossIntro { name: string; title: string; taunt: string }
export interface FightScreenProps { log: BoutLog; a: FighterSnapshot; b: FighterSnapshot;
  mode: "live" | "replay"; settings: Settings; onSettings(patch: Partial<Settings>): void;
  onFinished(how: "watched" | "skipped"): void;
  result: ResultCardData | null;                                 // null in replay mode
  onResultAction(action: ResultAction): void;
  /** A boss bout's banner (CONTRACT_REV 11). Absent: none. */
  intro?: BossIntro;
  /** Each side's rank, shown under its name in the HUD (CONTRACT_REV 11). Absent: none. */
  ranks?: { a: string; b: string } }
// Debug route: #/debug/bout?seed=<n>&t=<ms>&paused=1 or #/debug/bout?fixture=<name>&...
/** Set on `window.__rz` by the debug route, so a script can drive the fight clock frame by frame. */
export interface DebugHandle { ready: boolean; durationMs: number; seek(tMs: number): void }

declare global {
  interface Window { __rz?: DebugHandle }
}
