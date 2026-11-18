/**
 * Player text of the talent tree (content v3, batch 3, plan 13.11). Names are typed here; every
 * number in an effect line is read from the core's talent table (`content.talents`), so no number
 * is typed twice. A test compares each line with its table row.
 */
import type { ContentTables, ProcId, TalentBranch, TalentId } from "@rankzero/core";
import { isTalentId } from "@rankzero/core";
import { NAMES } from "./names";

export const BRANCH_NAMES: Readonly<Record<TalentBranch, string>> = {
  brawler: "Brawler", arsenal: "Arsenal", thrower: "Thrower", pack: "Pack", "iron-wall": "Iron Wall",
};
/** One plain line under each branch's name. */
export const BRANCH_LINES: Readonly<Record<TalentBranch, string>> = {
  brawler: "Fists, Strength, combos and knockdowns.",
  arsenal: "Melee weapons, swaps and disarms.",
  thrower: "Throws: more often, harder, bouncing, caught.",
  pack: "Pets: tougher, sharper, cheaper, on guard.",
  "iron-wall": "Shields, Toughness, blocks and the answer after a block.",
};

export const TALENT_NAMES: Readonly<Record<TalentId, string>> = {
  "iron-knuckles": "Iron Knuckles", "gym-rat": "Gym Rat", "follow-through": "Follow-Through", stagger: "Stagger",
  bruiser: "Bruiser", knockdown: "Knockdown",
  "weapon-care": "Weapon Care", "quick-hands": "Quick Hands", hook: "Hook", "fast-swap": "Fast Swap",
  "weapon-master": "Weapon Master", "fresh-steel": "Fresh Steel",
  "strong-arm": "Strong Arm", sidearm: "Sidearm", "dead-eye": "Dead Eye", "bank-shot": "Bank Shot",
  "quick-catch": "Quick Catch", bullseye: "Bullseye",
  "good-boy": "Good Boy", "sharp-teeth": "Sharp Teeth", "quick-paws": "Quick Paws", "second-bowl": "Second Bowl",
  "guard-dog": "Guard Dog", "loyal-pack": "Loyal Pack",
  "thick-skin": "Thick Skin", brace: "Brace", "shield-strap": "Shield Strap", counter: "Counter",
  turtle: "Turtle", unbreakable: "Unbreakable",
};

/** The name of whatever a proc names: a skill, a shield or a capstone. */
export function procName(id: ProcId): string {
  return isTalentId(id) ? TALENT_NAMES[id] : NAMES[id];
}

/** The effect of a node at `rank` (1 when it is not ranked yet), with its numbers from the table. */
export function talentLine(c: ContentTables, id: TalentId, rank = 1): string {
  const r = Math.max(1, rank);
  const n = (key: string): number => (c.talents[id].per[key] ?? 0) * r;
  switch (id) {
    case "iron-knuckles": return `Punches with fists deal ${n("fistDmg")}% more damage.`;
    case "gym-rat": return `Strength +${n("strength")}.`;
    case "follow-through": return `Combo +${n("combo")}.`;
    case "stagger": return `A crit you land on a scrapper sets its next turn back ${n("stagger")} beats.`;
    case "bruiser": return `Crit +${n("crit")}.`;
    case "knockdown": return `Once a turn, your first combo swing that lands is a crit and knocks the target back ${n("knockClock")} beats.`;
    case "weapon-care": return `Melee swings with a weapon deal ${n("weaponDmg")}% more damage.`;
    case "quick-hands": return `Draw a weapon into empty hands sooner (slack -${n("drawEase")}) and swap weapons ${n("swap")}% more often.`;
    case "hook": return `Disarm +${n("disarm")}.`;
    case "fast-swap": return `A turn in which you draw or swap a weapon takes ${-n("swapTime")}% less time.`;
    case "weapon-master": return `Block +${n("block")} while you hold a weapon.`;
    case "fresh-steel": return `The first swing with each weapon you draw or swap in deals ${n("freshDmg")}% more damage and cannot be blocked.`;
    case "strong-arm": return `Throws deal ${n("thrownDmg")}% more damage.`;
    case "sidearm": return `A melee weapon is thrown ${n("throwChance")}% more often.`;
    case "dead-eye": return `Aim +${n("thrownAim")} on throws.`;
    case "bank-shot": return `A throw that lands with a weapon that stays in your hand bounces on to another enemy ${n("ricochet")}% of the time, once a turn.`;
    case "quick-catch": return `A melee weapon you throw comes back into your bag ${n("catch")}% of the time.`;
    case "bullseye": return `Throws get Crit +${n("thrownCrit")}, and a crit with a throw hits x${(c.talents[id].per.critTo ?? 150) / 100}, not x1.5.`;
    case "good-boy": return `Your pets have ${n("petHp")}% more HP.`;
    case "sharp-teeth": return `Your pets deal ${n("petDmg")}% more damage.`;
    case "quick-paws": return `Your pets' Evade +${n("petEvade")}.`;
    case "second-bowl": return `Your pets cost ${Math.min(100, n("petCost"))}% less of your max HP.`;
    case "guard-dog": return `A swing or throw at you goes to one of your standing pets ${n("guard")}% of the time.`;
    case "loyal-pack": return "Once a bout, a hit that would knock you out while a pet of yours stands leaves you at 1 HP.";
    case "thick-skin": return `Toughness +${n("toughness")}.`;
    case "brace": return `Block +${n("block")}.`;
    case "shield-strap": return `Your shield is ${n("knockCut")} points harder to knock off.`;
    case "counter": return `After a block, Riposte +${n("blockRiposte")} for that attack.`;
    case "turtle": return `Armor +${n("armor")}.`;
    case "unbreakable": return "After you block, you always hit back, and that riposte cannot be evaded or blocked.";
  }
}

export const TALENT_WORDS = {
  title: "Talents",
  points: (n: number) => (n === 1 ? "1 point to spend" : `${n} points to spend`),
  pointsShort: (n: number) => `${n}`,
  none: "No points to spend",
  earnedLine: (earned: number, spent: number) => `${spent} of ${earned} spent. A point comes at level 3 and every 3 levels after.`,
  firstAt: "Your first talent point comes at level 3.",
  rank: (r: number, max: number) => `Rank ${r} / ${max}`,
  capstone: "Capstone",
  tierNeed: (need: number, branch: string) => `Spend ${need} points lower in ${branch} first.`,
  maxed: "Fully ranked.",
  spend: "Spend a point",
  noPoints: "No points left. The next comes with a level.",
  nextRank: "Next rank",
  now: "Now",
  respec: "Free respec",
  respecLine: "Take every point back and spend them again. Once a day, free.",
  respecUsed: "Today's free respec is used. It comes back tomorrow.",
  respecConfirm: "Take all points back",
  respecNothing: "Nothing spent yet.",
  prompt: (n: number) => (n === 1 ? "1 talent point to spend" : `${n} talent points to spend`),
  promptSub: "Open the talent tree",
  needsPet: "Needs a pet to do anything.",
  locked: "Locked",
};
