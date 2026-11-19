/**
 * The content pack's looks (review of 15 Nov 2026: "only about 2 of each part are drawn, so
 * rivals look like duplicates"): the full LOOK_SPACE, every entry its own drawing, the gate's
 * looks first, the same draw order rules as the gate's, every fill a palette colour, and the
 * build showing in the portrait.
 */
import { describe, expect, it } from "vitest";
import { LOOK_SPACE } from "@rankzero/core";
import type { Look } from "@rankzero/core";
import type { Dress, Shape } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import { parsePolys } from "../../src/gate/vocab";
import { LOOK_HEADWEAR } from "../../src/content/looks";
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
  it("shows the build in the portrait: lean, stocky, tall, heavy and wiry busts differ", () => {
    const rig = createRig(gatePack, contentPack);
    const base = { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 };
    const busts = new Set([0, 1, 2, 3, 4].map((b) => JSON.stringify(rig.portrait({ ...base, build: b }).parts)));
    expect(busts.size).toBe(5);
  });
});

/** Content v3 batch 4 (plan 13.9): the new parts are added at the end of each list, so a look
 *  written before draws exactly as it did; the two new builds; hats and head gear over the new parts. */
describe("content looks: batch 4", () => {
  const rig = createRig(gatePack, contentPack);
  const ins = inspectOf(rig);
  const base: Look = { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 };
  const parts = (look: Look, gear?: Dress["gear"]) => ins.parts(rig.samplePose("scrapper", "idle", 0), { look, held: null, shield: null, scale: 1, ...(gear ? { gear } : {}) }, { x: 0, y: 0, facing: 1 });
  const top = (ps: ReturnType<typeof parts>, tag: string): number => Math.min(...ps.filter((p) => p.tag === tag).flatMap((p) => polysOf(p).flat().map(([, y]) => y)));

  it("keeps every part of the look before batch 4 at its index (the old looks draw as they did)", () => {
    const before = OLD_COUNTS;
    for (const [k, n] of Object.entries(before) as [keyof typeof before, number][]) expect(lists[k].length, k).toBeGreaterThan(n);
    // the first entries are the same drawings the build before had: their digest is pinned here
    expect(digest([L.heads.slice(0, 6), L.hair.slice(0, 10), L.faces.slice(0, 8), L.tops.slice(0, 8), L.bottoms.slice(0, 5), L.shoes.slice(0, 4),
      L.accessories.slice(0, 6), L.skin.slice(0, 8), L.hairColor.slice(0, 8), L.palettes.slice(0, 12), L.builds.slice(0, 3)])).toBe(OLD_DIGEST);
  });
  it("draws five builds: heavy is the deepest in the trunk with a belly, wiry the narrowest; none taller than the tall build", () => {
    const depth = [0, 1, 2, 3, 4].map((b) => { const xs = parts({ ...base, build: b }).filter((p) => p.tag === "torso").flatMap((p) => polysOf(p).flat().map(([x]) => x)); return Math.max(...xs) - Math.min(...xs); });
    expect(depth[3]).toBeGreaterThan(Math.max(depth[0]!, depth[1]!, depth[2]!));
    expect(depth[4]).toBeLessThan(Math.min(depth[0]!, depth[1]!, depth[2]!));
    for (const b of L.builds) expect(b.scale).toBeLessThanOrEqual(L.builds[2]!.scale);
    expect(L.builds[3]!.belly ?? 0).toBeGreaterThan(0);
  });
  it("cuts the hair at the brim under a cap, a beanie or a hard hat: no hair above the hat", () => {
    const tall = [4, 7, 11, 13, 15];   // mohawk, big curls, afro, flat top, undercut
    for (const h of tall) {
      const bare = top(parts({ ...base, hair: h }), "hair");
      for (const [acc, gear] of [[6, undefined], [7, undefined], [0, { head: "hard-hat" }], [0, { head: "beanie" }]] as const) {
        const ps = parts({ ...base, hair: h, accessory: acc }, gear);
        const hat = Math.min(top(ps, "head"));
        const hairTop = ps.some((p) => p.tag === "hair") ? top(ps, "hair") : Infinity;
        expect(hairTop, `hair ${h} under ${acc} ${JSON.stringify(gear)}`).toBeGreaterThan(bare);
        expect(hairTop, `hair ${h} under ${acc} ${JSON.stringify(gear)}`).toBeGreaterThan(hat);
      }
    }
  });
  it("takes a head accessory off under head gear, and keeps the rest", () => {
    const count = (look: Look, gear?: Dress["gear"]) => parts(look, gear).length;
    for (const acc of LOOK_HEADWEAR) expect(count({ ...base, accessory: acc }, { head: "hard-hat" }), `accessory ${acc}`).toBe(count({ ...base, accessory: 0 }, { head: "hard-hat" }));
    for (const acc of [8, 9, 11]) expect(count({ ...base, accessory: acc }, { head: "hard-hat" }), `accessory ${acc}`).toBeGreaterThan(count({ ...base, accessory: 0 }, { head: "hard-hat" }));
    expect(count({ ...base, accessory: 9 }, { head: "goggles" })).toBe(count({ ...base, accessory: 0 }, { head: "goggles" }));
    expect(L.eyewear).toEqual([9]);
    expect(L.headwear).toEqual(LOOK_HEADWEAR);
    for (const c of L.crownwear ?? []) expect(L.headwear).toContain(c);
  });
  it("covers the legs a short bottom leaves bare with the trousers worn as gear", () => {
    for (const b of [3, 5, 8]) {
      const skin = (gear?: Dress["gear"]) => parts({ ...base, bottom: b }, gear).filter((p) => (p.tag ?? "").startsWith("leg") && p.lit === L.skin[base.skin]).length;
      expect(skin(), `bottom ${b}`).toBeGreaterThan(0);
      expect(skin({ legs: "track-pants" }), `bottom ${b}`).toBe(0);
    }
  });
  it("hides every new pair of shoes under footwear gear, and a tall boot's shaft with them", () => {
    for (let s = 4; s < L.shoes.length; s++) {
      const shoes = parts({ ...base, shoes: s }, { feet: "sneakers" }).filter((p) => p.lit === slot({ ...base, shoes: s }, "shoes"));
      const plain = parts({ ...base, shoes: s }).filter((p) => p.lit === slot({ ...base, shoes: s }, "shoes"));
      expect(shoes.length, `shoes ${s}`).toBeLessThan(plain.length);
    }
  });
});

const OLD_COUNTS = { head: 6, hair: 10, face: 8, top: 8, bottom: 5, shoes: 4, accessory: 6, skin: 8, hairColor: 8, palette: 12, build: 3 } as const;
/** A short digest of the drawings that were there before batch 4 (FNV-1a over their JSON). */
function digest(v: unknown): string {
  let h = 0x811c9dc5;
  const s = JSON.stringify(v);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}
/** Measured on build 436c0a8's own content pack (git archive of packages/rig/src at 436c0a8). */
const OLD_DIGEST = "402d268c";
function polysOf(p: { d: string; xf: { a: number; b: number; c: number; d: number; e: number; f: number } }): [number, number][][] {
  return parsePolys(p.d).map((poly) => poly.map(([x, y]) => [p.xf.a * x + p.xf.c * y + p.xf.e, p.xf.b * x + p.xf.d * y + p.xf.f] as [number, number]));
}
function slot(look: Look, s: "shoes"): string {
  return L.palettes[look.palette]![s];
}
