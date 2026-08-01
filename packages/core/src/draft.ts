/**
 * Threads of Fate — the 1-of-3 level-up draft (02-gdd-core.md §6.3).
 * Weights: stat+3 (28), stat+2/+1 (27), weapon (20), skill (17), beast (8).
 * Guarantees: ≥1 stat offer always; milestone levels ≥1 non-stat; level 5
 * a weapon, 10 a skill, 15 a beast (capacity permitting); pity after 4
 * draft misses; duplicate protection; "Lachesis remembers" 3-draft decline
 * memory. Empty pools redistribute their weight (redraw).
 */

import { combineSeed, makeRng, type Rng } from "./prng.js";
import { WEAPONS } from "./content/weapons.js";
import { SKILLS } from "./content/skills.js";
import { BEASTS, beastTax } from "./content/beasts.js";
import type { Champion, FateOffer, StatName } from "./types.js";

const STATS: StatName[] = ["might", "grace", "tempo", "grit"];

function offerKey(o: FateOffer): string {
  switch (o.kind) {
    case "stat3": return `stat3:${o.stat}`;
    case "stat21": return `stat21:${o.main}:${o.minor}`;
    case "weapon": return `weapon:${o.weapon}`;
    case "skill": return `skill:${o.skill}`;
    case "beast": return `beast:${o.beast}`;
  }
}

function weaponPool(c: Champion, draftIndex: number): string[] {
  const declined = new Set(
    c.declined.filter((d) => d.untilDraft > draftIndex).map((d) => d.id),
  );
  return WEAPONS.map((w) => w.id).filter(
    (id) => !c.weapons.includes(id) && !declined.has(`weapon:${id}`),
  );
}

function skillPool(c: Champion, draftIndex: number): string[] {
  const declined = new Set(
    c.declined.filter((d) => d.untilDraft > draftIndex).map((d) => d.id),
  );
  return SKILLS.map((s) => s.id).filter(
    (id) => !c.skills.includes(id) && !declined.has(`skill:${id}`),
  );
}

/** Beast offers respect capacity (tax ≤ Grit − 1) and the one-non-wolf rule. */
function beastPool(c: Champion): string[] {
  const hasBond = c.skills.includes("beast_bond");
  const currentTax = beastTax(c.beasts, hasBond);
  const wolves = c.beasts.filter((b) => b === "lykos").length;
  const hasNonWolf = c.beasts.some((b) => b !== "lykos");
  return BEASTS.filter((b) => {
    if (b.id === "lykos" && wolves >= 3) return false;
    if (b.id !== "lykos" && hasNonWolf) return false;
    const newTax = Math.max(0, b.gritTax - (hasBond ? 1 : 0));
    return currentTax + newTax <= c.stats.grit - 1;
  }).map((b) => b.id);
}

function drawStat3(rng: Rng): FateOffer {
  return { kind: "stat3", stat: rng.pick(STATS) };
}

function drawStat21(rng: Rng): FateOffer {
  const main = rng.pick(STATS);
  let minor = rng.pick(STATS);
  while (minor === main) minor = rng.pick(STATS);
  return { kind: "stat21", main, minor };
}

/**
 * Generate the three offers for the draft at `level`.
 * `rerollNonce` varies the seed when Favour is spent (redraw is final).
 */
export function generateDraft(c: Champion, level: number, rerollNonce = 0): FateOffer[] {
  const draftIndex = c.tapestry.length;
  const rng = makeRng(combineSeed(c.seed, "draft", draftIndex, level, rerollNonce));

  // First draft is fixed (§3.3): one +3 stat, one +2/+1 stat, one weapon.
  if (draftIndex === 0) {
    const wPool = weaponPool(c, draftIndex);
    return [
      drawStat3(rng),
      drawStat21(rng),
      { kind: "weapon", weapon: rng.pick(wPool) },
    ];
  }

  const wPool = weaponPool(c, draftIndex);
  const sPool = skillPool(c, draftIndex);
  const bPool = beastPool(c);

  const categories: Array<{ kind: FateOffer["kind"]; weight: number; ok: () => boolean }> = [
    { kind: "stat3", weight: 28, ok: () => true },
    { kind: "stat21", weight: 27, ok: () => true },
    { kind: "weapon", weight: 20, ok: () => wPool.length > 0 },
    { kind: "skill", weight: 17, ok: () => sPool.length > 0 },
    { kind: "beast", weight: 8, ok: () => bPool.length > 0 },
  ];

  const drawCategory = (): FateOffer["kind"] => {
    const live = categories.filter((cat) => cat.ok());
    const total = live.reduce((s, cat) => s + cat.weight, 0);
    let r = rng.int(total);
    for (const cat of live) {
      r -= cat.weight;
      if (r < 0) return cat.kind;
    }
    return "stat3";
  };

  const used = new Set<string>();
  const drawOffer = (kind: FateOffer["kind"]): FateOffer | undefined => {
    for (let attempt = 0; attempt < 12; attempt++) {
      let offer: FateOffer;
      switch (kind) {
        case "stat3": offer = drawStat3(rng); break;
        case "stat21": offer = drawStat21(rng); break;
        case "weapon": offer = { kind: "weapon", weapon: rng.pick(wPool) }; break;
        case "skill": offer = { kind: "skill", skill: rng.pick(sPool) }; break;
        case "beast": offer = { kind: "beast", beast: rng.pick(bPool) }; break;
      }
      const key = offerKey(offer);
      if (!used.has(key)) {
        used.add(key);
        return offer;
      }
    }
    return undefined;
  };

  const offers: FateOffer[] = [];
  for (let i = 0; i < 3; i++) {
    let o: FateOffer | undefined;
    for (let guard = 0; guard < 20 && !o; guard++) o = drawOffer(drawCategory());
    offers.push(o ?? drawStat3(rng));
  }

  const isStat = (o: FateOffer) => o.kind === "stat3" || o.kind === "stat21";
  const replaceAt = (i: number, o: FateOffer | undefined) => {
    if (o) offers[i] = o;
  };

  // ≥1 stat offer, always (the no-brick guarantee).
  if (!offers.some(isStat)) replaceAt(2, drawOffer(rng.pct(50) ? "stat3" : "stat21"));

  // Milestone guarantees.
  const milestone = level % 5 === 0;
  const ensureKind = (kind: FateOffer["kind"], pool: string[]) => {
    if (pool.length === 0) return false;
    if (offers.some((o) => o.kind === kind)) return true;
    // Replace a non-stat first; else the second stat offer (never the only stat).
    const statIdxs = offers.map((o, i) => (isStat(o) ? i : -1)).filter((i) => i >= 0);
    const nonStatIdx = offers.findIndex((o) => !isStat(o));
    const idx = nonStatIdx >= 0 ? nonStatIdx : statIdxs.length > 1 ? statIdxs[statIdxs.length - 1]! : -1;
    if (idx >= 0) replaceAt(idx, drawOffer(kind));
    return offers.some((o) => o.kind === kind);
  };

  if (level === 5) ensureKind("weapon", wPool);
  else if (level === 10) ensureKind("skill", sPool);
  else if (level === 15) {
    if (!ensureKind("beast", bPool)) {
      if (!ensureKind("weapon", wPool)) ensureKind("skill", sPool);
    }
  } else if (milestone && offers.every(isStat)) {
    if (!ensureKind("weapon", wPool)) ensureKind("skill", sPool);
  }

  // Pity rule: 4 consecutive drafts without a weapon (or skill) offer.
  if (c.sinceWeaponOffer >= 4) ensureKind("weapon", wPool);
  if (c.sinceSkillOffer >= 4) ensureKind("skill", sPool);

  return offers;
}

/** Apply the picked offer; record the Tapestry band and decline memory. */
export function applyDraft(
  c: Champion,
  offers: FateOffer[],
  picked: number,
  rerolled: boolean,
): void {
  const draftIndex = c.tapestry.length;
  const offer = offers[picked];
  if (!offer) throw new Error("Invalid pick");

  switch (offer.kind) {
    case "stat3":
      c.stats[offer.stat] += 3;
      break;
    case "stat21":
      c.stats[offer.main] += 2;
      c.stats[offer.minor] += 1;
      break;
    case "weapon":
      c.weapons.push(offer.weapon);
      break;
    case "skill":
      c.skills.push(offer.skill);
      break;
    case "beast":
      c.beasts.push(offer.beast);
      break;
  }

  // "Lachesis remembers": declined weapon/skill offers sit out 3 drafts.
  offers.forEach((o, i) => {
    if (i === picked) return;
    if (o.kind === "weapon") c.declined.push({ id: `weapon:${o.weapon}`, untilDraft: draftIndex + 4 });
    if (o.kind === "skill") c.declined.push({ id: `skill:${o.skill}`, untilDraft: draftIndex + 4 });
  });
  c.declined = c.declined.filter((d) => d.untilDraft > draftIndex + 1);

  // Pity counters.
  c.sinceWeaponOffer = offers.some((o) => o.kind === "weapon") ? 0 : c.sinceWeaponOffer + 1;
  c.sinceSkillOffer = offers.some((o) => o.kind === "skill") ? 0 : c.sinceSkillOffer + 1;

  c.tapestry.push({ level: c.level + 1, offers, picked, rerolled });
  c.level += 1;

  // Favour: +1 at each milestone level (5, 10, 15 … 50), cap 6.
  if (c.level % 5 === 0) c.favour = Math.min(6, c.favour + 1);
}

/** Player-facing stat names (internal keys stay might/grace/tempo/grit). */
export const STAT_LABEL: Record<StatName, string> = {
  might: "Strength",
  grace: "Agility",
  tempo: "Speed",
  grit: "Endurance",
};

export function describeOffer(o: FateOffer): string {
  switch (o.kind) {
    case "stat3": return `+3 ${STAT_LABEL[o.stat]}`;
    case "stat21": return `+2 ${STAT_LABEL[o.main]} / +1 ${STAT_LABEL[o.minor]}`;
    case "weapon": return `Weapon: ${WEAPONS.find((w) => w.id === o.weapon)?.name ?? o.weapon}`;
    case "skill": return `Skill: ${SKILLS.find((s) => s.id === o.skill)?.name ?? o.skill}`;
    case "beast": return `Pet: ${BEASTS.find((b) => b.id === o.beast)?.name ?? o.beast}`;
  }
}
