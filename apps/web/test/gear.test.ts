import { describe, expect, it } from "vitest";
import {
  gearItem,
  gearPool,
  gearStatLine,
  gearStats,
  lookWithGear,
  resolveExtras,
  rollGearDrop,
} from "../src/gear.js";
import { normaliseLook, torsosFor } from "../src/paperdoll.js";

const look = normaliseLook({ build: 0 } as never);

describe("gear pool", () => {
  it("has no duplicate ids", () => {
    const ids = gearPool().map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every piece a slot the wardrobe knows how to draw", () => {
    const slots = new Set(["body", "helm", "cloak", "trinket", "title"]);
    for (const g of gearPool()) expect(slots.has(g.slot)).toBe(true);
  });

  it("cuts every armour piece for both builds, so any drop is wearable", () => {
    const both = [0, 1].map((b) => torsosFor(b as never));
    for (const g of gearPool()) {
      if (g.slot !== "body" || g.torso == null) continue;
      for (const fits of both) expect(fits).toContain(g.torso);
    }
  });
});

describe("rollGearDrop", () => {
  it("is deterministic for a given seed", () => {
    expect(rollGearDrop([], 12345)?.id).toBe(rollGearDrop([], 12345)?.id);
  });

  it("never rolls a piece already owned", () => {
    const owned: string[] = [];
    // Drain the whole pool: each roll must be new, and the last one empties it.
    for (let i = 0; i < gearPool().length; i++) {
      const drop = rollGearDrop(owned, i * 7919);
      expect(drop).toBeDefined();
      expect(owned).not.toContain(drop!.id);
      owned.push(drop!.id);
    }
    expect(rollGearDrop(owned, 1)).toBeUndefined();
  });
});

describe("wearing gear", () => {
  it("totals the stats of every worn piece", () => {
    const plate = gearItem("g_plate_iron")!;
    const charm = gearItem("g_char_ember")!;
    const total = gearStats({ body: plate.id, trinket: charm.id });
    expect(total.grit).toBe(4);
    // Plate is heavy (−1 Speed); the charm gives +2 back.
    expect(total.tempo).toBe(1);
  });

  it("ignores empty and unknown slots rather than throwing", () => {
    expect(gearStats(undefined)).toEqual({});
    expect(gearStats({ body: "no_such_item" })).toEqual({});
  });

  it("swaps the torso layer for worn armour", () => {
    const plate = gearItem("g_plate_iron")!;
    const worn = lookWithGear(look, { body: plate.id });
    expect(worn.torso).toBe(plate.torso);
    expect(worn.torsoColor).toBe(plate.torsoColor);
  });

  it("leaves the look alone when nothing is equipped", () => {
    expect(lookWithGear(look, {})).toEqual(look);
    expect(lookWithGear(look, undefined)).toEqual(look);
  });

  it("lets a cloak override the chosen aura, but not the other way round", () => {
    const cloak = gearItem("g_cloak_gold")!;
    expect(resolveExtras(5, { cloak: cloak.id }).aura).toBe(cloak.aura);
    expect(resolveExtras(5, {}).aura).toBe(5);
  });

  it("reads a stat line in player words", () => {
    expect(gearStatLine(gearItem("g_plate_iron")!)).toBe("+4 END · -1 SPD");
    expect(gearStatLine({ id: "x", name: "x", slot: "title", flavour: "" })).toBe("");
  });
});
