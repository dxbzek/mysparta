/**
 * Tests of the capsule test double (work package 0). Its clip lengths and event times are what the
 * stage lane builds its timeline on, so they are pinned here to the timing table of the rules.
 */
import { describe, expect, it, vi } from "vitest";
import { COMPANION_IDS } from "@rankzero/core";
import { boutAllSteps, l1Pipe } from "@rankzero/core/fixtures";
import { CLIP_FALLBACK, COMPANION_CLIPS, GATE_CLIPS, SCRAPPER_BONES, SCRAPPER_CLIPS } from "../../src/index";
import type { Ctx2D, DrawEnv, FxKind, Place, Pose, RigId } from "../../src/index";
import { capsuleRig as rig } from "../../src/testing/capsule";

const RIGS: readonly RigId[] = ["scrapper", ...COMPANION_IDS];
const clipsOf = (r: RigId): readonly string[] => (r === "scrapper" ? SCRAPPER_CLIPS : COMPANION_CLIPS);
const events = (r: RigId, clip: string): string[] => rig.clipInfo(r, clip).events.map((e) => `${e.name}@${e.t}`);

describe("contract lists", () => {
  it("has 23 scrapper clips, 13 gate clips, 6 companion clips and 16 bones", () => {
    expect(SCRAPPER_CLIPS.length).toBe(23);
    expect(GATE_CLIPS.length).toBe(13);
    expect(COMPANION_CLIPS.length).toBe(6);
    expect(SCRAPPER_BONES.length).toBe(16);
    expect(new Set(SCRAPPER_CLIPS).size).toBe(23);
    for (const c of GATE_CLIPS) expect(SCRAPPER_CLIPS).toContain(c);
  });

  it("gives every clip outside the gate a gate fallback", () => {
    const content = SCRAPPER_CLIPS.filter((c) => !(GATE_CLIPS as readonly string[]).includes(c));
    expect(Object.keys(CLIP_FALLBACK).sort()).toEqual([...content].sort());
    for (const g of Object.values(CLIP_FALLBACK)) expect(GATE_CLIPS).toContain(g);
  });
});

describe("capsule clip times (the timing table of the rules)", () => {
  it("has the fixed lengths", () => {
    const want: Record<string, number> = {
      idle: 1200, enter: 450, punch: 280, flick: 280, swing: 280, thrust: 280, smash: 380, throw: 260,
      draw: 200, "hit-light": 300, "hit-heavy": 300, block: 220, evade: 320, "power-up": 350, drink: 450,
      slam: 600, slammed: 600, "ko-fall": 600,
    };
    for (const [clip, ms] of Object.entries(want)) expect(rig.clipInfo("scrapper", clip).durationMs, clip).toBe(ms);
  });

  it("puts one contact at 150 in the 280 ms swings, at 240 in the smash, and a release at 180 in the throw", () => {
    for (const clip of ["punch", "flick", "swing", "thrust"]) expect(events("scrapper", clip), clip).toEqual(["contact@150"]);
    expect(events("scrapper", "smash")).toEqual(["contact@240"]);
    expect(events("scrapper", "throw")).toEqual(["release@180"]);
    expect(events("scrapper", "slam")).toEqual(["contact@400"]);
    for (const id of COMPANION_IDS) {
      expect(rig.clipInfo(id, "attack").durationMs).toBe(280);
      expect(events(id, "attack")).toEqual(["contact@150"]);
    }
  });

  it("loops exactly the clips that must loop", () => {
    const loops = SCRAPPER_CLIPS.filter((c) => rig.clipInfo("scrapper", c).loop);
    expect(loops).toEqual(["idle", "dash", "backpedal", "snared", "win"]);
    for (const id of COMPANION_IDS) {
      expect(COMPANION_CLIPS.filter((c) => rig.clipInfo(id, c).loop)).toEqual(["idle", "run", "flee"]);
    }
  });

  it("keeps every event inside its clip", () => {
    for (const r of RIGS) for (const clip of clipsOf(r)) {
      const info = rig.clipInfo(r, clip);
      expect(info.durationMs).toBeGreaterThan(0);
      for (const e of info.events) expect(e.t >= 0 && e.t <= info.durationMs, `${r}/${clip}`).toBe(true);
    }
  });
});

describe("capsule poses", () => {
  const flat = (p: Pose): number[] => [...p.rot, p.root.x, p.root.y, p.root.sx, p.root.sy, p.lift];

  it("are finite, have one angle per bone and are equal for equal inputs", () => {
    for (const r of RIGS) for (const clip of clipsOf(r)) {
      const d = rig.clipInfo(r, clip).durationMs;
      for (let t = -40; t <= d + 40; t += 10) {
        const p = rig.samplePose(r, clip, t);
        expect(p.rig).toBe(r);
        expect(p.rot.length, `${r}/${clip}`).toBe(r === "scrapper" ? 16 : 6);
        for (const v of flat(p)) expect(Number.isFinite(v), `${r}/${clip}@${t}`).toBe(true);
        expect(p.lift).toBeGreaterThanOrEqual(0);
        expect(rig.samplePose(r, clip, t)).toEqual(p);
      }
    }
  });

  it("close their loops and hold the last pose of a one-shot clip", () => {
    for (const r of RIGS) for (const clip of clipsOf(r)) {
      const info = rig.clipInfo(r, clip);
      const d = info.durationMs;
      if (info.loop) {
        expect(flat(rig.samplePose(r, clip, d)), `${r}/${clip}`).toEqual(flat(rig.samplePose(r, clip, 0)));
        const a = flat(rig.samplePose(r, clip, d - 1));
        const b = flat(rig.samplePose(r, clip, 0));
        a.forEach((v, i) => expect(Math.abs(v - b[i]!), `${r}/${clip} jumps at the seam`).toBeLessThan(3));
      } else {
        expect(rig.samplePose(r, clip, d + 500)).toEqual(rig.samplePose(r, clip, d));
        expect(rig.samplePose(r, clip, -500)).toEqual(rig.samplePose(r, clip, 0));
      }
    }
  });

  // The numeric motion lines of the art gate (spacing, 45 degrees a frame) are for the real rig.
  // The capsule is a stand-in for timing and is held only to the squash limit.
  it("squash by 12% at most", () => {
    for (const r of RIGS) for (const clip of clipsOf(r)) {
      const d = rig.clipInfo(r, clip).durationMs;
      for (let t = 0; t <= d; t += 1000 / 60) {
        const p = rig.samplePose(r, clip, t);
        expect(Math.abs(p.root.sx - 1) <= 0.12 && Math.abs(p.root.sy - 1) <= 0.12, `${r}/${clip}`).toBe(true);
      }
    }
  });

  it("lift on the jumps only, and end the fall lying down", () => {
    expect(rig.samplePose("scrapper", "enter", 0).lift).toBeGreaterThan(20);
    expect(rig.samplePose("scrapper", "enter", 450).lift).toBe(0);
    expect(rig.samplePose("scrapper", "evade", 160).lift).toBe(14);
    for (const clip of ["idle", "dash", "punch", "swing", "smash", "brace", "win"]) {
      for (let t = 0; t <= 400; t += 20) expect(rig.samplePose("scrapper", clip, t).lift, clip).toBe(0);
    }
    const down = rig.samplePose("scrapper", "ko-fall", 600);
    expect(down.rot[0]).toBe(-90);
    expect(down.face).toBe("dazed");
  });

  it("winds up against the attack before contact, and passes the contact pose after it", () => {
    for (const clip of ["punch", "flick", "swing", "thrust", "smash"]) {
      const contact = rig.clipInfo("scrapper", clip).events[0]!.t;
      const x = (t: number): number => rig.samplePose("scrapper", clip, t).root.x;
      expect(x(contact - 60), `${clip} wind-up`).toBeLessThan(0);
      expect(x(contact), `${clip} contact`).toBeGreaterThan(4);
      expect(x(contact + 40), `${clip} follow-through`).toBeGreaterThan(x(contact));
    }
  });

  it("falls back to idle for an unknown clip, warns once and never throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(rig.clipInfo("scrapper", "moonwalk")).toEqual(rig.clipInfo("scrapper", "idle"));
    expect(rig.samplePose("boar", "moonwalk", 300)).toEqual(rig.samplePose("boar", "idle", 300));
    rig.clipInfo("scrapper", "moonwalk");
    expect(warn).toHaveBeenCalledTimes(2);                 // once per rig and name
    warn.mockRestore();
  });
});

/** Every member of Ctx2D. The two lines under it fail to compile when the list and the interface differ. */
const CTX_METHODS = ["save", "restore", "translate", "rotate", "scale", "transform", "setTransform", "beginPath",
  "closePath", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "arc", "ellipse", "rect", "fill", "stroke",
  "clip", "fillRect", "strokeRect", "clearRect", "fillText", "strokeText", "measureText", "setLineDash"] as const;
const CTX_PROPS = ["fillStyle", "strokeStyle", "lineWidth", "lineCap", "lineJoin", "miterLimit", "lineDashOffset",
  "globalAlpha", "font", "textAlign", "textBaseline"] as const;
type Listed = (typeof CTX_METHODS)[number] | (typeof CTX_PROPS)[number];
const LIST_IS_COMPLETE: [Exclude<keyof Ctx2D, Listed>, Exclude<Listed, keyof Ctx2D>] extends [never, never] ? true : false = true;

/** A context that records calls and throws on any member outside the contract's subset. */
function recorder(): { env: DrawEnv; calls: string[]; paths: string[]; colours: Set<string> } {
  const calls: string[] = [];
  const paths: string[] = [];
  const colours = new Set<string>();
  const state: Record<string, unknown> = {};
  const target: Record<string, unknown> = {};
  for (const m of CTX_METHODS) target[m] = (...args: unknown[]) => {
    calls.push(m);
    for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) throw new Error(`${m} got a number that is not finite`);
    return m === "measureText" ? { width: 10 } : undefined;
  };
  const ctx = new Proxy(target, {
    get(t, key) {
      if (typeof key === "symbol") return undefined;
      if (key in t) return t[key];
      if ((CTX_PROPS as readonly string[]).includes(key)) return state[key];
      throw new Error(`the rig read ctx.${key}, which is not in Ctx2D`);
    },
    set(_t, key, value) {
      if (typeof key === "symbol" || !(CTX_PROPS as readonly string[]).includes(key)) throw new Error(`the rig wrote ctx.${String(key)}, which is not in Ctx2D`);
      if ((key === "fillStyle" || key === "strokeStyle")) {
        if (typeof value !== "string") throw new Error(`${key} must be a colour string`);
        colours.add(value);
      }
      state[key] = value;
      return true;
    },
  }) as unknown as Ctx2D;
  return { env: { ctx, path: (d) => { paths.push(d); return { d }; } }, calls, paths, colours };
}

describe("capsule drawing", () => {
  const left: Place = { x: 70, y: 195, facing: 1 };
  const right: Place = { x: 290, y: 195, facing: -1 };

  it("lists every member of Ctx2D", () => {
    expect(LIST_IS_COMPLETE).toBe(true);
  });

  it("draws every clip of every rig with only the Ctx2D subset, and leaves the save stack balanced", () => {
    for (const r of RIGS) for (const clip of clipsOf(r)) {
      const rec = recorder();
      const d = rig.clipInfo(r, clip).durationMs;
      for (const t of [0, d / 3, d / 2, d]) {
        const pose = rig.samplePose(r, clip, t);
        rig.drawActor(rec.env, pose, { look: l1Pipe.look, held: r === "scrapper" ? "pipe" : null, door: r === "scrapper", scale: 1 }, left);
        rig.drawActor(rec.env, pose, { held: null, door: false, scale: 1.15, tint: "white" }, right);
      }
      expect(rec.calls.length, `${r}/${clip}`).toBeGreaterThan(20);
      expect(rec.calls.filter((c) => c === "save").length).toBe(rec.calls.filter((c) => c === "restore").length);
      if (r === "scrapper") expect(rec.paths.length).toBeGreaterThan(0);    // the held weapon goes through DrawEnv.path
    }
  });

  it("draws a white flash with white fills and the ink outline only", () => {
    const rec = recorder();
    rig.drawActor(rec.env, rig.samplePose("scrapper", "hit-light", 60), { look: l1Pipe.look, held: "pipe", door: true, scale: 1, tint: "white" }, left);
    expect([...rec.colours].sort()).toEqual(["#14152B", "#FFFFFF"]);
  });

  it("draws the yard, every prop and every effect, and nothing for an unknown effect", () => {
    const rec = recorder();
    rig.drawYard(rec.env, "back", 0);
    rig.drawYard(rec.env, "floor", 1);
    const props = new Set(boutAllSteps.steps.flatMap((s) => (s.t === "swap" ? [s.dropped] : s.t === "disarm" ? [s.weapon] : [])));
    for (const item of [...props, "car-door"] as const) rig.drawProp(rec.env, item, { ...left, rot: 30 });
    const kinds: FxKind[] = ["burst", "dust", "spark", "whoosh", "tarp", "tape", "crackers", "rings", "plus", "trail"];
    for (const fx of kinds) for (const p of [0, 0.5, 1, -1, 2]) rig.drawFx(rec.env, fx, p, right, 7);
    const before = rec.calls.length;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rig.drawFx(rec.env, "confetti-cannon" as FxKind, 0.5, left, 1);
    rig.drawFx(rec.env, "confetti-cannon" as FxKind, 0.6, left, 1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    expect(rec.calls.slice(before).filter((c) => c === "fill" || c === "stroke" || c === "fillRect")).toEqual([]);
    expect(rec.calls.filter((c) => c === "save").length).toBe(rec.calls.filter((c) => c === "restore").length);
  });

  it("mirrors the hand anchor for an actor that faces left", () => {
    const pose = rig.samplePose("scrapper", "swing", 150);
    const a = rig.handAnchor(pose, { x: 100, y: 195, facing: 1 });
    const b = rig.handAnchor(pose, { x: 100, y: 195, facing: -1 });
    expect(a.x).toBeGreaterThan(100);                      // the swing reaches forward at contact
    expect(b.x - 100).toBeCloseTo(-(a.x - 100), 6);
    expect(b.y).toBeCloseTo(a.y, 6);
    expect(a.y).toBeLessThan(195);
    expect(a.y).toBeGreaterThan(195 - 84);
  });

  it("gives portraits and icons as plain SVG data", () => {
    for (const art of [rig.portrait(l1Pipe.look), rig.companionPortrait("goose"), rig.icon("pipe"), rig.icon("stat:health"), rig.icon("ui:pause")]) {
      expect(art.viewBox).toMatch(/^0 0 \d+ \d+$/);
      expect(art.parts.length).toBeGreaterThan(0);
      for (const p of art.parts) expect(p.d).toMatch(/^M/);
    }
  });
});
