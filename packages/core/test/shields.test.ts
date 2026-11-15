/**
 * Content v2 (plan 13.8): one test per shield id and one per new pet, named by the id. A shield
 * on the back arm adds its numbers exactly while it is carried, blocks with a proc that names it,
 * is knocked off by a swing at its own knock rate or always by a slam, and then lands on the
 * floor; at most one shield is ever owned. Each new pet keeps the role its table promises.
 */
import { describe, expect, it } from "vitest";
import type { CompanionId, ShieldId } from "../src/contracts/ids";
import { SHIELD_IDS, SHIELD_META, checkLog, isShieldId } from "../src/index";
import { SHIELDS } from "../src/content/shields";
import { COMPANIONS, companionScale } from "../src/content/companions";
import { WEAPONS } from "../src/content/weapons";
import { CAP, combatValues, valuesOf } from "../src/sim/combatant";
import { knockChance } from "../src/sim/bout";
import { bodyTempo, turnBase } from "../src/sim/clock";
import { blockChance, damageMult, meleeAttack } from "../src/sim/melee";
import { playMove } from "../src/sim/moves";
import { simulateFight } from "../src/sim/simulate";
import { allowed } from "../src/progress/perks";
import { makeRng } from "../src/prng";
import { fn, queue, scripted, setup, snap } from "./helpers";

function shieldCheck(id: ShieldId): void {
  const n = SHIELDS[id].tiers[0];
  expect(SHIELDS[id].rarity).toBe(SHIELD_META[id].rarity);

  // Numbers add while carried, and only then.
  const bare = combatValues(new Set(), "pipe", null);
  const on = combatValues(new Set(), "pipe", id);
  expect(on.block - bare.block).toBe(n.block);
  expect(on.armor - bare.armor).toBe(n.armor);
  expect(on.riposte - bare.riposte).toBe(n.riposte);
  for (const k of ["evade", "aim", "pierce", "intercept", "combo", "disarm", "crit"] as const) expect(on[k], k).toBe(bare[k]);

  // The snapshot carries it into the bout: the damage cost and the time cost.
  const t = setup(snap([id, "pipe"]), snap(["pipe"], { id: "b" }));
  const plain = setup(snap(["pipe"]), snap(["pipe"], { id: "b" }));
  expect(t.A.shield).toBe(id);
  t.A.held = "pipe"; plain.A.held = "pipe";
  expect(damageMult(t.A, false, false) - damageMult(plain.A, false, false)).toBe(n.damage);
  const tempo = WEAPONS.pipe.tiers[0].tempo;
  expect(turnBase(t.A, "pipe")).toBe(Math.floor((Math.floor((tempo * (100 + n.tempo)) / 100) * bodyTempo(t.A.spd)) / 100));

  // Against a throw the block is halved, then its thrown block is added.
  t.B.held = "darts";
  const full = Math.min(Math.max(valuesOf(t.A).block - valuesOf(t.B).pierce, 0), CAP.block);
  expect(blockChance(t.B, t.A, 0, true)).toBe(Math.min(Math.floor(full / 2) + n.thrownBlock, CAP.block));

  // A block made while it is carried names it in a proc.
  const blk = setup(snap(["pipe"], { id: "b" }), snap([id]), scripted({ hit: queue([99, 99, 0, 99, 99, 99]), disarm: fn((m) => m - 1) }));
  meleeAttack(blk.bout, blk.A, blk.B);
  const sw = blk.bout.steps.find((s) => s.t === "attack");
  expect(sw).toMatchObject({ outcome: "block", procs: [{ by: "b0", skill: id }] });

  // A swing that is not evaded knocks it off at its knock percent of the attacker's Disarm.
  const k = setup(snap(["monkey-wrench"]), snap([id]));
  k.A.held = "monkey-wrench";
  const want = Math.floor((Math.min(valuesOf(k.A).disarm, CAP.disarm) * n.knock) / 100);
  expect(knockChance(k.A, id)).toBe(want);
  for (const [r, off] of [[want - 1, true], [want, false]] as const) {
    if (want <= 0 && off) continue;
    const s = setup(snap(["monkey-wrench"]), snap([id]), scripted({ hit: queue([99, 99, 0, 99, 99, 99]), disarm: queue([r]) }));
    s.A.held = "monkey-wrench";
    meleeAttack(s.bout, s.A, s.B);
    const offStep = s.bout.steps.find((x) => x.t === "shieldOff");
    expect(offStep !== undefined, `${id} roll ${r}`).toBe(off);
    if (offStep !== undefined) expect(offStep).toMatchObject({ shield: id, cause: "hit", target: "b0" });
    expect(s.B.shield).toBe(off ? null : id);
  }

  // A Body Slam always knocks it off, and it lands on the floor of a real log.
  const slam = setup(snap(["body-slam"]), snap([id]), scripted({ damage: queue([0]) }));
  playMove(slam.bout, slam.A, "body-slam");
  expect(slam.bout.steps.map((x) => x.t)).toEqual(["move", "shieldOff"]);
  expect(slam.B.shield).toBeNull();

  // Only one shield: a second one is never allowed, whichever it is.
  const rng = makeRng(1);
  expect(allowed(id, [], rng)).toBe(true);
  for (const other of SHIELD_IDS) expect(allowed(id, [other], rng), `${id} after ${other}`).toBe(false);
}

describe("every shield does what its table says (one test per id)", () => {
  for (const id of SHIELD_IDS) it(`${id}`, () => shieldCheck(id));

  it("the roles hold: the riot shield blocks most, the ironing board best against a throw, the pallet costs time", () => {
    const max = (k: "block" | "thrownBlock" | "riposte" | "tempo"): ShieldId =>
      [...SHIELD_IDS].sort((x, y) => SHIELDS[y].tiers[0][k] - SHIELDS[x].tiers[0][k])[0]!;
    expect(max("block")).toBe("riot-shield");
    expect(max("thrownBlock")).toBe("ironing-board");
    expect(max("riposte")).toBe("skateboard");
    expect(max("tempo")).toBe("wooden-pallet");
    expect(SHIELDS["skateboard"].tiers[0].block).toBe(Math.min(...SHIELD_IDS.map((x) => SHIELDS[x].tiers[0].block)));
    for (const id of SHIELD_IDS) {
      const n = SHIELDS[id].tiers[0];
      expect(n.block, id).toBeGreaterThan(0);
      expect(n.damage < 0 || n.tempo > 0 || n.knock >= 40, `${id} has a cost`).toBe(true);
    }
  });

  it("a real bout with shields on both sides is a well-formed log", () => {
    let offs = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const log = simulateFight(seed, snap(["riot-shield", "monkey-wrench"], { id: "a" }), snap(["car-door", "pipe", "body-slam"], { id: "b" }), 1);
      expect(checkLog(log), `seed ${seed}`).toEqual([]);
      expect(log.init.shield).toEqual({ a: "riot-shield", b: "car-door" });
      offs += log.steps.filter((s) => s.t === "shieldOff").length;
    }
    expect(offs).toBeGreaterThan(0);
    expect(isShieldId("car-door")).toBe(true);
  });
});

function petOf(perks: Parameters<typeof snap>[0], id: CompanionId) {
  const t = setup(snap(perks), snap([], { id: "b" }), scripted({ hit: fn(() => 0) }));
  return { t, pet: t.bout.actors.find((x) => x.kind === id)! };
}

describe("every new pet keeps its role (one test per id)", () => {
  it("stray-dog", () => {
    const d = COMPANIONS["stray-dog"];
    const { pet } = petOf(["stray-dog"], "stray-dog");
    expect(pet.maxHp).toBe(companionScale(d.hp, 10));
    expect(valuesOf(pet).disarm).toBe(d.disarm);
    // The all-rounder that grabs a weapon now and then, and never shares a side with the cat.
    expect(d.excludes).toEqual(["alley-cat"]);
    expect(d.swings).toBe(1);
    expect(d.flies).toBe(false);
    expect(allowed("stray-dog", ["alley-cat"], makeRng(1))).toBe(false);
  });

  it("crow", () => {
    const c = COMPANIONS.crow;
    expect(c.flies).toBe(true);
    expect(c.evade).toBe(Math.max(...Object.values(COMPANIONS).map((x) => x.evade)));
    // A scrapper with a long weapon and every roll at 0 still never hits it first or back.
    const t = setup(snap(["crow"]), snap(["broom", "payback"], { id: "b" }), scripted({ hit: fn(() => 0) }));
    t.B.held = "broom";
    const crow = t.bout.actors.find((x) => x.kind === "crow")!;
    meleeAttack(t.bout, crow, t.B);
    expect(t.bout.steps.some((s) => s.t === "intercept" || s.t === "riposte")).toBe(false);
    // The same attack by a Raccoon is intercepted.
    const r = setup(snap(["raccoon"]), snap(["broom"], { id: "b" }), scripted({ hit: fn(() => 0) }));
    r.B.held = "broom";
    meleeAttack(r.bout, r.bout.actors.find((x) => x.kind === "raccoon")!, r.B);
    expect(r.bout.steps[0]!.t).toBe("intercept");
  });

  it("alley-cat", () => {
    const c = COMPANIONS["alley-cat"];
    expect(c.swings).toBe(2);
    // Every combo roll fails (99) and nothing is evaded or blocked: still two scratches.
    const t = setup(snap(["alley-cat"]), snap([], { id: "b" }), scripted({ hit: queue([99, 99, 99, 99, 99, 99, 99, 99, 99, 99]) }));
    const cat = t.bout.actors.find((x) => x.kind === "alley-cat")!;
    meleeAttack(t.bout, cat, t.B);
    const swings = t.bout.steps.filter((s) => s.t === "attack");
    expect(swings.map((s) => (s.t === "attack" ? `${s.n}:${s.why ?? "-"}` : ""))).toEqual(["0:-", "1:combo"]);
    // A Raccoon with the same rolls scratches once.
    const r = setup(snap(["raccoon"]), snap([], { id: "b" }), scripted({ hit: queue([99, 99, 99, 99, 99, 99, 99]) }));
    meleeAttack(r.bout, r.bout.actors.find((x) => x.kind === "raccoon")!, r.B);
    expect(r.bout.steps.filter((s) => s.t === "attack")).toHaveLength(1);
  });

  it("a scrapper owns three pets at most", () => {
    const rng = makeRng(2);
    expect(allowed("crow", ["raccoon", "raccoon", "goose"], rng)).toBe(false);
    expect(allowed("crow", ["raccoon", "raccoon"], rng)).toBe(true);
  });
});
