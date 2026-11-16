/**
 * Round 2 audio review: every Move sounds like itself (a horn blast, a whistle, a shout, a can
 * cracked and gulped, a breath in, pops, a slam), never a shared music stinger; Move hits never
 * sound like a bare fist; crits and knockouts land heavier; weapon loudness holds its balance;
 * the fist swing is a swoosh, not a tick; the rubber ball is a real smack, not a cartoon boing.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOVE_IDS } from "@rankzero/core";
import type { Cue } from "@rankzero/stage";
import { soundFor } from "../../src/audio/cues";
import { ACCENT_SET, HIT_SET, MOVE_SET, SWISH_SET, itemSet, setsUsed } from "../../src/audio/soundMap";

const PUB = fileURLToPath(new URL("../../public/", import.meta.url));
interface Entry { start: number; dur: number; f?: number }
const map = JSON.parse(readFileSync(`${PUB}audio/sfx.json`, "utf8")) as {
  sets: Record<string, Entry[]>; families: Record<string, string>;
  sources: { set: string; variant: number; files: string[]; loud: number; phone: number }[];
};
const size = (n: string): number => map.sets[n]?.length ?? 0;
const filesOf = (set: string): string[] => map.sources.filter((s) => s.set === set).flatMap((s) => s.files);
const loudOf = (set: string): number[] => map.sources.filter((s) => s.set === set).map((s) => s.loud);
const cue = (c: Partial<Cue> & Pick<Cue, "family">): Cue => ({ at: 0, step: 0, variant: 0, ...c });

describe("Move sounds (contract rev 4)", () => {
  it("every Move has its own act set, in the core sprite, and no two Moves share one", () => {
    const acts = MOVE_IDS.map((id) => MOVE_SET[id].act);
    expect(new Set(acts).size).toBe(MOVE_IDS.length);
    for (const id of MOVE_IDS) {
      for (const set of [MOVE_SET[id].act, MOVE_SET[id].effect].filter((s): s is string => s !== undefined)) {
        expect(size(set), `${id} -> ${set}`).toBeGreaterThan(0);
        for (const e of map.sets[set]!) expect(e.f ?? 0, `${set} is in the core sprite`).toBe(0);
      }
    }
    for (const s of setsUsed()) expect(size(s), s).toBeGreaterThan(0);
  });

  it("a Move cue plays its Move's set, the same set every time, never a music jingle", () => {
    for (const id of MOVE_IDS) {
      const picks = [0, 1, 2, 3].map((v) => soundFor(cue({ family: "move", variant: v, step: v * 3, move: id, beat: "act" }), size)!.name);
      expect(new Set(picks), id).toEqual(new Set([MOVE_SET[id].act]));
      for (const f of filesOf(MOVE_SET[id].act)) expect(f, `${id}: ${f}`).not.toMatch(/jingle/i);
    }
    expect(soundFor(cue({ family: "move", move: "air-horn", beat: "act" }), size)!.name)
      .not.toBe(soundFor(cue({ family: "move", move: "whistle", beat: "act" }), size)!.name);
  });

  it("the family fallback for a Move is a quiet non-musical sound, not a stinger as loud as a punch", () => {
    const set = map.families.move!;
    for (const f of filesOf(set)) expect(f).not.toMatch(/jingle/i);
    for (const l of loudOf(set)) expect(l).toBeLessThanOrEqual(-22);
  });

  it("Firecrackers, Grapple and Body Slam hits play the Move's effect, not the bare fist", () => {
    for (const id of ["firecrackers", "grapple", "body-slam"] as const) {
      const c = cue({ family: "fist", item: "fists", on: "body", move: id, beat: "effect" });
      expect(itemSet(c), id).toBe(MOVE_SET[id].effect);
      expect(soundFor(c, size)!.name, id).not.toBe("hit-fist");
    }
    // a plain punch is still a punch
    expect(itemSet(cue({ family: "fist", item: "fists", on: "body" }))).toBe(HIT_SET.fists);
  });

  it("the Tarp and the Sand sound when they land, the drink is gulped, the Haymaker pays off", () => {
    for (const id of ["tarp", "sand-in-the-eyes", "energy-drink", "haymaker", "taunt"] as const) {
      expect(MOVE_SET[id].effect, id).toBeDefined();
    }
  });

  it("a crit or knockout blow has a heavy layer, quieter than the blow itself", () => {
    expect(itemSet(cue({ family: "landing", accent: true }))).toBe(ACCENT_SET);
    expect(itemSet(cue({ family: "landing" }))).toBeNull();      // a plain body fall is unchanged
    const fist = Math.max(...loudOf("hit-fist"));
    for (const l of loudOf(ACCENT_SET)) expect(l).toBeLessThan(fist - 2);
  });
});

describe("heard on a phone speaker (little comes back under 400 Hz)", () => {
  const phoneOf = (set: string): number[] => map.sources.filter((s) => s.set === set).map((s) => s.phone);
  it("no sound has its phone band more than 9 dB under its loudness (the Taunt shout sat 14 dB under)", () => {
    for (const s of map.sources) expect(s.loud - s.phone, `${s.set}[${s.variant}]`).toBeLessThanOrEqual(9 + 1.5);
  });

  it("the voiced Move sounds come through like a punch does: shout, snort, heave, grab grunt, squeeze", () => {
    const quietPunch = Math.min(...phoneOf("hit-fist"));
    // the shout and the squeeze (it replaces the punch) as loud as a punch in the phone band
    for (const set of [MOVE_SET.taunt.act, MOVE_SET.grapple.effect!]) {
      for (const p of phoneOf(set)) expect(p, set).toBeGreaterThanOrEqual(quietPunch - 0.5);
    }
    // each of them well over the crowd murmur
    const crowd = Math.max(...phoneOf("crowd"));
    for (const set of [MOVE_SET.taunt.act, MOVE_SET.taunt.effect!, MOVE_SET["body-slam"].act, MOVE_SET.grapple.act, MOVE_SET.grapple.effect!]) {
      for (const p of phoneOf(set)) expect(p, set).toBeGreaterThan(crowd + 1);
    }
  });

  it("every swish and throw variant carries in the phone band, none 8 dB under its loudest sibling", () => {
    for (const set of ["swish-light", "swish-medium", "throw"]) {
      const ps = phoneOf(set);
      expect(Math.max(...ps) - Math.min(...ps), set).toBeLessThanOrEqual(8);
    }
  });
});

describe("balance and character", () => {
  it("the paint can hits as hard as a punch and no set has variants more than 1.5 dB apart", () => {
    expect(Math.min(...loudOf("hit-paint"))).toBeGreaterThanOrEqual(Math.max(...loudOf("hit-fist")) - 1.5);
    for (const set of Object.keys(map.sets)) {
      const l = loudOf(set);
      expect(Math.max(...l) - Math.min(...l), set).toBeLessThanOrEqual(1.5);
    }
  });

  it("every swish and throw whoosh is 150 ms or more, never a tick", () => {
    for (const set of new Set([...Object.values(SWISH_SET), "throw", "throw-spin"])) {
      for (const e of map.sets[set]!) expect(e.dur, set).toBeGreaterThanOrEqual(150);
    }
  });

  it("the rubber ball smacks like a real ball, no cartoon boing", () => {
    expect(filesOf(HIT_SET["rubber-ball"]).some((f) => /boing|bung/i.test(f))).toBe(false);
  });
});
