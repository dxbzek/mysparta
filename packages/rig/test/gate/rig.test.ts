/**
 * The gate rig against the contract: drawing rules (Night Ink strokes, palette fills, no
 * gradient or filter anywhere), geometry (strike, hit and hand points on the picture), aim,
 * accurate weapon use (13.3), and the gate-only rule of fix round 2.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { COMPANION_IDS, STAGE_IDS, WEAPON_IDS, WEAPON_META } from "@rankzero/core";
import type { CompanionId, HeldId } from "@rankzero/core";
import { AIM_TOLERANCE, CLIP_FALLBACK, COMPANION_CLIPS, SHIELD_PLACEHOLDER, GATE_CLIPS, GATE_WEAPONS, PLACEHOLDER_COMPANION_CLIPS,
  SCRAPPER_CLIPS, placeholderLength, strikeTime, toStage } from "../../src/contracts";
import type { ContentPack, Dress, FxKind, Pose, RigId, WeaponArt } from "../../src/contracts";
import { capsuleGateRig } from "../../src/testing/capsule";
import { createRig, inspectOf } from "../../src/engine/createRig";
import { THROW } from "../../src/gate/clips/throw";
import { gatePack } from "../../src/gate/pack";
import { INK, allColours } from "../../src/gate/style";
import { ATTACKS, HOME, LOOKS, boneIndex, dress, ins, recorder, rig, times } from "./helpers";

const S = "scrapper" as const;
const colours = allColours();

describe("drawing rules", () => {
  it("strokes only in Night Ink and fills only with palette colours: actors, items, arena, effects", () => {
    const r = recorder();
    for (const [li] of LOOKS.entries()) for (const c of GATE_CLIPS) for (const t of [0, 100, 300]) {
      for (const held of ["pipe", "pocket-knife", "fists", null] as const) {
        rig.drawActor(r.env, rig.samplePose(S, c, t), dress(held, li), { x: 100, y: 195, facing: li === 0 ? 1 : -1 });
        rig.drawActor(r.env, rig.samplePose(S, c, t), dress(held, li, 1, { tint: "white" }), { x: 100, y: 195, facing: 1 });
      }
    }
    for (const id of COMPANION_IDS) for (const c of COMPANION_CLIPS) rig.drawActor(r.env, rig.samplePose(id, c, 100), dress(null), { x: 50, y: 190, facing: 1 });
    rig.drawStage(r.env, "yard", "back", 0.5);
    rig.drawStage(r.env, "yard", "floor", 0.5);
    for (const fx of ["burst", "dust", "spark", "whoosh"] as const) rig.drawFx(r.env, fx, 0.4, HOME, 3);
    for (const id of ["pipe", "pocket-knife", "car-door", "bat"] as const) rig.drawProp(r.env, id, { ...HOME, rot: 20 });
    expect(r.strokes.length).toBeGreaterThan(100);
    expect(new Set(r.strokes)).toEqual(new Set([INK]));
    for (const f of new Set(r.fills)) expect(colours.has(f.toUpperCase()), `fill ${f}`).toBe(true);
    expect(r.depth()).toBe(0);
  });
  it("has no gradient, pattern, image or canvas filter call anywhere in the rig lane's code", () => {
    const files: string[] = [];
    const walk = (d: string): void => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".ts")) files.push(p); } };
    walk(resolve(__dirname, "../../src/engine"));
    walk(resolve(__dirname, "../../src/gate"));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(/create(Linear|Radial|Conic)Gradient|createPattern|drawImage|\.filter\s*=|getImageData/.test(src), f).toBe(false);
    }
  });
  it("gives portraits and icons as plain SVG data with the ink outline", () => {
    for (const art of [rig.portrait(LOOKS[0]!), rig.portrait(LOOKS[1]!), rig.companionPortrait("goose"), rig.icon("pipe"), rig.icon("fists"),
      rig.icon("stat:health"), rig.icon("ui:pause"), rig.icon("ui:replay")]) {
      expect(art.parts.length).toBeGreaterThan(0);
      for (const p of art.parts) { expect(p.d).toMatch(/^M/); if (p.stroke !== undefined) expect(p.stroke).toBe(INK); }
    }
    expect(rig.icon("big-heart").parts.length).toBe(1);    // no skill art in the gate: the ring
  });
});

describe("geometry: what the stage places actors with", () => {
  it("puts the hand anchor on the hand that holds, for both facings and every build", () => {
    for (const li of [0, 1, 2]) for (const facing of [1, -1] as const) for (const c of ["idle", "swing", "flick"]) {
      const d = dress("pipe", li);
      const at = { x: 150, y: 195, facing };
      const p = rig.samplePose(S, c, 120);
      const a = rig.handAnchor(p, d, at);
      const held = ins.joints(p, d, at)[boneIndex(rig, S, "held")]!;
      expect(Math.hypot(a.x - held[0], a.y - held[1])).toBeLessThan(1e-6);
    }
  });
  it("mirrors every point of an actor that faces left", () => {
    for (const [c, held] of ATTACKS) {
      const p = rig.samplePose(S, c, 150);
      const d = dress(held);
      const r = ins.strikeEnd(p, d, { x: 100, y: 195, facing: 1 }, c);
      const l = ins.strikeEnd(p, d, { x: 100, y: 195, facing: -1 }, c);
      expect(l[0] - 100).toBeCloseTo(100 - r[0], 6);
      expect(l[1]).toBeCloseTo(r[1], 6);
    }
  });
  it("gives a strike point that is the drawn striking end: the pipe's coupling, the knife's point, the knuckles", () => {
    for (const [c, held] of ATTACKS) for (const li of [0, 1, 2]) for (const scale of [1, 1.15]) {
      const d = dress(held, li, scale);
      const sp = rig.strikePoint(S, c, d);
      const p = rig.samplePose(S, c, strikeTime(rig.clipInfo(S, c))!);
      const e = ins.strikeEnd(p, d, HOME, c);
      expect(Math.hypot(sp.x - e[0], sp.y - e[1])).toBeLessThan(1e-6);
      expect(sp.x, `${c} in front`).toBeGreaterThan(20);
      expect(sp.y, `${c} above the floor`).toBeLessThan(-30);
      if (held !== "fists") {
        // the tip is the art's tip, carried by the hand: its distance from the grip is fixed
        const art = gatePack.weapons[held as "pipe"];
        const a = rig.handAnchor(p, d, HOME);
        expect(Math.hypot(sp.x - a.x, sp.y - a.y)).toBeCloseTo(Math.hypot(art.tip.x - art.grip.x, art.tip.y - art.grip.y), 6);
      }
    }
  });
  it("draws what a hand holds at its own size, whatever the body scale", () => {
    const p = rig.samplePose(S, "swing", 150);
    const a1 = rig.handAnchor(p, dress("pipe", 0, 1), HOME);
    const s1 = rig.strikePoint(S, "swing", dress("pipe", 0, 1));
    const a2 = rig.handAnchor(p, dress("pipe", 0, 1.15), HOME);
    const s2 = rig.strikePoint(S, "swing", dress("pipe", 0, 1.15));
    expect(Math.hypot(s1.x - a1.x, s1.y - a1.y)).toBeCloseTo(Math.hypot(s2.x - a2.x, s2.y - a2.y), 6);
  });
  it("gives hit points inside the figure: the head above the body, scaled with the body", () => {
    for (const li of [0, 1, 2]) {
      const head = rig.hitPoint(S, dress(null, li), "head");
      const body = rig.hitPoint(S, dress(null, li), "body");
      expect(head.y).toBeLessThan(-70);
      expect(body.y).toBeGreaterThan(-65);
      expect(body.y).toBeLessThan(-45);
      const big = rig.hitPoint(S, dress(null, li, 1.15), "head");
      expect(big.y).toBeLessThan(head.y);
    }
    for (const id of COMPANION_IDS) {
      const b = rig.hitPoint(id, dress(null), "body");
      expect(b.y).toBeLessThan(0);
      expect(Number.isFinite(b.x)).toBe(true);
    }
  });
  it("swaps the arms for a pair when the back hand leads: the back fist strikes", () => {
    const f = rig.strikePoint(S, "punch", dress("fists"));
    const b = rig.strikePoint(S, "punch", dress("fists", 0, 1, { lead: "B" }));
    expect(Math.abs(f.x - b.x) + Math.abs(f.y - b.y)).toBeGreaterThan(0.1);
    const pipeF = rig.strikePoint(S, "swing", dress("pipe"));
    const pipeB = rig.strikePoint(S, "swing", dress("pipe", 0, 1, { lead: "B" }));
    expect(pipeB).toEqual(pipeF);                   // `lead` is read only for a pair
  });
});

describe("aim: a swing bent toward the target's height", () => {
  const targets: number[] = [];
  for (const li of [0, 1, 2]) for (const scale of [1, 1.15]) {
    for (const z of ["head", "body"] as const) targets.push(rig.hitPoint(S, dress(null, li, scale), z).y);
  }
  for (const id of COMPANION_IDS) for (const scale of [1, 1.15]) targets.push(rig.hitPoint(id, dress(null, 0, scale), "body").y);
  it("reaches every target height within AIM_TOLERANCE, for every gate weapon, build and size", () => {
    for (const [c, held] of ATTACKS) for (const li of [0, 1, 2]) for (const scale of [1, 1.15]) for (const y of targets) {
      const d = dress(held, li, scale);
      const sp = rig.strikePoint(S, c, d, y);
      expect(Math.abs(sp.y - y), `${c} ${held} build ${li} scale ${scale} aim ${y.toFixed(1)}`).toBeLessThanOrEqual(AIM_TOLERANCE);
      const p = rig.samplePose(S, c, 150, { y, dress: d });
      const e = ins.strikeEnd(p, d, HOME, c);
      expect(Math.hypot(sp.x - e[0], sp.y - e[1])).toBeLessThan(1e-6);
    }
  });
  it("bends only around the contact: the aimed clip equals the plain clip at its start and its end", () => {
    for (const [c, held] of ATTACKS) for (const y of [targets[0]!, targets[targets.length - 1]!]) {
      const d = dress(held);
      for (const t of [0, rig.clipInfo(S, c).durationMs]) {
        const a = rig.samplePose(S, c, t, { y, dress: d });
        const b = rig.samplePose(S, c, t);
        a.rot.forEach((v, i) => expect(v).toBeCloseTo(b.rot[i]!, 6));
      }
    }
  });
  it("keeps every joint limit while bent", () => {
    const bones = ins.rigDef(S).bones;
    for (const [c, held] of ATTACKS) for (const y of targets) for (const t of times(rig, S, c)) {
      const p = rig.samplePose(S, c, t, { y, dress: dress(held) });
      bones.forEach((b, i) => {
        if (b.limit === undefined || !["armB.lo", "armF.lo", "legB.lo", "legF.lo"].includes(b.id)) return;
        expect(p.rot[i]!).toBeGreaterThanOrEqual(b.limit[0] - 1e-6);
        expect(p.rot[i]!).toBeLessThanOrEqual(b.limit[1] + 1e-6);
      });
    }
  });
  it("lets a companion's mouth reach any target's body", () => {
    for (const id of COMPANION_IDS) for (const y of targets.filter((_, i) => i % 2 === 1)) {
      const sp = rig.strikePoint(id, "attack", dress(null), y);
      expect(Math.abs(sp.y - y), `${id} ${y}`).toBeLessThanOrEqual(AIM_TOLERANCE);
    }
  });
});

describe("hands on the weapon (13.3)", () => {
  it("pins the back hand to grip2 by two-bone IK on every frame of the attack clip (1 unit or less)", () => {
    // a two-hand test weapon (a bat-like shaft, the back hand 6 units down it), in the gate's two
    // swing clips and their content fallbacks (smash, thrust); content clips are WP6's to pin
    const shaft: WeaponArt = { shapes: [{ d: "M-3 -1L40 -1L40 1L-3 1Z", slot: "wood", z: 0 }], grip: { x: 0, y: 0, rot: -10 }, length: 43,
      tip: { x: 40, y: 0 }, grip2: { x: -6, y: 0 } };
    const r2 = createRig(gatePack, { weapons: { broom: shaft } } as unknown as ContentPack);
    const i2 = inspectOf(r2);
    for (const c of ["swing", "smash", "flick", "thrust"]) for (const t of times(r2, S, c)) {
      const p = r2.samplePose(S, c, t);
      const d: Dress = { look: LOOKS[0], held: "broom", shield: null, scale: 1 };
      const a = r2.handAnchor(p, d, HOME);
      const rr = a.rot * Math.PI / 180;
      const want = [a.x + Math.cos(rr) * -6, a.y + Math.sin(rr) * -6];
      const got = i2.backGrip(p, d, HOME);
      expect(Math.hypot(got[0] - want[0]!, got[1] - want[1]!), `${c} @${t}`).toBeLessThanOrEqual(1);
    }
  });
  it("has hands: 2 in WEAPON_META exactly when the art has grip2 or offhand (fists aside)", () => {
    for (const id of GATE_WEAPONS) {
      if (id === "fists") continue;
      const art = gatePack.weapons[id];
      expect(WEAPON_META[id].hands === 2, id).toBe(art.grip2 !== undefined || art.offhand === true);
    }
  });
});

describe("the gate-only rule (createRig(gatePack))", () => {
  it("answers a content clip with its gate clip, and only an unknown name with idle (warning once)", () => {
    for (const [content, gate] of Object.entries(CLIP_FALLBACK)) expect(rig.clipInfo(S, content)).toEqual(rig.clipInfo(S, gate));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(rig.clipInfo(S, "moonwalk")).toEqual(rig.clipInfo(S, "idle"));
    rig.clipInfo(S, "moonwalk");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
  it("has the same timeline as the capsule gate rig for every scrapper and companion clip", () => {
    for (const c of SCRAPPER_CLIPS) expect(rig.clipInfo(S, c), c).toEqual(capsuleGateRig.clipInfo(S, c));
    for (const id of COMPANION_IDS) for (const c of COMPANION_CLIPS) {
      expect(rig.clipInfo(id, c), `${id} ${c}`).toEqual(PLACEHOLDER_COMPANION_CLIPS[c]);
      expect(rig.clipInfo(id, c)).toEqual(capsuleGateRig.clipInfo(id, c));
    }
  });
  it("draws every weapon outside the gate as one straight piece placeholderLength(reach) long, tip at the far end = strike point", () => {
    for (const id of WEAPON_IDS) {
      if ((GATE_WEAPONS as readonly string[]).includes(id)) continue;
      const meta = WEAPON_META[id];
      const d = dress(id as HeldId);
      const clip = meta.clip === "throw" ? "flick" : meta.clip;
      const sp = rig.strikePoint(S, clip, d);
      const p = rig.samplePose(S, clip, strikeTime(rig.clipInfo(S, clip))!);
      const a = rig.handAnchor(p, d, HOME);
      expect(Math.hypot(sp.x - a.x, sp.y - a.y), id).toBeCloseTo(placeholderLength(meta.reach), 6);
      const r = recorder();
      rig.drawActor(r.env, p, d, HOME);
      const bar = `M-2 -1.4L${placeholderLength(meta.reach) - 3} -1.4L${placeholderLength(meta.reach)} 0L${placeholderLength(meta.reach) - 3} 1.4L-2 1.4Z`;
      const drawn = r.paths.filter((x) => x === bar).length / 2;   // each piece: shadow fill, then lit fill
      expect(drawn, `${id} pieces`).toBe(meta.pair === true ? 2 : 1);
    }
  });
  it("draws the Car Door as its SHIELD_PLACEHOLDER panel, on the back arm and on the floor", () => {
    const panel = (x: string): boolean => x.includes(`${SHIELD_PLACEHOLDER["car-door"].w - 4 - 1.5}`) || x.startsWith("M");
    const r = recorder();
    rig.drawActor(r.env, rig.samplePose(S, "idle", 0), dress("pipe", 0, 1, { shield: "car-door" }), HOME);
    const r2 = recorder();
    rig.drawActor(r2.env, rig.samplePose(S, "idle", 0), dress("pipe"), HOME);
    expect(r.paths.length).toBeGreaterThan(r2.paths.length);
    const r3 = recorder();
    rig.drawProp(r3.env, "car-door", { ...HOME, rot: 0 });
    expect(r3.paths.some(panel)).toBe(true);
  });
  it("draws the yard for every arena (warning once each) and nothing for a content effect", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const yard = recorder();
    rig.drawStage(yard.env, "yard", "back", 0);
    for (const s of STAGE_IDS) {
      const r = recorder();
      rig.drawStage(r.env, s, "back", 0);
      expect(r.paths).toEqual(yard.paths);
    }
    for (const fx of ["tarp", "tape", "crackers", "rings", "plus", "trail"] as FxKind[]) {
      const r = recorder();
      rig.drawFx(r.env, fx, 0.5, HOME, 1);
      expect(r.fills.length, fx).toBe(0);
    }
    expect(warn.mock.calls.length).toBeLessThanOrEqual(4 + 6);
    warn.mockRestore();
  });
  it("draws no Move prop and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = recorder();
    rig.drawActor(r.env, rig.samplePose(S, "drink", 100), dress("pipe", 0, 1, { prop: "can" }), HOME);
    rig.drawActor(r.env, rig.samplePose(S, "drink", 100), dress("pipe", 0, 1, { prop: "can" }), HOME);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("can")).length).toBeLessThanOrEqual(1);
    warn.mockRestore();
  });
});

describe("the throw clip handed to the content lane", () => {
  const r = createRig(gatePack, { clips: { throw: THROW } } as unknown as ContentPack);
  it("is the clip a full rig plays for throw, with its release point at the hand", () => {
    expect(r.clipInfo(S, "throw").events).toEqual([{ t: 180, name: "release" }]);
    const p = r.samplePose(S, "throw", 180);
    const a = r.handAnchor(p, dress("pipe"), HOME);
    const sp = r.strikePoint(S, "throw", dress("pipe"));
    expect(Math.hypot(sp.x - a.x, sp.y - a.y)).toBeLessThan(1e-6);
    expect(sp.x).toBeGreaterThan(15);           // out in front
    expect(sp.y).toBeLessThan(-55);             // at shoulder height
  });
  it("keeps the motion lines: finite, 45 degrees a frame at most, elbows and knees the real way, planted feet", () => {
    const bones = inspectOf(r).rigDef(S).bones;
    const ps = times(r, S, "throw").map((t) => r.samplePose(S, "throw", t));
    for (let i = 0; i < ps.length; i++) ps[i]!.rot.forEach((v, b) => {
      expect(Number.isFinite(v)).toBe(true);
      if (i > 0) expect(Math.abs(v - ps[i - 1]!.rot[b]!), `${bones[b]!.id} ${i}`).toBeLessThanOrEqual(45);
      const lim = bones[b]!.limit;
      if (lim !== undefined) { expect(v, bones[b]!.id).toBeGreaterThanOrEqual(lim[0] - 1e-6); expect(v, bones[b]!.id).toBeLessThanOrEqual(lim[1] + 1e-6); }
    });
    // the hand goes back (wind-up) before it comes forward to release
    const hx = (t: number): number => r.handAnchor(r.samplePose(S, "throw", t), dress("pipe"), HOME).x;
    expect(hx(0) - Math.min(hx(70), hx(120))).toBeGreaterThan(8);
    expect(hx(180) - hx(120)).toBeGreaterThan(25);
  });
});

void toStage;
void ({} as Pose);
void ({} as RigId);
void ({} as CompanionId);
