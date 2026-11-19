/**
 * What every screen gets: the save as it is now, the actions, the clock, the rival source and
 * navigation. Screens never open the save store themselves.
 */
import { createContext, useContext, useSyncExternalStore } from "react";
import type { CoreApi } from "@rankzero/core";
import type { Clock, OpponentSource, SaveDoc } from "../contracts";
import type { AppActions } from "../state/actions";
import type { GameStore, StoreStatus } from "../state/store";
import type { Route } from "./router";

export interface Game {
  store: GameStore;
  actions: AppActions;
  clock: Clock;
  core: CoreApi;
  opponents: OpponentSource;
  go(route: Route, opts?: { replace?: boolean }): void;
  /** Shows one line in the toast strip. */
  toast(line: string): void;
}

export const GameContext = createContext<Game | null>(null);

export function useGame(): Game {
  const g = useContext(GameContext);
  if (!g) throw new Error("useGame: no GameContext");
  return g;
}

/** The save document, re-rendering on every change. */
export function useDoc(): SaveDoc {
  const { store } = useGame();
  return useSyncExternalStore(store.subscribe, () => store.doc, () => store.doc);
}

export function useStatus(store: GameStore): { status: StoreStatus; notice: string | null } {
  const status = useSyncExternalStore(store.subscribe, () => store.status, () => store.status);
  const notice = useSyncExternalStore(store.subscribe, () => store.notice, () => store.notice);
  return { status, notice };
}
