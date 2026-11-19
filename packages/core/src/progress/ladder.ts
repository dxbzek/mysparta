/**
 * The rank ladder (plan 13.10 item 1; docs/RULES.md section 4b). Ten hand-made bosses, one per rung,
 * bottom up. A scrapper starts at Rank Zero (no boss beaten); beating the boss of the next rung up
 * moves it up one rank and gives one boss prize: a pick of two cards, a piece of gear or a Rare or
 * better weapon, skill, shield or pet. A boss bout costs one energy like any bout and gives the
 * usual XP; a loss costs nothing more. The sim is unchanged: a boss is a fixed snapshot.
 */
import type { BossBlock, FighterSnapshot, LadderState, Pick as Side2, RouteCard, ScrapperRecord, StatKey, TimeMs } from "../contracts/fighter";
import { LADDER_RUNGS } from "../contracts/fighter";
import type { PerkId } from "../contracts/ids";
import { COMPANION_IDS, GEAR_IDS, SHIELD_IDS, SKILL_IDS, WEAPON_IDS } from "../contracts/ids";
import { RARITY_OF } from "../contracts/content";
import { BOSSES } from "../content/bosses";
import { combineSeed, makeRng } from "../prng";
import { afterBout } from "./energy";
import { defaultLoadout, loadoutPerks, statsWithGear, wornGear } from "./loadout";
import { fits } from "./perks";
import { kitOf } from "./snapshot";
import { STAT_KEYS, applyPerkToStats, freeze, plainMult } from "./stats";
import { branchBuild, statsWithTalents, talentPointsAt } from "./talents";
import { levelOf } from "./xp";

/** The first boss stands at this level, and each one above it this many levels higher. */
export const GATE_FIRST = 3;
export const GATE_EVERY = 3;
/** A prize's stat card, where no item fits: this many points. */
export const PRIZE_STAT_POINTS = 3;

export function bossGate(rung: number): number {
  return GATE_FIRST + GATE_EVERY * (Math.floor(rung) - 1);
}

/** The ladder a record holds, cleaned: a rank of 0 to LADDER_RUNGS, at most `rank` prizes. */
export function ladderState(rec: ScrapperRecord): LadderState {
  const l = rec.ladder;
  if (l === undefined) return { rank: 0, prizes: [] };
  const rank = Number.isInteger(l.rank) ? Math.max(0, Math.min(LADDER_RUNGS, l.rank)) : 0;
  return { rank, prizes: Array.isArray(l.prizes) ? l.prizes.slice(0, rank) : [] };
}

export function ladderOf(rec: ScrapperRecord): { rank: number; prizeWaiting: boolean } {
  const l = ladderState(rec);
  return { rank: l.rank, prizeWaiting: l.prizes.length < l.rank };
}

const cache = new Map<number, FighterSnapshot>();

/** The boss of a rung as a bout snapshot: its points with its boosters, worn gear and stat talents
 *  added the way a scrapper's are, and its talents down its own branch. Frozen and cached. */
export function bossSnapshot(rung: number): FighterSnapshot {
  const hit = cache.get(rung);
  if (hit !== undefined) return hit;
  const def = BOSSES.find((b) => b.rung === rung);
  if (def === undefined) throw new Error(`bossSnapshot: no boss on rung ${rung}`);
  const d = { points: { ...def.points } as Record<StatKey, number>, mult: plainMult() };
  for (const p of def.perks) applyPerkToStats(d, p);
  const perks = loadoutPerks(def.perks, defaultLoadout(def.perks));
  const talents = branchBuild(def.branch, talentPointsAt(def.level));
  const stats = statsWithTalents(statsWithGear(freeze(d), wornGear(defaultLoadout(def.perks))), talents);
  const snap: FighterSnapshot = { id: `boss:${rung}`, name: def.name, look: { ...def.look }, level: def.level, stats, perks,
    rulesVersion: 1, talents };
  cache.set(rung, snap);
  return snap;
}

export function bossBlock(rec: ScrapperRecord, rung: number): BossBlock | null {
  const { rank } = ladderState(rec);
  if (rung <= rank) return "beaten";
  if (rung !== rank + 1) return "rank";
  if (levelOf(rec) < bossGate(rung)) return "level";
  return null;
}

/** One energy, the bout counted, its XP; a win over the next rung's boss is one rank up. */
export function afterBoss(rec: ScrapperRecord, rung: number, won: boolean, xp: 1 | 2, nowMs: TimeMs): ScrapperRecord {
  const after = afterBout(rec, xp, nowMs);
  const l = ladderState(rec);
  if (!won || rung !== l.rank + 1 || rung > LADDER_RUNGS) return { ...after, ladder: l };
  return { ...after, ladder: { rank: l.rank + 1, prizes: l.prizes } };
}

const RARE_UP = new Set(["rare", "epic", "mythic"]);
const ITEM_IDS: readonly PerkId[] = [...WEAPON_IDS, ...SKILL_IDS, ...SHIELD_IDS, ...COMPANION_IDS];

/** One of `ids` that fits the kit, picked by `n`, or null. */
function pickFrom(ids: readonly PerkId[], owned: readonly PerkId[], n: number): PerkId | null {
  const ok = ids.filter((id) => fits(id, owned));
  return ok.length === 0 ? null : ok[n % ok.length]!;
}

export function prizeOffer(rec: ScrapperRecord): { left: RouteCard; right: RouteCard } | null {
  const l = ladderState(rec);
  if (l.prizes.length >= l.rank) return null;
  const rung = l.prizes.length + 1;
  const owned = kitOf(rec).perks;
  const rng = makeRng(combineSeed(rec.seed, "prize", rung));
  const statCard = (): RouteCard => ({ kind: "stat", stat: STAT_KEYS[rng.int(STAT_KEYS.length)]!, amount: PRIZE_STAT_POINTS });
  // a piece of gear the kit does not own, Rare or better while one is left, else any
  const g = rng.int(1 << 30);
  const gear = pickFrom(GEAR_IDS.filter((id) => RARE_UP.has(RARITY_OF[id])), owned, g) ?? pickFrom(GEAR_IDS, owned, g);
  // a Rare or better weapon, skill, shield or pet the kit may own
  const item = pickFrom(ITEM_IDS.filter((id) => RARE_UP.has(RARITY_OF[id])), owned, rng.int(1 << 30));
  return {
    left: gear !== null ? { kind: "perk", perk: gear } : statCard(),
    right: item !== null ? { kind: "perk", perk: item } : statCard(),
  };
}

export function takePrize(rec: ScrapperRecord, pick: Side2): ScrapperRecord {
  const offer = prizeOffer(rec);
  if (offer === null) return rec;
  const l = ladderState(rec);
  const card = pick === "L" ? offer.left : offer.right;
  return { ...rec, ladder: { rank: l.rank, prizes: [...l.prizes, { at: rec.picks.length, card }] } };
}
