/**
 * The Route (work package 1). The two cards at each level-up are a pure function of the fighter
 * seed and the picks taken before it. Nothing is stored but the picks; the kit is walked again.
 */
import type { Pick as Side2, RouteCard, RouteNode, StatBlock, StatKey } from "../contracts/fighter";
import type { PerkId } from "../contracts/ids";
import { combineSeed, makeRng } from "../prng";
import { allowed, rollPerk } from "./perks";
import { startPerk } from "./create";
import { STAT_KEYS, applyCardToStats, applyPerkToStats, freeze, startStats } from "./stats";
import type { StatsDraft } from "./stats";

/** What a scrapper owns after some picks. */
export interface Kit { stats: StatBlock; perks: PerkId[]; startPerk: PerkId; nodes: RouteNode[] }

function picksKey(picks: readonly Side2[], upTo: number): string {
  let s = "";
  for (let i = 0; i < upTo; i++) s += picks[i];
  return s;
}

/** The two cards of node `k` (k = 0 is the first level-up) for a kit that owns `owned`. */
function nodeCards(seed: number, k: number, prefix: string, owned: readonly PerkId[]): { left: RouteCard; right: RouteCard } {
  const rng = makeRng(combineSeed(seed, "route", k, prefix));
  const stat: RouteCard = { kind: "stat", stat: STAT_KEYS[rng.int(4)]!, amount: 2 };
  const rolled = rollPerk(rng);
  let perkCard: RouteCard;
  if (allowed(rolled, owned, rng)) {
    perkCard = { kind: "perk", perk: rolled };
  } else {
    const first = rng.int(4);
    const second = (first + 1 + rng.int(3)) % 4;
    perkCard = { kind: "split", stats: [STAT_KEYS[first]!, STAT_KEYS[second]!] as [StatKey, StatKey] };
  }
  return rng.int(2) === 0 ? { left: stat, right: perkCard } : { left: perkCard, right: stat };
}

function applyCard(d: StatsDraft, perks: PerkId[], card: RouteCard): void {
  if (card.kind === "perk") { perks.push(card.perk); applyPerkToStats(d, card.perk); }
  else applyCardToStats(d, card);
}

/** Starts a kit from the seed and walks the picks. */
export function walk(seed: number, picks: readonly Side2[]): Kit {
  const d = startStats(seed);
  const first = startPerk(seed);
  const perks: PerkId[] = [first];
  applyPerkToStats(d, first);
  const nodes: RouteNode[] = [];
  for (let k = 0; k < picks.length; k++) {
    const cards = nodeCards(seed, k, picksKey(picks, k), perks);
    const taken = picks[k]!;
    applyCard(d, perks, taken === "L" ? cards.left : cards.right);
    nodes.push({ level: k + 2, left: cards.left, right: cards.right, taken });
  }
  return { stats: freeze(d), perks, startPerk: first, nodes };
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
  const d = startStats(seed);
  const first = startPerk(seed);
  const perks: PerkId[] = [first];
  applyPerkToStats(d, first);
  const picks: Side2[] = [];
  for (let k = 0; k < count; k++) {
    const cards = nodeCards(seed, k, picksKey(picks, k), perks);
    const taken = choose(cards);
    picks.push(taken);
    applyCard(d, perks, taken === "L" ? cards.left : cards.right);
  }
  return picks;
}
