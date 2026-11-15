/**
 * Contact sync (WP3 gate, critic fix). For every moment of contact, every effect that plays
 * starts on the contact's own millisecond and nothing starts early. The starts are MEASURED: the
 * frame model is sampled every 1 ms from at - 120 to at + 120 and the first sample in which each
 * effect shows for that contact is its start. `ContactMark.starts` is only used to know which
 * effects should show at all.
 *
 * The control (ground rule 13): the same check run on a player with one effect planted 50 ms
 * late must fail, for each of the nine effects.
 */
import { describe, expect, it } from "vitest";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import type { EffectKey } from "../src/contracts";
import type { StagePlayer } from "../src/createFightPlayer";
import { EFFECT_KEYS, measureStarts } from "./lib/measure";
import { FIXTURE_NAMES, fixturePlayer } from "./lib/setup";

/** Every disagreement between the measured starts and the contact times, as sentences. */
function syncProblems(player: StagePlayer): string[] {
  const out: string[] = [];
  player.timeline.contacts.forEach((c, ci) => {
    const m = measureStarts(player, ci);
    for (const k of EFFECT_KEYS) {
      const want = c.starts[k];
      const got = m[k];
      if (want === null && got !== null) out.push(`contact ${ci} (step ${c.step}): ${k} shows at ${got} but should not play`);
      if (want !== null && got === null) out.push(`contact ${ci} (step ${c.step}): ${k} never shows`);
      if (want !== null && got !== null && got !== c.at) out.push(`contact ${ci} (step ${c.step}): ${k} starts at ${got}, contact at ${c.at} (${got - c.at > 0 ? "+" : ""}${got - c.at} ms)`);
    }
  });
  return out;
}

describe("contact sync, measured from sampled frames", () => {
  for (const name of FIXTURE_NAMES) {
    for (const rig of ["capsule", "capsule-gate"] as const) {
      for (const reduced of [false, true]) {
        it(`${name} on ${rig}${reduced ? ", reduced motion" : ""}: every effect starts on its contact`, () => {
          const p = fixturePlayer(name, rig, reduced);
          expect(p.timeline.contacts.length).toBeGreaterThan(0);
          expect(syncProblems(p)).toEqual([]);
        });
      }
    }
  }

  it("every hit of the gate bout shows the calm set: no white flash, a shake only on a crit or the knockout, the crowd only at the knockout", () => {
    const p = fixturePlayer("bout-gate");
    const log = BOUT_FIXTURES["bout-gate"].log;
    const hits = p.timeline.contacts.filter((c) => c.starts.flinch !== null);
    expect(hits.length).toBe(14);                         // 15 swings, one of them evaded
    for (const c of hits) {
      const s = log.steps[c.step]!;
      const kill = c.step === p.timeline.killStep;
      const crit = "crit" in s && s.crit;
      for (const k of ["flinch", "knockback", "burst", "number", "hp", "sound"] as const) expect(c.starts[k], `step ${c.step} ${k}`).toBe(c.at);
      expect(c.starts.flash, `step ${c.step} flash`).toBeNull();
      expect(c.starts.shake, `step ${c.step} shake`).toBe(kill || crit ? c.at : null);
      expect(c.starts.crowd, `step ${c.step} crowd`).toBe(kill ? c.at : null);
    }
    expect(hits.filter((c) => c.starts.shake !== null).length).toBeGreaterThan(0);
  });

  it("the contact marks hold `at` or null and nothing else", () => {
    for (const name of FIXTURE_NAMES) {
      for (const c of fixturePlayer(name).timeline.contacts) {
        for (const k of EFFECT_KEYS) expect(c.starts[k] === null || c.starts[k] === c.at).toBe(true);
      }
    }
  });
});

describe("control: a planted 50 ms shift turns the check red", () => {
  // the white flash never plays any more (calm fight), so there is nothing to shift; the shake and
  // the crowd play only on the knockout blow, so they are planted there
  const kill = fixturePlayer("bout-gate").timeline.contacts.findIndex((c) => c.step === fixturePlayer("bout-gate").timeline.killStep);
  for (const key of EFFECT_KEYS.filter((k) => k !== "flash")) {
    it(`${key} planted 50 ms late is caught`, () => {
      const contact = key === "shake" || key === "crowd" ? kill : 3;
      const p = fixturePlayer("bout-gate", "capsule", false, { shiftEffect: { key: key as EffectKey, ms: 50, contact } });
      const problems = syncProblems(p);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some((s) => s.includes(`${key} starts at`) && s.includes("+50 ms"))).toBe(true);
    });
  }
});
