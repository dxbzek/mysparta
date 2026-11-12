import { describe, expect, it } from "vitest";
import { ARENAS, ambienceFor } from "../src/arenas.js";
import { AMBIENCE } from "../src/sound.js";

describe("per-arena ambience", () => {
  const byArena = ARENAS.map((a) => [a.name, ambienceFor(a)] as const);

  it("gives every arena a flavour the synth knows how to build", () => {
    for (const [name, flavour] of byArena) expect(AMBIENCE[flavour], name).toBeDefined();
  });

  it("the arenas do not all share one room any more", () => {
    const used = new Set(byArena.map(([, f]) => f));
    expect(used.size).toBeGreaterThanOrEqual(5);
    // and the plain crowd is the exception, not the rule
    expect(byArena.filter(([, f]) => f === "crowd").length).toBeLessThan(ARENAS.length / 2);
  });

  it("reads the place: storms, the volcano, snow, the night, the bowl", () => {
    const of = (name: string) => byArena.find(([n]) => n === name)![1];
    expect(of("Storm Reach")).toBe("storm");
    expect(of("Iron Sky")).toBe("storm");
    expect(of("Ember Hollow")).toBe("rumble");
    expect(of("Frozen Grove")).toBe("wind");
    expect(of("Ashfall Ridge")).toBe("wind");
    expect(of("Midnight Hollow")).toBe("night");
    expect(of("Sunken Mist")).toBe("water");
    expect(of("The Colosseum")).toBe("stands");
  });

  it("stays felt, not heard: every bed is quiet and the crowd never leaves", () => {
    for (const [flavour, spec] of Object.entries(AMBIENCE)) {
      expect(spec.crowd, flavour).toBeGreaterThan(0.02);
      expect(spec.crowd, flavour).toBeLessThanOrEqual(0.07);
      expect(spec.layers.length, flavour).toBeLessThanOrEqual(3);
      for (const l of spec.layers) {
        expect(l.gain, flavour).toBeGreaterThan(0);
        expect(l.gain, flavour).toBeLessThanOrEqual(0.06);
        // a swell deeper than the level would drive the gain negative (phase flip)
        expect(l.depth, flavour).toBeGreaterThanOrEqual(0);
        expect(l.depth, flavour).toBeLessThanOrEqual(1);
        // a sweep must never push the filter to or below 0 Hz
        if (l.sweep) expect(l.freq - l.sweep.hz, flavour).toBeGreaterThan(60);
        // breathing, never a beat — except the night-song's flutter
        if (flavour !== "night") expect(l.rate, flavour).toBeLessThan(2);
      }
    }
  });

  it("the original murmur is unchanged where nothing else applies", () => {
    expect(AMBIENCE.crowd).toEqual({ crowd: 0.05, layers: [] });
  });
});
