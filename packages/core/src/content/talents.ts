/**
 * The talent table (content v3, batch 3, plan 13.11). Identity (branch, tier, ranks) comes from the
 * frozen TALENT_META; this file adds the tunable numbers, for ONE rank. A node at rank r gives r
 * times each number. What each number does is sim code keyed by the node id, and every row is in
 * docs/RULES.md 3c.
 *
 * Brawler    fistDmg      % added to the damage multiplier of a swing with fists
 *            strength     Strength points (into the snapshot's stats, like gear)
 *            combo        added to Combo
 *            stagger      beats added to a scrapper's clock when the owner lands a crit on it
 *            crit         added to Crit
 *            knockClock   capstone: the first combo swing of a turn that lands is a crit and adds
 *                         this many beats to the target's clock
 * Arsenal    weaponDmg    % added to the damage multiplier of a melee swing with a held weapon
 *            drawEase     taken off the slack of the empty-hand draw (never below 1)
 *            swap         added to the swap chance
 *            disarm       added to Disarm
 *            swapTime     % added to the time of a turn in which the owner drew or swapped (a minus)
 *            block        added to Block while a weapon is held
 *            freshDmg     capstone: % added to the damage multiplier of the first swing with a weapon
 *                         drawn or swapped in, which cannot be blocked
 * Thrower    thrownDmg    % added to the damage multiplier of a throw
 *            throwChance  added to the chance a held melee weapon is thrown
 *            thrownAim    Aim added to a throw
 *            ricochet     % that a landed throw of a weapon that stays in the hand bounces on to
 *                         another standing enemy, once a turn (added to Trick Shot's)
 *            catch        % that a thrown melee weapon that would be gone goes back into the bag
 *            thrownCrit   capstone: Crit added to a throw, and a thrown crit hits x2 (critTo)
 * Pack       petHp        % added to the HP of the owner's companions
 *            petDmg       % added to the damage multiplier of the owner's companions
 *            petEvade     Evade added to the owner's companions
 *            petCost      % taken off the max HP cost of every companion (each rounded down)
 *            guard        % that a swing or throw aimed at the owner goes to a standing companion
 *            loyal        capstone: once a bout, a hit that would knock the owner out while a
 *                         companion of its side stands leaves it at 1 HP
 * Iron Wall  toughness    Toughness points (into the snapshot's stats)
 *            block        added to Block
 *            knockCut     taken off a shield knock-off chance against the owner
 *            blockRiposte added to the Riposte chance after a block in that attack
 *            armor        added to Armor
 *            sureRiposte  capstone: after a block, the riposte is sure and cannot be evaded or blocked
 */
import type { TalentBranch, TalentId } from "../contracts/ids";
import { TALENT_IDS } from "../contracts/ids";
import type { TalentDef } from "../contracts/content";
import { TALENT_META } from "../contracts/content";

const PER: Readonly<Record<TalentId, Readonly<Record<string, number>>>> = {
  // Brawler: fists, Strength, combos, knockdowns
  "iron-knuckles": { fistDmg: 40 },
  "gym-rat": { strength: 1 },
  "follow-through": { combo: 3 },
  "stagger": { stagger: 20 },
  "bruiser": { crit: 3 },
  "knockdown": { knockClock: 40 },
  // Arsenal: melee weapons, swaps, disarms
  "weapon-care": { weaponDmg: 4 },
  "quick-hands": { drawEase: 1, swap: 5 },
  "hook": { disarm: 5 },
  "fast-swap": { swapTime: -10 },
  "weapon-master": { block: 5 },
  "fresh-steel": { freshDmg: 30 },
  // Thrower: throwing chance and damage, ricochets, catching
  "strong-arm": { thrownDmg: 10 },
  "sidearm": { throwChance: 5 },
  "dead-eye": { thrownAim: 8 },
  "bank-shot": { ricochet: 15 },
  "quick-catch": { catch: 25 },
  "bullseye": { thrownCrit: 20, critTo: 200 },
  // Pack: pet HP and damage, the second pet, pets that guard their owner
  "good-boy": { petHp: 25 },
  "sharp-teeth": { petDmg: 25 },
  "quick-paws": { petEvade: 10 },
  "second-bowl": { petCost: 25 },
  "guard-dog": { guard: 12 },
  "loyal-pack": { loyal: 1 },
  // Iron Wall: shields, Toughness, blocks, riposte after a block
  "thick-skin": { toughness: 2 },
  "brace": { block: 4 },
  "shield-strap": { knockCut: 15 },
  "counter": { blockRiposte: 10 },
  "turtle": { armor: 4 },
  "unbreakable": { sureRiposte: 1 },
};

export const TALENTS: Readonly<Record<TalentId, TalentDef>> = Object.fromEntries(
  TALENT_IDS.map((id) => [id, { id, ...TALENT_META[id], per: PER[id] }]),
) as Record<TalentId, TalentDef>;

/** One named number of a node, for one rank (0 when the node has no such number). */
export function tn(id: TalentId, key: string): number {
  return PER[id][key] ?? 0;
}

/** The nodes of a branch in tier order (the order of TALENT_IDS). */
export function branchNodes(branch: TalentBranch): TalentId[] {
  return TALENT_IDS.filter((id) => TALENT_META[id].branch === branch);
}
