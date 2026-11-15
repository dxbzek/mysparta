/**
 * The sound engine (fight-screen lane). Two audio sprites described by public/audio/sfx.json:
 * the core sprite (sfx.mp3: every set a stage family falls back to) and the content sprite
 * (sfx-content.mp3: the per-weapon, shield and pet sets). Both load after the first tap, never on
 * first paint (brief 3.13): the core first, then the content. Until the content is in, a cue
 * plays its family's core set (see cues.ts).
 *
 * The engine has no timer and no idea of the fight clock. The fight screen tells it to play a
 * sound at the frame the clock crosses that sound's cue (see cues.ts). Pitch never changes with
 * speed. While `enabled` is false nothing plays, but loading still happens on the first tap so
 * that turning sound on is instant.
 */
import type { SfxFamily } from "@rankzero/stage";

/** Fight families plus the three app sounds the brief lists. */
export type SfxName = SfxFamily | "ui-tap" | "card-flip" | "level-up";

/** ms in the decoded file; `f` is the index of the file in `files` (0 when absent). */
export interface SpriteEntry { start: number; dur: number; f?: number }
/** sfx.json version 2: named sound sets in one or more files, and the set each family uses. */
export interface SpriteMap { version: 2; files: string[]; sets: Record<string, SpriteEntry[]>; families: Partial<Record<SfxName, string>> }

/** The parts of Web Audio the engine calls. A test passes a fake. */
export interface AudioHost {
  createContext(): AudioContextLike;
  fetchBytes(url: string): Promise<ArrayBuffer>;
  fetchJson(url: string): Promise<unknown>;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  resume(): Promise<void>;
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  createBufferSource(): { buffer: unknown; connect(dest: unknown): unknown; start(when: number, offset: number, duration: number): void };
  readonly destination: unknown;
}

export interface AudioEngine {
  /** "ready" once the core sprite is in; the content sprite may still be loading. */
  readonly state: "idle" | "loading" | "ready" | "failed";
  enabled: boolean;
  /** Called from a user gesture. The first call starts loading; later calls only resume. */
  unlock(): Promise<void>;
  /** Plays one sound of a set (or of a family's set) now. Unknown names and variants, and sets
   *  whose file has not loaded yet, are ignored. */
  play(name: string, variant: number): boolean;
  /** How many sounds `name` has that can play now (0 when unknown or its file is not in yet). */
  size(name: string): number;
  /** How many sounds `play` has started; for tests and the debug handle. */
  readonly played: number;
  /** Settles when the content sprite has loaded or failed (after `unlock`). */
  content(): Promise<void>;
}

const browserHost = (): AudioHost => ({
  createContext: () => {
    const Ctor = (globalThis as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike }).AudioContext
      ?? (globalThis as { webkitAudioContext?: new () => AudioContextLike }).webkitAudioContext;
    if (!Ctor) throw new Error("no Web Audio");
    return new Ctor();
  },
  fetchBytes: async (url) => (await fetch(url)).arrayBuffer(),
  fetchJson: async (url) => (await fetch(url)).json(),
});

export function createAudioEngine(baseUrl: string, host: AudioHost = browserHost()): AudioEngine {
  let state: AudioEngine["state"] = "idle";
  let ctx: AudioContextLike | null = null;
  const buffers: unknown[] = [];
  let map: SpriteMap | null = null;
  let loading: Promise<void> | null = null;
  let contentLoad: Promise<void> = Promise.resolve();
  let played = 0;
  const warned = new Set<string>();
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  const fetchFile = async (i: number): Promise<void> => {
    if (ctx === null || map === null) return;
    const bytes = await host.fetchBytes(`${base}audio/${map.files[i]}`);
    buffers[i] = await ctx.decodeAudioData(bytes);
  };

  const load = async (): Promise<void> => {
    state = "loading";
    try {
      ctx = host.createContext();
      map = (await host.fetchJson(`${base}audio/sfx.json`)) as SpriteMap;
      await fetchFile(0);
      state = "ready";
    } catch (error) {
      state = "failed";
      console.warn("audio: the sound sprite did not load", error);
      return;
    }
    // the content sprite, after the core and without holding up `unlock`; a failure here
    // leaves the core sounds playing
    contentLoad = (async () => {
      for (let i = 1; i < (map?.files.length ?? 0); i++) {
        await fetchFile(i).catch((error: unknown) => console.warn(`audio: ${map?.files[i]} did not load`, error));
      }
    })();
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
    enabled: true,
    get played() { return played; },
    async unlock() {
      if (loading === null) loading = load();
      await loading;             // the core is in; the content keeps loading (see `content`)
      if (ctx && ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    },
    content() { return loading === null ? Promise.resolve() : loading.then(() => contentLoad); },
    size(name) {
      const list = listOf(name);
      return list !== undefined && list.length > 0 && ready(list[0]!) ? list.length : 0;
    },
    play(name, variant) {
      if (!engine.enabled || state !== "ready" || ctx === null || map === null) return false;
      const entry = listOf(name)?.[variant];
      if (!entry) {
        const key = `${name}:${variant}`;
        if (!warned.has(key)) { warned.add(key); console.warn(`audio: no sound for ${key}`); }
        return false;
      }
      if (!ready(entry)) return false;
      const src = ctx.createBufferSource();
      src.buffer = buffers[entry.f ?? 0];
      src.connect(ctx.destination);
      src.start(0, entry.start / 1000, entry.dur / 1000);
      played += 1;
      return true;
    },
  };
  return engine;
}

/** Starts loading on the first pointer or key press anywhere, once. Returns a remover. */
export function unlockOnFirstGesture(engine: AudioEngine, target: Pick<EventTarget, "addEventListener" | "removeEventListener"> = globalThis as unknown as EventTarget): () => void {
  const go = (): void => {
    remove();
    void engine.unlock();
  };
  const remove = (): void => {
    target.removeEventListener("pointerdown", go);
    target.removeEventListener("keydown", go);
  };
  target.addEventListener("pointerdown", go);
  target.addEventListener("keydown", go);
  return remove;
}

let shared: AudioEngine | null = null;
/** The app's one engine. The sprite path follows the site's base path. */
export function sharedAudio(): AudioEngine {
  if (shared === null) shared = createAudioEngine(import.meta.env.BASE_URL ?? "./");
  return shared;
}
