/**
 * The skill table (work package 1). Each skill has named numbers; what the numbers do is sim code
 * keyed by the skill id. The card text of the app is built from these same numbers.
 * Every number that differs from the starting table is listed in docs/RULES.md.
 */
import type { SkillId } from "../contracts/ids";
import type { SkillDef } from "../contracts/content";
import { RARITY_OF } from "../contracts/content";

type Kind = SkillDef["kind"];
function def(id: SkillId, kind: Kind, nums: Record<string, number>, move?: { weight: number; uses: number }): SkillDef {
  const rarity = RARITY_OF[id];
  return move === undefined ? { id, kind, rarity, tiers: [nums] } : { id, kind, rarity, tiers: [nums], move };
}

export const SKILLS: Readonly<Record<SkillId, SkillDef>> = {
  // Boosters: change the stats for good when picked. Points are added, multipliers are whole percent.
  "big-heart": def("big-heart", "booster", { health: 2, healthMult: 35 }),
  "heavy-hands": def("heavy-hands", "booster", { strength: 2, strengthMult: 50 }),
  "light-feet": def("light-feet", "booster", { agility: 2, agilityMult: 45 }),
  "fast-twitch": def("fast-twitch", "booster", { speed: 3, speedMult: 40 }),
  "glass-cannon": def("glass-cannon", "booster", { strengthMult: 100, healthMult: -30 }),
  "mountain": def("mountain", "booster", { healthMult: 150, agilityMult: -20, speedMult: -20, startClock: 150 }),

  // Passives: always on in a bout.
  "padding": def("padding", "passive", { armor: 10 }),
  "anticipation": def("anticipation", "passive", { intercept: 20 }),
  "sharpening-stone": def("sharpening-stone", "passive", { bladeDamage: 40 }),
  "bare-knuckle": def("bare-knuckle", "passive", { fistDamage: 150, unarmedCombo: 10, drawSlack: 12 }),
  "payback": def("payback", "passive", { riposte: 25 }),
  "flurry": def("flurry", "passive", { combo: 20 }),
  "firm-grip": def("firm-grip", "passive", { resist: 80, swapChance: 15 }),
  "head-start": def("head-start", "passive", { startClock: -150 }),
  "sharp-eye": def("sharp-eye", "passive", { aim: 16, pierce: 16 }),
  "parry": def("parry", "passive", { block: 10, riposteAfterBlock: 80 }),
  "heavy-lifter": def("heavy-lifter", "passive", { heavyTime: -30, heavyAim: 10 }),
  "pitcher": def("pitcher", "passive", { thrownDamage: 40, throwChance: 35 }),
  "plate-vest": def("plate-vest", "passive", { armor: 22, speedMult: -15 }),
  "knock-loose": def("knock-loose", "passive", { disarm: 40 }),
  "last-stand": def("last-stand", "passive", { saves: 1 }),
  "stubborn": def("stubborn", "passive", { chance: 50 }),
  "slippery": def("slippery", "passive", { evade: 25 }),
  // content v2 passives
  "quick-swap": def("quick-swap", "passive", { drawSlack: 2, swapChance: 50, swapTime: -30 }),
  "pet-lover": def("pet-lover", "passive", { petHp: 30, petDamage: 50 }),
  "junk-collector": def("junk-collector", "passive", { returnChance: 90, throwChance: 35 }),
  "trick-shot": def("trick-shot", "passive", { ricochet: 35 }),

  // Moves: fire by weighted chance at the start of a turn, limited uses per bout.
  // `cost` is in beats; `costPct` is a share of one normal turn of that scrapper.
  "haymaker": def("haymaker", "move", { damageMult: 200, crit: 15, usesPerStrength: 25, cost: 0 }, { weight: 5, uses: 1 }),
  "energy-drink": def("energy-drink", "move", { healMin: 25, healMax: 40, belowHpPct: 50, cost: 30 }, { weight: 16, uses: 1 }),
  "tarp": def("tarp", "move", { skips: 3, costPct: 20 }, { weight: 5, uses: 1 }),
  "whistle": def("whistle", "move", { healPct: 60, belowHpPct: 90, cost: 10 }, { weight: 20, uses: 2 }),
  "firecrackers": def("firecrackers", "move", { damageMin: 12, damageMax: 20, companionPct: 40, costPct: 50 }, { weight: 4, uses: 2 }),
  "snatch": def("snatch", "move", { cost: 0 }, { weight: 13, uses: 1 }),
  "air-horn": def("air-horn", "move", { fleeChance: 50, clockPush: 40, clockPushNoPet: 60, cost: 20 }, { weight: 8, uses: 1 }),
  "body-slam": def("body-slam", "move", { base: 14, perStrength: 4, extraCost: 100 }, { weight: 12, uses: 1 }),
  // content v2 Moves
  "sand-in-the-eyes": def("sand-in-the-eyes", "move", { aimLoss: 25, costPct: 30 }, { weight: 4, uses: 1 }),
  "taunt": def("taunt", "move", { riposte: 40, cost: 0 }, { weight: 4, uses: 1 }),
  "second-wind": def("second-wind", "move", { healPct: 15, belowHpPct: 50, cost: 0 }, { weight: 16, uses: 1 }),
  "grapple": def("grapple", "move", { base: 8, perStrength: 2, holds: 1 }, { weight: 16, uses: 1 }),
};

/** A named number of a skill. A missing name is a programming error in this package; it gives 0. */
export function sk(id: SkillId, name: string): number {
  const v = SKILLS[id].tiers[0][name];
  return v === undefined ? 0 : v;
}
