/**
 * Sound sync (sound review, owner on the recorded fight of find-bout level 30 n 70: "the sound
 * effects are off timing"). The picture is MEASURED, not read off the cue list:
 *  - an impact sound (fist, blunt, blade, block) starts within 30 ms of its contact (the contact
 *    mark is where contact-sync.test.ts proves every hit effect starts; build-audio.mjs cuts every
 *    sprite to start 5 ms before its onset, so a cue at the contact sounds 5 ms after it);
 *  - a swing's whoosh starts inside the swing's forward drive: from the first frame in which the
 *    striking hand moves toward the target at half its top forward speed or more (the hand found on
 *    the drawn pose, frame by frame, every 2 ms) up to the contact. It used to start at the start of
 *    the wind-up, 100 to 240 ms before the contact, and was heard before the arm came through;
 *  - a throw's sound starts on the throw clip's release (within 10 ms);
 *  - a dash's sound starts as its footwork starts, a run or a shuffle (within 10 ms), and there is
 *    none when the attacker is already in reach and does not move (there was, level 30 n 70).
 * The control: the same check on the cue list with the whooshes moved back to the wind-up's
 * start, and with an impact 40 ms late, must fail.
 */
import { describe, expect, it } from "vitest";
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import type { Cue } from "../src/contracts";
import type { StagePlayer } from "../src/createFightPlayer";
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

/** The forward drive of a strike seg: the first time from which the drawn hand moves toward the
 *  target at half its top forward speed or more, before its fastest sample. */
function driveStart(p: StagePlayer, actor: string, from: number, to: number): number {
  const xs: { t: number; x: number }[] = [];
  for (let t = from; t <= to; t += 2) {
    const f = p.frame(t).actors.find((a) => a.id === actor);
    if (f === undefined) continue;
    const h = FULL.handAnchor(FULL.samplePose(f.rig, f.clip, f.clipT, f.aim), f.dress, f.place);
    xs.push({ t, x: h.x * f.place.facing });
  }
  const v = xs.slice(1).map((q, k) => ({ t: xs[k]!.t, v: Math.max(0, q.x - xs[k]!.x) }));
  const top = Math.max(0, ...v.map((q) => q.v));
  if (top <= 0) return from;
  let k = v.findIndex((q) => q.v === top);
  while (k > 0 && v[k - 1]!.v >= top * 0.5) k -= 1;
  return v[k]!.t;
}

/** Every sound out of step with what the picture shows, as sentences. */
function soundProblems(p: StagePlayer, cues: readonly Cue[]): string[] {
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
        const seg = tr.segs.find((g) => STRIKES.has(g.clip) && Math.abs(g.to - mark.at) < 1 && g.from <= c.at + 1);
        if (seg === undefined) continue;
        const drive = driveStart(p, tr.id, seg.from, seg.to);
        if (c.at < drive - 10 || c.at > mark.at) out.push(`swing whoosh at ${Math.round(c.at)} ms, the forward drive is ${Math.round(drive)} to ${Math.round(mark.at)} ms (step ${c.step})`);
        break;
      }
      continue;
    }
    if (c.family === "throw") {
      const seg = tracks.flatMap((tr) => tr.segs).find((g) => g.clip === "throw" && g.from <= c.at && c.at <= g.to);
      if (seg !== undefined) {
        const release = FULL.clipInfo("scrapper", "throw").events.find((e) => e.name === "release")!.t;
        const at = seg.from + release / (seg.rate > 0 ? seg.rate : 1);
        if (Math.abs(c.at - at) > 10) out.push(`throw sound at ${Math.round(c.at)} ms, the release at ${Math.round(at)} ms (step ${c.step})`);
      }
      continue;
    }
    if (c.family === "dash") {
      const starts = tracks.flatMap((tr) => tr.segs).filter((g) => DASHES.has(g.clip) && Math.abs(g.from - c.at) <= 10);
      if (starts.length === 0) out.push(`dash sound at ${Math.round(c.at)} ms with no dash starting then (step ${c.step})`);
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
    it(`${b.name}: impacts on their contact, whooshes in the forward drive, throws on the release, dashes as they start`, () => {
      const p = playerOf(b);
      expect(p.timeline.cues.some((c) => c.family === "swing")).toBe(true);
      expect(soundProblems(p, p.timeline.cues)).toEqual([]);
    }, 60_000);
  }
});

describe("control: the check catches sounds out of step", () => {
  it("whooshes moved back to the start of the wind-up are caught", () => {
    const b = BOUTS.find((x) => x.name === "find-bout level 30 n 70")!;
    const p = playerOf(b);
    const early = p.timeline.cues.map((c) => {
      if (c.family !== "swing") return c;
      const mark = p.timeline.contacts.find((m) => m.step === c.step);
      const seg = mark === undefined ? undefined
        : p.tracks.actors.flatMap((tr) => tr.segs).find((g) => STRIKES.has(g.clip) && Math.abs(g.to - mark.at) < 1);
      return seg === undefined ? c : { ...c, at: seg.from };
    });
    expect(soundProblems(p, early).filter((x) => x.startsWith("swing")).length).toBeGreaterThan(3);
  }, 60_000);

  it("an impact 40 ms late is caught", () => {
    const p = playerOf(BOUTS[0]!);
    const late = p.timeline.cues.map((c) => (IMPACT.has(c.family) ? { ...c, at: c.at + 40 } : c));
    expect(soundProblems(p, late).some((x) => x.includes("from its contact"))).toBe(true);
  });
});
