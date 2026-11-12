import { beforeEach, describe, expect, it } from "vitest";
import { createChampion } from "@agoge/core";
import {
  VIGOR_CAP,
  applyDailyReset,
  load,
  newSave,
  persist,
  setActiveSlot as setActive,
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
      quests: { day: "2020-01-01", fights: 3, wins: 2, crits: 1, blocks: 9, streak: 2, run: 2, claimed: true },
    };
    const out = applyDailyReset(yesterday);
    expect(out.boardRefresh).toBe(0);
    expect(out.quests).toEqual({
      day: todayKey(),
      fights: 0, wins: 0, crits: 0, blocks: 0, streak: 0, run: 0,
      claimed: false,
      paid: [],
    });
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

describe("the roster", () => {
  it("keeps three hunters apart, and slot 0 stays the original save key", async () => {
    const { persist, loadSlot, setActiveSlot, activeSlot, rosterSummary } = await import("../src/save.js");
    const a = { ...fresh(), kleos: 1600 };
    const b = { ...fresh(), kleos: 1700 };
    persist(a, 0);
    persist(b, 1);
    expect(localStorage.getItem("agoge.save.v1")).toBeTruthy();
    expect(loadSlot(0)!.kleos).toBe(1600);
    expect(loadSlot(1)!.kleos).toBe(1700);
    expect(loadSlot(2)).toBeNull();
    setActiveSlot(1);
    expect(activeSlot()).toBe(1);
    expect(rosterSummary().filter(Boolean)).toHaveLength(2);
  });

  it("retiring one hunter leaves the others alone", async () => {
    const { persist, wipe, loadSlot } = await import("../src/save.js");
    persist(fresh(), 0);
    persist(fresh(), 1);
    wipe(1);
    expect(loadSlot(0)).not.toBeNull();
    expect(loadSlot(1)).toBeNull();
  });

  it("refuses a slot outside the roster rather than writing junk", async () => {
    const { setActiveSlot, activeSlot } = await import("../src/save.js");
    setActiveSlot(0);
    setActiveSlot(99);
    expect(activeSlot()).toBe(0);
    setActiveSlot(-1);
    expect(activeSlot()).toBe(0);
  });

  it("reports the first free slot, and none when full", async () => {
    const { persist, firstFreeSlot, hasFreeSlot, ROSTER_MAX } = await import("../src/save.js");
    expect(firstFreeSlot()).toBe(0);
    persist(fresh(), 0);
    expect(firstFreeSlot()).toBe(1);
    for (let i = 1; i < ROSTER_MAX; i++) persist(fresh(), i);
    expect(hasFreeSlot()).toBe(false);
    expect(firstFreeSlot()).toBeNull();
  });
});

describe("rotating daily tasks", () => {
  it("gives three tasks, all different metrics", async () => {
    const { questsForDay } = await import("../src/save.js");
    const q = questsForDay("2026-08-05");
    expect(q).toHaveLength(3);
    expect(new Set(q.map((d) => d.metric)).size).toBe(3);
  });

  it("is stable for a day and different across days", async () => {
    const { questsForDay } = await import("../src/save.js");
    expect(questsForDay("2026-08-05")).toEqual(questsForDay("2026-08-05"));
    const week = new Set(
      ["01", "02", "03", "04", "05", "06", "07"].map((d) =>
        questsForDay(`2026-08-${d}`).map((q) => q.text).join("|"),
      ),
    );
    // Not every day need differ, but a week must not be one board seven times.
    expect(week.size).toBeGreaterThan(1);
  });

  it("only ever draws tasks from the pool", async () => {
    const { questsForDay } = await import("../src/save.js");
    const metrics = new Set(["fights", "wins", "crits", "blocks", "streak"]);
    for (let d = 1; d <= 28; d++) {
      for (const q of questsForDay(`2026-09-${String(d).padStart(2, "0")}`)) {
        expect(metrics.has(q.metric)).toBe(true);
        expect(q.need).toBeGreaterThan(0);
        expect(q.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("counts progress against the day's board and knows when it is done", async () => {
    const { questsForDay, questProgress, questsComplete, freshQuests } = await import("../src/save.js");
    const defs = questsForDay("2026-08-05");
    const q = { ...freshQuests(), fights: 99, wins: 99, crits: 99, blocks: 99, streak: 99 };
    expect(questsComplete(q, defs)).toBe(true);
    for (const d of defs) expect(questProgress(q, d)).toBe(d.need);
    expect(questsComplete(freshQuests(), defs)).toBe(false);
  });
});

describe("a save that will not read", () => {
  const JUNK = '{"v":1,"champion":{"displayName":"Zek","level":31,"xp":'; // a write cut short

  it("is corrupt, not empty — and an absent one is empty, not corrupt", async () => {
    const { slotState, persist } = await import("../src/save.js");
    expect(slotState(0)).toBe("empty");
    localStorage.setItem("agoge.save.v1", JUNK);
    expect(slotState(0)).toBe("corrupt");
    localStorage.setItem("agoge.save.v1.1", JSON.stringify({ v: 99, from: "the future" }));
    expect(slotState(1)).toBe("corrupt");
    persist(fresh(), 2);
    expect(slotState(2)).toBe("ok");
  });

  it("is never offered as a free slot", async () => {
    const { firstFreeSlot, hasFreeSlot, persist } = await import("../src/save.js");
    localStorage.setItem("agoge.save.v1", JUNK);
    // The Forge writes to firstFreeSlot(): it must walk past the damaged one.
    expect(firstFreeSlot()).toBe(1);
    persist(fresh(), 1);
    persist(fresh(), 2);
    expect(hasFreeSlot()).toBe(false);
    expect(firstFreeSlot()).toBeNull();
    expect(localStorage.getItem("agoge.save.v1")).toBe(JUNK);
  });

  it("has its bytes copied to .bak the first time it is read, slot untouched", async () => {
    const { slotBackup } = await import("../src/save.js");
    localStorage.setItem("agoge.save.v1.2", JUNK);
    expect(slotBackup(2)).toBeNull();
    setActive(2);
    expect(load()).toBeNull();
    expect(localStorage.getItem("agoge.save.v1.2.bak")).toBe(JUNK);
    expect(slotBackup(2)).toBe(JUNK);
    expect(localStorage.getItem("agoge.save.v1.2")).toBe(JUNK);
  });

  it("keeps the bytes even when a new hunter is written straight over it", async () => {
    const { slotBackup, slotState } = await import("../src/save.js");
    localStorage.setItem("agoge.save.v1", JUNK);
    // No read first: the write itself must be the guard.
    persist(fresh(), 0);
    expect(slotState(0)).toBe("ok");
    expect(slotBackup(0)).toBe(JUNK);
  });

  it("keeps the bytes when the damaged slot is freed", async () => {
    const { slotBackup, slotState } = await import("../src/save.js");
    localStorage.setItem("agoge.save.v1.1", JUNK);
    wipe(1);
    expect(slotState(1)).toBe("empty");
    expect(slotBackup(1)).toBe(JUNK);
  });

  it("does not back up a healthy save on every write, or when it is deleted", async () => {
    const { slotBackup, backupSlot } = await import("../src/save.js");
    persist(fresh(), 0);
    persist({ ...fresh(), kleos: 1600 }, 0);
    expect(slotBackup(0)).toBeNull();
    wipe(0);
    expect(slotBackup(0)).toBeNull();
    // ...unless asked to: the error boundary's reset copies first.
    persist(fresh(), 0);
    expect(backupSlot(0)).toBe(true);
    expect(slotBackup(0)).toBe(localStorage.getItem("agoge.save.v1"));
  });

  it("a save missing its champion is unreadable rather than a crash", async () => {
    const { slotState } = await import("../src/save.js");
    localStorage.setItem("agoge.save.v1", JSON.stringify({ v: 1 }));
    expect(load()).toBeNull();
    expect(slotState(0)).toBe("corrupt");
    localStorage.setItem("agoge.save.v1", JSON.stringify({ v: 1, champion: {} }));
    expect(load()).toBeNull();
    expect(slotState(0)).toBe("corrupt");
  });
});

describe("daily tasks pay as they are finished", () => {
  const DAY = "2026-08-05";
  const board = async () => {
    const { questsForDay, freshQuests, settleQuests, TASK_XP } = await import("../src/save.js");
    const defs = questsForDay(DAY);
    const blank = { ...freshQuests(), day: DAY };
    const done = (n: number) => {
      const q = { ...blank };
      for (const d of defs.slice(0, n)) (q[d.metric] as number) = d.need;
      return q;
    };
    return { defs, blank, done, settleQuests, TASK_XP };
  };

  it("pays nothing for nothing", async () => {
    const { blank, defs, settleQuests } = await board();
    const out = settleQuests(blank, defs);
    expect(out.taskXp).toBe(0);
    expect(out.boardCleared).toBe(false);
    expect(out.quests.claimed).toBe(false);
  });

  it("one task done pays +1 XP on its own — two of three is no longer zero", async () => {
    const { defs, done, settleQuests, TASK_XP } = await board();
    const one = settleQuests(done(1), defs);
    expect(one.taskXp).toBe(TASK_XP);
    expect(one.boardCleared).toBe(false);
    const two = settleQuests(done(2), defs);
    expect(two.taskXp).toBe(2 * TASK_XP);
    expect(two.boardCleared).toBe(false);
    expect(two.quests.claimed).toBe(false);
  });

  it("never pays the same task twice, however many fights follow", async () => {
    const { defs, done, settleQuests } = await board();
    let q = settleQuests(done(2), defs).quests;
    for (let fight = 0; fight < 5; fight++) {
      const again = settleQuests({ ...q, fights: q.fights + 1 }, defs);
      // fights may itself be a task finishing later; only already-paid ones are barred
      expect(again.newlyDone.every((d) => !q.paid!.includes(d.metric))).toBe(true);
      q = again.quests;
    }
    expect(new Set(q.paid).size).toBe(q.paid!.length);
    expect(q.paid!.length).toBeLessThanOrEqual(3);
  });

  it("all three pays the third task AND the drop, once", async () => {
    const { defs, done, settleQuests, TASK_XP } = await board();
    const afterTwo = settleQuests(done(2), defs).quests;
    const full = { ...done(3), paid: afterTwo.paid };
    const out = settleQuests(full, defs);
    expect(out.taskXp).toBe(TASK_XP);
    expect(out.boardCleared).toBe(true);
    expect(out.quests.claimed).toBe(true);
    const next = settleQuests(out.quests, defs);
    expect(next.taskXp).toBe(0);
    expect(next.boardCleared).toBe(false);
    // 3 XP across the day from tasks, never more
    expect(out.quests.paid).toHaveLength(3);
  });

  it("a save from before tasks paid singly is settled, not crashed", async () => {
    const { defs, done, settleQuests, TASK_XP } = await board();
    const old = { ...done(3), claimed: true } as Record<string, unknown>;
    delete old.paid;
    const out = settleQuests(old as never, defs);
    // The drop was already taken; the three tasks are honoured once.
    expect(out.boardCleared).toBe(false);
    expect(out.taskXp).toBe(3 * TASK_XP);
    expect(settleQuests(out.quests, defs).taskXp).toBe(0);
  });
});

describe("where the Forge may write", () => {
  const JUNK = '{"v":1,"champion":{"displayName":"Hal';

  it("takes the first empty slot, whoever is being played", async () => {
    const { forgeSlot } = await import("../src/save.js");
    expect(forgeSlot()).toBe(0);
    persist(fresh(), 0);
    setActive(0);
    expect(forgeSlot()).toBe(1);
  });

  it("has nowhere to write when three healthy hunters fill the roster", async () => {
    const { forgeSlot } = await import("../src/save.js");
    for (let i = 0; i < 3; i++) persist({ ...fresh(), kleos: 1500 + i }, i);
    for (let active = 0; active < 3; active++) {
      setActive(active);
      // It used to answer `active`, and the Forge wrote over that hunter.
      expect(forgeSlot()).toBeNull();
    }
  });

  it("has nowhere to write with two healthy hunters and one damaged slot", async () => {
    const { forgeSlot } = await import("../src/save.js");
    persist(fresh(), 0);
    localStorage.setItem("agoge.save.v1.1", JUNK);
    persist(fresh(), 2);
    for (const active of [0, 2]) {
      setActive(active);
      expect(forgeSlot()).toBeNull();
    }
  });

  it("offers a damaged active slot only when nothing is empty", async () => {
    const { forgeSlot } = await import("../src/save.js");
    for (let i = 0; i < 3; i++) localStorage.setItem(i === 0 ? "agoge.save.v1" : `agoge.save.v1.${i}`, JUNK);
    setActive(1);
    // The Forge's "damaged" path: persist() copies the old bytes aside first.
    expect(forgeSlot()).toBe(1);
    localStorage.removeItem("agoge.save.v1.2");
    expect(forgeSlot()).toBe(2);
  });

  it("a full roster survives the Forge's own write path byte for byte", async () => {
    const { forgeSlot } = await import("../src/save.js");
    for (let i = 0; i < 3; i++) persist({ ...fresh(), kleos: 1500 + i }, i);
    setActive(1);
    const before = [0, 1, 2].map((i) => localStorage.getItem(i === 0 ? "agoge.save.v1" : `agoge.save.v1.${i}`));
    // What App's onForge / onRestore do: ask for a target, write only if given one.
    const target = forgeSlot();
    if (target !== null) persist(fresh(), target);
    const after = [0, 1, 2].map((i) => localStorage.getItem(i === 0 ? "agoge.save.v1" : `agoge.save.v1.${i}`));
    expect(after).toEqual(before);
  });
});
