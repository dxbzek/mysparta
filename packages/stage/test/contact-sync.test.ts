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

  it("every hit of the gate bout shows all nine effects", () => {
    const p = fixturePlayer("bout-gate");
    const hits = p.timeline.contacts.filter((c) => c.starts.flinch !== null);
    expect(hits.length).toBe(14);                         // 15 swings, one of them evaded
    for (const c of hits) for (const k of EFFECT_KEYS) expect(c.starts[k], `step ${c.step} ${k}`).toBe(c.at);
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
  for (const key of EFFECT_KEYS) {
    it(`${key} planted 50 ms late is caught`, () => {
      const p = fixturePlayer("bout-gate", "capsule", false, { shiftEffect: { key: key as EffectKey, ms: 50, contact: 3 } });
      const problems = syncProblems(p);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some((s) => s.includes(`${key} starts at`) && s.includes("+50 ms"))).toBe(true);
    });
  }
});
