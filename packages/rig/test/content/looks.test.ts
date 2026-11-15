/**
 * The content pack's looks (review of 15 Nov 2026: "only about 2 of each part are drawn, so
 * rivals look like duplicates"): the full LOOK_SPACE, every entry its own drawing, the gate's
 * looks first, the same draw order rules as the gate's, every fill a palette colour, and the
 * build showing in the portrait.
 */
import { describe, expect, it } from "vitest";
import { LOOK_SPACE } from "@rankzero/core";
import type { Shape } from "../../src/contracts";
import { createRig } from "../../src/engine/createRig";
import { gatePack } from "../../src/gate/pack";
import { allColours } from "../../src/gate/style";
import { contentPack } from "../../src/content/pack";

const L = contentPack.looks;
const lists = {
  build: L.builds, head: L.heads, hair: L.hair, face: L.faces, top: L.tops, bottom: L.bottoms, shoes: L.shoes,
  accessory: L.accessories, skin: L.skin, hairColor: L.hairColor, palette: L.palettes,
} as const;

describe("content looks: the full LOOK_SPACE", () => {
  it("draws every LOOK_SPACE entry: each list is exactly as long as its look key", () => {
    for (const k of Object.keys(LOOK_SPACE) as (keyof typeof LOOK_SPACE)[]) expect(lists[k].length, k).toBe(LOOK_SPACE[k]);
  });
  it("draws each entry differently (no list repeats an entry)", () => {
    for (const [k, list] of Object.entries(lists)) expect(new Set(list.map((e) => JSON.stringify(e))).size, k).toBe(list.length);
  });
  it("starts with the gate's two looks", () => {
    const G = gatePack.looks;
    expect(L.heads.slice(0, G.heads.length)).toEqual(G.heads);
    expect(L.tops.slice(0, G.tops.length)).toEqual(G.tops);
    expect(L.bottoms.slice(0, G.bottoms.length)).toEqual(G.bottoms);
    expect(L.palettes.slice(0, G.palettes.length)).toEqual(G.palettes);
  });
  it("fills only with palette colours (skins, hair colours, every palette slot)", () => {
    const colours = allColours();
    for (const c of [...L.skin, ...L.hairColor, ...L.palettes.flatMap((p) => Object.values(p))]) expect(colours.has(c.toUpperCase()), c).toBe(true);
  });
  it("keeps the gate's draw order in every look: front arm over the body, back arm under it", () => {
    for (const set of [...L.tops, ...L.bottoms, ...L.heads]) {
      const zs = (pred: (b: string) => boolean): number[] => [...set, ...L.hands].filter((s: Shape) => pred(s.bone.replace(/:open$/, ""))).map((s) => s.z);
      const body = zs((b) => b === "torso" || b === "pelvis");
      if (body.length === 0) continue;
      expect(Math.min(...zs((b) => b.startsWith("armF") || b === "handF"))).toBeGreaterThan(Math.max(...body));
      expect(Math.max(...zs((b) => b.startsWith("armB") || b === "handB"))).toBeLessThan(Math.min(...body));
    }
  });
  it("shows the build in the portrait: lean, stocky and tall busts differ", () => {
    const rig = createRig(gatePack, contentPack);
    const base = { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 };
    const busts = new Set([0, 1, 2].map((b) => JSON.stringify(rig.portrait({ ...base, build: b }).parts)));
    expect(busts.size).toBe(3);
  });
});
