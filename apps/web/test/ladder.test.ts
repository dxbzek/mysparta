import { describe, expect, it } from "vitest";
import { ladder, standing } from "../src/ladder.js";

describe("ladder", () => {
  it("is stable across calls — passing a name means you climbed, not that the board moved", () => {
    // Ranks renumber around the player, but who those names are and what they
    // are rated must not change when the player's own rating does.
    const others = (rating: number, level: number) =>
      ladder("Zek", level, rating)
        .filter((r) => !r.you)
        .map(({ name, level: lv, rating: rt }) => ({ name, level: lv, rating: rt }));
    expect(others(1500, 1)).toEqual(others(1900, 9));
  });

  it("seats the champion by rating, and ranks run 1..n with no gaps", () => {
    const rows = ladder("Zek", 3, 1700);
    expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.rating).toBeGreaterThanOrEqual(rows[i]!.rating);
    }
  });

  it("puts exactly one 'you' on the board", () => {
    expect(ladder("Zek", 1, 1500).filter((r) => r.you)).toHaveLength(1);
  });

  it("does not seat the player twice when they share a realm name", () => {
    // "Timon" is one of the generated names — the player takes the seat.
    const rows = ladder("timon", 1, 1500);
    expect(rows.filter((r) => r.name.toLowerCase() === "timon")).toHaveLength(1);
    expect(rows.find((r) => r.you)!.name).toBe("timon");
  });

  it("climbing the rating moves you up the board", () => {
    const low = standing(ladder("Zek", 1, 1450)).rank;
    const high = standing(ladder("Zek", 1, 1950)).rank;
    expect(high).toBeLessThan(low);
  });
});

describe("standing", () => {
  it("names who is directly ahead", () => {
    const rows = ladder("Zek", 1, 1500);
    const me = standing(rows);
    expect(me.ahead).toBe(rows[me.rank - 2]);
    expect(me.of).toBe(rows.length);
  });

  it("has nobody ahead at rank 1", () => {
    expect(standing(ladder("Zek", 50, 9999)).ahead).toBeUndefined();
  });
});
