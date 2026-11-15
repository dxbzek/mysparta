/**
 * The numeric motion lines of the WP2 gate (plan section 6) and the joint lines of the owner
 * amendment (13.2). They are proxies chosen by a planner: a clip that passes them and still looks
 * stiff on the sheet fails anyway.
 */
import { describe, expect, it } from "vitest";
import { GATE_CLIPS } from "../../src/contracts";
import { THROW } from "../../src/gate/clips/throw";
import { ONE_WAY_JOINTS, SCRAPPER_RIG } from "../../src/gate/skeleton";
import { ATTACKS, HOME, boneIndex, dress, ins, poses, rig, times } from "./helpers";

const S = "scrapper" as const;
const JUMPS = new Set(["enter", "evade", "ko-fall"]);
const bones = SCRAPPER_RIG.bones;

describe("timing table (one timing source)", () => {
  it("gives every gate clip its fixed length, loop flag and events", () => {
    const want: Record<string, [number, boolean, string[]]> = {
      idle: [1200, true, []], enter: [450, false, ["land@370"]], dash: [240, true, ["step@0", "step@120"]],
      backpedal: [240, true, ["step@0", "step@120"]], brace: [120, false, []], punch: [280, false, ["contact@150"]],
      flick: [280, false, ["contact@150"]], swing: [280, false, ["contact@150"]], draw: [200, false, []],
      "hit-light": [300, false, []], evade: [320, false, ["land@320"]], "ko-fall": [600, false, ["land@450"]], win: [800, true, []],
    };
    for (const c of GATE_CLIPS) {
      const info = rig.clipInfo(S, c);
      expect([info.durationMs, info.loop, info.events.map((e) => `${e.name}@${e.t}`)], c).toEqual(want[c]);
    }
  });
  it("the throw clip for the content pack: 260 with its release at 180", () => {
    expect([THROW.duration, THROW.loop, THROW.events.map((e) => `${e.name}@${e.t}`)]).toEqual([260, false, ["release@180"]]);
  });
  it("every attack clip has exactly one contact", () => {
    for (const [c] of ATTACKS) expect(rig.clipInfo(S, c).events.filter((e) => e.name === "contact").length, c).toBe(1);
  });
});

describe("poses", () => {
  it("are finite in every frame of every clip", () => {
    for (const c of GATE_CLIPS) for (const p of poses(rig, S, c)) {
      for (const v of [...p.rot, p.root.x, p.root.y, p.root.sx, p.root.sy, p.lift, ...(p.trail ?? [])]) expect(Number.isFinite(v), c).toBe(true);
    }
  });
  it("close their loops: the last frame runs into the first", () => {
    for (const c of GATE_CLIPS) {
      const info = rig.clipInfo(S, c);
      if (!info.loop) continue;
      const a = rig.samplePose(S, c, info.durationMs - 0.01);
      const b = rig.samplePose(S, c, 0);
      a.rot.forEach((v, i) => expect(Math.abs(v - b.rot[i]!), `${c} ${bones[i]!.id}`).toBeLessThan(0.6));
      expect(Math.abs(a.root.x - b.root.x) + Math.abs(a.root.y - b.root.y), c).toBeLessThan(0.1);
    }
  });
  it("keep the feet on the floor line unless the clip is a jump (a run's flight: above it, never under)", () => {
    for (const c of GATE_CLIPS) {
      if (JUMPS.has(c)) continue;
      const flies = c === "dash";
      for (const [i, p] of poses(rig, S, c).entries()) {
        const low = ins.lowest(p, ["footF", "footB"]);
        if (flies) expect(low, `${c} frame ${i}`).toBeLessThan(0.5);
        else expect(Math.abs(low), `${c} frame ${i}`).toBeLessThan(0.5);
      }
    }
  });
  it("keep planted feet still (under 0.5 units)", () => {
    for (const c of GATE_CLIPS) {
      const clip = ins.clip(S, c);
      for (const foot of clip.plant ?? []) {
        const fi = boneIndex(rig, S, foot);
        const ps = poses(rig, S, c).map((p) => ins.joints(p, dress("pipe"), HOME)[fi]!);
        const [x0, y0] = ps[0]!;
        for (const [x, y] of ps) expect(Math.hypot(x - x0, y - y0), `${c} ${foot}`).toBeLessThan(0.5);
      }
    }
  });
  it("only turn parts: every bone keeps its length to its parent in every frame", () => {
    for (const c of GATE_CLIPS) for (const p of poses(rig, S, c).filter((_, i) => i % 3 === 0)) {
      const j = ins.joints(p, dress("pipe"), HOME);
      bones.forEach((b, i) => {
        if (b.parent <= 0) return;
        const d = Math.hypot(j[i]![0] - j[b.parent]![0], j[i]![1] - j[b.parent]![1]);
        const L = Math.hypot(b.x, b.y);
        const lo = L * Math.min(p.root.sx, p.root.sy) - 0.01;
        const hi = L * Math.max(p.root.sx, p.root.sy) + 0.01;
        expect(d >= lo && d <= hi, `${c} ${b.id} ${d} not in ${lo}..${hi}`).toBe(true);
      });
    }
  });
  it("squash by 12% at most", () => {
    for (const c of GATE_CLIPS) for (const p of poses(rig, S, c)) {
      expect(Math.abs(p.root.sx - 1), c).toBeLessThanOrEqual(0.12);
      expect(Math.abs(p.root.sy - 1), c).toBeLessThanOrEqual(0.12);
    }
  });
});

describe("attack clips: wind-up, strike, overshoot, settle", () => {
  for (const [c, held] of ATTACKS) {
    it(`${c} with ${held}`, () => {
      const d = dress(held);
      const ts = times(rig, S, c);
      const tc = rig.clipInfo(S, c).events.find((e) => e.name === "contact")!.t;
      const tip = (t: number): [number, number] => ins.strikeEnd(rig.samplePose(S, c, t), d, HOME, c);
      const x0 = tip(0)[0];
      // wind-up: back (against +x) by 8 units or more, lasting 60 ms or more
      let wx = Infinity;
      let wt = 0;
      for (const t of ts) if (t < tc && tip(t)[0] < wx) { wx = tip(t)[0]; wt = t; }
      expect(x0 - wx, "wind-up distance").toBeGreaterThanOrEqual(8);
      expect(wt, "wind-up time").toBeGreaterThanOrEqual(60);
      // 60% of the travel up to the contact falls in its last 80 ms
      const fine = Array.from({ length: Math.round(tc) + 1 }, (_, i) => tip(i));
      let all = 0;
      let late = 0;
      for (let i = 1; i < fine.length; i++) {
        const s = Math.hypot(fine[i]![0] - fine[i - 1]![0], fine[i]![1] - fine[i - 1]![1]);
        all += s;
        if (i > tc - 80) late += s;
      }
      expect(late / all, "share of travel in the last 80 ms").toBeGreaterThanOrEqual(0.6);
      // overshoot: carries on past the contact pose, along the way it was going, by 10% or more
      // of the strike (wind-up point to contact), then settles
      const contact = tip(tc);
      const before = tip(tc - 4);
      const vl = Math.hypot(contact[0] - before[0], contact[1] - before[1]) || 1;
      const v = [(contact[0] - before[0]) / vl, (contact[1] - before[1]) / vl];
      const w = tip(wt);
      const reach = Math.hypot(contact[0] - w[0], contact[1] - w[1]);
      let past = 0;
      for (let t = tc; t <= tc + 100; t += 2) { const q = tip(t); past = Math.max(past, (q[0] - contact[0]) * v[0]! + (q[1] - contact[1]) * v[1]!); }
      expect(past / reach, "overshoot").toBeGreaterThanOrEqual(0.1);
      const end = tip(rig.clipInfo(S, c).durationMs);
      const settled = tip(tc + 150);
      expect(Math.hypot(settled[0] - end[0], settled[1] - end[1]), "settled within 150 ms").toBeLessThan(0.5);
      // the measured tip at contact is the strike point the stage uses
      const sp = rig.strikePoint(S, c, d);
      expect(Math.hypot(sp.x - contact[0], sp.y - contact[1])).toBeLessThan(1e-6);
    });
  }
  it("torso, head and free arm peak (fastest turn) 30 to 80 ms apart", () => {
    for (const [c] of ATTACKS) {
      const ts = Array.from({ length: 279 }, (_, i) => i + 1);
      const peak = (id: string): number => {
        const bi = boneIndex(rig, S, id);
        let best = 0;
        let bt = 0;
        for (const t of ts) {
          const v = Math.abs(rig.samplePose(S, c, t + 1).rot[bi]! - rig.samplePose(S, c, t - 1).rot[bi]!);
          if (v > best) { best = v; bt = t; }
        }
        return bt;
      };
      const [pt, ph, pa] = [peak("torso"), peak("head"), peak("armB.up")];
      for (const [a, b, n] of [[pt, ph, "torso-head"], [ph, pa, "head-arm"], [pt, pa, "torso-arm"]] as const) {
        expect(Math.abs(a - b), `${c} ${n} (${pt} ${ph} ${pa})`).toBeGreaterThanOrEqual(30);
        expect(Math.abs(a - b), `${c} ${n} (${pt} ${ph} ${pa})`).toBeLessThanOrEqual(80);
      }
    }
  });
});

describe("joints (owner amendment 13.2)", () => {
  it("no bone turns more than 45 degrees in one 60 fps frame", () => {
    for (const c of GATE_CLIPS) {
      const ps = poses(rig, S, c);
      for (let i = 1; i < ps.length; i++) ps[i]!.rot.forEach((v, b) => {
        expect(Math.abs(v - ps[i - 1]!.rot[b]!), `${c} ${bones[b]!.id} frame ${i}`).toBeLessThanOrEqual(45);
      });
    }
  });
  it("bends elbows and knees only the real way, in every frame of every clip", () => {
    for (const c of [...GATE_CLIPS]) for (const p of poses(rig, S, c)) for (const id of ONE_WAY_JOINTS) {
      const b = bones.findIndex((x) => x.id === id);
      const [lo, hi] = bones[b]!.limit!;
      expect(p.rot[b]!, `${c} ${id}`).toBeGreaterThanOrEqual(lo - 1e-6);
      expect(p.rot[b]!, `${c} ${id}`).toBeLessThanOrEqual(hi + 1e-6);
    }
  });
  it("keeps every bone with a limit inside it (wrists, ankles, head, torso), in every frame", () => {
    for (const c of GATE_CLIPS) for (const p of poses(rig, S, c)) bones.forEach((b, i) => {
      if (b.limit === undefined) return;
      expect(p.rot[i]!, `${c} ${b.id}`).toBeGreaterThanOrEqual(b.limit[0] - 1e-6);
      expect(p.rot[i]!, `${c} ${b.id}`).toBeLessThanOrEqual(b.limit[1] + 1e-6);
    });
  });
  it("has no dead bone: each turns 5 degrees or more somewhere; wrists, head and feet in 3 clips or more", () => {
    const moved = bones.map(() => 0);
    for (const c of GATE_CLIPS) {
      const ps = poses(rig, S, c);
      bones.forEach((_, b) => {
        const vals = ps.map((p) => p.rot[b]!);
        if (Math.max(...vals) - Math.min(...vals) >= 5) moved[b]! += 1;
      });
    }
    bones.forEach((b, i) => { if (b.id !== "root") expect(moved[i], b.id).toBeGreaterThanOrEqual(1); });
    for (const id of ["handF", "handB", "head", "footF", "footB"]) expect(moved[bones.findIndex((b) => b.id === id)], id).toBeGreaterThanOrEqual(3);
  });
  it("ko-fall ends lying on the floor, and lets go of the weapon", () => {
    const end = rig.samplePose(S, "ko-fall", 600);
    const j = ins.joints(end, dress("pipe"), HOME);
    const head = j[boneIndex(rig, S, "head")]!;
    expect(head[1]).toBeGreaterThan(-16);                         // the head is down at the floor
    expect(Math.abs(end.rot[boneIndex(rig, S, "held")]!)).toBeGreaterThan(30);   // the grip is open
    const land = rig.samplePose(S, "ko-fall", 450);
    expect(ins.lowest(land)).toBeCloseTo(0, 5);                   // body on the floor at the land
    const bounce = rig.samplePose(S, "ko-fall", 520);
    expect(bounce.lift).toBeGreaterThan(2);                        // one bounce
  });
});
