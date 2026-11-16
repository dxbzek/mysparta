/**
 * Item icons in the full rig (review 15 Nov 2026, items 6-8): every shield and weapon has its
 * own drawn icon, never the plain ring; a bending weapon (drawn as links) is not empty; a long
 * weapon is framed on its business end so it reads at 28-64 px, not a hairline on a dark tile.
 */
import { describe, expect, it } from "vitest";
import { COMPANION_IDS, PERK_IDS, SHIELD_IDS, SKILL_IDS, WEAPON_IDS } from "@rankzero/core";
import type { HeldId } from "@rankzero/core";
import type { IconRef, SvgArt } from "../../src/contracts";
import { createRig } from "../../src/engine/createRig";
import { iconArt } from "../../src/engine/svg";
import { gatePack } from "../../src/gate/pack";
import { parsePolys } from "../../src/gate/vocab";
import { contentPack } from "../../src/content/pack";

const rig = createRig(gatePack, contentPack);
const RING = iconArt(null, "ui:close" as IconRef);
const area = (p: [number, number][]): number => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i]!; const r = p[(i + 1) % p.length]!; a += q[0] * r[1] - r[0] * q[1]; } return Math.abs(a / 2); };
/** Filled (non-ink, non-empty) area of an icon in its 24-unit box. */
function filled(art: SvgArt): number {
  return art.parts.filter((p) => p.fill !== "none" && p.stroke !== undefined).reduce((s, p) => s + parsePolys(p.d).reduce((t, q) => t + area(q as [number, number][]), 0), 0);
}

describe("item icons", () => {
  it("draws no perk or the fists as the plain ring", () => {
    for (const ref of [...PERK_IDS, "fists"] as IconRef[]) expect(rig.icon(ref), ref).not.toEqual(RING);
  });
  it("draws all six shields with their own picture (each differs)", () => {
    const pics = SHIELD_IDS.map((id) => JSON.stringify(rig.icon(id)));
    expect(new Set(pics).size).toBe(SHIELD_IDS.length);
  });
  it("gives every weapon icon at least one part, in the 24-unit box with no transform", () => {
    for (const id of [...WEAPON_IDS, "fists"] as HeldId[]) {
      const art = rig.icon(id);
      expect(art.parts.length, id).toBeGreaterThan(0);
      expect(art.viewBox, id).toBe("0 0 24 24");
      for (const p of art.parts) expect(p.transform, id).toBeUndefined();
    }
  });
  it("frames every weapon so its filled body covers at least 7% of the box (readable at 28 px)", () => {
    for (const id of [...WEAPON_IDS, "fists"] as HeldId[]) expect(filled(rig.icon(id)), id).toBeGreaterThan(24 * 24 * 0.07);
  });
  it("keeps the skills on their own icons", () => {
    for (const id of SKILL_IDS) expect(rig.icon(id).parts.length, id).toBeGreaterThan(1);
  });
  it("draws every pet as its own framed head icon, not the shrunk body portrait (review round 2)", () => {
    const pics = COMPANION_IDS.map((id) => rig.icon(id));
    COMPANION_IDS.forEach((id, i) => {
      expect(pics[i], id).not.toEqual(rig.companionPortrait(id));
      expect(pics[i]!.viewBox, id).toBe("0 0 24 24");
      // the head fills the badge: at least a quarter of the box is the animal plus the frame's disc
      expect(filled(pics[i]!), id).toBeGreaterThan(24 * 24 * 0.25);
    });
    expect(new Set(pics.map((p) => JSON.stringify(p))).size).toBe(COMPANION_IDS.length);
  });
});

/**
 * Readable at 28 px (review round 2, 16 Nov 2026: "body slam is a jumble, sand in the eyes reads as
 * a cookie, the dog reads as a bear, the goose as a penguin"). A machine cannot name a picture,
 * but it can catch the two faults behind those: two icons whose pictures cover the same cells at
 * 28 px (they cannot be told apart), and a coloured feature thinner than its own ink outline (the
 * outline swallows it: a goose bill or a dog ear that vanishes into a dark blob).
 */
const MOVE_IDS = ["haymaker", "energy-drink", "tarp", "whistle", "firecrackers", "snatch", "air-horn", "body-slam", "sand-in-the-eyes", "taunt", "second-wind", "grapple"] as const;
const FRAME = 2;
type P2 = readonly [number, number];
function insidePoly(x: number, y: number, q: readonly P2[]): boolean {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const a = q[i]!;
    const b = q[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
/** The 28 x 28 cells whose top paint is the pictogram (not the frame), keyed by its colour. */
function cells(art: SvgArt): Map<number, string> {
  const polys = art.parts.map((p) => parsePolys(p.d) as P2[][]);
  const out = new Map<number, string>();
  for (let cy = 0; cy < 28; cy++) for (let cx = 0; cx < 28; cx++) {
    const x = ((cx + 0.5) * 24) / 28;
    const y = ((cy + 0.5) * 24) / 28;
    for (let i = art.parts.length - 1; i >= 0; i--) {
      if (!polys[i]!.reduce((c, q) => (insidePoly(x, y, q) ? !c : c), false)) continue;
      if (i >= FRAME) out.set(cy * 28 + cx, art.parts[i]!.fill);
      break;
    }
  }
  return out;
}
/** Share of the two pictures' cells that differ (cell missing in one, or a different colour). */
function apart(a: Map<number, string>, b: Map<number, string>): number {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let diff = 0;
  for (const k of keys) if (a.get(k) !== b.get(k)) diff++;
  return keys.size === 0 ? 0 : diff / keys.size;
}
const perim = (q: readonly P2[]): number => q.reduce((s, p, i) => s + Math.hypot(q[(i + 1) % q.length]![0] - p[0], q[(i + 1) % q.length]![1] - p[1]), 0);
/** Pictogram shapes thinner than 3/4 of their own ink line. */
function swallowed(art: SvgArt): string[] {
  const bad: string[] = [];
  art.parts.forEach((p, i) => {
    if (i < FRAME || p.stroke === undefined) return;
    for (const q of parsePolys(p.d) as P2[][]) {
      // mean thickness of a shape: 2 x area / perimeter (a w-wide band gives about w)
      const t = (2 * area(q as [number, number][])) / perim(q);
      if (t < (p.strokeWidth ?? 1.6) * 0.75) bad.push(`part ${i} ${p.fill}: ${t.toFixed(2)} under a ${p.strokeWidth} line`);
    }
  });
  return bad;
}

describe("Move and pet icons read at 28 px", () => {
  const groups: [string, readonly string[]][] = [["Moves", MOVE_IDS], ["pets", COMPANION_IDS]];
  for (const [name, ids] of groups) {
    it(`no two ${name} icons cover the same cells at 28 px (at least 45% of their cells differ)`, () => {
      const pics = ids.map((id) => cells(rig.icon(id as IconRef)));
      const bad: string[] = [];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const d = apart(pics[i]!, pics[j]!);
        if (d < 0.45) bad.push(`${ids[i]} ~ ${ids[j]} ${(d * 100).toFixed(0)}%`);
      }
      expect(bad).toEqual([]);
    });
    it(`no coloured feature of a ${name} icon is thinner than its own outline`, () => {
      expect(ids.flatMap((id) => swallowed(rig.icon(id as IconRef)).map((b) => `${id} ${b}`))).toEqual([]);
    });
  }
  it("planted faults: the goose with every outline at the full 1.6 line is caught; a near copy is caught", () => {
    const goose = rig.icon("goose" as IconRef);
    const heavy: SvgArt = { ...goose, parts: goose.parts.map((p) => (p.stroke === undefined ? p : { ...p, strokeWidth: 1.6 })) };
    expect(swallowed(heavy).length).toBeGreaterThan(0);
    expect(apart(cells(goose), cells(goose))).toBe(0);
    // the goose without its brow is a near copy: it must fall under the 45% bar
    expect(apart(cells(goose), cells({ ...goose, parts: goose.parts.slice(0, -1) }))).toBeLessThan(0.45);
  });
});
