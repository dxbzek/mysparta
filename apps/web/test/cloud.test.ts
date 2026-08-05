/**
 * Cloud sync, client side. The behaviour that matters is what happens when
 * the server is absent, unreachable, or disagrees — a prototype that breaks
 * because a sync failed is worse than one that never synced.
 */
import { describe, expect, it } from "vitest";
import { createChampion } from "@agoge/core";
import { cloudEnabled, fromWire, toWire } from "../src/cloud.js";
import { newSave } from "../src/save.js";

const local = () => newSave(createChampion("Lyra"), { stance: "measured", gambit: "close_the_gap" });

describe("with no server configured", () => {
  it("stays off, so the game runs on localStorage alone", () => {
    // VITE_API_URL is unset in tests, which is the shipped prototype's state.
    expect(cloudEnabled).toBe(false);
  });
});

describe("the wire split", () => {
  it("sends the facts a ladder reads and carries the rest opaquely", () => {
    const save = local();
    const wire = toWire(save);
    // `name` is the canonical lookup key — lowercased, and what the schema's
    // unique(lower(name)) constraint matches on. `displayName` keeps the case
    // the player typed. Sending both is the point, not redundancy.
    expect(wire.champion.name).toBe("lyra");
    expect(wire.champion.displayName).toBe("Lyra");
    expect(wire.kleos).toBe(1500);
    // presentation is the client's own — the server never interprets it
    expect(wire.presentation).toHaveProperty("look");
    expect(wire.presentation).not.toHaveProperty("champion");
  });

  it("round-trips without losing the player's appearance or gear", () => {
    const save = { ...local(), gear: ["g_plate_iron"], aura: 3 };
    const back = fromWire(toWire(save), local());
    expect(back.gear).toEqual(["g_plate_iron"]);
    expect(back.aura).toBe(3);
    expect(back.look).toEqual(save.look);
    expect(back.champion.displayName).toBe(save.champion.displayName);
  });

  it("a cloud save wins on facts, not on presentation", () => {
    const mine = { ...local(), aura: 7 };
    const theirs = toWire({ ...local(), kleos: 1800, wins: 12 });
    const merged = fromWire(theirs, mine);
    expect(merged.kleos).toBe(1800);
    expect(merged.wins).toBe(12);
  });
});
