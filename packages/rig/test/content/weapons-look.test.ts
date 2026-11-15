/**
 * Weapons as the real object (review of 15 Nov 2026, items 18, 19, 24, 54, 55):
 *  - the stop sign's text is never drawn mirrored, whichever way its holder faces;
 *  - the ball-and-chain and the bike chain hang with gravity at rest and in the wind-up;
 *  - the anvil has a horn, a flat face and a lit (light) metal fill, and is big enough to read;
 *  - the knuckle dusters show on the fist and on the floor;
 *  - the frying pan and the wok drive level into the hit, not chopping down from overhead.
 */
import { describe, expect, it } from "vitest";
import type { HeldId } from "@rankzero/core";
import { WEAPON_META } from "@rankzero/core";
import type { Dress, Shape } from "../../src/contracts";
import { MAX_BEND, createRig, inspectOf } from "../../src/engine/createRig";
import { contentPack } from "../../src/content/pack";
import { USES } from "../../src/content/clips/use";
import { CONTENT_WEAPONS } from "../../src/content/weapons";
import { gatePack } from "../../src/gate/pack";
import { FIXED } from "../../src/gate/style";
import { bbox, parsePolys } from "../../src/gate/vocab";
import { LOOK } from "./use-audit";

const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
const S = "scrapper" as const;
const dress = (held: HeldId): Dress => ({ look: LOOK(0), held, shield: null, scale: 1 });
const det = (m: { a: number; b: number; c: number; d: number }): number => m.a * m.d - m.b * m.c;

describe("stop sign text", () => {
  const glyphs = CONTENT_WEAPONS["stop-sign"].shapes.find((s) => (s as Shape & { flip?: string }).flip !== undefined)
    ?? CONTENT_WEAPONS["stop-sign"].shapes.find((s) => s.slot === "white" && s.z === 3.2)!;
  const flip = (glyphs as { flip?: string }).flip;
  /** +1 when the letters are drawn as authored (not mirrored) on the stage, -1 when mirrored. */
  function reading(clip: string, t: number, facing: 1 | -1): number {
    const parts = ins.parts(rig.samplePose(S, clip, t), dress("stop-sign"), { x: 180, y: 200, facing });
    const p = parts.find((q) => q.d === glyphs.d || (flip !== undefined && q.d === flip));
    expect(p, `${clip} ${t} ${facing}`).toBeDefined();
    return Math.sign(det(p!.xf)) * (p!.d === glyphs.d ? 1 : -1);
  }
  it("reads the same (never mirrored) facing left as facing right, at rest and in the swing", () => {
    const own = WEAPON_META["stop-sign"].clip;
    for (const [clip, t] of [["idle", 0], ["idle", 400], [own, 0], [own, 120], ["hit-light", 60], ["win", 200]] as const) {
      expect(reading(clip, t, -1), `${clip} @${t}`).toBe(reading(clip, t, 1));
    }
  });
});

describe("chains hang with gravity", () => {
  const at = { x: 0, y: 0, facing: 1 as const };
  /** How far the striking end (the ball, the last link) is below the grip, stage units (+ = below). */
  const drop = (id: HeldId, clip: string, t: number): number => {
    const p = rig.samplePose(S, clip, t);
    return ins.strikeEnd(p, dress(id), at, clip)[1] - rig.handAnchor(p, dress(id), at).y;
  };
  for (const id of ["ball-and-chain", "bike-chain"] as const) {
    it(`${id}: hangs below the hand at rest, and does not stand up like a pole in the wind-up`, () => {
      for (const t of [0, 500, 3000]) expect(drop(id, "idle", t), `idle @${t}`).toBeGreaterThan(8);
      const own = rig.attackClip!(id, WEAPON_META[id].clip);
      for (const t of [0, 40]) expect(drop(id, own, t), `${own} @${t}`).toBeGreaterThan(-10);
    });
  }
});

describe("frying pan and wok: a level forehand drive", () => {
  const at = { x: 0, y: 0, facing: 1 as const };
  for (const id of ["frying-pan", "wok"] as const) {
    it(`${id}: plays the flat forehand, driving level into the hit instead of chopping down`, () => {
      expect(USES[id]?.swing).toBe("swing-flat");
      const clip = rig.attackClip!(id, "swing");
      expect(clip).toBe("swing-flat");
      const head = rig.hitPoint(S, dress(id), "head").y;
      const tipY = (t: number): number => ins.strikeEnd(rig.samplePose(S, clip, t), dress(id), at, clip)[1];
      // the take-back lifts the pan clear over the head (so it never crosses the face, see below);
      // the drive comes in level: over its last 26 ms the pan's head stays at head-to-chest height
      // and drops no more than a few units (an overhead chop drops about 30 onto the target)
      for (let t = 124; t <= 150; t += 2) expect(tipY(t), `${id} @${t}`).toBeGreaterThan(head - 10);
      expect(Math.abs(tipY(150) - tipY(124)), id).toBeLessThan(8);
    });
  }
});

describe("anvil and knuckle dusters read at stage size", () => {
  const fills = (id: HeldId) => CONTENT_WEAPONS[id as keyof typeof CONTENT_WEAPONS].shapes.filter((s) => s.slot !== "ink");
  const box = (id: HeldId): number[] => bbox(fills(id).flatMap((s) => parsePolys(s.d)));
  it("anvil: the body is lit steel (not the dark rubber slot), with a pale face, and about 25 units long with a horn", () => {
    const body = fills("anvil")[0]!;
    expect(body.slot).toBe("metal");
    expect(fills("anvil").some((s) => s.slot === "white")).toBe(true);
    const [x0, y0, x1, y1] = box("anvil") as [number, number, number, number];
    // across the item (the anvil's length, horn to heel) and along it (its height)
    expect(y1 - y0).toBeGreaterThan(24);
    expect(x1 - x0).toBeGreaterThan(16);
    // the horn: the outline reaches much further on one side of the waist than on the other
    const waist = 3.2;
    expect(Math.abs(y0 - waist)).toBeGreaterThan(1.4 * Math.abs(y1 - waist));
    expect(FIXED.metal).toBeDefined();
  });
  it("knuckle dusters: the plate stands well past the knuckles and is big enough to see on the floor", () => {
    const [x0, y0, x1, y1] = box("knuckle-dusters") as [number, number, number, number];
    expect(Math.max(x1 - x0, y1 - y0)).toBeGreaterThan(7.5);
    expect(Math.min(x1 - x0, y1 - y0)).toBeGreaterThan(4);
    // finger holes are drawn
    expect(CONTENT_WEAPONS["knuckle-dusters"].shapes.some((s) => s.slot === "ink" && parsePolys(s.d).length >= 4)).toBe(true);
  });
});

/* Verifier follow-up (15 Nov 2026): the chain hang folded links back on themselves and dropped the
 * ball on its holder's face, moved two contact points, and the flat pan swing crossed the face. */
const SWEEP = [["idle", 2400], ["hit-heavy", 400], ["hit-light", 300], ["win", 800], ["smash", 280]] as const;
const FLEX = ["ball-and-chain", "bike-chain", "rubber-chicken"] as const;
const ap = (m: { a: number; b: number; c: number; d: number; e: number; f: number }, x: number, y: number): [number, number] =>
  [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
const inside = (p: [number, number], poly: readonly (readonly number[])[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] as [number, number];
    const [xj, yj] = poly[j] as [number, number];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** Share of the holder's head (filled shapes) that an item part painted over it covers (only
 *  the shapes in `only`, when given). */
function headCover(id: HeldId, clip: string, t: number, only?: ReadonlySet<string>): number {
  const parts = ins.parts(rig.samplePose(S, clip, t), dress(id), { x: 0, y: 0, facing: 1 });
  const head = parts.filter((p) => p.tag === "head" && !p.ink);
  const hz = Math.max(...head.map((p) => p.z));
  const toPolys = (ps: typeof parts) => ps.flatMap((p) => parsePolys(p.d).map((poly) => poly.map(([x, y]) => ap(p.xf, x, y))));
  const item = toPolys(parts.filter((p) => String(p.tag).startsWith("item") && !p.ink && p.z > hz && (only === undefined || only.has(p.d))));
  const hp = toPolys(head);
  const [x0, y0, x1, y1] = bbox(hp) as [number, number, number, number];
  let n = 0;
  let cov = 0;
  for (let x = x0; x <= x1; x += 0.5) for (let y = y0; y <= y1; y += 0.5) {
    if (!hp.some((poly) => inside([x, y], poly))) continue;
    n++;
    if (item.some((poly) => inside([x, y], poly))) cov++;
  }
  return n === 0 ? 0 : cov / n;
}

describe("bending weapons: links never fold, never land on the face, contact unchanged", () => {
  for (const id of FLEX) {
    const own = rig.attackClip!(id, WEAPON_META[id].clip);
    const segs = CONTENT_WEAPONS[id].segments!;
    const sets = segs.map((s) => new Set(s.shapes.map((x) => x.d)));
    it(`${id}: no chain joint bends past ${MAX_BEND} degrees`, () => {
      for (const [clip, T] of [[own, 280], ...SWEEP] as const) for (let t = 0; t <= T; t += 10) {
        const parts = ins.parts(rig.samplePose(S, clip, t), dress(id), { x: 0, y: 0, facing: 1 });
        const used = new Set<unknown>();
        const ang = sets.map((set) => {
          const p = parts.find((q) => set.has(q.d) && !used.has(q.xf));
          if (p !== undefined) used.add(p.xf);
          return p === undefined ? NaN : Math.atan2(p.xf.b, p.xf.a) * 180 / Math.PI;
        });
        // joint 1 (where the chain leaves the fist) may drape further at rest; the rest may not
        for (let k = 2; k < ang.length; k++) {
          const bend = Math.abs(((ang[k]! - ang[k - 1]! + 540) % 360) - 180);
          expect(bend, `${clip} @${t} joint ${k}`).toBeLessThanOrEqual(MAX_BEND + 0.5);
        }
      }
    });
    // the links past the fist (link 0 is held rigid in the hand, as before the hang)
    const loose = new Set(segs.slice(1).flatMap((s) => s.shapes.map((x) => x.d)));
    it(`${id}: the loose links (the chain, the ball) never drop onto the holder's face`, () => {
      for (const [clip, T] of [[own, 280], ...SWEEP] as const) for (let t = 0; t <= T; t += 10) {
        expect(headCover(id, clip, t, loose), `${clip} @${t}`).toBeLessThan(0.05);
      }
    });
  }
  it("the strike points (and so where the stage stops the attacker) are what they were before the hang", () => {
    // measured on the base branch before item 18 (verifier's before.json)
    const want: Record<string, [number, number, number]> = {
      "bike-chain": [43.67, -86.16, 57.99], "ball-and-chain": [41.09, -74.39, 49.07], "rubber-chicken": [42.45, -69.53, 46.02],
    };
    for (const id of FLEX) {
      const clip = rig.attackClip!(id, WEAPON_META[id].clip);
      const sp = rig.strikePoint(S, clip, dress(id));
      const aimed = rig.strikePoint(S, clip, dress(id), -60);
      const [x, y, ax] = want[id]!;
      expect(sp.x, id).toBeCloseTo(x, 1);
      expect(sp.y, id).toBeCloseTo(y, 1);
      expect(aimed.x, `${id} aimed`).toBeCloseTo(ax, 1);
    }
  });
});

describe("frying pan and wok: the flat swing never crosses the holder's face", () => {
  for (const id of ["frying-pan", "wok"] as const) {
    it(`${id}: the wind-up takes the head behind, not over the face`, () => {
      // the guard (t0, t280) is the shared stance, where the pan sits at the cheek as on base
      for (let t = 10; t <= 270; t += 6) expect(headCover(id, "swing-flat", t), `@${t}`).toBeLessThan(0.1);
    });
  }
});
