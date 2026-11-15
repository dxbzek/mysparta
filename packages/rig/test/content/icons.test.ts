/**
 * Item icons in the full rig (review 15 Nov 2026, items 6-8): every shield and weapon has its
 * own drawn icon, never the plain ring; a bending weapon (drawn as links) is not empty; a long
 * weapon is framed on its business end so it reads at 28-64 px, not a hairline on a dark tile.
 */
import { describe, expect, it } from "vitest";
import { PERK_IDS, SHIELD_IDS, SKILL_IDS, WEAPON_IDS } from "@rankzero/core";
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
});
