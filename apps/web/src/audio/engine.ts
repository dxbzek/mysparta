/**
 * The sound engine (fight-screen lane). One audio sprite (public/audio/sfx.mp3 with its map
 * sfx.json), loaded after the first tap and never on first paint (brief 3.13).
 *
 * The engine has no timer and no idea of the fight clock. The fight screen tells it to play a
 * sound at the frame the clock crosses that sound's cue (see cues.ts). Pitch never changes with
 * speed. While `enabled` is false nothing plays, but loading still happens on the first tap so
 * that turning sound on is instant.
 */
import type { SfxFamily } from "@rankzero/stage";

/** Fight families plus the three app sounds the brief lists. */
export type SfxName = SfxFamily | "ui-tap" | "card-flip" | "level-up";

export interface SpriteEntry { start: number; dur: number }   // ms in the decoded file
export interface SpriteMap { version: 1; file: string; families: Partial<Record<SfxName, SpriteEntry[]>> }

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
  readonly state: "idle" | "loading" | "ready" | "failed";
  enabled: boolean;
  /** Called from a user gesture. The first call starts loading; later calls only resume. */
  unlock(): Promise<void>;
  /** Plays one variation now. Unknown names and variants are ignored (a warning, once). */
  play(name: SfxName, variant: number): boolean;
  /** How many sounds `play` has started; for tests and the debug handle. */
  readonly played: number;
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
  let buffer: unknown = null;
  let map: SpriteMap | null = null;
  let loading: Promise<void> | null = null;
  let played = 0;
  const warned = new Set<string>();
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  const load = async (): Promise<void> => {
    state = "loading";
    try {
      ctx = host.createContext();
      const json = (await host.fetchJson(`${base}audio/sfx.json`)) as SpriteMap;
      const bytes = await host.fetchBytes(`${base}audio/${json.file}`);
      buffer = await ctx.decodeAudioData(bytes);
      map = json;
      state = "ready";
    } catch (error) {
      state = "failed";
      console.warn("audio: the sound sprite did not load", error);
    }
  };

  const engine: AudioEngine = {
    get state() { return state; },
    enabled: true,
    get played() { return played; },
    async unlock() {
      if (loading === null) loading = load();
      await loading;
      if (ctx && ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    },
    play(name, variant) {
      if (!engine.enabled || state !== "ready" || ctx === null || map === null) return false;
      const entry = map.families[name]?.[variant];
      if (!entry) {
        const key = `${name}:${variant}`;
        if (!warned.has(key)) { warned.add(key); console.warn(`audio: no sound for ${key}`); }
        return false;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
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
