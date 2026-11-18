/**
 * Sound sync (sound review, owner on the recorded fight of find-bout level 30 n 70: "the sound
 * effects are off timing"). The picture is MEASURED, not read off the cue list:
 *  - an impact sound (fist, blunt, blade, block) starts within 30 ms of its contact (the contact
 *    mark is where contact-sync.test.ts proves every hit effect starts; build-audio.mjs cuts every
 *    sprite to start 5 ms before its onset, so a cue at the contact sounds 5 ms after it);
 *  - a swing's whoosh is loudest in the middle of the forward drive: its cue plus the swish samples'
 *    peak (`SOUND.whooshPeakMs`) is within 12 ms of the middle of the drive, from where the drawn
 *    weapon's head reaches half its top speed toward the target to the contact (`forwardDrive`). It
 *    used to start at the start of the wind-up (heard 70 to 130 ms early), then at the start of the
 *    drive (still loud 45 to 55 ms before the fastest frames, round-2 close);
 *  - a throw's sound starts on the release of its own step's throw clip (within 10 ms), and a throw
 *    sound with no throw clip of its step's actor is a fault;
 *  - a dash's sound starts as its own step's actor starts its footwork, a run or a shuffle (within
 *    10 ms), and there is none when the attacker is already in reach and does not move (there was,
 *    level 30 n 70). Another actor's run starting then (a pet's scramble) does not count.
 * The control: the same check on the cue list with the whooshes moved back to the wind-up's start
 * or to the start of the drive, a dash sound moved onto another actor's run, a throw sound moved
 * off its throw, and an impact 40 ms late, must fail.
 */
import { describe, expect, it } from "vitest";
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import { contentPack, createRig, gatePack, strikeTime } from "@rankzero/rig";

import type { Cue } from "../src/contracts";
import type { StagePlayer } from "../src/createFightPlayer";
import { SOUND } from "../src/tuning";
import { forwardDrive } from "../src/timeline";


import { homeSpan } from "../src/camera";
import { drawnBox } from "../src/bounds";

import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);
const IMPACT = new Set(["fist", "blunt", "blade", "block"]);
const STRIKES = new Set(["swing", "punch", "thrust", "smash", "swing-2h", "swing-low", "swing-flat", "thrust-1h", "flick"]);
const DASHES = new Set(["dash", "dash-push", "run", "shuffle"]);

function found(level: number, n: number): { name: string; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot } {
  const a = rivalSnapshot(REALM_SALT, level, 2 * n);
  const b = rivalSnapshot(REALM_SALT, level, 2 * n + 1);
  return { name: `find-bout level ${level} n ${n}`, log: simulateFight(combineSeed("find-bout", n), a, b, 1), a, b };
}

/** The forward drive of a strike seg, measured on the frames the player draws: the striking end on
 *  the blended pose, its speed toward the target (`forwardDrive`); `start` where it reaches half its
 *  top speed, `mid` the middle of the drive from there to the contact. */
function drive(p: StagePlayer, actor: string, from: number, to: number): { start: number; mid: number } {
  const tr = p.tracks.byId.get(actor as never)!;
  const nudges = p.tracks.nudges.filter((n) => n.actor === actor);
  return forwardDrive(FULL, tr, nudges, (t) => p.frame(t).actors.find((a) => a.id === actor)!.dress, from, to);
}

/** The actor of a step, when it has one. */
function actorOf(log: BoutLog, step: number): string | undefined {
  return (log.steps[step] as { actor?: string } | undefined)?.actor;
}
/** Who dashes in a step: its actor, but in an intercept the one whose turn it was (its target). */
function dasherOf(log: BoutLog, step: number): string | undefined {
  const s = log.steps[step] as { t: string; actor?: string; target?: string } | undefined;
  return s?.t === "intercept" ? s.target : s?.actor;
}
/** A throw clip: "throw" or the rig's variant of it ("throw-flick", "throw-spin"...). */
const isThrow = (clip: string): boolean => clip === "throw" || clip.startsWith("throw-");

/** Every sound out of step with what the picture shows, as sentences. */
function soundProblems(p: StagePlayer, log: BoutLog, cues: readonly Cue[]): string[] {
  const out: string[] = [];
  const tracks = p.tracks.actors;
  for (const c of cues) {
    const mark = p.timeline.contacts.find((m) => m.step === c.step);
    if (IMPACT.has(c.family)) {
      if (mark !== undefined && Math.abs(c.at + 5 - mark.at) > 30) out.push(`${c.family} at ${Math.round(c.at)} ms sounds ${Math.round(c.at + 5 - mark.at)} ms from its contact (step ${c.step})`);
      continue;
    }
    if (c.family === "swing" && mark !== undefined) {
      // the strike that lands on this contact: its wind-up seg ends on it
      for (const tr of tracks) {
        if (tr.rig !== "scrapper") continue;
        const seg = tr.segs.find((g) => STRIKES.has(g.clip) && Math.abs(g.to - mark.at) < 1 && g.from <= c.at + SOUND.whooshPeakMs + 1);
        if (seg === undefined) continue;
        const d = drive(p, tr.id, seg.from, seg.to);
        const loud = c.at + SOUND.whooshPeakMs;
        if (Math.abs(loud - d.mid) > 12 || c.at > mark.at) out.push(`swing whoosh loudest at ${Math.round(loud)} ms, the middle of the drive at ${Math.round(d.mid)} ms (step ${c.step})`);
        break;
      }
      continue;
    }
    if (c.family === "throw") {
      // the throw clip of this step's own actor nearest the sound
      const who = actorOf(log, c.step);
      const own = (tracks.find((tr) => tr.id === who)?.segs ?? []).filter((g) => isThrow(g.clip) && g.c0 === 0 && g.from <= c.at + 10 && c.at <= g.to + 10);
      if (own.length === 0) { out.push(`throw sound at ${Math.round(c.at)} ms with no throw of its step's actor ${String(who)} (step ${c.step})`); continue; }
      const at = own.map((g) => g.from + (strikeTime(FULL.clipInfo("scrapper", g.clip)) ?? 0) / (g.rate > 0 ? g.rate : 1))
        .reduce((q, r) => (Math.abs(r - c.at) < Math.abs(q - c.at) ? r : q));
      if (Math.abs(c.at - at) > 10) out.push(`throw sound at ${Math.round(c.at)} ms, the release at ${Math.round(at)} ms (step ${c.step})`);
      continue;
    }
    if (c.family === "dash") {
      // the dash of this step's own dasher, not any run that starts then (a pet's scramble)
      const who = dasherOf(log, c.step);
      const starts = (tracks.find((tr) => tr.id === who)?.segs ?? []).filter((g) => DASHES.has(g.clip) && Math.abs(g.from - c.at) <= 10);
      if (starts.length === 0) out.push(`dash sound at ${Math.round(c.at)} ms with no dash of its step's actor ${String(who)} starting then (step ${c.step})`);
    }
  }
  return out;
}

const BOUTS = [
  ...(["bout-gate", "bout-all-steps"] as const).map((name) => ({ ...BOUT_FIXTURES[name], name: name as string })),
  ...[0, 1, 2, 3].map((n) => found(10, n)),
  ...[0, 1, 2, 70].map((n) => found(30, n)),
];
const players = new Map<string, StagePlayer>();
const playerOf = (b: (typeof BOUTS)[number]): StagePlayer => {
  let p = players.get(b.name);
  if (p === undefined) { p = playerFor(b.log, b.a, b.b, FULL); players.set(b.name, p); }
  return p;
};

describe("every sound starts with what it sounds (measured on the picture)", () => {
  for (const b of BOUTS) {
    it(`${b.name}: impacts on their contact, whooshes loudest on the fastest swing, throws on the release, dashes as they start`, () => {
      const p = playerOf(b);
      expect(p.timeline.cues.some((c) => c.family === "swing")).toBe(true);
      expect(soundProblems(p, b.log, p.timeline.cues)).toEqual([]);
    }, 120_000);
  }
  it("the dash and throw checks are not empty: the bouts have both", () => {
    expect(BOUTS.some((b) => playerOf(b).timeline.cues.some((c) => c.family === "dash"))).toBe(true);
    expect(BOUTS.some((b) => playerOf(b).timeline.cues.some((c) => c.family === "throw"))).toBe(true);
  }, 120_000);
});

describe("the intro's pet sounds and the draw whoosh come with what they sound (round-2 close)", () => {
  it("each pet's entry sound comes as its body comes into the bout's frame, the sounds 60 ms or more apart", () => {
    let checked = 0;
    for (const b of BOUTS) {
      const p = playerOf(b);
      const span = homeSpan(p.tracks);
      const intro = p.timeline.cues.filter((c) => c.family === "companion" && (b.log.steps[c.step] as { t: string }).t === "enter");
      for (const [k, c] of intro.entries()) {
        const who = actorOf(b.log, c.step)!;
        // the first frame (5 ms apart) in which the drawn pet reaches into the frame
        const shown = (t: number): boolean => {
          const a = p.frame(t).actors.find((q) => q.id === who);
          if (a === undefined) return false;
          const box = drawnBox(FULL, FULL.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place);
          return box.x1 >= span.x0 && box.x0 <= span.x1;
        };
        let first = 0;
        while (first < 2000 && !shown(first)) first += 5;
        expect(Math.abs(c.at - first), `${b.name}: ${who} heard at ${c.at}, seen from ${first}`).toBeLessThanOrEqual(30);
        if (k > 0) expect(c.at - intro[k - 1]!.at, `${b.name}: pet sounds ${intro[k - 1]!.at} and ${c.at}`).toBeGreaterThanOrEqual(60);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(4);
  }, 120_000);

  it("a draw's whoosh comes on the frame the weapon shows in the hand", () => {
    let checked = 0;
    for (const b of BOUTS) {
      const p = playerOf(b);
      b.log.steps.forEach((s, i) => {
        if (s.t !== "draw") return;
        const c = p.timeline.cues.find((q) => q.step === i && q.family === "whoosh");
        expect(c, `${b.name}: a draw with no whoosh (step ${i})`).toBeDefined();
        let t = p.timeline.stepAt[i]!;
        while (t < c!.at + 400 && p.frame(t).actors.find((a) => a.id === s.actor)?.dress.held !== s.weapon) t += 2;
        expect(Math.abs(c!.at - t), `${b.name}: draw whoosh at ${c!.at}, ${s.weapon} in the hand from ${t}`).toBeLessThanOrEqual(17);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(5);
  }, 120_000);
});

describe("control: the check catches sounds out of step", () => {
  const n70 = (): (typeof BOUTS)[number] => BOUTS.find((x) => x.name === "find-bout level 30 n 70")!;
  /** The swing cues moved to a time on their wind-up seg. */
  const moved = (p: StagePlayer, when: (p: StagePlayer, actor: string, from: number, to: number) => number): Cue[] => p.timeline.cues.map((c) => {
    if (c.family !== "swing") return c;
    const mark = p.timeline.contacts.find((m) => m.step === c.step);
    if (mark === undefined) return c;
    for (const tr of p.tracks.actors) {
      if (tr.rig !== "scrapper") continue;
      const seg = tr.segs.find((g) => STRIKES.has(g.clip) && Math.abs(g.to - mark.at) < 1 && g.from <= c.at + SOUND.whooshPeakMs + 1);
      if (seg !== undefined) return { ...c, at: when(p, tr.id, seg.from, seg.to) };
    }
    return c;
  });

  it("whooshes moved back to the start of the wind-up are caught", () => {
    const b = n70();
    const p = playerOf(b);
    expect(soundProblems(p, b.log, moved(p, (_p, _a, from) => from)).filter((x) => x.startsWith("swing")).length).toBeGreaterThan(3);
  }, 120_000);

  it("whooshes at the start of the forward drive (the cue before the round-2 close) are caught", () => {
    const b = n70();
    const p = playerOf(b);
    const caught = soundProblems(p, b.log, moved(p, (q, a, from, to) => drive(q, a, from, to).start)).filter((x) => x.startsWith("swing")).length;
    const swings = p.timeline.cues.filter((c) => c.family === "swing").length;
    expect(caught).toBeGreaterThan(swings / 3);
  }, 120_000);

  it("a dash sound on another actor's run, and a throw sound off every throw of its step, are caught", () => {
    const b = n70();
    const p = playerOf(b);
    const dash = p.timeline.cues.find((c) => c.family === "dash")!;
    const who = dasherOf(b.log, dash.step);
    // (a run of another actor that starts when the dasher starts none: under sim version 8 the two
    // fighters of n 70 shuffle off together, so the other's first runs fall on the dasher's own)
    const own = (p.tracks.byId.get(who as never)?.segs ?? []).filter((g) => DASHES.has(g.clip)).map((g) => g.from);
    const other = p.tracks.actors.filter((tr) => tr.id !== who).flatMap((tr) => tr.segs)
      .find((g) => DASHES.has(g.clip) && g.from > 0 && own.every((t) => Math.abs(g.from - t) > 10))!;
    expect(other).toBeDefined();
    const onOther = p.timeline.cues.map((c) => (c === dash ? { ...c, at: other.from } : c));
    expect(soundProblems(p, b.log, onOther).some((x) => x.startsWith("dash sound"))).toBe(true);
    const thrown = BOUTS.find((x) => playerOf(x).timeline.cues.some((c) => c.family === "throw"))!;
    const q = playerOf(thrown);
    const off = q.timeline.cues.map((c) => (c.family === "throw" ? { ...c, at: c.at + 2000 } : c));
    expect(soundProblems(q, thrown.log, off).some((s) => s.startsWith("throw sound"))).toBe(true);
  }, 120_000);

  it("an impact 40 ms late is caught", () => {
    const p = playerOf(BOUTS[0]!);
    const late = p.timeline.cues.map((c) => (IMPACT.has(c.family) ? { ...c, at: c.at + 40 } : c));
    expect(soundProblems(p, BOUTS[0]!.log, late).some((x) => x.includes("from its contact"))).toBe(true);
  });
});
