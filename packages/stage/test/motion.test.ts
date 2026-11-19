/**
 * Reduced motion (brief 3.15): no shake, no flash, no slow motion, no ticket tape, no crowd
 * bounce, hit-stop 60 ms or less, knockback halved. Scrappers still move and the bout still reads.
 * Measured on frames sampled across the whole bout.
 */
import { describe, expect, it } from "vitest";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import { strikeTime } from "@rankzero/rig";
import { capsuleRig } from "@rankzero/rig/testing";
import type { StagePlayer } from "../src/createFightPlayer";
import { REDUCED_MOTION } from "../src/motion";
import { FIXTURE_NAMES, fixturePlayer, times } from "./lib/setup";

/** How long the striker's clip stays frozen on its strike after each contact (the hit-stop). */
function hitStops(p: StagePlayer): number[] {
  const out: number[] = [];
  p.timeline.contacts.forEach((c, ci) => {
    const a = p.frame(c.at).actors.find((x) => x.seg?.strikes === ci);
    if (a === undefined) return;
    const strike = strikeTime(capsuleRig.clipInfo(a.rig, a.clip));
    // the first millisecond in which the clip has moved on from its strike ends the hit-stop
    let t = c.at + 1;
    while (t < c.at + 400) {
      const now = p.frame(t).actors.find((x) => x.id === a.id)!;
      if (now.clip !== a.clip || now.clipT !== strike) break;
      t += 1;
    }
    out.push(t - 1 - c.at);
  });
  return out;
}
/** The largest knockback offset each contact gives its target: a pet's nudge (out and back). */
function knockbacks(p: StagePlayer): number[] {
  return p.timeline.contacts.map((c, ci) => {
    let most = 0;
    for (const n of p.tracks.nudges) if (n.contact === ci && n.key === "knockback") most = Math.max(most, Math.abs(n.dx));
    return most;
  });
}
/** The step back each contact drives a scrapper (review finding 17: a move his flinch steps with). */
function knockSteps(p: StagePlayer): number[] {
  return p.timeline.contacts.map((c, ci) => {
    let most = 0;
    for (const tr of p.tracks.actors) for (const m of tr.moves) if (m.knockback === ci) most = Math.max(most, Math.abs(m.x1 - m.x0));
    return most;
  });
}

describe("reduced motion", () => {
  for (const name of FIXTURE_NAMES) {
    it(`${name}: no shake, flash, tape or crowd bounce in any frame`, () => {
      const p = fixturePlayer(name, "capsule", true);
      for (const t of times(0, p.timeline.durationMs, 4)) {
        const f = p.frame(t);
        expect(f.shake).toEqual({ x: 0, y: 0 });
        expect(f.crowd).toBe(0);
        expect(f.tape).toBeNull();
        for (const a of f.actors) expect(a.dress.tint).toBeUndefined();
      }
      for (const c of p.timeline.contacts) {
        expect(c.starts.shake).toBeNull();
        expect(c.starts.flash).toBeNull();
        expect(c.starts.crowd).toBeNull();
      }
    });
  }

  it("caps every hit-stop at 60 ms, the knockout's too (full motion holds the knockout 220)", () => {
    const full = hitStops(fixturePlayer("bout-gate"));
    const reduced = hitStops(fixturePlayer("bout-gate", "capsule", true));
    expect(Math.max(...full)).toBe(220);
    expect(Math.max(...reduced)).toBeLessThanOrEqual(REDUCED_MOTION.hitStopCap);
    expect(Math.max(...reduced)).toBe(60);
  });

  it("halves a pet's knockback; a scrapper's step back is his own footwork and stays whole, as a block's step does", () => {
    // (changed with review finding 17: a scrapper's knockback was a nudge, halved here, that slid
    // both planted feet; it is now a step his flinch clip takes, so halving it would slide them again)
    let pets = 0;
    for (const name of FIXTURE_NAMES) {
      const full = knockbacks(fixturePlayer(name));
      const reduced = knockbacks(fixturePlayer(name, "capsule", true));
      full.forEach((v, i) => expect(reduced[i]).toBeCloseTo(v / 2, 9));
      pets += full.filter((v) => v > 0).length;
      const steps = knockSteps(fixturePlayer(name));
      expect(knockSteps(fixturePlayer(name, "capsule", true))).toEqual(steps);
      expect(steps.some((v) => v > 0), name).toBe(true);
    }
    expect(pets).toBeGreaterThan(0);
  });

  it("has no slow motion: the knockout fall runs at full speed", () => {
    const p = fixturePlayer("bout-gate", "capsule", true);
    const at = p.timeline.contacts.find((c) => c.step === p.timeline.killStep)!.at;
    const loser = (t: number) => p.frame(t).actors.find((a) => a.id === "b0")!;
    let seen = 0;
    for (const t of times(at, at + 1200, 10)) {
      const a = loser(t);
      const b = loser(t + 10);
      if (a.clip === "ko-fall" && b.clip === "ko-fall" && b.clipT < 600) {
        expect(b.clipT - a.clipT).toBeCloseTo(10, 6);
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThan(10);
  });

  it("still moves the scrappers and plays every step", () => {
    const fx = BOUT_FIXTURES["bout-gate"];
    const p = fixturePlayer("bout-gate", "capsule", true);
    const xs = new Set(times(1500, 8000, 50).map((t) => Math.round(p.frame(t).actors.find((a) => a.id === "a0")!.place.x)));
    expect(xs.size).toBeGreaterThan(10);
    expect(p.hud(p.timeline.durationMs).stepsShown).toBe(fx.log.steps.length);
  });
});
