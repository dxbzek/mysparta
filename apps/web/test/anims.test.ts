import { describe, expect, it } from "vitest";
import { applyDraft, createChampion, generateDraft, simulateFight, snapshot } from "@agoge/core";
import { combineSeed, makeRng } from "@agoge/core";
import { narrate } from "../src/narrate.js";
import type { BattlePlan } from "@agoge/core";

const PLAN: BattlePlan = { stance: "measured", gambit: "close_the_gap" };
function grown(name: string, level: number) {
  const c = createChampion(name);
  for (let l = 1; l < level; l++) {
    const offers = generateDraft(c, l + 1, 0);
    applyDraft(c, offers, makeRng(combineSeed(c.seed, l)).int(offers.length), false);
  }
  return c;
}

/** The stage's pose rule, mirrored so it can be asserted without a DOM. */
function animOf(
  side: 0 | 1,
  line: ReturnType<typeof narrate>[number],
  swings: [number, number],
): string {
  const react = line.anim?.reaction?.side === side ? line.anim.reaction.kind : undefined;
  if (react === "hurt") return "hit";
  if (react === "dodge") return "run";
  if (react === "block") return "stance";
  if (line.anim?.striker === side && !line.anim.beastId) {
    return swings[side] % 2 === 0 ? "attack1" : "attack2";
  }
  return "stance";
}

describe("fight animation variety", () => {
  it("a real bout produces every reaction the stage can draw", () => {
    const kinds = new Set<string>();
    for (let s = 0; s < 120; s++) {
      const r = simulateFight({
        seed: s,
        attacker: snapshot(grown("Alpha" + (s % 9), 6 + (s % 12)), PLAN),
        defender: snapshot(grown("Beta" + (s % 7), 6 + (s % 12)), PLAN),
      });
      for (const l of narrate(r, ["Alpha", "Beta"])) {
        if (l.anim?.reaction) kinds.add(l.anim.reaction.kind);
      }
    }
    // Before this change dodge and block both rendered as the idle guard.
    expect([...kinds].sort()).toEqual(["block", "dodge", "hurt"]);
  });

  it("gives dodge, block and hurt three different poses", () => {
    const mk = (kind: "hurt" | "dodge" | "block") =>
      ({ anim: { reaction: { side: 1 as const, kind } } }) as never;
    expect(animOf(1, mk("hurt"), [0, 0])).toBe("hit");
    expect(animOf(1, mk("dodge"), [0, 0])).toBe("run");
    expect(animOf(1, mk("block"), [0, 0])).toBe("stance");
    expect(new Set(["hit", "run", "stance"]).size).toBe(3);
  });

  it("alternates each fighter's swing on their own count, not a shared beat", () => {
    const swing = (side: 0 | 1) => ({ anim: { striker: side } }) as never;
    // Side 0 on its second swing while side 1 is still on its first: the two
    // must not be showing the same frame.
    expect(animOf(0, swing(0), [1, 0])).toBe("attack2");
    expect(animOf(1, swing(1), [1, 0])).toBe("attack1");
  });
});

/** The app's level-up picker, mirrored so the guarantee can be asserted. */
function pickFor(
  champion: { seed: number; level: number; weapons: string[]; skills: string[] },
  offers: Array<{ kind: string }>,
  rngPick: number,
): number {
  const next = champion.level + 1;
  const forced =
    next === 5 && champion.weapons.length === 0
      ? offers.findIndex((o) => o.kind === "weapon")
      : next === 10 && champion.skills.length === 0
        ? offers.findIndex((o) => o.kind === "skill")
        : -1;
  return forced >= 0 ? forced : rngPick;
}

describe("milestone level-ups", () => {
  it("a weaponless hunter takes the weapon at 5, whatever the roll says", () => {
    const offers = [{ kind: "stat3" }, { kind: "weapon" }, { kind: "stat21" }];
    const c = { seed: 1, level: 4, weapons: [], skills: [] };
    for (const roll of [0, 1, 2]) expect(pickFor(c, offers, roll)).toBe(1);
  });

  it("a skill-less hunter takes the skill at 10", () => {
    const offers = [{ kind: "skill" }, { kind: "stat3" }, { kind: "stat21" }];
    const c = { seed: 1, level: 9, weapons: ["xiphos"], skills: [] };
    for (const roll of [0, 1, 2]) expect(pickFor(c, offers, roll)).toBe(0);
  });

  it("leaves the roll alone once the hunter already has one", () => {
    const offers = [{ kind: "stat3" }, { kind: "weapon" }, { kind: "stat21" }];
    const c = { seed: 1, level: 4, weapons: ["xiphos"], skills: [] };
    expect(pickFor(c, offers, 2)).toBe(2);
  });

  it("leaves every non-milestone level to chance", () => {
    const offers = [{ kind: "stat3" }, { kind: "weapon" }, { kind: "stat21" }];
    for (const level of [1, 2, 3, 5, 6, 11, 20]) {
      const c = { seed: 1, level, weapons: [], skills: [] };
      expect(pickFor(c, offers, 0)).toBe(0);
    }
  });
});
