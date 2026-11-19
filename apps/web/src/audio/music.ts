/**
 * Music (plan 13.17; owner, 19 Nov 2026: "We should have music or even like proper sound effects
 * too"). Three loops and four stings described by public/audio/music.json (tools/build-audio.mjs):
 *
 *   menu            every screen but the fight (the Locker, the Kit, Create, ...)
 *   fight-calm      the fight, while both scrappers are healthy
 *   fight-intense   the same loop, busier: crossfaded in (equal power) as HP drops
 *   ko              on the knockout blow; the fight loops fade out under it ("post")
 *   win, lose       on the result (the stage's win and loss cues)
 *   level-up        when the level-up screen opens
 *
 * Two parts. `createMusicDirector` is the state machine: the scene, the fight intensity, on/off,
 * which loop plays at what gain, when the two fight layers start (always in step, so the crossfade
 * never jumps the beat), stings and ducking. It drives a `MusicMixer`; the tests drive it with a
 * fake. `createWebMixer` is the mixer on the engine's Web Audio context: each loop an
 * AudioBufferSourceNode with `loop` on and the measured loop points (no gap, unlike an <audio>
 * element), through its own gain, then a duck gain, then the music volume.
 *
 * Loading: nothing before the first gesture (the engine's sound-on rule), and nothing while music
 * is off (sound off, music volume 0, or the browser's data saver). Each file loads the first time
 * its scene needs it: the menu loop and the level-up sting on the menu, the fight loops and the ko,
 * win and lose stings when a fight opens. So the first load and the budgets are untouched.
 */
import type { AudioContextLike, AudioNodeLike, AudioParamLike } from "./engine";

export type Scene = "menu" | "fight" | "post";
export type TrackId = "menu" | "fight-calm" | "fight-intense";
export type StingId = "ko" | "win" | "lose" | "level-up";
export const TRACKS: readonly TrackId[] = ["menu", "fight-calm", "fight-intense"];
export const STINGS: readonly StingId[] = ["ko", "win", "lose", "level-up"];

/** music.json version 1: seconds in the decoded file. */
export interface MusicMap {
  version: 1;
  tracks: Partial<Record<TrackId, { file: string; loopStart: number; loopEnd: number }>>;
  stings: Partial<Record<StingId, { file: string; start: number; dur: number }>>;
}

/** Fade times in seconds. */
export const FADE = { scene: 1.2, post: 1.6, layer: 2.0, off: 0.35 } as const;
/** Ducking: a sting holds the loops at `sting` gain for its length; a big impact dips them to
 *  `impact` for `impactHold` s. Attack and release in seconds. */
export const DUCK = { sting: 0.25, stingAttack: 0.05, stingRelease: 0.9, impact: 0.55, impactAttack: 0.012, impactHold: 0.12, impactRelease: 0.45 } as const;
/** An intensity change smaller than this is ignored (HP moves every frame). */
export const INTENSITY_STEP = 0.06;
/** Which files each scene loads. */
export const SCENE_FILES: Readonly<Record<Scene, readonly (TrackId | StingId)[]>> = {
  menu: ["menu", "level-up"],
  fight: ["fight-calm", "fight-intense", "ko", "win", "lose"],
  post: ["win", "lose", "ko"],
};

/** The gain each loop should have. Equal-power crossfade between the two fight layers; a map with
 *  no intense layer plays the calm one at full gain. Pure. */
export function loopTargets(scene: Scene, intensity: number, hasIntense = true): Record<TrackId, number> {
  const i = Math.max(0, Math.min(1, intensity));
  const fight = scene === "fight";
  return {
    menu: scene === "menu" ? 1 : 0,
    "fight-calm": fight ? (hasIntense ? Math.cos((i * Math.PI) / 2) : 1) : 0,
    "fight-intense": fight && hasIntense ? Math.sin((i * Math.PI) / 2) : 0,
  };
}

/** The fight's intensity from the HP of the two scrappers (fractions 0 to 1): calm while both are
 *  above 85%, full when the lower one is at 25% or less. Pure. */
export function intensityFromHp(fractions: readonly number[]): number {
  if (fractions.length === 0) return 0;
  const low = Math.min(...fractions);
  return Math.max(0, Math.min(1, (0.85 - low) / 0.6));
}

/** What the director needs from the audio side. Times in seconds on the audio clock. */
export interface MusicMixer {
  now(): number;
  /** In music.json (false until the map has loaded, or when the slot is missing). */
  available(id: TrackId | StingId): boolean;
  loaded(id: TrackId | StingId): boolean;
  /** Starts loading (the map first when needed); the mixer calls the director's `onLoaded`. */
  load(id: TrackId | StingId): void;
  loopLength(id: TrackId): number;
  /** Starts the loop at `when`, `offset` seconds into its period; replaces a source still playing. */
  start(id: TrackId, when: number, offset: number): void;
  stop(id: TrackId, when: number): void;
  /** Ramps the loop's own gain to `value` over `fade` seconds from now. */
  gain(id: TrackId, value: number, fade: number): void;
  /** Plays the sting at `when` (not ducked); returns its length in seconds. */
  sting(id: StingId, when: number): number;
  /** Dips the loops (not the stings) to `depth`, holds, and comes back to 1. */
  duck(depth: number, attack: number, hold: number, release: number): void;
}

export interface MusicDirector {
  readonly scene: Scene;
  readonly intensity: number;
  /** On: sound on, music volume over 0, the engine unlocked, music allowed. Off fades out and
   *  stops every loop and loads nothing. */
  readonly on: boolean;
  setScene(scene: Scene): void;
  setIntensity(x: number): void;
  setOn(on: boolean): void;
  /** Plays a sting and ducks the loops under it. False (and starts loading it) when music is off
   *  or the sting is not in yet: the caller then plays its own sound. */
  sting(id: StingId): boolean;
  /** A big impact: the loops dip briefly (not under a sting's duck). */
  impact(): void;
  /** The mixer calls this when a file has loaded (or the map, with no id). */
  onLoaded(id?: TrackId | StingId): void;
  /** For tests: loops playing now and the time each period started. */
  readonly playing: ReadonlyMap<TrackId, number>;
}

export function createMusicDirector(mixer: MusicMixer): MusicDirector {
  let scene: Scene = "menu";
  let intensity = 0;
  let on = false;
  let stingDuckUntil = -Infinity;
  /** Loop -> the audio time its period 0 started (start time minus offset). */
  const playing = new Map<TrackId, number>();

  const want = (): void => {
    if (!on) return;
    for (const id of SCENE_FILES[scene]) if (!mixer.loaded(id)) mixer.load(id);
  };

  const apply = (fade: number): void => {
    const targets = loopTargets(scene, intensity, mixer.available("fight-intense"));
    const now = mixer.now();
    for (const id of TRACKS) {
      const t = on ? targets[id] : 0;
      if (t > 0) {
        if (!mixer.available(id) || !mixer.loaded(id)) continue;
        if (!playing.has(id)) {
          const when = now + 0.04;
          // the two fight layers run in step: a layer that starts late joins at the other's phase
          const partner: TrackId | null = id === "fight-calm" ? "fight-intense" : id === "fight-intense" ? "fight-calm" : null;
          const p0 = partner !== null ? playing.get(partner) : undefined;
          const len = mixer.loopLength(id);
          const offset = p0 !== undefined && len > 0 ? (((when - p0) % len) + len) % len : 0;
          mixer.gain(id, 0, 0);
          mixer.start(id, when, offset);
          playing.set(id, when - offset);
        }
        mixer.gain(id, t, fade);
      } else if (playing.has(id)) {
        mixer.gain(id, 0, fade);
        mixer.stop(id, now + fade + 0.05);
        playing.delete(id);
      }
    }
  };

  return {
    get scene() { return scene; },
    get intensity() { return intensity; },
    get on() { return on; },
    get playing() { return playing; },
    setScene(next) {
      if (next === scene) return;
      const was = scene;
      scene = next;
      if (next === "fight" && was !== "fight") intensity = 0;
      want();
      apply(next === "post" ? FADE.post : FADE.scene);
    },
    setIntensity(x) {
      const v = Math.max(0, Math.min(1, x));
      if (Math.abs(v - intensity) < INTENSITY_STEP && !(v === 0 && intensity !== 0) && !(v === 1 && intensity !== 1)) return;
      intensity = v;
      if (scene === "fight") apply(FADE.layer);
    },
    setOn(next) {
      if (next === on) return;
      on = next;
      want();
      apply(on ? FADE.scene : FADE.off);
    },
    sting(id) {
      if (!on || !mixer.available(id)) return false;
      if (!mixer.loaded(id)) { mixer.load(id); return false; }
      const now = mixer.now();
      const dur = mixer.sting(id, now);
      mixer.duck(DUCK.sting, DUCK.stingAttack, dur, DUCK.stingRelease);
      stingDuckUntil = now + DUCK.stingAttack + dur + DUCK.stingRelease;
      return true;
    },
    impact() {
      if (!on || playing.size === 0 || mixer.now() < stingDuckUntil) return;
      mixer.duck(DUCK.impact, DUCK.impactAttack, DUCK.impactHold, DUCK.impactRelease);
    },
    onLoaded() {
      want();
      apply(FADE.scene);
    },
  };
}

// ---- the Web Audio mixer

interface RampParam extends AudioParamLike {
  cancelScheduledValues?(t: number): unknown;
  setValueAtTime?(v: number, t: number): unknown;
  linearRampToValueAtTime?(v: number, t: number): unknown;
}
interface GainLike extends AudioNodeLike { gain: RampParam }
interface LoopSource {
  buffer: unknown;
  loop?: boolean; loopStart?: number; loopEnd?: number;
  connect(dest: unknown): unknown;
  start(when: number, offset?: number, duration?: number): void;
  stop?(when?: number): void;
}

/** Sets `p` to `v` over `fade` seconds from `now` (at once when the param cannot ramp). */
export function ramp(p: RampParam, v: number, now: number, fade: number): void {
  if (fade <= 0 || !p.linearRampToValueAtTime || !p.setValueAtTime) {
    p.cancelScheduledValues?.(now);
    p.setValueAtTime?.(v, now);
    p.value = v;
    return;
  }
  p.cancelScheduledValues?.(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(v, now + fade);
}

export interface WebMixerDeps {
  ctx: AudioContextLike;
  /** The music volume node; the mixer connects its duck gain and its stings here. */
  out: unknown;
  /** The audio folder, ending in "/" (the site's base + "audio/"). */
  base: string;
  fetchJson(url: string): Promise<unknown>;
  fetchBytes(url: string): Promise<ArrayBuffer>;
  /** Called after each load; the engine passes the director's onLoaded. */
  onLoaded(id?: TrackId | StingId): void;
  now?(): number;
}

/** A failed file (or map) is tried again at most this many times, this long apart (ms). */
export const MUSIC_RETRY = { tries: 3, ms: 4000 } as const;

export function createWebMixer(d: WebMixerDeps): MusicMixer {
  const ctx = d.ctx;
  const mk = (): GainLike => (ctx.createGain as () => GainLike)();
  const duck = mk();
  duck.gain.value = 1;
  duck.connect(d.out);
  const gains = new Map<TrackId, GainLike>();
  const sources = new Map<TrackId, LoopSource>();
  const buffers = new Map<TrackId | StingId, unknown>();
  const busy = new Set<TrackId | StingId | "map">();
  const fails = new Map<TrackId | StingId | "map", { n: number; at: number }>();
  let map: MusicMap | null = null;
  const wall = (): number => (d.now ? d.now() : Date.now());
  const mayTry = (k: TrackId | StingId | "map"): boolean => {
    const f = fails.get(k);
    return f === undefined || (f.n < MUSIC_RETRY.tries && wall() - f.at >= MUSIC_RETRY.ms);
  };
  const failed = (k: TrackId | StingId | "map", e: unknown): void => {
    fails.set(k, { n: (fails.get(k)?.n ?? 0) + 1, at: wall() });
    console.warn(`music: ${k} did not load`, e);
  };
  const gainOf = (id: TrackId): GainLike => {
    let g = gains.get(id);
    if (g === undefined) {
      g = mk();
      g.gain.value = 0;
      g.connect(duck);
      gains.set(id, g);
    }
    return g;
  };
  const entry = (id: TrackId | StingId): { file: string } | undefined =>
    map === null ? undefined : (TRACKS as readonly string[]).includes(id) ? map.tracks[id as TrackId] : map.stings[id as StingId];

  const loadMap = (): void => {
    if (map !== null || busy.has("map") || !mayTry("map")) return;
    busy.add("map");
    d.fetchJson(`${d.base}music.json`).then((m) => {
      const mm = m as MusicMap;
      if (mm?.version !== 1 || typeof mm.tracks !== "object") throw new Error("music.json: not version 1");
      map = mm;
      busy.delete("map");
      d.onLoaded();
    }, (e: unknown) => { busy.delete("map"); failed("map", e); });
  };

  const mixer: MusicMixer = {
    now: () => ctx.currentTime,
    available: (id) => entry(id) !== undefined,
    loaded: (id) => buffers.has(id),
    load(id) {
      if (map === null) { loadMap(); return; }
      const e = entry(id);
      if (e === undefined || buffers.has(id) || busy.has(id) || !mayTry(id)) return;
      busy.add(id);
      d.fetchBytes(`${d.base}${e.file}`)
        .then((bytes) => ctx.decodeAudioData(bytes))
        .then((buf) => { buffers.set(id, buf); busy.delete(id); d.onLoaded(id); },
          (err: unknown) => { busy.delete(id); failed(id, err); });
    },
    loopLength(id) {
      const t = map?.tracks[id];
      return t ? t.loopEnd - t.loopStart : 0;
    },
    start(id, when, offset) {
      const t = map?.tracks[id];
      const buf = buffers.get(id);
      if (!t || buf === undefined) return;
      const old = sources.get(id);
      if (old) { try { old.stop?.(when); } catch { /* ended */ } }
      const src = ctx.createBufferSource() as unknown as LoopSource;
      src.buffer = buf;
      src.loop = true;
      src.loopStart = t.loopStart;
      src.loopEnd = t.loopEnd;
      src.connect(gainOf(id));
      src.start(when, t.loopStart + offset);
      sources.set(id, src);
    },
    stop(id, when) {
      const src = sources.get(id);
      if (!src) return;
      sources.delete(id);
      try { src.stop?.(when); } catch { /* ended */ }
    },
    gain(id, value, fade) { ramp(gainOf(id).gain, value, ctx.currentTime, fade); },
    sting(id, when) {
      const s = map?.stings[id];
      const buf = buffers.get(id);
      if (!s || buf === undefined) return 0;
      const src = ctx.createBufferSource() as unknown as LoopSource;
      src.buffer = buf;
      src.connect(d.out);
      src.start(when, s.start, s.dur);
      return s.dur;
    },
    duck(depth, attack, hold, release) {
      const p = duck.gain;
      const now = ctx.currentTime;
      if (!p.linearRampToValueAtTime || !p.setValueAtTime) return;
      p.cancelScheduledValues?.(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(depth, now + attack);
      p.setValueAtTime(depth, now + attack + hold);
      p.linearRampToValueAtTime(1, now + attack + hold + release);
    },
  };
  return mixer;
}
