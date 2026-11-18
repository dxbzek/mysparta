/**
 * Body equipment (content v3, batch 2, plan 13.12): one test per piece, named by its id. With the
 * piece worn and without it, the number its card names changes by exactly its table value, and
 * nothing else of the fight values changes. Plus the loadout rules (the bag, the shield, the pets,
 * the gear, the snapshot carrying only what is chosen) and the gear card on the Route.
 */
import { describe, expect, it } from "vitest";
import type { DerivedValues, FighterSnapshot, GearId, GearKey, Loadout, PerkId, ScrapperRecord } from "@rankzero/core";
import { GEAR_IDS, GEAR_META, REALM_SALT, api, rivalSnapshot } from "@rankzero/core";
import { GEAR, gn } from "../src/content/gear";
import { buildSide, combatValues, valuesOf } from "../src/sim/combatant";
import type { Actor } from "../src/sim/combatant";
import { blockChance, critPctOf, damageMult, evadeChance, takenSoak } from "../src/sim/melee";
import { moveSoaked, sandLoss, snatchSlip, tarpSkips } from "../src/sim/moves";
import { drawSlack } from "../src/sim/turn";
import { startOffset } from "../src/sim/clock";
import { defaultLoadout, loadoutPerks, resolveLoadout, statsWithGear } from "../src/progress/loadout";
import { walk } from "../src/progress/route";
import { GEAR_CARD_PCT } from "../src/progress/perks";

const STATS = ["health", "strength", "agility", "speed", "toughness", "precision"] as const;
const DERIVED = ["evade", "block", "aim", "pierce", "intercept", "riposte", "combo", "disarm", "crit", "armor", "grip", "soak"] as const;

/** A level-10 rival with no gear of its own, and the same with `g` worn (its stat points added). */
function pair(g: GearId): { bare: FighterSnapshot; worn: FighterSnapshot } {
  for (let i = 0; ; i++) {
    const r = rivalSnapshot(REALM_SALT, 10, i);
    if (r.perks.some((p) => (GEAR_IDS as readonly string[]).includes(p))) continue;
    return { bare: r, worn: { ...r, id: `${r.id}+${g}`, stats: statsWithGear(r.stats, [g]), perks: [...r.perks, g] } };
  }
}
const scrapper = (s: FighterSnapshot, side: "a" | "b" = "a"): Actor => buildSide(side, s).actors[0]!;
/** A companion attacker (the first pet of some level-10 rival). */
function pet(): Actor {
  for (let i = 0; ; i++) {
    const a = buildSide("b", rivalSnapshot(REALM_SALT, 10, 500 + i)).actors;
    if (a.length > 1) return a[1]!;
  }
}

/** The fight values that must stay as they are when only `keys` should move. */
function sameExcept(x: DerivedValues, y: DerivedValues, keys: readonly string[]): void {
  for (const k of DERIVED) if (!keys.includes(k)) expect(y[k], k).toBe(x[k]);
}

describe("body equipment: 30 pieces, six in each of the five slots", () => {
  it("has every piece in the table with its slot and rarity from GEAR_META, and one bonus at least", () => {
    expect(GEAR_IDS.length).toBe(30);
    for (const id of GEAR_IDS) {
      expect(GEAR[id].slot).toBe(GEAR_META[id].slot);
      expect(GEAR[id].rarity).toBe(GEAR_META[id].rarity);
      const n = Object.entries(GEAR[id].tiers[0]);
      expect(n.some(([k, v]) => v > 0 || (k === "startClock" && v < 0)), id).toBe(true);
    }
  });
});

/** The rule each piece's test checks. */
const RULE: Record<GearId, (g: GearId) => void> = {} as Record<GearId, (g: GearId) => void>;
const statRule = (key: (typeof STATS)[number]) => (g: GearId): void => {
  const { bare, worn } = pair(g);
  for (const k of STATS) expect(worn.stats.points[k] - bare.stats.points[k], k).toBe(gn(g, k));
  expect(gn(g, key)).toBeGreaterThan(0);
};
const derivedRule = (keys: readonly GearKey[]) => (g: GearId): void => {
  const { bare } = pair(g);
  const a = scrapper(bare);
  const x = combatValues(a.skills, a.held, a.shield, a.tou, a.pre, []);
  const y = combatValues(a.skills, a.held, a.shield, a.tou, a.pre, [g]);
  for (const k of keys) expect(y[k as keyof DerivedValues] - x[k as keyof DerivedValues], k).toBe(gn(g, k));
  sameExcept(x, y, keys);
  // and the stats of the snapshot move only by the piece's own stat points
  const { worn } = pair(g);
  for (const k of STATS) expect(worn.stats.points[k] - bare.stats.points[k], k).toBe(gn(g, k));
};
Object.assign(RULE, {
  "bandana": statRule("precision"),
  "beanie": statRule("health"),
  "hard-hat": derivedRule(["armor"]),
  "goggles": (g: GearId) => {
    derivedRule(["aim"])(g);
    const { bare, worn } = pair(g);
    expect(sandLoss(scrapper(bare))).toBe(25);
    expect(sandLoss(scrapper(worn))).toBe(0);
  },
  "welding-mask": (g: GearId) => {
    derivedRule(["aim"])(g);
    const { bare, worn } = pair(g);
    expect(critPctOf(scrapper(bare))).toBe(150);
    expect(critPctOf(scrapper(worn))).toBe(150 - gn(g, "critCut"));
  },
  "motorbike-helmet": (g: GearId) => {
    const { bare, worn } = pair(g);
    const att = scrapper(rivalSnapshot(REALM_SALT, 10, 900), "b");
    const def0 = scrapper(bare);
    const def1 = scrapper(worn);
    // its Speed cost is in the snapshot's points; Toughness is counted 9 higher for a crit's soak only
    expect(worn.stats.points.speed - bare.stats.points.speed).toBe(gn(g, "speed"));
    expect(takenSoak(att, def1, false)).toBe(takenSoak(att, def0, false));
    const t = def0.tou;
    const soak = (x: number): number => Math.floor(Math.max(0, x - 3) / 3);
    expect(takenSoak(att, def1, true) - takenSoak(att, def0, true)).toBe(soak(t + gn(g, "headTough")) - soak(t));
    expect(takenSoak(att, def1, true) - takenSoak(att, def0, true)).toBeGreaterThan(0);
  },
  "work-vest": statRule("toughness"),
  "hi-vis-vest": (g: GearId) => {
    const { bare, worn } = pair(g);
    const p = pet();
    const d0 = scrapper(bare);
    const d1 = scrapper(worn);
    // (the same roll as the bare one with its Evade raised by the vest's number, before the cap)
    expect(evadeChance(p, d1, 0, 0, false)).toBe(evadeChance(p, d0, 0, -gn(g, "petEvade"), false));
    expect(evadeChance(p, d1, 0, 0, false)).toBeGreaterThan(evadeChance(p, d0, 0, 0, false));
    // against a fighter it changes nothing
    const f = scrapper(rivalSnapshot(REALM_SALT, 10, 900), "b");
    expect(evadeChance(f, d1, 0, 0, false)).toBe(evadeChance(f, d0, 0, 0, false));
    sameExcept(valuesOf(d0), valuesOf(d1), []);
  },
  "padded-jacket": (g: GearId) => {
    derivedRule(["soak"])(g);
  },
  "leather-jacket": derivedRule(["riposte"]),
  "hockey-chest-pad": derivedRule(["block"]),
  "tyre-rubber-vest": derivedRule(["armor"]),
  "work-gloves": derivedRule(["grip"]),
  "taped-fists": (g: GearId) => {
    const { bare, worn } = pair(g);
    const a0 = scrapper(bare);
    const a1 = scrapper(worn);
    expect(a0.held).toBe("fists");
    expect(damageMult(a1, false, false) - damageMult(a0, false, false)).toBe(gn(g, "fistDmg"));
    // not on a throw, not with a weapon in hand
    expect(damageMult(a1, true, false)).toBe(damageMult(a0, true, false));
    a0.held = "pipe"; a1.held = "pipe";
    expect(damageMult(a1, false, false)).toBe(damageMult(a0, false, false));
  },
  "rubber-gloves": (g: GearId) => {
    const { bare, worn } = pair(g);
    expect(snatchSlip(scrapper(bare))).toBe(0);
    expect(snatchSlip(scrapper(worn))).toBe(gn(g, "snatchResist"));
    sameExcept(valuesOf(scrapper(bare)), valuesOf(scrapper(worn)), []);
  },
  "fingerless-gloves": derivedRule(["combo"]),
  "oven-mitts": (g: GearId) => {
    derivedRule(["combo"])(g);
    const { bare, worn } = pair(g);
    const att = scrapper(rivalSnapshot(REALM_SALT, 10, 900), "b");
    const b0 = blockChance(att, scrapper(bare), 0, true);
    expect(blockChance(att, scrapper(worn), 0, true) - b0).toBe(Math.min(75, b0 + gn(g, "thrownBlock")) - b0);
    expect(blockChance(att, scrapper(worn), 0, false)).toBe(blockChance(att, scrapper(bare), 0, false));
  },
  "welding-gloves": (g: GearId) => { statRule("strength")(g); expect(gn(g, "precision")).toBeLessThan(0); },
  "ripped-jeans": statRule("agility"),
  "cargo-pants": (g: GearId) => {
    const { bare, worn } = pair(g);
    expect(drawSlack(scrapper(bare)) - drawSlack(scrapper(worn))).toBe(gn(g, "drawEase"));
  },
  "knee-pads": (g: GearId) => {
    const { bare, worn } = pair(g);
    expect(moveSoaked(scrapper(bare), 20)).toBe(20);
    expect(moveSoaked(scrapper(worn), 20)).toBe(20 - gn(g, "moveSoak"));
    expect(moveSoaked(scrapper(worn), 3)).toBe(1);
  },
  "track-pants": statRule("speed"),
  "magazine-shin-guards": (g: GearId) => {
    const { bare, worn } = pair(g);
    const p = pet();
    expect(takenSoak(p, scrapper(worn), false) - takenSoak(p, scrapper(bare), false)).toBe(gn(g, "petSoak"));
    const f = scrapper(rivalSnapshot(REALM_SALT, 10, 900), "b");
    expect(takenSoak(f, scrapper(worn), false)).toBe(takenSoak(f, scrapper(bare), false));
  },
  "overalls": statRule("toughness"),
  "sneakers": derivedRule(["evade"]),
  "flip-flops": (g: GearId) => { statRule("speed")(g); derivedRule(["evade"])(g); },
  "rain-boots": (g: GearId) => {
    const { bare, worn } = pair(g);
    expect(tarpSkips(scrapper(bare))).toBe(3);
    expect(tarpSkips(scrapper(worn))).toBe(Math.max(1, 3 - gn(g, "snareCut")));
  },
  "skate-shoes": derivedRule(["intercept"]),
  "steel-toe-boots": derivedRule(["disarm"]),
  "slippers": (g: GearId) => {
    const { bare, worn } = pair(g);
    expect(startOffset(scrapper(worn)) - startOffset(scrapper(bare))).toBe(gn(g, "startClock"));
  },
});

describe("one sim test per piece of gear", () => {
  for (const id of GEAR_IDS) it(id, () => RULE[id](id));
});

describe("the loadout", () => {
  const owned: PerkId[] = ["pipe", "bat", "darts", "anvil", "broom", "rebar", "padding", "bin-lid", "raccoon", "raccoon", "crow",
    "beanie", "hard-hat", "sneakers"];
  it("by default takes every weapon up to 5 (the rarest first), the shield, every pet, the rarest gear of each slot", () => {
    const l = defaultLoadout(owned);
    expect(l.weapons).toEqual(["pipe", "bat", "darts", "anvil", "rebar"].filter((w) => ["bat", "darts", "anvil", "rebar", "pipe"].includes(w)).slice(0, 5));
    expect(l.weapons.length).toBe(5);
    expect(l.weapons).not.toContain("broom");
    expect(l.shield).toBe("bin-lid");
    expect(l.pets).toEqual(["raccoon", "raccoon", "crow"]);
    expect(l.gear).toEqual({ head: "hard-hat", feet: "sneakers" });
  });
  it("reads a stored loadout against what is owned: never empty while a weapon is owned, at most 5, no stranger", () => {
    const l = resolveLoadout(owned, { weapons: [], shield: "car-door", pets: ["raccoon", "raccoon", "raccoon", "goose"], gear: { head: "beanie", torso: "work-vest", feet: "hard-hat" as GearId } });
    expect(l.weapons.length).toBe(1);
    expect(l.shield).toBeNull();
    expect(l.pets).toEqual(["raccoon", "raccoon"]);
    expect(l.gear).toEqual({ head: "beanie" });
    const six = resolveLoadout(owned, { weapons: ["pipe", "bat", "darts", "anvil", "broom", "rebar"], shield: null, pets: [], gear: {} });
    expect(six.weapons).toEqual(["pipe", "bat", "darts", "anvil", "broom"]);
  });
  it("the snapshot carries every skill but only the chosen weapons, shield, pets and gear, with the gear's stat points", () => {
    const l: Loadout = { weapons: ["darts"], shield: null, pets: ["crow"], gear: { head: "beanie" } };
    expect(loadoutPerks(owned, l)).toEqual(["darts", "padding", "crow", "beanie"]);
  });
  it("is stored by withLoadout, read by loadoutOf, and changes the snapshot and the max HP (a pet left home costs nothing)", () => {
    let rec: ScrapperRecord | null = null;
    for (let i = 0; rec === null; i++) {
      const r = api.createRecord({ id: `L${i}`, name: api.randomName(i), realmSalt: REALM_SALT, lookSalt: 0, colourSalt: 0, today: "2026-11-18", nowMs: 0 });
      const picks = Array.from({ length: 29 }, (_, k) => ((i + k) % 3 === 0 ? "R" : "L") as "L" | "R");
      const r30 = { ...r, picks };
      const s = api.sheetOf(r30);
      if (s.loadout.pets.length > 0 && s.loadout.weapons.length > 1) rec = r30;
    }
    const s = api.sheetOf(rec);
    const lean = api.withLoadout(rec, { ...s.loadout, weapons: s.loadout.weapons.slice(0, 1), pets: [] });
    const snap = api.snapshotOf(lean);
    expect(snap.perks.filter((p) => s.loadout.weapons.includes(p as never))).toEqual(s.loadout.weapons.slice(0, 1));
    expect(snap.perks.some((p) => s.loadout.pets.includes(p as never))).toBe(false);
    expect(api.sheetOf(lean).maxHp).toBeGreaterThan(s.maxHp);
    expect(api.loadoutOf(lean).weapons).toEqual(s.loadout.weapons.slice(0, 1));
  });
});

describe("gear on the Route", () => {
  it("offers gear cards about GEAR_CARD_PCT of the time, never one already owned, each with +1 stat point", () => {
    let perkCards = 0;
    let gear = 0;
    for (let i = 0; i < 300; i++) {
      const seed = 9000 + i;
      const picks = Array.from({ length: 29 }, (_, k) => ((i * 7 + k) % 2 === 0 ? "L" : "R") as "L" | "R");
      const kit = walk(seed, picks);
      const ownedG = new Set<string>();
      for (const n of kit.nodes) {
        for (const c of [n.left, n.right]) {
          if (c.kind === "stat") continue;
          perkCards += 1;
          if (c.kind === "perk" && (GEAR_IDS as readonly string[]).includes(c.perk)) {
            gear += 1;
            expect(ownedG.has(c.perk)).toBe(false);
            expect(c.plus).toBeDefined();
          }
        }
        const t = n.taken === "L" ? n.left : n.right;
        if (t.kind === "perk" && (GEAR_IDS as readonly string[]).includes(t.perk)) ownedG.add(t.perk);
      }
    }
    expect(Math.abs((100 * gear) / perkCards - GEAR_CARD_PCT)).toBeLessThan(3);
  });
  it("offers no gear card before gearFrom: an old save's kit walks as it did", () => {
    for (let i = 0; i < 100; i++) {
      const picks = Array.from({ length: 20 }, (_, k) => ((i + k) % 2 === 0 ? "L" : "R") as "L" | "R");
      const kit = walk(5000 + i, picks, undefined, 20);
      expect(kit.perks.some((p) => (GEAR_IDS as readonly string[]).includes(p))).toBe(false);
    }
  });
});
