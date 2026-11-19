/**
 * The music state machine (plan 13.17): what loads when, menu and fight crossfade, the two fight
 * layers start in step and crossfade by HP, stings duck the loops and stand in for the sprite's
 * jingles, big impacts dip the music, off means silent and nothing loaded, and the web mixer loops
 * on the measured points with no gap.
 */
import { describe, expect, it } from "vitest";
import type { Cue } from "@rankzero/stage";
import type { AudioContextLike, AudioHost } from "../../src/audio/engine";
import { STING_FOR, createAudioEngine, volumeGain } from "../../src/audio/engine";
import { engineSink, fightMusicAt, isKnockout, knockoutAt } from "../../src/audio/cues";
import type { MusicMixer, StingId, TrackId } from "../../src/audio/music";
import { DUCK, FADE, createMusicDirector, createWebMixer, intensityFromHp, loopTargets } from "../../src/audio/music";

type Id = TrackId | StingId;
function fakeMixer(opts: { available?: Id[]; len?: number } = {}) {
  const log: string[] = [];
  const loaded = new Set<Id>();
  const avail = new Set<Id>(opts.available ?? ["menu", "fight-calm", "fight-intense", "ko", "win", "lose", "level-up"]);
  const gains: Record<string, number> = {};
  const starts: { id: TrackId; when: number; offset: number }[] = [];
  let t = 10;
  const m: MusicMixer & { t: number } = {
    get t() { return t; },
    set t(v: number) { t = v; },
    now: () => t,
    available: (id) => avail.has(id),
    loaded: (id) => loaded.has(id),
    load: (id) => { log.push(`load ${id}`); },
    loopLength: () => opts.len ?? 8,
    start: (id, when, offset) => { starts.push({ id, when, offset }); log.push(`start ${id}`); },
    stop: (id, when) => { log.push(`stop ${id} @${when.toFixed(2)}`); },
    gain: (id, v, fade) => { gains[id] = v; log.push(`gain ${id} ${v.toFixed(2)} /${fade}`); },
    sting: (id) => { log.push(`sting ${id}`); return 1.5; },
    duck: (depth, attack, hold) => { log.push(`duck ${depth} hold ${hold}`); },
  };
  return { m, log, loaded, gains, starts, finish: (d: ReturnType<typeof createMusicDirector>, ...ids: Id[]) => { for (const id of ids) { loaded.add(id); d.onLoaded(id); } } };
}

describe("music targets", () => {
  it("menu plays only the menu loop; the fight crossfades its two layers with equal power", () => {
    expect(loopTargets("menu", 0.7)).toEqual({ menu: 1, "fight-calm": 0, "fight-intense": 0 });
    const calm = loopTargets("fight", 0);
    expect(calm["fight-calm"]).toBe(1);
    expect(calm["fight-intense"]).toBe(0);
    const mid = loopTargets("fight", 0.5);
    expect(mid["fight-calm"] ** 2 + mid["fight-intense"] ** 2).toBeCloseTo(1, 6);
    expect(loopTargets("fight", 1)["fight-intense"]).toBe(1);
    expect(loopTargets("post", 1)).toEqual({ menu: 0, "fight-calm": 0, "fight-intense": 0 });
    // no intense layer in the map: the calm one plays at full gain whatever the HP
    expect(loopTargets("fight", 1, false)["fight-calm"]).toBe(1);
  });

  it("intensity follows the lower HP: calm above 85%, full at 25%", () => {
    expect(intensityFromHp([1, 0.9])).toBe(0);
    expect(intensityFromHp([1, 0.25])).toBe(1);
    expect(intensityFromHp([0.55, 1])).toBeCloseTo(0.5, 6);
    expect(intensityFromHp([])).toBe(0);
  });
});

describe("the director", () => {
  it("loads nothing and plays nothing while off", () => {
    const f = fakeMixer();
    const d = createMusicDirector(f.m);
    d.setScene("fight");
    d.setIntensity(1);
    expect(f.log).toEqual([]);
    expect(d.sting("win")).toBe(false);
  });

  it("on the menu loads the menu loop and level-up sting, then fades the loop in once it is in", () => {
    const f = fakeMixer();
    const d = createMusicDirector(f.m);
    d.setOn(true);
    expect(f.log).toEqual(["load menu", "load level-up"]);
    f.finish(d, "menu");
    expect(f.starts).toEqual([{ id: "menu", when: 10.04, offset: 0 }]);
    expect(f.log).toContain(`gain menu 1.00 /${FADE.scene}`);
  });

  it("crossfades menu to fight and back, stopping each loop only after its fade", () => {
    const f = fakeMixer();
    const d = createMusicDirector(f.m);
    d.setOn(true);
    f.finish(d, "menu");
    f.log.length = 0;
    d.setScene("fight");
    expect(f.log).toContain("load fight-calm");
    expect(f.log).toContain(`gain menu 0.00 /${FADE.scene}`);
    expect(f.log).toContain(`stop menu @${(10 + FADE.scene + 0.05).toFixed(2)}`);
    f.finish(d, "fight-calm", "fight-intense");
    expect(f.gains["fight-calm"]).toBe(1);
    expect(d.playing.has("fight-intense")).toBe(false);   // silent layer not started yet
    f.log.length = 0;
    d.setScene("menu");
    expect(f.log).toContain("start menu");
    expect(f.log.some((l) => l.startsWith("stop fight-calm"))).toBe(true);
  });

  it("starts the intense layer in step with the calm one when HP drops", () => {
    const f = fakeMixer({ len: 8 });
    const d = createMusicDirector(f.m);
    d.setOn(true);
    d.setScene("fight");
    f.finish(d, "fight-calm", "fight-intense");
    const calmStart = f.starts.find((s) => s.id === "fight-calm")!;
    f.m.t = 23.5;                                      // 13.46 s into the calm loop = 5.46 s into its period
    d.setIntensity(0.8);
    const intense = f.starts.find((s) => s.id === "fight-intense")!;
    expect((intense.when - intense.offset - (calmStart.when - calmStart.offset)) % 8).toBeCloseTo(0, 6);  // same period grid
    expect(intense.offset).toBeCloseTo(((23.54 - calmStart.when) % 8 + 8) % 8, 6);
    expect(f.gains["fight-intense"]).toBeCloseTo(Math.sin(0.4 * Math.PI), 6);
    expect(f.gains["fight-calm"]).toBeCloseTo(Math.cos(0.4 * Math.PI), 6);
  });

  it("ignores tiny intensity changes (HP moves every frame) but not reaching calm or full", () => {
    const f = fakeMixer();
    const d = createMusicDirector(f.m);
    d.setOn(true);
    d.setScene("fight");
    f.finish(d, "fight-calm", "fight-intense");
    d.setIntensity(0.5);
    const n = f.log.length;
    d.setIntensity(0.53);
    expect(f.log.length).toBe(n);
    d.setIntensity(1);
    expect(f.gains["fight-intense"]).toBe(1);
  });

  it("after the knockout fades the fight out; a seek back to the fight brings it back at calm", () => {
    const f = fakeMixer();
    const d = createMusicDirector(f.m);
    d.setOn(true);
    d.setScene("fight");
    f.finish(d, "fight-calm", "fight-intense");
    d.setIntensity(1);
    d.setScene("post");
    expect(f.log).toContain(`gain fight-calm 0.00 /${FADE.post}`);
    expect(d.playing.size).toBe(0);
    d.setScene("fight");
    expect(d.intensity).toBe(0);
    expect(f.gains["fight-calm"]).toBe(1);
  });

  it("a sting plays only once loaded, ducks the loops for its length, and holds off impact dips", () => {
    const f = fakeMixer();
    const d = createMusicDirector(f.m);
    d.setOn(true);
    d.setScene("fight");
    f.finish(d, "fight-calm");
    expect(d.sting("win")).toBe(false);                // asked for, not in yet
    expect(f.log).toContain("load win");
    f.finish(d, "win");
    f.log.length = 0;
    expect(d.sting("win")).toBe(true);
    expect(f.log).toEqual(["sting win", `duck ${DUCK.sting} hold 1.5`]);
    d.impact();
    expect(f.log.filter((l) => l.startsWith("duck"))).toHaveLength(1);
    f.m.t += 5;
    d.impact();
    expect(f.log.at(-1)).toBe(`duck ${DUCK.impact} hold ${DUCK.impactHold}`);
  });

  it("turning off fades out fast and stops every loop", () => {
    const f = fakeMixer();
    const d = createMusicDirector(f.m);
    d.setOn(true);
    f.finish(d, "menu");
    d.setOn(false);
    expect(f.log).toContain(`gain menu 0.00 /${FADE.off}`);
    expect(d.playing.size).toBe(0);
    expect(d.sting("level-up")).toBe(false);
  });
});

describe("the fight's music", () => {
  const cue = (c: Partial<Cue>): Cue => ({ at: 0, step: 0, family: "fist", variant: 0, ...c });
  it("the knockout is the accent cue of the kill step; scene is post from it on", () => {
    const cues = [cue({ at: 100, step: 1 }), cue({ at: 900, step: 3, family: "landing", accent: true }), cue({ at: 400, step: 2, family: "landing", accent: true })];
    expect(knockoutAt(cues, 3)).toBe(900);
    expect(knockoutAt(cues, -1)).toBe(Infinity);
    expect(isKnockout(cues[2]!, 3)).toBe(false);       // a crit's accent, not the kill
    const hp = { a0: { now: 30, max: 100 }, b0: { now: 90, max: 100 }, a1: { now: 1, max: 10 } };
    expect(fightMusicAt(800, 900, hp)).toEqual({ scene: "fight", intensity: intensityFromHp([0.3, 0.9]) });
    expect(fightMusicAt(900, 900, hp).scene).toBe("post");
  });
});

// ---- the engine with music, on a fake Web Audio context

function webRig() {
  const log: string[] = [];
  type P = { value: number; cancelScheduledValues(t: number): void; setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void };
  const param = (name: string, v = 1): P => ({
    value: v,
    cancelScheduledValues: () => undefined,
    setValueAtTime(x, t) { log.push(`${name} set ${x.toFixed(2)} @${t}`); },
    linearRampToValueAtTime(x, t) { this.value = x; log.push(`${name} ramp ${x.toFixed(2)} @${t}`); },
  });
  let gains = 0;
  const sources: Record<string, unknown>[] = [];
  const ctx = {
    currentTime: 0,
    state: "running",
    resume: async () => undefined,
    decodeAudioData: async (b: ArrayBuffer) => ({ bytes: b.byteLength }),
    createBufferSource: () => {
      const s: Record<string, unknown> = { connect: (d: unknown) => { s.dest = d; }, start: (...a: number[]) => { s.started = a; }, stop: (w?: number) => { s.stopped = w ?? 0; } };
      sources.push(s);
      return s;
    },
    destination: { name: "dest" },
    createGain: () => { const name = `g${gains++}`; return { name, gain: param(name), connect: (d: { name?: string }) => log.push(`${name}->${d?.name ?? "?"}`) }; },
    createDynamicsCompressor: () => ({ name: "lim", connect: () => undefined }),
    createBuffer: () => ({}),
  };
  const fetched: string[] = [];
  const music = {
    version: 1,
    tracks: { menu: { file: "music/menu.mp3", loopStart: 0.5, loopEnd: 22.3 }, "fight-calm": { file: "music/fight-calm.mp3", loopStart: 0.5, loopEnd: 19.7 } },
    stings: { win: { file: "music/win.mp3", start: 0, dur: 2.6 } },
  };
  const sfx = { version: 2, files: ["sfx.mp3"], families: { win: "win", landing: "landing" }, sets: { win: [{ start: 0, dur: 100 }], landing: [{ start: 200, dur: 100 }] } };
  const host: AudioHost = {
    createContext: () => ctx as unknown as AudioContextLike,
    fetchBytes: async (url) => { fetched.push(url); return new ArrayBuffer(4); },
    fetchJson: async (url) => { fetched.push(url); return url.endsWith("music.json") ? music : sfx; },
  };
  const flush = async (): Promise<void> => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  return { ctx, host, log, sources, fetched, flush };
}

describe("the engine with music", () => {
  it("loads no music before the first gesture, then the menu loop, looped on the measured points", async () => {
    const r = webRig();
    const engine = createAudioEngine("./", r.host, { music: true });
    await r.flush();
    expect(r.fetched).toEqual([]);
    await engine.unlock();
    await r.flush();
    expect(r.fetched).toContain("./audio/music.json");
    expect(r.fetched).toContain("./audio/music/menu.mp3");
    expect(r.fetched).not.toContain("./audio/music/fight-calm.mp3");   // lazy: only the scene's files
    const loop = r.sources.find((s) => s.loop === true)!;
    expect(loop.loopStart).toBe(0.5);
    expect(loop.loopEnd).toBe(22.3);
    expect((loop.started as number[])[1]).toBe(0.5);
  });

  it("keeps music off (and unloaded) with the data saver or the music slider at 0", async () => {
    for (const setup of [{ musicAllowed: false, vol: 0.6 }, { musicAllowed: true, vol: 0 }]) {
      const r = webRig();
      const engine = createAudioEngine("./", r.host, { music: true, musicAllowed: setup.musicAllowed });
      engine.setVolumes({ music: setup.vol, sfx: 1 });
      await engine.unlock();
      await r.flush();
      expect(r.fetched.some((u) => u.includes("music")), JSON.stringify(setup)).toBe(false);
    }
  });

  it("sets each bus to its slider (squared) and the win cue plays the music's sting, not the jingle", async () => {
    const r = webRig();
    const engine = createAudioEngine("./", r.host, { music: true });
    engine.setVolumes({ music: 0.5, sfx: 0.8 });
    await engine.unlock();
    await r.flush();
    engine.setVolumes({ music: 0.5, sfx: 0.3 });
    expect(r.log).toContain(`g1 ramp ${volumeGain(0.3).toFixed(2)} @0.05`);   // g0 master, g1 effects, g2 music
    expect(r.log).toContain(`g2 ramp ${volumeGain(0.5).toFixed(2)} @0.05`);
    // win sting not loaded on the menu: the sprite's jingle plays and the sting starts loading
    expect(STING_FOR.win).toBe("win");
    const before = r.sources.length;
    expect(engine.play("win", 0)).toBe(true);
    expect(r.sources.length).toBe(before + 1);
    await r.flush();
    expect(r.fetched).toContain("./audio/music/win.mp3");
    const n = r.sources.length;
    expect(engine.play("win", 0)).toBe(true);
    const s = r.sources[n]!;
    expect((s.started as number[]).slice(1)).toEqual([0, 2.6]);       // the sting, not the sprite entry
  });

  it("the knockout blow plays the ko sting through the fight's cue sink", () => {
    const stings: string[] = [];
    const fake = { sting: (id: string) => { stings.push(id); return true; }, size: () => 1, play: () => true } as unknown as Parameters<typeof engineSink>[0];
    const sink = engineSink(fake, 4);
    sink.play({ at: 0, step: 4, family: "landing", variant: 0, accent: true });
    sink.play({ at: 0, step: 2, family: "landing", variant: 0, accent: true });
    expect(stings).toEqual(["ko"]);
  });

  it("a web mixer that cannot load the map tries again later, not on every call", async () => {
    let t = 0;
    let asks = 0;
    const ctx = webRig().ctx as unknown as AudioContextLike;
    const mixer = createWebMixer({ ctx, out: {}, base: "./audio/", now: () => t,
      fetchJson: async () => { asks++; throw new Error("offline"); }, fetchBytes: async () => new ArrayBuffer(1), onLoaded: () => undefined });
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      mixer.load("menu");
      await Promise.resolve(); await Promise.resolve();
      mixer.load("menu");
      expect(asks).toBe(1);
      t += 5000;
      mixer.load("menu");
      expect(asks).toBe(2);
    } finally { console.warn = warn; }
  });
});
