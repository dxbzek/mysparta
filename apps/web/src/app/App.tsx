/**
 * The app (work package 5): the save, the routes and the screens around the bout.
 *
 * The Lead mounts it from main.tsx with ONE line, in the branch that is not a debug hash:
 *   mountApp(root);
 * (`import { mountApp } from "./app/App";`). Everything else, the stylesheet and the fonts
 * included, is loaded from here.
 */
import { Component, StrictMode, Suspense, lazy, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ComponentType, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../tokens.css";
import { api } from "@rankzero/core";
import type { CoreApi } from "@rankzero/core";
import type { Clock, OpponentSource } from "../contracts";
import { createGameActions } from "../state/actions";
import { deviceClock } from "../state/day";
import { idbKv, openIdb, localKv, resilientKv } from "../state/idb";
import type { Kv, KvTx } from "../state/idb";
import { LocalRivalSource } from "../state/opponents";
import { createBackups, createSaveStore, requestPersist } from "../state/slots";
import { createGameStore } from "../state/store";
import { encodeSave } from "../state/saveCode";
import { UI } from "../text/ui";
import { loadFonts } from "../ui/fonts";
import { BoutScreen } from "../screens/Bout/Bout";
import { CardScreen } from "../screens/Card/Card";
import { CreateScreen } from "../screens/Create/Create";
import { LockerScreen } from "../screens/Locker/Locker";
import { ReplayScreen } from "../screens/Replay/Replay";
import { SettingsSheet } from "../screens/Settings/Settings";
import { Unreadable } from "../screens/Settings/Unreadable";
import { reducedFrom } from "../fight/FightScreen";
import { GameContext, useGame, useStatus } from "./context";
import type { Game } from "./context";
import { ErrorBoundary } from "./ErrorBoundary";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { loadFullRig, useRigVersion } from "../seams/rig";
import { activeRecord, guard } from "./guards";
import { hrefOf, parseRoute, sameRoute } from "./router";
import type { Route } from "./router";
import css from "./app.module.css";

/**
 * A screen in its own chunk that can be fetched again: React keeps a failed `lazy` failed, so a
 * retry makes a fresh one.
 */
interface Chunk<P> { get(): ComponentType<P>; reset(): void; preload(): void }
/**
 * `get` returns ONE component type per load attempt, never a different one later: React unmounts a
 * screen whose element type changes, so a lazy wrapper that later turned into the screen itself
 * would reset the screen's state on the next re-render of the app (a toast, a save from another
 * tab). The first `get` decides: if the chunk had already arrived (prefetched), it is the screen
 * itself, so it mounts at once with no loading frame (the level-up cards deal in on time);
 * otherwise it is the lazy wrapper, which renders the screen without suspending once loaded.
 * `reset` (Retry) starts a new attempt.
 */
export function retryable<P extends object = object>(load: () => Promise<{ default: ComponentType<P> }>): Chunk<P> {
  let loaded: ComponentType<P> | null = null;
  const fetch = (): Promise<{ default: ComponentType<P> }> => load().then((m) => { loaded = m.default; return m; });
  let pinned: ComponentType<P> | null = null;
  return {
    get: () => (pinned ??= loaded ?? lazy(fetch)),
    reset: () => { pinned = null; },
    preload: () => { if (!loaded) void fetch().catch(() => undefined); },
  };
}

/** The Inventory, the Kit, the History, the level-up and the test arena are their own chunks: the first
 *  screen's JS stays inside its 180 KB budget. */
const InventoryChunk = retryable<object>(() => import("../screens/Inventory/Inventory").then((m) => ({ default: m.InventoryScreen })));
const SandboxChunk = retryable<object>(() => import("./debug/Sandbox").then((m) => ({ default: m.SandboxScreen })));
const KitChunk = retryable<{ tab: KitTab }>(() => import("../screens/Kit/Kit").then((m) => ({ default: m.KitScreen })));
const LevelUpChunk = retryable<object>(() => import("../screens/LevelUp/LevelUp").then((m) => ({ default: m.LevelUpScreen })));
const BoutsChunk = retryable<object>(() => import("../screens/Bouts/Bouts").then((m) => ({ default: m.BoutsScreen })));
type KitTab = Extract<Route, { name: "kit" }>["tab"];

/** One route's own error boundary: a chunk that did not load shows Retry, not the whole-app card. */
class RouteBoundary extends Component<{ children: ReactNode; onRetry(): void; onBack(): void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(error: Error): void {
    console.warn("Rank Zero: a screen did not load", error);
  }
  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className={css.recovery} role="alert">
        <Panel title={UI.recovery.chunkTitle}>
          <p className={css.recoveryLine}>{UI.recovery.chunkLine}</p>
          <div className={css.recoveryButtons}>
            <Button variant="primary" onClick={this.props.onRetry}>{UI.recovery.retry}</Button>
            <Button onClick={this.props.onBack}>{UI.recovery.back}</Button>
          </div>
        </Panel>
      </main>
    );
  }
}

function LazyRoute<P extends object>({ chunk, label, props }: { chunk: Chunk<P>; label: string; props?: P }) {
  const { go } = useGame();
  const [n, setN] = useState(0);
  const C = chunk.get() as ComponentType<object>;
  return (
    <RouteBoundary key={n} onRetry={() => { chunk.reset(); setN((x) => x + 1); }} onBack={() => go({ name: "locker" })}>
      <Suspense fallback={<main className={css.loading} aria-busy="true"><p>{label}</p></main>}><C {...(props ?? {})} /></Suspense>
    </RouteBoundary>
  );
}

export interface AppProps {
  /** The key-value store under the save. Default: IndexedDB, falling back to memory. */
  kv?: Kv;
  clock?: Clock;
  core?: CoreApi;
  opponents?: OpponentSource;
}

/** A Kv whose database opens later: the first call waits for it. */
function lazyKv(open: () => Promise<Kv>): Kv {
  let p: Promise<Kv> | null = null;
  return { atomic: <T,>(fn: (tx: KvTx) => Promise<T>) => (p ??= open()).then((kv) => kv.atomic(fn)) };
}

/**
 * IndexedDB, reopened once if a step fails, then local storage seeded with what was already read
 * (finding 11). If IndexedDB fails before anything was read and local storage holds no save, the
 * load reports "failed" (a retry screen), never "empty" (finding 41).
 */
async function defaultKv(): Promise<Kv> {
  const reopen = async (): Promise<Kv> => idbKv(await openIdb());
  const toLocal = (seed: ReadonlyMap<string, unknown>): Kv => localKv(undefined, seed);
  try {
    return resilientKv(await reopen(), toLocal, undefined, reopen);
  } catch (error) {
    console.warn("save: IndexedDB did not open here; trying once more, then local storage", error);
    return resilientKv({ atomic: () => Promise.reject(error) }, toLocal, undefined, reopen);
  }
}

/** The hash, plus a count of hash changes: A to B and back to A before React renders must still
 *  run the guards again, so the count, not the string, is what the guard effect watches. */
function useHash(): { hash: string; n: number } {
  const [state, setState] = useState(() => ({ hash: window.location.hash, n: 0 }));
  useEffect(() => {
    const on = (): void => setState((s) => ({ hash: window.location.hash, n: s.n + 1 }));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return state;
}

export function App(props: AppProps) {
  const [env] = useState(() => {
    const clock = props.clock ?? deviceClock();
    const core = props.core ?? api;
    const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("rankzero.save") : null;
    const kv = props.kv ?? lazyKv(defaultKv);
    const store = createGameStore(createSaveStore(kv), clock.now, (rev) => channel?.postMessage({ rev }));
    const actions = createGameActions({ store, clock, core, backups: createBackups(kv) });
    return { clock, core, store, actions, channel, opponents: props.opponents ?? new LocalRivalSource(core) };
  });
  const { store, clock } = env;
  const { status, notice } = useStatus(store);
  useMotionFlag(store);
  useFullRigAfterPaint();
  const [toasts, setToasts] = useState<string[]>([]);

  useEffect(() => {
    void loadFonts();
    void store.load().then(() => requestPersist()).catch(() => undefined);
    const ch = env.channel;
    if (!ch) return undefined;
    const on = (e: MessageEvent<{ rev?: number }>): void => {
      if (typeof e.data?.rev === "number" && e.data.rev > store.doc.rev) void store.reload();
    };
    ch.addEventListener("message", on);
    return () => ch.removeEventListener("message", on);
  }, [env, store]);

  const toast = useCallback((line: string) => setToasts((t) => [...t.filter((x) => x !== line), line].slice(-2)), []);
  useEffect(() => {
    if (notice) {
      toast(notice);
      store.clearNotice();
    }
  }, [notice, store, toast]);
  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const id = window.setTimeout(() => setToasts((t) => t.slice(1)), 5000);
    return () => window.clearTimeout(id);
  }, [toasts]);

  const go = useCallback((route: Route, opts?: { replace?: boolean }) => {
    const href = hrefOf(route);
    if (opts?.replace) location.replace(href);
    else location.hash = href;
  }, []);

  const game: Game = useMemo(() => ({ ...env, go, toast }), [env, go, toast]);

  // Guards run when the hash changes (and once the save is read). They never run on a save
  // change alone, so watching a bout does not throw the player off the result card.
  const { hash, n: hashN } = useHash();
  const ready = status.kind === "ready";
  const [route, setRoute] = useState<Route | null>(null);
  useEffect(() => {
    if (!ready) return;
    const asked = parseRoute(hash);
    const shown = guard(asked, store.doc, clock.today(), env.core);
    if (!sameRoute(asked, shown) || hash === "") location.replace(hrefOf(shown));
    setRoute(shown);
  }, [hash, hashN, ready, store, clock, env.core]);

  let body: ReactNode;
  if (status.kind === "loading" || (ready && route === null)) body = <main className={css.loading} aria-busy="true"><p>{UI.appName}</p></main>;
  else if (status.kind === "unreadable") body = <Unreadable backupKey={status.backupKey} />;
  else if (status.kind === "failed") body = <Unreadable backupKey={null} failed />;
  else body = <Screen key={hashN} route={route!} />;

  return (
    <GameContext.Provider value={game}>
      <ErrorBoundary exportCode={() => encodeSave(store.doc)}>
        {body}
      </ErrorBoundary>
      <div className={css.toasts} role="status" aria-live="polite">
        {toasts.map((t) => <p key={t} className={css.toast}>{t}</p>)}
      </div>
    </GameContext.Provider>
  );
}

/**
 * The content art (weapons, shields, pets, arenas) is its own chunk so the first screen does not
 * wait for it: start loading it once the first frame is on screen, and re-render the app when it
 * arrives, so icons and portraits drawn during render pick up the full art. A fight waits for it
 * in <RigGate>.
 */
function useFullRigAfterPaint(): void {
  useRigVersion();
  useEffect(() => {
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        void loadFullRig().catch((e: unknown) => console.warn("rig: the content art did not load yet", e));
        // the split screens too, so opening one later shows no loading frame
        for (const c of [LevelUpChunk, KitChunk, BoutsChunk, InventoryChunk]) c.preload();
      }, 0);
    });
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, []);
}

/**
 * `data-motion` on <html>: "full" or "reduce", from the setting (which may override the system).
 * Every screen animation in the app lane is written under `html[data-motion="full"]`, so the
 * reduced-motion setting turns all of them off at once (brief 3.15).
 */
function useMotionFlag(store: Game["store"]): void {
  const setting = useSyncExternalStore(store.subscribe, () => store.doc.settings.reducedMotion, () => store.doc.settings.reducedMotion);
  const [systemTick, setSystemTick] = useState(0);
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const on = (): void => setSystemTick((n) => n + 1);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = reducedFrom(setting) ? "reduce" : "full";
  }, [setting, systemTick]);
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "create": return <CreateScreen />;
    case "card": return <CardScreen />;
    case "bout": return <BoutScreen key={route.id} id={route.id} />;
    case "levelup": return <LazyRoute key="levelup" chunk={LevelUpChunk} label={UI.appName} />;
    case "kit": return <LazyRoute key="kit" chunk={KitChunk} label={UI.kit.title} props={{ tab: route.tab }} />;
    case "bouts": return <LazyRoute key="bouts" chunk={BoutsChunk} label={UI.history.title} />;
    case "inventory": return <LazyRoute key="inventory" chunk={InventoryChunk} label={UI.inventory.title} />;
    case "replay": return <ReplayScreen key={route.id} id={route.id} />;
    case "sandbox": return <LazyRoute key="sandbox" chunk={SandboxChunk} label={UI.sandbox.title} />;
    case "settings": return <SettingsRoute />;
    default: return <LockerScreen />;
  }
}

function SettingsRoute() {
  const { store, go } = useGame();
  const hasFighter = activeRecord(store.doc) !== undefined;
  return (
    <>
      {hasFighter ? <LockerScreen /> : <CreateScreen />}
      <SettingsSheet open onClose={() => go(hasFighter ? { name: "locker" } : { name: "create" })} />
    </>
  );
}

/**
 * A new deploy removes the old chunk files, so an open tab's next lazy import fails. Vite fires
 * `vite:preloadError` then: reload once to get the new build (the save is already written). A
 * second failure within a minute is left to the route's Retry, so an offline tab never loops.
 */
const PRELOAD_KEY = "rankzero.preloadReload";
export function reloadOnStaleChunks(win: Window, reload: () => void = () => win.location.reload(), now: () => number = Date.now): void {
  win.addEventListener("vite:preloadError", () => {
    try {
      const last = Number(win.sessionStorage.getItem(PRELOAD_KEY) ?? 0);
      if (now() - last < 60_000) return;
      win.sessionStorage.setItem(PRELOAD_KEY, String(now()));
    } catch {
      return;
    }
    reload();
  });
}

/** One line for main.tsx: `mountApp(root)`. */
export function mountApp(root: HTMLElement, props: AppProps = {}): void {
  // index.html paints the body dark before the CSS loads. Once the app runs, tokens.css owns the
  // page (concrete): an inline dark body put ink headings on asphalt at 1.1:1 (owner: "not visible").
  root.ownerDocument.body.style.removeProperty("background");
  reloadOnStaleChunks(root.ownerDocument.defaultView ?? window);
  createRoot(root).render(
    <StrictMode>
      <App {...props} />
    </StrictMode>,
  );
}
