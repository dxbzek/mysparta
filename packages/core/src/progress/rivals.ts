/**
 * Rivals with no server (work package 1). A rival is made by the same code as a player's scrapper,
 * from a seed of its own, then levelled by walking its own Route with a seeded policy.
 */
import type { DayKey, FighterSnapshot, Pick as Side2, ScrapperRecord, StatKey } from "../contracts/fighter";
import { RIVALS_PER_LEVEL } from "../contracts/ids";
import { START_EACH, STAT_KEYS } from "./stats";
import { combineSeed, makeRng } from "../prng";
import { randomName, rollLook } from "./create";
import { walk, walkWith } from "./route";
import { defaultLoadout, loadoutPerks, statsWithGear, wornGear } from "./loadout";
import { levelOf } from "./xp";

/** A rival takes the perk card (or the split that replaced it) 65% of the time. */
export const RIVAL_PERK_PCT = 65;
export const CARD_SIZE = 6;
/** At levels 1 to 3 the last FAIR_EASY cards of the hand are an easy rival: the same rival, armed,
 *  with EASY_POINTS fewer stat points (round-2 review). The 2 unarmed cards these replace were free
 *  wins (a random scrapper beat them 96% of the time) and fought with fists right after the rule
 *  that every scrapper starts with a weapon. */
export const FAIR_EASY = 1;
export const FAIR_MAX_LEVEL = 3;
export const EASY_POINTS = 3;

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
  // a rival takes the sim's own loadout (content v3 batch 2): every weapon up to the limit, its
  // shield, its pets, the rarest gear of each slot
  const l = defaultLoadout(kit.perks);
  const snap: FighterSnapshot = {
    id: `rival:${realmSalt}:${lvl}:${index}`, name: randomName(seed), look: rollLook(seed, 0, 0), level: lvl,
    stats: statsWithGear(kit.stats, wornGear(l)), perks: loadoutPerks(kit.perks, l), rulesVersion: 1,
  };
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, snap);
  return snap;
}

/** The pool index of each card of Tonight's Card, before snapshots are made. */
export function cardIndices(rec: ScrapperRecord, realmSalt: string, today: DayKey): number[] {
  const level = levelOf(rec);
  // (the daily bout count that drew it before energy is gone: the lifetime count changes after
  // every bout just the same)
  const rng = makeRng(combineSeed(rec.seed, today, rec.lifetimeBouts));
  const used = new Set<number>();
  const draw = (): number => {
    for (;;) {
      const i = rng.int(RIVALS_PER_LEVEL);
      if (!used.has(i)) { used.add(i); return i; }
    }
  };
  const hand: number[] = [];
  for (let i = 0; i < CARD_SIZE; i++) hand.push(draw());
  return hand;
}

/** An easy rival: the same name, look, perks and weapons, its own id, and EASY_POINTS fewer stat
 *  points, each taken from its highest stat (the first of the stat order on a tie), never below
 *  START_EACH. */
export function easyRival(realmSalt: string, level: number, index: number): FighterSnapshot {
  const s = rivalSnapshot(realmSalt, level, index);
  const points = { ...s.stats.points };
  for (let i = 0; i < EASY_POINTS; i++) {
    let top: StatKey | null = null;
    for (const k of STAT_KEYS) if (points[k] > START_EACH && (top === null || points[k] > points[top])) top = k;
    if (top === null) break;
    points[top] -= 1;
  }
  return { ...s, id: `rival:${realmSalt}:${s.level}:easy:${index}`, stats: { points, mult: { ...s.stats.mult } } };
}

/** Six rivals at the scrapper's level, redrawn after every bout and at day rollover (drawn from
 *  hash(seed, today, lifetime bouts)). At levels 1
 *  to 3 the last FAIR_EASY of them are easy rivals (see `easyRival`). */
export function tonightsCard(rec: ScrapperRecord, realmSalt: string, today: DayKey): FighterSnapshot[] {
  const level = levelOf(rec);
  const easy = level <= FAIR_MAX_LEVEL ? FAIR_EASY : 0;
  return cardIndices(rec, realmSalt, today).map((i, slot) =>
    slot >= CARD_SIZE - easy ? easyRival(realmSalt, level, i) : rivalSnapshot(realmSalt, level, i));
}
