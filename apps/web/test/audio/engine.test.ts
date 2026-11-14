/**
 * The engine loads the sprite only after the first tap, never on first paint (brief 3.13), and
 * plays nothing while muted or before it is ready.
 */
import { describe, expect, it } from "vitest";
import type { AudioContextLike, AudioHost } from "../../src/audio/engine";
import { createAudioEngine, unlockOnFirstGesture } from "../../src/audio/engine";

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
    fetchJson: async (url) => { calls.push(`json ${url}`); return { version: 1, file: "sfx.mp3", families: { fist: [{ start: 100, dur: 250 }] } }; },
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
    unlockOnFirstGesture(engine, target);
    expect(f.calls).toEqual([]);
    listeners.get("pointerdown")!();
    expect(listeners.size).toBe(0);           // once
    await engine.unlock();
    expect(engine.state).toBe("ready");
    expect(f.calls.filter((c) => c.startsWith("json") || c.startsWith("bytes"))).toEqual(["json /base/audio/sfx.json", "bytes /base/audio/sfx.mp3"]);
    expect(engine.play("fist", 0)).toBe(true);
    expect(f.started).toEqual([[0, 0.1, 0.25]]);
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
