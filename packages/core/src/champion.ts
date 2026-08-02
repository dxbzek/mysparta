import { combineSeed, makeRng } from "./prng.js";
import { OMENS, omen as omenById } from "./content/omens.js";
import type { Champion, ChampionSnapshot, BattlePlan, StatName } from "./types.js";

/** Realm salt (02-gdd-core.md §3.2: name hashed, salted per realm). */
export const REALM_SALT = "realm:proto-1";

export function normaliseName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").normalize("NFKC").toLowerCase();
}

/** Optional player choices at creation — creation stays flexible. */
export interface CreationChoices {
  /** Awakening (omen id) — decides the starting weapon and stat spread. */
  omen?: string;
  /** Trained focus: +2 to one chosen stat. */
  focus?: StatName;
}

/**
 * Name-seeded creation (§3.2): the seed determines flavour and starting
 * tendencies — Omen, appearance, epithet — never permanent fate.
 * Base stats 6/6/6/6 + the Omen's +6 spread = 30 points at level 1.
 * Player choices (Awakening, Focus) override the rolled tendencies;
 * the same name with the same choices always creates the same champion.
 */
export function createChampion(rawName: string, choices?: CreationChoices): Champion {
  const display = rawName.trim().replace(/\s+/g, " ");
  const norm = normaliseName(rawName);
  if (norm.length < 2 || norm.length > 24) {
    throw new Error("A Champion's name must be 2-24 characters.");
  }
  const seed = combineSeed(REALM_SALT, norm);
  const rng = makeRng(seed);
  const rolled = OMENS[rng.int(OMENS.length)]!;
  const omen = choices?.omen ? omenById(choices.omen) : rolled;
  const focus = choices?.focus;
  return {
    name: norm,
    displayName: display,
    seed,
    omen: omen.id,
    epithet: omen.epithet,
    level: 1,
    xp: 0,
    stats: {
      might: 6 + omen.bonus.might + (focus === "might" ? 2 : 0),
      grace: 6 + omen.bonus.grace + (focus === "grace" ? 2 : 0),
      tempo: 6 + omen.bonus.tempo + (focus === "tempo" ? 2 : 0),
      grit: 6 + omen.bonus.grit + (focus === "grit" ? 2 : 0),
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
