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
import { COMPANION_IDS, SHIELD_IDS, STEP_TYPES, impactFamily, isScrapper } from "@rankzero/core";
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

  it("names on every impact cue the held item of its step (contract rev 3)", () => {
    const companions = new Set<string>(COMPANION_IDS);
    const shields = new Set<string>(SHIELD_IDS);
    let checked = 0;
    for (const name of ["bout-gate", "bout-all-steps", "bout-cap"] as const) {
      const p = fixturePlayer(name);
      const log = BOUT_FIXTURES[name].log;
      for (const c of p.timeline.cues) {
        if (!["fist", "blunt", "blade", "block"].includes(c.family)) continue;
        const s = log.steps[c.step]!;
        if (s.t !== "attack" && s.t !== "intercept" && s.t !== "riposte" && s.t !== "throw") continue;
        const who = s.actor;
        const expected = s.weapon ?? (isScrapper(who) ? "fists" : null);
        if (c.on === "shield") {
          expect(c.family, `${name} step ${c.step}`).toBe("block");
          expect(shields.has(c.item ?? ""), `${name} step ${c.step}: ${c.item}`).toBe(true);
        } else if (expected !== null) {
          expect(c.item, `${name} step ${c.step}`).toBe(expected);
        } else {
          expect(companions.has(c.item ?? ""), `${name} step ${c.step}: ${c.item}`).toBe(true);
        }
        expect(c.on, `${name} step ${c.step}`).toBeDefined();
        if (c.family !== "block") expect(c.on).toBe("body");
        checked++;
      }
      // every swing of a contact step has a swing cue with an item
      for (const c of p.timeline.cues.filter((q) => q.family === "swing")) expect(c.item, `${name} swing ${c.step}`).toBeDefined();
    }
    expect(checked).toBeGreaterThan(10);
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

  it("stages every Move like a special move: a wind-up of 300 ms or more, its banner, its real object and a visible result", () => {
    const p = fixturePlayer("bout-all-steps");
    const log = BOUT_FIXTURES["bout-all-steps"].log;
    const tr = p.tracks;
    const segsOf = (id: string) => tr.byId.get(id as "a0")!.segs;
    const seen = new Set<string>();
    /** The steps right after step i in the same turn (its heal, snare, flee). */
    const after = (i: number) => {
      const out: { s: (typeof log.steps)[number]; j: number }[] = [];
      for (let j = i + 1; j < log.steps.length && log.steps[j]!.turn === log.steps[i]!.turn; j++) out.push({ s: log.steps[j]!, j });
      return out;
    };
    const greenOver = (id: string, from: number) => tr.numbers.some((n) => n.from >= from && n.text.startsWith("+") && n.colour === "#5BD66F"
      && tr.hp.some((h) => h.actor === id && h.kind === "gain" && h.at === n.from));
    const resultOver = (id: string, move: string, from: number) => tr.tags.some((g) => g.actor === id && g.from >= from
      && g.text === `RESULT:${move.toUpperCase()}` && g.icon === move);
    log.steps.forEach((s, i) => {
      if (s.t !== "move") return;
      const at = p.timeline.stepAt[i]!;
      const end = p.timeline.stepEnd[i]! + 1500;
      const mine = segsOf(s.actor).filter((g) => g.from >= at && g.from <= end);
      const fx = tr.fx.filter((f) => f.from >= at && f.from <= end);
      const kinds = fx.map((f) => f.fx);
      const why = `${s.move} (step ${i})`;
      // 1. the wind-up: the user's power-up breath for 300 ms or more from the step's start, a
      //    spotlight on it, and nobody else starting anything in that time (the opponent waits)
      const wind = mine.find((g) => g.from === at);
      expect(wind?.clip, why).toBe("power-up");
      expect(wind!.to - wind!.from, why).toBeGreaterThanOrEqual(300);
      expect(wind!.to - wind!.from, why).toBeLessThanOrEqual(500);
      expect(tr.spots.some((sp) => sp.actor === s.actor && sp.from === at && sp.to >= wind!.to), why).toBe(true);
      for (const other of tr.actors) {
        if (other.id === s.actor) continue;
        expect(other.segs.some((g) => g.busy && g.from >= at && g.from < wind!.to), `${why}: ${other.id} moves in the wind-up`).toBe(false);
        expect(other.moves.some((m) => m.from >= at && m.from < wind!.to), `${why}: ${other.id} walks in the wind-up`).toBe(false);
      }
      // 2. the banner over its user, from the start of the wind-up
      expect(tr.tags.some((g) => g.from === at && g.text === `MOVE:${s.move.toUpperCase()}` && g.actor === s.actor), why).toBe(true);
      // 3. the real object, and 4. a visible result
      const next = after(i);
      switch (s.move) {
        case "haymaker":
          expect(mine.filter((g) => g.clip === "power-up").length, why).toBeGreaterThanOrEqual(2);
          expect(fx.some((f) => f.fx === "spark" && f.track !== undefined), why).toBe(true);
          expect(resultOver(s.actor, s.move, at), why).toBe(true);
          expect(tr.fx.some((f) => f.fx === "trail" && f.from > at), why).toBe(true);
          break;
        case "energy-drink":
          expect(mine.some((g) => g.clip === "drink" && g.prop === "can"), why).toBe(true);
          expect(kinds, why).toContain("plus");
          expect(greenOver(s.actor, at), why).toBe(true);
          break;
        case "whistle": {
          expect(mine.some((g) => g.clip === "power-up" && g.prop === "whistle" && g.from > at), why).toBe(true);
          expect(kinds, why).toContain("rings");
          const pet = next.find((n) => n.s.t === "heal")!.s as { target: string };
          expect(greenOver(pet.target, at), why).toBe(true);
          break;
        }
        case "air-horn": {
          expect(mine.some((g) => g.clip === "power-up" && g.prop === "horn" && g.from > at), why).toBe(true);
          expect(kinds.filter((f) => f === "rings").length, why).toBe(3);
          const enemy = s.actor.startsWith("a") ? "b0" : "a0";
          expect(resultOver(enemy, s.move, at), why).toBe(true);
          expect(segsOf(enemy).some((g) => g.clip === "snared" && g.from > at), `${why}: covers its ears`).toBe(true);
          for (const n of next) if (n.s.t === "flee") expect(tr.tags.some((g) => g.actor === n.s.actor && g.text === "FLED:AIR-HORN"), why).toBe(true);
          break;
        }
        case "tarp":
          expect(mine.map((g) => g.clip), why).toContain("throw");
          expect(fx.some((f) => f.fx === "tarp" && f.fly !== undefined), why).toBe(true);
          expect(tr.fx.some((f) => f.fx === "tarp" && f.follow === s.target && f.from >= at), `${why}: wrapped`).toBe(true);
          expect(resultOver(s.target!, s.move, at), why).toBe(true);
          break;
        case "firecrackers": {
          expect(mine.map((g) => g.clip), why).toContain("throw");
          // lit in the hand, then flying, then popping round each target
          expect(fx.some((f) => f.fx === "crackers" && f.track !== undefined && (f.p1 ?? 1) <= 0.2), `${why}: lit in the hand`).toBe(true);
          expect(fx.filter((f) => f.fx === "crackers" && f.fly !== undefined).length, why).toBe(s.hits!.length);
          expect(fx.filter((f) => f.fx === "crackers" && f.key === "burst").length, why).toBe(s.hits!.length);
          for (const h of s.hits!) expect(tr.numbers.some((n) => n.from > at && n.text === `-${h.damage}`), why).toBe(true);
          break;
        }
        case "snatch":
          expect(mine.map((g) => g.clip), why).toContain("flick");
          expect(mine.map((g) => g.clip), why).toContain("dash");
          if (s.taken !== undefined) {
            expect(tr.flights.some((f) => f.item === s.taken && f.after === "held" && f.from > at), why).toBe(true);
            expect(tr.byId.get(s.actor)!.helds.some((h) => h.held === s.taken && h.from > at), `${why}: in the other hand`).toBe(true);
            expect(resultOver(s.actor, s.move, at), why).toBe(true);
          } else {
            expect(tr.tags.some((g) => g.text === "SKILL:FIRM-GRIP!" && g.icon === "firm-grip" && g.from > at), `${why}: Firm Grip`).toBe(true);
          }
          break;
        case "body-slam":
          expect(mine.map((g) => g.clip), why).toContain("slam");
          expect(segsOf(s.target!).some((g) => g.clip === "slammed" && g.from >= at), why).toBe(true);
          expect(tr.numbers.some((n) => n.from > at && n.text === `-${s.hits![0]!.damage}`), why).toBe(true);
          expect(resultOver(s.target!, s.move, at), why).toBe(true);
          break;
        case "sand-in-the-eyes":
          expect(mine.map((g) => g.clip), why).toContain("throw");
          expect(fx.filter((f) => f.fx === "dust" && f.fly !== undefined).length, `${why}: the handful flies`).toBeGreaterThanOrEqual(2);
          expect(segsOf(s.target!).some((g) => g.clip === "snared" && g.from > at), `${why}: rubs its eyes`).toBe(true);
          expect(resultOver(s.target!, s.move, at), why).toBe(true);
          break;
        case "taunt":
          expect(mine.map((g) => g.clip), why).toContain("win");
          expect(kinds, why).toContain("rings");
          expect(resultOver(s.actor, s.move, at), why).toBe(true);
          break;
        case "second-wind":
          expect(mine.filter((g) => g.clip === "power-up" && g.rate === 0).length, `${why}: holds the breath`).toBe(1);
          expect(tr.spots.some((sp) => sp.actor === s.actor && sp.aura === true && sp.from === at), `${why}: glow`).toBe(true);
          expect(greenOver(s.actor, at), why).toBe(true);
          break;
        case "grapple":
          expect(mine.map((g) => g.clip), why).toContain("slam");
          expect(mine.map((g) => g.clip), why).toContain("dash");
          expect(mine.some((g) => g.clip === "slam" && g.rate === 0), `${why}: the squeeze holds`).toBe(true);
          // the hold snares with no tarp: the target plays its snared clip and no tarp lands on it
          expect(segsOf(s.target!).some((g) => g.clip === "snared" && g.from >= at), why).toBe(true);
          expect(tr.fx.some((f) => f.fx === "tarp" && f.from >= at && f.from <= end && f.follow === s.target), why).toBe(false);
          expect(resultOver(s.target!, s.move, at), why).toBe(true);
          break;
      }
      seen.add(s.move);
    });
    expect(seen.size).toBe(12);
  });

  it("tags a passive that decides a roll with its icon and an exclamation mark, long enough to read", () => {
    const p = fixturePlayer("bout-all-steps");
    const log = BOUT_FIXTURES["bout-all-steps"].log;
    log.steps.forEach((s) => {
      if (!("procs" in s) || s.procs === undefined || s.procs.length === 0) return;
      const pr = s.procs[0]!;
      const tag = p.tracks.tags.find((g) => g.actor === pr.by && g.text === `SKILL:${pr.skill.toUpperCase()}!`);
      expect(tag, pr.skill).toBeDefined();
      expect(tag!.icon, pr.skill).toBe(pr.skill);
      expect(tag!.to - tag!.from, pr.skill).toBeGreaterThanOrEqual(800);
    });
  });

  it("raises the shield on a block made while one is carried, and knocks it to the floor on shieldOff", () => {
    const p = fixturePlayer("bout-all-steps");
    const log = BOUT_FIXTURES["bout-all-steps"].log;
    const tr = p.tracks;
    log.steps.forEach((s, i) => {
      if (s.t !== "shieldOff") return;
      const at = p.timeline.stepAt[i]!;
      // the shield leaves the back arm: it flies as its own prop and ends on the floor
      expect(tr.flights.some((f) => f.item === s.shield && f.after === "floor" && f.from >= at - 1), `flight ${i}`).toBe(true);
      expect(tr.byId.get(s.target)!.shields.some((c) => c.shield === null && c.from >= at - 1), `off ${i}`).toBe(true);
      expect(tr.fx.some((f) => f.fx === "spark" && Math.abs(f.from - at) < 1), `splinters ${i}`).toBe(true);
    });
    // The first block of the bout is made with the Car Door up: the block-shield clip, not the arms.
    const first = log.steps.findIndex((s) => s.t === "attack" && s.outcome === "block");
    const target = (log.steps[first] as { target: "a0" }).target;
    const segs = tr.byId.get(target)!.segs.filter((g) => g.from >= p.timeline.stepAt[first]!);
    expect(segs.map((g) => g.clip)).toContain("block-shield");
    expect(tr.byId.get("a0")!.initialShield).toBe("car-door");
    expect(tr.byId.get("b0")!.initialShield).toBe("bin-lid");
  });

  it("shows a skill tag for every step with procs, at most one per step; the OVERTIME sticker once", () => {
    const p = fixturePlayer("bout-all-steps");
    const log = BOUT_FIXTURES["bout-all-steps"].log;
    const skillTags = p.tracks.tags.filter((g) => g.text.startsWith("SKILL:") && g.text.endsWith("!"));
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
