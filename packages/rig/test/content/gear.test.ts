/**
 * Body equipment art (content v3, batch 2, plan 13.12): every piece of the 30 is drawn on bones of
 * its own slot, in colours of the palette, with an icon; worn by a fighter in every clip it draws
 * with no warning, and it changes the drawn picture (it shows). The gear sheet (`pnpm gear-sheet`)
 * is the eye check.
 */
import { describe, expect, it, vi } from "vitest";
import { GEAR_IDS, GEAR_META } from "@rankzero/core";
import type { GearId } from "@rankzero/core";
import { SCRAPPER_CLIPS } from "../../src/contracts";
import type { Ctx2D, DrawEnv, Dress } from "../../src/contracts";
import { createRig } from "../../src/engine/createRig";
import { contentPack } from "../../src/content/pack";
import { gatePack } from "../../src/gate/pack";
import { FIXED, allColours } from "../../src/gate/style";

const rig = createRig(gatePack, contentPack);
const BONES: Record<string, readonly string[]> = {
  head: ["head", "hair"], torso: ["torso", "armF.up", "armF.lo", "armB.up", "armB.lo"], hands: ["handF", "handB", "armF.lo", "armB.lo"],
  legs: ["legF.up", "legF.lo", "legB.up", "legB.lo", "torso", "pelvis"], feet: ["footF", "footB"],
};

/** A canvas that only records the fills it is asked for. */
function recorder(): { env: DrawEnv; fills: string[] } {
  const fills: string[] = [];
  let style = "";
  const ctx = new Proxy({}, {
    get(_t, k) {
      if (k === "fill") return () => fills.push(style);
      if (k === "measureText") return () => ({ width: 0 });
      if (k === "fillStyle") return style;
      return () => undefined;
    },
    set(_t, k, v) { if (k === "fillStyle") style = String(v); return true; },
  }) as unknown as Ctx2D;
  return { env: { ctx, path: (d) => d }, fills };
}

describe("body equipment art", () => {
  it("has a drawing and an icon for every piece, on bones of its own slot, in palette colours", () => {
    const palette = allColours();
    for (const id of GEAR_IDS) {
      const art = contentPack.gear[id];
      expect(art, id).toBeDefined();
      expect(art.slot, id).toBe(GEAR_META[id].slot);
      expect(art.shapes.length, id).toBeGreaterThan(0);
      for (const s of art.shapes) expect(BONES[art.slot], `${id} ${s.bone}`).toContain(s.bone.replace(/:open$/, ""));
      for (const s of art.shapes) if (s.slot in FIXED) expect(palette.has(FIXED[s.slot as keyof typeof FIXED].toUpperCase()), `${id} ${s.slot}`).toBe(true);
      expect(contentPack.icons[id].shapes.length, id).toBeGreaterThan(3);
      expect(rig.icon(id).parts.length, id).toBeGreaterThan(3);
    }
  });

  it("draws every piece in every scrapper clip with no warning, and the picture changes with it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const id of GEAR_IDS as readonly GearId[]) {
      for (const clip of SCRAPPER_CLIPS) {
        const pose = rig.samplePose("scrapper", clip, 120);
        const bare: Dress = { held: "pipe", shield: null, scale: 1 };
        const a = recorder();
        const b = recorder();
        rig.drawActor(a.env, pose, bare, { x: 100, y: 200, facing: 1 });
        rig.drawActor(b.env, pose, { ...bare, gear: { [GEAR_META[id].slot]: id } }, { x: 100, y: 200, facing: 1 });
        expect(b.fills.join(), `${id} ${clip}`).not.toBe(a.fills.join());
      }
    }
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("gear"))).toEqual([]);
    warn.mockRestore();
  });
});
