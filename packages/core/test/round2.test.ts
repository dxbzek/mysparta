/**
 * Round-2 sim review (16 November 2026): skill effects that show, a level-1 kit with a skill, Moves
 * after the opening, once-a-bout number tags, booster tags, the weapon cap and the easier Snatch.
 */
import { describe, expect, it } from "vitest";
import type { MoveId, PerkId, SkillId } from "../src/contracts/ids";
import { MOVE_IDS, REALM_SALT, perkKind } from "../src/contracts/ids";
import type { Proc, Step } from "../src/contracts/log";
import { SKILLS, sk } from "../src/content/skills";
import { combineSeed, makeRng } from "../src/prng";
import { fighterSeed, randomName, startPerk, startSkill } from "../src/progress/create";
import { BARE_KNUCKLE_MAX_WEAPONS, MAX_WEAPONS, WEAPON_SHARE, fits, isBooster, rollPerk, weaponShare, weaponsOf } from "../src/progress/perks";
import { PERK_PLUS_MAX_LEVEL, walk, walkWith } from "../src/progress/route";
import { THROW_LAST_PCT, throwChance } from "../src/sim/thrown";
import { rivalSnapshot } from "../src/progress/rivals";
import { OPENING_BIG_PCT, OPENING_FLOOR_PCT, OPENING_PCT, OPENING_TURNS, onceOnly } from "../src/sim/bout";
import { meleeAttack } from "../src/sim/melee";
import { MOVE_SLACK, UNARMED_MOVES, moveReady } from "../src/sim/moves";
import { simulateFight } from "../src/sim/simulate";
import { takeTurn } from "../src/sim/turn";
import { fn, queue, scripted, setup, snap } from "./helpers";

const procsOf = (s: Step): readonly Proc[] => ("procs" in s && s.procs !== undefined ? s.procs : []);

function randomBouts(n: number, tag: string, levels: readonly number[]) {
  const rng = makeRng(combineSeed("round2", tag));
  const out = [];
  for (let i = 0; i < n; i++) {
    const level = levels[i % levels.length]!;
    const a = rivalSnapshot(REALM_SALT, level, rng.int(240));
    const b = rivalSnapshot(REALM_SALT, level, rng.int(240));
    out.push({ a, b, log: simulateFight(rng.int(2 ** 31), a, b, 1) });
  }
  return out;
}

describe("the opening lets a big hit read as big", () => {
  it("a crit in the opening may take up to 25% of max HP in its turn (a plain hit 10%)", () => {
    // Hit rolls: no intercept, no evade, no block, then a crit.
    const t = setup(snap(["sledgehammer"], { points: { strength: 40 } }), snap([]), scripted({ hit: queue([99, 99, 99, 0]) }));
    t.bout.turn = 1;
    t.A.held = "sledgehammer";
    meleeAttack(t.bout, t.A, t.B);
    const sw = t.bout.steps.find((s) => s.t === "attack")!;
    expect(sw).toMatchObject({ outcome: "hit", crit: true, damage: Math.floor((t.B.maxHp * OPENING_BIG_PCT) / 100) });
    expect(OPENING_BIG_PCT).toBeGreaterThan(OPENING_PCT);
  });

  it("never takes a scrapper below 40% of its max HP in the opening", () => {
    const t = setup(snap(["sledgehammer"], { points: { strength: 40 } }), snap([]), scripted({ hit: queue([99, 99, 99, 0]) }));
    t.bout.turn = 2;
    t.A.held = "sledgehammer";
    const floor = Math.ceil((t.B.maxHp * OPENING_FLOOR_PCT) / 100);
    t.B.hp = floor + 3;
    meleeAttack(t.bout, t.A, t.B);
    expect(t.B.hp).toBe(floor);
  });

  it("no Move but the unarmed ones is ready in the opening, and every Move is after it", () => {
    for (const id of MOVE_IDS) {
      const t = setup(snap([id, "raccoon"]), snap(["raccoon", "pipe"]));
      t.B.held = "pipe";
      t.A.hp = 1;                                      // the heals' condition holds
      t.bout.actors.find((x) => x.id === "a1")!.hp = 1;
      t.bout.turn = OPENING_TURNS;
      expect(moveReady(t.bout, t.A, id), `${id} in the opening`).toBe(UNARMED_MOVES.has(id as MoveId));
      t.bout.turn = OPENING_TURNS + 1;
      expect(moveReady(t.bout, t.A, id), `${id} after the opening`).toBe(true);
    }
    expect(MOVE_SLACK).toBe(6);
  });

  it("no damage Move but the unarmed ones lands in turns 1 to 5 of 2,000 random bouts", () => {
    for (const { log } of randomBouts(2000, "move-turns", [3, 10, 30])) {
      for (const s of log.steps) {
        if (s.t === "move" && !UNARMED_MOVES.has(s.move)) expect(s.turn).toBeGreaterThan(OPENING_TURNS);
      }
    }
  });
});

describe("Moves get room", () => {
  it("no Move on the own turn right after a Move, then the roll is back", () => {
    const t = setup(snap(["taunt", "tarp"]), snap([]), scripted({ move: fn(() => 0) }));
    takeTurn(t.bout, t.A);
    takeTurn(t.bout, t.A);
    takeTurn(t.bout, t.A);
    const mine = t.bout.steps.filter((s) => (s.t === "move" || s.t === "attack") && s.actor === "a0" && (s.t === "move" || s.n === 0))
      .map((s) => s.t);
    expect(mine[0]).toBe("move");
    expect(mine[1]).toBe("attack");
    expect(mine[mine.length - 1]).toBe("move");
  });
});

describe("the first draw of a bout is sure", () => {
  it("a scrapper with a weapon draws it on its first turn even when every draw roll would fail", () => {
    const t = setup(snap(["pipe"]), snap([]), scripted({ draw: fn((n) => n - 1) }));
    t.A.startDraw = true;
    takeTurn(t.bout, t.A);
    expect(t.bout.steps[0]).toMatchObject({ t: "draw", weapon: "pipe" });
  });

  it("level-1 swings are three quarters weapons or more (fists were a third)", () => {
    let fists = 0;
    let all = 0;
    for (const { log } of randomBouts(1500, "fists", [1])) {
      for (const s of log.steps) {
        if ((s.t === "attack" || s.t === "throw") && (s.actor === "a0" || s.actor === "b0")) {
          all += 1;
          if (s.weapon === "fists") fists += 1;
        }
      }
    }
    expect(fists / all).toBeLessThan(0.25);
  });
});

describe("a scrapper starts with a weapon and a skill", () => {
  it("the weapon is the one the name always gave; the skill fits it, is no booster and no Snatch", () => {
    const skills = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const seed = fighterSeed(REALM_SALT, randomName(i));
      const first = startPerk(seed);
      const second = startSkill(seed, first);
      expect(perkKind(first)).toBe("weapon");
      expect(perkKind(second)).toBe("skill");
      expect(isBooster(second), second).toBe(false);
      expect(second).not.toBe("snatch");
      expect(second).not.toBe("knock-loose");
      expect(fits(second, [first]), second).toBe(true);
      expect(walk(seed, []).perks).toEqual([first, second]);
      skills.add(second);
    }
    expect(skills.size).toBeGreaterThan(20);
  });

  it("most level-1 bouts now show a skill (none did)", () => {
    let withSkill = 0;
    const bouts = randomBouts(1500, "l1-skill", [1]);
    for (const { log } of bouts) if (log.steps.some((s) => s.t === "move" || procsOf(s).length > 0)) withSkill += 1;
    expect(withSkill / bouts.length).toBeGreaterThan(0.75);
  });
});

describe("tags that repeat show once a bout", () => {
  it("each number skill, shield, Quick Swap, Head Start and booster tags its owner at most once a bout", () => {
    let once = 0;
    for (const { log } of randomBouts(1500, "once", [10, 30])) {
      const seen = new Set<string>();
      for (const s of log.steps) {
        for (const p of procsOf(s)) {
          if (!onceOnly(p.skill)) continue;
          const k = `${p.by}|${p.skill}`;
          expect(seen.has(k), k).toBe(false);
          seen.add(k);
          once += 1;
        }
      }
    }
    expect(once).toBeGreaterThan(1000);
  });

  it("a level-30 bout shows 8 tags or fewer on median (was 10.7 on average, most of them repeats)", () => {
    const tags = randomBouts(800, "tag-count", [30]).map(({ log }) => log.steps.filter((s) => procsOf(s).length > 0).length);
    tags.sort((x, y) => x - y);
    expect(tags[tags.length >> 1]).toBeLessThanOrEqual(8);
  });
});

describe("boosters show in the fight", () => {
  it("Heavy Hands names itself on its owner's first hit, once", () => {
    const t = setup(snap(["heavy-hands", "pipe"]), snap([]), scripted({ hit: queue([99, 99, 99, 99, 99, 99, 99, 99, 99, 99]) }));
    t.A.held = "pipe";
    meleeAttack(t.bout, t.A, t.B);
    meleeAttack(t.bout, t.A, t.B);
    const hits = t.bout.steps.filter((s) => s.t === "attack" && s.outcome === "hit");
    expect(hits[0]).toMatchObject({ procs: [{ by: "a0", skill: "heavy-hands" }] });
    expect(procsOf(hits[1]!)).toEqual([]);
  });

  it("Light Feet names itself on its owner's first evade", () => {
    const t = setup(snap([]), snap(["light-feet"]), scripted({ hit: queue([99, 0]) }));
    meleeAttack(t.bout, t.A, t.B);
    expect(t.bout.steps[0]).toMatchObject({ outcome: "evade", procs: [{ by: "b0", skill: "light-feet" }] });
  });

  it("every booster shows in most bouts its owner fights (was 0%)", () => {
    const owners = new Map<string, { n: number; shown: number }>();
    for (const { a, b, log } of randomBouts(3000, "boosters", [5, 10, 30])) {
      for (const [s, side] of [[a, "a"], [b, "b"]] as const) {
        for (const p of s.perks) {
          if (!isBooster(p)) continue;
          const e = owners.get(p) ?? { n: 0, shown: 0 };
          e.n += 1;
          if (log.steps.some((x) => procsOf(x).some((q) => q.skill === p && q.by === `${side}0`))) e.shown += 1;
          owners.set(p, e);
        }
      }
    }
    for (const [id, e] of owners) if (e.n >= 50) expect(e.shown / e.n, id).toBeGreaterThan(0.6);
  });
});

describe("the weapon cap and the dead passives", () => {
  it("a kit owns at most 5 weapons, and a full kit is offered no weapon", () => {
    for (let i = 0; i < 200; i++) {
      const seed = fighterSeed(REALM_SALT, `cap-${i}`);
      const picks = walkWith(seed, 29, (c) => (c.left.kind === "stat" ? "R" : "L"));
      const kit = walk(seed, picks);
      expect(weaponsOf(kit.perks).length).toBeLessThanOrEqual(MAX_WEAPONS);
      const owned: PerkId[] = [kit.startPerk, kit.startSkill];
      for (const n of kit.nodes) {
        for (const c of [n.left, n.right]) {
          if (c.kind === "perk" && weaponsOf(owned).length >= MAX_WEAPONS) expect(perkKind(c.perk)).not.toBe("weapon");
        }
        const card = n.taken === "L" ? n.left : n.right;
        if (card.kind === "perk") owned.push(card.perk);
      }
    }
  });

  it("the weapon share of a perk card falls with the weapons owned: 44, 44, 44, 30, 15, then none", () => {
    expect(WEAPON_SHARE).toEqual([44, 44, 44, 30, 15]);
    expect(weaponShare(["pipe", "bat", "broom", "padding"])).toBe(30);
    expect(weaponShare(["pipe", "bat", "broom", "machete", "shovel"])).toBe(0);
    const rng = makeRng(5);
    for (let i = 0; i < 2000; i++) expect(perkKind(rollPerk(rng, 0))).not.toBe("weapon");
    // A share of 15 gives 15 weapons in 71 rolls (the other shares stay 46, 6 and 4).
    let weapons = 0;
    const N = 71_000;
    for (let i = 0; i < N; i++) if (perkKind(rollPerk(rng, 15)) === "weapon") weapons += 1;
    expect(Math.abs(weapons - 15_000)).toBeLessThan(4 * Math.sqrt(N * (15 / 71) * (56 / 71)));
  });

  it("Bare Knuckle is not offered to a kit with 3 weapons or more", () => {
    expect(BARE_KNUCKLE_MAX_WEAPONS).toBe(3);
    expect(fits("bare-knuckle", ["pipe", "bat"])).toBe(true);
    expect(fits("bare-knuckle", ["pipe", "bat", "broom"])).toBe(false);
  });

  it("Snatch has weight 10 and one use (it won 75% of level-2 bouts)", () => {
    expect(SKILLS["snatch"].move).toEqual({ weight: 10, uses: 1 });
  });

  it("Junk Collector throws a used weapon as often as Pitcher while a weapon waits in the bag", () => {
    const t = setup(snap(["junk-collector", "pipe", "bat"]), snap([]));
    expect(throwChance(t.A, true)).toBe(sk("junk-collector", "throwChance"));
    expect(sk("junk-collector", "throwChance")).toBe(sk("pitcher", "throwChance"));
    expect(throwChance(t.A, false)).toBe(THROW_LAST_PCT);
  });

  it("Firm Grip holds on 80% of the time", () => {
    expect(sk("firm-grip", "resist")).toBe(80);
  });
});

describe("the perk card is not the losing card", () => {
  it("a perk card of the first three level-ups carries +1 point in a stat, and the kit gets it", () => {
    expect(PERK_PLUS_MAX_LEVEL).toBe(4);
    for (let i = 0; i < 200; i++) {
      const seed = fighterSeed(REALM_SALT, `plus-${i}`);
      const picks = walkWith(seed, 6, (c) => (c.left.kind === "stat" ? "R" : "L"));
      const kit = walk(seed, picks);
      let plus = 0;
      for (const n of kit.nodes) {
        const card = n.taken === "L" ? n.left : n.right;
        if (card.kind !== "perk") continue;
        expect(card.plus !== undefined, `level ${n.level}`).toBe(n.level <= PERK_PLUS_MAX_LEVEL);
        if (card.plus !== undefined) plus += 1;
      }
      const boosters = kit.perks.reduce((a, p) => a + (isBooster(p)
        ? (["health", "strength", "agility", "speed"] as const).reduce((b, k) => b + sk(p as SkillId, k), 0) : 0), 0);
      const splits = kit.nodes.filter((n) => (n.taken === "L" ? n.left : n.right).kind === "split").length;
      expect(Object.values(kit.stats.points).reduce((a, b) => a + b, 0)).toBe(14 + plus + boosters + 2 * splits);
    }
  });

  it("a player who always takes the perk card wins 43 to 57% against the level-10 and level-30 pools", () => {
    for (const level of [10, 30]) {
      let w = 0;
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const seed = combineSeed("round2", "policy", i);
        const rng = makeRng(combineSeed(seed, level));
        const picks = walkWith(seed, level - 1, (c) => (c.left.kind === "stat" ? "R" : "L"));
        const kit = walk(seed, picks);
        const me = { ...rivalSnapshot(REALM_SALT, 1, 0), id: `policy:${i}`, level, stats: kit.stats, perks: kit.perks };
        for (let j = 0; j < 4; j++) {
          const foe = rivalSnapshot(REALM_SALT, level, rng.int(1_000_000));
          const mine = j % 2 === 0 ? "a" : "b";
          const log = mine === "a" ? simulateFight(rng.int(2 ** 31), me, foe, 1) : simulateFight(rng.int(2 ** 31), foe, me, 1);
          if (log.result.winner === mine) w += 1;
          n += 1;
        }
      }
      expect((100 * w) / n, `level ${level}`).toBeGreaterThanOrEqual(43);
      expect((100 * w) / n, `level ${level}`).toBeLessThanOrEqual(57);
    }
  });
});

describe("a starting skill can show at level 1", () => {
  it("is never Quick Swap or Firm Grip (a level-1 kit has one weapon and meets few disarms)", () => {
    for (let i = 0; i < 3000; i++) {
      const seed = fighterSeed(REALM_SALT, randomName(i));
      const second = startSkill(seed, startPerk(seed));
      expect(second).not.toBe("quick-swap");
      expect(second).not.toBe("firm-grip");
    }
  });
});
