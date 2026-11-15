/**
 * Weapon use and pets in motion (animation pass, 16 Nov 2026; owner, after playing: "The pets
 * only have limited animations. Lots of unrealistic arms or usage of weapons").
 *
 *  - every content clip and every per-weapon variant keeps the timing table (a variant its base
 *    clip's length and events), and each weapon plays the clip its `use` line asks for;
 *  - every new clip, for every weapon that plays it, plain and aimed at a head and a body, keeps
 *    the WP2 anatomy limits (`ANATOMY`) as drawn (the two-hand solve included);
 *  - a two-hand weapon has its back hand on `grip2` (1 unit) with the back arm at most
 *    ANATOMY.reach of its length, in every frame of every clip it can play, every build, both
 *    sizes, plain and aimed;
 *  - each weapon's strike point at the contact is its drawn striking end (the tip);
 *  - every pet clip keeps its joint limits, stands on the floor (it leaves it only in a keyed
 *    leap or hop), turns no bone more than 45 degrees a frame, and in a run the legs take turns.
 *
 * Each line has a planted fault that must turn it red.
 */
import { describe, expect, it } from "vitest";
import type { HeldId } from "@rankzero/core";
import { COMPANION_IDS, WEAPON_META } from "@rankzero/core";
import type { Clip, ContentClip, Pose } from "../../src/contracts";
import { COMPANION_CLIPS, PLACEHOLDER_COMPANION_CLIPS, strikeTime } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import { contentPack } from "../../src/content/pack";
import { CONTENT_CLIPS } from "../../src/content/clips";
import { VARIANTS, VARIANT_BASE } from "../../src/content/clips/use";
import { gatePack } from "../../src/gate/pack";
import { ANATOMY, BONE } from "../../src/gate/skeleton";
import type { Report } from "../gate/anatomy";
import { measure, report } from "../gate/anatomy";
import { ALL_HELD, HELD_CLIPS, HOME, LOOK, attackClips, measureClip, twoHand } from "./use-audit";

const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
const S = "scrapper" as const;

/** The timing table (brief 3.12) for the content clips the stage times beats with. */
const TABLE: Record<string, { d: number; ev: [string, number][] }> = {
  smash: { d: 380, ev: [["contact", 240]] }, thrust: { d: 280, ev: [["contact", 150]] }, throw: { d: 260, ev: [["release", 180]] },
  "hit-heavy": { d: 300, ev: [] }, block: { d: 220, ev: [] }, "block-shield": { d: 220, ev: [] },
  swing: { d: 280, ev: [["contact", 150]] }, flick: { d: 280, ev: [["contact", 150]] }, punch: { d: 280, ev: [["contact", 150]] },
};
const NEW = ["smash", "thrust", "thrust-1h", "swing-2h", "swing-low", "throw-side", "throw-roll", "throw-flick", "throw-heave", "hit-heavy", "block", "block-shield"];

describe("timing: the new clips keep the timing table", () => {
  it("draws every content clip (no gate stand-in is left)", () => {
    expect(Object.keys(CONTENT_CLIPS).sort()).toEqual(["block", "block-shield", "drink", "hit-heavy", "power-up", "slam", "slammed", "smash", "snared", "throw", "thrust"]);
  });
  it.each(Object.keys(TABLE).filter((c) => c in CONTENT_CLIPS))("%s has its table length and events", (c) => {
    const info = rig.clipInfo(S, c);
    expect(info.durationMs).toBe(TABLE[c]!.d);
    expect(info.events.map((e) => [e.name, e.t])).toEqual(TABLE[c]!.ev);
  });
  it.each(Object.keys(VARIANTS))("variant %s has its base clip's length and events", (v) => {
    const base = rig.clipInfo(S, VARIANT_BASE[v]!);
    expect(VARIANTS[v]!.duration).toBe(base.durationMs);
    expect(VARIANTS[v]!.events).toEqual(base.events);
  });
  it("each weapon plays the clip of its use line", () => {
    const want: Partial<Record<HeldId, [string, string]>> = {
      bat: ["swing", "swing-2h"], "cricket-bat": ["swing", "swing-2h"], rebar: ["swing", "swing-2h"], "golf-club": ["swing", "swing-low"],
      "hockey-stick": ["swing", "swing-low"], plunger: ["thrust", "thrust-1h"], umbrella: ["flick", "thrust-1h"], "garden-shears": ["flick", "thrust-1h"],
      darts: ["throw", "throw-flick"], boomerang: ["throw", "throw-side"], hubcap: ["throw", "throw-side"], tyre: ["throw", "throw-roll"],
      sledgehammer: ["throw", "throw-heave"], pipe: ["swing", "swing"], bricks: ["throw", "throw"], broom: ["thrust", "thrust"], anvil: ["smash", "smash"],
    };
    for (const [id, [base, v]] of Object.entries(want) as [HeldId, [string, string]][]) {
      expect(rig.attackClip!(id, base), id).toBe(v);
      expect(ins.clip(S, base, id), id).toBe(VARIANTS[v] ?? (CONTENT_CLIPS as Record<string, Clip>)[v] ?? ins.clip(S, v));
    }
    // a two-hand weapon thrown away goes with both hands; a one-hand one overarm
    for (const id of ALL_HELD) if (id !== "fists" && WEAPON_META[id].clip !== "throw" && twoHand(rig, id)) expect(rig.attackClip!(id, "throw"), id).toBe("throw-heave");
    expect(rig.attackClip!("pipe", "throw")).toBe("throw");
  });
});

// ------------------------------------------------------------------------------ anatomy
interface Run { name: string; aimed: boolean; rep: Report }
function runs(id: HeldId, base: string): Run[] {
  const dress = { look: LOOK(0), held: id, shield: null, scale: 1 };
  const target = { look: LOOK(0), held: null, shield: null, scale: 1 };
  const info = rig.clipInfo(S, base);
  const contact = info.events.some((e) => e.name === "contact");
  const aims = contact ? [{ y: 0, dress, plain: true }, ...(["head", "body"] as const).map((z) => ({ y: rig.hitPoint(S, target, z).y, dress, plain: false }))]
    : [{ y: 0, dress, plain: true }];
  const n = Math.max(1, Math.round((info.durationMs * 60) / 1000));
  return aims.map((a) => {
    const ps: Pose[] = Array.from({ length: n + 1 }, (_, i) => {
      const t = (i * info.durationMs) / n;
      // a plain run with a contact samples the weapon's own clip without an aim
      return a.plain && contact ? rig.samplePose(S, rig.attackClip!(id, base), t) : rig.samplePose(S, base, t, a);
    });
    return { name: `${rig.attackClip!(id, base)} / ${id}${a.plain ? "" : ` aimed at ${a.y.toFixed(0)}`}`, aimed: !a.plain,
      rep: report(ps.map((p) => measure({ ...p, rot: ins.figureRot(p, dress) }))) };
  });
}
function newRuns(): Run[] {
  const out: Run[] = [];
  for (const id of ALL_HELD) for (const base of [...attackClips(id), "hit-heavy", "block", "block-shield"]) {
    if (!NEW.includes(rig.attackClip!(id, base))) continue;
    out.push(...runs(id, base));
  }
  return out;
}
const RUNS = newRuns();
function check(r: Run): string[] {
  const bad: string[] = [];
  const x = r.rep;
  if (x.wrongBend > 0 || x.bendFlips > 0) bad.push(`elbow or knee the wrong way (${x.wrongBend}, flips ${x.bendFlips})`);
  if (x.armOverReach > 0) bad.push(`arm pulled straight (${x.armReachMax.toFixed(2)})`);
  if (x.wristOut > 0) bad.push(`wrist ${x.wristWorst.toFixed(0)}`);
  if (x.shoulderOut > 0) bad.push(`shoulder ${x.shoulderWorst.toFixed(0)}`);
  const limit = ANATOMY.turnPerFrame + (r.aimed ? ANATOMY.aimTurn : 0);
  if (x.foreTurnMax > limit || x.handTurnMax > limit) bad.push(`turn ${x.foreTurnMax.toFixed(0)}/${x.handTurnMax.toFixed(0)}`);
  if (x.throughTrunk > 0) bad.push(`forearm in the trunk (${x.throughTrunk})`);
  return bad;
}

describe("anatomy: every new clip, for every weapon that plays it, as drawn", () => {
  it("covers every new clip", () => {
    const seen = new Set(RUNS.map((r) => r.name.split(" / ")[0]));
    for (const c of NEW) expect(seen.has(c), c).toBe(true);
    expect(RUNS.length).toBeGreaterThan(150);
  });
  it("keeps elbows, knees, reach, wrists, shoulders, turn rates and the trunk in a real body's range", () => {
    const bad = RUNS.flatMap((r) => check(r).map((b) => `${r.name}: ${b}`));
    expect(bad).toEqual([]);
  });
  it("planted fault: a wrist bent back, a straight arm and a spinning forearm are caught", () => {
    const r = RUNS.find((q) => q.name === "thrust / broom")!;
    expect(check(r)).toEqual([]);
    expect(check({ ...r, rep: { ...r.rep, wristOut: 1, wristWorst: 120 } }).length).toBe(1);
    const p = rig.samplePose(S, "smash", 240);
    const rot = ins.figureRot(p, { look: LOOK(0), held: "sledgehammer", shield: null, scale: 1 });
    rot[BONE.armFlo] = 0;
    expect(report([measure({ ...p, rot })]).armOverReach).toBe(1);
    const f = measure({ ...p, rot: ins.figureRot(p, { look: LOOK(0), held: "sledgehammer", shield: null, scale: 1 }) });
    expect(report([f, { ...f, foreW: { ...f.foreW, F: f.foreW.F + 40 } }]).fastTurns).toBe(1);
  });
});

// --------------------------------------------------------------------- two hands on the shaft
describe("two hands on one shaft, in every clip a two-hand weapon can play", () => {
  const rows = ALL_HELD.filter((id) => twoHand(rig, id)).flatMap((id) => [...attackClips(id), ...HELD_CLIPS].map((c) => measureClip(rig, id, c)));
  it("measures every two-hand weapon in every clip", () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(18);
    expect(rows.length).toBe(18 * HELD_CLIPS.length + 17 * 2 + 1);
  });
  it(`pins the back hand within 1 unit of grip2 and keeps the back arm within ${ANATOMY.reach} of its length`, () => {
    const bad = rows.filter((r) => r.pinErr > 1 || r.reach > ANATOMY.reach + 1e-3).map((r) => `${r.id} ${r.clip}: reach ${r.reach.toFixed(3)} (${r.reachAt}) pin ${r.pinErr.toFixed(2)}`);
    expect(bad).toEqual([]);
  });
  it("keeps both hands on the item in the guard, the draw and the item's own attack (no let-go)", () => {
    const must = (r: (typeof rows)[number]): boolean => ["idle", "brace", "draw"].includes(r.clip) || (r.clip === WEAPON_META[r.id].clip && r.clip !== "throw");
    expect(rows.filter((r) => must(r) && r.letGo > 0).map((r) => `${r.id} ${r.clip}: ${r.letGo}/${r.frames}`)).toEqual([]);
  });
  it("planted fault: a grip2 out of reach is caught", () => {
    const far = { ...contentPack, weapons: { ...contentPack.weapons, broom: { ...contentPack.weapons.broom, grip2: { x: -60, y: 0 } } } };
    const r = measureClip(createRig(gatePack, far), "broom", "idle");
    // out of reach, the back hand lets go (it never stretches or dislocates to hold): caught as a let-go
    expect(r.pinErr > 1 || r.reach > ANATOMY.reach + 1e-3 || r.letGo > 0).toBe(true);
  });
});

// ------------------------------------------------------------------------------ strike point
describe("the striking end is the weapon's drawn tip at the contact", () => {
  function err(r: typeof rig, id: HeldId): number {
    const i2 = inspectOf(r);
    const d = { look: LOOK(0), held: id, shield: null, scale: 1 };
    const base = WEAPON_META[id].clip;
    const info = r.clipInfo(S, base);
    const tc = strikeTime(info)!;
    const sp = r.strikePoint(S, base, d);
    const art = id === "fists" ? null : (contentPack.weapons as Record<string, typeof contentPack.weapons.broom>)[id] ?? null;
    const p = r.samplePose(S, r.attackClip!(id, base), tc);
    if (art === null || art.segments !== undefined || base === "throw") return Math.hypot(sp.x - i2.strikeEnd(p, d, HOME, base)[0], sp.y - i2.strikeEnd(p, d, HOME, base)[1]);
    // the tip of the drawn item: the grip anchor plus the tip offset turned with the item
    const a = r.handAnchor(p, d, HOME);
    const rad = (a.rot * Math.PI) / 180;
    const dx = art.tip.x - art.grip.x;
    const dy = art.tip.y - art.grip.y;
    return Math.hypot(sp.x - (a.x + dx * Math.cos(rad) - dy * Math.sin(rad)), sp.y - (a.y + dx * Math.sin(rad) + dy * Math.cos(rad)));
  }
  it("for every held item, on the clip it really plays", () => {
    for (const id of ALL_HELD) if (WEAPON_META[id].pair !== true) expect(err(rig, id), id).toBeLessThan(1e-6);
  });
  it("planted fault: a tip moved 20 units is caught", () => {
    const moved = { ...contentPack, weapons: { ...contentPack.weapons, broom: { ...contentPack.weapons.broom, tip: { x: 30.6, y: 0 } } } };
    // the drawn tip stays where the art is; the strike point moves with the tip, so measure
    // against the art's real tip
    const r = createRig(gatePack, moved);
    const d = { look: LOOK(0), held: "broom" as const, shield: null, scale: 1 };
    const p = r.samplePose(S, "thrust", 150);
    const a = r.handAnchor(p, d, HOME);
    const rad = (a.rot * Math.PI) / 180;
    const sp = r.strikePoint(S, "thrust", d);
    const real = contentPack.weapons.broom.tip;
    expect(Math.hypot(sp.x - (a.x + real.x * Math.cos(rad) - real.y * Math.sin(rad)), sp.y - (a.y + real.x * Math.sin(rad) + real.y * Math.cos(rad)))).toBeGreaterThan(15);
  });
});

// ------------------------------------------------------------------------------------ pets
describe("pets in motion", () => {
  const times = (id: (typeof COMPANION_IDS)[number], c: string): number[] => {
    const d = rig.clipInfo(id, c).durationMs;
    const n = Math.round((d * 60) / 1000);
    return Array.from({ length: n + 1 }, (_, i) => (i * d) / n);
  };
  it("every pet has all six clips drawn, on the placeholder timeline", () => {
    for (const id of COMPANION_IDS) for (const c of COMPANION_CLIPS) {
      const clip = ins.clip(id, c);
      expect(clip.keys.length, `${id} ${c}`).toBeGreaterThan(c === "idle" ? 2 : 4);
      expect(clip.duration, `${id} ${c}`).toBe(PLACEHOLDER_COMPANION_CLIPS[c].durationMs);
      expect(clip.events, `${id} ${c}`).toEqual(PLACEHOLDER_COMPANION_CLIPS[c].events);
    }
  });
  function limitsAndTurns(id: (typeof COMPANION_IDS)[number], c: string, clipOverride?: Clip): string[] {
    const bad: string[] = [];
    const def = ins.rigDef(id);
    let prev: readonly number[] | null = null;
    for (const t of times(id, c)) {
      const p = clipOverride === undefined ? rig.samplePose(id, c, t) : poseOf(id, clipOverride, t);
      def.bones.forEach((b, i) => {
        if (b.limit !== undefined && (p.rot[i]! < b.limit[0] - 1e-6 || p.rot[i]! > b.limit[1] + 1e-6)) bad.push(`${b.id} ${p.rot[i]!.toFixed(0)} @${Math.round(t)}`);
        if (prev !== null && Math.abs(p.rot[i]! - prev[i]!) > 45) bad.push(`${b.id} turns ${Math.abs(p.rot[i]! - prev[i]!).toFixed(0)} @${Math.round(t)}`);
      });
      prev = p.rot;
    }
    return bad;
  }
  const poseOf = (id: (typeof COMPANION_IDS)[number], c: Clip, t: number): Pose => {
    const r2 = createRig(gatePack, { ...contentPack, companions: { ...contentPack.companions, [id]: { ...contentPack.companions[id], clips: { ...contentPack.companions[id].clips, attack: c } } } });
    return r2.samplePose(id, "attack", t);
  };
  it("keep every joint inside its limit and turn no bone more than 45 degrees a frame", () => {
    const bad = COMPANION_IDS.flatMap((id) => COMPANION_CLIPS.flatMap((c) => limitsAndTurns(id, c).map((b) => `${id} ${c}: ${b}`)));
    expect(bad).toEqual([]);
  });
  it("planted fault: a knee bent past its limit is caught", () => {
    const a = ins.clip("stray-dog", "attack");
    const broken: Clip = { ...a, keys: a.keys.map((k, i) => (i === 3 ? { ...k, rot: { ...k.rot, "hindF.lo": 170 } } : k)) };
    expect(limitsAndTurns("stray-dog", "attack", broken).length).toBeGreaterThan(0);
  });
  it("stand on the floor: the lowest point is on it unless a key lifts the animal (a leap, a hop, a flight)", () => {
    for (const id of COMPANION_IDS) for (const c of COMPANION_CLIPS) {
      const clip = ins.clip(id, c);
      for (const t of times(id, c)) {
        const p = rig.samplePose(id, c, t);
        const keyed = clip.keys.some((k) => (k.root?.[1] ?? 0) < 0);
        if (!keyed) expect(Math.abs(ins.lowest(p)), `${id} ${c} @${Math.round(t)}`).toBeLessThan(0.01);
        else expect(ins.lowest(p) + p.lift, `${id} ${c} @${Math.round(t)}`).toBeLessThan(0.01);
        expect(p.lift, `${id} ${c} @${Math.round(t)} no higher than a leap`).toBeLessThan(14);
      }
    }
  });
  it("run and flee: the legs take turns (a quadruped's diagonal or lateral legs, a goose's two feet), and the run cycles", () => {
    for (const id of COMPANION_IDS) for (const c of ["run", "flee"]) {
      const def = ins.rigDef(id);
      const ups = def.bones.map((b, i) => [b.id, i] as const).filter(([b]) => /\.up$/.test(b));
      const series = ups.map(([, i]) => times(id, c).map((t) => rig.samplePose(id, c, t).rot[i]!));
      const range = series.map((s) => Math.max(...s) - Math.min(...s));
      if (id === "crow") {
        // the crow hops with both feet together: its legs tuck in step, and it leaves the floor
        expect(Math.max(...times(id, c).map((t) => rig.samplePose(id, c, t).lift)), `${id} ${c}`).toBeGreaterThan(2);
        continue;
      }
      for (const r of range) expect(r, `${id} ${c} every leg swings`).toBeGreaterThan(20);
      // two legs of the same pair (B and F) are out of phase: correlation below 0
      for (const pair of ["hind", "fore", "leg"]) {
        const b = ups.findIndex(([n]) => n === `${pair}B.up`);
        const f = ups.findIndex(([n]) => n === `${pair}F.up`);
        if (b < 0 || f < 0) continue;
        const sb = series[b]!;
        const sf = series[f]!;
        const mb = sb.reduce((a, x) => a + x, 0) / sb.length;
        const mf = sf.reduce((a, x) => a + x, 0) / sf.length;
        const cov = sb.reduce((a, x, k) => a + (x - mb) * (sf[k]! - mf), 0);
        if (pair === "leg" || id === "raccoon") expect(cov, `${id} ${c} ${pair} legs alternate`).toBeLessThan(0);
      }
      const first = rig.samplePose(id, c, 0).rot;
      const last = rig.samplePose(id, c, rig.clipInfo(id, c).durationMs - 0.001).rot;
      first.forEach((v, i) => expect(Math.abs(v - last[i]!), `${id} ${c} loops`).toBeLessThan(6));
    }
  });
  it("attack: the mouth, beak or tusk is driven forward into the contact, ahead of the body", () => {
    for (const id of COMPANION_IDS) {
      const d = { held: null, shield: null, scale: 1 };
      const hit = rig.strikePoint(id, "attack", d);
      const before = ins.strikeEnd(rig.samplePose(id, "attack", 150 - 50), d, HOME, "attack");
      expect(hit.x, `${id} moves the mouth forward into the contact`).toBeGreaterThan(before[0] + 0.5);
      expect(hit.x, `${id} strikes ahead of its body`).toBeGreaterThan(rig.hitPoint(id, d, "body").x);
    }
  });
  it("tails and wings follow through (they lag their body)", () => {
    for (const id of COMPANION_IDS) {
      const lag = ins.clip(id, "run").lag ?? {};
      expect(Object.keys(lag).some((k) => k.startsWith("tail") || k.startsWith("wing")), id).toBe(true);
    }
  });
});
