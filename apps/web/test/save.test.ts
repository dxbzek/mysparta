import { beforeEach, describe, expect, it } from "vitest";
import { createChampion } from "@agoge/core";
import {
  VIGOR_CAP,
  applyDailyReset,
  load,
  newSave,
  persist,
  todayKey,
  wipe,
  type SaveV1,
} from "../src/save.js";

/** The prototype persists to localStorage; node has none, so stand one in. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

const fresh = () =>
  newSave(createChampion("Zek"), { stance: "measured", gambit: "close_the_gap" });

describe("round trip", () => {
  it("loads back what it saved", () => {
    const save = fresh();
    persist(save);
    expect(load()).toEqual(save);
  });

  it("returns null with nothing stored, and after a wipe", () => {
    expect(load()).toBeNull();
    persist(fresh());
    wipe();
    expect(load()).toBeNull();
  });

  it("returns null rather than throwing on a corrupt or foreign save", () => {
    localStorage.setItem("agoge.save.v1", "{not json");
    expect(load()).toBeNull();
    localStorage.setItem("agoge.save.v1", JSON.stringify({ v: 99 }));
    expect(load()).toBeNull();
  });
});

describe("migrations", () => {
  const stored = (mutate: (s: Record<string, unknown>) => void) => {
    const raw = JSON.parse(JSON.stringify(fresh())) as Record<string, unknown>;
    mutate(raw);
    localStorage.setItem("agoge.save.v1", JSON.stringify(raw));
    return load()!;
  };

  it("gives a save with no battle plan the neutral stance", () => {
    expect(stored((s) => delete s.plan).plan.stance).toBe("measured");
  });

  it("fills in a plan that has a gambit but no stance", () => {
    const out = stored((s) => {
      (s.plan as Record<string, unknown>).stance = undefined;
    });
    expect(out.plan.stance).toBe("measured");
  });

  it("keeps a stance the player already chose", () => {
    const out = stored((s) => {
      (s.plan as Record<string, unknown>).stance = "guarded";
    });
    expect(out.plan.stance).toBe("guarded");
  });

  it("rebuilds a look — and drops now-dead gear ids — for pre-paperdoll saves", () => {
    const out = stored((s) => {
      delete s.look;
      s.gear = ["g_from_an_older_build"];
      s.equipped = { body: "g_from_an_older_build" };
    });
    expect(out.look).toBeDefined();
    expect(out.gear).toEqual([]);
    expect(out.equipped).toEqual({});
  });

  it("treats missing gear fields as an empty wardrobe", () => {
    const out = stored((s) => {
      delete s.gear;
      delete s.equipped;
    });
    expect(out.gear).toEqual([]);
    expect(out.equipped).toEqual({});
  });
});

describe("daily reset", () => {
  it("does nothing twice in one day", () => {
    const save = { ...fresh(), vigor: 3 };
    expect(applyDailyReset(save)).toBe(save);
  });

  it("grants the daily ration and banks it to the cap", () => {
    const yesterday: SaveV1 = { ...fresh(), vigor: 3, vigorDate: "2020-01-01" };
    expect(applyDailyReset(yesterday).vigor).toBe(9);
    expect(applyDailyReset({ ...yesterday, vigor: VIGOR_CAP }).vigor).toBe(VIGOR_CAP);
  });

  it("clears the board refresh and the day's tasks", () => {
    const yesterday: SaveV1 = {
      ...fresh(),
      vigorDate: "2020-01-01",
      boardRefresh: 4,
      quests: { day: "2020-01-01", fights: 3, wins: 2, crits: 1, claimed: true },
    };
    const out = applyDailyReset(yesterday);
    expect(out.boardRefresh).toBe(0);
    expect(out.quests).toEqual({ day: todayKey(), fights: 0, wins: 0, crits: 0, claimed: false });
  });
});

describe("rescue codes", () => {
  it("round-trips a save through encode/decode", async () => {
    const { encodeSave, decodeSave } = await import("../src/save.js");
    const save = fresh();
    expect(decodeSave(encodeSave(save))).toEqual(save);
    // tolerant of the whitespace a chat app pastes in
    expect(decodeSave("  " + encodeSave(save) + "\n")).toEqual(save);
  });

  it("rejects garbage, truncated codes, and foreign versions", async () => {
    const { encodeSave, decodeSave } = await import("../src/save.js");
    expect(decodeSave("not a code")).toBeNull();
    expect(decodeSave(encodeSave(fresh()).slice(0, 40))).toBeNull();
    expect(decodeSave(btoa(encodeURIComponent(JSON.stringify({ v: 99 }))))).toBeNull();
    expect(decodeSave(btoa(encodeURIComponent(JSON.stringify({ v: 1 }))))).toBeNull();
  });
});

describe("a new save", () => {
  it("starts at 1500 rating with the day-one bonus rations", () => {
    const save = fresh();
    expect(save.kleos).toBe(1500);
    expect(save.vigor).toBe(VIGOR_CAP);
    expect(save.wins + save.losses + save.totalFights).toBe(0);
  });
});

describe("untilReset", () => {
  it("counts down to the player's own midnight, not UTC's", async () => {
    const { untilReset } = await import("../src/save.js");
    // 21:30 local on any day is 2h30m from local midnight, whatever the zone.
    const evening = new Date(2026, 7, 5, 21, 30, 0);
    expect(untilReset(evening)).toMatchObject({ hours: 2, minutes: 30, text: "2h 30m" });
  });

  it("drops the hours once inside the last one", async () => {
    const { untilReset } = await import("../src/save.js");
    expect(untilReset(new Date(2026, 7, 5, 23, 41, 0)).text).toBe("19m");
  });

  it("stays in range all day — at midnight itself the next ration is a full day off", async () => {
    const { untilReset } = await import("../src/save.js");
    for (const h of [0, 6, 12, 18, 23]) {
      const r = untilReset(new Date(2026, 7, 5, h, 0, 0));
      expect(r.hours).toBeGreaterThanOrEqual(0);
      expect(r.hours).toBeLessThanOrEqual(24);
      expect(r.minutes).toBeGreaterThanOrEqual(0);
      expect(r.minutes).toBeLessThan(60);
    }
    expect(untilReset(new Date(2026, 7, 5, 0, 0, 0)).hours).toBe(24);
  });
});

describe("the level cap", () => {
  it("costToNext reports Infinity at the cap — the UI must not print it", async () => {
    const { costToNext, LEVEL_CAP } = await import("@agoge/core");
    expect(costToNext(LEVEL_CAP)).toBe(Infinity);
    expect(Number.isFinite(costToNext(LEVEL_CAP - 1))).toBe(true);
  });
});
