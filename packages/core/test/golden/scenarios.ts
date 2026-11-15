/**
 * The golden bouts (work package 1): 6 scenarios x 30 seeds. Shared by the Node golden test and the
 * browser parity page, so every engine runs exactly the same bouts. Pure: no Node or DOM API.
 */
import type { FighterSnapshot } from "../../src/contracts/fighter";
import type { PerkId } from "../../src/contracts/ids";
import { COMPANION_IDS, MOVE_IDS, REALM_SALT, SHIELD_IDS, WEAPON_IDS, isCompanionId, isShieldId, perkKind } from "../../src/contracts/ids";
import { combineSeed } from "../../src/prng";
import { rivalSnapshot } from "../../src/progress/rivals";

export const SCENARIOS = ["l1-fists", "l1-weapon", "l10-mixed", "l30-mixed", "companions", "moves"] as const;
export type Scenario = (typeof SCENARIOS)[number];
export const SEEDS_PER_SCENARIO = 30;

export interface GoldenBout { scenario: Scenario; i: number; seed: number; a: FighterSnapshot; b: FighterSnapshot }

function strip(s: FighterSnapshot, drop: (p: PerkId) => boolean, add: PerkId[], tag: string): FighterSnapshot {
  return { ...s, id: `${s.id}${tag}`, perks: [...s.perks.filter((p) => !drop(p)), ...add] };
}

function pair(sc: Scenario, i: number): [FighterSnapshot, FighterSnapshot] {
  const r = (level: number, k: number): FighterSnapshot => rivalSnapshot(REALM_SALT, level, 1000 * SCENARIOS.indexOf(sc) + k);
  switch (sc) {
    case "l1-fists":
      return [strip(r(1, 2 * i), (p) => perkKind(p) === "weapon", [], ":f"), strip(r(1, 2 * i + 1), (p) => perkKind(p) === "weapon", [], ":f")];
    case "l1-weapon":
      return [strip(r(1, 2 * i), (p) => perkKind(p) === "weapon", [WEAPON_IDS[i % WEAPON_IDS.length]!], ":w"), r(1, 2 * i + 1)];
    case "l10-mixed":
      return [r(10, 2 * i), r(10, 2 * i + 1)];
    case "l30-mixed":
      return [r(30, 2 * i), r(30, 2 * i + 1)];
    case "companions":
      // content v2: all six pets in turn, and side a carries each of the six shields in turn
      return [strip(r(10, 2 * i), (p) => isCompanionId(p) || isShieldId(p), [COMPANION_IDS[i % COMPANION_IDS.length]!, SHIELD_IDS[i % SHIELD_IDS.length]!], ":c"),
        strip(r(10, 2 * i + 1), isCompanionId, ["raccoon"], ":c")];
    case "moves": {
      const m1 = MOVE_IDS[i % MOVE_IDS.length]!;
      const m2 = MOVE_IDS[(i + 3) % MOVE_IDS.length]!;
      const m3 = MOVE_IDS[(i + 5) % MOVE_IDS.length]!;
      const isMove = (p: PerkId): boolean => (MOVE_IDS as readonly string[]).includes(p);
      const a = strip(r(10, 2 * i), (p) => isMove(p) || isCompanionId(p), [m1, m2, "raccoon"], ":m");
      const b = strip(r(10, 2 * i + 1), (p) => isMove(p) || isCompanionId(p), [m3, "raccoon"], ":m");
      return [a, b];
    }
    default: {
      const unknown: never = sc;
      return unknown;
    }
  }
}

export function goldenBouts(): GoldenBout[] {
  const out: GoldenBout[] = [];
  for (const scenario of SCENARIOS) {
    for (let i = 0; i < SEEDS_PER_SCENARIO; i++) {
      const [a, b] = pair(scenario, i);
      out.push({ scenario, i, seed: combineSeed("golden", scenario, i), a, b });
    }
  }
  return out;
}
