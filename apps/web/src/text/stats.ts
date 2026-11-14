/**
 * Words for the four stats and the ten derived fight values (brief 3.3), for the Kit's Stats tab,
 * the level-up stat card and the face-off sheet. The caps are the sim's; test/text/stats.test.ts
 * compares them with the sim's own table, so they cannot drift.
 */
import type { DerivedValues, StatKey } from "@rankzero/core";

export const STAT_KEYS: readonly StatKey[] = ["health", "strength", "agility", "speed"];

export const STAT_NAME: Readonly<Record<StatKey, string>> = {
  health: "Health", strength: "Strength", agility: "Agility", speed: "Speed",
};

/** One plain line on what a stat does. */
export const STAT_LINE: Readonly<Record<StatKey, string>> = {
  health: "More max HP. Every point adds to the HP bar.",
  strength: "Harder hits. Heavy weapons gain the most from it.",
  agility: "Dodges more, combos more, throws harder.",
  speed: "Acts more often, and sooner.",
};

/** What +2 (or +1) in a stat changes, for the level-up stat card. */
export const STAT_GAIN_LINE: Readonly<Record<StatKey, string>> = {
  health: "More HP in every bout.",
  strength: "Every hit lands harder.",
  agility: "Dodge and combo more often.",
  speed: "Take more turns than the other side.",
};

export const DERIVED_KEYS = ["evade", "block", "aim", "pierce", "intercept", "riposte", "combo", "disarm", "crit", "armor"] as const satisfies readonly (keyof DerivedValues)[];
export type DerivedKey = (typeof DERIVED_KEYS)[number];

export const DERIVED_NAME: Readonly<Record<DerivedKey, string>> = {
  evade: "Evade", block: "Block", aim: "Aim", pierce: "Pierce", intercept: "Intercept",
  riposte: "Riposte", combo: "Combo", disarm: "Disarm", crit: "Crit", armor: "Armor",
};

export const DERIVED_LINE: Readonly<Record<DerivedKey, string>> = {
  evade: "Chance to dodge a swing.",
  block: "Chance to stop a swing dead.",
  aim: "Taken off the target's Evade.",
  pierce: "Taken off the target's Block.",
  intercept: "Chance to hit an attacker first as it runs in.",
  riposte: "Chance to hit back after being attacked.",
  combo: "Chance of an extra swing. Agility adds to it.",
  disarm: "Chance a landed hit knocks the weapon away.",
  crit: "Chance a hit lands half again as hard.",
  armor: "Share of melee damage taken off every hit.",
};

/** The highest a chance can reach in a roll (after Aim or Pierce). Null = no cap. */
export const DERIVED_CAP: Readonly<Record<DerivedKey, number | null>> = {
  evade: 80, block: 75, aim: null, pierce: null, intercept: 75, riposte: 80, combo: 80, disarm: 80, crit: 60, armor: 60,
};

export const HOW_BOUTS_WORK: readonly string[] = [
  "Bouts play by themselves. You pick the rival; the scrappers do the rest.",
  "Everyone starts bare-handed with the whole kit in the bag, and pulls weapons out as the bout goes.",
  "Speed decides who acts and how often. Each swing can be dodged, blocked, hit first or hit back.",
  "Moves fire by chance at the start of a turn, a few times a bout at most.",
  "Pets fight on their own clock. Knocking one out never ends the bout; only the scrappers count.",
  "A win is worth more XP than a loss. Fill the XP bar to level up and pick one of two cards.",
];
