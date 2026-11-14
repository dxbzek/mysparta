/**
 * The WP3 gate lines on the timeline, the frame and the HUD (no browser, no pixels):
 * thrown contact on arrival, the kill swing, companions, dead air, the intro, bout length,
 * facing, seek, the final HUD, purity, floor props, 2x.
 */
import { describe, expect, it } from "vitest";
import type { ActorId, StepOf } from "@rankzero/core";
import { isScrapper, killStep, stateAt } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import { strikeTime } from "@rankzero/rig";
import { capsuleRig } from "@rankzero/rig/testing";
import { createFightClock } from "../src/clock";
import { cuesBetween } from "../src/cues";
import { HIT_STOP, KNOCKOUT } from "../src/tuning";
import { FIXTURE_NAMES, fixturePlayer, optsFor, times } from "./lib/setup";
import { buildPlayer } from "../src/createFightPlayer";

describe("thrown weapons", () => {
  it("make contact at or after the item arrives, and the item is at the target then", () => {
    const fx = BOUT_FIXTURES["bout-all-steps"];
    const p = fixturePlayer("bout-all-steps");
    const throws = fx.log.steps.map((s, i) => [s, i] as const).filter(([s]) => s.t === "throw");
    expect(throws.length).toBe(4);
    for (const [, i] of throws) {
      const c = p.timeline.contacts.find((m) => m.step === i)!;
      const fl = p.tracks.flights.filter((f) => f.from <= c.at && f.to >= c.at - 1 && f.from > p.timeline.stepAt[i]! - 1);
      expect(fl.length, `step ${i}`).toBeGreaterThan(0);
      const arrive = Math.min(...fl.map((f) => f.to));
      expect(c.at).toBeGreaterThanOrEqual(arrive);
      // before the arrival nothing of the contact shows
      for (let t = fl[0]!.from; t < arrive; t += 5) {
        expect(p.frame(t).present.filter((x) => x.contact === p.timeline.contacts.indexOf(c))).toEqual([]);
      }
    }
  });
});

describe("the kill", () => {
  it("is the step killStep(log) names", () => {
    for (const name of FIXTURE_NAMES) expect(fixturePlayer(name).timeline.killStep).toBe(killStep(BOUT_FIXTURES[name].log));
  });

  it("the killing swing reaches its contact before the 220 ms hit-stop, holds, then plays in full", () => {
    const p = fixturePlayer("bout-gate");
    const k = p.timeline.killStep;
    const ci = p.timeline.contacts.findIndex((c) => c.step === k);
    const at = p.timeline.contacts[ci]!.at;
    const swinger = (t: number) => p.frame(t).actors.find((a) => a.id === "a0")!;
    const strike = strikeTime(capsuleRig.clipInfo("scrapper", swinger(at).clip))!;
    const dur = capsuleRig.clipInfo("scrapper", swinger(at).clip).durationMs;
    expect(swinger(at).clipT).toBe(strike);
    expect(swinger(at - 1).clipT).toBeLessThan(strike);
    // frozen for the whole knockout hit-stop
    for (const t of times(at, at + HIT_STOP.knockout - 1, 5)) expect(swinger(t).clipT).toBe(strike);
    expect(swinger(at + HIT_STOP.knockout + 5).clipT).toBeGreaterThan(strike);
    // and it plays on to the clip's end
    let most = 0;
    for (const t of times(at, at + 2000, 1)) if (swinger(t).clip === swinger(at).clip) most = Math.max(most, swinger(t).clipT);
    expect(most).toBeGreaterThanOrEqual(dur - 1);
  });

  it("the loser falls in slow motion (0.4) for 500 ms after the hit-stop, then stays down", () => {
    const p = fixturePlayer("bout-gate");
    const at = p.timeline.contacts.find((c) => c.step === p.timeline.killStep)!.at;
    const k = at + HIT_STOP.knockout;
    const loser = (t: number) => p.frame(t).actors.find((a) => a.id === "b0")!;
    expect(loser(k + 100).clip).toBe("ko-fall");
    expect(loser(k + 200).clipT - loser(k + 100).clipT).toBeCloseTo(100 * KNOCKOUT.slowScale, 6);
    expect(loser(k + KNOCKOUT.slowMs + 200).clipT - loser(k + KNOCKOUT.slowMs + 100).clipT).toBeCloseTo(100, 6);
    expect(loser(p.timeline.durationMs).clip).toBe("ko-fall");
  });

  it("a cap ending plays the loser's fall from the end step", () => {
    const p = fixturePlayer("bout-cap");
    const end = p.timeline.stepAt[p.timeline.stepAt.length - 1]!;
    expect(p.frame(p.timeline.durationMs).actors.find((a) => a.id === "b0")!.clip).toBe("ko-fall");
    const flinch = times(end, end + 1200, 10).some((t) => p.frame(t).actors.find((a) => a.id === "b0")!.clip === "hit-heavy");
    expect(flinch).toBe(true);
  });
});

describe("companions", () => {
  const fx = BOUT_FIXTURES["bout-all-steps"];
  const p = fixturePlayer("bout-all-steps");
  const own = fx.log.steps.map((s, i) => [s, i] as const)
    .filter(([s]) => "actor" in s && !isScrapper(s.actor as ActorId) && s.t !== "enter" && s.t !== "ko" && s.t !== "free");

  it("get a clip of their own on every action, facing their target", () => {
    expect(own.length).toBeGreaterThanOrEqual(5);
    for (const [s, i] of own) {
      const actor = (s as { actor: ActorId }).actor;
      const c = p.timeline.contacts.find((m) => m.step === i);
      if (c !== undefined) {
        const f = p.frame(c.at);
        const me = f.actors.find((a) => a.id === actor)!;
        expect(me.clip, `step ${i}`).toBe("attack");
        const tgt = f.actors.find((a) => a.id === (s as StepOf<"attack">).target)!;
        expect(Math.sign(tgt.place.x - me.place.x), `step ${i} facing`).toBe(me.place.facing);
      } else {
        // flee
        const t = p.timeline.stepAt[i]! + 50;
        const me = p.frame(t).actors.find((a) => a.id === actor)!;
        expect(me.clip).toBe("flee");
        expect(me.place.facing).toBe(actor.startsWith("a") ? -1 : 1);
      }
    }
  });

  it("change facing only while they run or act themselves", () => {
    for (const t of times(0, p.timeline.durationMs, 10)) {
      for (const a of p.frame(t).actors) {
        if (isScrapper(a.id)) continue;
        const home = a.id.startsWith("a") ? 1 : -1;
        if (a.place.facing !== home) expect(["run", "flee", "attack"], `${a.id} at ${t}`).toContain(a.clip);
      }
    }
  });
});

describe("pace", () => {
  it("has no dead air over 400 ms from the first action to the kill step", () => {
    for (const name of FIXTURE_NAMES) {
      const tl = fixturePlayer(name).timeline;
      const until = tl.killStep >= 0 ? tl.stepAt[tl.killStep]! : tl.stepAt[tl.stepAt.length - 1]!;
      let reach = tl.firstActionAt;
      for (const [f, t] of tl.busy) {
        if (t <= tl.firstActionAt || f >= until) continue;
        expect(f - reach, `${name}: gap at ${reach}`).toBeLessThanOrEqual(400);
        if (t > reach) reach = t;
      }
      expect(until - reach).toBeLessThanOrEqual(400);
    }
  });

  it("puts both scrappers on their marks within 2 s, and the first action at 1500", () => {
    for (const name of FIXTURE_NAMES) {
      const p = fixturePlayer(name);
      expect(Math.max(p.timeline.stepEnd[0]!, p.timeline.stepEnd[1]!)).toBeLessThanOrEqual(2000);
      const f = p.frame(1500);
      for (const id of ["a0", "b0"] as const) {
        const a = f.actors.find((x) => x.id === id)!;
        expect(a.place.x).toBeCloseTo(id === "a0" ? 70 : 290, 6);
        expect(a.place.y).toBeCloseTo(195, 6);
      }
      expect(p.timeline.firstActionAt).toBe(1500);
    }
  });

  it("plays the gate bout in 12 to 35 s at 1x", () => {
    const d = fixturePlayer("bout-gate").timeline.durationMs;
    expect(d).toBeGreaterThanOrEqual(12000);
    expect(d).toBeLessThanOrEqual(35000);
  });
});

describe("facing", () => {
  it("every actor on side b faces left when it stands at home, every actor on side a faces right", () => {
    for (const name of FIXTURE_NAMES) {
      const p = fixturePlayer(name);
      for (const t of times(1500, p.timeline.durationMs, 25)) {
        for (const a of p.frame(t).actors) {
          const tr = p.tracks.byId.get(a.id)!;
          const atHome = Math.abs(a.place.x - tr.home.x) < 0.5 && a.seg === null;
          if (atHome) expect(a.place.facing, `${name} ${a.id} at ${t}`).toBe(a.id.startsWith("b") ? -1 : 1);
        }
      }
    }
  });

  it("every attacker faces its target at the contact", () => {
    for (const name of FIXTURE_NAMES) {
      const p = fixturePlayer(name);
      const log = BOUT_FIXTURES[name].log;
      p.timeline.contacts.forEach((c, ci) => {
        const s = log.steps[c.step]!;
        if (!("target" in s) || s.target === undefined || s.t === "move") return;
        const f = p.frame(c.at);
        const me = f.actors.find((a) => a.id === s.actor)!;
        const tg = f.actors.find((a) => a.id === s.target)!;
        expect(Math.sign(tg.place.x - me.place.x), `${name} contact ${ci}`).toBe(me.place.facing);
      });
    }
  });
});

describe("seek and purity", () => {
  it("state(stepEnd[N]) is the reducer's state after N + 1 steps, for every N", () => {
    for (const name of FIXTURE_NAMES) {
      const p = fixturePlayer(name);
      const log = BOUT_FIXTURES[name].log;
      log.steps.forEach((_, n) => {
        expect(p.state(p.timeline.stepEnd[n]!), `${name} step ${n}`).toEqual(stateAt(log, n + 1));
        expect(p.state(p.timeline.stepEnd[n]! - 0.5), `${name} before step ${n}`).toEqual(stateAt(log, n));
      });
    }
  });

  it("hud(durationMs) equals the final state", () => {
    for (const name of FIXTURE_NAMES) {
      const p = fixturePlayer(name);
      const log = BOUT_FIXTURES[name].log;
      const fin = stateAt(log, log.steps.length);
      const hud = p.hud(p.timeline.durationMs);
      for (const [id, a] of Object.entries(fin.actors)) {
        expect(hud.hp[id as ActorId], `${name} ${id}`).toEqual({ now: a!.hp, trail: a!.hp, max: a!.maxHp });
      }
      expect(hud.bag).toEqual(fin.bag);
      expect(hud.stepsShown).toBe(log.steps.length);
      expect(hud.phase).toBe("result");
      expect(hud.winner).toBe(log.result.winner);
      expect(hud.resultIn).toBe(1);
      expect(p.state(p.timeline.durationMs)).toEqual(fin);
    }
  });

  it("two calls with the same t give equal results, in any order", () => {
    const p = fixturePlayer("bout-all-steps");
    const ts = [9000, 400, 33000, 9000, 12345.5, 400];
    const first = ts.map((t) => ({ f: p.frame(t), h: p.hud(t), s: p.state(t) }));
    const second = [...ts].reverse().map((t) => ({ f: p.frame(t), h: p.hud(t), s: p.state(t) })).reverse();
    expect(second).toEqual(first);
    // and a second player built from the same inputs is the same bout
    const fx = BOUT_FIXTURES["bout-all-steps"];
    const q = buildPlayer(fx.log, fx.a, fx.b, capsuleRig, optsFor(fx.log));
    expect(q.timeline).toEqual(p.timeline);
    for (const t of ts) expect(q.frame(t)).toEqual(p.frame(t));
  });

  it("the cosmetic seed changes variations, never a time", () => {
    const fx = BOUT_FIXTURES["bout-all-steps"];
    const p1 = buildPlayer(fx.log, fx.a, fx.b, capsuleRig, optsFor(fx.log, false, 1));
    const p2 = buildPlayer(fx.log, fx.a, fx.b, capsuleRig, optsFor(fx.log, false, 98765));
    const strip = (tl: typeof p1.timeline) => ({ ...tl, cues: tl.cues.map((c) => ({ at: c.at, step: c.step, family: c.family })) });
    expect(strip(p2.timeline)).toEqual(strip(p1.timeline));
    expect(p2.timeline.cues.map((c) => c.variant)).not.toEqual(p1.timeline.cues.map((c) => c.variant));
  });
});

describe("floor props", () => {
  it("never more than six lie on the floor; the oldest fades as a seventh lands", () => {
    const p = fixturePlayer("bout-all-steps");
    let most = 0;
    for (const t of times(0, p.timeline.durationMs, 5)) most = Math.max(most, p.frame(t).floor.length);
    expect(most).toBe(6);
    expect(p.tracks.floor.length).toBe(7);
    expect(p.frame(p.timeline.durationMs).floor.length).toBe(6);
  });
});

describe("2x", () => {
  it("a clock at 2x crosses every cue exactly once, at the timeline's times; numbers and HP are the timeline's", () => {
    const p = fixturePlayer("bout-gate");
    for (const speed of [1, 2] as const) {
      const clock = createFightClock(p.timeline.durationMs);
      clock.speed = speed;
      const played: number[] = [];
      let prev = -1;
      let real = 0;
      while (clock.t < p.timeline.durationMs) {
        const t = clock.tick(1000 / 60);
        real += 1000 / 60;
        for (const c of cuesBetween(p.timeline.cues, prev, t)) played.push(c.at);
        // what the HUD and the frame show depend on t only
        expect(p.hud(t)).toEqual(p.hud(t));
        prev = t;
      }
      expect(played).toEqual(p.timeline.cues.map((c) => c.at));
      expect(real).toBeCloseTo(p.timeline.durationMs / speed, -2);
    }
  });

  it("a seek plays no cue", () => {
    const p = fixturePlayer("bout-gate");
    const clock = createFightClock(p.timeline.durationMs);
    clock.seek(9000);
    expect(clock.t).toBe(9000);
    // the host plays cues between the last ticked time and the new one only when it ticked
    const t = clock.tick(0);
    expect(cuesBetween(p.timeline.cues, 9000, t)).toEqual([]);
  });
});
