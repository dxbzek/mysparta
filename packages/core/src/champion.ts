import { combineSeed, makeRng } from "./prng.js";
import { OMENS } from "./content/omens.js";
import type { Champion, ChampionSnapshot, BattlePlan } from "./types.js";

/** Realm salt (02-gdd-core.md §3.2: name hashed, salted per realm). */
export const REALM_SALT = "realm:proto-1";

export function normaliseName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").normalize("NFKC").toLowerCase();
}

/**
 * Name-seeded creation (§3.2): the seed determines flavour and starting
 * tendencies — Omen, appearance, epithet — never permanent fate.
 * Base stats 6/6/6/6 + the Omen's +6 spread = 30 points at level 1.
 */
export function createChampion(rawName: string): Champion {
  const display = rawName.trim().replace(/\s+/g, " ");
  const norm = normaliseName(rawName);
  if (norm.length < 2 || norm.length > 24) {
    throw new Error("A Champion's name must be 2-24 characters.");
  }
  const seed = combineSeed(REALM_SALT, norm);
  const rng = makeRng(seed);
  const omen = OMENS[rng.int(OMENS.length)]!;
  return {
    name: norm,
    displayName: display,
    seed,
    omen: omen.id,
    epithet: omen.epithet,
    level: 1,
    xp: 0,
    stats: {
      might: 6 + omen.bonus.might,
      grace: 6 + omen.bonus.grace,
      tempo: 6 + omen.bonus.tempo,
      grit: 6 + omen.bonus.grit,
    },
    weapons: [...omen.startingWeapons],
    skills: [],
    beasts: [],
    favour: 0,
    tapestry: [],
    declined: [],
    sinceWeaponOffer: 0,
    sinceSkillOffer: 0,
    appearance: {
      hue: rng.int(360),
      hue2: rng.int(360),
      pose: rng.int(4),
      skin: rng.int(6),
      sigil: rng.int(4),
      helm: rng.int(4),
      tint: rng.int(4),
    },
  };
}

export const DEFAULT_PLAN: BattlePlan = {
  stance: "measured",
  gambit: "close_the_gap",
};

export function snapshot(c: Champion, plan: BattlePlan): ChampionSnapshot {
  return {
    name: c.displayName,
    epithet: c.epithet,
    level: c.level,
    stats: { ...c.stats },
    weapons: [...c.weapons],
    skills: [...c.skills],
    beasts: [...c.beasts],
    plan,
  };
}
