/**
 * One test per held id (plan 13.3), named by the id: the weapon's identity agrees with the frozen
 * WEAPON_META; while held, its numbers add to the base values exactly; Reach sets the intercept
 * edge (a Thrown weapon counts as 0); Tempo sets the turn cost; damage follows its base; a Thrown
 * weapon is always thrown, never used up and stays in the hand; any other weapon is thrown only on
 * the 5% roll and is then gone.
 */
import { describe, expect, it } from "vitest";
import type { HeldId, WeaponId } from "../src/contracts/ids";
import { WEAPON_IDS } from "../src/contracts/ids";
import { WEAPON_META } from "../src/contracts/content";
import { WEAPONS, reachOf } from "../src/content/weapons";
import { BASE, CAP, combatValues } from "../src/sim/combatant";
import { bodyTempo, turnBase } from "../src/sim/clock";
import { blockChance, interceptChance, rawDamage } from "../src/sim/melee";
import { takeTurn } from "../src/sim/turn";
import { fn, queue, scripted, setup, snap } from "./helpers";

const HELD: readonly HeldId[] = ["fists", ...WEAPON_IDS];

function check(id: HeldId): void {
  const def = WEAPONS[id];
  const meta = WEAPON_META[id];
  const w = def.tiers[0];
  // Identity: one copy, from the frozen contract.
  expect(def.id).toBe(id);
  expect(def.rarity).toBe(meta.rarity);
  expect(def.tags).toEqual(meta.tags);
  expect(def.clip).toBe(meta.clip);
  const thrown = meta.tags.includes("thrown");
  expect(w.reach).toBe(thrown ? null : meta.reach);
  expect(reachOf(id)).toBe(meta.reach);

  // Numbers add to the base values while held.
  const v = combatValues(new Set(), id, false);
  expect(v.block).toBe(BASE.block + w.block);
  expect(v.disarm).toBe(BASE.disarm + w.disarm);
  expect(v.evade).toBe(BASE.evade + w.evade);
  expect(v.aim).toBe(BASE.aim + w.aim);
  expect(v.pierce).toBe(BASE.pierce + w.pierce);
  expect(v.riposte).toBe(BASE.riposte + w.riposte);
  expect(v.combo).toBe(BASE.combo + w.combo);
  expect(v.crit).toBe(BASE.crit + w.crit);
  expect(v.intercept).toBe(BASE.intercept);
  expect(v.armor).toBe(BASE.armor);

  // Reach: a defender holding it intercepts a bare-handed attacker with 8 per point of Reach.
  const t = setup(snap([]), snap(id === "fists" ? [] : [id as WeaponId]));
  t.B.held = id;
  expect(interceptChance(t.A, t.B, 0)).toBe(Math.min(8 * (thrown ? 0 : meta.reach), CAP.intercept));

  // Tempo: the turn cost.
  t.A.held = id;
  expect(turnBase(t.A, id)).toBe(Math.floor((w.tempo * bodyTempo(t.A.spd)) / 100));

  // Damage: the melee and thrown formulas read its base damage.
  expect(rawDamage(t.A, false)).toBe(w.dmg + Math.floor((t.A.str * (w.dmg + 4)) / 12));
  expect(rawDamage(t.A, true)).toBe(w.dmg + Math.floor(((t.A.str + 2 * t.A.agi) * (w.dmg + 4)) / 36));

  if (id === "fists") return;
  const weapon = id as WeaponId;

  if (thrown) {
    // Always thrown, after "held", the bag unchanged: endless ammunition.
    const s = setup(snap([weapon]), snap([]));
    s.A.held = weapon;
    s.bout.bag.a = [];
    takeTurn(s.bout, s.A);
    const throws = s.bout.steps.filter((x) => x.t === "throw");
    expect(throws.length).toBeGreaterThan(0);
    for (const x of throws) if (x.t === "throw") { expect(x.after).toBe("held"); expect(x.bagAfter).toEqual([]); }
    expect(s.bout.steps.some((x) => x.t === "attack")).toBe(false);
    expect(s.A.held).toBe(weapon);
    // No intercept and no riposte against a throw.
    expect(s.bout.steps.some((x) => x.t === "intercept" || x.t === "riposte")).toBe(false);
  } else {
    // Thrown only on the 5% roll, then gone; otherwise a melee swing.
    for (const [r, throws] of [[4, true], [5, false]] as const) {
      const s = setup(snap([weapon]), snap([]), scripted({ throw: queue([r]) }));
      s.A.held = weapon;
      s.bout.bag.a = [];
      takeTurn(s.bout, s.A);
      const tw = s.bout.steps.find((x) => x.t === "throw");
      expect(tw !== undefined).toBe(throws);
      if (tw !== undefined && tw.t === "throw") expect(tw.after).toBe("gone");
      expect(s.A.held).toBe(throws ? "fists" : weapon);
      expect(s.bout.steps.some((x) => x.t === "attack")).toBe(!throws);
    }
    // With Pitcher it goes back in the bag.
    const p = setup(snap([weapon, "pitcher"]), snap([]), scripted({ throw: queue([0]) }));
    p.A.held = weapon;
    p.bout.bag.a = [];
    takeTurn(p.bout, p.A);
    const tw = p.bout.steps.find((x) => x.t === "throw");
    expect(tw !== undefined && tw.t === "throw" && tw.after === "bag").toBe(true);
    expect(p.bout.bag.a).toEqual([{ k: "weapon", id: weapon }]);
  }

  // Disarm: a landed hit knocks a held weapon away on a roll under the attacker's Disarm.
  const chance = Math.min(BASE.disarm + w.disarm, CAP.disarm);
  for (const [r, off] of [[chance - 1, true], [chance, false]] as const) {
    if (chance <= 0 && off) continue;
    const d = setup(snap([weapon]), snap(["pipe"]), scripted({ disarm: queue([r]), throw: fn(() => 99) }));
    d.A.held = weapon;
    d.B.held = "pipe";
    d.bout.bag.a = [];
    takeTurn(d.bout, d.A);
    const hit = d.bout.steps.find((x) => (x.t === "attack" || x.t === "throw") && x.outcome === "hit");
    if (hit === undefined) continue;
    expect(d.bout.steps.some((x) => x.t === "disarm")).toBe(off);
  }
}

/** Role rules the weapon table promises, by id. */
const ROLE: Partial<Record<HeldId, () => void>> = {
  // Block-breakers: no block a defender can reach stops them.
  "pickaxe": () => blockProof("pickaxe"),
  "ball-and-chain": () => blockProof("ball-and-chain"),
  // Disarmers: the two highest Disarm values among the weapons.
  "monkey-wrench": () => expect(topDisarm()).toContain("monkey-wrench"),
  "screwdrivers": () => expect(topDisarm()).toContain("screwdrivers"),
  // Parry tools: the two highest Block and Riposte totals that are not Thrown.
  "bin-lid": () => expect(WEAPONS["bin-lid"].tiers[0].block).toBe(Math.max(...WEAPON_IDS.map((x) => WEAPONS[x].tiers[0].block))),
  "broom": () => expect(WEAPONS.broom.tiers[0].block + WEAPONS.broom.tiers[0].riposte).toBeGreaterThanOrEqual(40),
  // Reach weapons hold Reach 3 or 4.
  "pitchfork": () => expect(reachOf("pitchfork")).toBeGreaterThanOrEqual(3),
  "bike-chain": () => expect(reachOf("bike-chain")).toBeGreaterThanOrEqual(3),
  "stop-sign": () => expect(reachOf("stop-sign")).toBeGreaterThanOrEqual(3),
  "pool-cue": () => expect(reachOf("pool-cue")).toBeGreaterThanOrEqual(3),
  // Evasion weapon: the highest Evade.
  "umbrella": () => expect(WEAPONS.umbrella.tiers[0].evade).toBe(Math.max(...WEAPON_IDS.map((x) => WEAPONS[x].tiers[0].evade))),
};

function blockProof(id: WeaponId): void {
  const s = setup(snap([id]), snap(["bin-lid", "parry", "car-door"]));
  s.A.held = id;
  s.B.held = "bin-lid";
  expect(blockChance(s.A, s.B, 0, false)).toBe(0);
}
function topDisarm(): string[] {
  return [...WEAPON_IDS].sort((x, y) => WEAPONS[y].tiers[0].disarm - WEAPONS[x].tiers[0].disarm).slice(0, 2);
}

describe("every weapon is used by its own rules (one test per id)", () => {
  for (const id of HELD) {
    it(`${id}`, () => {
      check(id);
      ROLE[id]?.();
    });
  }
});

describe("weapon table", () => {
  it("counts 5 Common, 8 Uncommon, 8 Rare, 5 Epic, 2 Mythic", () => {
    const n: Record<string, number> = {};
    for (const id of WEAPON_IDS) n[WEAPONS[id].rarity!] = (n[WEAPONS[id].rarity!] ?? 0) + 1;
    expect(n).toEqual({ common: 5, uncommon: 8, rare: 8, epic: 5, mythic: 2 });
  });
  it("has 29 rows: the 28 weapons and fists", () => {
    expect(Object.keys(WEAPONS).sort()).toEqual([...HELD].sort());
  });
  it("matches spot values of the rules (rows the balance pass did not move)", () => {
    expect(WEAPONS.fists.tiers[0]).toEqual({ tempo: 100, dmg: 5, reach: 0, draw: 0, aim: 0, pierce: 0, block: 0,
      evade: 0, riposte: 0, combo: 0, disarm: 0, crit: 0 });
    expect(WEAPONS["pocket-knife"].tiers[0]).toEqual({ tempo: 65, dmg: 6, reach: 0, draw: 5, aim: 25, pierce: 0,
      block: 0, evade: 5, riposte: 0, combo: 35, disarm: 0, crit: 10 });
    expect(WEAPONS.pitchfork.tiers[0]).toEqual({ tempo: 130, dmg: 13, reach: 3, draw: 3, aim: 0, pierce: 0,
      block: 5, evade: 0, riposte: 0, combo: 0, disarm: 5, crit: 10 });
    expect(WEAPONS.darts.tiers[0]).toMatchObject({ tempo: 45, dmg: 3, reach: null, combo: 30 });
  });
});
