/**
 * XP and level-ups (work package 1). Win 2, loss 1, and a win over a rival two or more levels
 * below gives 1. Extra XP carries over. No level cap.
 */
import type { Pick as Side2, ScrapperRecord } from "../contracts/fighter";

export function xpToNext(level: number): number {
  const l = level < 1 ? 1 : Math.floor(level);
  return 2 + l + Math.floor(l / 2);
}

export function xpForBout(won: boolean, ownLevel: number, oppLevel: number): 1 | 2 {
  if (!won) return 1;
  return oppLevel <= ownLevel - 2 ? 1 : 2;
}

export function levelOf(rec: ScrapperRecord): number {
  return 1 + rec.picks.length;
}

export function levelUpWaiting(rec: ScrapperRecord): boolean {
  return rec.xp >= xpToNext(levelOf(rec));
}

/** Takes the waiting level-up. With nothing waiting the record comes back unchanged. */
export function afterPick(rec: ScrapperRecord, pick: Side2): ScrapperRecord {
  if (!levelUpWaiting(rec)) return rec;
  return { ...rec, xp: rec.xp - xpToNext(levelOf(rec)), picks: [...rec.picks, pick] };
}
