/**
 * The cloud-save router, against an in-memory store. These cover the two
 * behaviours that decide whether players trust a cloud save at all: a retried
 * push must not write twice, and a second device must not silently clobber
 * the first.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type Save } from "@agoge/protocol";
import { appRouter } from "../src/index.js";
import type { Context } from "../src/trpc.js";
import type { Store, StoredSave } from "../src/routers/save.js";

function memoryStore(): Store & { rows: Map<string, StoredSave> } {
  const rows = new Map<string, StoredSave>();
  const keys = new Map<string, unknown>();
  return {
    rows,
    async getSave(profileId) {
      return rows.get(profileId) ?? null;
    },
    async putSave(profileId, save, baseVersion) {
      const current = rows.get(profileId);
      const version = current?.version ?? 0;
      if (version !== baseVersion) return null;
      const next: StoredSave = { save, version: version + 1, updatedAt: "2026-08-05T00:00:00.000Z" };
      rows.set(profileId, next);
      return next;
    },
    async seenIdempotencyKey(profileId, key) {
      return keys.get(profileId + key);
    },
    async recordIdempotencyKey(profileId, key, _route, response) {
      keys.set(profileId + key, response);
    },
  };
}

const save = (level = 1): Save => ({
  schema: SAVE_SCHEMA_VERSION,
  champion: {
    name: "Lyra",
    displayName: "Lyra",
    seed: 12345,
    omen: "thrower",
    epithet: "the Far-Sighted",
    level,
    xp: 0,
    stats: { might: 7, grace: 9, tempo: 7, grit: 7 },
    weapons: [],
    skills: [],
    beasts: [],
    favour: 0,
  },
  kleos: 1500,
  vigor: 12,
  vigorDate: "2026-08-05",
  wins: 0,
  losses: 0,
  totalFights: 0,
  presentation: {},
});

let store: ReturnType<typeof memoryStore>;
let caller: ReturnType<typeof appRouter.createCaller>;
const ctx = (): Context => ({ profileId: "profile-1", store });

beforeEach(() => {
  store = memoryStore();
  caller = appRouter.createCaller(ctx());
});

describe("save.pull", () => {
  it("a never-synced account is empty, not an error", async () => {
    await expect(caller.save.pull()).resolves.toEqual({ save: null, version: 0, updatedAt: null });
  });

  it("refuses an unauthenticated caller", async () => {
    const anon = appRouter.createCaller({ profileId: null, store });
    await expect(anon.save.pull()).rejects.toThrow(/no profile/i);
  });
});

describe("save.push", () => {
  const key = "11111111-1111-4111-8111-111111111111";

  it("stores the save and hands back the new version", async () => {
    const out = await caller.save.push({ idempotencyKey: key, save: save(), baseVersion: 0 });
    expect(out.version).toBe(1);
    await expect(caller.save.pull()).resolves.toMatchObject({ version: 1 });
  });

  it("a retried push writes once", async () => {
    const first = await caller.save.push({ idempotencyKey: key, save: save(3), baseVersion: 0 });
    const retry = await caller.save.push({ idempotencyKey: key, save: save(3), baseVersion: 0 });
    expect(retry).toEqual(first);
    expect(store.rows.get("profile-1")!.version).toBe(1);
  });

  it("rejects a push built on a stale read rather than clobbering", async () => {
    await caller.save.push({ idempotencyKey: key, save: save(2), baseVersion: 0 });
    await expect(
      caller.save.push({
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
        save: save(9),
        baseVersion: 0, // the second device never saw version 1
      }),
    ).rejects.toThrow(/STALE_SAVE/);
    // the first device's champion survives
    expect(store.rows.get("profile-1")!.save.champion.level).toBe(2);
  });

  it("rejects a save that fails the wire contract", async () => {
    const bad = { ...save(), kleos: 99999 };
    await expect(
      caller.save.push({ idempotencyKey: key, save: bad as Save, baseVersion: 0 }),
    ).rejects.toThrow();
  });
});
