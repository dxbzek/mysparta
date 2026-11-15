/**
 * The game's actions (contract `GameActions`). Each one is a pure change of the save document,
 * committed through the store, so every rule below is checked against the copy that is really
 * written (another tab's copy included):
 *
 *   - three active scrappers; a name used by an ACTIVE scrapper is refused; a retired name makes
 *     a new level-1 scrapper with the same seed; create never writes over a scrapper;
 *   - one bout at a time: no bout starts while any bout is unwatched;
 *   - no bout starts while a level-up waits, or with no bouts left today;
 *   - the bout is decided and saved when it starts; the screens show the `before` values until
 *     it is watched or skipped.
 */
import { REALM_SALT, api } from "@rankzero/core";
import type { CoreApi, DayKey, FighterSnapshot, Pick as Side2, ScrapperRecord } from "@rankzero/core";
import type { BoutRecord, Clock, GameActions, Result, SaveDoc, Settings } from "../contracts";
import { decodeSave, encodeSave } from "./saveCode";
import { SLOT_LIMIT, emptyDoc, trimHistory } from "./schema";
import type { Backups, BackupEntry } from "./slots";
import { SaveError } from "./store";
import type { GameStore } from "./store";
import { ulid } from "./ulid";

export interface ActionDeps {
  store: GameStore;
  clock: Clock;
  core?: CoreApi;
  realmSalt?: string;
  newId?: (now: number) => string;
  /** Where a copy of the save goes before an import or restore replaces it. */
  backups?: Backups;
}

/** What a save holds, in names, for the confirm sheet before it replaces another. */
export interface SaveSummary {
  active: string[];
  retired: number;
}
export const summaryOf = (doc: SaveDoc): SaveSummary => ({ active: doc.fighters.map((f) => f.name), retired: doc.retired.length });
const isBlank = (doc: SaveDoc): boolean => doc.fighters.length === 0 && doc.retired.length === 0 && doc.history.length === 0;

export interface AppActions extends GameActions {
  /** Starts a fresh save over an unreadable one (its bytes were backed up first). */
  newSave(): Promise<void>;
  /** Reads a save code without importing it: null when it is not a save. */
  previewCode(code: string): Promise<SaveSummary | null>;
  /** Backups that hold a save this build can read, newest first. */
  listBackups(): Promise<BackupEntry[]>;
  /** Puts a backed-up save back. The current save is backed up first. */
  restoreBackup(key: string): Promise<Result<void, "bad-code">>;
}

const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const fail = <E extends string>(error: E): { ok: false; error: E } => ({ ok: false, error });

export const sameName = (a: string, b: string): boolean =>
  a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

/** The bout this scrapper has not watched yet, if any. */
export function unwatchedOf(doc: SaveDoc, id?: string): BoutRecord | undefined {
  return doc.history.find((b) => !b.watched && (id === undefined || b.fighterId === id));
}

export function usedToday(rec: ScrapperRecord, today: DayKey): number {
  return rec.day < today ? 0 : rec.boutsUsed;
}

/**
 * The record as the screens must show it: while its last bout is unwatched, the XP and the bouts
 * used are the values from before that bout (brief 3.11 B, 3.14).
 */
export function shownRecord(doc: SaveDoc, rec: ScrapperRecord): ScrapperRecord {
  const b = unwatchedOf(doc, rec.id);
  if (!b) return rec;
  return { ...rec, xp: b.before.xp, boutsUsed: b.before.boutsUsed, lifetimeBouts: Math.max(0, rec.lifetimeBouts - 1) };
}

/** Line id for the one-line result text: a pure function of the bout seed. */
export const lineIdFor = (seed: number): number => (seed >>> 0) % 1000;

export function createGameActions(deps: ActionDeps): AppActions {
  const { store, clock } = deps;
  const core = deps.core ?? api;
  const realm = deps.realmSalt ?? REALM_SALT;
  const newId = deps.newId ?? ((now: number) => ulid(now));

  const find = (doc: SaveDoc, id: string): ScrapperRecord | undefined => doc.fighters.find((f) => f.id === id);
  const put = (doc: SaveDoc, rec: ScrapperRecord): SaveDoc => ({ ...doc, fighters: doc.fighters.map((f) => (f.id === rec.id ? rec : f)) });

  /** Backs up the save on screen before it is replaced. Refuses the replace if that fails. */
  const keepCurrent = async (): Promise<void> => {
    if (!deps.backups || isBlank(store.doc)) return;
    if ((await deps.backups.keep(store.doc)) === null) throw new SaveError("backup-failed");
  };

  return {
    create(name: string, lookSalt: number, colourSalt: number) {
      const checked = core.checkName(name);
      if (!checked.ok) return Promise.resolve(fail("bad-name" as const));
      const today = clock.today();
      return store.commit<Result<ScrapperRecord, "bad-name" | "name-taken" | "no-slot">>((doc) => {
        if (doc.fighters.some((f) => sameName(f.name, checked.name))) return { doc: null, value: fail("name-taken" as const) };
        if (doc.fighters.length >= SLOT_LIMIT) return { doc: null, value: fail("no-slot" as const) };
        const taken = new Set([...doc.fighters, ...doc.retired].map((f) => f.id));
        let id = newId(clock.now());
        for (let i = 0; taken.has(id); i++) {
          if (i > 20) throw new Error("create: could not make a fresh id");
          id = newId(clock.now() + i + 1);
        }
        const rec = core.createRecord({ id, name: checked.name, realmSalt: realm, lookSalt, colourSalt, today });
        return { doc: { ...doc, fighters: [...doc.fighters, rec], activeId: rec.id }, value: ok(rec) };
      });
    },

    select(id: string) {
      return store.commit((doc) => ({ doc: find(doc, id) && doc.activeId !== id ? { ...doc, activeId: id } : null, value: undefined }));
    },

    startBout(id: string, opponent: FighterSnapshot) {
      const today = clock.today();
      const at = clock.now();
      return store.commit((doc): { doc: SaveDoc | null; value: Result<BoutRecord, "level-up-waiting" | "no-bouts" | "unwatched-bout"> } => {
        const rec = find(doc, id);
        if (!rec) throw new Error(`startBout: no scrapper ${id}`);
        if (unwatchedOf(doc)) return { doc: null, value: fail("unwatched-bout") };
        if (core.sheetOf(rec).levelUpWaiting) return { doc: null, value: fail("level-up-waiting") };
        if (core.boutsLeft(rec, today) <= 0) return { doc: null, value: fail("no-bouts") };
        const me = core.snapshotOf(rec);
        const seed = core.boutSeed(rec.id, opponent.id, rec.lifetimeBouts);
        const log = core.simulateFight(seed, me, opponent, 1);
        const won = log.result.winner === "a";
        const xp = core.xpForBout(won, me.level, opponent.level);
        const taken = new Set(doc.history.map((b) => b.id));
        let boutId = newId(at);
        for (let i = 0; taken.has(boutId); i++) boutId = newId(at + i + 1);
        const bout: BoutRecord = {
          id: boutId, at, seed, rulesVersion: 1, logVersion: 2, snapshotA: me, snapshotB: opponent,
          result: log.result, role: "attacker", fighterId: rec.id, xp, lineId: lineIdFor(seed), watched: false,
          before: { xp: rec.xp, boutsUsed: usedToday(rec, today) }, log,
        };
        const next = core.afterBout(rec, xp, today);
        return { doc: { ...put(doc, next), history: trimHistory([bout, ...doc.history]) }, value: ok(bout) };
      });
    },

    markWatched(boutId: string) {
      return store.commit((doc) => {
        const b = doc.history.find((h) => h.id === boutId);
        if (!b || b.watched) return { doc: null, value: undefined };
        return { doc: { ...doc, history: doc.history.map((h) => (h.id === boutId ? { ...h, watched: true } : h)) }, value: undefined };
      });
    },

    takeLevelUp(id: string, pick: Side2) {
      return store.commit<Result<void, "nothing-waiting">>((doc) => {
        const rec = find(doc, id);
        if (!rec || unwatchedOf(doc, id)) return { doc: null, value: fail("nothing-waiting" as const) };
        const next = core.afterPick(rec, pick);
        if (next === rec || next.picks.length === rec.picks.length) return { doc: null, value: fail("nothing-waiting" as const) };
        return { doc: put(doc, next), value: ok(undefined) };
      });
    },

    retire(id: string, typedName: string) {
      return store.commit<Result<void, "name-mismatch">>((doc) => {
        const rec = find(doc, id);
        if (!rec || !sameName(rec.name, typedName)) return { doc: null, value: fail("name-mismatch" as const) };
        const fighters = doc.fighters.filter((f) => f.id !== id);
        const activeId = doc.activeId === id ? (fighters[0]?.id ?? null) : doc.activeId;
        return { doc: { ...doc, fighters, retired: [rec, ...doc.retired], activeId }, value: ok(undefined) };
      });
    },

    setSettings(patch: Partial<Settings>) {
      return store.commit((doc) => ({ doc: { ...doc, settings: { ...doc.settings, ...patch } }, value: undefined }));
    },

    exportCode() {
      return encodeSave(store.doc);
    },

    async importCode(code: string) {
      const r = await decodeSave(code);
      if (!r.ok) return fail("bad-code" as const);
      await keepCurrent();
      return store.commit((doc) => ({ doc: { ...r.doc, rev: doc.rev }, value: ok(undefined) }));
    },

    async previewCode(code: string) {
      const r = await decodeSave(code);
      return r.ok ? summaryOf(r.doc) : null;
    },

    async listBackups() {
      return deps.backups ? (await deps.backups.list()).filter((b) => b.doc !== null) : [];
    },

    async restoreBackup(key: string) {
      const entry = deps.backups ? (await deps.backups.list()).find((b) => b.key === key) : undefined;
      if (!entry?.doc) return fail("bad-code" as const);
      const back = entry.doc;
      await keepCurrent();
      return store.commit((doc) => ({ doc: { ...back, rev: doc.rev }, value: ok(undefined) }));
    },

    newSave() {
      return store.commit(() => ({ doc: emptyDoc(clock.now()), value: undefined }));
    },
  };
}
