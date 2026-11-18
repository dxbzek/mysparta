/**
 * The talent tree (content v3, batch 3, plan 13.11). Points come with levels (1 at level 3 and 1
 * every 3 levels after), the player spends them one rank at a time in five branches of six nodes,
 * a node's tier opens when enough points are spent in the lower tiers of its branch, and one free
 * respec a day hands every point back. Nothing about points is stored: a record holds the ranks
 * spent and the day of its last respec, and both are cleaned against the rules when read.
 * Rivals spend theirs by a fixed rule (`rivalTalents`). docs/RULES.md 3c.
 */
import type { DayKey, ScrapperRecord, StatBlock, TalentPicks, TalentRanks } from "../contracts/fighter";
import type { PerkId, TalentBranch, TalentId } from "../contracts/ids";
import { TALENT_BRANCHES, TALENT_IDS, isCompanionId, isShieldId, isTalentId, isWeaponId } from "../contracts/ids";
import { TALENT_META, TALENT_TIER_NEED } from "../contracts/content";
import type { TalentBlock } from "../contracts/api";
import { branchNodes, tn } from "../content/talents";
import { hasTag } from "../content/weapons";
import { combineSeed, makeRng } from "../prng";
import { draftOf, freeze } from "./stats";

/** The first level that gives a point, and the levels between points. */
export const TALENT_FROM = 3;
export const TALENT_EVERY = 3;

/** Points earned at a level: 1 at level 3, and 1 every 3 levels after (10 at level 30). */
export function talentPointsAt(level: number): number {
  const l = Math.floor(level);
  return l < TALENT_FROM ? 0 : 1 + Math.floor((l - TALENT_FROM) / TALENT_EVERY);
}

/** The rank of a node in a rank table (0 when absent). */
export function rankOf(ranks: TalentRanks | undefined, id: TalentId): number {
  const r = ranks?.[id];
  return typeof r === "number" ? r : 0;
}

/** Points spent in the tiers of `branch` below `tier`. */
export function lowerPoints(ranks: TalentRanks, branch: TalentBranch, tier: number): number {
  let n = 0;
  for (const id of branchNodes(branch)) if (TALENT_META[id].tier < tier) n += rankOf(ranks, id);
  return n;
}

export function spentOf(ranks: TalentRanks): number {
  let n = 0;
  for (const id of TALENT_IDS) n += rankOf(ranks, id);
  return n;
}

/**
 * A rank table as the rules allow it, with at most `earned` ranks: unknown ids and ranks that are
 * not whole numbers from 1 to the node's max are dropped; then, tier by tier, the nodes of a tier
 * that is not open (fewer points in the lower tiers of the branch than TALENT_TIER_NEED) are
 * dropped; then, while more ranks are spent than earned, one rank comes off the node of the highest
 * tier (the last in the tree's order on a tie), which never closes another node.
 */
export function cleanRanks(raw: unknown, earned: number): Partial<Record<TalentId, number>> {
  const out: Partial<Record<TalentId, number>> = {};
  if (raw === null || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isTalentId(k) || typeof v !== "number" || !Number.isInteger(v) || v < 1) continue;
    out[k] = Math.min(v, TALENT_META[k].max);
  }
  for (const branch of TALENT_BRANCHES) {
    for (let tier = 1; tier <= 3; tier++) {
      if (lowerPoints(out, branch, tier) >= TALENT_TIER_NEED[tier]!) continue;
      for (const id of branchNodes(branch)) if (TALENT_META[id].tier === tier) delete out[id];
    }
  }
  let over = spentOf(out) - Math.max(0, earned);
  while (over > 0) {
    let top: TalentId | null = null;
    for (const id of TALENT_IDS) if (rankOf(out, id) > 0 && (top === null || TALENT_META[id].tier >= TALENT_META[top].tier)) top = id;
    if (top === null) break;
    const r = rankOf(out, top) - 1;
    if (r > 0) out[top] = r; else delete out[top];
    over -= 1;
  }
  return out;
}

const levelOfRec = (rec: ScrapperRecord): number => 1 + rec.picks.length;

/** A record's tree as the rules read it: points earned at its level, the ranks that hold, spent
 *  and unspent points. */
export function talentsOf(rec: ScrapperRecord): { earned: number; spent: number; unspent: number; ranks: TalentRanks } {
  const earned = talentPointsAt(levelOfRec(rec));
  const ranks = cleanRanks(rec.talents?.ranks, earned);
  const spent = spentOf(ranks);
  return { earned, spent, unspent: earned - spent, ranks };
}

/** Why one more rank of `id` cannot be spent in a rank table with `unspent` points left, or null. */
export function blockIn(ranks: TalentRanks, unspent: number, id: TalentId): TalentBlock | null {
  const m = TALENT_META[id];
  if (rankOf(ranks, id) >= m.max) return "maxed";
  if (lowerPoints(ranks, m.branch, m.tier) < TALENT_TIER_NEED[m.tier]) return "locked";
  if (unspent <= 0) return "no-points";
  return null;
}

export function talentBlock(rec: ScrapperRecord, id: TalentId): TalentBlock | null {
  const t = talentsOf(rec);
  return blockIn(t.ranks, t.unspent, id);
}

function withPicks(rec: ScrapperRecord, picks: TalentPicks): ScrapperRecord {
  return { ...rec, talents: picks };
}

export function spendTalent(rec: ScrapperRecord, id: TalentId): ScrapperRecord {
  if (!isTalentId(id) || talentBlock(rec, id) !== null) return rec;
  const t = talentsOf(rec);
  const ranks = { ...t.ranks, [id]: rankOf(t.ranks, id) + 1 };
  const picks: TalentPicks = rec.talents?.respecDay !== undefined ? { ranks, respecDay: rec.talents.respecDay } : { ranks };
  return withPicks(rec, picks);
}

export function canRespec(rec: ScrapperRecord, today: DayKey): boolean {
  return talentsOf(rec).spent > 0 && rec.talents?.respecDay !== today;
}

export function respecTalents(rec: ScrapperRecord, today: DayKey): ScrapperRecord {
  if (!canRespec(rec, today)) return rec;
  return withPicks(rec, { ranks: {}, respecDay: today });
}

/** The stat points of the stat talents (Gym Rat: Strength, Thick Skin: Toughness), added to a
 *  bout's snapshot like the gear's (the sim never adds them again). */
export function statsWithTalents(stats: StatBlock, ranks: TalentRanks | undefined): StatBlock {
  const str = rankOf(ranks, "gym-rat") * tn("gym-rat", "strength");
  const tou = rankOf(ranks, "thick-skin") * tn("thick-skin", "toughness");
  if (str === 0 && tou === 0) return stats;
  const d = draftOf(stats);
  d.points.strength += str;
  d.points.toughness += tou;
  return freeze(d);
}

/** The order a branch is filled in: one rank in each of its five nodes in tier order, the capstone,
 *  then a second rank in each node that takes one, then a third. */
export function branchOrder(branch: TalentBranch): TalentId[] {
  const nodes = branchNodes(branch);
  const cap = nodes.find((id) => TALENT_META[id].tier === 3)!;
  const rest = nodes.filter((id) => id !== cap);
  const order: TalentId[] = [...rest, cap];
  for (let r = 2; r <= 3; r++) for (const id of rest) if (TALENT_META[id].max >= r) order.push(id);
  return order;
}

/** `points` ranks spent down one branch in `branchOrder`, then on into the next branches in tree
 *  order once it is full. */
export function branchBuild(branch: TalentBranch, points: number): Partial<Record<TalentId, number>> {
  const out: Partial<Record<TalentId, number>> = {};
  const start = TALENT_BRANCHES.indexOf(branch);
  let left = points;
  for (let k = 0; k < TALENT_BRANCHES.length && left > 0; k++) {
    for (const id of branchOrder(TALENT_BRANCHES[(start + k) % TALENT_BRANCHES.length]!)) {
      if (left <= 0) break;
      out[id] = rankOf(out, id) + 1;
      left -= 1;
    }
  }
  return out;
}

/**
 * How well a branch fits a kit (the weight of its pick for a rival; 0 = never): Brawler 1 (2 with
 * Bare Knuckle), Arsenal 1 with a melee weapon (2 with two or more), Thrower 3 with a Thrown weapon
 * or a throwing skill (Pitcher, Junk Collector, Trick Shot), Pack 3 with
 * a companion, Iron Wall 3 with a shield, else 1.
 */
export function branchFit(branch: TalentBranch, perks: readonly PerkId[]): number {
  const weapons = perks.filter(isWeaponId);
  const melee = weapons.filter((w) => !hasTag(w, "thrown")).length;
  const thrown = weapons.length - melee;
  switch (branch) {
    case "brawler": return perks.includes("bare-knuckle") ? 2 : 1;
    case "arsenal": return melee >= 2 ? 2 : melee === 1 ? 1 : 0;
    case "thrower": return thrown > 0 || perks.some((p) => p === "pitcher" || p === "junk-collector" || p === "trick-shot") ? 3 : 0;
    case "pack": return perks.some(isCompanionId) ? 3 : 0;
    case "iron-wall": return perks.some(isShieldId) ? 3 : 1;
  }
}

/** A rival's branch: one draw by `branchFit` weights from (seed, "talents"). */
export function rivalBranch(seed: number, perks: readonly PerkId[]): TalentBranch {
  const w = TALENT_BRANCHES.map((b) => branchFit(b, perks));
  const total = w.reduce((x, y) => x + y, 0);
  let r = makeRng(combineSeed(seed, "talents")).int(total);
  for (const [i, b] of TALENT_BRANCHES.entries()) {
    if (r < w[i]!) return b;
    r -= w[i]!;
  }
  return "brawler";
}

/** The sim's own ranks for a kit owning `perks` (what it takes into the bout) at `level`: every
 *  point down the branch `rivalBranch` draws, in `branchOrder`. */
export function rivalTalents(seed: number, perks: readonly PerkId[], level: number): TalentRanks {
  const points = talentPointsAt(level);
  return points === 0 ? {} : branchBuild(rivalBranch(seed, perks), points);
}

