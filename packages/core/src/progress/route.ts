/**
 * The Route (work package 1). The two cards at each level-up are a pure function of the fighter
 * seed and the picks taken before it. Nothing is stored but the picks; the kit is walked again.
 */
import type { KitBase, Pick as Side2, RouteCard, RouteNode, StatBlock, StatKey } from "../contracts/fighter";
import type { PerkId } from "../contracts/ids";
import { combineSeed, makeRng } from "../prng";
import { GEAR_CARD_PCT, allowed, fits, rollGear, rollPerk, weaponShare } from "./perks";
import { startPerk, startSkill } from "./create";
import { STAT_KEYS, applyCardToStats, applyPerkToStats, draftOf, freeze, startStats } from "./stats";

import type { StatsDraft } from "./stats";

/** What a scrapper owns after some picks. */
export interface Kit { stats: StatBlock; perks: PerkId[]; startPerk: PerkId; startSkill: PerkId; nodes: RouteNode[];
  /** Stat cards taken so far (see `statCardAmount`). */
  statCards: number;
  /** Perk cards taken so far. */
  perkCards: number }

/** The two starting perks of a seed: a weapon, then a skill (docs/RULES.md section 2). */
function startKit(seed: number): { d: StatsDraft; perks: PerkId[]; first: PerkId; second: PerkId } {
  const d = startStats(seed);
  const first = startPerk(seed);
  const second = startSkill(seed, first);
  applyPerkToStats(d, first);
  applyPerkToStats(d, second);
  return { d, perks: [first, second], first, second };
}

function picksKey(picks: readonly Side2[], upTo: number): string {
  let s = "";
  for (let i = 0; i < upTo; i++) s += picks[i];
  return s;
}

/** A perk card that is not allowed is rolled again this many times before it becomes a split
 *  (was 0: at level 30, 38% of perk cards were splits). */
export const PERK_REROLLS = 5;

/** A perk card taken on the way to level 2 up to this level also gives +1 point in a random stat
 *  (round-2 review). A kit of perks only had no stat points: a player who always took the perk card
 *  won 41% at level 10 and 28% at level 30, so the new item was the losing card. */
export const PERK_PLUS_MAX_LEVEL = 2;
/** ...and so do the perk cards from the first to the last of these, counted over the perk cards a
 *  kit has taken (the 17th to the 22nd). A kit of perks only is still short of stat points late. */
export const PERK_PLUS_CARDS: readonly [number, number] = [18, 22];

/** Whether the perk card of the level-up to `level` carries +1 stat point, for a kit that has taken
 *  `perkCards` perk cards. */
export function perkCardPlus(level: number, perkCards: number): boolean {
  return level <= PERK_PLUS_MAX_LEVEL || (perkCards + 1 >= PERK_PLUS_CARDS[0] && perkCards + 1 <= PERK_PLUS_CARDS[1]);
}

/** A stat card gives 2 points, and 1 more for each of these counts of stat cards already taken: 3
 *  points from the 7th stat card, 4 from the 21st (round 2, second pass). With 2 points on every
 *  card a player who always took the stat card won 36% at level 10 and 24% at level 30. Points for
 *  every kit by level instead lifted the rivals as much as the player; points by the kit's own stat
 *  cards lift the kit that takes them. Measured with the perk bonus above, 1,000 seeds x 3 rivals:
 *  always-stat 47 / 53 / 53 / 49% and always-perk 51 / 51 / 52 / 47% at levels 5 / 10 / 20 / 30. */
export const STAT_CARD_MORE: readonly number[] = [8];
export function statCardAmount(statCards: number): number {
  let amount = 2;
  for (const from of STAT_CARD_MORE) if (statCards >= from) amount += 1;
  return amount;
}

/** The two cards of node `k` (k = 0 is the first level-up) for a kit that owns `owned` and has taken
 *  `statCards` stat cards and `perkCards` perk cards. From node `gearFrom` on (0 for a record of this
 *  build), the perk card is a gear card GEAR_CARD_PCT of the time: a roll on its own stream, then a
 *  piece of gear by rarity, rolled again (up to PERK_REROLLS more times) while it is owned; it takes
 *  the place of the perk card (or the split), with the same +1 rule. The stat card and the left-right
 *  order stay as they were, so a walk with no gear card is the walk of content v3 batch 1. */
function nodeCards(seed: number, k: number, prefix: string, owned: readonly PerkId[], statCards: number, perkCards: number,
  gearFrom = 0): { left: RouteCard; right: RouteCard } {
  const rng = makeRng(combineSeed(seed, "route", k, prefix));
  const n = STAT_KEYS.length;
  const stat: RouteCard = { kind: "stat", stat: STAT_KEYS[rng.int(n)]!, amount: statCardAmount(statCards) };
  let perkCard: RouteCard | null = null;
  for (let i = 0; i <= PERK_REROLLS && perkCard === null; i++) {
    // The weapon share falls as the kit's weapons grow, to none at 5 (round-2 review).
    const rolled = rollPerk(rng, weaponShare(owned));
    if (!allowed(rolled, owned, rng)) continue;
    // Some perk cards also carry +1 point in a random stat (see `perkCardPlus`).
    perkCard = perkCardPlus(k + 2, perkCards) ? { kind: "perk", perk: rolled, plus: STAT_KEYS[rng.int(n)]! } : { kind: "perk", perk: rolled };
  }
  if (perkCard === null) {
    const first = rng.int(n);
    const second = (first + 1 + rng.int(n - 1)) % n;
    perkCard = { kind: "split", stats: [STAT_KEYS[first]!, STAT_KEYS[second]!] as [StatKey, StatKey] };
  }
  const left = rng.int(2) === 0;
  if (k >= gearFrom) {
    const g = makeRng(combineSeed(seed, "gear", k, prefix));
    if (g.int(100) < GEAR_CARD_PCT) {
      for (let i = 0; i <= PERK_REROLLS; i++) {
        const gear = rollGear(g);
        if (!fits(gear, owned)) continue;
        perkCard = perkCardPlus(k + 2, perkCards) ? { kind: "perk", perk: gear, plus: STAT_KEYS[g.int(n)]! } : { kind: "perk", perk: gear };
        break;
      }
    }
  }
  return left ? { left: stat, right: perkCard } : { left: perkCard, right: stat };
}

function applyCard(d: StatsDraft, perks: PerkId[], card: RouteCard): void {
  if (card.kind === "perk") {
    perks.push(card.perk);
    applyPerkToStats(d, card.perk);
    if (card.plus !== undefined) d.points[card.plus] += 1;
  }
  else applyCardToStats(d, card);
}

/** Starts a kit from the seed and walks the picks; with a carried kit (`base`, an earlier build's,
 *  contracts/fighter.ts `KitBase`) it starts from that kit after its picks and walks the rest. The
 *  Route then holds only the level-ups walked here: the cards of the carried ones are not known. */
export function walk(seed: number, picks: readonly Side2[], base?: KitBase, gearFrom = 0): Kit {
  const from = base !== undefined && base.picks <= picks.length ? base : undefined;
  const start = from === undefined ? startKit(seed) : (() => {
    const perks = [...from.perks];
    const first = perks[0]!;
    const second = from.starts >= 2 && perks[1] !== undefined ? perks[1] : first;
    return { d: draftOf(from.stats), perks, first, second };
  })();
  const { d, perks, first, second } = start;
  const nodes: RouteNode[] = [];
  // (a carried kit's counts of cards are read off it: its perks past the start ones were perk cards)
  let perkCards = from === undefined ? 0 : Math.max(0, from.perks.length - from.starts);
  let statCards = from === undefined ? 0 : Math.max(0, from.picks - perkCards);
  for (let k = from?.picks ?? 0; k < picks.length; k++) {
    const cards = nodeCards(seed, k, picksKey(picks, k), perks, statCards, perkCards, gearFrom);
    const taken = picks[k]!;
    const card = taken === "L" ? cards.left : cards.right;
    applyCard(d, perks, card);
    if (card.kind === "stat") statCards += 1;
    if (card.kind === "perk") perkCards += 1;
    nodes.push({ level: k + 2, left: cards.left, right: cards.right, taken });
  }
  return { stats: freeze(d), perks, startPerk: first, startSkill: second, nodes, statCards, perkCards };
}

/** The two cards after the given picks (from a carried kit, when there is one). Never rerolls. */
export function routeNode(seed: number, picks: readonly Side2[], base?: KitBase, gearFrom = 0): { left: RouteCard; right: RouteCard } {
  const kit = walk(seed, picks, base, gearFrom);
  return nodeCards(seed, picks.length, picksKey(picks, picks.length), kit.perks, kit.statCards, kit.perkCards, gearFrom);
}

/**
 * Walks a Route with a chooser that sees each node's cards: used for rivals. Returns the picks.
 * `choose` gets the cards and returns "L" or "R".
 */
export function walkWith(seed: number, count: number, choose: (cards: { left: RouteCard; right: RouteCard }) => Side2): Side2[] {
  const { d, perks } = startKit(seed);
  const picks: Side2[] = [];
  let statCards = 0;
  let perkCards = 0;
  for (let k = 0; k < count; k++) {
    const cards = nodeCards(seed, k, picksKey(picks, k), perks, statCards, perkCards);
    const taken = choose(cards);
    picks.push(taken);
    const card = taken === "L" ? cards.left : cards.right;
    applyCard(d, perks, card);
    if (card.kind === "stat") statCards += 1;
    if (card.kind === "perk") perkCards += 1;
  }
  return picks;
}
