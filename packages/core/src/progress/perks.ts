/**
 * The perk pool (work package 1): the category roll, the rarity-weighted item roll, and the rules
 * that say when a rolled perk is not allowed. Rolls use whole numbers, so every chance is an exact
 * fraction (see perkChance).
 */
import type { CompanionId, PerkId, SkillId, WeaponId } from "../contracts/ids";
import { COMPANION_IDS, SHIELD_IDS, SKILL_IDS, WEAPON_IDS, isCompanionId, isShieldId, perkKind } from "../contracts/ids";
import type { PerkKind } from "../contracts/ids";
import { RARITY_OF, RARITY_WEIGHT } from "../contracts/content";
import type { Rng } from "../prng";
import { COMPANIONS } from "../content/companions";
import { SKILLS } from "../content/skills";

/** Category roll out of 100: weapon 44, skill 46, shield 6, companion 4 (content v2). */
export const CATEGORY_PCT: Readonly<Record<PerkKind, number>> = { weapon: 44, skill: 46, shield: 6, companion: 4 };
/** Order of the categories on the roll. */
const CATEGORY_ORDER: readonly PerkKind[] = ["weapon", "skill", "shield", "companion"];
/** A scrapper has three companion places at most (actor ids 1 to 3). */
export const MAX_COMPANIONS = 3;

interface Pool { ids: readonly PerkId[]; weights: readonly number[]; total: number }
function pool(ids: readonly PerkId[], weightOf: (id: PerkId) => number): Pool {
  const weights = ids.map(weightOf);
  return { ids, weights, total: weights.reduce((a, b) => a + b, 0) };
}
const POOLS: Readonly<Record<PerkKind, Pool>> = {
  weapon: pool(WEAPON_IDS, (id) => RARITY_WEIGHT[RARITY_OF[id]]),
  skill: pool(SKILL_IDS, (id) => RARITY_WEIGHT[RARITY_OF[id]]),
  companion: pool(COMPANION_IDS, (id) => COMPANIONS[id as CompanionId].weight),
  shield: pool(SHIELD_IDS, (id) => RARITY_WEIGHT[RARITY_OF[id]]),
};

function pickWeighted(p: Pool, r: number): PerkId {
  let left = r;
  for (let i = 0; i < p.ids.length; i++) {
    const w = p.weights[i]!;
    if (left < w) return p.ids[i]!;
    left -= w;
  }
  return p.ids[p.ids.length - 1]!;
}

/** One roll from the pool: the category first, then the item by weight. Two random numbers. */
export function rollPerk(rng: Rng): PerkId {
  let c = rng.int(100);
  let kind: PerkKind = "companion";
  for (const k of CATEGORY_ORDER) {
    if (c < CATEGORY_PCT[k]) { kind = k; break; }
    c -= CATEGORY_PCT[k];
  }
  const p = POOLS[kind];
  return pickWeighted(p, rng.int(p.total));
}

/** The exact chance that one roll gives this perk, as a fraction num / den. */
export function perkChance(id: PerkId): { num: number; den: number } {
  const kind = perkKind(id);
  const p = POOLS[kind];
  const at = p.ids.indexOf(id);
  return { num: CATEGORY_PCT[kind] * (at < 0 ? 0 : p.weights[at]!), den: 100 * p.total };
}

/** Booster pass chances by how many boosters are already owned: 0 owned always passes. */
export const BOOSTER_PASS_PCT: readonly number[] = [100, 10, 3, 0];

export function isBooster(id: PerkId): boolean {
  const def = (SKILLS as Record<string, { kind: string } | undefined>)[id];
  return def !== undefined && def.kind === "booster";
}

/**
 * Whether a rolled perk may be given to a kit that owns `owned`. A booster with boosters already
 * owned draws one more number from `rng` for its pass chance; nothing else draws.
 */
export function allowed(id: PerkId, owned: readonly PerkId[], rng: Rng): boolean {
  if (isCompanionId(id)) {
    const def = COMPANIONS[id];
    const have = owned.filter((p) => p === id).length;
    if (have >= def.limit) return false;
    if (owned.filter((p) => isCompanionId(p)).length >= MAX_COMPANIONS) return false;
    for (const ex of def.excludes) if (owned.includes(ex)) return false;
    return true;
  }
  if (owned.includes(id)) return false;
  if (isShieldId(id) && owned.some((p) => isShieldId(p))) return false;      // one shield at most
  if (id === "whistle" && !owned.some((p) => isCompanionId(p))) return false;
  if (isBooster(id)) {
    const n = owned.filter((p) => isBooster(p)).length;
    const pass = BOOSTER_PASS_PCT[n] ?? 0;
    if (pass >= 100) return true;
    if (pass <= 0) return false;
    return rng.int(100) < pass;
  }
  return true;
}

/** Weapons of a perk list, in list order. */
export function weaponsOf(perks: readonly PerkId[]): WeaponId[] {
  return perks.filter((p): p is WeaponId => perkKind(p) === "weapon");
}
