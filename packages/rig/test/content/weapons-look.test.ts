/**
 * Weapons as the real object (review of 15 Nov 2026, items 18, 19, 24, 54, 55):
 *  - the stop sign's text is never drawn mirrored, whichever way its holder faces;
 *  - the ball-and-chain and the bike chain hang with gravity at rest and in the wind-up;
 *  - the anvil has a horn, a flat face and a lit (light) metal fill, and is big enough to read;
 *  - the knuckle dusters show on the fist and on the floor;
 *  - the frying pan and the wok swing flat from the side, not overhead.
 */
import { describe, expect, it } from "vitest";
import type { HeldId } from "@rankzero/core";
import { WEAPON_META } from "@rankzero/core";
import type { Dress, Shape } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
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

describe("frying pan and wok: a flat side swing", () => {
  const at = { x: 0, y: 0, facing: 1 as const };
  for (const id of ["frying-pan", "wok"] as const) {
    it(`${id}: plays the flat forehand, its head never rises over the head on the way to the hit`, () => {
      expect(USES[id]?.swing).toBe("swing-flat");
      const clip = rig.attackClip!(id, "swing");
      expect(clip).toBe("swing-flat");
      const head = rig.hitPoint(S, dress(id), "head").y;
      let top = Infinity;
      for (let t = 0; t <= 150; t += 4) top = Math.min(top, ins.strikeEnd(rig.samplePose(S, clip, t), dress(id), at, clip)[1]);
      // an overhead chop takes the pan about 30 units over the head; a flat swing stays level
      expect(top, id).toBeGreaterThan(head - 10);
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
