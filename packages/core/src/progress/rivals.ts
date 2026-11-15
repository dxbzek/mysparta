/**
 * Rivals with no server (work package 1). A rival is made by the same code as a player's scrapper,
 * from a seed of its own, then levelled by walking its own Route with a seeded policy.
 */
import type { DayKey, FighterSnapshot, Pick as Side2, ScrapperRecord } from "../contracts/fighter";
import { RIVALS_PER_LEVEL, perkKind } from "../contracts/ids";
import { combineSeed, makeRng } from "../prng";
import { randomName, rollLook } from "./create";
import { walk, walkWith } from "./route";
import { boutsUsedToday } from "./daily";
import { levelOf } from "./xp";

/** A rival takes the perk card (or the split that replaced it) 65% of the time. */
export const RIVAL_PERK_PCT = 65;
export const CARD_SIZE = 6;
/** At levels 1 to 3 this many cards of the hand own no weapon: the same rival, weapons left at
 *  home. Every scrapper starts with a weapon since the 15 November 2026 pet pass, so the pool has no
 *  unarmed rival of its own; a random scrapper beats one of these about 96% of the time at levels 1
 *  to 3 (a Common-weapons rule picked rivals the player beat only 51-53% of the time). */
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
  return hand;
}

/** A rival with its weapons left at home: the same name, look, stats and other perks, its own id.
 *  Weapons change no stat, so the stat block stays right. */
export function unarmedRival(realmSalt: string, level: number, index: number): FighterSnapshot {
  const s = rivalSnapshot(realmSalt, level, index);
  return { ...s, id: `rival:${realmSalt}:${s.level}:unarmed:${index}`, perks: s.perks.filter((p) => perkKind(p) !== "weapon") };
}

/** Six rivals at the scrapper's level, redrawn after every bout and at day rollover. At levels 1
 *  to 3 the last FAIR_UNARMED of them own no weapon (the frozen rule of tonightsCard). */
export function tonightsCard(rec: ScrapperRecord, realmSalt: string, today: DayKey): FighterSnapshot[] {
  const level = levelOf(rec);
  const bare = level <= FAIR_MAX_LEVEL ? FAIR_UNARMED : 0;
  return cardIndices(rec, realmSalt, today).map((i, slot) =>
    slot >= CARD_SIZE - bare ? unarmedRival(realmSalt, level, i) : rivalSnapshot(realmSalt, level, i));
}
