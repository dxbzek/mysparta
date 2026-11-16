/**
 * One test per skill id (plan 13.4). Each compares a scrapper with the skill and without it: the
 * number or rule the card names changes by exactly the amount in SKILLS[id].tiers[0], and every
 * other number in the profile stays the same. Moves and rule skills also play their effect with
 * chosen rolls.
 */
import { describe, expect, it } from "vitest";
import type { FighterSnapshot, StatKey } from "../src/contracts/fighter";
import type { HeldId, MoveId, PerkId, SkillId } from "../src/contracts/ids";
import { MOVE_IDS, SKILL_IDS } from "../src/contracts/ids";
import { SKILLS, sk } from "../src/content/skills";
import { WEAPONS } from "../src/content/weapons";
import { applyPerkToStats, draftOf, freeze } from "../src/progress/stats";
import { buildSide, combatValues, valuesOf } from "../src/sim/combatant";
import type { Actor } from "../src/sim/combatant";
import { land } from "../src/sim/bout";
import type { Bout } from "../src/sim/bout";
import { bodyTempo, startOffset, turnBase, weaponTempo } from "../src/sim/clock";
import { damageMult, meleeAttack } from "../src/sim/melee";
import { playMove, rollMove } from "../src/sim/moves";
import { afterThrow, throwAttack, throwChance } from "../src/sim/thrown";
import { drawSlack, swapChance, takeTurn } from "../src/sim/turn";
import { fn, queue, scripted, setup, snap } from "./helpers";

const STATS: readonly StatKey[] = ["health", "strength", "agility", "speed"];
const HELD: readonly HeldId[] = ["fists", "pipe", "machete", "sledgehammer", "darts"];
const DERIVED = ["evade", "block", "aim", "pierce", "intercept", "riposte", "combo", "disarm", "crit", "armor"] as const;
const AFTER = { gone: 0, bag: 1, held: 2 } as const;
const SLEDGE = WEAPONS.sledgehammer.tiers[0].tempo;

/** A level-10 scrapper with no perks, plus the given ones; boosters go into its stats as a pick would. */
function withSkills(perks: PerkId[]): FighterSnapshot {
  const base = snap([]);
  const d = draftOf(base.stats);
  for (const p of perks) applyPerkToStats(d, p);
  return { ...base, stats: freeze(d), perks };
}

/** Every number a skill could change, by name. */
function profile(s: FighterSnapshot): Record<string, number> {
  const side = buildSide("a", s);
  const a = side.actors[0]!;
  const out: Record<string, number> = {};
  // A bout whose throw rolls all pass, for the rule of what a thrown weapon does next.
  const bout: Bout = { r: scripted({ throw: fn(() => 0) }), actors: side.actors, bag: { a: side.bag, b: [] }, steps: [], turn: 1, ended: false, shown: new Set(), lastOften: -99, owed: new Set() };
  for (const k of STATS) { out[`points.${k}`] = s.stats.points[k]; out[`mult.${k}`] = s.stats.mult[k]; }
  for (const h of HELD) {
    const v = combatValues(a.skills, h, null);
    for (const k of DERIVED) out[`${h}.${k}`] = v[k];
  }
  const vd = combatValues(a.skills, "fists", "car-door");
  for (const k of DERIVED) out[`fists+shield.${k}`] = vd[k];
  out.shield = side.shield === null ? 0 : 1;
  for (const h of ["fists", "machete", "pipe"] as const) { a.held = h; out[`dmult.${h}`] = damageMult(a, false, false); }
  a.held = "darts";
  out["dmult.thrown"] = damageMult(a, true, false);
  a.held = "fists";
  out.startOffset = startOffset(a);
  out.throwChance = throwChance(a, true);
  out.throwChanceLast = throwChance(a, false);
  out.afterThrowPipe = AFTER[afterThrow(bout, a, "pipe", [])];
  out.drawSlack = drawSlack(a);
  out.swapChance = swapChance(a);
  out["tempo.sledgehammer"] = weaponTempo(a, "sledgehammer");
  out["tempo.pipe"] = weaponTempo(a, "pipe");
  for (const m of MOVE_IDS) {
    const it = side.bag.find((x) => x.k === "move" && x.id === m);
    out[`uses.${m}`] = it !== undefined && it.k === "move" ? it.uses : 0;
  }
  const probe: Actor = { ...a, hp: 5, lastStandUsed: false };
  out.lastStand = land(probe, 10, []);
  // A Raccoon of this scrapper: its HP and its damage multiplier (Pet Lover).
  const pet = buildSide("a", { ...s, perks: [...s.perks, "raccoon"] }).actors.find((x) => !x.scrapper)!;
  out["pet.hp"] = pet.maxHp;
  out["pet.dmult"] = damageMult(pet, false, false);
  return out;
}

/** The profile change the card names. Keys not listed must not change. */
function every(key: string, by: number, held: readonly string[] = [...HELD, "fists+shield"]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of held) out[`${h}.${key}`] = by;
  return out;
}
function boosterDiff(id: SkillId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of STATS) {
    if (sk(id, k) !== 0) out[`points.${k}`] = sk(id, k);
    if (sk(id, `${k}Mult`) !== 0) out[`mult.${k}`] = sk(id, `${k}Mult`);
  }
  return out;
}
function moveDiff(id: MoveId): Record<string, number> {
  return { [`uses.${id}`]: SKILLS[id].move!.uses };
}

const EXPECTED: Readonly<Record<SkillId, () => Record<string, number>>> = {
  "big-heart": () => boosterDiff("big-heart"),
  "heavy-hands": () => boosterDiff("heavy-hands"),
  "light-feet": () => boosterDiff("light-feet"),
  "fast-twitch": () => boosterDiff("fast-twitch"),
  "glass-cannon": () => boosterDiff("glass-cannon"),
  "mountain": () => ({ ...boosterDiff("mountain"), startOffset: sk("mountain", "startClock") }),
  "padding": () => every("armor", sk("padding", "armor")),
  "anticipation": () => every("intercept", sk("anticipation", "intercept")),
  "sharpening-stone": () => ({ "dmult.machete": sk("sharpening-stone", "bladeDamage") }),
  "bare-knuckle": () => ({ "dmult.fists": sk("bare-knuckle", "fistDamage"), drawSlack: sk("bare-knuckle", "drawSlack") - 6,
    ...every("combo", sk("bare-knuckle", "unarmedCombo"), ["fists", "fists+shield"]) }),
  "payback": () => every("riposte", sk("payback", "riposte")),
  "flurry": () => every("combo", sk("flurry", "combo")),
  "firm-grip": () => ({ swapChance: sk("firm-grip", "swapChance") - 30 }),
  "head-start": () => ({ startOffset: sk("head-start", "startClock") }),
  "sharp-eye": () => ({ ...every("aim", sk("sharp-eye", "aim")), ...every("pierce", sk("sharp-eye", "pierce")) }),
  "parry": () => every("block", sk("parry", "block")),
  "heavy-lifter": () => ({ "sledgehammer.aim": sk("heavy-lifter", "heavyAim"),
    "tempo.sledgehammer": Math.floor((SLEDGE * (100 + sk("heavy-lifter", "heavyTime"))) / 100) - SLEDGE }),
  "pitcher": () => ({ "dmult.thrown": sk("pitcher", "thrownDamage"), throwChance: sk("pitcher", "throwChance") - 20,
    throwChanceLast: sk("pitcher", "throwChance") - 5, afterThrowPipe: AFTER.bag - AFTER.gone }),
  "plate-vest": () => ({ ...every("armor", sk("plate-vest", "armor")), "mult.speed": sk("plate-vest", "speedMult") }),
  "knock-loose": () => every("disarm", sk("knock-loose", "disarm")),
  "last-stand": () => ({ lastStand: sk("last-stand", "saves") }),
  "stubborn": () => ({}),
  "slippery": () => every("evade", sk("slippery", "evade")),
  "quick-swap": () => ({ drawSlack: sk("quick-swap", "drawSlack") - 6, swapChance: sk("quick-swap", "swapChance") - 30 }),
  "pet-lover": () => {
    const plain = buildSide("a", snap(["raccoon"])).actors[1]!.maxHp;
    return { "pet.hp": Math.floor((plain * (100 + sk("pet-lover", "petHp"))) / 100) - plain,
      "pet.dmult": sk("pet-lover", "petDamage") };
  },
  "junk-collector": () => ({ afterThrowPipe: AFTER.bag - AFTER.gone, throwChance: sk("junk-collector", "throwChance") - 20 }),
  "trick-shot": () => ({}),
  "haymaker": () => moveDiff("haymaker"),
  "energy-drink": () => moveDiff("energy-drink"),
  "tarp": () => moveDiff("tarp"),
  "whistle": () => moveDiff("whistle"),
  "firecrackers": () => moveDiff("firecrackers"),
  "snatch": () => moveDiff("snatch"),
  "air-horn": () => moveDiff("air-horn"),
  "body-slam": () => moveDiff("body-slam"),
  "sand-in-the-eyes": () => moveDiff("sand-in-the-eyes"),
  "taunt": () => moveDiff("taunt"),
  "second-wind": () => moveDiff("second-wind"),
  "grapple": () => moveDiff("grapple"),
};

/** Effects a profile cannot hold: each plays the rule with chosen rolls. */
const BEHAVIOUR: Partial<Record<SkillId, () => void>> = {
  "stubborn": () => {
    // Every swing is evaded (hit rolls 0). With Stubborn and its roll passing, one extra swing follows, once.
    const s = setup(withSkills(["stubborn"]), snap([], { id: "b" }), scripted({ hit: fn(() => 0) }));
    s.B.agi = 0; s.A.agi = 0;
    meleeAttack(s.bout, s.A, s.B);
    const swings = s.bout.steps.filter((x) => x.t === "attack");
    expect(swings.filter((x) => x.t === "attack" && x.why === "stubborn")).toHaveLength(1);
    const plain = setup(snap([]), snap([], { id: "b" }), scripted({ hit: fn(() => 0) }));
    meleeAttack(plain.bout, plain.A, plain.B);
    expect(plain.bout.steps.filter((x) => x.t === "attack" && x.why === "stubborn")).toHaveLength(0);
    // Its chance is the table's: a roll of chance - 1 passes, a roll of chance fails.
    const c = sk("stubborn", "chance");
    for (const [r, want] of [[c - 1, 1], [c, 0]] as const) {
      // hit stream: intercept 99 (no), evade 0 (evaded), stubborn r, combo 99, riposte 99
      const t = setup(withSkills(["stubborn"]), snap([], { id: "b" }), scripted({ hit: queue([99, 0, r, 99, 99, 99, 99, 99, 99]) }));
      meleeAttack(t.bout, t.A, t.B);
      expect(t.bout.steps.filter((x) => x.t === "attack" && x.why === "stubborn")).toHaveLength(want);
    }
  },
  "last-stand": () => {
    const a: Actor = { ...setup(withSkills(["last-stand"]), snap([])).A, hp: 5 };
    const procs: never[] = [];
    expect(land(a, 10, procs)).toBe(1);
    expect(land(a, 10, procs)).toBe(0);
  },
  "parry": () => {
    // Every swing is blocked (evade roll 99, block roll 0). The riposte chance after a block is the table's.
    const c = sk("parry", "riposteAfterBlock");
    for (const [r, want] of [[c - 1, 1], [c, 0]] as const) {
      // hit: intercept 99, evade 99, block 0, combo 99, riposte r, then the riposte swing rolls 99s
      const t = setup(snap([], { id: "a" }), withSkills(["parry"]), scripted({ hit: queue([99, 99, 0, 99, r]) }));
      meleeAttack(t.bout, t.A, t.B);
      expect(t.bout.steps.filter((x) => x.t === "riposte")).toHaveLength(want);
    }
  },
  "firm-grip": () => {
    // A landed hit with a disarm roll of 0 knocks the Pipe off unless Firm Grip's roll is below 60.
    const c = sk("firm-grip", "resist");
    for (const [r, resisted] of [[c - 1, true], [c, false]] as const) {
      const t = setup(snap([]), withSkills(["firm-grip", "pipe"]), scripted({ disarm: queue([0, r]) }));
      t.B.held = "pipe";
      meleeAttack(t.bout, t.A, t.B);
      const d = t.bout.steps.find((x) => x.t === "disarm");
      expect(d !== undefined && d.t === "disarm" && d.resisted === true).toBe(resisted);
      expect(t.B.held).toBe(resisted ? "pipe" : "fists");
    }
  },
  "heavy-lifter": () => {
    // A turn with a Heavy weapon costs 30% less time; a turn with a weapon that is not Heavy does not.
    const t = setup(withSkills(["heavy-lifter"]), snap([]));
    const plain = setup(snap([]), snap([]));
    const cut = 100 + sk("heavy-lifter", "heavyTime");
    expect(turnBase(t.A, "sledgehammer")).toBe(Math.floor((Math.floor((SLEDGE * cut) / 100) * bodyTempo(t.A.spd)) / 100));
    expect(turnBase(t.A, "pipe")).toBe(turnBase(plain.A, "pipe"));
  },
  "haymaker": () => {
    // The boosted swing doubles the multiplier and adds the table's Crit.
    const t = setup(withSkills(["haymaker"]), snap([]));
    expect(damageMult(t.A, false, true)).toBe(damageMult(t.A, false, false) * sk("haymaker", "damageMult") / 100);
    const cost = playMove(t.bout, t.A, "haymaker");
    expect(cost).toBe(sk("haymaker", "cost"));
    expect(t.A.haymaker).toBe(true);
    meleeAttack(t.bout, t.A, t.B);
    const sw = t.bout.steps.find((x) => x.t === "attack");
    expect(sw !== undefined && sw.t === "attack" && sw.boosted === true).toBe(true);
    expect(t.A.haymaker).toBe(false);
  },
  "energy-drink": () => {
    for (const [r, pct] of [[0, sk("energy-drink", "healMin")], [99, sk("energy-drink", "healMax")]] as const) {
      const t = setup(withSkills(["energy-drink"]), snap([]), scripted({ move: queue([r]) }));
      t.A.hp = 10;
      const cost = playMove(t.bout, t.A, "energy-drink");
      expect(t.A.hp - 10).toBe(Math.floor((t.A.maxHp * pct) / 100));
      expect(cost).toBe(sk("energy-drink", "cost"));
    }
  },
  "tarp": () => {
    const t = setup(withSkills(["tarp"]), snap([]));
    playMove(t.bout, t.A, "tarp");
    expect(t.B.snared).toBe(true);
    for (let i = 1; i < sk("tarp", "skips"); i++) { takeTurn(t.bout, t.B); expect(t.B.snared).toBe(true); }
    takeTurn(t.bout, t.B);
    expect(t.B.snared).toBe(false);
  },
  "whistle": () => {
    const t = setup(withSkills(["whistle", "boar"]), snap([]));
    const pet = t.bout.actors.find((x) => x.id === "a1")!;
    pet.hp = 1;
    t.A.clock = 500;
    pet.clock = 900;
    const cost = playMove(t.bout, t.A, "whistle");
    expect(pet.hp - 1).toBe(Math.floor((pet.maxHp * sk("whistle", "healPct")) / 100));
    expect(pet.clock).toBe(500);
    expect(cost).toBe(sk("whistle", "cost"));
  },
  "firecrackers": () => {
    const t = setup(withSkills(["firecrackers"]), snap(["raccoon"]), scripted({ damage: queue([0]) }));
    const pet = t.bout.actors.find((x) => x.id === "b1")!;
    const hp0 = t.B.hp;
    playMove(t.bout, t.A, "firecrackers");
    expect(hp0 - t.B.hp).toBe(sk("firecrackers", "damageMin"));
    expect(pet.maxHp - pet.hp).toBe(Math.floor((pet.maxHp * sk("firecrackers", "companionPct")) / 100));
  },
  "snatch": () => {
    const t = setup(withSkills(["snatch"]), snap(["pipe"]));
    t.B.held = "pipe";
    expect(playMove(t.bout, t.A, "snatch")).toBe(sk("snatch", "cost"));
    expect(t.A.held).toBe("pipe");
    expect(t.B.held).toBe("fists");
  },
  "air-horn": () => {
    const c = sk("air-horn", "fleeChance");
    const t = setup(withSkills(["air-horn"]), snap(["raccoon", "raccoon"]), scripted({ move: queue([c - 1, c]) }));
    const clock = t.B.clock;
    playMove(t.bout, t.A, "air-horn");
    expect(t.bout.steps.filter((x) => x.t === "flee")).toHaveLength(1);
    expect(t.B.clock - clock).toBe(sk("air-horn", "clockPush"));
  },
  "quick-swap": () => {
    // The empty-hand draw rolls out of S + slack: S + 2 with Quick Swap, S + 6 without.
    for (const [perks, slack] of [[["quick-swap", "pipe"], sk("quick-swap", "drawSlack")], [["pipe"], 6]] as const) {
      const seen: number[] = [];
      const t = setup(withSkills([...perks]), snap([]), scripted({ draw: fn((n) => { seen.push(n); return n - 1; }) }));
      takeTurn(t.bout, t.A);
      expect(seen[0]).toBe(WEAPONS.pipe.tiers[0].draw + slack);
    }
  },
  "junk-collector": () => {
    // A thrown Pipe goes back in the bag when the roll is under the table's chance, with a proc.
    const c = sk("junk-collector", "returnChance");
    for (const [r, want] of [[c - 1, "bag"], [c, "gone"]] as const) {
      const t = setup(withSkills(["junk-collector"]), snap([]), scripted({ throw: queue([r]) }));
      const procs: { by: string; skill: string }[] = [];
      expect(afterThrow(t.bout, t.A, "pipe", procs as never[])).toBe(want);
      expect(procs.map((p) => p.skill)).toEqual(want === "bag" ? ["junk-collector"] : []);
    }
  },
  "trick-shot": () => {
    // A landed dart ricochets once to a living enemy when the throw roll is under the chance.
    const c = sk("trick-shot", "ricochet");
    for (const [r, throws] of [[c - 1, 2], [c, 1]] as const) {
      const t = setup(withSkills(["trick-shot", "darts"]), snap(["raccoon"]), scripted({ throw: queue([r]) }));
      t.A.held = "darts";
      throwAttack(t.bout, t.A, t.B);
      const steps = t.bout.steps.filter((x) => x.t === "throw");
      expect(steps).toHaveLength(throws);
      if (throws === 2) expect(steps[1]).toMatchObject({ n: 1, why: "combo", procs: [{ by: "a0", skill: "trick-shot" }] });
    }
  },
  "sand-in-the-eyes": () => {
    const t = setup(withSkills(["sand-in-the-eyes"]), snap([]));
    const aim = valuesOf(t.B).aim;
    const cost = playMove(t.bout, t.A, "sand-in-the-eyes");
    expect(aim - valuesOf(t.B).aim).toBe(sk("sand-in-the-eyes", "aimLoss"));
    expect(cost).toBe(Math.floor((turnBase(t.A, "fists") * sk("sand-in-the-eyes", "costPct")) / 100));
    expect(t.bout.steps[0]).toMatchObject({ t: "move", move: "sand-in-the-eyes", target: "b0" });
    expect(rollMove(t.bout, t.A)).toBeNull();                      // a second dose never comes
  },
  "taunt": () => {
    const t = setup(withSkills(["taunt"]), snap([]));
    const ripo = valuesOf(t.A).riposte;
    expect(playMove(t.bout, t.A, "taunt")).toBe(sk("taunt", "cost"));
    expect(valuesOf(t.A).riposte - ripo).toBe(sk("taunt", "riposte"));
    takeTurn(t.bout, t.A);                                         // the free action that follows keeps it
    expect(valuesOf(t.A).riposte - ripo).toBe(sk("taunt", "riposte"));
    takeTurn(t.bout, t.A);                                         // the own turn after that ends it
    expect(valuesOf(t.A).riposte).toBe(ripo);
  },
  "second-wind": () => {
    const t = setup(withSkills(["second-wind"]), snap([]));
    t.A.hp = 1;
    expect(playMove(t.bout, t.A, "second-wind")).toBe(sk("second-wind", "cost"));
    expect(t.A.hp - 1).toBe(Math.floor((t.A.maxHp * sk("second-wind", "healPct")) / 100));
    expect(t.bout.steps.map((x) => x.t)).toEqual(["move", "heal"]);
  },
  "grapple": () => {
    const t = setup(withSkills(["grapple"]), snap([]), scripted({ damage: queue([15]) }));
    const hp0 = t.B.hp;
    playMove(t.bout, t.A, "grapple");
    expect(hp0 - t.B.hp).toBe(sk("grapple", "base") + sk("grapple", "perStrength") * t.A.str);
    expect(t.bout.steps.map((x) => x.t)).toEqual(["move", "snare"]);
    expect(t.B.snared).toBe(true);
    for (let i = 1; i < sk("grapple", "holds"); i++) { takeTurn(t.bout, t.B); expect(t.B.snared).toBe(true); }
    takeTurn(t.bout, t.B);                                         // the hold lasts its table's turns
    expect(t.B.snared).toBe(false);
  },
  "body-slam": () => {
    const t = setup(withSkills(["body-slam"]), snap(["pipe"]), scripted({ damage: queue([15]) }));
    t.B.held = "pipe";
    const hp0 = t.B.hp;
    playMove(t.bout, t.A, "body-slam");
    expect(hp0 - t.B.hp).toBe(sk("body-slam", "base") + sk("body-slam", "perStrength") * t.A.str);
    expect(t.B.held).toBe("fists");
    expect(t.bout.steps.map((x) => x.t)).toEqual(["move", "disarm"]);
  },
};

/** The Move roll uses each Move's table weight: W / (W + 12), picked by weight. */
function moveWeightCheck(id: MoveId): void {
  const w = SKILLS[id].move!.weight;
  for (const [r, fires] of [[w - 1, true], [w, false]] as const) {
    const t = setup(withSkills([id, ...(id === "whistle" ? ["boar" as PerkId] : [])]), snap(["raccoon", "pipe"]),
      scripted({ move: queue([r]) }));
    if (id === "energy-drink" || id === "second-wind") t.A.hp = 1;
    if (id === "whistle") t.bout.actors.find((x) => x.id === "a1")!.hp = 1;
    if (id === "snatch") t.B.held = "pipe";
    expect(rollMove(t.bout, t.A)).toBe(fires ? id : null);
  }
}

describe("every skill does exactly what its card says (one test per id)", () => {
  const base = profile(withSkills([]));
  for (const id of SKILL_IDS) {
    it(`${id}`, () => {
      const got = profile(withSkills([id]));
      const want = EXPECTED[id]();
      const diff: Record<string, number> = {};
      for (const k of Object.keys(base)) {
        const d = got[k]! - base[k]!;
        if (d !== 0) diff[k] = d;
      }
      expect(diff).toEqual(want);
      BEHAVIOUR[id]?.();
      if ((MOVE_IDS as readonly string[]).includes(id)) moveWeightCheck(id as MoveId);
    });
  }
});
