/**
 * The kit of a save written before content v3 (work package 1). A save of schema 3 or older holds
 * a scrapper's seed and picks (and maybe a carried kit, `base`); its kit was walked by the
 * sim-version-7 Route: four stats, every stat card and stat bonus drawn from those four. Content
 * v3 draws them from six, which moves every later draw of the Route stream, so the same picks walk
 * into another kit today. The save migration to schema 4 calls `legacyKit` once per scrapper to
 * read the kit its build gave it, and carries it on as the scrapper's `base` with
 * `sixStatsOf` (docs/RULES.md, "Old saves").
 *
 * This is a frozen copy of that build's walk (74fc265). It shares the perk pool (`rollPerk`,
 * `allowed`, `weaponShare`) and the start perks with today's code, which content v3 left as they
 * were; test/legacy.test.ts holds 124 kits that build recorded, so a later change to the perk pool
 * that would move an old save's kit fails there first.
 */
import type { KitBase, Pick as Side2, StatBlock, StatKey } from "../contracts/fighter";
import type { PerkId, SkillId } from "../contracts/ids";
import { combineSeed, makeRng } from "../prng";
import { sk } from "../content/skills";
import { allowed, rollPerk, weaponShare } from "./perks";
import { startPerk, startSkill } from "./create";
import { STAT_CHANGERS } from "./stats";

type Four = "health" | "strength" | "agility" | "speed";
const FOUR: readonly Four[] = ["health", "strength", "agility", "speed"];
interface Draft4 { points: Record<Four, number>; mult: Record<Four, number> }

/** The kit an old save's scrapper had: its perks (the start perks first) and its four-stat block. */
export interface LegacyKit { perks: PerkId[]; starts: number; stats: { points: Record<Four, number>; mult: Record<Four, number> } }

function start4(seed: number): Draft4 {
  const rng = makeRng(combineSeed(seed, "stats"));
  const points: Record<Four, number> = { health: 2, strength: 2, agility: 2, speed: 2 };
  for (let i = 0; i < 6; i++) {
    const open = FOUR.filter((k) => points[k] < 5);
    points[open[rng.int(open.length)]!] += 1;
  }
  return { points, mult: { health: 100, strength: 100, agility: 100, speed: 100 } };
}

function perk4(d: Draft4, perk: PerkId): void {
  if (!(STAT_CHANGERS as readonly string[]).includes(perk)) return;
  for (const k of FOUR) {
    d.points[k] += sk(perk as SkillId, k);
    d.mult[k] += sk(perk as SkillId, `${k}Mult`);
  }
}

type Card4 = { kind: "stat"; stat: Four; amount: number } | { kind: "split"; stats: [Four, Four] }
  | { kind: "perk"; perk: PerkId; plus?: Four };

function cards4(seed: number, k: number, prefix: string, owned: readonly PerkId[], statCards: number, perkCards: number): { left: Card4; right: Card4 } {
  const rng = makeRng(combineSeed(seed, "route", k, prefix));
  const amount = 2 + (statCards >= 6 ? 1 : 0) + (statCards >= 20 ? 1 : 0);
  const stat: Card4 = { kind: "stat", stat: FOUR[rng.int(4)]!, amount };
  let perkCard: Card4 | null = null;
  for (let i = 0; i <= 5 && perkCard === null; i++) {
    const rolled = rollPerk(rng, weaponShare(owned));
    if (!allowed(rolled, owned, rng)) continue;
    const plus = k + 2 <= 3 || (perkCards + 1 >= 17 && perkCards + 1 <= 22);
    perkCard = plus ? { kind: "perk", perk: rolled, plus: FOUR[rng.int(4)]! } : { kind: "perk", perk: rolled };
  }
  if (perkCard === null) {
    const first = rng.int(4);
    const second = (first + 1 + rng.int(3)) % 4;
    perkCard = { kind: "split", stats: [FOUR[first]!, FOUR[second]!] };
  }
  return rng.int(2) === 0 ? { left: stat, right: perkCard } : { left: perkCard, right: stat };
}

/** The sim-version-7 walk of `picks` (from `base` on, when the save carried one). Stats in a base
 *  are read by their four old keys. */
export function legacyKit(seed: number, picks: readonly Side2[], base?: KitBase): LegacyKit {
  const from = base !== undefined && base.picks <= picks.length ? base : undefined;
  let d: Draft4;
  let perks: PerkId[];
  let starts: number;
  if (from === undefined) {
    d = start4(seed);
    const first = startPerk(seed);
    const second = startSkill(seed, first);
    perks = [first, second];
    perk4(d, first);
    perk4(d, second);
    starts = 2;
  } else {
    const p = from.stats.points as Partial<Record<StatKey, number>>;
    const m = from.stats.mult as Partial<Record<StatKey, number>>;
    d = { points: { health: p.health ?? 2, strength: p.strength ?? 2, agility: p.agility ?? 2, speed: p.speed ?? 2 },
      mult: { health: m.health ?? 100, strength: m.strength ?? 100, agility: m.agility ?? 100, speed: m.speed ?? 100 } };
    perks = [...from.perks];
    starts = from.starts;
  }
  let perkCards = from === undefined ? 0 : Math.max(0, from.perks.length - from.starts);
  let statCards = from === undefined ? 0 : Math.max(0, from.picks - perkCards);
  let prefix = "";
  for (let k = 0; k < (from?.picks ?? 0); k++) prefix += picks[k];
  for (let k = from?.picks ?? 0; k < picks.length; k++) {
    const cards = cards4(seed, k, prefix, perks, statCards, perkCards);
    const card = picks[k] === "L" ? cards.left : cards.right;
    if (card.kind === "perk") {
      perks.push(card.perk);
      perk4(d, card.perk);
      if (card.plus !== undefined) d.points[card.plus] += 1;
      perkCards += 1;
    } else if (card.kind === "stat") {
      d.points[card.stat] += card.amount;
      statCards += 1;
    } else {
      d.points[card.stats[0]] += 1;
      d.points[card.stats[1]] += 1;
    }
    prefix += picks[k];
  }
  return { perks, starts, stats: { points: { ...d.points }, mult: { ...d.mult } } };
}

/** Points an old four-stat block gains in each new stat: the 6 points the starting budget grew by
 *  (14 to 20), split evenly. So an old kit holds as many points as a kit of today at its level
 *  (docs/RULES.md, "Old saves": its power stays about where it was). */
export const LEGACY_NEW_STAT_POINTS = 3;

/** An old stat block with Toughness and Precision added (LEGACY_NEW_STAT_POINTS each, multiplier
 *  100). A block that already holds six stats is returned as it is. A missing old stat reads 2. */
export function sixStatsOf(s: { points: Partial<Record<StatKey, number>>; mult: Partial<Record<StatKey, number>> }): StatBlock {
  const has = (k: StatKey): boolean => Number.isInteger(s.points[k]) && Number.isInteger(s.mult[k]);
  const pt = (k: StatKey, d: number): number => (has(k) ? s.points[k]! : d);
  const ml = (k: StatKey): number => (has(k) ? s.mult[k]! : 100);
  return {
    points: { health: pt("health", 2), strength: pt("strength", 2), agility: pt("agility", 2), speed: pt("speed", 2),
      toughness: pt("toughness", LEGACY_NEW_STAT_POINTS), precision: pt("precision", LEGACY_NEW_STAT_POINTS) },
    mult: { health: ml("health"), strength: ml("strength"), agility: ml("agility"), speed: ml("speed"),
      toughness: ml("toughness"), precision: ml("precision") },
  };
}

/** The carried kit a migrated scrapper gets: its legacy kit after all its picks, with six stats. */
export function legacyBase(seed: number, picks: readonly Side2[], base?: KitBase): KitBase {
  const kit = legacyKit(seed, picks, base);
  return { picks: picks.length, starts: kit.starts, perks: kit.perks, stats: sixStatsOf(kit.stats) };
}

