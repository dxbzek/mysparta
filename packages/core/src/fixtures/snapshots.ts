/**
 * FROZEN FIXTURES (work package 0). Six hand-built snapshots that every lane may use before
 * the sim exists. Each obeys the creation and level-up rules: 14 starting points with every
 * stat from 2 to 5, one starting perk, level - 1 picks behind it, and boosters already inside
 * `stats`. Names and ids are fixture-only.
 */
import type { FighterSnapshot, Look } from "../contracts/fighter";

function look(build: number, head: number, hair: number, face: number, top: number, bottom: number,
  shoes: number, accessory: number, skin: number, hairColor: number, palette: number): Look {
  return { build, head, hair, face, top, bottom, shoes, accessory, skin, hairColor, palette };
}
const PLAIN = { health: 100, strength: 100, agility: 100, speed: 100 } as const;

/** Level 1, bare hands. Starting perk Padding. Max HP 61. */
export const l1Fists: FighterSnapshot = {
  id: "fixture:l1-fists", name: "Nettle", look: look(2, 3, 4, 1, 5, 2, 1, 0, 2, 5, 7), level: 1,
  stats: { points: { health: 4, strength: 4, agility: 3, speed: 3 }, mult: PLAIN },
  perks: ["padding"], rulesVersion: 1,
};

/** Level 1, lean build, starting perk Pipe. Max HP 68. Side a of the gate bout. */
export const l1Pipe: FighterSnapshot = {
  id: "fixture:l1-pipe", name: "Cuff", look: look(0, 1, 2, 0, 1, 0, 0, 0, 1, 2, 3), level: 1,
  stats: { points: { health: 5, strength: 3, agility: 2, speed: 4 }, mult: PLAIN },
  perks: ["pipe"], rulesVersion: 1,
};

/** Level 1, stocky build, starting perk Pocket Knife. Max HP 61. Side b of the gate bout. */
export const l1Knife: FighterSnapshot = {
  id: "fixture:l1-knife", name: "Brisket", look: look(1, 4, 7, 3, 6, 3, 2, 1, 5, 0, 9), level: 1,
  stats: { points: { health: 4, strength: 3, agility: 5, speed: 2 }, mult: PLAIN },
  perks: ["pocket-knife"], rulesVersion: 1,
};

/** Level 10 with a Raccoon. Start Bat; picks: Raccoon, Flurry, Energy Drink, Heavy Hands, five stat cards. */
export const l10Raccoon: FighterSnapshot = {
  id: "fixture:l10-raccoon", name: "Old Roy", look: look(1, 0, 9, 5, 2, 4, 3, 2, 6, 7, 0), level: 10,
  stats: { points: { health: 9, strength: 8, agility: 6, speed: 4 }, mult: { ...PLAIN, strength: 140 } },
  perks: ["bat", "raccoon", "flurry", "energy-drink", "heavy-hands"], rulesVersion: 1,
};

/** Level 10 with a Boar. Start Crowbar; picks: Boar, Padding, Tarp, Whistle, five stat cards. */
export const l10Boar: FighterSnapshot = {
  id: "fixture:l10-boar", name: "Wren", look: look(2, 5, 1, 6, 7, 1, 1, 4, 0, 3, 5), level: 10,
  stats: { points: { health: 8, strength: 8, agility: 3, speed: 5 }, mult: PLAIN },
  perks: ["crowbar", "boar", "padding", "tarp", "whistle"], rulesVersion: 1,
};

/** Level 20 thrower with a Car Door shield. Start Darts; eight perk picks and eleven stat cards. */
export const l20Thrower: FighterSnapshot = {
  id: "fixture:l20-thrower", name: "Tack", look: look(0, 2, 6, 7, 3, 2, 3, 5, 3, 6, 11), level: 20,
  stats: { points: { health: 11, strength: 4, agility: 16, speed: 8 }, mult: { ...PLAIN, agility: 140 } },
  perks: ["darts", "car-door", "pitcher", "boomerang", "light-feet", "bricks", "sharp-eye", "firecrackers", "last-stand"],
  rulesVersion: 1,
};

/** The six snapshots, in the order of the plan. */
export const SNAPSHOTS = { l1Fists, l1Pipe, l1Knife, l10Raccoon, l10Boar, l20Thrower } as const;
