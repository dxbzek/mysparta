/**
 * The sound engine (fight-screen lane). Two audio sprites described by public/audio/sfx.json:
 * the core sprite (sfx.mp3: every set a stage family falls back to, and every pet's voice) and
 * the content sprite (sfx-content.mp3: the per-weapon, shield and pet-contact sets). Both load
 * after the first tap anywhere in the app, never on first paint (brief 3.13): the core first,
 * then the content. Until the content is in, a cue plays its family's core set (see cues.ts).
 *
 * The engine has no timer and no idea of the fight clock. The fight screen tells it to play a
 * sound at the frame the clock crosses that sound's cue (see cues.ts). Pitch never changes with
 * speed. While `enabled` is false nothing plays, and turning it off stops what is playing; loading
 * still happens on the first tap so that turning sound on is instant.
 *
 * Every sound goes through one master gain and a compressor set as a limiter, so overlapping
 * sounds cannot clip, and at most `MAX_VOICES` play at once (the oldest stops first).
 *
 * Mobile Safari: the context is created and resumed inside the gesture itself, a silent buffer
 * is played once to unlock output, and every later gesture, and the page becoming visible again,
 * resumes a context that is not "running" ("suspended", or the "interrupted" state iOS uses
 * after a call). While the context is not running nothing is started (a sound started on a
 * suspended context would wait and fire with every other one at the next tap).
 *
 * Phone networks drop requests: a failed load (or a response that is not ok) is tried again on a
 * later gesture, at least `RETRY_MS` after the last try and at most `MAX_TRIES` times; a content
 * file that failed is fetched again the same way, while the core sounds keep playing. A request
 * that hangs (no answer, no error) is given up after `LOAD_TIMEOUT_MS` and counts as a failure, so
 * the retry still happens. While a content file is on its way, later taps do not ask for it again.
 */
import type { SfxFamily } from "@rankzero/stage";

/** Fight families plus the three app sounds the brief lists. */
export type SfxName = SfxFamily | "ui-tap" | "card-flip" | "level-up";

/** ms in the decoded file; `f` is the index of the file in `files` (0 when absent). */
export interface SpriteEntry { start: number; dur: number; f?: number }
/** sfx.json version 2: named sound sets in one or more files, and the set each family uses. */
export interface SpriteMap { version: 2; files: string[]; sets: Record<string, SpriteEntry[]>; families: Partial<Record<SfxName, string>> }

/** At most this many sounds play at once; a new one stops the oldest. */
export const MAX_VOICES = 10;
/** A failed file is tried again on a gesture at least this long after its last try (doubling). */
export const RETRY_MS = 2000;
/** Tries per file before the engine gives up for the session. */
export const MAX_TRIES = 5;
/** A request with no answer after this long is aborted and counts as failed. */
export const LOAD_TIMEOUT_MS = 20_000;

/** The parts of Web Audio the engine calls. A test passes a fake. */
export interface AudioHost {
  createContext(): AudioContextLike;
  /** `signal` aborts the request when the engine gives up on it (see LOAD_TIMEOUT_MS). */
  fetchBytes(url: string, signal?: AbortSignal): Promise<ArrayBuffer>;
  fetchJson(url: string, signal?: AbortSignal): Promise<unknown>;
  /** Timers for the load timeout (default setTimeout / clearTimeout). */
  setTimer?(fn: () => void, ms: number): unknown;
  clearTimer?(id: unknown): void;
  /** ms clock for the retry backoff (default Date.now). */
  now?(): number;
}
export interface AudioParamLike { value: number }
export interface AudioNodeLike { connect(dest: unknown): unknown }
export interface SourceLike {
  buffer: unknown;
  connect(dest: unknown): unknown;
  start(when: number, offset: number, duration: number): void;
  stop?(when?: number): void;
  onended?: (() => void) | null;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  resume(): Promise<void>;
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  createBufferSource(): SourceLike;
  readonly destination: unknown;
  /** Optional in fakes; a browser always has them. */
  createGain?(): AudioNodeLike & { gain: AudioParamLike };
  createDynamicsCompressor?(): AudioNodeLike & Partial<Record<"threshold" | "knee" | "ratio" | "attack" | "release", AudioParamLike>>;
  createBuffer?(channels: number, length: number, rate: number): unknown;
}

export interface AudioEngine {
  /** "ready" once the core sprite is in; the content sprite may still be loading. */
  readonly state: "idle" | "loading" | "ready" | "failed";
  /** False stops every sound playing and plays nothing until true again. */
  enabled: boolean;
  /** Called from a user gesture. The first call creates the context and starts loading; every
   *  call resumes a context that is not running. */
  unlock(): Promise<void>;
  /** Resumes a context that exists and is not running (page visible again). Never loads. */
  resume(): Promise<void>;
  /** Plays one sound of a set (or of a family's set) now, or `delayMs` from now on the audio
   *  clock (a cue the fight clock reaches during the next frame is scheduled at its own moment,
   *  audio/cues.ts). Unknown names and variants, and sets whose file has not loaded yet, are
   *  ignored. */
  play(name: string, variant: number, delayMs?: number): boolean;
  /** How many sounds `name` has that can play now (0 when unknown or its file is not in yet). */
  size(name: string): number;
  /** How many sounds `play` has started; for tests and the debug handle. */
  readonly played: number;
  /** How many sounds are playing now (for tests). */
  readonly playing: number;
  /** Settles when the content sprite has loaded or failed (after `unlock`). */
  content(): Promise<void>;
}

/** A fetch that throws on a response that is not ok, so a 404 page is never decoded as sound. */
const fetchOk = async (url: string, signal?: AbortSignal): Promise<Response> => {
  const res = await (signal ? fetch(url, { signal }) : fetch(url));
  if (!res.ok) throw new Error(`audio: ${url} answered ${res.status}`);
  return res;
};
export const browserFetchBytes = async (url: string, signal?: AbortSignal): Promise<ArrayBuffer> => (await fetchOk(url, signal)).arrayBuffer();
export const browserFetchJson = async (url: string, signal?: AbortSignal): Promise<unknown> => (await fetchOk(url, signal)).json();

const browserHost = (): AudioHost => ({
  createContext: () => {
    const Ctor = (globalThis as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike }).AudioContext
      ?? (globalThis as { webkitAudioContext?: new () => AudioContextLike }).webkitAudioContext;
    if (!Ctor) throw new Error("no Web Audio");
    return new Ctor();
  },
  fetchBytes: browserFetchBytes,
  fetchJson: browserFetchJson,
});

export function createAudioEngine(baseUrl: string, host: AudioHost = browserHost()): AudioEngine {
  let state: AudioEngine["state"] = "idle";
  let ctx: AudioContextLike | null = null;
  let out: unknown = null;              // the master gain (the destination in a bare fake)
  const buffers: unknown[] = [];
  let map: SpriteMap | null = null;
  let loading: Promise<void> | null = null;
  let contentLoad: Promise<void> = Promise.resolve();
  let contentBusy = false;
  let played = 0;
  let enabled = true;
  const active: SourceLike[] = [];
  const warned = new Set<string>();
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const now = (): number => (host.now ? host.now() : Date.now());
  /** Tries and the earliest next try, for the core (sfx.json + file 0) and each content file. */
  const tries = new Map<number | "core", { n: number; next: number }>();
  const mayTry = (key: number | "core"): boolean => {
    const t = tries.get(key);
    return t === undefined || (t.n < MAX_TRIES && now() >= t.next);
  };
  const tried = (key: number | "core"): void => {
    const n = (tries.get(key)?.n ?? 0) + 1;
    tries.set(key, { n, next: now() + RETRY_MS * 2 ** (n - 1) });
  };

  /** One request with a deadline: aborted and rejected when no answer came in LOAD_TIMEOUT_MS (a
   *  request that hangs on a phone network must fail, or nothing ever retries it). */
  const timed = <T>(url: string, ask: (signal?: AbortSignal) => Promise<T>): Promise<T> => {
    const abort = typeof AbortController === "undefined" ? null : new AbortController();
    const setTimer = host.setTimer ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
    const clearTimer = host.clearTimer ?? ((id: unknown): void => clearTimeout(id as ReturnType<typeof setTimeout>));
    return new Promise<T>((resolve, reject) => {
      const timer = setTimer(() => {
        abort?.abort();
        reject(new Error(`audio: ${url} did not answer in ${LOAD_TIMEOUT_MS} ms`));
      }, LOAD_TIMEOUT_MS);
      ask(abort?.signal).then(
        (v) => { clearTimer(timer); resolve(v); },
        (e: unknown) => { clearTimer(timer); reject(e instanceof Error ? e : new Error(String(e))); },
      );
    });
  };

  const fetchFile = async (i: number): Promise<void> => {
    if (ctx === null || map === null) return;
    const url = `${base}audio/${map.files[i]}`;
    const bytes = await timed(url, (signal) => host.fetchBytes(url, signal));
    buffers[i] = await ctx.decodeAudioData(bytes);
  };

  /** The context and its output chain: sources -> master gain -> limiter -> speakers. */
  const open = (): boolean => {
    if (ctx !== null) return true;
    try {
      const c = host.createContext();
      ctx = c;
      out = c.destination;
      if (c.createGain && c.createDynamicsCompressor) {
        const master = c.createGain();
        master.gain.value = 1;
        const lim = c.createDynamicsCompressor();
        const set = (p: AudioParamLike | undefined, v: number): void => { if (p) p.value = v; };
        set(lim.threshold, -6); set(lim.knee, 4); set(lim.ratio, 12); set(lim.attack, 0.002); set(lim.release, 0.12);
        master.connect(lim);
        lim.connect(c.destination);
        out = master;
      }
      // iOS: one silent sample played inside the gesture unlocks output for the page
      if (c.createBuffer) {
        const s = c.createBufferSource();
        s.buffer = c.createBuffer(1, 1, 22050);
        s.connect(c.destination);
        s.start(0, 0, 0);
      }
      return true;
    } catch (error) {
      state = "failed";
      console.warn("audio: Web Audio is not available", error);
      return false;
    }
  };

  const wake = (): Promise<void> => {
    if (ctx === null || ctx.state === "running" || ctx.state === "closed") return Promise.resolve();
    return ctx.resume().catch(() => undefined);
  };

  /** The content files not in yet, each when its backoff allows; never holds up `unlock`. A
   *  failure leaves the core sounds playing and is tried again on a later gesture. */
  const loadContent = (): void => {
    // one content load at a time: a tap while a file is on its way must not queue the same file
    // again behind it (it would be downloaded and decoded twice, and burn the file's tries)
    if (contentBusy) return;
    const due: number[] = [];
    for (let i = 1; i < (map?.files.length ?? 0); i++) if (buffers[i] === undefined && mayTry(i)) due.push(i);
    if (due.length === 0) return;
    contentBusy = true;
    contentLoad = contentLoad.then(async () => {
      for (const i of due) {
        if (buffers[i] !== undefined) continue;
        tried(i);
        await fetchFile(i).catch((error: unknown) => console.warn(`audio: ${map?.files[i]} did not load`, error));
      }
    }).finally(() => { contentBusy = false; });
  };

  const load = async (): Promise<void> => {
    state = "loading";
    tried("core");
    try {
      const url = `${base}audio/sfx.json`;
      map = (await timed(url, (signal) => host.fetchJson(url, signal))) as SpriteMap;
      await fetchFile(0);
      state = "ready";
    } catch (error) {
      state = "failed";
      map = null;
      loading = null;            // a later gesture tries again (see `unlock`)
      console.warn("audio: the sound sprite did not load", error);
      return;
    }
    loadContent();
  };

  const stop = (s: SourceLike): void => {
    try { s.stop?.(); } catch { /* already ended */ }
  };

  const listOf = (name: string): SpriteEntry[] | undefined => {
    if (map === null) return undefined;
    const own = map.sets[name];
    if (own !== undefined) return own;
    const alias = map.families[name as SfxName];
    return alias !== undefined ? map.sets[alias] : undefined;
  };
  const ready = (e: SpriteEntry): boolean => buffers[e.f ?? 0] !== undefined;

  const engine: AudioEngine = {
    get state() { return state; },
    get enabled() { return enabled; },
    set enabled(on: boolean) {
      if (enabled && !on) for (const s of active.splice(0)) stop(s);
      enabled = on;
    },
    get played() { return played; },
    get playing() { return active.length; },
    unlock() {
      // create and resume inside the gesture itself (iOS needs both in the same task)
      if (ctx === null && (state !== "idle" || !open())) return Promise.resolve();
      const resumed = wake();
      if (loading === null && mayTry("core")) loading = load();
      else if (state === "ready") loadContent();
      // the core is in after this; the content keeps loading (see `content`)
      return Promise.all([loading ?? Promise.resolve(), resumed]).then(() => wake());
    },
    resume() { return wake(); },
    content() { return (loading ?? Promise.resolve()).then(() => contentLoad); },
    size(name) {
      const list = listOf(name);
      return list !== undefined && list.length > 0 && ready(list[0]!) ? list.length : 0;
    },
    play(name, variant, delayMs = 0) {
      if (!enabled || state !== "ready" || ctx === null || map === null) return false;
      // a suspended or interrupted context would hold the sound and release it with the rest at
      // the next tap: skip it, and ask to resume so the next frame can play
      if (ctx.state !== "running") { void wake(); return false; }
      const entry = listOf(name)?.[variant];
      if (!entry) {
        const key = `${name}:${variant}`;
        if (!warned.has(key)) { warned.add(key); console.warn(`audio: no sound for ${key}`); }
        return false;
      }
      if (!ready(entry)) return false;
      while (active.length >= MAX_VOICES) stop(active.shift()!);
      const src = ctx.createBufferSource();
      src.buffer = buffers[entry.f ?? 0];
      src.connect(out);
      src.onended = () => {
        const i = active.indexOf(src);
        if (i >= 0) active.splice(i, 1);
      };
      src.start(delayMs > 0 ? ctx.currentTime + delayMs / 1000 : 0, entry.start / 1000, entry.dur / 1000);
      active.push(src);
      played += 1;
      return true;
    },
  };
  return engine;
}

type Listening = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/**
 * Unlocks on every pointer, touch or key gesture anywhere (the first starts loading, later ones
 * resume a context the system suspended or interrupted), and resumes when the page becomes
 * visible again. Mount it once at the app root. Returns a remover.
 */
export function unlockOnGestures(
  engine: AudioEngine,
  target: Listening = globalThis as unknown as EventTarget,
  doc: (Listening & { visibilityState?: string }) | null = typeof document === "undefined" ? null : document,
): () => void {
  const go = (): void => { void engine.unlock(); };
  const shown = (): void => { if (doc?.visibilityState !== "hidden") void engine.resume(); };
  const kinds = ["pointerdown", "touchend", "keydown"] as const;
  for (const k of kinds) target.addEventListener(k, go);
  doc?.addEventListener("visibilitychange", shown);
  return () => {
    for (const k of kinds) target.removeEventListener(k, go);
    doc?.removeEventListener("visibilitychange", shown);
  };
}

let shared: AudioEngine | null = null;
/** The app's one engine. The sprite path follows the site's base path. */
export function sharedAudio(): AudioEngine {
  if (shared === null) shared = createAudioEngine(import.meta.env.BASE_URL ?? "./");
  return shared;
}
