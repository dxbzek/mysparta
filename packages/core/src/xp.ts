/** XP curve (02-gdd-core.md §6.2). Soft cap: level 50 per Aristeia cycle. */

export const LEVEL_CAP = 50;

/** XP required to go from `level` to `level + 1`. */
export function costToNext(level: number): number {
  if (level >= LEVEL_CAP) return Infinity;
  if (level <= 9) return level + 1;
  if (level <= 29) return level + 2;
  return level + 20;
}

/** Cumulative XP required to reach `level` from level 1. */
export function cumulativeXp(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += costToNext(l);
  return sum;
}

/**
 * XP for an initiated fight (00-vision.md §5): 2 per win, 1 per loss,
 * +1 bonus for beating a higher-rated opponent. The prototype uses the
 * rival's Kleos as the rating.
 */
export function fightXp(won: boolean, ownKleos: number, rivalKleos: number): number {
  if (!won) return 1;
  return rivalKleos > ownKleos ? 3 : 2;
}

/** Prototype Kleos exchange: Elo-lite ±16 with rating-gap scaling. */
export function kleosDelta(won: boolean, own: number, rival: number): number {
  const expected = 1 / (1 + Math.pow(10, (rival - own) / 400));
  const score = won ? 1 : 0;
  return Math.round(32 * (score - expected));
}
