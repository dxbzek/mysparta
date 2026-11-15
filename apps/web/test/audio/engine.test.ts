/**
 * The engine loads the sprite only after the first tap, never on first paint (brief 3.13), and
 * plays nothing while muted or before it is ready.
 */
import { describe, expect, it } from "vitest";
import type { AudioContextLike, AudioHost } from "../../src/audio/engine";
import { createAudioEngine, unlockOnGestures } from "../../src/audio/engine";
import { soundFor } from "../../src/audio/cues";

function fakeHost() {
  const calls: string[] = [];
  const started: [number, number, number][] = [];
  const ctx: AudioContextLike = {
    currentTime: 0,
    state: "suspended",
    resume: async () => { calls.push("resume"); },
    decodeAudioData: async () => { calls.push("decode"); return {}; },
    createBufferSource: () => ({ buffer: null, connect: () => undefined, start: (w, o, d) => { started.push([w, o, d]); } }),
    destination: {},
  };
  const host: AudioHost = {
    createContext: () => { calls.push("context"); return ctx; },
    fetchBytes: async (url) => { calls.push(`bytes ${url}`); return new ArrayBuffer(8); },
    fetchJson: async (url) => {
      calls.push(`json ${url}`);
      return { version: 2, files: ["sfx.mp3", "sfx-content.mp3"], families: { fist: "hit-fist" },
        sets: { "hit-fist": [{ start: 100, dur: 250, f: 0 }], "hit-blade-small": [{ start: 40, dur: 110, f: 1 }] } };
    },
  };
  return { host, calls, started };
}

describe("audio engine", () => {
  it("does nothing until unlock: no context, no fetch", () => {
    const f = fakeHost();
    const engine = createAudioEngine("./", f.host);
    expect(engine.state).toBe("idle");
    expect(engine.play("fist", 0)).toBe(false);
    expect(f.calls).toEqual([]);
  });

  it("loads once on the first gesture, then plays from the sprite offsets", async () => {
    const f = fakeHost();
    const engine = createAudioEngine("/base/", f.host);
    const listeners = new Map<string, () => void>();
    const target = {
      addEventListener: (t: string, fn: () => void) => { listeners.set(t, fn); },
      removeEventListener: (t: string) => { listeners.delete(t); },
    } as unknown as EventTarget;
    unlockOnGestures(engine, target, null);
    expect(f.calls).toEqual([]);
    listeners.get("pointerdown")!();
    // review finding 58: the listeners stay (a later gesture resumes an interrupted context);
    // the load still happens once
    expect(listeners.size).toBe(3);
    listeners.get("keydown")!();
    await engine.unlock();
    expect(engine.state).toBe("ready");
    await engine.content();
    expect(f.calls.filter((c) => c.startsWith("json") || c.startsWith("bytes"))).toEqual(["json /base/audio/sfx.json", "bytes /base/audio/sfx.mp3", "bytes /base/audio/sfx-content.mp3"]);
    expect(engine.play("fist", 0)).toBe(true);          // a family plays its set
    expect(engine.play("hit-blade-small", 0)).toBe(true); // a set from the content sprite
    expect(f.started).toEqual([[0, 0.1, 0.25], [0, 0.04, 0.11]]);
    expect(engine.play("fist", 7)).toBe(false);   // unknown variant: ignored
  });

  it("plays nothing while sound is off", async () => {
    const f = fakeHost();
    const engine = createAudioEngine("./", f.host);
    await engine.unlock();
    engine.enabled = false;
    expect(engine.play("fist", 0)).toBe(false);
    expect(f.started).toEqual([]);
  });
});

describe("the content sprite", () => {
  it("loads after the core; until then its sets report size 0 and a cue falls back to its family", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    const started: number[] = [];
    const ctx: AudioContextLike = {
      currentTime: 0, state: "running", resume: async () => undefined, destination: {},
      decodeAudioData: async () => ({}),
      createBufferSource: () => ({ buffer: null, connect: () => undefined, start: (_w, o) => { started.push(o); } }),
    };
    const host: AudioHost = {
      createContext: () => ctx,
      fetchBytes: async (url) => { if (url.endsWith("sfx-content.mp3")) await gate; return new ArrayBuffer(8); },
      fetchJson: async () => ({ version: 2, files: ["sfx.mp3", "sfx-content.mp3"], families: { blade: "hit-blade-small", fist: "hit-fist" },
        sets: { "hit-blade-small": [{ start: 10, dur: 110, f: 0 }], "hit-pipe": [{ start: 500, dur: 600, f: 1 }] } }),
    };
    const engine = createAudioEngine("./", host);
    await engine.unlock();
    expect(engine.state).toBe("ready");
    expect(engine.size("hit-pipe")).toBe(0);
    const pipe = { at: 0, step: 0, family: "blunt" as const, variant: 0, item: "pipe" as const, on: "body" as const };
    expect(soundFor(pipe, (n) => engine.size(n))).toBeNull();          // no blunt alias in this map, content not in
    const knife = { at: 0, step: 0, family: "blade" as const, variant: 0, item: "pocket-knife" as const, on: "body" as const };
    expect(soundFor(knife, (n) => engine.size(n))).toEqual({ name: "hit-blade-small", variant: 0 });
    release();
    await engine.content();
    expect(engine.size("hit-pipe")).toBe(1);
    expect(soundFor(pipe, (n) => engine.size(n))).toEqual({ name: "hit-pipe", variant: 0 });
  });
});
