import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { applyDraft, createChampion, generateDraft, simulateFight, snapshot } from "@agoge/core";
import { combineSeed, makeRng } from "@agoge/core";
import type { BattlePlan } from "@agoge/core";
import { narrate, type Line } from "../src/narrate.js";
import { MELEE_CONTACT_MS, MISSILE_LAUNCH_MS } from "../src/beats.js";
import {
  CLIP_MS,
  CONTACT_AT,
  REACT_DELAY_MS,
  contactFor,
  puppetClip,
  puppetEnabled,
  type ClipInput,
} from "../src/puppetClips.js";
import { CLIPS, GUARD, puppetCss, track, type Pose } from "../src/puppetPoses.js";

vi.setConfig({ testTimeout: 30_000 });

const RESULT = { reason: "ko", winner: 0 as const };
const at = (anim: Line["anim"], over: Partial<ClipInput> = {}): ClipInput => ({
  side: 1,
  anim,
  crit: false,
  idx: 5,
  finished: false,
  result: RESULT,
  swings: 0,
  dodges: 0,
  ...over,
});

describe("puppet clip selection", () => {
  it("walks on, then idles", () => {
    expect(puppetClip(at(undefined, { idx: 1 })).clip).toBe("run");
    expect(puppetClip(at(undefined)).clip).toBe("idle");
  });

  it("reacts on the slot's own clock", () => {
    const hurt = puppetClip(at({ reaction: { side: 1, kind: "hurt" } }));
    expect(hurt).toMatchObject({ clip: "hit", durMs: CLIP_MS.hurt, delayMs: REACT_DELAY_MS.hurt });
    const crit = puppetClip(at({ reaction: { side: 1, kind: "hurt" } }, { crit: true }));
    expect(crit).toMatchObject({ clip: "hit", heavy: true, durMs: CLIP_MS.hurtHard });
    expect(puppetClip(at({ reaction: { side: 1, kind: "block" } })).clip).toBe("block");
    // someone else's reaction is not ours
    expect(puppetClip(at({ reaction: { side: 0, kind: "hurt" } })).clip).toBe("idle");
  });

  it("cycles the dodge with the slot: two leans, then a duck", () => {
    const d = (n: number) => puppetClip(at({ reaction: { side: 1, kind: "dodge" } }, { dodges: n })).clip;
    expect([d(0), d(1), d(2), d(3)]).toEqual(["dodge", "dodge", "duck", "dodge"]);
  });

  it("alternates chop and thrust on this side's own count", () => {
    const s = (n: number) => puppetClip(at({ striker: 1 }, { swings: n })).clip;
    expect([s(0), s(1), s(2)]).toEqual(["chop", "thrust", "chop"]);
    expect(puppetClip(at({ striker: 1 }, { crit: true })).durMs).toBe(CLIP_MS.strikeCrit);
  });

  it("throws, jabs, casts and readies on the right beats", () => {
    expect(puppetClip(at({ striker: 1, thrown: true })).clip).toBe("throw");
    expect(puppetClip(at({ striker: 1, riposte: true })).clip).toBe("jab");
    expect(puppetClip(at({ striker: 1, chain: 3 })).durMs).toBe(CLIP_MS.chain[3]);
    expect(puppetClip(at({ striker: 1, cast: true })).clip).toBe("cast");
    expect(puppetClip(at({ striker: 1, heal: true })).durMs).toBe(CLIP_MS.mend);
    expect(puppetClip(at({ ready: 1 })).clip).toBe("ready");
    // a beast's bite is the beast's beat, not its master's swing
    expect(puppetClip(at({ striker: 1, beastId: "wolf" })).clip).toBe("idle");
  });

  it("starts the fall on the beat after the killing blow, before the verdict covers it", () => {
    // the winner draws a fresh weapon after the blow; the loser is already going down
    expect(puppetClip(at({ ready: 0 }, { side: 1, fallen: true })).clip).toBe("ko");
    expect(puppetClip(at({ reaction: { side: 1, kind: "hurt" } }, { side: 1, fallen: true })).clip).toBe("ko");
    // the winner is unaffected, and a bout that ended on time has nobody falling
    expect(puppetClip(at({ ready: 0 }, { side: 0, fallen: true })).clip).toBe("ready");
    expect(puppetClip(at(undefined, { side: 1, fallen: true, result: { reason: "time", winner: 0 } })).clip).toBe("idle");
  });

  it("ends the bout: the loser falls, the winner celebrates", () => {
    expect(puppetClip(at(undefined, { finished: true, side: 1 })).clip).toBe("ko");
    expect(puppetClip(at(undefined, { finished: true, side: 0 })).clip).toBe("win");
    expect(
      puppetClip(at(undefined, { finished: true, side: 1, result: { reason: "time", winner: 0 } })).clip,
    ).toBe("idle");
  });
});

const ANGLES = ["torso", "head", "uarmF", "farmF", "handF", "uarmB", "farmB", "thighF", "shinF", "thighB", "shinB", "rot"] as const;
const LINEAR = ["x", "y", "sx", "sy"] as const;
type K = (typeof ANGLES)[number] | (typeof LINEAR)[number];

describe("puppet timing contract", () => {
  it("lands the swing on the beats.ts melee clock", () => {
    expect(Math.abs(contactFor("strike") - MELEE_CONTACT_MS)).toBeLessThanOrEqual(10);
    const pct = Math.round(CONTACT_AT.strike * 100);
    for (const c of ["chop", "thrust"]) {
      // the contact key is the one carrying the impact squash
      const key = CLIPS[c]!.frames.find((f) => f.at === pct);
      expect(key?.pose.sy, c).toBeLessThan(1);
    }
  });

  it("lets the javelin go at the launch time, and not before", () => {
    expect(Math.abs(contactFor("release") - MISSILE_LAUNCH_MS)).toBeLessThanOrEqual(10);
    const pct = Math.round(CONTACT_AT.release * 100);
    const wpn = track(CLIPS.throw!, ["wpn"]);
    expect(wpn.filter((k) => k.at < pct).every((k) => k.vals.wpn === 1)).toBe(true);
    expect(wpn.find((k) => k.at === pct)?.vals.wpn).toBe(0);
  });

  it("mirrors the slot durations in styles.css", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const ms = (sel: string) =>
      Number(new RegExp(`\\.${sel} \\{ animation: \\w+ calc\\((\\d+)ms`).exec(css)?.[1]);
    expect(ms("strike-r")).toBe(CLIP_MS.strike);
    expect(ms("throw-r")).toBe(CLIP_MS.throw);
    expect(ms("hurt-l")).toBe(CLIP_MS.hurt);
    expect(ms("dodge-l")).toBe(CLIP_MS.dodge);
    expect(ms("block-l")).toBe(CLIP_MS.block);
    expect(ms("riposte-r")).toBe(CLIP_MS.riposte);
    expect(ms("cast-l")).toBe(CLIP_MS.cast);
    expect(ms("mend-l")).toBe(CLIP_MS.mend);
  });

  it("starts and ends every one-shot clip in the guard, so beats do not pop", () => {
    const same = (k: K, a: number) => {
      const g = GUARD[k as keyof Pose] as number;
      // 330 and -30 are the same arm
      return (LINEAR as readonly string[]).includes(k) ? a === g : (((a - g) % 360) + 360) % 360 === 0;
    };
    for (const [name, clip] of Object.entries(CLIPS)) {
      if (clip.hold || name === "idle" || name === "win") continue;
      for (const k of [...ANGLES, ...LINEAR]) {
        const t = track(clip, [k]);
        // the walk-on is the first beat of the bout and starts mid-stride, off stage
        if (name !== "run") expect(same(k, t[0]!.vals[k]!), `${name}.${k} starts at ${t[0]!.vals[k]}`).toBe(true);
        expect(same(k, t.at(-1)!.vals[k]!), `${name}.${k} ends at ${t.at(-1)!.vals[k]}`).toBe(true);
      }
    }
  });

  it("never turns a joint more than half a circle between two keys", () => {
    // A tween always takes the numeric path; a jump over 180° would spin the
    // arm the wrong way round, through the body.
    for (const [name, clip] of Object.entries(CLIPS)) {
      for (const k of ANGLES) {
        const t = track(clip, [k]);
        for (let i = 1; i < t.length; i++) {
          const d = Math.abs(t[i]!.vals[k]! - t[i - 1]!.vals[k]!);
          expect(d, `${name}.${k} ${t[i - 1]!.at}% -> ${t[i]!.at}%`).toBeLessThanOrEqual(180);
        }
      }
    }
  });
});

describe("puppet in real fights", () => {
  const PLAN: BattlePlan = { stance: "measured", gambit: "close_the_gap" };
  function grown(name: string, level: number) {
    const c = createChampion(name);
    for (let l = 1; l < level; l++) {
      const offers = generateDraft(c, l + 1, 0);
      applyDraft(c, offers, makeRng(combineSeed(c.seed, l)).int(offers.length), false);
    }
    return c;
  }

  it("has a drawn clip for every beat sixty bouts produce", () => {
    const css = puppetCss();
    const used = new Set<string>();
    for (let s = 0; s < 60; s++) {
      const r = simulateFight({
        seed: s,
        attacker: snapshot(grown("Alpha" + (s % 7), 6 + (s % 14)), PLAN),
        defender: snapshot(grown("Beta" + (s % 5), 6 + (s % 14)), PLAN),
      });
      const lines = narrate(r, ["Alpha", "Beta"]);
      lines.forEach((l, i) => {
        for (const side of [0, 1] as const) {
          const p = puppetClip({
            side,
            anim: l.anim,
            crit: !!l.fx?.crit,
            idx: i + 1,
            finished: false,
            result: r,
            swings: i,
            dodges: i,
          });
          used.add(p.heavy ? `${p.clip}-heavy` : p.clip);
        }
      });
      for (const side of [0, 1] as const) {
        const p = puppetClip({ side, anim: undefined, crit: false, idx: lines.length, finished: true, result: r, swings: 0, dodges: 0 });
        used.add(p.clip);
      }
    }
    for (const c of used) {
      expect(CLIPS[c], c).toBeDefined();
      expect(css).toContain(`[data-clip="${c}"]`);
    }
    expect(used.size).toBeGreaterThanOrEqual(10);
  });
});

describe("puppet flag", () => {
  function mem() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  }

  it("is off unless asked for, and remembers being asked", () => {
    const s = mem();
    expect(puppetEnabled("", s)).toBe(false);
    expect(puppetEnabled("?puppet=1", s)).toBe(true);
    expect(puppetEnabled("", s)).toBe(true);
    expect(puppetEnabled("?puppet=0", s)).toBe(false);
    expect(puppetEnabled("", s)).toBe(false);
  });

  it("survives storage that throws", () => {
    const bad = {
      getItem: (): string | null => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {},
    };
    expect(puppetEnabled("?puppet=1", bad)).toBe(true);
    expect(puppetEnabled("", bad)).toBe(false);
    expect(puppetEnabled("?puppet=1", null)).toBe(true);
  });
});
