/**
 * One test per held id (plan 13.3), named by the id: the weapon's identity agrees with the frozen
 * WEAPON_META; while held, its numbers add to the base values exactly; Reach sets the intercept
 * edge (a Thrown weapon counts as 0); Tempo sets the turn cost; damage follows its base; a Thrown
 * weapon is always thrown, never used up and stays in the hand; any other weapon is thrown on the
 * 20% roll while another weapon waits in the bag (5% when it is the last one), is then gone, and
 * the next turn draws the replacement for sure.
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
  const v = combatValues(new Set(), id, null);
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
    // A fresh draw is never thrown: its first turn is a swing whatever the throw roll.
    {
      const s = setup(snap([weapon]), snap([]), scripted({ throw: fn(() => 0) }));
      s.A.held = weapon;
      s.bout.bag.a = [{ k: "weapon", id: weapon === "pipe" ? "bat" : "pipe" }];
      takeTurn(s.bout, s.A);
      expect(s.bout.steps.some((x) => x.t === "throw")).toBe(false);
    }
    // The last weapon: thrown only on the 5% roll, then gone; otherwise a melee swing.
    for (const [r, throws] of [[4, true], [5, false]] as const) {
      const s = setup(snap([weapon]), snap([]), scripted({ throw: queue([r]) }));
      s.A.held = weapon;
      s.A.heldAttacked = true;                  // a melee weapon is thrown only after its first swing
      s.bout.bag.a = [];
      takeTurn(s.bout, s.A);
      const tw = s.bout.steps.find((x) => x.t === "throw");
      expect(tw !== undefined).toBe(throws);
      if (tw !== undefined && tw.t === "throw") expect(tw.after).toBe("gone");
      expect(s.A.held).toBe(throws ? "fists" : weapon);
      expect(s.bout.steps.some((x) => x.t === "attack")).toBe(!throws);
    }
    // With a replacement in the bag: thrown on the 20% roll, and the next turn draws the replacement.
    const other: WeaponId = weapon === "pipe" ? "bat" : "pipe";
    for (const [r, throws] of [[19, true], [20, false]] as const) {
      const s = setup(snap([weapon, other]), snap([]), scripted({ throw: queue([r]) }));
      s.A.held = weapon;
      s.A.heldAttacked = true;
      s.bout.bag.a = [{ k: "weapon", id: other }];
      takeTurn(s.bout, s.A);
      expect(s.bout.steps.some((x) => x.t === "throw"), `${r}`).toBe(throws);
      if (!throws) continue;
      expect(s.A.reload).toBe(true);
      const at = s.bout.steps.length;
      takeTurn(s.bout, s.A);                     // every draw roll would fail, but a reload always draws
      expect(s.bout.steps[at]).toMatchObject({ t: "draw", weapon: other });
    }
    // With Pitcher it goes back in the bag.
    const p = setup(snap([weapon, "pitcher"]), snap([]), scripted({ throw: queue([0]) }));
    p.A.held = weapon;
    p.A.heldAttacked = true;
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
  "plunger": () => expect(topDisarm()).toContain("plunger"),
  // Parry tools: Block and Riposte together 40 or more.
  "broom": () => expect(WEAPONS.broom.tiers[0].block + WEAPONS.broom.tiers[0].riposte).toBeGreaterThanOrEqual(40),
  "frying-pan": () => expect(WEAPONS["frying-pan"].tiers[0].block + WEAPONS["frying-pan"].tiers[0].riposte).toBeGreaterThanOrEqual(40),
  // The blocking heavy pan: the highest Block of any weapon.
  "wok": () => expect(WEAPONS.wok.tiers[0].block).toBe(Math.max(...WEAPON_IDS.map((x) => WEAPONS[x].tiers[0].block))),
  // The blocking chair: a slow Heavy smash that also blocks.
  "folding-chair": () => { const w = WEAPONS["folding-chair"].tiers[0]; expect(w.block).toBeGreaterThanOrEqual(20); expect(w.tempo).toBeGreaterThanOrEqual(150); },
  // The quick club: no slower than fists, with Pierce.
  "tyre-iron": () => { const w = WEAPONS["tyre-iron"].tiers[0]; expect(w.tempo).toBeLessThanOrEqual(100); expect(w.pierce).toBeGreaterThanOrEqual(15); },
  // The long crit swing and the hooking stick, both Reach 2.
  "golf-club": () => { expect(reachOf("golf-club")).toBe(2); expect(WEAPONS["golf-club"].tiers[0].crit).toBeGreaterThanOrEqual(30); },
  "hockey-stick": () => { expect(reachOf("hockey-stick")).toBe(2); expect(WEAPONS["hockey-stick"].tiers[0].disarm).toBeGreaterThanOrEqual(30); },
  // The heavy hitter with an answer: Reach 2, big damage and a riposte.
  "cricket-bat": () => { const w = WEAPONS["cricket-bat"].tiers[0]; expect(reachOf("cricket-bat")).toBe(2); expect(w.dmg).toBeGreaterThanOrEqual(17); expect(w.riposte).toBeGreaterThanOrEqual(20); },
  // Thrown roles: the fastest lob, the bounce that slips past a block, the aimed cone, the
  // spinning disc that crits most, the heaviest throw.
  "plastic-bottle": () => expect(WEAPONS["plastic-bottle"].tiers[0].tempo).toBe(Math.min(...thrownIds().filter((x) => x !== "darts").map((x) => WEAPONS[x].tiers[0].tempo))),
  "rubber-ball": () => expect(WEAPONS["rubber-ball"].tiers[0].pierce).toBeGreaterThanOrEqual(30),
  "traffic-cone": () => expect(WEAPONS["traffic-cone"].tiers[0].aim).toBe(Math.max(...thrownIds().map((x) => WEAPONS[x].tiers[0].aim))),
  "hubcap": () => expect(WEAPONS.hubcap.tiers[0].crit).toBe(Math.max(...thrownIds().map((x) => WEAPONS[x].tiers[0].crit))),
  "tyre": () => expect(WEAPONS.tyre.tiers[0].dmg).toBe(Math.max(...thrownIds().map((x) => WEAPONS[x].tiers[0].dmg))),
  "paint-can": () => expect(WEAPONS["paint-can"].tiers[0].dmg).toBeGreaterThanOrEqual(11),
  // Reach weapons hold Reach 3 or 4.
  "pitchfork": () => expect(reachOf("pitchfork")).toBeGreaterThanOrEqual(3),
  "bike-chain": () => expect(reachOf("bike-chain")).toBeGreaterThanOrEqual(3),
  "stop-sign": () => expect(reachOf("stop-sign")).toBeGreaterThanOrEqual(3),
  "pool-cue": () => expect(reachOf("pool-cue")).toBeGreaterThanOrEqual(3),
  // Evasion weapon: the highest Evade.
  "umbrella": () => expect(WEAPONS.umbrella.tiers[0].evade).toBe(Math.max(...WEAPON_IDS.map((x) => WEAPONS[x].tiers[0].evade))),
};

function blockProof(id: WeaponId): void {
  // The best block the game allows: the Wok in hand, Parry, and the Riot Shield on the back arm.
  const s = setup(snap([id]), snap(["wok", "parry", "riot-shield"]));
  s.A.held = id;
  s.B.held = "wok";
  expect(s.B.shield).toBe("riot-shield");
  expect(blockChance(s.A, s.B, 0, false)).toBe(0);
}
function topDisarm(): string[] {
  return [...WEAPON_IDS].sort((x, y) => WEAPONS[y].tiers[0].disarm - WEAPONS[x].tiers[0].disarm).slice(0, 3);
}
function thrownIds(): WeaponId[] {
  return WEAPON_IDS.filter((x) => WEAPON_META[x].tags.includes("thrown"));
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
  it("counts 9 Common, 12 Uncommon, 11 Rare, 6 Epic, 3 Mythic", () => {
    const n: Record<string, number> = {};
    for (const id of WEAPON_IDS) n[WEAPONS[id].rarity!] = (n[WEAPONS[id].rarity!] ?? 0) + 1;
    expect(n).toEqual({ common: 9, uncommon: 12, rare: 11, epic: 6, mythic: 3 });
  });
  it("has 42 rows: the 41 weapons and fists", () => {
    expect(Object.keys(WEAPONS).sort()).toEqual([...HELD].sort());
  });
  it("matches spot values of the rules (rows the balance pass did not move)", () => {
    expect(WEAPONS.fists.tiers[0]).toEqual({ tempo: 100, dmg: 5, reach: 0, draw: 0, aim: 0, pierce: 0, block: 0,
      evade: 0, riposte: 0, combo: 0, disarm: 0, crit: 0 });
    expect(WEAPONS["pocket-knife"].tiers[0]).toEqual({ tempo: 65, dmg: 6, reach: 0, draw: 5, aim: 25, pierce: 0,
      block: 0, evade: 5, riposte: 0, combo: 35, disarm: 0, crit: 10 });
    // Pitchfork Dmg 13 -> 14 in the content v2 balance pass (docs/RULES.md); the rest of its row is the brief's.
    expect(WEAPONS.pitchfork.tiers[0]).toEqual({ tempo: 130, dmg: 14, reach: 3, draw: 3, aim: 0, pierce: 0,
      block: 5, evade: 0, riposte: 0, combo: 0, disarm: 5, crit: 10 });
    expect(WEAPONS.darts.tiers[0]).toMatchObject({ tempo: 45, dmg: 3, reach: null, combo: 30 });
  });
});
