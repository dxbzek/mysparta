/**
 * The Route (work package 1). The two cards at each level-up are a pure function of the fighter
 * seed and the picks taken before it. Nothing is stored but the picks; the kit is walked again.
 */
import type { Pick as Side2, RouteCard, RouteNode, StatBlock, StatKey } from "../contracts/fighter";
import type { PerkId } from "../contracts/ids";
import { combineSeed, makeRng } from "../prng";
import { allowed, rollPerk, weaponShare } from "./perks";
import { startPerk, startSkill } from "./create";
import { STAT_KEYS, applyCardToStats, applyPerkToStats, freeze, startStats } from "./stats";
import type { StatsDraft } from "./stats";

/** What a scrapper owns after some picks. */
export interface Kit { stats: StatBlock; perks: PerkId[]; startPerk: PerkId; startSkill: PerkId; nodes: RouteNode[] }

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
 *  won 41% at level 10 and 28% at level 30, so the new item was the losing card. With the bonus on
 *  the first three level-ups (and the weapon share of `weaponShare`) it wins 47 to 55% at levels
 *  5 to 30. A bonus up to level 8 was too much: 58% at level 10. */
export const PERK_PLUS_MAX_LEVEL = 4;

/** The two cards of node `k` (k = 0 is the first level-up) for a kit that owns `owned`. */
function nodeCards(seed: number, k: number, prefix: string, owned: readonly PerkId[]): { left: RouteCard; right: RouteCard } {
  const rng = makeRng(combineSeed(seed, "route", k, prefix));
  const stat: RouteCard = { kind: "stat", stat: STAT_KEYS[rng.int(4)]!, amount: 2 };
  let perkCard: RouteCard | null = null;
  for (let i = 0; i <= PERK_REROLLS && perkCard === null; i++) {
    // The weapon share falls as the kit's weapons grow, to none at 5 (round-2 review).
    const rolled = rollPerk(rng, weaponShare(owned));
    if (!allowed(rolled, owned, rng)) continue;
    // An early perk card also carries +1 point in a random stat (see PERK_PLUS_MAX_LEVEL).
    perkCard = k + 2 <= PERK_PLUS_MAX_LEVEL ? { kind: "perk", perk: rolled, plus: STAT_KEYS[rng.int(4)]! } : { kind: "perk", perk: rolled };
  }
  if (perkCard === null) {
    const first = rng.int(4);
    const second = (first + 1 + rng.int(3)) % 4;
    perkCard = { kind: "split", stats: [STAT_KEYS[first]!, STAT_KEYS[second]!] as [StatKey, StatKey] };
  }
  return rng.int(2) === 0 ? { left: stat, right: perkCard } : { left: perkCard, right: stat };
}

function applyCard(d: StatsDraft, perks: PerkId[], card: RouteCard): void {
  if (card.kind === "perk") {
    perks.push(card.perk);
    applyPerkToStats(d, card.perk);
    if (card.plus !== undefined) d.points[card.plus] += 1;
  }
  else applyCardToStats(d, card);
}

/** Starts a kit from the seed and walks the picks. */
export function walk(seed: number, picks: readonly Side2[]): Kit {
  const { d, perks, first, second } = startKit(seed);
  const nodes: RouteNode[] = [];
  for (let k = 0; k < picks.length; k++) {
    const cards = nodeCards(seed, k, picksKey(picks, k), perks);
    const taken = picks[k]!;
    applyCard(d, perks, taken === "L" ? cards.left : cards.right);
    nodes.push({ level: k + 2, left: cards.left, right: cards.right, taken });
  }
  return { stats: freeze(d), perks, startPerk: first, startSkill: second, nodes };
}

/** The two cards after the given picks. Never rerolls. */
export function routeNode(seed: number, picks: readonly Side2[]): { left: RouteCard; right: RouteCard } {
  const kit = walk(seed, picks);
  return nodeCards(seed, picks.length, picksKey(picks, picks.length), kit.perks);
}

/**
 * Walks a Route with a chooser that sees each node's cards: used for rivals. Returns the picks.
 * `choose` gets the cards and returns "L" or "R".
 */
export function walkWith(seed: number, count: number, choose: (cards: { left: RouteCard; right: RouteCard }) => Side2): Side2[] {
  const { d, perks } = startKit(seed);
  const picks: Side2[] = [];
  for (let k = 0; k < count; k++) {
    const cards = nodeCards(seed, k, picksKey(picks, k), perks);
    const taken = choose(cards);
    picks.push(taken);
    applyCard(d, perks, taken === "L" ? cards.left : cards.right);
  }
  return picks;
}
