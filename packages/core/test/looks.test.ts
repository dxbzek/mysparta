/**
 * Looks after content v3 batch 4 (CONTRACT_REV 10, plan 13.9 and 13.12): LOOK_SPACE grew, the
 * seeded roll is versioned, and a record stores the look the player picked. The roll of version 1
 * must give every seed exactly what the build before gave it (its code is copied here as it was at
 * 436c0a8), so a scrapper from an old save keeps the look it was shown.
 */
import { describe, expect, it } from "vitest";
import { LOOK_ROLL, LOOK_SPACE, LOOK_SPACE_V1, REALM_SALT, api, combineSeed, makeRng } from "../src/index";
import type { Look } from "../src/index";
import { rivalSeed } from "../src/progress/rivals";

/** rollLook as build 436c0a8 wrote it, over the counts it had. */
function rollLook436(seed: number, lookSalt: number, colourSalt: number): Look {
  const SPACE = { build: 3, head: 6, hair: 10, face: 8, top: 8, bottom: 5, shoes: 4, accessory: 6, skin: 8, hairColor: 8, palette: 12 } as const;
  const shapes = makeRng(combineSeed(seed, "look", lookSalt));
  const colours = makeRng(combineSeed(seed, "colour", colourSalt));
  const out: Record<string, number> = {};
  for (const k of ["build", "head", "hair", "face", "top", "bottom", "shoes", "accessory"] as const) out[k] = shapes.int(SPACE[k]);
  for (const k of ["skin", "hairColor", "palette"] as const) out[k] = colours.int(SPACE[k]);
  return out as unknown as Look;
}
const rec = (name: string, lookSalt = 0, colourSalt = 0) =>
  api.createRecord({ id: `L-${name}`, name, realmSalt: REALM_SALT, lookSalt, colourSalt, today: "2026-11-19", nowMs: 0 });

describe("LOOK_SPACE (content v3 batch 4)", () => {
  it("has the plan's counts, and the old counts kept for the version-1 roll", () => {
    expect(LOOK_SPACE).toEqual({ build: 5, head: 10, hair: 18, face: 14, top: 16, bottom: 10, shoes: 8, accessory: 14, skin: 10, hairColor: 12, palette: 24 });
    expect(LOOK_SPACE_V1).toEqual({ build: 3, head: 6, hair: 10, face: 8, top: 8, bottom: 5, shoes: 4, accessory: 6, skin: 8, hairColor: 8, palette: 12 });
    for (const k of Object.keys(LOOK_SPACE) as (keyof typeof LOOK_SPACE)[]) expect(LOOK_SPACE[k]).toBeGreaterThan(LOOK_SPACE_V1[k]);
    expect(LOOK_ROLL).toBe(2);
  });
});

describe("the seeded look roll", () => {
  it("version 1 gives every seed and salt exactly the look build 436c0a8 gave it (2,000 seeds, 3 salts each)", () => {
    for (let i = 0; i < 2000; i++) {
      const seed = combineSeed("look-pin", i);
      for (const [ls, cs] of [[0, 0], [i % 7, 0], [3, i % 5]] as const) expect(api.rollLook(seed, ls, cs, 1)).toEqual(rollLook436(seed, ls, cs));
    }
  });
  it("version 2 (the default) reaches every new part, and the two rolls differ for most seeds", () => {
    const seen: Record<string, Set<number>> = {};
    let differ = 0;
    for (let i = 0; i < 3000; i++) {
      const seed = combineSeed("look-new", i);
      const l = api.rollLook(seed, 0, 0);
      expect(api.rollLook(seed, 0, 0, 2)).toEqual(l);
      for (const [k, v] of Object.entries(l)) (seen[k] ??= new Set()).add(v);
      if (JSON.stringify(l) !== JSON.stringify(api.rollLook(seed, 0, 0, 1))) differ++;
    }
    for (const k of Object.keys(LOOK_SPACE) as (keyof typeof LOOK_SPACE)[]) expect(seen[k]!.size, k).toBe(LOOK_SPACE[k]);
    expect(differ).toBeGreaterThan(2900);
  });
});

describe("a record's look", () => {
  it("is stored at creation: today's roll of the name and salts, or the editor's pick", () => {
    const r = rec("Look Keeper", 2, 5);
    expect(r.look).toEqual(api.rollLook(r.seed, 2, 5));
    const pick: Look = { build: 3, head: 9, hair: 17, face: 13, top: 15, bottom: 9, shoes: 7, accessory: 13, skin: 9, hairColor: 11, palette: 23 };
    const r2 = api.createRecord({ id: "L2", name: "Look Keeper", realmSalt: REALM_SALT, lookSalt: 2, colourSalt: 5, today: "2026-11-19", nowMs: 0, look: pick });
    expect(r2.look).toEqual(pick);
    expect(api.lookOf(r2)).toEqual(pick);
    expect(api.snapshotOf(r2).look).toEqual(pick);
  });
  it("is the version-1 roll for a record with none stored (an old save before its migration)", () => {
    const { look: _l, ...old } = rec("Old Timer", 1, 2);
    void _l;
    expect(api.lookOf(old)).toEqual(rollLook436(old.seed, 1, 2));
    expect(api.snapshotOf(old).look).toEqual(rollLook436(old.seed, 1, 2));
  });
  it("is cosmetic: changing it changes nothing but the look in the sheet and the snapshot", () => {
    const r = rec("Iron Nell");
    const changed = api.withLook(r, { build: 4, head: 7, hair: 12, face: 10, top: 11, bottom: 6, shoes: 5, accessory: 9, skin: 8, hairColor: 10, palette: 20 });
    const a = api.sheetOf(r);
    const b = api.sheetOf(changed);
    expect({ ...b, look: a.look }).toEqual(a);
    expect({ ...api.snapshotOf(changed), look: api.snapshotOf(r).look }).toEqual(api.snapshotOf(r));
    expect(b.look.build).toBe(4);
  });
  it("is cleaned into LOOK_SPACE when stored or read", () => {
    const r = api.withLook(rec("Wrap Around"), { build: 7, head: -1, hair: 18.6, face: Number.NaN, top: 16, bottom: 10, shoes: 8, accessory: 14, skin: 10, hairColor: 12, palette: 24 } as Look);
    expect(r.look).toEqual({ build: 2, head: 9, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 });
  });
  it("rivals keep seeded looks, drawn from today's roll", () => {
    for (const [lvl, n] of [[1, 0], [10, 3], [30, 200]] as const) {
      expect(api.rivalSnapshot(REALM_SALT, lvl, n).look).toEqual(api.rollLook(rivalSeed(REALM_SALT, lvl, n), 0, 0));
    }
  });
});
