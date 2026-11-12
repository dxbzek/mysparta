import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyDraft, createChampion, generateDraft, simulateFight, snapshot } from "@agoge/core";
import { combineSeed, makeRng } from "@agoge/core";
import { narrate, type Line } from "../src/narrate.js";
import {
  HITSTOP_MS,
  MELEE_CONTACT_MS,
  MISSILE_FLIGHT_MS,
  MISSILE_LAUNCH_MS,
  THROWN_CONTACT_MS,
  contactMs,
  koSchedule,
} from "../src/beats.js";
import type { BattlePlan } from "@agoge/core";

const PLAN: BattlePlan = { stance: "measured", gambit: "close_the_gap" };
function grown(name: string, level: number) {
  const c = createChampion(name);
  for (let l = 1; l < level; l++) {
    const offers = generateDraft(c, l + 1, 0);
    applyDraft(c, offers, makeRng(combineSeed(c.seed, l)).int(offers.length), false);
  }
  return c;
}

function allLines(n: number): Line[] {
  const out: Line[] = [];
  for (let s = 0; s < n; s++) {
    const r = simulateFight({
      seed: s,
      attacker: snapshot(grown("Hurler" + (s % 9), 8 + (s % 12)), PLAN),
      defender: snapshot(grown("Target" + (s % 7), 8 + (s % 12)), PLAN),
    });
    out.push(...narrate(r, ["Hurler", "Target"]));
  }
  return out;
}

describe("thrown beats: cause before effect", () => {
  const lines = allLines(160);
  const thrown = lines.filter((l) => l.anim?.thrown && l.anim.reaction);
  const melee = lines.filter((l) => l.anim?.reaction && !l.anim.thrown && l.anim.striker !== undefined);

  it("real fights contain thrown beats that someone reacts to", () => {
    expect(thrown.length).toBeGreaterThan(0);
    expect(melee.length).toBeGreaterThan(0);
  });

  it("nothing lands before the javelin has finished its flight", () => {
    for (const l of thrown) {
      // The reaction, burst, number and impact sound all key off contactMs.
      expect(contactMs(l)).toBe(THROWN_CONTACT_MS);
      expect(contactMs(l)).toBeGreaterThanOrEqual(MISSILE_LAUNCH_MS + MISSILE_FLIGHT_MS);
    }
    // ...and melee keeps its own, earlier, clock.
    for (const l of melee) expect(contactMs(l)).toBe(MELEE_CONTACT_MS);
    expect(THROWN_CONTACT_MS).toBeGreaterThan(MELEE_CONTACT_MS);
  });

  it("a thrown beat holds long enough for the late reaction to play", () => {
    for (const l of thrown) {
      // The same room after contact that a melee beat of that kind gets.
      const twin = melee.find((m) => m.kind === l.kind && m.anim?.reaction?.kind === l.anim?.reaction?.kind);
      if (!twin) continue;
      expect(l.hold - contactMs(l)).toBeGreaterThanOrEqual(twin.hold - contactMs(twin));
    }
  });

  it("the stylesheet's thrown overrides sit after the rules they override", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const override = css.indexOf(".stage.thrown-beat .hurt-l");
    expect(override).toBeGreaterThan(-1);
    // A rule placed above its base rule loses silently (same property, later
    // source wins) — this is the trap the audit doc warns about.
    for (const base of [".hurt-l {", ".dodge-l {", ".block-l {", ".burst {", ".floater {", ".missile-r {", ".stage.quake {"]) {
      expect(css.lastIndexOf(base), base).toBeGreaterThan(-1);
      expect(css.lastIndexOf(base), base).toBeLessThan(override);
    }
  });
});

describe("the killing blow's hit-stop", () => {
  const hit = { hold: 820, anim: { striker: 0 as const } };
  const javelin = { hold: 1000, anim: { striker: 0 as const, thrown: true } };

  it("freezes at contact, not at the first frame of the beat", () => {
    expect(koSchedule(hit, 1).freezeAt).toBe(MELEE_CONTACT_MS);
    expect(koSchedule(javelin, 1).freezeAt).toBe(THROWN_CONTACT_MS);
    expect(koSchedule(hit, 1).freezeAt).toBeGreaterThan(0);
  });

  it("lets go before the verdict, with room for the body to react", () => {
    for (const l of [hit, javelin]) {
      const s = koSchedule(l, 1);
      expect(s.releaseAt - s.freezeAt).toBe(HITSTOP_MS);
      expect(s.hold - s.releaseAt).toBeGreaterThanOrEqual(400);
    }
  });

  it("compresses with 2x speed like the rest of the stage", () => {
    const one = koSchedule(hit, 1);
    const two = koSchedule(hit, 2);
    expect(two.freezeAt).toBe(Math.round(one.freezeAt / 2));
    expect(two.hold).toBe(Math.round(one.hold / 2));
  });
});
