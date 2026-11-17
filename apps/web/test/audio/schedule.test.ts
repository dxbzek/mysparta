/**
 * Sound review (owner on the recorded fight: "the sound effects are off timing"). On the live
 * fight screen a cue used to sound on the first frame after the clock passed it, so up to a frame
 * late. The cue driver now starts the cues of the next frame at once, each scheduled on the audio
 * clock at its own moment; nothing is played twice, and a seek plays nothing and drops what was
 * started ahead from its count.
 */
import { describe, expect, it } from "vitest";
import type { Cue } from "@rankzero/stage";
import { createCueDriver } from "../../src/audio/cues";
import type { AudioContextLike, AudioHost } from "../../src/audio/engine";
import { createAudioEngine } from "../../src/audio/engine";

const cue = (at: number, step: number): Cue => ({ at, step, family: "fist", variant: 0 });

describe("cues are scheduled at their own moment", () => {
  it("a cue the clock reaches during the next frame starts now, delayed to its moment at the clock's speed", () => {
    const played: [number, number][] = [];
    const driver = createCueDriver([cue(10, 1), cue(25, 2), cue(40, 3), cue(70, 4)], { play: (c, d) => played.push([c.at, d ?? 0]) });
    // a 16 ms frame at 1x: 0 -> 16, looking 16 ms ahead
    driver.advance(0, 16, 16, 1);
    expect(played).toEqual([[10, 0], [25, 9]]);
    // the next frame: 25 is not played again; 40 is 8 ms ahead
    driver.advance(16, 32, 16, 1);
    expect(played).toEqual([[10, 0], [25, 9], [40, 8]]);
    // at 2x (32 clock ms per 16 real ms) the delay is halved
    driver.advance(32, 64, 32, 2);
    expect(played).toEqual([[10, 0], [25, 9], [40, 8], [70, 3]]);
  });

  it("without a look-ahead it plays what the clock crossed, now (the old behaviour)", () => {
    const played: number[] = [];
    const driver = createCueDriver([cue(10, 1), cue(25, 2)], { play: (c, d) => played.push(d ?? 0) });
    driver.advance(0, 30);
    expect(played).toEqual([0, 0]);
  });

  it("a seek plays nothing, and a seek back lets the cues sound again", () => {
    const played: number[] = [];
    const driver = createCueDriver([cue(10, 1), cue(25, 2)], { play: (c) => played.push(c.at) });
    driver.advance(0, 16, 16, 1);
    driver.seek(0);
    expect(played).toEqual([10, 25]);
    driver.advance(0, 16, 16, 1);
    expect(played).toEqual([10, 25, 10, 25]);
  });

  it("the engine starts a delayed sound on the audio clock at now + delay", async () => {
    const starts: number[] = [];
    const ctx = {
      currentTime: 2.5, state: "running",
      resume: async () => undefined,
      decodeAudioData: async () => ({}),
      createBufferSource: () => ({ buffer: null, onended: null, connect: () => undefined, start: (when: number) => { starts.push(when); }, stop: () => undefined }),
      destination: {},
      createGain: () => ({ gain: { value: 0 }, connect: () => undefined }),
      createDynamicsCompressor: () => ({ threshold: { value: 0 }, ratio: { value: 0 }, connect: () => undefined }),
      createBuffer: () => ({}),
    };
    const host: AudioHost = {
      createContext: () => ctx as unknown as AudioContextLike,
      fetchBytes: async () => new ArrayBuffer(8),
      fetchJson: async () => ({ version: 2, files: ["sfx.mp3"], families: {}, sets: { "hit-fist": [{ start: 0, dur: 100 }] } }),
    };
    const engine = createAudioEngine("./", host);
    await engine.unlock();
    starts.length = 0;
    expect(engine.play("hit-fist", 0)).toBe(true);
    expect(engine.play("hit-fist", 0, 9)).toBe(true);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeCloseTo(2.509, 6);
  });
});
