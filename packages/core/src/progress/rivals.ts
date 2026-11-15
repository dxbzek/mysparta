/**
 * Rivals with no server (work package 1). A rival is made by the same code as a player's scrapper,
 * from a seed of its own, then levelled by walking its own Route with a seeded policy.
 */
import type { DayKey, FighterSnapshot, Pick as Side2, ScrapperRecord } from "../contracts/fighter";
import { RIVALS_PER_LEVEL } from "../contracts/ids";
import { RARITY_OF } from "../contracts/content";
import { combineSeed, makeRng } from "../prng";
import { randomName, rollLook } from "./create";
import { walk, walkWith } from "./route";
import { weaponsOf } from "./perks";
import { boutsUsedToday } from "./daily";
import { levelOf } from "./xp";

/** A rival takes the perk card (or the split that replaced it) 65% of the time. */
export const RIVAL_PERK_PCT = 65;
export const CARD_SIZE = 6;
/** At levels 1 to 3 the card holds at least this many rivals whose weapons are all Common (every
 *  scrapper starts with a weapon since the 15 November pet pass, so none is unarmed). */
export const FAIR_UNARMED = 2;
export const FAIR_MAX_LEVEL = 3;

export function rivalSeed(realmSalt: string, level: number, index: number): number {
  return combineSeed(realmSalt, "rival", level, index);
}

const cache = new Map<string, FighterSnapshot>();
const CACHE_MAX = 20000;

export function rivalSnapshot(realmSalt: string, level: number, index: number): FighterSnapshot {
  const lvl = level < 1 ? 1 : Math.floor(level);
  const key = `${realmSalt}|${lvl}|${index}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const seed = rivalSeed(realmSalt, lvl, index);
  const policy = makeRng(combineSeed(seed, "policy"));
  const picks: Side2[] = walkWith(seed, lvl - 1, (cards) => {
    const perkSide: Side2 = cards.left.kind === "stat" ? "R" : "L";
    const statSide: Side2 = perkSide === "L" ? "R" : "L";
    return policy.int(100) < RIVAL_PERK_PCT ? perkSide : statSide;
  });
  const kit = walk(seed, picks);
  const snap: FighterSnapshot = {
    id: `rival:${realmSalt}:${lvl}:${index}`, name: randomName(seed), look: rollLook(seed, 0, 0), level: lvl,
    stats: kit.stats, perks: kit.perks, rulesVersion: 1,
  };
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, snap);
  return snap;
}

/** The pool index of each card of Tonight's Card, before snapshots are made. */
export function cardIndices(rec: ScrapperRecord, realmSalt: string, today: DayKey): number[] {
  const level = levelOf(rec);
  const rng = makeRng(combineSeed(rec.seed, today, boutsUsedToday(rec, today)));
  const used = new Set<number>();
  const draw = (): number => {
    for (;;) {
      const i = rng.int(RIVALS_PER_LEVEL);
      if (!used.has(i)) { used.add(i); return i; }
    }
  };
  const hand: number[] = [];
  for (let i = 0; i < CARD_SIZE; i++) hand.push(draw());
  if (level <= FAIR_MAX_LEVEL) {
    const easy = (i: number): boolean => weaponsOf(rivalSnapshot(realmSalt, level, i).perks).every((w) => RARITY_OF[w] === "common");
    // Redraw the last cards from the pool until two hold only Common weapons. The pool is finite, so
    // after every index has been seen the loop stops; a test proves the rule holds.
    let slot = CARD_SIZE - 1;
    while (hand.filter(easy).length < FAIR_UNARMED && used.size < RIVALS_PER_LEVEL) {
      while (slot >= 0 && easy(hand[slot]!)) slot -= 1;
      if (slot < 0) break;
      hand[slot] = draw();
    }
  }
  return hand;
}

/** Six rivals at the scrapper's level, redrawn after every bout and at day rollover. */
export function tonightsCard(rec: ScrapperRecord, realmSalt: string, today: DayKey): FighterSnapshot[] {
  const level = levelOf(rec);
  return cardIndices(rec, realmSalt, today).map((i) => rivalSnapshot(realmSalt, level, i));
}
