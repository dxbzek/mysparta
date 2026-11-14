/** Shared set-up for the state tests: a game on a fresh IndexedDB (fake-indexeddb) or in memory. */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { api } from "@rankzero/core";
import type { FighterSnapshot } from "@rankzero/core";
import { createGameActions } from "../../src/state/actions";
import type { AppActions } from "../../src/state/actions";
import { fixedClock } from "../../src/state/day";
import { idbKv, memoryKv, openIdb } from "../../src/state/idb";
import type { Kv } from "../../src/state/idb";
import { createSaveStore } from "../../src/state/slots";
import { createGameStore } from "../../src/state/store";
import type { GameStore } from "../../src/state/store";
import { LocalRivalSource } from "../../src/state/opponents";

/** 15 Nov 2026, 10:00 local. */
export const T0 = new Date(2026, 10, 15, 10, 0, 0).getTime();
export const DAY_MS = 24 * 3600 * 1000;

export interface Game { kv: Kv; store: GameStore; actions: AppActions; clock: ReturnType<typeof fixedClock> }

export async function idbGame(factory: IDBFactory = new IDBFactory()): Promise<Game & { factory: IDBFactory }> {
  const db = await openIdb(factory);
  const kv = idbKv(db);
  return { ...(await gameOn(kv)), factory };
}

export async function gameOn(kv: Kv, clock = fixedClock(T0)): Promise<Game> {
  let n = 0;
  const store = createGameStore(createSaveStore(kv), clock.now);
  await store.load();
  const actions = createGameActions({ store, clock, newId: () => `ID${String(++n).padStart(4, "0")}${Math.random().toString(36).slice(2, 8)}` });
  return { kv, store, actions, clock };
}

export async function memGame(): Promise<Game & { kv: ReturnType<typeof memoryKv> }> {
  const kv = memoryKv();
  return { ...(await gameOn(kv)), kv };
}

export async function rival(g: Game, id: string, i = 0): Promise<FighterSnapshot> {
  const rec = g.store.doc.fighters.find((f) => f.id === id)!;
  const hand = await new LocalRivalSource().hand(rec, g.clock.today());
  return hand[i % hand.length]!;
}

/** Plays and watches bouts until a level-up waits. Returns the number played. */
export async function playUntilLevelUp(g: Game, id: string): Promise<number> {
  for (let n = 1; n <= 8; n++) {
    const r = await g.actions.startBout(id, await rival(g, id, n));
    if (!r.ok) throw new Error(`bout refused: ${r.error}`);
    await g.actions.markWatched(r.value.id);
    const rec = g.store.doc.fighters.find((f) => f.id === id)!;
    if (api.sheetOf(rec).levelUpWaiting) return n;
  }
  throw new Error("no level-up in 8 bouts");
}
