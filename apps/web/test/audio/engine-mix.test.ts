/**
 * Review findings 10, 57, 58: the context is created and resumed inside the first gesture, every
 * later gesture and the page coming back resume a context that is not running (iOS
 * "interrupted"), every sound goes through one master gain and a limiter, a voice cap stops the
 * oldest sound, and turning sound off stops what is playing.
 */
import { describe, expect, it } from "vitest";
import type { AudioContextLike, AudioHost, SourceLike } from "../../src/audio/engine";
import { MAX_VOICES, createAudioEngine, unlockOnGestures } from "../../src/audio/engine";

function rig(initial = "suspended") {
  const log: string[] = [];
  const sources: (SourceLike & { stopped: boolean; dest: unknown })[] = [];
  const master = { gain: { value: 0 }, connect: (d: unknown) => { log.push(`master->${d === limiter ? "limiter" : "?"}`); } };
  const limiter = { threshold: { value: 0 }, ratio: { value: 0 }, connect: (d: unknown) => { log.push(`limiter->${d === dest ? "dest" : "?"}`); } };
  const dest = { name: "dest" };
  const ctx = {
    currentTime: 0,
    state: initial,
    resume: async () => { log.push("resume"); ctx.state = "running"; },
    decodeAudioData: async () => ({}),
    createBufferSource: () => {
      const s = {
        buffer: null as unknown, stopped: false, dest: null as unknown, onended: null as (() => void) | null,
        connect: (d: unknown) => { s.dest = d; },
        start: () => undefined,
        stop: () => { s.stopped = true; },
      };
      sources.push(s);
      return s;
    },
    destination: dest,
    createGain: () => master,
    createDynamicsCompressor: () => limiter,
    createBuffer: () => ({ silent: true }),
  };
  const host: AudioHost = {
    createContext: () => { log.push("context"); return ctx as unknown as AudioContextLike; },
    fetchBytes: async () => new ArrayBuffer(8),
    fetchJson: async () => ({ version: 2, files: ["sfx.mp3"], families: {}, sets: { "hit-fist": [{ start: 0, dur: 100 }] } }),
  };
  return { ctx, host, log, sources, master, limiter, dest };
}

describe("unlock inside the gesture", () => {
  it("creates the context and calls resume synchronously, before the sprite has loaded", () => {
    const r = rig();
    const engine = createAudioEngine("./", r.host);
    void engine.unlock();
    expect(r.log.slice(0, 2)).toEqual(["context", "master->limiter"]);
    expect(r.log).toContain("resume");             // same task as the gesture
    expect(engine.state).toBe("loading");
    // the iOS silent sample went straight to the speakers
    expect(r.sources[0]!.dest).toBe(r.dest);
  });

  it("resumes an interrupted context on a later gesture and when the page is shown again", async () => {
    const r = rig("running");
    const engine = createAudioEngine("./", r.host);
    const on = new Map<string, () => void>();
    const target = { addEventListener: (t: string, f: () => void) => on.set(t, f), removeEventListener: (t: string) => on.delete(t) };
    const docOn = new Map<string, () => void>();
    const doc = { visibilityState: "visible", addEventListener: (t: string, f: () => void) => docOn.set(t, f), removeEventListener: (t: string) => docOn.delete(t) };
    const remove = unlockOnGestures(engine, target as unknown as EventTarget, doc as unknown as Document);
    on.get("pointerdown")!();
    await engine.unlock();
    expect(r.log.filter((l) => l === "resume")).toHaveLength(0);   // it was running
    r.ctx.state = "interrupted";                                    // a phone call on iOS
    on.get("touchend")!();
    await Promise.resolve();
    expect(r.log.filter((l) => l === "resume")).toHaveLength(1);
    r.ctx.state = "suspended";
    docOn.get("visibilitychange")!();
    expect(r.log.filter((l) => l === "resume")).toHaveLength(2);
    remove();
    expect(on.size).toBe(0);
    expect(docOn.size).toBe(0);
  });

  it("the page coming back before any gesture creates nothing and loads nothing", async () => {
    const r = rig();
    const engine = createAudioEngine("./", r.host);
    await engine.resume();
    expect(r.log).toEqual([]);
    expect(engine.state).toBe("idle");
  });
});

describe("the mix", () => {
  it("sends every sound through the master gain, caps voices and stops sounds on mute", async () => {
    const r = rig("running");
    const engine = createAudioEngine("./", r.host);
    await engine.unlock();
    const before = r.sources.length;            // the silent unlock sample
    for (let i = 0; i < MAX_VOICES + 3; i++) expect(engine.play("hit-fist", 0)).toBe(true);
    const played = r.sources.slice(before);
    expect(played.every((s) => s.dest === r.master)).toBe(true);
    expect(engine.playing).toBe(MAX_VOICES);
    expect(played.slice(0, 3).every((s) => s.stopped)).toBe(true);    // the oldest three
    expect(played.slice(3).some((s) => s.stopped)).toBe(false);
    played[5]!.onended?.();
    expect(engine.playing).toBe(MAX_VOICES - 1);
    engine.enabled = false;
    expect(played.slice(3).filter((_, i) => i !== 2).every((s) => s.stopped)).toBe(true);   // all but the one that ended
    expect(engine.playing).toBe(0);
    expect(engine.play("hit-fist", 0)).toBe(false);
    engine.enabled = true;
    expect(engine.play("hit-fist", 0)).toBe(true);
  });

  it("the limiter catches peaks: a hard ratio and a threshold under 0 dB", async () => {
    const r = rig("running");
    const engine = createAudioEngine("./", r.host);
    await engine.unlock();
    expect(r.limiter.ratio.value).toBeGreaterThanOrEqual(10);
    expect(r.limiter.threshold.value).toBeLessThan(0);
    expect(r.master.gain.value).toBe(1);
  });
});
