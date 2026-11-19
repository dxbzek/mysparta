/**
 * The three text files of the fight-screen lane: names (total), stage words, and one plain
 * sentence per step type, with no sim words ("beat", "tick", "clock").
 */
import { describe, expect, it } from "vitest";
import { MOVE_IDS, PERK_IDS, SHIELD_IDS, SKILL_IDS } from "@rankzero/core";
import type { Step } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import { NAMES, nameOf } from "../../src/text/names";
import { actorNames, logLine } from "../../src/text/log";
import { STAGE_TEXT } from "../../src/text/stage";

const STEP_TYPES: Step["t"][] = ["enter", "draw", "swap", "move", "attack", "intercept", "riposte", "throw", "disarm",
  "shieldOff", "heal", "snare", "free", "flee", "ko", "overtime", "end"];
const SIM_WORDS = /\b(beat|beats|tick|ticks|clock)\b/i;

describe("names", () => {
  it("names all 122 perks and fists, each once", () => {
    expect(PERK_IDS).toHaveLength(122);
    expect(Object.keys(NAMES)).toHaveLength(PERK_IDS.length + 1);
    for (const id of PERK_IDS) expect(NAMES[id], id).toMatch(/^[A-Z][A-Za-z -]+$/);
    expect(new Set(Object.values(NAMES)).size).toBe(Object.keys(NAMES).length);
  });
  it("falls back on an unknown id without throwing", () => {
    expect(nameOf("not-a-perk")).toBe("Something");
  });
});

describe("stage words", () => {
  it("has a word for every Move and skill tag", () => {
    for (const id of MOVE_IDS) expect(STAGE_TEXT.moveName(id)).toBe(NAMES[id].toUpperCase());
    for (const id of SKILL_IDS) expect(STAGE_TEXT.skillName(id).length).toBeGreaterThan(2);
    for (const id of SHIELD_IDS) expect(STAGE_TEXT.skillName(id)).toBe(NAMES[id].toUpperCase());
    expect(STAGE_TEXT.wins("Cuff")).toBe("CUFF WINS");
  });
});

describe("log sentences", () => {
  const all = Object.values(BOUT_FIXTURES).flatMap((f) => f.log.steps.map((s) => ({ s, names: actorNames(f.log.init, f.a, f.b) })));

  it("the fixtures hold every step type", () => {
    expect(new Set(all.map((x) => x.s.t))).toEqual(new Set(STEP_TYPES));
  });

  it.each(all.map((x, i) => [i, x.s.t, x] as const))("step %i (%s) reads as one plain sentence", (_i, _t, x) => {
    const line = logLine(x.s, x.names);
    expect(line).toMatch(/^[A-Z][^]*[.!]$/);
    expect(line).not.toMatch(SIM_WORDS);
    expect(line).not.toMatch(/undefined|null|NaN|Someone/);
  });

  it("names companions by owner", () => {
    const f = BOUT_FIXTURES["bout-all-steps"];
    const n = actorNames(f.log.init, f.a, f.b);
    const pet = f.log.init.actors.find((x) => x.kind !== "scrapper");
    expect(pet).toBeDefined();
    expect(n[pet!.id]).toMatch(/'s (second )?(Raccoon|Goose|Boar|Stray Dog|Crow|Alley Cat)$/);
  });

  it("would catch a sim word (planted fault)", () => {
    expect("The next beat goes to Cuff.").toMatch(SIM_WORDS);
  });
});
