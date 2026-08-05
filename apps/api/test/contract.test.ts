/**
 * The wire contract as a security boundary.
 *
 * apps/api trusts nothing from the client. These tests are the attack list a
 * save endpoint actually faces: a champion levelled past the cap, a rating
 * invented out of thin air, arrays sized to exhaust the row, strings sized to
 * exhaust the column, prototype pollution smuggled through JSON, and the
 * quieter one — extra fields riding along hoping something downstream reads
 * them. Every case must be refused before it reaches storage.
 */
import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, pushSaveInput, saveSchema } from "@agoge/protocol";

const valid = {
  schema: SAVE_SCHEMA_VERSION,
  champion: {
    name: "Lyra",
    displayName: "Lyra",
    seed: 12345,
    omen: "thrower",
    epithet: "the Far-Sighted",
    level: 7,
    xp: 3,
    stats: { might: 10, grace: 12, tempo: 9, grit: 16 },
    weapons: ["xiphos"],
    skills: [],
    beasts: [],
    favour: 2,
  },
  kleos: 1639,
  vigor: 9,
  vigorDate: "2026-08-05",
  wins: 4,
  losses: 1,
  totalFights: 5,
  presentation: { look: { build: 1 } },
};

const reject = (mutate: (s: Record<string, any>) => void) => {
  const bad = structuredClone(valid) as Record<string, any>;
  mutate(bad);
  return saveSchema.safeParse(bad).success;
};

describe("the contract accepts an honest save", () => {
  it("round-trips a real champion", () => {
    const parsed = saveSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});

describe("the contract refuses a forged one", () => {
  it("caps the level at the soft cap", () => {
    expect(reject((s) => (s.champion.level = 9999))).toBe(false);
    expect(reject((s) => (s.champion.level = 0))).toBe(false);
  });

  it("holds stats and favour inside their canon ranges", () => {
    expect(reject((s) => (s.champion.stats.might = 500))).toBe(false);
    expect(reject((s) => (s.champion.favour = 99))).toBe(false); // bank cap is 6
  });

  it("refuses an invented rating", () => {
    expect(reject((s) => (s.kleos = 999999))).toBe(false);
    expect(reject((s) => (s.kleos = 0))).toBe(false);
  });

  it("refuses more vigor than a day can hold", () => {
    expect(reject((s) => (s.vigor = 1000))).toBe(false);
  });

  it("refuses non-finite and non-integer numbers", () => {
    expect(reject((s) => (s.champion.xp = Number.NaN))).toBe(false);
    expect(reject((s) => (s.champion.xp = Number.POSITIVE_INFINITY))).toBe(false);
    expect(reject((s) => (s.champion.level = 3.5))).toBe(false);
    expect(reject((s) => (s.wins = -1))).toBe(false);
  });

  it("bounds every list so one row cannot be made enormous", () => {
    expect(reject((s) => (s.champion.weapons = Array(5000).fill("xiphos")))).toBe(false);
    expect(reject((s) => (s.champion.skills = Array(500).fill("iron_will")))).toBe(false);
    expect(reject((s) => (s.champion.beasts = Array(99).fill("karasu")))).toBe(false);
  });

  it("bounds every string so one column cannot be made enormous", () => {
    expect(reject((s) => (s.champion.name = "a".repeat(10_000)))).toBe(false);
    expect(reject((s) => (s.champion.epithet = "a".repeat(10_000)))).toBe(false);
    expect(reject((s) => (s.champion.weapons = ["a".repeat(10_000)]))).toBe(false);
  });

  it("refuses a save missing required facts", () => {
    expect(reject((s) => delete s.champion)).toBe(false);
    expect(reject((s) => delete s.kleos)).toBe(false);
  });

  it("refuses a save claiming a schema version we do not speak", () => {
    expect(reject((s) => (s.schema = 99))).toBe(false);
  });

  it("strips unknown fields rather than passing them through", () => {
    const smuggled = { ...structuredClone(valid), isAdmin: true, kleosOverride: 4000 } as Record<string, any>;
    const parsed = saveSchema.parse(smuggled) as Record<string, unknown>;
    expect(parsed.isAdmin).toBeUndefined();
    expect(parsed.kleosOverride).toBeUndefined();
  });

  it("does not let a JSON payload pollute Object.prototype", () => {
    const hostile = JSON.parse(
      JSON.stringify({ ...valid, __proto__: { polluted: true } }),
    );
    saveSchema.safeParse(hostile);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("requires a real idempotency key on every push", () => {
    expect(pushSaveInput.safeParse({ save: valid, baseVersion: 0, idempotencyKey: "nope" }).success).toBe(false);
    expect(pushSaveInput.safeParse({ save: valid, baseVersion: -1, idempotencyKey: "11111111-1111-4111-8111-111111111111" }).success).toBe(false);
    expect(
      pushSaveInput.safeParse({
        save: valid,
        baseVersion: 0,
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
  });
});
