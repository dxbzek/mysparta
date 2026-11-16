/**
 * The control of test/pets.test.ts: pets back at their owner's feet, as the fight-screen pass had
 * them, turn its measure red. Its own file, so it runs in its own worker (test/lib/pets.ts).
 */
import { describe, expect, it } from "vitest";
import { BOUTS, FULL, RIGS, atFeet, worstOf } from "./lib/pets";

describe("control: pets back at their owner's feet turn it red", () => {
  it("full size at the feet: a pet covers a fighter", () => {
    const w = worstOf(BOUTS[0]!, "real art", FULL, atFeet(1));
    expect(w.cover).toBeGreaterThan(0.2);
  });
  it("at their new size but on the old marks: a pet touches its owner and the pets overlap", () => {
    for (const [rigName, rig] of RIGS) {
      const w = worstOf(BOUTS[0]!, rigName, rig, atFeet());
      expect(w.ownerCover, rigName).toBeGreaterThan(0.02);
    }
  });
});
