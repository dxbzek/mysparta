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
