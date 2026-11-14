/**
 * The rest of the WP3 gate: sound cues, one timing source (clip lengths and strikes from
 * `rig.clipInfo` only), the arena from `PlayerOpts.stage`, the 17 handlers, the Move staging,
 * the clock, the source scan and the draw budget.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Path2D, createCanvas } from "@napi-rs/canvas";
import type { StepType } from "@rankzero/core";
import { STEP_TYPES, impactFamily } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import type { ClipInfo, Ctx2D, DrawEnv, Rig } from "@rankzero/rig";
import { capsuleRig } from "@rankzero/rig/testing";
import { HANDLERS } from "../src/choreo/index";
import { createFightClock } from "../src/clock";
import { SFX_VARIANTS } from "../src/contracts";
import { buildPlayer, createFightPlayer } from "../src/createFightPlayer";
import { BEAT } from "../src/tuning";
import { fixturePlayer, optsFor } from "./lib/setup";

const SRC = resolve(__dirname, "../src");

describe("sound cues", () => {
  it("pick a variant inside the family, keep impacts 60 ms apart, and sound every hit on its contact", () => {
    for (const name of ["bout-gate", "bout-all-steps", "bout-cap"] as const) {
      const p = fixturePlayer(name);
      const log = BOUT_FIXTURES[name].log;
      let last = -Infinity;
      for (const c of p.timeline.cues) {
        expect(c.variant).toBeGreaterThanOrEqual(0);
        expect(c.variant).toBeLessThan(SFX_VARIANTS[c.family]);
        if (["fist", "blunt", "blade", "block"].includes(c.family)) {
          expect(c.at - last).toBeGreaterThanOrEqual(60);
          last = c.at;
        }
      }
      for (const m of p.timeline.contacts) {
        const s = log.steps[m.step]!;
        if (s.t !== "attack" && s.t !== "intercept" && s.t !== "riposte" && s.t !== "throw") continue;
        const fam = s.outcome === "hit" ? impactFamily(s.weapon) : s.outcome === "block" ? "block" : "whoosh";
        expect(p.timeline.cues.some((c) => c.step === m.step && c.at === m.at && c.family === fam), `${name} step ${m.step}`).toBe(true);
      }
      // sorted by time
      const ats = p.timeline.cues.map((c) => c.at);
      expect([...ats].sort((x, y) => x - y)).toEqual(ats);
    }
  });

  it("has a win or loss cue on the banner, landing cues in the intro, a Move stinger per Move", () => {
    const p = fixturePlayer("bout-all-steps");
    const fams = p.timeline.cues.map((c) => c.family);
    expect(fams.filter((f) => f === "win" || f === "loss").length).toBe(1);
    expect(fams.filter((f) => f === "move").length).toBe(BOUT_FIXTURES["bout-all-steps"].log.steps.filter((s) => s.t === "move").length);
    expect(p.timeline.cues.filter((c) => c.family === "landing" && c.at < 1500).length).toBe(2);
  });
});

describe("one timing source", () => {
  /** The capsule rig with every swing clip made longer and its contact moved. */
  const stretched: Rig = {
    ...capsuleRig,
    clipInfo(rig, clip): ClipInfo {
      const info = capsuleRig.clipInfo(rig, clip);
      if (clip === "swing" || clip === "flick" || clip === "punch") {
        return { durationMs: 400, loop: false, events: [{ t: 260, name: "contact" }] };
      }
      return info;
    },
  };

  it("contact times follow rig.clipInfo: a 400 ms swing with contact at 260 moves every contact", () => {
    const fx = BOUT_FIXTURES["bout-gate"];
    const p = buildPlayer(fx.log, fx.a, fx.b, stretched, optsFor(fx.log));
    const q = fixturePlayer("bout-gate");
    expect(p.timeline.durationMs).toBeGreaterThan(q.timeline.durationMs + 15 * 100);
    p.timeline.contacts.forEach((c, ci) => {
      const a = p.frame(c.at).actors.find((x) => x.seg?.strikes === ci)!;
      const step = fx.log.steps[c.step]!;
      const combo = "n" in step && step.n > 0;
      expect(a.clipT).toBe(260);
      // the swing started strike-time before the contact: 260 for a plain swing, 120 for a combo one
      const seg = p.tracks.byId.get(a.id)!.segs.find((s) => s.strikes === ci)!;
      expect(c.at - seg.from).toBe(combo ? BEAT.comboStrikeMs : 260);
    });
  });

  it("the tuning file holds no clip length or strike time of the timing table", () => {
    const text = readFileSync(join(SRC, "tuning.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const n of [280, 150, 380]) expect(text, `${n}`).not.toMatch(new RegExp(`\\b${n}\\b`));
  });
});

describe("the arena", () => {
  it("is PlayerOpts.stage, drawn on both layers", () => {
    const fx = BOUT_FIXTURES["bout-gate"];
    const asked: string[] = [];
    const spy: Rig = { ...capsuleRig, drawStage(env, stage, layer, bounce) { asked.push(`${stage}:${layer}`); capsuleRig.drawStage(env, stage, layer, bounce); } };
    const opts = { ...optsFor(fx.log), stage: "gym" as const };
    const p = createFightPlayer(fx.log, fx.a, fx.b, spy, opts);
    const canvas = createCanvas(360, 240);
    const ctx = canvas.getContext("2d") as unknown as Ctx2D;
    const env: DrawEnv = { ctx, path: (d) => new Path2D(d) };
    p.draw(env, 3000, { w: 360, h: 240, dpr: 1 });
    expect(asked).toEqual(["gym:back", "gym:floor"]);
  });
});

describe("choreography", () => {
  it("has one handler for each of the 17 step types", () => {
    expect(Object.keys(HANDLERS).sort()).toEqual([...STEP_TYPES].sort());
    for (const t of STEP_TYPES) expect(typeof HANDLERS[t as StepType]).toBe("function");
  });

  it("dispatch ends in a never check", () => {
    const text = readFileSync(join(SRC, "choreo/index.ts"), "utf8");
    expect(text).toMatch(/const unknown: never = step;/);
    for (const t of STEP_TYPES) expect(existsHandlerFile(t)).toBe(true);
  });

  it("stages every Move with its own beat and its real object", () => {
    const p = fixturePlayer("bout-all-steps");
    const log = BOUT_FIXTURES["bout-all-steps"].log;
    const tr = p.tracks;
    const segsOf = (id: string) => tr.byId.get(id as "a0")!.segs;
    const seen = new Set<string>();
    log.steps.forEach((s, i) => {
      if (s.t !== "move") return;
      const at = p.timeline.stepAt[i]!;
      const end = p.timeline.stepEnd[i]! + 1200;
      const mine = segsOf(s.actor).filter((g) => g.from >= at && g.from <= end);
      const fx = tr.fx.filter((f) => f.from >= at && f.from <= end).map((f) => f.fx);
      // the banner over its user
      expect(tr.tags.some((g) => g.from === at && g.text === `MOVE:${s.move.toUpperCase()}` && g.actor === s.actor), `banner ${i}`).toBe(true);
      switch (s.move) {
        case "haymaker": expect(mine.map((g) => g.clip)).toContain("power-up"); expect(tr.fx.some((f) => f.fx === "trail" && f.from > at)).toBe(true); break;
        case "energy-drink": expect(mine.some((g) => g.clip === "drink" && g.prop === "can")).toBe(true); expect(fx).toContain("plus"); break;
        case "whistle": expect(mine.some((g) => g.clip === "power-up" && g.prop === "whistle")).toBe(true); expect(fx).toContain("rings"); expect(fx).toContain("plus"); break;
        case "air-horn": expect(mine.some((g) => g.clip === "power-up" && g.prop === "horn")).toBe(true); expect(fx.filter((f) => f === "rings").length).toBe(2); break;
        case "tarp": expect(mine.map((g) => g.clip)).toContain("throw"); expect(fx).toContain("tarp"); break;
        case "firecrackers": expect(mine.map((g) => g.clip)).toContain("throw"); expect(fx.filter((f) => f === "crackers").length).toBeGreaterThanOrEqual(2 * (s.hits?.length ?? 0)); break;
        case "snatch": expect(mine.map((g) => g.clip)).toContain("flick"); expect(mine.map((g) => g.clip)).toContain("dash");
          if (s.taken !== undefined) expect(tr.flights.some((f) => f.item === s.taken && f.after === "held")).toBe(true);
          else expect(tr.tags.some((g) => g.text === "SKILL:FIRM-GRIP")).toBe(true);
          break;
        case "body-slam": expect(mine.map((g) => g.clip)).toContain("slam"); expect(segsOf(s.target!).some((g) => g.clip === "slammed" && g.from >= at)).toBe(true); break;
      }
      seen.add(s.move);
    });
    expect(seen.size).toBe(8);
  });

  it("shows a skill tag for every step with procs, at most one per step; the OVERTIME sticker once", () => {
    const p = fixturePlayer("bout-all-steps");
    const log = BOUT_FIXTURES["bout-all-steps"].log;
    const skillTags = p.tracks.tags.filter((g) => g.text.startsWith("SKILL:"));
    const withProcs = log.steps.filter((s) => "procs" in s && s.procs !== undefined && s.procs.length > 0);
    expect(skillTags.length).toBe(withProcs.length);
    expect(p.tracks.tags.filter((g) => g.text === "OVERTIME").length).toBe(1);
  });
});

function existsHandlerFile(t: string): boolean {
  const file = t === "throw" ? "throw.ts" : `${t}.ts`;
  try { return statSync(join(SRC, "choreo", file)).isFile(); } catch { return false; }
}

describe("the fight clock", () => {
  it("starts at 0, adds speed x real time, holds when paused, seeks without leaving the bout", () => {
    const c = createFightClock(1000);
    expect([c.t, c.speed, c.paused]).toEqual([0, 1, false]);
    expect(c.tick(100)).toBe(100);
    c.speed = 2;
    expect(c.tick(100)).toBe(300);
    c.paused = true;
    expect(c.tick(100)).toBe(300);
    c.paused = false;
    c.seek(5000);
    expect(c.t).toBe(1000);
    c.seek(-3);
    expect(c.t).toBe(0);
    expect(c.tick(Number.NaN)).toBe(0);
    c.seek(990);
    expect(c.tick(100)).toBe(1000);
  });
});

describe("source scan", () => {
  it("the stage source names no document, window, react, setTimeout or Date", () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (f.endsWith(".ts")) files.push(p);
      }
    };
    walk(SRC);
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const word of ["document", "window", "react", "setTimeout", "Date"]) {
        expect(new RegExp(`\\b${word}\\b`, "i").test(text), `${f}: ${word}`).toBe(false);
      }
    }
  });
});

describe("draw budget", () => {
  it("draws a frame with six actors in 4 ms or less in Node (median of 120 frames)", () => {
    const p = fixturePlayer("bout-all-steps");
    const canvas = createCanvas(360, 240);
    const ctx = canvas.getContext("2d") as unknown as Ctx2D;
    const cache = new Map<string, Path2D>();
    const env: DrawEnv = { ctx, path: (d) => { let q = cache.get(d); if (q === undefined) { q = new Path2D(d); cache.set(d, q); } return q; } };
    const from = 3000;
    expect(p.frame(from).actors.length).toBe(6);
    for (let n = 0; n < 20; n++) p.draw(env, from + n * 16, { w: 360, h: 240, dpr: 1 });   // warm up
    const ms: number[] = [];
    for (let n = 0; n < 120; n++) {
      const t0 = performance.now();
      p.draw(env, from + n * 16.67, { w: 360, h: 240, dpr: 1 });
      ms.push(performance.now() - t0);
    }
    ms.sort((x, y) => x - y);
    const median = ms[60]!;
    console.info(`draw: median ${median.toFixed(3)} ms, p90 ${ms[108]!.toFixed(3)} ms over 120 frames with 6 actors`);
    expect(median).toBeLessThanOrEqual(4);
  });
});
