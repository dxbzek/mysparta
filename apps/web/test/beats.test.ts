import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { applyDraft, createChampion, generateDraft, simulateFight, snapshot } from "@agoge/core";
import { combineSeed, makeRng } from "@agoge/core";
import type { BattlePlan, FightResult, GambitId } from "@agoge/core";
import { narrate, type Line } from "../src/narrate.js";
import {
  AXE_IMPACT_LAG_MS,
  HITSTOP_MS,
  MELEE_CONTACT_MS,
  MISSILE_FLIGHT_MS,
  MISSILE_LAUNCH_MS,
  THROWN_CONTACT_MS,
  beatHoldMs,
  contactMs,
  effectDelayMs,
  impactSoundMs,
  killBeat,
  koSchedule,
} from "../src/beats.js";

// Hundreds of real fights are walked line by line; on a loaded machine the
// default five seconds is not a verdict on the code.
vi.setConfig({ testTimeout: 30_000 });

function grown(name: string, level: number) {
  const c = createChampion(name);
  for (let l = 1; l < level; l++) {
    const offers = generateDraft(c, l + 1, 0);
    applyDraft(c, offers, makeRng(combineSeed(c.seed, l)).int(offers.length), false);
  }
  return c;
}

/*
 * Everything below is asserted over logs the game really produces: the core
 * simulates, narrate() turns the events into lines, and the helpers the
 * theatre calls are run over those lines. Hand-built lines only say what the
 * helpers do with the input someone imagined — the two defects this file
 * missed both lived in lines nobody imagined (a draw after a thrown kill, a
 * rider after a critical one).
 */
const GAMBITS: GambitId[] = ["close_the_gap", "hurl_first", "hold_ground", "feint", "war_cry"];
interface Bout {
  result: FightResult;
  lines: Line[];
}
const BOUTS: Bout[] = [];
for (const gambit of GAMBITS) {
  const plan: BattlePlan = { stance: "measured", gambit };
  for (let s = 0; s < 130; s++) {
    const result = simulateFight({
      seed: s,
      attacker: snapshot(grown("Hurler" + (s % 9), 8 + (s % 12)), plan),
      defender: snapshot(grown("Target" + (s % 7), 8 + (s % 12)), plan),
    });
    BOUTS.push({ result, lines: narrate(result, ["Hurler", "Target"]) });
  }
}
const LINES = BOUTS.flatMap((b) => b.lines);
const KOS = BOUTS.filter((b) => b.result.reason === "ko");
const loserOf = (r: FightResult): 0 | 1 => (r.winner === 0 ? 1 : 0);

describe("thrown beats: cause before effect", () => {
  const thrown = LINES.filter((l) => l.anim?.thrown && l.anim.reaction);
  const melee = LINES.filter((l) => l.anim?.reaction && !l.anim.thrown && l.anim.striker !== undefined);

  it("real fights contain thrown beats that someone reacts to", () => {
    expect(thrown.length).toBeGreaterThan(0);
    expect(melee.length).toBeGreaterThan(0);
    expect(thrown.some((l) => l.fx && !l.fx.heal)).toBe(true);
  });

  it("the blow lands when the flight ends, and melee keeps its own clock", () => {
    for (const l of thrown) expect(contactMs(l)).toBe(MISSILE_LAUNCH_MS + MISSILE_FLIGHT_MS);
    for (const l of melee) expect(contactMs(l)).toBe(MELEE_CONTACT_MS);
    expect(THROWN_CONTACT_MS).toBeGreaterThan(MELEE_CONTACT_MS);
  });

  it("the HP bar and the struck pose wait for the javelin too", () => {
    for (const l of thrown) {
      // What the theatre holds back the health and the reaction pose by.
      expect(effectDelayMs(l)).toBe(contactMs(l));
      // ...and the bar's 420ms drain still fits inside the beat it belongs to.
      if (l.fx) expect(l.hold - effectDelayMs(l)).toBeGreaterThanOrEqual(420);
    }
    // A melee beat is not held back: it has never had a missile to wait for.
    for (const l of melee) expect(effectDelayMs(l)).toBe(0);
    // Nothing without a reaction (a draw, a cast, a javelin into a beast)
    // delays the bars, or a heal on the next beat would arrive late.
    for (const l of LINES) if (!l.anim?.reaction) expect(effectDelayMs(l)).toBe(0);
  });

  it("a thrown beat holds long enough for the late reaction to play", () => {
    for (const l of thrown) {
      // The same room after contact that a melee beat of that kind gets.
      const twin = melee.find((m) => m.kind === l.kind && m.anim?.reaction?.kind === l.anim?.reaction?.kind);
      if (!twin) continue;
      expect(l.hold - contactMs(l)).toBeGreaterThanOrEqual(twin.hold - contactMs(twin));
    }
  });
});

describe("the stylesheet's thrown block", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  /** Every `selector { body }` in the file, one entry per comma-separated selector. */
  const rules: { selector: string; body: string }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const selector of m[1]!.split(",")) rules.push({ selector: selector.trim(), body: m[2]! });
  }
  /** A selector for the stage element itself — classes and :not() only, no descendant. */
  const onStage = (sel: string) => /^\.stage(\.[\w-]+|:not\(\.[\w-]+\))*$/.test(sel);

  it("sits after the rules it overrides", () => {
    const override = css.indexOf(".stage.thrown-beat .hurt-l");
    expect(override).toBeGreaterThan(-1);
    // A rule placed above its base rule loses silently (same property, later
    // source wins) — this is the trap the audit doc warns about.
    for (const base of [".hurt-l {", ".dodge-l {", ".block-l {", ".burst {", ".floater {", ".missile-r {", ".stage.quake {"]) {
      expect(css.lastIndexOf(base), base).toBeGreaterThan(-1);
      expect(css.lastIndexOf(base), base).toBeLessThan(override);
    }
  });

  it("the freeze and the lurch are animations on the stage element", () => {
    // The premise of the next test: these two share an element — and so a
    // cascade — with the quake.
    for (const cls of ["hitstop", "ko-shake"]) {
      const own = rules.filter((r) => r.selector === `.stage.${cls}` && /animation\s*:/.test(r.body));
      expect(own.length, cls).toBeGreaterThan(0);
    }
  });

  it("no stage-level animation-delay can reach the freeze or the lurch", () => {
    // Source order cannot protect them: `.stage.thrown-beat.quake` is three
    // classes against their two, so its longhand delay won wherever it sat,
    // and on a thrown critical KO the flash was delayed past its own lifetime.
    // Any rule that delays an animation on the stage itself must exclude both.
    const delaying = rules.filter((r) => onStage(r.selector) && /animation-delay\s*:/.test(r.body));
    expect(delaying.map((r) => r.selector)).toContain(".stage.thrown-beat.quake:not(.hitstop):not(.ko-shake)");
    for (const r of delaying) {
      expect(r.selector, r.selector).toContain(":not(.hitstop)");
      expect(r.selector, r.selector).toContain(":not(.ko-shake)");
    }
  });
});

describe("the killing blow", () => {
  it("the sample holds knockouts, and some that keep talking after the blow", () => {
    expect(KOS.length).toBeGreaterThan(100);
    // The line before the end is NOT always the kill: these are the fights the
    // positional rule got wrong, and the reason the rule reads content now.
    const late = KOS.filter((b) => killBeat(b.lines, b.result) !== b.lines.length - 2);
    expect(late.length).toBeGreaterThan(0);
    for (const b of late) {
      const after = b.lines.slice(killBeat(b.lines, b.result) + 1, -1);
      // Whatever follows the kill takes nothing more off anyone.
      for (const l of after) expect(l.fx, l.text).toBeUndefined();
    }
  });

  it("is the line that takes the loser's last health, in every real knockout", () => {
    for (const { result, lines } of KOS) {
      const loser = loserOf(result);
      const i = killBeat(lines, result);
      const kill = lines[i]!;
      const where = `seed log ending "${lines.at(-2)?.text}" -> chose "${kill?.text}"`;
      expect(i, where).toBeGreaterThan(0);
      expect(lines[lines.length - 1]!.kind).toBe("end");
      expect(i, where).toBeLessThan(lines.length - 1);
      // It damages the loser, and it is the beat their health reaches zero on.
      expect(kill.fx && !kill.fx.heal && kill.fx.target === loser, where).toBe(true);
      expect(kill.fx!.amount, where).toBeGreaterThan(0);
      expect(kill.hp![loser], where).toBe(0);
      expect(lines[i - 1]!.hp![loser], where).toBeGreaterThan(0);
      // Somebody is seen taking it: the freeze lands on a body, not a caption.
      expect(kill.anim?.reaction?.side, where).toBe(loser);
    }
  });

  it("a fight the judges called has no killing blow", () => {
    const called = BOUTS.filter((b) => b.result.reason !== "ko");
    for (const b of called) expect(killBeat(b.lines, b.result)).toBe(-1);
    // ...whatever the sample held, the rule is the reason, not the lines.
    const ko = KOS[0]!;
    expect(killBeat(ko.lines, { reason: "cap", winner: ko.result.winner })).toBe(-1);
  });

  it("freezes at that blow's contact — a javelin's when it was thrown", () => {
    const kills = KOS.map((b) => b.lines[killBeat(b.lines, b.result)]!);
    const thrownKills = kills.filter((l) => l.anim?.thrown);
    expect(thrownKills.length).toBeGreaterThan(0);
    for (const l of kills) {
      const s = koSchedule(l, 1);
      expect(s.freezeAt).toBe(l.anim?.thrown ? THROWN_CONTACT_MS : MELEE_CONTACT_MS);
      expect(s.freezeAt).toBeGreaterThan(0);
      expect(s.releaseAt - s.freezeAt).toBe(HITSTOP_MS);
      // The theatre holds the beat for beatHoldMs(line, true): after the
      // freeze lets go there is still room for the body to react.
      expect(s.hold).toBe(beatHoldMs(l, true));
      expect(beatHoldMs(l, true) - s.releaseAt).toBeGreaterThanOrEqual(400);
      expect(beatHoldMs(l, true) - beatHoldMs(l)).toBe(HITSTOP_MS);
    }
  });

  it("compresses with 2x speed like the rest of the stage", () => {
    for (const b of KOS.slice(0, 40)) {
      const l = b.lines[killBeat(b.lines, b.result)]!;
      const one = koSchedule(l, 1);
      const two = koSchedule(l, 2);
      expect(two.freezeAt).toBe(Math.round(one.freezeAt / 2));
      expect(two.hold).toBe(Math.round(one.hold / 2));
    }
  });

  it("is heard at contact whatever is swinging — the axe's late chop is for other blows", () => {
    const kills = KOS.map((b) => b.lines[killBeat(b.lines, b.result)]!).filter((l) => !l.anim?.thrown);
    for (const l of kills.slice(0, 40)) {
      // An ordinary axe blow keeps its lag...
      expect(impactSoundMs(l, { axe: true })).toBe(MELEE_CONTACT_MS + AXE_IMPACT_LAG_MS);
      // ...the killing one sounds on the frame the stage freezes and thuds on.
      expect(impactSoundMs(l, { axe: true, kills: true })).toBe(koSchedule(l, 1).freezeAt);
      expect(impactSoundMs(l, { axe: false })).toBe(contactMs(l));
    }
  });

  it("the theatre takes the kill and its timings from beats.ts, not its own literals", () => {
    const src = readFileSync(new URL("../src/FightTheatre.tsx", import.meta.url), "utf8");
    for (const call of ["killBeat(lines, result)", "koSchedule(lines[koIdx]", "beatHoldMs(line, kills)", "effectDelayMs(current)", "impactSoundMs(l,"]) {
      expect(src, call).toContain(call);
    }
    // The two things this replaced: a kill chosen by position, and a bare 360.
    expect(src).not.toMatch(/shown === lines\.length - 1/);
    expect(src).not.toMatch(/\b360\s*\/\s*speedRef/);
  });
});
