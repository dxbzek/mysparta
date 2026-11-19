/**
 * Round 2 audio review: one dropped request on a phone network must not leave the bout silent (or
 * every weapon generic) until a reload, and a suspended context must not queue sounds that all
 * fire together when it resumes.
 */
import { describe, expect, it } from "vitest";
import type { AudioContextLike, AudioHost } from "../../src/audio/engine";
import { LOAD_TIMEOUT_MS, createAudioEngine } from "../../src/audio/engine";

function rig(opts: { failJson?: number; failContent?: number; state?: string } = {}) {
  let jsonFails = opts.failJson ?? 0;
  let contentFails = opts.failContent ?? 0;
  let now = 0;
  const fetched: string[] = [];
  const started: number[] = [];
  const ctx = {
    currentTime: 0,
    state: opts.state ?? "running",
    resume: async () => { ctx.state = "running"; },
    decodeAudioData: async () => ({}),
    createBufferSource: () => ({ buffer: null, connect: () => undefined, start: (_w: number, o: number) => { started.push(o); } }),
    destination: {},
  };
  const host: AudioHost = {
    createContext: () => ctx as unknown as AudioContextLike,
    now: () => now,
    fetchBytes: async (url) => {
      fetched.push(url);
      if (url.endsWith("sfx-content.mp3") && contentFails > 0) { contentFails--; throw new Error("network"); }
      return new ArrayBuffer(8);
    },
    fetchJson: async (url) => {
      fetched.push(url);
      if (jsonFails > 0) { jsonFails--; throw new Error("network"); }
      return { version: 2, files: ["sfx.mp3", "sfx-content.mp3"], families: { fist: "hit-fist" },
        sets: { "hit-fist": [{ start: 100, dur: 250, f: 0 }], "hit-pipe": [{ start: 40, dur: 300, f: 1 }] } };
    },
  };
  return { ctx, host, fetched, started, advance: (ms: number) => { now += ms; } };
}

describe("a failed load retries on a later gesture", () => {
  it("the core sprite: failed, then the next tap (after a short backoff) loads it", async () => {
    const r = rig({ failJson: 1 });
    const engine = createAudioEngine("./", r.host);
    await engine.unlock();
    expect(engine.state).toBe("failed");
    expect(engine.play("fist", 0)).toBe(false);
    // a tap straight away is inside the backoff: no new request
    await engine.unlock();
    expect(r.fetched.filter((u) => u.endsWith("sfx.json"))).toHaveLength(1);
    r.advance(5000);
    await engine.unlock();
    expect(engine.state).toBe("ready");
    expect(engine.play("fist", 0)).toBe(true);
  });

  it("the content sprite: a failure leaves the family sounds, the next tap fetches it again", async () => {
    const r = rig({ failContent: 1 });
    const engine = createAudioEngine("./", r.host);
    await engine.unlock();
    await engine.content();
    expect(engine.size("hit-pipe")).toBe(0);
    r.advance(5000);
    await engine.unlock();
    await engine.content();
    expect(engine.size("hit-pipe")).toBe(1);
    expect(r.fetched.filter((u) => u.endsWith("sfx-content.mp3"))).toHaveLength(2);
  });

  it("gives up after a few tries instead of fetching on every tap forever", async () => {
    const r = rig({ failJson: 100 });
    const engine = createAudioEngine("./", r.host);
    for (let k = 0; k < 20; k++) { await engine.unlock(); r.advance(60_000); }
    expect(r.fetched.filter((u) => u.endsWith("sfx.json")).length).toBeLessThanOrEqual(6);
  });

  it("a response that is not ok (404, 503) counts as a failure, never decoded as sound", async () => {
    const calls: string[] = [];
    const g = globalThis as unknown as { fetch: unknown };
    const keep = g.fetch;
    g.fetch = async (url: string) => { calls.push(url); return { ok: false, status: 503, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) }; };
    try {
      const { browserFetchBytes, browserFetchJson } = await import("../../src/audio/engine");
      await expect(browserFetchBytes("x.mp3")).rejects.toThrow(/503/);
      await expect(browserFetchJson("x.json")).rejects.toThrow(/503/);
      expect(calls).toEqual(["x.mp3", "x.json"]);
    } finally {
      g.fetch = keep;
    }
  });
});

describe("a slow or hanging request", () => {
  it("taps while the content file is still on its way do not fetch it again", async () => {
    const r = rig();
    let release: (() => void) | null = null;
    const plain = r.host.fetchBytes;
    r.host.fetchBytes = async (url, signal) => {
      if (url.endsWith("sfx-content.mp3")) {
        r.fetched.push(url);
        await new Promise<void>((done) => { release = done; });
        return new ArrayBuffer(8);
      }
      return plain(url, signal);
    };
    const engine = createAudioEngine("./", r.host);
    await engine.unlock();                         // core in, content request still out
    for (let k = 0; k < 4; k++) { r.advance(5000); await engine.unlock(); }
    expect(r.fetched.filter((u) => u.endsWith("sfx-content.mp3"))).toHaveLength(1);
    (release as (() => void) | null)?.();
    await engine.content();
    expect(engine.size("hit-pipe")).toBe(1);
    r.advance(60_000);
    await engine.unlock();
    await engine.content();
    expect(r.fetched.filter((u) => u.endsWith("sfx-content.mp3"))).toHaveLength(1);
  });

  it("a request that never answers is aborted after the timeout, and the next tap tries again", async () => {
    const r = rig();
    const timers: (() => void)[] = [];
    r.host.setTimer = (fn) => { timers.push(fn); return timers.length - 1; };
    r.host.clearTimer = () => undefined;
    let hang = true;
    let aborted = 0;
    const plain = r.host.fetchJson;
    r.host.fetchJson = (url, signal) => {
      if (!hang) return plain(url, signal);
      r.fetched.push(url);
      signal?.addEventListener("abort", () => { aborted++; });
      return new Promise<unknown>(() => undefined);      // no answer, no error
    };
    const engine = createAudioEngine("./", r.host);
    const first = engine.unlock();
    expect(engine.state).toBe("loading");
    expect(timers).toHaveLength(1);
    timers[0]!();                                   // the deadline passes
    await first;
    expect(engine.state).toBe("failed");
    expect(aborted).toBe(1);
    hang = false;
    r.advance(LOAD_TIMEOUT_MS);
    await engine.unlock();
    expect(engine.state).toBe("ready");
    expect(engine.play("fist", 0)).toBe(true);
  });
});

describe("a suspended context", () => {
  it("plays nothing (no burst on resume) and asks to resume; once running it plays", async () => {
    const r = rig({ state: "running" });
    const engine = createAudioEngine("./", r.host);
    await engine.unlock();
    r.ctx.state = "suspended";
    r.ctx.resume = async () => undefined;           // iOS refuses a resume without a gesture
    expect(engine.play("fist", 0)).toBe(false);
    expect(engine.play("fist", 0)).toBe(false);
    expect(r.started).toEqual([]);
    r.ctx.state = "running";
    expect(engine.play("fist", 0)).toBe(true);
    expect(r.started).toHaveLength(1);
  });
});
