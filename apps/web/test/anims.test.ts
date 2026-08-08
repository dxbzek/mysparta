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

describe("battle animation coverage", () => {
  /** Every stage direction the theatre can draw, harvested from real bouts. */
  function harvest(count: number) {
    const seen = {
      chain: 0, riposte: 0, cast: 0, summon: 0, ready: 0,
      dodge: 0, block: 0, hurt: 0, thrown: 0, beastDown: 0,
    };
    for (let s = 0; s < count; s++) {
      const a = grown("Alpha" + (s % 11), 8 + (s % 16));
      const b = grown("Beta" + (s % 9), 8 + (s % 16));
      const r = simulateFight({ seed: s, attacker: snapshot(a, PLAN), defender: snapshot(b, PLAN) });
      for (const l of narrate(r, ["Alpha", "Beta"])) {
        const an = l.anim;
        if (!an) continue;
        if (an.chain) seen.chain++;
        if (an.riposte) seen.riposte++;
        if (an.cast) seen.cast++;
        if (an.summon) seen.summon++;
        if (an.ready !== undefined) seen.ready++;
        if (an.thrown) seen.thrown++;
        if (an.reaction?.kind === "dodge") seen.dodge++;
        if (an.reaction?.kind === "block") seen.block++;
        if (an.reaction?.kind === "hurt") seen.hurt++;
        if (l.beastDown) seen.beastDown++;
      }
    }
    return seen;
  }

  it("real fights emit every beat the stage now animates", () => {
    const seen = harvest(160);
    // Each of these had no distinct animation before this pass — a combo
    // replayed the opening swing, a riposte sprinted like an attack, a skill
    // was a caption over an idle, and a beast simply existed.
    expect(seen.chain).toBeGreaterThan(0);
    expect(seen.riposte).toBeGreaterThan(0);
    expect(seen.cast).toBeGreaterThan(0);
    expect(seen.summon).toBeGreaterThan(0);
    expect(seen.ready).toBeGreaterThan(0);
    expect(seen.dodge).toBeGreaterThan(0);
    expect(seen.block).toBeGreaterThan(0);
    expect(seen.hurt).toBeGreaterThan(0);
  });

  it("a chain carries its position, so follow-ups can escalate", () => {
    const depths = new Set<number>();
    for (let s = 0; s < 200; s++) {
      const r = simulateFight({
        seed: s,
        attacker: snapshot(grown("Chain" + (s % 7), 14), PLAN),
        defender: snapshot(grown("Foe" + (s % 5), 14), PLAN),
      });
      for (const l of narrate(r, ["A", "B"])) if (l.anim?.chain) depths.add(l.anim.chain);
    }
    // Not just "is a chain" — the link number, which drives cx1/cx2/cx3.
    expect(Math.max(...depths)).toBeGreaterThanOrEqual(2);
    expect([...depths].every((d) => d >= 1)).toBe(true);
  });

  it("a beast is summoned once and only once per side", () => {
    for (let s = 0; s < 120; s++) {
      const r = simulateFight({
        seed: s,
        attacker: snapshot(grown("Beastly" + (s % 6), 20), PLAN),
        defender: snapshot(grown("Rival" + (s % 4), 20), PLAN),
      });
      const summons = new Map<string, number>();
      for (const l of narrate(r, ["A", "B"])) {
        if (l.anim?.summon) {
          const k = `${l.anim.striker}:${l.anim.summon}`;
          summons.set(k, (summons.get(k) ?? 0) + 1);
        }
      }
      for (const [k, n] of summons) expect(`${k}=${n}`).toBe(`${k}=1`);
    }
  });

  it("counters and ripostes never also claim a run-in", () => {
    for (let s = 0; s < 120; s++) {
      const r = simulateFight({
        seed: s,
        attacker: snapshot(grown("Guard" + (s % 8), 16), PLAN),
        defender: snapshot(grown("Rush" + (s % 6), 16), PLAN),
      });
      for (const l of narrate(r, ["A", "B"])) {
        // riposte and chain are mutually exclusive branches in slotClass;
        // both set would silently drop one of the two animations.
        if (l.anim?.riposte) expect(l.anim.chain ?? 0).toBe(0);
      }
    }
  });
});

describe("mending has a beat of its own", () => {
  it("every heal carries the anim the stage needs to play it", () => {
    let heals = 0;
    for (let s = 0; s < 240 && heals < 6; s++) {
      const r = simulateFight({
        seed: s,
        attacker: snapshot(grown("Mender" + (s % 11), 12 + (s % 10)), PLAN),
        defender: snapshot(grown("Foe" + (s % 13), 12 + (s % 10)), PLAN),
      });
      for (const line of narrate(r, ["Mender", "Foe"])) {
        if (!line.fx?.heal) continue;
        heals++;
        // the number alone was the whole animation before this
        expect(line.anim?.heal).toBe(true);
        expect(line.anim?.striker).toBe(line.fx.target);
      }
    }
    expect(heals).toBeGreaterThan(0);
  });
});

describe("content lookups survive a stale save", () => {
  it("an id we no longer ship falls back instead of taking the app down", async () => {
    const { weapon, skill, beast, omen } = await import("@agoge/core");
    expect(() => weapon("a_weapon_we_cut")).not.toThrow();
    expect(() => skill("a_skill_we_cut")).not.toThrow();
    expect(() => beast("a_beast_we_cut")).not.toThrow();
    expect(() => omen("an_omen_we_cut")).not.toThrow();
    expect(weapon("a_weapon_we_cut").name).toBeTruthy();
  });
});

describe("the killing blow is the beat before the epilogue", () => {
  it("a KO ends with a summary line, so hit-stop lands on the blow itself", () => {
    let kos = 0;
    for (let s = 0; s < 60 && kos < 8; s++) {
      const r = simulateFight({
        seed: s,
        attacker: snapshot(grown("Ender" + (s % 9), 10 + (s % 8)), PLAN),
        defender: snapshot(grown("Fallen" + (s % 7), 10 + (s % 8)), PLAN),
      });
      if (r.reason !== "ko") continue;
      kos++;
      const lines = narrate(r, ["Ender", "Fallen"]);
      // The stage extends the hold on lines.length - 1, which is only the
      // killing blow while the very last line stays a non-action epilogue.
      expect(lines[lines.length - 1]!.kind).toBe("end");
      expect(lines[lines.length - 1]!.anim).toBeUndefined();
      expect(lines.length).toBeGreaterThan(1);
    }
    expect(kos).toBeGreaterThan(0);
  });
});
