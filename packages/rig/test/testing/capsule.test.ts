/**
 * Tests of the capsule test double and of the helpers in the rig contract (work package 0).
 * The double's clip lengths and event times are what the stage lane builds its timeline on, so
 * they are pinned here to the timing table of the rules. Its strike points, hit points and hand
 * anchors are what the stage places actors with, so they are measured here against the picture
 * the double really draws: a recording context that follows every transform, and a real Node
 * canvas for "is there paint under this point".
 */
import { describe, expect, it, vi } from "vitest";
import { Path2D, createCanvas } from "@napi-rs/canvas";
import { COMPANION_IDS, SHIELD_IDS, STAGE_IDS, WEAPON_IDS, WEAPON_META } from "@rankzero/core";
import type { HeldId, StageId } from "@rankzero/core";
import { boutAllSteps, l1Pipe } from "@rankzero/core/fixtures";
import { AIM_TOLERANCE, CLIP_FALLBACK, COMPANION_CLIPS, SHIELD_PLACEHOLDER, GATE_CLIPS, GATE_WEAPONS,
  PLACEHOLDER_COMPANION_CLIPS, SCRAPPER_BONES, SCRAPPER_CLIPS, TRAIL_LEN, TRAIL_STEP_MS, comboClipTime, placeholderLength,
  strikeTime, toStage } from "../../src/index";
import type { Aim, ContentClip, Ctx2D, DrawEnv, Dress, FxKind, MoveProp, Place, Pose, Rig, RigId } from "../../src/index";
import { CAPSULE_CLIPS, capsuleGateRig as gateRig, capsuleRig as rig, capsuleWeaponLength } from "../../src/testing/capsule";

const RIGS: readonly RigId[] = ["scrapper", ...COMPANION_IDS];
const HELD: readonly HeldId[] = ["fists", ...WEAPON_IDS];
const clipsOf = (r: RigId): readonly string[] => (r === "scrapper" ? SCRAPPER_CLIPS : COMPANION_CLIPS);
const events = (r: RigId, clip: string): string[] => rig.clipInfo(r, clip).events.map((e) => `${e.name}@${e.t}`);
const look = (build: number): Dress["look"] => ({ ...l1Pipe.look, build });
const bare: Dress = { held: null, shield: null, scale: 1 };

describe("contract lists", () => {
  it("has 24 scrapper clips, 13 gate clips, 6 companion clips and 16 bones", () => {
    expect(SCRAPPER_CLIPS.length).toBe(24);
    expect(GATE_CLIPS.length).toBe(13);
    expect(COMPANION_CLIPS.length).toBe(6);
    expect(SCRAPPER_BONES.length).toBe(16);
    expect(new Set(SCRAPPER_CLIPS).size).toBe(24);
    for (const c of GATE_CLIPS) expect(SCRAPPER_CLIPS).toContain(c);
    expect(CAPSULE_CLIPS).toEqual({ scrapper: SCRAPPER_CLIPS, companion: COMPANION_CLIPS, gate: GATE_CLIPS });
  });

  it("gives every clip outside the gate a gate fallback", () => {
    const content = SCRAPPER_CLIPS.filter((c) => !(GATE_CLIPS as readonly string[]).includes(c));
    expect(Object.keys(CLIP_FALLBACK).sort()).toEqual([...content].sort());
    for (const g of Object.values(CLIP_FALLBACK)) expect(GATE_CLIPS).toContain(g);
  });

  it("remembers the front hand for 160 ms in four steps", () => {
    expect([TRAIL_STEP_MS, TRAIL_LEN]).toEqual([40, 4]);
  });
});

describe("contract helpers", () => {
  const info = (durationMs: number, ...ev: [name: "contact" | "release" | "land" | "step", t: number][]) =>
    ({ durationMs, loop: false, events: ev.map(([name, t]) => ({ name, t })) });

  it("toStage mirrors an offset for an actor that faces left", () => {
    expect(toStage({ x: 100, y: 195, facing: 1 }, { x: 30, y: -50 })).toEqual({ x: 130, y: 145 });
    expect(toStage({ x: 100, y: 195, facing: -1 }, { x: 30, y: -50 })).toEqual({ x: 70, y: 145 });
  });

  it("strikeTime takes the contact, the release when there is no contact, and null when there is neither", () => {
    expect(strikeTime(info(280, ["contact", 150]))).toBe(150);
    expect(strikeTime(info(260, ["release", 180]))).toBe(180);
    expect(strikeTime(info(300, ["step", 10], ["release", 180], ["contact", 150]))).toBe(150);
    expect(strikeTime(info(450, ["land", 370]))).toBeNull();
    expect(strikeTime(info(1200))).toBeNull();
  });

  it("comboClipTime puts the strike of every attack clip at 120 of 220, which one straight scale cannot", () => {
    const attacks: [RigId, string][] = [["scrapper", "punch"], ["scrapper", "flick"], ["scrapper", "swing"], ["scrapper", "thrust"],
      ["scrapper", "smash"], ["scrapper", "throw"], ["scrapper", "slam"], ["raccoon", "attack"], ["goose", "attack"], ["boar", "attack"]];
    for (const [r, clip] of attacks) {
      const ci = rig.clipInfo(r, clip);
      const strike = strikeTime(ci)!;
      expect(comboClipTime(ci, 0, 220, 120), clip).toBe(0);
      expect(comboClipTime(ci, 120, 220, 120), clip).toBe(strike);
      expect(comboClipTime(ci, 220, 220, 120), clip).toBe(ci.durationMs);
      expect(comboClipTime(ci, -50, 220, 120), clip).toBe(0);
      expect(comboClipTime(ci, 999, 220, 120), clip).toBe(ci.durationMs);
      let last = -1;
      for (let t = 0; t <= 220; t += 1) {
        const ct = comboClipTime(ci, t, 220, 120);
        expect(ct, `${clip}@${t}`).toBeGreaterThanOrEqual(last);
        last = ct;
      }
    }
    // The fault this function is here to stop: 280 ms scaled to 220 strikes at 117.9, a smash at 138.9.
    expect((150 * 220) / 280).toBeCloseTo(117.86, 2);
    expect((240 * 220) / 380).toBeCloseTo(138.95, 2);
    // Half way to the strike is half way to the clip's strike; half way after it likewise.
    const smash = rig.clipInfo("scrapper", "smash");
    expect(comboClipTime(smash, 60, 220, 120)).toBe(120);
    expect(comboClipTime(smash, 170, 220, 120)).toBe(310);
  });

  it("comboClipTime scales a clip with no strike in one piece, and never divides by zero", () => {
    expect(comboClipTime(info(300), 110, 220, 120)).toBe(150);
    expect(comboClipTime(info(280, ["contact", 0]), 110, 220, 120)).toBe(140);
    expect(comboClipTime(info(280, ["contact", 150]), 110, 0, 0)).toBe(0);
    expect(comboClipTime(info(280, ["contact", 150]), Number.NaN, 220, 120)).toBe(0);
    expect(comboClipTime(info(280, ["contact", 150]), 110, 220, 220)).toBe(140);
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

  it("gives every weapon's own clip a strike time", () => {
    for (const id of HELD) expect(strikeTime(rig.clipInfo("scrapper", WEAPON_META[id].clip)), id).not.toBeNull();
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
  const flat = (p: Pose): number[] => [...p.rot, p.root.x, p.root.y, p.root.sx, p.root.sy, p.lift, ...(p.trail ?? [])];

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
        // The body holds its last pose. Its trail does not: 500 ms after the end the hand has
        // been still for longer than the trail is, so every entry is the last pose's angle.
        const { trail: late, ...held } = rig.samplePose(r, clip, d + 500);
        const { trail: atEnd, ...last } = rig.samplePose(r, clip, d);
        expect(held, `${r}/${clip}`).toEqual(last);
        if (r === "scrapper") {
          const still = [0, 1, 2, 7, 8, 9].reduce((sum, i) => sum + last.rot[i]!, 0);
          expect(late, `${r}/${clip}`).toEqual(Array.from({ length: TRAIL_LEN }, () => still));
          expect(atEnd?.length).toBe(TRAIL_LEN);
        } else {
          expect(late).toBeUndefined();
        }
        expect(rig.samplePose(r, clip, -500)).toEqual(rig.samplePose(r, clip, 0));
      }
    }
  });

  it("carry the front hand's last 160 ms in `trail`, newest first (scrappers only)", () => {
    const hand = (p: Pose): number => [0, 1, 2, 7, 8, 9].reduce((sum, i) => sum + p.rot[i]!, 0);
    for (const clip of SCRAPPER_CLIPS) {
      const info = rig.clipInfo("scrapper", clip);
      for (const t of [0, 90, 150, info.durationMs]) {
        const p = rig.samplePose("scrapper", clip, t);
        expect(p.trail?.length, clip).toBe(TRAIL_LEN);
        p.trail!.forEach((angle, n) => {
          const back = t - (n + 1) * TRAIL_STEP_MS;
          const then = rig.samplePose("scrapper", clip, info.loop ? back : Math.max(0, back));
          expect(angle, `${clip}@${t} trail[${n}]`).toBeCloseTo(hand(then), 9);
        });
      }
    }
    // In the middle of a swing the hand is turning fast, so the past is not the present.
    const mid = rig.samplePose("scrapper", "swing", 150);
    expect(Math.abs(mid.trail![0]! - hand(mid))).toBeGreaterThan(20);
    for (const id of COMPANION_IDS) expect(rig.samplePose(id, "attack", 150).trail).toBeUndefined();
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
    // A name that every object has is still not a clip.
    expect(rig.clipInfo("scrapper", "constructor")).toEqual(rig.clipInfo("scrapper", "idle"));
    expect(rig.strikePoint("scrapper", "toString", bare)).toEqual(rig.strikePoint("scrapper", "idle", bare));
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

type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];
interface Pt { x: number; y: number }
const through = (m: Matrix, x: number, y: number): Pt => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
/** One `fill(path)` call: the path string and the transform it was filled under. */
interface PathFill { d: string; m: Matrix; colour: string }
/** One `ellipse` call, with its centre in stage units. */
interface Blob extends Pt { rx: number; ry: number; colour: string }
interface Recording { env: DrawEnv; calls: string[]; paths: string[]; colours: Set<string>; fills: PathFill[]; blobs: Blob[];
  lines: Pt[]; rects: number; rectSizes: [w: number, h: number][] }

/** A context that records calls, follows the transform, and throws on any member outside the
 *  contract's subset. */
function recorder(): Recording {
  const calls: string[] = [];
  const paths: string[] = [];
  const colours = new Set<string>();
  const fills: PathFill[] = [];
  const blobs: Blob[] = [];
  const lines: Pt[] = [];
  const rectSizes: [number, number][] = [];
  const out = { rects: 0 };
  const state: Record<string, unknown> = {};
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  let pending: Blob | null = null;
  const target: Record<string, unknown> = {};
  for (const name of CTX_METHODS) target[name] = (...args: unknown[]) => {
    calls.push(name);
    for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) throw new Error(`${name} got a number that is not finite`);
    const n = args as number[];
    switch (name) {
      case "save": stack.push([...m]); break;
      case "restore": { const top = stack.pop(); if (top === undefined) throw new Error("restore with nothing saved"); m = top; break; }
      case "translate": m = [m[0], m[1], m[2], m[3], m[0] * n[0]! + m[2] * n[1]! + m[4], m[1] * n[0]! + m[3] * n[1]! + m[5]]; break;
      case "rotate": {
        const c = Math.cos(n[0]!);
        const s = Math.sin(n[0]!);
        m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, -m[0] * s + m[2] * c, -m[1] * s + m[3] * c, m[4], m[5]];
        break;
      }
      case "scale": m = [m[0] * n[0]!, m[1] * n[0]!, m[2] * n[1]!, m[3] * n[1]!, m[4], m[5]]; break;
      case "transform": case "setTransform": throw new Error(`the capsule rig called ${name}; this recorder does not follow it`);
      case "beginPath": pending = null; break;
      case "ellipse": pending = { ...through(m, n[0]!, n[1]!), rx: n[2]!, ry: n[3]!, colour: "" }; break;
      case "moveTo": case "lineTo": lines.push(through(m, n[0]!, n[1]!)); break;
      case "rect": out.rects += 1; rectSizes.push([n[2]!, n[3]!]); break;
      case "fill": {
        const path = args[0] as { d: string } | undefined;
        if (path !== undefined) fills.push({ d: path.d, m: [...m], colour: String(state.fillStyle) });
        else if (pending !== null) blobs.push({ ...pending, colour: String(state.fillStyle) });
        break;
      }
      default: break;
    }
    return name === "measureText" ? { width: 10 } : undefined;
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
  return { env: { ctx, path: (d) => { paths.push(d); return { d }; } }, calls, paths, colours, fills, blobs, lines, rectSizes,
    get rects() { return out.rects; } };
}

/** The point of a filled path that is farthest from the path's own origin, in stage units:
 *  the striking end of a capsule weapon or of its last link. */
function farPoint(fill: PathFill): Pt {
  let best: [number, number] = [0, 0];
  for (const pair of fill.d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
    const x = Number(pair[1]);
    const y = Number(pair[2]);
    if (Math.hypot(x, y) > Math.hypot(best[0], best[1])) best = [x, y];
  }
  return through(fill.m, best[0], best[1]);
}
const origin = (fill: PathFill): Pt => through(fill.m, 0, 0);
const dist = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y);
const near = (p: Pt, q: Pt, what: string): void => { expect(dist(p, q), `${what}: ${JSON.stringify(p)} against ${JSON.stringify(q)}`).toBeLessThan(1e-6); };

const PLACES: readonly Place[] = [{ x: 140, y: 195, facing: 1 }, { x: 220, y: 195, facing: -1 }];
const SCALES = [1, 1.15] as const;
const BUILDS = [0, 1, 2] as const;
/** Every way a scrapper can be sized and turned: 2 facings x 2 scales x 3 builds. */
const SIZES: { at: Place; scale: number; build: number }[] = PLACES.flatMap((at) => SCALES.flatMap((scale) => BUILDS.map((build) => ({ at, scale, build }))));

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
        rig.drawActor(rec.env, pose, { look: l1Pipe.look, held: r === "scrapper" ? "pipe" : null, shield: r === "scrapper" ? "car-door" : null, scale: 1 }, left);
        rig.drawActor(rec.env, pose, { held: null, shield: null, scale: 1.15, tint: "white" }, right);
      }
      expect(rec.calls.length, `${r}/${clip}`).toBeGreaterThan(20);
      expect(rec.calls.filter((c) => c === "save").length).toBe(rec.calls.filter((c) => c === "restore").length);
      if (r === "scrapper") expect(rec.paths.length).toBeGreaterThan(0);    // the held weapon goes through DrawEnv.path
    }
  });

  it("draws every held item in the hand without leaving the Ctx2D subset", () => {
    for (const id of HELD) {
      const rec = recorder();
      const clip = WEAPON_META[id].clip;
      for (const t of [0, 90, 150, 240]) {
        rig.drawActor(rec.env, rig.samplePose("scrapper", clip, t), { look: l1Pipe.look, held: id, shield: null, scale: 1, lead: "B", prop: "can" }, right);
      }
      expect(rec.calls.filter((c) => c === "save").length, id).toBe(rec.calls.filter((c) => c === "restore").length);
    }
  });

  it("draws a white flash with white fills and the ink outline only", () => {
    const rec = recorder();
    rig.drawActor(rec.env, rig.samplePose("scrapper", "hit-light", 60), { look: l1Pipe.look, held: "pipe", shield: "car-door", scale: 1, tint: "white", prop: "horn" }, left);
    expect([...rec.colours].sort()).toEqual(["#14152B", "#FFFFFF"]);
  });

  it("draws every prop and every effect, and nothing for an unknown effect", () => {
    const rec = recorder();
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

  it("gives portraits and icons as plain SVG data", () => {
    for (const art of [rig.portrait(l1Pipe.look), rig.companionPortrait("goose"), rig.icon("pipe"), rig.icon("stat:health"), rig.icon("ui:pause")]) {
      expect(art.viewBox).toMatch(/^0 0 \d+ \d+$/);
      expect(art.parts.length).toBeGreaterThan(0);
      for (const p of art.parts) expect(p.d).toMatch(/^M/);
    }
  });
});

describe("capsule arenas", () => {
  const drawn = (r: Rig, stage: StageId, bounce = 0): Recording => {
    const rec = recorder();
    r.drawStage(rec.env, stage, "back", bounce);
    r.drawStage(rec.env, stage, "floor", bounce);
    return rec;
  };

  it("draws all five, each in its own colours, with the same geometry", () => {
    const yard = drawn(rig, "yard");
    const palettes = new Set<string>();
    for (const id of STAGE_IDS) {
      const rec = drawn(rig, id);
      expect(rec.calls.filter((c) => c === "fillRect").length, id).toBeGreaterThanOrEqual(2);
      expect(rec.calls.filter((c) => c === "save").length, id).toBe(rec.calls.filter((c) => c === "restore").length);
      palettes.add([...rec.colours].sort().join(" "));
      // The floor line, the ring and the crowd are in the same place in every arena.
      expect(rec.blobs.map((b) => [b.x, b.y]), id).toEqual(yard.blobs.map((b) => [b.x, b.y]));
      expect(rec.lines.slice(-4), id).toEqual(yard.lines.slice(-4));
    }
    expect(palettes.size).toBe(5);
  });

  it("lifts the crowd on a bounce and holds the bounce inside 0 to 1", () => {
    const y = (bounce: number): number[] => drawn(rig, "gym", bounce).blobs.map((b) => b.y);
    expect(y(1)[0]!).toBeLessThan(y(0)[0]!);
    expect(y(7)).toEqual(y(1));
    expect(y(-3)).toEqual(y(0));
  });

  it("draws the yard for an arena it does not know, and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const odd = drawn(rig, "car-park" as StageId);
    drawn(rig, "car-park" as StageId);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    expect([...odd.colours].sort()).toEqual([...drawn(rig, "yard").colours].sort());
  });
});

describe("capsule geometry: what the stage places actors with", () => {
  const dressOf = (id: HeldId, scale: number, build: number, more: Partial<Dress> = {}): Dress =>
    ({ look: look(build), held: id, shield: null, scale, ...more });
  /** The pose of a clip at its strike, drawn, with every point the test needs. */
  const atStrike = (clip: string, dress: Dress, at: Place) => {
    const pose = rig.samplePose("scrapper", clip, strikeTime(rig.clipInfo("scrapper", clip)) ?? 0);
    const rec = recorder();
    rig.drawActor(rec.env, pose, dress, at);
    return { pose, rec, anchor: rig.handAnchor(pose, dress, at), strike: toStage(at, rig.strikePoint("scrapper", clip, dress)) };
  };

  it("makes a weapon 12 units long plus 10 for each point of Reach", () => {
    expect(capsuleWeaponLength("pocket-knife")).toBe(12);
    expect(capsuleWeaponLength("pipe")).toBe(22);
    expect(capsuleWeaponLength("bat")).toBe(32);
    expect(capsuleWeaponLength("broom")).toBe(42);
    expect(capsuleWeaponLength("bike-chain")).toBe(52);
    for (const id of WEAPON_IDS) expect(capsuleWeaponLength(id), id).toBe(12 + 10 * WEAPON_META[id].reach);
    expect(capsuleWeaponLength("fists")).toBe(0);
  });

  it("puts the hand anchor on the hand it draws, for both facings, both scales and all three builds", () => {
    for (const clip of ["idle", "swing", "punch", "throw", "win", "ko-fall"]) for (const { at, scale, build } of SIZES) {
      const dress = dressOf("pipe", scale, build);
      for (const t of [0, 150, 280]) {
        const pose = rig.samplePose("scrapper", clip, t);
        const rec = recorder();
        rig.drawActor(rec.env, pose, dress, at);
        const a = rig.handAnchor(pose, dress, at);
        // A hand is a skin-coloured round blob of 3.8 x scale. One is centred on the anchor.
        const hands = rec.blobs.filter((b) => dist(b, a) < 1e-6);
        expect(hands.length, `${clip}@${t} ${JSON.stringify({ at, scale, build })}`).toBe(1);
        expect(hands[0]!.rx).toBeCloseTo(3.8 * scale, 9);
        // And the weapon is gripped there.
        near(origin(rec.fills[0]!), a, `${clip}@${t} grip`);
      }
    }
  });

  it("mirrors the hand anchor for an actor that faces left, and keeps its angle in the actor's own frame", () => {
    for (const scale of SCALES) for (const build of BUILDS) {
      const dress = dressOf("pipe", scale, build);
      const pose = rig.samplePose("scrapper", "swing", 150);
      const a = rig.handAnchor(pose, dress, { x: 100, y: 195, facing: 1 });
      const b = rig.handAnchor(pose, dress, { x: 100, y: 195, facing: -1 });
      expect(a.x).toBeGreaterThan(100);                      // the swing reaches forward at contact
      expect(b.x - 100).toBeCloseTo(-(a.x - 100), 9);
      expect(b.y).toBeCloseTo(a.y, 9);
      expect(b.rot).toBe(a.rot);                             // before mirroring: the same for both
      expect(a.y).toBeLessThan(195);
      expect(a.y).toBeGreaterThan(195 - 84 * 1.15 * 1.06);
    }
    // The anchor moves with the body size: a Mountain's hand is farther out than a lean scrapper's.
    const pose = rig.samplePose("scrapper", "punch", 150);
    const small = rig.handAnchor(pose, dressOf("fists", 1, 0), PLACES[0]!);
    const big = rig.handAnchor(pose, dressOf("fists", 1.15, 2), PLACES[0]!);
    expect(big.x - small.x).toBeGreaterThan(5);
  });

  it("draws a flying item at the anchor exactly as it sits in the hand", () => {
    const rigid = WEAPON_IDS.filter((id) => WEAPON_META[id].flex !== true && WEAPON_META[id].pair !== true);
    expect(rigid.length).toBe(36);
    for (const id of rigid) for (const { at, scale, build } of SIZES) {
      const dress = dressOf(id, scale, build);
      const { rec, anchor } = atStrike(WEAPON_META[id].clip, dress, at);
      expect(rec.fills.length, id).toBe(1);
      const flying = recorder();
      rig.drawProp(flying.env, id, { x: anchor.x, y: anchor.y, facing: at.facing, rot: anchor.rot });
      expect(flying.fills.length, id).toBe(1);
      expect(flying.fills[0]!.d, id).toBe(rec.fills[0]!.d);
      flying.fills[0]!.m.forEach((v, n) => expect(v, `${id} matrix[${n}]`).toBeCloseTo(rec.fills[0]!.m[n]!, 9));
      near(farPoint(flying.fills[0]!), farPoint(rec.fills[0]!), `${id} tip`);
    }
  });

  it("draws what a hand holds at its own size, whatever the body scale", () => {
    for (const id of WEAPON_IDS) for (const { at, scale, build } of SIZES) {
      const { rec } = atStrike(WEAPON_META[id].clip, dressOf(id, scale, build), at);
      for (const fill of rec.fills) {
        expect(Math.abs(fill.m[0] * fill.m[3] - fill.m[1] * fill.m[2]), `${id} at scale ${scale}`).toBeCloseTo(1, 9);
      }
    }
  });

  it("gives a strike point that is the drawn striking end, for every weapon in every size", () => {
    let checked = 0;
    for (const id of WEAPON_IDS) for (const { at, scale, build } of SIZES) {
      const meta = WEAPON_META[id];
      const what = `${id} ${JSON.stringify({ at, scale, build })}`;
      const { rec, anchor, strike } = atStrike(meta.clip, dressOf(id, scale, build), at);
      if (meta.clip === "throw") {
        near(strike, anchor, `${what}: the release point is the hand`);
      } else if (meta.pair === true) {
        // One in each hand. The strike is the tip of the one in the leading hand.
        expect(rec.fills.length, what).toBe(2);
        const leading = rec.fills.filter((f) => dist(origin(f), anchor) < 1e-6);
        expect(leading.length, what).toBe(1);
        near(strike, farPoint(leading[0]!), what);
      } else if (meta.flex === true) {
        expect(rec.fills.length, what).toBe(4);
        near(origin(rec.fills[0]!), anchor, `${what}: the first link is in the hand`);
        near(strike, farPoint(rec.fills[3]!), what);
      } else {
        expect(rec.fills.length, what).toBe(1);
        near(strike, farPoint(rec.fills[0]!), what);
        expect(dist(strike, anchor), what).toBeCloseTo(capsuleWeaponLength(id), 6);
      }
      checked += 1;
    }
    expect(checked).toBe(41 * 12);
  });

  it("gives the leading fist as the strike point of bare hands, and the back fist when the back hand leads", () => {
    for (const { at, scale, build } of SIZES) {
      const front = atStrike("punch", dressOf("fists", scale, build), at);
      expect(front.rec.fills).toEqual([]);
      near(front.strike, front.anchor, "front fist");
      expect(front.rec.blobs.filter((b) => dist(b, front.strike) < 1e-6).length).toBe(1);

      const back = atStrike("punch", dressOf("fists", scale, build, { lead: "B" }), at);
      near(back.strike, back.anchor, "back fist");
      const fist = back.rec.blobs.filter((b) => dist(b, back.strike) < 1e-6);
      expect(fist.length).toBe(1);
      expect(fist[0]!.rx).toBeCloseTo(3.6 * scale, 9);                       // the back hand is drawn a little smaller
      expect(dist(back.strike, front.strike)).toBeGreaterThan(1);            // the two shoulders are 2 units apart
      expect(dist(back.strike, front.strike)).toBeLessThan(4 * scale * 1.06);
      // `held: null` and "fists" are the same thing.
      near(toStage(at, rig.strikePoint("scrapper", "punch", { ...dressOf("fists", scale, build), held: null })), front.strike, "null");
    }
  });

  it("reads `lead` only for a pair: a pipe stays in the front hand", () => {
    const at = PLACES[1]!;
    const front = atStrike("swing", dressOf("pipe", 1, 0), at);
    const back = atStrike("swing", dressOf("pipe", 1, 0, { lead: "B" }), at);
    near(back.strike, front.strike, "pipe");
    for (const id of ["knuckle-dusters", "screwdrivers"] as const) {
      const f = atStrike(WEAPON_META[id].clip, dressOf(id, 1, 0), at);
      const b = atStrike(WEAPON_META[id].clip, dressOf(id, 1, 0, { lead: "B" }), at);
      expect(dist(f.strike, b.strike), id).toBeGreaterThan(1);
      const leading = b.rec.fills.filter((fill) => dist(origin(fill), b.anchor) < 1e-6);
      expect(leading.length, id).toBe(1);
      near(b.strike, farPoint(leading[0]!), id);
    }
  });

  it("lets a weapon that bends trail the hand: at contact its far end is behind a stiff one", () => {
    const at = PLACES[0]!;
    for (const id of ["bike-chain", "ball-and-chain", "rubber-chicken"] as const) {
      const clip = WEAPON_META[id].clip;
      const { rec, anchor, strike, pose } = atStrike(clip, dressOf(id, 1, 0), at);
      const angles = rec.fills.map((f) => Math.atan2(f.m[1], f.m[0]));
      expect(new Set(angles.map((a) => a.toFixed(3))).size, id).toBeGreaterThan(1);       // the links do not line up
      for (let n = 1; n < rec.fills.length; n++) {
        // each link starts where the one before it ends
        const before = rec.fills[n - 1]!;
        near(origin(rec.fills[n]!), through(before.m, capsuleWeaponLength(id) / 4, 0), `${id} link ${n}`);
      }
      expect(dist(strike, anchor), id).toBeLessThan(capsuleWeaponLength(id) - 0.5);        // bent, so shorter than straight
      // Without its past the same pose draws the weapon straight, and so does a flying one.
      const still = recorder();
      rig.drawActor(still.env, { ...pose, trail: undefined }, dressOf(id, 1, 0), at);
      expect(dist(farPoint(still.fills[3]!), anchor), id).toBeCloseTo(capsuleWeaponLength(id), 6);
      const flying = recorder();
      rig.drawProp(flying.env, id, { x: 50, y: 60, facing: 1, rot: 0 });
      near(farPoint(flying.fills[3]!), { x: 50 + capsuleWeaponLength(id), y: 60 }, `${id} in flight`);
    }
  });

  it("gives every clip of every rig a finite strike point, in every size and for both rigs", () => {
    for (const r of [rig, gateRig]) {
      for (const clip of SCRAPPER_CLIPS) for (const scale of SCALES) for (const build of BUILDS) {
        for (const held of [null, "pipe", "bike-chain", "screwdrivers", "darts"] as const) {
          const p = r.strikePoint("scrapper", clip, { look: look(build), held, shield: null, scale });
          expect(Number.isFinite(p.x) && Number.isFinite(p.y), `${clip} ${held}`).toBe(true);
          // Inside a box no pose of an 84-unit figure with a 52-unit weapon can leave.
          expect(Math.abs(p.x) < 200 && p.y < 60 && p.y > -260, `${clip} ${held} ${JSON.stringify(p)}`).toBe(true);
        }
      }
      for (const id of COMPANION_IDS) for (const clip of COMPANION_CLIPS) {
        const p = r.strikePoint(id, clip, bare);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y), `${id}/${clip}`).toBe(true);
      }
    }
  });

  it("gives every attack a strike point in front of the attacker and above the floor", () => {
    for (const id of HELD) {
      const p = rig.strikePoint("scrapper", WEAPON_META[id].clip, dressOf(id, 1, 0));
      expect(p.x, id).toBeGreaterThan(25);
      expect(p.y, id).toBeLessThan(-30);
      expect(p.y, id).toBeGreaterThan(-90);
    }
    // More Reach strikes farther out, for stiff weapons on the same clip.
    const swing = (id: HeldId): number => rig.strikePoint("scrapper", "swing", dressOf(id, 1, 0)).x;
    expect(swing("bat") - swing("pipe")).toBeCloseTo(10, 6);
    expect(swing("golf-club") - swing("pipe")).toBeCloseTo(10, 6);
    // A bigger body strikes farther out.
    expect(rig.strikePoint("scrapper", "punch", dressOf("fists", 1.15, 0)).x).toBeGreaterThan(rig.strikePoint("scrapper", "punch", dressOf("fists", 1, 0)).x + 4);
  });

  it("gives a companion a strike point at the tip of its snout", () => {
    for (const id of COMPANION_IDS) for (const at of PLACES) for (const scale of SCALES) {
      const dress: Dress = { held: null, shield: null, scale };
      const pose = rig.samplePose(id, "attack", 150);
      const rec = recorder();
      rig.drawActor(rec.env, pose, dress, at);
      const strike = toStage(at, rig.strikePoint(id, "attack", dress));
      // The snout is a triangle; its tip is one of the points the picture was drawn through.
      expect(rec.lines.some((p) => dist(p, strike) < 1e-6), `${id} ${JSON.stringify(at)}`).toBe(true);
      const mouth = rig.handAnchor(pose, dress, at);
      near({ x: mouth.x, y: mouth.y }, strike, id);
      expect(mouth.rot).toBe(0);
      expect(at.facing * (strike.x - at.x), id).toBeGreaterThan(20);        // out in front
      expect(strike.y, id).toBeLessThan(at.y - 8);
    }
  });

  /** A real canvas, to ask "is there paint under this point". Stage units are pixels x 2. */
  const painted = (draw: (env: DrawEnv) => void): ((p: { x: number; y: number }) => boolean) => {
    const canvas = createCanvas(720, 480);
    const raw = canvas.getContext("2d");
    raw.setTransform(2, 0, 0, 2, 0, 0);
    const ctx: Ctx2D = raw;
    draw({ ctx, path: (d) => new Path2D(d) });
    const data = raw.getImageData(0, 0, 720, 480).data;
    return (p) => {
      const px = Math.round(p.x * 2);
      const py = Math.round(p.y * 2);
      if (px < 0 || py < 0 || px >= 720 || py >= 480) return false;
      return data[(py * 720 + px) * 4 + 3]! > 200;
    };
  };

  it("gives hit points that lie inside the drawn figure: head and body of all four rigs", () => {
    let checked = 0;
    for (const r of RIGS) for (const { at, scale, build } of SIZES) {
      const dress: Dress = { look: look(build), held: null, shield: null, scale };
      const place: Place = { ...at, x: 180, y: 220 };
      const has = painted((env) => rig.drawActor(env, rig.samplePose(r, "idle", 0), dress, place));
      const head = toStage(place, rig.hitPoint(r, dress, "head"));
      const body = toStage(place, rig.hitPoint(r, dress, "body"));
      const what = `${r} ${JSON.stringify({ facing: at.facing, scale, build })}`;
      expect(has(head), `${what} head ${JSON.stringify(head)}`).toBe(true);
      expect(has(body), `${what} body ${JSON.stringify(body)}`).toBe(true);
      expect(head.y, what).toBeLessThan(body.y);                              // the head is above the body
      expect(body.y, what).toBeLessThan(place.y - 8);
      // The control: there is no paint well above the head, so `has` can say no.
      expect(has({ x: head.x, y: head.y - 40 * scale }), `${what} above`).toBe(false);
      checked += 1;
    }
    expect(checked).toBe(7 * 12);
  });

  it("puts a long body's hit point on its front half, and scales every hit point with the body", () => {
    expect(rig.hitPoint("boar", bare, "body").x).toBeGreaterThan(8);
    expect(rig.hitPoint("boar", bare, "head").x).toBeGreaterThan(rig.hitPoint("boar", bare, "body").x);
    expect(Math.abs(rig.hitPoint("scrapper", bare, "body").x)).toBeLessThan(3);
    const small = rig.hitPoint("scrapper", { ...bare, look: look(0) }, "head");
    const tall = rig.hitPoint("scrapper", { ...bare, look: look(2) }, "head");
    const mountain = rig.hitPoint("scrapper", { ...bare, look: look(0), scale: 1.15 }, "head");
    expect(tall.y / small.y).toBeCloseTo(1.06, 6);
    expect(mountain.y / small.y).toBeCloseTo(1.15, 6);
    expect(small.y).toBeLessThan(-70);
    expect(small.y).toBeGreaterThan(-84);
    // What is held does not move the target.
    expect(rig.hitPoint("scrapper", { ...bare, held: "anvil", shield: "car-door" }, "body")).toEqual(rig.hitPoint("scrapper", bare, "body"));
  });

  it("draws a Move prop in the back hand and leaves the weapon where it is", () => {
    const at = PLACES[0]!;
    const pose = rig.samplePose("scrapper", "drink", 200);
    const plain = recorder();
    rig.drawActor(plain.env, pose, dressOf("pipe", 1, 0), at);
    for (const prop of ["can", "whistle", "horn"] as MoveProp[]) {
      const rec = recorder();
      rig.drawActor(rec.env, pose, dressOf("pipe", 1, 0, { prop }), at);
      expect(rec.rects, prop).toBe(plain.rects + 1);
      expect(rec.fills, prop).toEqual(plain.fills);
      expect(rec.colours.size, prop).toBe(plain.colours.size + 1);
    }
  });
});

describe("aim: a swing bent toward the target's height", () => {
  const dressOf = (id: HeldId, scale: number, build: number, more: Partial<Dress> = {}): Dress =>
    ({ look: look(build), held: id, shield: null, scale, ...more });
  /** Every height the stage may aim at: the head and body hit points of every rig in every size. */
  const heights = (zones: readonly ("head" | "body")[]): number[] => {
    const out: number[] = [];
    for (const r of RIGS) for (const scale of SCALES) for (const build of BUILDS) for (const zone of zones) {
      out.push(rig.hitPoint(r, { look: look(build), held: null, shield: null, scale }, zone).y);
    }
    return [...new Set(out)];                               // a companion has no build
  };
  const ANY_ZONE = heights(["head", "body"]);
  const BODY = heights(["body"]);
  const MELEE = HELD.filter((id) => WEAPON_META[id].clip !== "throw");

  it("covers a wide range of heights: from a Raccoon's body to a tall Mountain's head", () => {
    expect(Math.max(...ANY_ZONE)).toBeGreaterThan(-20);
    expect(Math.min(...ANY_ZONE)).toBeLessThan(-90);
    expect(MELEE.length).toBe(33);
  });

  it("puts every scrapper's striking end at the height asked for, for every held item, size, lead and target", () => {
    for (const r of [rig, gateRig]) {
      let checked = 0;
      let missedWithout = 0;
      for (const id of MELEE) for (const scale of SCALES) for (const build of BUILDS) for (const lead of ["F", "B"] as const) {
        const dress = dressOf(id, scale, build, { lead });
        const clip = WEAPON_META[id].clip;
        const plain = r.strikePoint("scrapper", clip, dress);
        for (const y of ANY_ZONE) {
          const p = r.strikePoint("scrapper", clip, dress, y);
          expect(Math.abs(p.y - y), `${id} ${JSON.stringify({ scale, build, lead, y, got: p })}`).toBeLessThanOrEqual(AIM_TOLERANCE);
          expect(p.x, `${id} strikes in front`).toBeGreaterThan(0);
          if (Math.abs(plain.y - y) > 3) missedWithout += 1;
          checked += 1;
        }
      }
      expect(checked).toBe(33 * 2 * 3 * 2 * ANY_ZONE.length);
      expect(ANY_ZONE.length).toBe(2 * 2 * 3 + 6 * 2 * 2);
      // The control: without the aim most of these heights are missed by more than 3 units, so
      // the line above can fail.
      expect(missedWithout).toBeGreaterThan(checked / 2);
    }
  });

  it("puts every companion's mouth at the height of any target's body", () => {
    for (const r of [rig, gateRig]) for (const id of COMPANION_IDS) for (const scale of SCALES) for (const y of BODY) {
      const p = r.strikePoint(id, "attack", { held: null, shield: null, scale }, y);
      expect(Math.abs(p.y - y), `${id} ${scale} ${y} got ${p.y}`).toBeLessThanOrEqual(AIM_TOLERANCE);
    }
  });

  it("gives an aimed strike point that is the drawn striking end of the aimed pose", () => {
    const cases: [HeldId, Partial<Dress>][] = [["fists", {}], ["fists", { lead: "B" }], ["pipe", {}], ["bat", {}],
      ["bike-chain", {}], ["screwdrivers", { lead: "B" }], ["sledgehammer", {}], ["lawn-flamingo", {}]];
    for (const [id, more] of cases) for (const { at, scale, build } of SIZES) for (const y of [-16, -40, -75]) {
      const dress = dressOf(id, scale, build, more);
      const clip = WEAPON_META[id].clip;
      const aim: Aim = { y, dress };
      const pose = rig.samplePose("scrapper", clip, strikeTime(rig.clipInfo("scrapper", clip)) ?? 0, aim);
      const rec = recorder();
      rig.drawActor(rec.env, pose, dress, at);
      const anchor = rig.handAnchor(pose, dress, at);
      const strike = toStage(at, rig.strikePoint("scrapper", clip, dress, y));
      const what = `${id} ${JSON.stringify({ at, scale, build, more, y })}`;
      if (id === "fists") {
        near(strike, anchor, what);
      } else {
        const leading = rec.fills.filter((f) => dist(origin(f), anchor) < 1e-6);
        expect(leading.length, what).toBe(1);
        // the tip is on the one stiff piece, or on the last of the four links of a chain
        const last = WEAPON_META[id].flex === true ? rec.fills[rec.fills.length - 1]! : leading[0]!;
        near(strike, farPoint(last), what);
      }
      expect(Math.abs(strike.y - (at.y + y)), what).toBeLessThanOrEqual(AIM_TOLERANCE);
    }
  });

  it("bends only a clip with a contact: full at the contact, none at its start and its end", () => {
    const dress = dressOf("pipe", 1, 0);
    const aim: Aim = { y: -18, dress };
    for (const clip of SCRAPPER_CLIPS) {
      const info = rig.clipInfo("scrapper", clip);
      const contact = info.events.find((e) => e.name === "contact");
      for (const t of [0, info.durationMs]) {
        expect(rig.samplePose("scrapper", clip, t, aim), `${clip}@${t}`).toEqual(rig.samplePose("scrapper", clip, t));
      }
      const mid = contact?.t ?? info.durationMs / 2;
      const bentPose = rig.samplePose("scrapper", clip, mid, aim);
      if (contact === undefined) expect(bentPose, clip).toEqual(rig.samplePose("scrapper", clip, mid));
      else expect(bentPose, clip).not.toEqual(rig.samplePose("scrapper", clip, mid));
    }
    // A throw is carried to the target by its flight, so its release point does not move.
    const darts: Dress = { ...dress, held: "darts" };
    expect(rig.strikePoint("scrapper", "throw", darts, -18)).toEqual(rig.strikePoint("scrapper", "throw", darts));
    // The bend is smooth: on top of the clip's own motion no bone turns more than 30 degrees
    // between two 60 fps frames (a jump would be the whole bend, 100 degrees or more). The real
    // rig keeps the rig lane's own line: no bone turns more than 45 degrees in one frame in all.
    for (const clip of ["punch", "swing", "smash", "thrust", "flick"]) {
      const step = 1000 / 60;
      for (let t = step; t <= rig.clipInfo("scrapper", clip).durationMs; t += step) {
        const prev = rig.samplePose("scrapper", clip, t - step, aim);
        const now = rig.samplePose("scrapper", clip, t, aim);
        const plainPrev = rig.samplePose("scrapper", clip, t - step);
        const plainNow = rig.samplePose("scrapper", clip, t);
        now.rot.forEach((v, i) => {
          const extra = Math.abs((v - prev.rot[i]!) - (plainNow.rot[i]! - plainPrev.rot[i]!));
          expect(extra, `${clip}@${t.toFixed(0)} bone ${SCRAPPER_BONES[i]}`).toBeLessThan(30);
        });
      }
    }
  });

  it("is a pure function of its inputs, and changes nothing without an aim", () => {
    const dress = dressOf("bike-chain", 1.15, 2);
    const a = rig.samplePose("scrapper", "swing", 120, { y: -20, dress });
    expect(rig.samplePose("scrapper", "swing", 120, { y: -20, dress })).toEqual(a);
    expect(rig.samplePose("scrapper", "swing", 120, undefined)).toEqual(rig.samplePose("scrapper", "swing", 120));
    expect(rig.strikePoint("scrapper", "swing", dress, undefined)).toEqual(rig.strikePoint("scrapper", "swing", dress));
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(rig.samplePose("scrapper", "swing", 120, { y: bad, dress })).toEqual(rig.samplePose("scrapper", "swing", 120));
    }
    // Out of reach (below the floor): as close as it can get, finite, and no throw.
    const p = rig.strikePoint("scrapper", "punch", dressOf("fists", 1, 0), 40);
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });
});

describe("capsuleGateRig: the double as a rig with no content pack", () => {
  it("answers a content clip with its gate clip, with no warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const [content, gate] of Object.entries(CLIP_FALLBACK) as [ContentClip, string][]) {
      expect(gateRig.clipInfo("scrapper", content), content).toEqual(rig.clipInfo("scrapper", gate));
      for (const t of [0, 90, 150, 400]) expect(gateRig.samplePose("scrapper", content, t), content).toEqual(rig.samplePose("scrapper", gate, t));
      // A throw keeps its own rule (the release point is the hand); it has a test of its own below.
      if (content !== "throw") {
        expect(gateRig.strikePoint("scrapper", content, { held: "pipe", shield: null, scale: 1 }), content)
          .toEqual(rig.strikePoint("scrapper", gate, { held: "pipe", shield: null, scale: 1 }));
      }
    }
    for (const clip of GATE_CLIPS) expect(gateRig.clipInfo("scrapper", clip), clip).toEqual(rig.clipInfo("scrapper", clip));
    for (const id of COMPANION_IDS) for (const clip of COMPANION_CLIPS) expect(gateRig.clipInfo(id, clip)).toEqual(rig.clipInfo(id, clip));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("changes the timeline in the two places the contract names: the throw and the smash", () => {
    expect(strikeTime(rig.clipInfo("scrapper", "throw"))).toBe(180);
    expect(rig.clipInfo("scrapper", "throw").events.map((e) => e.name)).toEqual(["release"]);
    expect(strikeTime(gateRig.clipInfo("scrapper", "throw"))).toBe(150);
    expect(gateRig.clipInfo("scrapper", "throw").events.map((e) => e.name)).toEqual(["contact"]);
    expect(gateRig.clipInfo("scrapper", "smash")).toMatchObject({ durationMs: 280 });
    expect(strikeTime(gateRig.clipInfo("scrapper", "smash"))).toBe(150);
    expect(gateRig.clipInfo("scrapper", "hit-heavy")).toEqual(rig.clipInfo("scrapper", "hit-light"));
  });

  it("still gives a throw its release point: the hand, at the fallback clip's strike", () => {
    const dress: Dress = { held: "darts", shield: null, scale: 1 };
    const pose = gateRig.samplePose("scrapper", "throw", 150);
    const hand = gateRig.handAnchor(pose, dress, { x: 0, y: 0, facing: 1 });
    const p = gateRig.strikePoint("scrapper", "throw", dress);
    expect(p.x).toBeCloseTo(hand.x, 9);
    expect(p.y).toBeCloseTo(hand.y, 9);
  });

  it("falls back to idle only for a name outside the clip lists", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(gateRig.clipInfo("scrapper", "cartwheel")).toEqual(rig.clipInfo("scrapper", "idle"));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("draws the yard for every arena and warns once for each of the other four", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const colours = (r: Rig, id: StageId): string[] => {
      const rec = recorder();
      r.drawStage(rec.env, id, "back", 0);
      r.drawStage(rec.env, id, "floor", 0);
      return [...rec.colours].sort();
    };
    const yard = colours(rig, "yard");
    for (const id of STAGE_IDS) expect(colours(gateRig, id), id).toEqual(yard);
    for (const id of STAGE_IDS) colours(gateRig, id);
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });

  it("draws the four gate effects and nothing for the six content effects or a Move prop", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const at: Place = { x: 100, y: 195, facing: 1 };
    for (const fx of ["burst", "dust", "spark", "whoosh"] as FxKind[]) {
      const rec = recorder();
      gateRig.drawFx(rec.env, fx, 0.5, at, 3);
      expect(rec.calls.filter((c) => c === "fill" || c === "stroke").length, fx).toBeGreaterThan(0);
    }
    expect(warn).toHaveBeenCalledTimes(0);
    for (const fx of ["tarp", "tape", "crackers", "rings", "plus", "trail"] as FxKind[]) {
      const rec = recorder();
      gateRig.drawFx(rec.env, fx, 0.5, at, 3);
      gateRig.drawFx(rec.env, fx, 0.6, at, 3);
      expect(rec.calls, fx).toEqual([]);
    }
    expect(warn).toHaveBeenCalledTimes(6);
    const pose = gateRig.samplePose("scrapper", "drink", 100);
    const plain = recorder();
    gateRig.drawActor(plain.env, pose, { held: null, shield: null, scale: 1 }, at);
    const withCan = recorder();
    gateRig.drawActor(withCan.env, pose, { held: null, shield: null, scale: 1, prop: "can" }, at);
    gateRig.drawActor(withCan.env, pose, { held: null, shield: null, scale: 1, prop: "can" }, at);
    expect(withCan.calls.length).toBe(plain.calls.length * 2);
    expect(warn).toHaveBeenCalledTimes(7);
    warn.mockRestore();
  });

  it("gives placeholder companions the fixed clip times of the contract, in both doubles", () => {
    for (const r of [rig, gateRig]) for (const id of COMPANION_IDS) for (const clip of COMPANION_CLIPS) {
      expect(r.clipInfo(id, clip), `${id}/${clip}`).toEqual(PLACEHOLDER_COMPANION_CLIPS[clip]);
    }
    expect(PLACEHOLDER_COMPANION_CLIPS.attack).toEqual({ durationMs: 280, loop: false, events: [{ t: 150, name: "contact" }] });
  });

  it("draws every weapon outside the gate as a straight bar placeholderLength(reach) long, tip at the far end", () => {
    expect([placeholderLength(0), placeholderLength(1), placeholderLength(4)]).toEqual([12, 22, 52]);
    const outside = WEAPON_IDS.filter((id) => !(GATE_WEAPONS as readonly string[]).includes(id));
    expect(outside.length).toBe(39);
    let checked = 0;
    for (const id of outside) for (const { at, scale, build } of SIZES) {
      const meta = WEAPON_META[id];
      const dress: Dress = { look: look(build), held: id, shield: null, scale };
      const clip = meta.clip === "throw" ? "punch" : meta.clip;      // a thrown item is held through a swing here
      const pose = gateRig.samplePose("scrapper", clip, strikeTime(gateRig.clipInfo("scrapper", clip)) ?? 0);
      const rec = recorder();
      gateRig.drawActor(rec.env, pose, dress, at);
      const anchor = gateRig.handAnchor(pose, dress, at);
      const what = `${id} ${JSON.stringify({ at, scale, build })}`;
      // One straight piece per hand: two for a pair, one for anything else, a weapon that bends included.
      expect(rec.fills.length, what).toBe(meta.pair === true ? 2 : 1);
      const held = rec.fills.filter((f) => dist(origin(f), anchor) < 1e-6);
      expect(held.length, what).toBe(1);
      expect(dist(farPoint(held[0]!), anchor), what).toBeCloseTo(placeholderLength(meta.reach), 6);
      if (meta.clip !== "throw") near(toStage(at, gateRig.strikePoint("scrapper", clip, dress)), farPoint(held[0]!), what);
      // On the floor it is the same bar.
      const floor = recorder();
      gateRig.drawProp(floor.env, id, { x: 50, y: 60, facing: 1, rot: 0 });
      expect(floor.fills.length, what).toBe(1);
      near(farPoint(floor.fills[0]!), { x: 50 + placeholderLength(meta.reach), y: 60 }, `${what} on the floor`);
      checked += 1;
    }
    expect(checked).toBe(39 * 12);
    // The full double still bends a chain: the straight bar is the gate-only rule.
    const full = recorder();
    rig.drawActor(full.env, rig.samplePose("scrapper", "swing", 150), { held: "bike-chain", shield: null, scale: 1 }, PLACES[0]!);
    expect(full.fills.length).toBe(4);
  });

  it("draws every shield as its SHIELD_PLACEHOLDER slab, the Car Door as the 22 x 32 panel, in the hand and on the floor", () => {
    expect(SHIELD_PLACEHOLDER["car-door"]).toEqual({ w: 22, h: 32 });
    for (const id of SHIELD_IDS) {
      const sz = SHIELD_PLACEHOLDER[id];
      const onArm = recorder();
      gateRig.drawActor(onArm.env, gateRig.samplePose("scrapper", "block-shield", 100), { held: "pipe", shield: id, scale: 1 }, PLACES[0]!);
      expect(onArm.rectSizes, id).toContainEqual([sz.w, sz.h]);
      const lying = recorder();
      gateRig.drawProp(lying.env, id, { x: 50, y: 60, facing: 1, rot: 0 });
      expect(lying.rectSizes[0], id).toEqual([sz.w, sz.h]);
    }
    const pose = gateRig.samplePose("scrapper", "idle", 0);
    const withDoor = recorder();
    gateRig.drawActor(withDoor.env, pose, { held: null, shield: "car-door", scale: 1 }, PLACES[0]!);
    expect(withDoor.rectSizes).toContainEqual([22, 32]);
    const floor = recorder();
    gateRig.drawProp(floor.env, "car-door", { x: 50, y: 60, facing: 1, rot: 0 });
    expect(floor.rectSizes[0]).toEqual([22, 32]);
  });
});
