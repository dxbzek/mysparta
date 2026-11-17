/**
 * Feet on the floor in real bouts (movement pass 2; owner, 16 Nov 2026: "make sure characters have
 * animation for walks, run, dodge etc, block properly"). Measured on the drawn feet of the real art
 * (the gate and content packs), every 60 fps frame of the three fixture bouts and of three find-bout
 * bouts (level 10 candidate 5, level 30 candidates 0 and 9 under sim version 6; level 30 was candidate 2 until the pet pass changed the sim, then 24 for the start pass, 23 until round 2, 22 under sim version 4, 32 under sim version 5; candidate 9 also has a pet attack the scrapper hops away from. Open, for the stage: under sim version 6 a foot slides in a flinch in level 10 n 1 and level 30 n 22, 32, 34 and 37, and in footwork in level 30 n 5, 12, 29 and 36; those bouts are kept under test in open-defects.test.ts), see lib/feet.ts:
 *  - no toe or heel on the floor slides more than 0.5 units along it during footwork (the brace,
 *    the run, the brake, the shuffle, both dodges, both blocks, the idle and the cuts between them);
 *    before this pass the worst was 53.8 units in the fixtures (the eased dash, the walk home
 *    eased under the backpedal, the evade's slide back, the block's slide back);
 *  - the run keeps to the dash loop's speed: it speeds up from rest in the push-off, holds the
 *    run speed (560 units a second times the fighter's size) and slows to rest in the brake, and
 *    never goes faster (the old eased dash peaked at about 840);
 *  - every run ends in the brake before the next clip;
 *  - a heavy swing or a slash is hopped away from, a light or straight blow slipped, the same way every time.
 * The control: the eased dash planted back slides and overspeeds.
 */
import { describe, expect, it } from "vitest";
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { REALM_SALT, WEAPON_META, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import type { StagePlayer } from "../src/createFightPlayer";
import { dodgeOf } from "../src/effects";
import type { Internal } from "../src/timeline";
import { buildTimeline } from "../src/timeline";
import { basePos } from "../src/track";
import { BEAT } from "../src/tuning";
import { SLIDE_LIMIT, slides } from "./lib/feet";
import { FIXTURE_NAMES, optsFor, playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);

/** A find-bout bout (tools/find-bout.ts): candidate `n` at `level`, rivals 2n and 2n + 1. */
function found(level: number, n: number): { log: BoutLog; a: FighterSnapshot; b: FighterSnapshot } {
  const a = rivalSnapshot(REALM_SALT, level, 2 * n);
  const b = rivalSnapshot(REALM_SALT, level, 2 * n + 1);
  return { log: simulateFight(combineSeed("find-bout", n), a, b, 1), a, b };
}
const BOUTS: readonly { name: string; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot }[] = [
  ...FIXTURE_NAMES.map((name) => ({ ...BOUT_FIXTURES[name], name })),
  { name: "find-bout level 10 n 5", ...found(10, 5) },
  { name: "find-bout level 30 n 0", ...found(30, 0) },
  { name: "find-bout level 30 n 9", ...found(30, 9) },
];
const cache = new Map<string, StagePlayer>();
function player(name: string, internal?: Internal): StagePlayer {
  const key = `${name}|${internal === undefined ? "" : JSON.stringify(internal)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const bout = BOUTS.find((x) => x.name === name)!;
  const p = playerFor(bout.log, bout.a, bout.b, FULL, false, internal);
  cache.set(key, p);
  return p;
}
/** A flinch's feet: the toe planted under the shove holds within this (the crossfade into the
 *  flinch adds a little; a nudge slid them up to 39 units).  */
const FLINCH_SLIDE = 1;
const describeSlide = (s: ReturnType<typeof slides>[number]): string =>
  `${s.actor} ${s.foot} ${s.point} ${Math.round(s.from)}-${Math.round(s.to)} ms: ${s.slide.toFixed(2)} units (${s.clips.join(" > ")})`;

/** Every run of a scrapper (push-off, dash loops, brake) and the fastest its place moves in it,
 *  against the run speed for its size (units per second). */
function runs(p: StagePlayer): { actor: string; from: number; to: number; top: number; speed: number; next: string | null }[] {
  const out: { actor: string; from: number; to: number; top: number; speed: number; next: string | null }[] = [];
  for (const tr of p.tracks.actors) {
    if (tr.rig !== "scrapper") continue;
    const s = tr.look === undefined ? 1 : FULL.hitPoint("scrapper", { held: null, shield: null, scale: 1, look: tr.look }, "head").y
      / FULL.hitPoint("scrapper", { held: null, shield: null, scale: 1, look: { ...tr.look, build: 0 } }, "head").y;
    for (const push of tr.segs.filter((g) => g.clip === "dash-push")) {
      const after = tr.segs.filter((g) => g.from >= push.to).sort((x, y) => x.from - y.from);
      const brakes = after.filter((g) => g.clip === "brake");
      const end = brakes.find((g) => g.c0 > 40 && g.to - g.from > 50)?.to ?? push.to;
      const next = after.find((g) => g.from >= end - 0.01 && g.clip !== "idle" && g.clip !== "brake")?.clip ?? null;
      let top = 0;
      for (let t = push.from; t + 2 <= end; t += 2) top = Math.max(top, Math.abs(basePos(tr, t + 2).x - basePos(tr, t).x) / 2 * 1000);
      out.push({ actor: tr.id, from: push.from, to: end, top, speed: BEAT.dashSpeed * s, next });
    }
  }
  return out;
}

describe("feet on the floor in real bouts, measured on the drawn feet", () => {
  for (const b of BOUTS) {
    it(`${b.name}: no foot on the floor slides ${SLIDE_LIMIT} units or more in its footwork`, () => {
      const bad = slides(player(b.name), FULL);
      expect(bad.map(describeSlide)).toEqual([]);
    });
  }

  it("a blow drives him back a step: no foot on the floor slides in a flinch (review finding 17)", () => {
    let flinches = 0;
    for (const b of BOUTS) {
      const p = player(b.name);
      flinches += p.tracks.actors.reduce((n, tr) => n + (tr.rig === "scrapper" ? tr.segs.filter((g) => g.clip === "hit-light" || g.clip === "hit-heavy").length : 0), 0);
      const bad = slides(p, FULL, FLINCH_SLIDE, { only: new Set(["hit-light", "hit-heavy"]) });
      expect(bad.slice(0, 4).map(describeSlide), b.name).toEqual([]);
    }
    expect(flinches).toBeGreaterThan(10);
  });

  it("the bouts hold the footwork: runs with a push-off and a brake, shuffles, slips, hop-backs and blocks", () => {
    const count = (clip: string): number => BOUTS.reduce((n, b) => n + player(b.name).tracks.actors.reduce((m, tr) =>
      m + tr.segs.filter((g) => g.clip === clip && tr.rig === "scrapper").length, 0), 0);
    for (const clip of ["dash-push", "brake", "shuffle", "slip", "evade", "block", "block-shield"]) expect(count(clip), clip).toBeGreaterThan(0);
    // the find-bout bout at level 30 alone has the shuffles and both dodges (its runs went with the
    // pet spacing fix: an attacked pet now steps out in front of its owner, so the attacker no
    // longer runs past him to reach it; the runs are counted over all the bouts above). Candidate 9
    // also has a dodged pet attack, which plays "evade".
    const l30 = player("find-bout level 30 n 9").tracks.actors.flatMap((tr) => tr.segs.map((g) => g.clip));
    for (const clip of ["shuffle", "slip", "evade"]) expect(l30, clip).toContain(clip);
  });

  it("a run speeds up from rest, holds the run speed and slows to rest in the brake, never faster", () => {
    let n = 0;
    for (const b of BOUTS) {
      for (const r of runs(player(b.name))) {
        n += 1;
        const why = `${b.name} ${r.actor} run at ${Math.round(r.from)} ms`;
        expect(r.top, why).toBeLessThanOrEqual(r.speed * 1.01);
        expect(r.top, why).toBeGreaterThan(r.speed * 0.95);
        const tr = player(b.name).tracks.byId.get(r.actor as "a0")!;
        // from rest and to rest
        expect(Math.abs(basePos(tr, r.from + 2).x - basePos(tr, r.from).x) / 2 * 1000, why).toBeLessThan(r.speed * 0.1);
        expect(Math.abs(basePos(tr, r.to).x - basePos(tr, r.to - 20).x), why).toBeLessThan(0.01);
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it("every run ends in the brake, then the next clip", () => {
    for (const b of BOUTS) {
      for (const r of runs(player(b.name))) {
        const tr = player(b.name).tracks.byId.get(r.actor as "a0")!;
        const brakes = tr.segs.filter((g) => g.clip === "brake" && g.from >= r.from && g.to <= r.to + 0.01);
        expect(brakes.length, `${b.name} ${r.actor} at ${Math.round(r.from)}`).toBeGreaterThan(0);
        expect(r.next, `${b.name} ${r.actor} at ${Math.round(r.from)}: after the brake`).not.toBe(null);
      }
    }
  });

  it("dodges: a heavy swing or a slash is hopped away from, a light or straight one slipped, the same every time", () => {
    const seen = { slip: 0, evade: 0 };
    for (const b of BOUTS) {
      const p = player(b.name);
      const again = buildTimeline(b.log, b.a, b.b, FULL, optsFor(b.log));
      b.log.steps.forEach((s, i) => {
        if (s.t !== "attack" && s.t !== "riposte" && s.t !== "intercept") return;
        if (s.outcome !== "evade") return;
        const target = s.target;
        const tr = p.tracks.byId.get(target);
        if (tr === undefined || tr.rig !== "scrapper") return;
        const at = p.timeline.contacts.find((c) => c.step === i)?.at;
        if (at === undefined) return;
        const dodge = tr.segs.find((g) => (g.clip === "slip" || g.clip === "evade") && Math.abs(g.to - g.from) > 0 && g.from <= at && g.from >= at - 200);
        expect(dodge, `${b.name} step ${i}`).toBeDefined();
        const clip = dodge!.clip as "slip" | "evade";
        seen[clip] += 1;
        // A pet's bite or peck is hopped away from (dodgeOf, effects.ts: a rig that is not a scrapper
        // gives "evade"). Until 15 Nov 2026 this test read a pet's attack as fists and wanted a slip;
        // no bout it ran had a dodged pet attack, so it never showed.
        const from = p.tracks.byId.get(s.actor);
        const pet = from !== undefined && from.rig !== "scrapper";
        if (pet) expect(clip, `${b.name} step ${i}: a pet's attack is hopped`).toBe("evade");
        const weapon = s.weapon ?? "fists";
        const tags: readonly string[] = pet || weapon === "fists" ? [] : (WEAPON_TAGS[weapon] ?? []);
        if (tags.includes("heavy")) expect(clip, `${b.name} step ${i}: ${weapon} is heavy`).toBe("evade");
        if (tags.includes("light") || (weapon === "fists" && !pet)) expect(clip, `${b.name} step ${i}: ${weapon}`).toBe("slip");
        if (tags.includes("blade") && !tags.includes("light")) expect(clip, `${b.name} step ${i}: ${weapon} slashes`).toBe("evade");
        // deterministic: the same clip on a second build
        const tr2 = again.byId.get(target)!;
        expect(tr2.segs.some((g) => g.clip === clip && g.from === dodge!.from), `${b.name} step ${i}: again`).toBe(true);
      });
    }
    expect(seen.slip).toBeGreaterThan(0);
    expect(seen.evade).toBeGreaterThan(0);
  });

  it("the dodge rule itself: heavy weapons and two-hand swings are hopped, fists and light weapons slipped", () => {
    const p = player("bout-gate");
    const b = { log: BOUT_FIXTURES["bout-gate"].log, track: (id: string) => p.tracks.byId.get(id as "a0")!,
      has: (id: string) => p.tracks.byId.has(id as "a0") } as unknown as Parameters<typeof dodgeOf>[0];
    expect(dodgeOf(b, 3, "a0", { clip: "punch", weapon: "fists", combo: false })).toBe("slip");
    expect(dodgeOf(b, 3, "a0", { clip: "flick", weapon: "pocket-knife", combo: false })).toBe("slip");
    expect(dodgeOf(b, 3, "a0", { clip: "swing", weapon: "hand-axe", combo: false })).toBe("evade");
    expect(dodgeOf(b, 3, "a0", { clip: "swing-2h", weapon: "bat", combo: false })).toBe("evade");
    expect(dodgeOf(b, 3, "a0", { clip: "smash", weapon: "anvil", combo: false })).toBe("evade");
    expect(dodgeOf(b, 3, "a0", { clip: "swing", weapon: "machete", combo: true })).toBe("evade");
    expect(dodgeOf(b, 3, "a0", { clip: "thrust", weapon: "broom", combo: false })).toBe("slip");
  });
});

/** The weapons' tags, read once from the content contract. */
const WEAPON_TAGS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(Object.entries(WEAPON_META).map(([k, v]) => [k, v.tags]));

describe("control: the eased dash planted back turns it red", () => {
  it("the old dash (an eased slide under the run, the walk home eased under the backpedal) slides and overspeeds", () => {
    const bad = slides(player("bout-gate", { easedDash: true }), FULL);
    expect(bad.length).toBeGreaterThan(0);
    expect(bad[0]!.slide).toBeGreaterThan(5);
    // its top speed: the eased dash runs up to 1.5 times its average, past the run speed on a long dash
    const p = player("bout-all-steps", { easedDash: true });
    let top = 0;
    for (const tr of p.tracks.actors) {
      if (tr.rig !== "scrapper") continue;
      for (const g of tr.segs.filter((x) => x.clip === "dash")) {
        for (let t = g.from; t + 2 <= g.to; t += 2) top = Math.max(top, Math.abs(basePos(tr, t + 2).x - basePos(tr, t).x) / 2 * 1000);
      }
    }
    expect(top).toBeGreaterThan(BEAT.dashSpeed * 1.2);
  });
});
